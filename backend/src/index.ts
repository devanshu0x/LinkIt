import express from "express";
import {
  PORT,
  ROOM_ID_LEN,
  ROOM_STALE_TIMEOUT_MS,
  TRANSFER_CLEANUP_DELAY_MS,
  SYMBOLS,
  rooms,
  sockets,
  users,
  userOnline,
  activeTransfers,
  roomCleanupTimers,
} from "./configs/config";
import type { FileTransferMeta, TransferSession } from "./configs/config";
import { customAlphabet } from "nanoid";
import cors from "cors";
import cookieParser from "cookie-parser";
import * as cookie from "cookie";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const nanoId = customAlphabet(SYMBOLS, ROOM_ID_LEN);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ─────────────────────────────────────────────────────────────────────
// Helper Utilities
// ─────────────────────────────────────────────────────────────────────

/** Get the *other* userId in a room (for 1-to-1 rooms). */
function getPeerId(roomId: string, selfId: string): string | null {
  const members = rooms[roomId];
  if (!members) return null;
  return members.find((id) => id !== selfId) ?? null;
}

/** Check if a user is currently connected via socket. */
function isUserOnline(userId: string): boolean {
  return !!userOnline[userId];
}

/** Clean up a room and all associated state. */
function destroyRoom(roomId: string) {
  const members = rooms[roomId] ?? [];
  for (const uid of members) {
    delete users[uid];
    delete sockets[uid];
    delete userOnline[uid];
  }
  delete rooms[roomId];

  // Clean up any transfers associated with this room
  for (const [tid, session] of Object.entries(activeTransfers)) {
    if (session.roomId === roomId) {
      delete activeTransfers[tid];
    }
  }

  if (roomCleanupTimers[roomId]) {
    clearTimeout(roomCleanupTimers[roomId]);
    delete roomCleanupTimers[roomId];
  }

  console.log(`[room] Destroyed room ${roomId}`);
}

/** Schedule room destruction if both users are offline. */
function scheduleRoomCleanup(roomId: string) {
  // Cancel any existing timer
  if (roomCleanupTimers[roomId]) {
    clearTimeout(roomCleanupTimers[roomId]);
  }

  const members = rooms[roomId] ?? [];
  const anyOnline = members.some((uid) => isUserOnline(uid));
  if (anyOnline) return; // someone is still connected

  console.log(
    `[room] Both users offline in ${roomId}, scheduling cleanup in ${ROOM_STALE_TIMEOUT_MS / 1000}s`
  );

  roomCleanupTimers[roomId] = setTimeout(() => {
    // Re-check before destroying
    const stillAnyOnline = (rooms[roomId] ?? []).some((uid) => isUserOnline(uid));
    if (!stillAnyOnline) {
      destroyRoom(roomId);
    }
  }, ROOM_STALE_TIMEOUT_MS);
}

/** Cancel a pending room cleanup (e.g. when a user reconnects). */
function cancelRoomCleanup(roomId: string) {
  if (roomCleanupTimers[roomId]) {
    clearTimeout(roomCleanupTimers[roomId]);
    delete roomCleanupTimers[roomId];
    console.log(`[room] Cancelled cleanup for ${roomId} (user reconnected)`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Socket.IO — Connection & Signaling
// ─────────────────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  const cookies = cookie.parse(socket.handshake.headers.cookie || "");
  const userId = cookies["userId"];

  if (!userId || !users[userId]) {
    console.log(`[ws] Rejected connection — no valid userId cookie`);
    socket.disconnect(true);
    return;
  }

  const userRoom = users[userId];
  console.log(`[ws] User connected: ${userId} → room ${userRoom}`);

  // Update socket mapping & online status
  sockets[userId] = socket.id;
  userOnline[userId] = true;
  socket.join(userRoom);

  // Cancel any pending room cleanup
  cancelRoomCleanup(userRoom);

  // Tell the connecting user who else is in the room already
  const members = rooms[userRoom] ?? [];
  const peerInRoom = members.find((id) => id !== userId && isUserOnline(id));
  socket.emit("room-state", {
    peerOnline: !!peerInRoom,
    memberCount: members.length,
  });

  // Notify the existing peer that this user joined / reconnected
  socket.to(userRoom).emit("user-joined", { userId });

  // The joiner emits "ready" once their event listeners are set up,
  // so the initiator can begin negotiation without a race condition.
  socket.on("ready", () => {
    console.log(`[ws] User ${userId} is ready for signaling`);
    socket.to(userRoom).emit("peer-ready", { userId });
  });

  // ── WebRTC Signaling ──────────────────────────────────────────────

  socket.on("offer", (data) => {
    socket.to(userRoom).emit("offer", data);
  });

  socket.on("answer", (data) => {
    socket.to(userRoom).emit("answer", data);
  });

  socket.on("ice-candidate", (data) => {
    socket.to(userRoom).emit("ice-candidate", data);
  });

  // ── Transfer Lifecycle ────────────────────────────────────────────

  /**
   * Sender announces a new file transfer.
   * Payload: { meta: FileTransferMeta }
   * Server creates a TransferSession and relays to the receiver.
   */
  socket.on(
    "transfer:start",
    (
      data: { meta: FileTransferMeta },
      ack: (response: { transferId: string }) => void
    ) => {
      const peerId = getPeerId(userRoom, userId);
      if (!peerId) {
        console.warn(`[transfer] No peer in room ${userRoom}`);
        return;
      }

      const transferId = nanoId();
      const session: TransferSession = {
        transferId,
        roomId: userRoom,
        senderId: userId,
        receiverId: peerId,
        meta: data.meta,
        receivedChunks: new Set(),
        createdAt: Date.now(),
        completedAt: null,
      };

      activeTransfers[transferId] = session;

      console.log(
        `[transfer] Started: ${transferId} | ${data.meta.name} | ${data.meta.totalChunks} chunks`
      );

      // Tell the sender the transferId
      if (typeof ack === "function") {
        ack({ transferId });
      }

      // Notify the receiver about the incoming transfer
      socket.to(userRoom).emit("transfer:start", {
        transferId,
        meta: data.meta,
        senderId: userId,
      });
    }
  );

  /**
   * Receiver acknowledges a chunk was received successfully.
   * Payload: { transferId, chunkIndex }
   */
  socket.on(
    "transfer:chunk-ack",
    (data: { transferId: string; chunkIndex: number }) => {
      const session = activeTransfers[data.transferId];
      if (!session) return;

      session.receivedChunks.add(data.chunkIndex);

      // Optionally log progress every 10%
      const pct = Math.round(
        (session.receivedChunks.size / session.meta.totalChunks) * 100
      );
      if (pct % 10 === 0 && session.receivedChunks.size > 0) {
        const prevPct = Math.round(
          ((session.receivedChunks.size - 1) / session.meta.totalChunks) * 100
        );
        if (Math.floor(prevPct / 10) !== Math.floor(pct / 10)) {
          console.log(
            `[transfer] ${data.transferId} progress: ${pct}% (${session.receivedChunks.size}/${session.meta.totalChunks})`
          );
        }
      }
    }
  );

  /**
   * Either side requests the current state of a transfer for resumption.
   * Payload: { transferId }
   * Response (via ack): { receivedChunks: number[], meta, totalChunks }
   */
  socket.on(
    "transfer:resume",
    (
      data: { transferId: string },
      ack: (response: {
        receivedChunks: number[];
        meta: FileTransferMeta;
        totalChunks: number;
      } | { error: string }) => void
    ) => {
      const session = activeTransfers[data.transferId];
      if (!session) {
        if (typeof ack === "function") {
          ack({ error: "Transfer not found" });
        }
        return;
      }

      console.log(
        `[transfer] Resume requested for ${data.transferId} — ${session.receivedChunks.size}/${session.meta.totalChunks} chunks already acked`
      );

      if (typeof ack === "function") {
        ack({
          receivedChunks: Array.from(session.receivedChunks),
          meta: session.meta,
          totalChunks: session.meta.totalChunks,
        });
      }

      // Also notify the peer that resume is happening
      socket.to(userRoom).emit("transfer:resume", {
        transferId: data.transferId,
        receivedChunks: Array.from(session.receivedChunks),
      });
    }
  );

  /**
   * Receiver confirms all chunks received — transfer complete.
   * Payload: { transferId }
   */
  socket.on("transfer:complete", (data: { transferId: string }) => {
    const session = activeTransfers[data.transferId];
    if (!session) return;

    session.completedAt = Date.now();
    console.log(
      `[transfer] Complete: ${data.transferId} | ${session.meta.name}`
    );

    // Notify the sender
    socket.to(userRoom).emit("transfer:complete", {
      transferId: data.transferId,
    });

    // Clean up after a delay (in case either side needs to query it)
    setTimeout(() => {
      delete activeTransfers[data.transferId];
    }, TRANSFER_CLEANUP_DELAY_MS);
  });

  /**
   * Either side cancels a transfer.
   * Payload: { transferId }
   */
  socket.on("transfer:cancel", (data: { transferId: string }) => {
    const session = activeTransfers[data.transferId];
    if (!session) return;

    console.log(
      `[transfer] Cancelled: ${data.transferId} | ${session.meta.name}`
    );

    // Notify the peer
    socket.to(userRoom).emit("transfer:cancel", {
      transferId: data.transferId,
    });

    delete activeTransfers[data.transferId];
  });

  /**
   * Query all active (incomplete) transfers for this room.
   * Useful on reconnect to discover what was in-flight.
   */
  socket.on(
    "transfer:list",
    (
      ack: (
        response: Array<{
          transferId: string;
          meta: FileTransferMeta;
          receivedChunks: number[];
          senderId: string;
          receiverId: string;
        }>
      ) => void
    ) => {
      const roomTransfers = Object.values(activeTransfers).filter(
        (s) => s.roomId === userRoom && !s.completedAt
      );

      if (typeof ack === "function") {
        ack(
          roomTransfers.map((s) => ({
            transferId: s.transferId,
            meta: s.meta,
            receivedChunks: Array.from(s.receivedChunks),
            senderId: s.senderId,
            receiverId: s.receiverId,
          }))
        );
      }
    }
  );

  // ── Disconnect Handling ───────────────────────────────────────────

  socket.on("disconnect", () => {
    console.log(`[ws] User disconnected: ${userId}`);

    // Mark as offline but do NOT remove from the room
    userOnline[userId] = false;
    delete sockets[userId];

    // Notify peer
    socket.to(userRoom).emit("user-disconnected", { userId });

    // Schedule room cleanup if both users are now offline
    scheduleRoomCleanup(userRoom);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Express Routes
// ─────────────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.send("Server working properly");
});

/** Create a new room. Returns roomId and sets userId cookie. */
app.get("/create", (_req, res) => {
  const roomId = nanoId();
  const userId = nanoId();

  rooms[roomId] = [userId];
  users[userId] = roomId;

  res.cookie("userId", userId, { httpOnly: true, sameSite: "lax" });
  res.json({ roomId });
});

/** Join an existing room. Sets userId cookie. */
app.get("/join/:roomId", (req, res) => {
  const { roomId } = req.params;

  if (!rooms[roomId]) {
    return res.status(404).json({ error: "Room does not exist" });
  }
  if (rooms[roomId].length >= 2) {
    return res.status(403).json({ error: "Room already full" });
  }

  const userId = nanoId();
  rooms[roomId].push(userId);
  users[userId] = roomId;

  res.cookie("userId", userId, { httpOnly: true, sameSite: "lax" });
  res.json({ success: true });
});

/** Verify that a user belongs to a room. */
app.get("/verify/:roomId", (req, res) => {
  const { roomId } = req.params;
  const { userId } = req.cookies;

  if (!userId || !rooms[roomId] || !rooms[roomId].includes(userId)) {
    return res.status(403).json({ error: "Access Denied" });
  }

  res.json({ success: true });
});

/** Get the status of active transfers in a room (for debugging / UI). */
app.get("/transfers/:roomId", (req, res) => {
  const { roomId } = req.params;
  const { userId } = req.cookies;

  if (!userId || !rooms[roomId] || !rooms[roomId].includes(userId)) {
    return res.status(403).json({ error: "Access Denied" });
  }

  const roomTransfers = Object.values(activeTransfers).filter(
    (s) => s.roomId === roomId
  );

  res.json(
    roomTransfers.map((s) => ({
      transferId: s.transferId,
      meta: s.meta,
      receivedChunks: s.receivedChunks.size,
      totalChunks: s.meta.totalChunks,
      complete: s.completedAt !== null,
      senderId: s.senderId,
      receiverId: s.receiverId,
    }))
  );
});

// ─────────────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
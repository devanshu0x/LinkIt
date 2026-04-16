import { useEffect, useRef, useState, useCallback } from "react";
import { Link2, CheckCircle2, XCircle, Loader2, Copy, Check } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { io, Socket } from "socket.io-client";
import { ReceivedFiles } from "../components/ReceivedFiles";
import { UploadFiles } from "../components/UploadFiles";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  totalChunks: number;
  chunkSize: number;
}

export interface ReceivedFile extends File {
  receivedAt?: Date;
}

/** Chunk protocol message types sent over the DataChannel */
export type DCMessage =
  | { type: "file-meta"; transferId: string; name: string; size: number; mimeType: string; totalChunks: number; chunkSize: number }
  | { type: "chunk"; transferId: string; chunkIndex: number }
  | { type: "eof"; transferId: string }
  | { type: "resume-request"; transferId: string }
  | { type: "resume-skip"; transferId: string; receivedChunks: number[] };

/** Tracks an incoming file transfer on the receiver side */
interface IncomingTransfer {
  transferId: string;
  meta: FileMetadata;
  chunks: Map<number, ArrayBuffer>;
  nextExpectedMessage: "header" | "binary";
  pendingChunkIndex: number;
}

function Room() {
  const navigate = useNavigate();
  const { roomId } = useParams();

  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const isPoliteRef = useRef<boolean>(true);
  const makingOfferRef = useRef<boolean>(false);
  const ignoreOfferRef = useRef<boolean>(false);
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([]);

  // Incoming transfers keyed by transferId
  const incomingTransfersRef = useRef<Map<string, IncomingTransfer>>(new Map());

  const [isConnected, setIsConnected] = useState(false);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [copied, setCopied] = useState(false);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "failed">("connecting");

  // ── DataChannel message handler (shared by both local and remote DC) ──

  const handleDCMessage = useCallback(
    (e: MessageEvent) => {
      const transfers = incomingTransfersRef.current;
      const socket = socketRef.current;

      // ── String messages: JSON headers, EOF, resume messages ──
      if (typeof e.data === "string") {
        let msg: DCMessage;
        try {
          msg = JSON.parse(e.data);
        } catch {
          console.error("Failed to parse DC message:", e.data);
          return;
        }

        if (msg.type === "file-meta") {
          // A new file transfer is starting
          const transfer: IncomingTransfer = {
            transferId: msg.transferId,
            meta: {
              name: msg.name,
              size: msg.size,
              type: msg.mimeType,
              totalChunks: msg.totalChunks,
              chunkSize: msg.chunkSize,
            },
            chunks: new Map(),
            nextExpectedMessage: "header",
            pendingChunkIndex: -1,
          };
          transfers.set(msg.transferId, transfer);
          return;
        }

        if (msg.type === "chunk") {
          // Next binary message is the data for this chunk
          const transfer = transfers.get(msg.transferId);
          if (transfer) {
            transfer.nextExpectedMessage = "binary";
            transfer.pendingChunkIndex = msg.chunkIndex;
          }
          return;
        }

        if (msg.type === "eof") {
          const transfer = transfers.get(msg.transferId);
          if (!transfer) return;

          // Assemble the file from chunks in order
          const orderedChunks: ArrayBuffer[] = [];
          for (let i = 0; i < transfer.meta.totalChunks; i++) {
            const chunk = transfer.chunks.get(i);
            if (chunk) orderedChunks.push(chunk);
          }

          const blob = new Blob(orderedChunks, { type: transfer.meta.type });
          const file = new File([blob], transfer.meta.name, {
            type: transfer.meta.type,
          }) as ReceivedFile;
          file.receivedAt = new Date();

          setReceivedFiles((prev) => [...prev, file]);
          toast.success(`Received: ${file.name}`);

          // Tell the server the transfer is complete
          socket?.emit("transfer:complete", { transferId: msg.transferId });

          // Clean up
          transfers.delete(msg.transferId);
          return;
        }

        if (msg.type === "resume-request") {
          // The sender is asking which chunks we already have
          const transfer = transfers.get(msg.transferId);
          const dc = dataChannelRef.current;
          if (transfer && dc && dc.readyState === "open") {
            const acked = Array.from(transfer.chunks.keys());
            const resumeMsg: DCMessage = {
              type: "resume-skip",
              transferId: msg.transferId,
              receivedChunks: acked,
            };
            dc.send(JSON.stringify(resumeMsg));
          }
          return;
        }

        // resume-skip is handled by UploadFiles (sender side)
        return;
      }

      // ── Binary messages: chunk data ──
      if (e.data instanceof ArrayBuffer) {
        // Find the transfer that's expecting a binary chunk
        for (const transfer of transfers.values()) {
          if (
            transfer.nextExpectedMessage === "binary" &&
            transfer.pendingChunkIndex >= 0
          ) {
            const chunkIndex = transfer.pendingChunkIndex;
            transfer.chunks.set(chunkIndex, e.data);
            transfer.nextExpectedMessage = "header";
            transfer.pendingChunkIndex = -1;

            // Ack to the server
            socketRef.current?.emit("transfer:chunk-ack", {
              transferId: transfer.transferId,
              chunkIndex,
            });
            break;
          }
        }
      }
    },
    []
  );

  // ── Setup local data channel (created by us) ──
  const setupLocalDataChannel = useCallback(
    (dc: RTCDataChannel) => {
      dc.binaryType = "arraybuffer";
      dc.onopen = () => {
        setIsConnected(true);
        setConnectionState("connected");
        toast.success("Connected to peer!");
      };
      dc.onclose = () => {
        setIsConnected(false);
        setConnectionState("failed");
      };
      dc.onerror = (err) => {
        console.error("DataChannel error:", err);
      };
      dc.onmessage = handleDCMessage;
    },
    [handleDCMessage]
  );

  useEffect(() => {
    async function checkValidRoom() {
      try {
        await axios.get(`${BACKEND_URL}/verify/${roomId}`, { withCredentials: true });
      } catch {
        toast.error("Invalid room");
        navigate("/dashboard");
      }
    }
    checkValidRoom();

    const socket = io(BACKEND_URL, { withCredentials: true });
    socketRef.current = socket;

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerRef.current = peer;

    // ── Connection state ──
    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      if (state === "connected") {
        setConnectionState("connected");
        setIsConnected(true);
      } else if (state === "failed" || state === "disconnected") {
        setConnectionState("failed");
        setIsConnected(false);
      }
    };

    // ── ICE candidates ──
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", event.candidate);
      }
    };

    // ── Remote data channel (created by peer) ──
    peer.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      receiveChannel.binaryType = "arraybuffer";
      dataChannelRef.current = receiveChannel;

      receiveChannel.onopen = () => {
        setIsConnected(true);
        setConnectionState("connected");
        toast.success("Data channel opened by remote!");
      };
      receiveChannel.onclose = () => {
        setIsConnected(false);
        setConnectionState("failed");
      };
      receiveChannel.onerror = (err) => {
        console.error("Receive channel error:", err);
      };
      receiveChannel.onmessage = handleDCMessage;
    };

    // ── Negotiation ──
    peer.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current = true;
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit("offer", peer.localDescription);
      } catch (err) {
        console.error("Error during negotiationneeded:", err);
      } finally {
        makingOfferRef.current = false;
      }
    };

    // ── Helper: create DataChannel and begin negotiation ──

    function initiateConnection() {
      const p = peerRef.current;
      if (!p || dataChannelRef.current) return;

      console.log("[webrtc] Initiating connection — creating DataChannel");
      isPoliteRef.current = false; // We are the initiator (impolite)

      try {
        const dc = p.createDataChannel("fileTransfer");
        setupLocalDataChannel(dc);
        dataChannelRef.current = dc;
      } catch (err) {
        console.error("Failed to create data channel:", err);
      }
    }

    // ── Socket events ──

    // When the server tells us who's already in the room
    socket.on("room-state", (data: { peerOnline: boolean; memberCount: number }) => {
      console.log("[room-state]", data);
      // Tell the server we're ready to receive signaling
      socket.emit("ready");
    });

    // When the OTHER peer signals they are ready (their listeners are set up).
    // If we were already in the room (we are the "initiator"), start the handshake now.
    socket.on("peer-ready", () => {
      console.log("[peer-ready] Peer is ready — initiating connection");
      // Reset any stale DataChannel from a previous peer session
      if (dataChannelRef.current) {
        try { dataChannelRef.current.close(); } catch {}
        dataChannelRef.current = null;
      }
      initiateConnection();
    });

    // Kept for backward-compat / reconnect scenarios:
    // If a user joins while we're already here, we'll wait for their "peer-ready".
    socket.on("user-joined", () => {
      console.log("[user-joined] Peer joined the room, waiting for their ready signal");
    });

    socket.on("user-disconnected", ({ userId: disconnectedId }: { userId: string }) => {
      console.log("Peer disconnected:", disconnectedId);
      toast.error("Peer disconnected. Waiting for reconnection...");
      setConnectionState("failed");
      setIsConnected(false);
      // Clean up stale DataChannel so we can re-initiate when peer reconnects
      if (dataChannelRef.current) {
        try { dataChannelRef.current.close(); } catch {}
        dataChannelRef.current = null;
      }
    });

    socket.on("offer", async (offer: RTCSessionDescriptionInit) => {
      const polite = isPoliteRef.current;
      const p = peerRef.current;
      if (!p) return;

      console.log("[signaling] Received offer, polite:", polite, "signalingState:", p.signalingState);

      const offerCollision =
        offer.type === "offer" &&
        (makingOfferRef.current || p.signalingState !== "stable");

      ignoreOfferRef.current = !polite && offerCollision;
      if (ignoreOfferRef.current) {
        console.warn("Offer collision detected and ignored (impolite)");
        return;
      }

      try {
        await p.setRemoteDescription(new RTCSessionDescription(offer));
        flushIceQueueIfAny();

        if (offer.type === "offer") {
          const answer = await p.createAnswer();
          await p.setLocalDescription(answer);
          console.log("[signaling] Sending answer");
          socket.emit("answer", p.localDescription);
        }
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    });

    socket.on("answer", async (answer: RTCSessionDescriptionInit) => {
      const p = peerRef.current;
      if (!p) return;
      if (ignoreOfferRef.current) return;

      console.log("[signaling] Received answer");

      try {
        await p.setRemoteDescription(new RTCSessionDescription(answer));
        flushIceQueueIfAny();
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    });

    socket.on("ice-candidate", async (candidate: RTCIceCandidateInit) => {
      const p = peerRef.current;
      if (!p) return;
      if (!p.remoteDescription || p.remoteDescription.type === null) {
        iceQueueRef.current.push(candidate);
      } else {
        try {
          await p.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("addIceCandidate error:", err);
        }
      }
    });

    function flushIceQueueIfAny() {
      const p = peerRef.current;
      if (!p) return;
      const queue = iceQueueRef.current.splice(0, iceQueueRef.current.length);
      queue.forEach(async (c) => {
        try {
          await p.addIceCandidate(new RTCIceCandidate(c));
        } catch (err) {
          console.error("Error applying queued ICE candidate:", err);
        }
      });
    }

    return () => {
      socket.disconnect();
      peer.close();
    };
  }, [roomId, navigate, handleDCMessage, setupLocalDataChannel]);

  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Room ID copied!");
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-text mb-2">File Transfer Room</h1>
              <p className="text-text-muted opacity-70">Share files securely with peer-to-peer connection</p>
            </div>

            {/* Connection Status */}
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                connectionState === "connected"
                  ? "bg-green-500/10 border border-green-500/30"
                  : connectionState === "connecting"
                  ? "bg-yellow-500/10 border border-yellow-500/30"
                  : "bg-red-500/10 border border-red-500/30"
              }`}
            >
              {connectionState === "connected" ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-green-500 font-medium">Connected</span>
                </>
              ) : connectionState === "connecting" ? (
                <>
                  <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
                  <span className="text-yellow-500 font-medium">Waiting for peer...</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-500" />
                  <span className="text-red-500 font-medium">Disconnected</span>
                </>
              )}
            </div>
          </div>

          {/* Room ID Card */}
          <div className="mt-6 bg-background-accent rounded-lg p-4 border border-text/20">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-highlight-accent p-2 rounded-lg">
                  <Link2 className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-text-muted opacity-70 mb-1">Room ID</p>
                  <p className="text-lg font-mono font-semibold text-text">{roomId}</p>
                </div>
              </div>
              <button
                onClick={copyRoomId}
                className="flex items-center gap-2 px-4 py-2 bg-background hover:bg-highlight-secondary rounded-lg transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-green-500">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upload Section */}
          <UploadFiles
            isConnected={isConnected}
            dataChannelRef={dataChannelRef}
            socketRef={socketRef}
          />

          {/* Received Files Section */}
          <ReceivedFiles receivedFiles={receivedFiles} />
        </div>
      </div>
    </div>
  );
}

export default Room;
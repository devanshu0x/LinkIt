// ─── Type Definitions ───────────────────────────────────────────────

/** roomId → list of userIds in that room */
export type Rooms = Record<string, string[]>;

/** userId → socket.io socket id (current connection) */
export type Sockets = Record<string, string>;

/** userId → roomId the user belongs to */
export type Users = Record<string, string>;

/** Track whether a user is currently connected */
export type UserOnlineStatus = Record<string, boolean>;

/** Metadata about a file being transferred */
export interface FileTransferMeta {
  name: string;
  size: number;
  type: string;
  totalChunks: number;
  chunkSize: number;
}

/** A single active transfer session tracked by the server */
export interface TransferSession {
  transferId: string;
  roomId: string;
  senderId: string;
  receiverId: string;
  meta: FileTransferMeta;
  /** Set of chunk indices that the receiver has acknowledged */
  receivedChunks: Set<number>;
  createdAt: number;
  completedAt: number | null;
}

/** transferId → TransferSession */
export type ActiveTransfers = Record<string, TransferSession>;

// ─── Constants ──────────────────────────────────────────────────────

export const PORT = 8080;
export const SYMBOLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const ROOM_ID_LEN = 8;

/** How long (ms) to keep a room alive after both users go offline */
export const ROOM_STALE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/** How long (ms) to keep a completed/cancelled transfer before cleanup */
export const TRANSFER_CLEANUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes

// ─── In-Memory Stores ───────────────────────────────────────────────

export const rooms: Rooms = {};
export const sockets: Sockets = {};
export const users: Users = {};
export const userOnline: UserOnlineStatus = {};
export const activeTransfers: ActiveTransfers = {};

/**
 * roomId → NodeJS.Timeout
 * Tracks the stale-room cleanup timer so we can cancel it if a user rejoins.
 */
export const roomCleanupTimers: Record<string, ReturnType<typeof setTimeout>> = {};
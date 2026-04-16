import { Upload, XCircle, RotateCcw } from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import type { DCMessage } from "../pages/Room";
import type { Socket } from "socket.io-client";

interface UploadFilesProps {
  isConnected: boolean;
  dataChannelRef: React.RefObject<RTCDataChannel | null>;
  socketRef: React.RefObject<Socket | null>;
}

const CHUNK_SIZE = 16 * 1024; // 16KB per chunk
const BUFFERED_HIGH = 4 * 1024 * 1024; // 4MB high-water mark

/** Given a file, compute the total number of chunks. */
function totalChunks(fileSize: number): number {
  return Math.ceil(fileSize / CHUNK_SIZE);
}

export const UploadFiles = ({ isConnected, dataChannelRef, socketRef }: UploadFilesProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [currentFileName, setCurrentFileName] = useState("");

  // Track current transfer for resume capability
  const currentTransferIdRef = useRef<string | null>(null);
  const currentFileRef = useRef<File | null>(null);
  const skipChunksRef = useRef<Set<number>>(new Set());

  // ── Listen for resume-skip messages on the data channel ──
  // (The data channel onmessage is set up in Room.tsx, but for resume-skip
  //  we need to handle it here on the sender side. We'll use a message listener
  //  on the socket instead since the receiver also notifies via the server.)

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleResume = (data: { transferId: string; receivedChunks: number[] }) => {
      if (data.transferId === currentTransferIdRef.current && currentFileRef.current) {
        console.log(
          `[upload] Resume: skipping ${data.receivedChunks.length} already-received chunks`
        );
        skipChunksRef.current = new Set(data.receivedChunks);
        toast.success(`Resuming transfer — skipping ${data.receivedChunks.length} chunks`);

        // Re-send the file, skipping acknowledged chunks
        sendFileChunks(
          currentFileRef.current,
          data.transferId,
          new Set(data.receivedChunks)
        );
      }
    };

    socket.on("transfer:resume", handleResume);
    return () => {
      socket.off("transfer:resume", handleResume);
    };
  }, [socketRef]);

  // ── Send chunks (core logic, supports skipping already-acked chunks) ──

  const sendFileChunks = useCallback(
    (file: File, transferId: string, skipSet: Set<number>) => {
      const channel = dataChannelRef.current;
      if (!channel || channel.readyState !== "open") {
        toast.error("Connection not ready");
        return;
      }

      const total = totalChunks(file.size);
      const chunksToSend: number[] = [];

      for (let i = 0; i < total; i++) {
        if (!skipSet.has(i)) {
          chunksToSend.push(i);
        }
      }

      if (chunksToSend.length === 0) {
        // All chunks already received
        const eofMsg: DCMessage = { type: "eof", transferId };
        channel.send(JSON.stringify(eofMsg));
        setIsUploading(false);
        setUploadProgress(100);
        setCurrentFileName("");
        toast.success(`Sent: ${file.name}`);
        currentTransferIdRef.current = null;
        currentFileRef.current = null;
        return;
      }

      setIsUploading(true);
      setCurrentFileName(file.name);

      let sendIndex = 0; // index into chunksToSend array
      const totalToSend = chunksToSend.length;

      const sendNextChunk = () => {
        if (sendIndex >= totalToSend) {
          // All chunks sent — send EOF
          try {
            const eofMsg: DCMessage = { type: "eof", transferId };
            channel.send(JSON.stringify(eofMsg));
          } catch (err) {
            console.error("Failed to send EOF:", err);
          }
          setIsUploading(false);
          setUploadProgress(100);
          setCurrentFileName("");
          toast.success(`Sent: ${file.name}`);
          currentTransferIdRef.current = null;
          currentFileRef.current = null;
          return;
        }

        const chunkIndex = chunksToSend[sendIndex];
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const slice = file.slice(start, end);

        const reader = new FileReader();
        reader.onload = (event) => {
          const buffer = event.target?.result as ArrayBuffer;

          const doSend = () => {
            try {
              // Send the JSON header
              const headerMsg: DCMessage = {
                type: "chunk",
                transferId,
                chunkIndex,
              };
              channel.send(JSON.stringify(headerMsg));

              // Send the binary data
              channel.send(buffer);
            } catch (err) {
              console.error(`Failed to send chunk ${chunkIndex}:`, err);
              toast.error("Failed to send chunk");
              return;
            }

            sendIndex++;
            const progress = Math.round((sendIndex / totalToSend) * 100);
            setUploadProgress(progress);

            // Continue sending
            sendNextChunk();
          };

          // Backpressure: wait if buffer is full
          if (channel.bufferedAmount > BUFFERED_HIGH) {
            const onBufferedLow = () => {
              channel.removeEventListener("bufferedamountlow", onBufferedLow);
              doSend();
            };
            channel.bufferedAmountLowThreshold = 64 * 1024;
            channel.addEventListener("bufferedamountlow", onBufferedLow);
          } else {
            doSend();
          }
        };

        reader.onerror = () => {
          setIsUploading(false);
          toast.error("Failed to read file");
        };

        reader.readAsArrayBuffer(slice);
      };

      sendNextChunk();
    },
    [dataChannelRef]
  );

  // ── Main send file function ──

  const sendFile = useCallback(
    (file: File) => {
      const channel = dataChannelRef.current;
      const socket = socketRef.current;

      if (!channel || channel.readyState !== "open") {
        toast.error("Connection not ready");
        return;
      }
      if (!socket) {
        toast.error("Server connection lost");
        return;
      }

      const total = totalChunks(file.size);

      // Store the file for potential resume
      currentFileRef.current = file;

      setIsUploading(true);
      setUploadProgress(0);
      setCurrentFileName(file.name);

      // 1. Register the transfer with the server
      socket.emit(
        "transfer:start",
        {
          meta: {
            name: file.name,
            size: file.size,
            type: file.type,
            totalChunks: total,
            chunkSize: CHUNK_SIZE,
          },
        },
        (response: { transferId: string }) => {
          const { transferId } = response;
          currentTransferIdRef.current = transferId;

          console.log(`[upload] Transfer started: ${transferId} | ${total} chunks`);

          // 2. Send the file-meta message over the data channel
          const metaMsg: DCMessage = {
            type: "file-meta",
            transferId,
            name: file.name,
            size: file.size,
            mimeType: file.type,
            totalChunks: total,
            chunkSize: CHUNK_SIZE,
          };

          try {
            channel.send(JSON.stringify(metaMsg));
          } catch (err) {
            console.error("Failed to send file-meta:", err);
            toast.error("Failed to start transfer");
            setIsUploading(false);
            return;
          }

          // 3. Send chunks (no skip set for fresh transfer)
          sendFileChunks(file, transferId, new Set());
        }
      );
    },
    [dataChannelRef, socketRef, sendFileChunks]
  );

  // ── Drag & drop handlers ──

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && isConnected) {
      sendFile(file);
    } else if (!isConnected) {
      toast.error("Wait for peer connection");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isConnected) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    sendFile(file);
  };

  return (
    <div className="bg-background-accent rounded-xl p-6 border border-text/30">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-highlight-accent p-2 rounded-lg">
          <Upload className="w-6 h-6 text-accent" />
        </div>
        <h2 className="text-xl font-semibold">Send Files</h2>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${
          isDragging
            ? "border-accent bg-highlight-accent"
            : isConnected
            ? "border-highlight-accent hover:border-accent-secondary hover:bg-highlight-soft"
            : "border-highlight-accent opacity-50 cursor-not-allowed"
        }`}
      >
        <input
          type="file"
          onChange={handleFileChange}
          disabled={!isConnected || isUploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          id="file-upload"
        />

        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="bg-highlight-accent p-4 rounded-full">
              <Upload className="w-8 h-8 text-accent" />
            </div>
          </div>
          <p className="text-lg font-medium mb-2">
            {isDragging ? "Drop your file here" : "Drag & drop your file here"}
          </p>
          <p className="text-sm text-text opacity-70 mb-4">or</p>
          <label
            htmlFor="file-upload"
            className={`inline-block px-6 py-3 rounded-lg font-medium transition-all ${
              isConnected && !isUploading
                ? "bg-gradient-to-r from-accent to-accent-secondary hover:opacity-90 cursor-pointer"
                : "bg-[#1d1c1e] text-text opacity-50 cursor-not-allowed"
            }`}
          >
            Browse Files
          </label>
        </div>
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <div className="mt-4 bg-highlight-secondary rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium truncate flex-1 mr-4">{currentFileName}</span>
            <span className="text-sm text-text-muted opacity-70">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-highlight-soft rounded-full h-2">
            <div
              className="bg-gradient-to-r from-accent to-accent-secondary h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          {skipChunksRef.current.size > 0 && (
            <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
              <RotateCcw className="w-3 h-3" />
              <span>Resumed — skipped {skipChunksRef.current.size} previously received chunks</span>
            </div>
          )}
        </div>
      )}

      {!isConnected && (
        <div className="mt-4 flex items-start gap-2 text-sm text-yellow-500 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
          <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>Waiting for another peer to connect before you can send files</p>
        </div>
      )}
    </div>
  );
};
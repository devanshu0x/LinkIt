import { useEffect, useRef, useState } from "react";
import { Upload, Download, Link2, CheckCircle2, XCircle, Loader2, Copy, Check, FileText } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

interface FileMetadata {
  name: string;
  size: number;
  type: string;
}

interface ReceivedFile extends File {
  receivedAt?: Date;
}

function Room() {
  const navigate = useNavigate();
  const { roomId } = useParams();

  const socketRef = useRef<any>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const isPoliteRef = useRef<boolean>(true);
  const makingOfferRef = useRef<boolean>(false);
  const ignoreOfferRef = useRef<boolean>(false);
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([]);

  const [isConnected, setIsConnected] = useState(false);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [currentFileName, setCurrentFileName] = useState("");
  const [copied, setCopied] = useState(false);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "failed">("connecting");

  useEffect(() => {
    async function checkValidRoom() {
      try {
        await axios.get(`${BACKEND_URL}/verify/${roomId}`, { withCredentials: true });
      } catch (e) {
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

    // connection state
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

    // sharing ice candidates
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", event.candidate);
      }
    };

    // capture data channel
    peer.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      receiveChannel.binaryType= "arraybuffer";
      dataChannelRef.current=receiveChannel;

      const receivedChunks: BlobPart[] = [];
      let fileMetadata: FileMetadata | null = null;

      receiveChannel.onmessage = (e) => {
        // First message is metadata
        if (!fileMetadata && typeof e.data === "string") {
          try {
            fileMetadata = JSON.parse(e.data);
          } catch (err) {
            console.error("Failed to parse metadata:", err);
          }
          return;
        }

        if (e.data === "EOF") {
          const blob = new Blob(receivedChunks, { type: fileMetadata?.type || "" });
          const file = new File([blob], fileMetadata?.name || "received_file", {
            type: fileMetadata?.type || "",
          }) as ReceivedFile;
          file.receivedAt = new Date();
          
          setReceivedFiles((prev) => [...prev, file]);
          toast.success(`Received: ${file.name}`);
          
          // Reset for next file
          receivedChunks.length = 0;
          fileMetadata = null;
        } else {
          receivedChunks.push(e.data);
        }
      };

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
  
    };

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

    
    socket.on("user-joined", (payload) => {
      isPoliteRef.current=false;
      try {
        if (!dataChannelRef.current && peerRef.current) {
          const dc = peerRef.current.createDataChannel("fileTransfer");
          setupLocalDataChannel(dc);
          dataChannelRef.current = dc;
          // `onnegotiationneeded` will trigger after creating data channel
        }
      } catch (err) {
        console.error("Failed to create data channel on user-joined:", err);
      }
    });

    socket.on("offer", async (offer: RTCSessionDescriptionInit) => {
      const polite = isPoliteRef.current;
      const peer = peerRef.current;
      if (!peer) return;

      const offerCollision =
        offer.type === "offer" &&
        (makingOfferRef.current || peer.signalingState !== "stable");

      ignoreOfferRef.current = !polite && offerCollision;
      if (ignoreOfferRef.current) {
        console.warn("Offer collision detected and ignored (impolite)");
        return;
      }

      try {
        await peer.setRemoteDescription(new RTCSessionDescription(offer));

        // flush any queued ICE candidates we received earlier
        flushIceQueueIfAny();

        if (offer.type === "offer") {
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit("answer", peer.localDescription);
        }
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    });

    socket.on("answer", async (answer: RTCSessionDescriptionInit) => {
      const peer = peerRef.current;
      if (!peer) return;
      if (ignoreOfferRef.current) return;

      try {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
        // remoteDescription set -> flush queued candidates
        flushIceQueueIfAny();
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    });

    socket.on("ice-candidate", async (candidate: RTCIceCandidateInit) => {
      const peer = peerRef.current;
      if (!peer) return;

      // If remoteDescription is not set yet, queue candidate
      if (!peer.remoteDescription || peer.remoteDescription.type === null) {
        iceQueueRef.current.push(candidate);
      } else {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("addIceCandidate error:", err);
        }
      }
    });

    function flushIceQueueIfAny() {
      const peer = peerRef.current;
      if (!peer) return;
      const queue = iceQueueRef.current.splice(0, iceQueueRef.current.length);
      queue.forEach(async (c) => {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(c));
        } catch (err) {
          console.error("Error applying queued ICE candidate:", err);
        }
      });
    }

    function setupLocalDataChannel(dc: RTCDataChannel) {
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

     
      const receivedChunks: BlobPart[] = [];
      let fileMetadata: FileMetadata | null = null;

      dc.onmessage = (e) => {
        if (!fileMetadata && typeof e.data === "string" && e.data.startsWith("{")) {
          try {
            fileMetadata = JSON.parse(e.data);
          } catch (err) {
            console.error("Failed to parse metadata:", err);
          }
          return;
        }

        if (e.data === "EOF") {
          const blob = new Blob(receivedChunks, { type: fileMetadata?.type || "" });
          const file = new File([blob], fileMetadata?.name || "received_file", {
            type: fileMetadata?.type || "",
          }) as ReceivedFile;
          file.receivedAt = new Date();

          setReceivedFiles((prev) => [...prev, file]);
          toast.success(`Received: ${file.name}`);

          // Reset
          receivedChunks.length = 0;
          fileMetadata = null;
        } else {
          receivedChunks.push(e.data);
        }
      };
    }

    return () => {
      socket.disconnect();
      peer.close();
    };
  }, [roomId, navigate]);

  const sendFile = (file: File) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") {
      toast.error("Connection not ready");
      return;
    }

    const chunkSize = 16 * 1024; 
    const reader = new FileReader();
    let offset = 0;

    setIsUploading(true);
    setUploadProgress(0);
    setCurrentFileName(file.name);

    // Send metadata first
    const metadata: FileMetadata = {
      name: file.name,
      size: file.size,
      type: file.type,
    };

    try {
      channel.send(JSON.stringify(metadata));
    } catch (err) {
      console.error("Failed to send metadata:", err);
      toast.error("Failed to send metadata");
      setIsUploading(false);
      return;
    }

    // wait when bufferedAmount is high
    const BUFFERED_HIGH = 4 * 1024 * 1024; // 4MB

    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;

      // wait for bufferedAmount to be low enough before sending
      if (channel.bufferedAmount > BUFFERED_HIGH) {
        // suspend sending until bufferedamountlow fired or polls
        const onBufferedLow = () => {
          channel.removeEventListener("bufferedamountlow", onBufferedLow);
          try {
            channel.send(buffer);
          } catch (e) {
            console.error("Error sending chunk after buffer low:", e);
          }
        };
        // set threshold and attach handler 
        try {
          channel.bufferedAmountLowThreshold = 64 * 1024; // 64KB
          channel.addEventListener("bufferedamountlow", onBufferedLow);
        } catch (e) {
          // polling until bufferedAmount is below threshold
          const interval = setInterval(() => {
            if (channel.bufferedAmount <= BUFFERED_HIGH) {
              clearInterval(interval);
              try {
                channel.send(buffer);
              } catch (err) {
                console.error("Error sending buffer after poll:", err);
              }
            }
          }, 50);
        }
      } else {
        try {
          channel.send(buffer);
        } catch (err) {
          console.error("Failed to send chunk:", err);
          toast.error("Failed to send chunk");
        }
      }

      offset += buffer.byteLength;

      const progress = Math.round((offset / file.size) * 100);
      setUploadProgress(progress);

      if (offset < file.size) {
        readSlice(offset);
      } else {
        try {
          channel.send("EOF");
        } catch (err) {
          console.error("Failed to send EOF:", err);
        }
        setIsUploading(false);
        setUploadProgress(0);
        setCurrentFileName("");
        toast.success(`Sent: ${file.name}`);
      }
    };

    reader.onerror = () => {
      setIsUploading(false);
      toast.error("Failed to read file");
    };

    const readSlice = (o: number) => {
      const slice = file.slice(o, o + chunkSize);
      reader.readAsArrayBuffer(slice);
    };

    readSlice(0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    sendFile(file);
  };

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

  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Room ID copied!");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              connectionState === "connected"
                ? 'bg-green-500/10 border border-green-500/30' 
                : connectionState === "connecting"
                ? 'bg-yellow-500/10 border border-yellow-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            }`}>
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
                  ? 'border-accent bg-highlight-accent'
                  : isConnected
                  ? 'border-highlight-accent hover:border-accent-secondary hover:bg-highlight-soft'
                  : 'border-highlight-accent opacity-50 cursor-not-allowed'
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
                  {isDragging ? 'Drop your file here' : 'Drag & drop your file here'}
                </p>
                <p className="text-sm text-text opacity-70 mb-4">or</p>
                <label
                  htmlFor="file-upload"
                  className={`inline-block px-6 py-3 rounded-lg font-medium transition-all ${
                    isConnected && !isUploading
                      ? 'bg-gradient-to-r from-accent to-accent-secondary hover:opacity-90 cursor-pointer'
                      : 'bg-[#1d1c1e] text-text opacity-50 cursor-not-allowed'
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
              </div>
            )}

            {!isConnected && (
              <div className="mt-4 flex items-start gap-2 text-sm text-yellow-500 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>Waiting for another peer to connect before you can send files</p>
              </div>
            )}
          </div>

          {/* Received Files Section */}
          <div className="bg-highlight-soft rounded-xl p-6 border border-text/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-highlight-secondary p-2 rounded-lg">
                <Download className="w-6 h-6 text-accent-secondary" />
              </div>
              <h2 className="text-xl font-semibold">Received Files</h2>
              {receivedFiles.length > 0 && (
                <span className="ml-auto bg-highlight-accent text-accent px-2 py-1 rounded-full text-sm font-medium">
                  {receivedFiles.length}
                </span>
              )}
            </div>

            <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {receivedFiles.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mb-4 flex justify-center">
                    <div className="bg-highlight-soft p-4 rounded-full">
                      <Download className="w-8 h-8  opacity-30" />
                    </div>
                  </div>
                  <p className="opacity-50">No files received yet</p>
                  <p className="text-sm opacity-30 mt-2">
                    Files will appear here when someone sends them
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {receivedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="bg-highlight-soft rounded-lg p-4 hover:bg-highlight-secondary transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="bg-highlight-secondary p-2 rounded-lg group-hover:bg-highlight-accent transition-colors">
                            <FileText className="w-5 h-5 text-[#A45CFF]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{file.name}</p>
                            <p className="text-sm text-text-muted opacity-50">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <a
                          href={URL.createObjectURL(file)}
                          download={file.name}
                          className="px-4 py-2 bg-gradient-to-r from-accent to-accent-secondary rounded-lg font-medium hover:opacity-90 transition-opacity flex-shrink-0"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Room;
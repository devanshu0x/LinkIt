import { useEffect, useRef, useState } from "react";
import { Link2, CheckCircle2, XCircle, Loader2, Copy, Check} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { ReceivedFiles } from "../components/ReceivedFiles";
import { UploadFiles } from "../components/UploadFiles";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
}

export interface ReceivedFile extends File {
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

    
    socket.on("user-joined", () => {
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
          <UploadFiles isConnected={isConnected} dataChannelRef={dataChannelRef} />

          {/* Received Files Section */}
          <ReceivedFiles receivedFiles={receivedFiles} />
          
        </div>
      </div>
    </div>
  );
}

export default Room;
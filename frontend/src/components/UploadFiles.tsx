import { Upload, XCircle } from "lucide-react"
import { useState } from "react";
import toast from "react-hot-toast";
import type { FileMetadata } from "../pages/Room";

interface UploadFilesProps {
    isConnected: boolean;
    dataChannelRef: React.RefObject<RTCDataChannel | null>;
}


export const UploadFiles = ({isConnected,dataChannelRef}:UploadFilesProps) => {

    const [isDragging, setIsDragging] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [currentFileName, setCurrentFileName] = useState("");

    const sendFile = (file: File) => {
        if(!dataChannelRef || !dataChannelRef.current){
            return ;
        }
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
                className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${isDragging
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
                        className={`inline-block px-6 py-3 rounded-lg font-medium transition-all ${isConnected && !isUploading
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
    )
}
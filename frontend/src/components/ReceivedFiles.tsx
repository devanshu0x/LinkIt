import { Download, FileText } from "lucide-react"
import type { ReceivedFile } from "../pages/Room";

interface ReceivedFilesProps {
    receivedFiles: ReceivedFile[];
}

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

export const ReceivedFiles = ({receivedFiles}:ReceivedFilesProps) => {
    return (
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
    )
}

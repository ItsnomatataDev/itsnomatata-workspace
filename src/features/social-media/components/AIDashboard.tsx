import { useState, useRef } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { Upload, FileText, Image as ImageIcon, Sparkles, Trash2, Download, Eye, AlertCircle } from "lucide-react";
import { analyzeDocument, analyzeImage } from "../../../lib/api/ai";
import type { AssistantAttachmentInput } from "../../../lib/api/n8n";

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  preview?: string;
  summary?: string;
  status: "uploading" | "processing" | "completed" | "error";
}

interface AIDashboardProps {
  organizationId: string;
}

export default function AIDashboard({ organizationId }: AIDashboardProps) {
  const auth = useAuth();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    const newFiles: UploadedFile[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      type: file.type,
      size: file.size,
      status: "uploading" as const,
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);

    for (const file of newFiles) {
      try {
        // Upload file to base64 for AI processing
        const fileData = await files.find((f) => f.name === file.name)?.arrayBuffer();
        if (!fileData) throw new Error("File data not found");

        const base64 = btoa(String.fromCharCode(...new Uint8Array(fileData)));
        const fileUrl = `data:${file.type};base64,${base64}`;

        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, status: "processing" } : f
          )
        );

        // Create attachment for AI
        const attachment: AssistantAttachmentInput = {
          name: file.name,
          url: fileUrl,
          mimeType: file.type,
          size: file.size,
          type: file.type.startsWith("image/") ? "image" : "document",
        };

        // Call AI service
        const context = {
          userId: auth?.user?.id || "",
          organizationId: organizationId,
          role: auth?.profile?.primary_role || "social_media",
          fullName: auth?.profile?.full_name || "",
          currentModule: "social-media",
          currentRoute: "/social-media",
        };

        let aiResponse;
        if (file.type.startsWith("image/")) {
          aiResponse = await analyzeImage({
            context,
            attachment,
            prompt: "Analyze this image for social media insights. Extract key themes, visual elements, and suggest how it could be used for social media content.",
          });
        } else {
          aiResponse = await analyzeDocument({
            context,
            prompt: "Summarize this document for social media insights. Extract key points, metrics, and actionable recommendations for social media strategy.",
            attachments: [attachment],
          });
        }

        const summary = aiResponse.message || "AI analysis completed.";

        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, status: "completed", summary }
              : f
          )
        );
      } catch (error) {
        console.error("AI processing error:", error);
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, status: "error" } : f
          )
        );
      }
    }
  };

  const handleDeleteFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    if (selectedFile?.id === fileId) setSelectedFile(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon size={24} />;
    return <FileText size={24} />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "uploading":
        return "text-blue-400";
      case "processing":
        return "text-orange-400";
      case "completed":
        return "text-green-400";
      case "error":
        return "text-red-400";
      default:
        return "text-white";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
          AI-Powered
        </p>
        <h1 className="mt-2 text-3xl font-bold">Social Media Intelligence</h1>
        <p className="mt-2 text-white/60">
          Upload documents or images to generate AI-powered summaries and insights
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload Section */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
              <Upload size={18} />
            </div>
            <h2 className="text-lg font-semibold">Upload Files</h2>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              isDragging
                ? "border-orange-500 bg-orange-500/5"
                : "border-white/20 hover:border-orange-500/50 hover:bg-white/5"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt"
              multiple
            />
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-orange-500/10 p-4">
                <Upload size={32} className="text-orange-500" />
              </div>
              <div>
                <p className="text-white font-medium">
                  Drag and drop files here, or click to browse
                </p>
                <p className="text-sm text-white/40 mt-1">
                  Supports images, PDFs, and documents
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-medium text-black transition-colors"
              >
                Select Files
              </button>
            </div>
          </div>

          {/* File List */}
          {uploadedFiles.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-medium text-white/80">Uploaded Files</h3>
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    selectedFile?.id === file.id
                      ? "border-orange-500 bg-orange-500/10"
                      : "border-white/10 bg-white/5"
                  } cursor-pointer hover:bg-white/10 transition-colors`}
                  onClick={() => setSelectedFile(file)}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-orange-400">{getFileIcon(file.type)}</div>
                    <div>
                      <p className="text-white font-medium">{file.name}</p>
                      <p className="text-xs text-white/40">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm ${getStatusColor(file.status)}`}>
                      {file.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file.id);
                      }}
                      className="p-1 text-white/40 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary Display */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
              <Sparkles size={18} />
            </div>
            <h2 className="text-lg font-semibold">AI Summary</h2>
          </div>

          {selectedFile ? (
            selectedFile.status === "completed" && selectedFile.summary ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-white/40">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 text-white/40 hover:text-white transition-colors">
                      <Eye size={16} />
                    </button>
                    <button className="p-2 text-white/40 hover:text-white transition-colors">
                      <Download size={16} />
                    </button>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <p className="text-sm text-white/60 mb-3">Generated Summary</p>
                  <div className="bg-black/40 rounded-lg p-4 text-sm text-white/90 whitespace-pre-wrap">
                    {selectedFile.summary}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-medium text-black transition-colors">
                    <Sparkles size={16} className="inline mr-2" />
                    Regenerate
                  </button>
                  <button className="flex-1 px-4 py-2 border border-white/20 hover:bg-white/10 rounded-lg font-medium text-white transition-colors">
                    <Download size={16} className="inline mr-2" />
                    Export
                  </button>
                </div>
              </div>
            ) : selectedFile.status === "processing" ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-orange-500/10 p-4 mb-4">
                  <Sparkles size={32} className="text-orange-500 animate-pulse" />
                </div>
                <p className="text-white">AI is analyzing your document...</p>
                <p className="text-sm text-white/40 mt-1">This may take a moment</p>
              </div>
            ) : selectedFile.status === "error" ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-red-500/10 p-4 mb-4">
                  <AlertCircle size={32} className="text-red-400" />
                </div>
                <p className="text-white">Processing failed</p>
                <p className="text-sm text-white/40 mt-1">Please try uploading again</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-white/10 p-4 mb-4">
                  <Sparkles size={32} className="text-white/40" />
                </div>
                <p className="text-white/60">Select a file to view summary</p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-white/10 p-4 mb-4">
                <Sparkles size={32} className="text-white/40" />
              </div>
              <p className="text-white/60">
                Upload a file to generate AI-powered summary
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-white/60">Total Files</p>
          <p className="text-2xl font-bold text-white">{uploadedFiles.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-white/60">Processed</p>
          <p className="text-2xl font-bold text-white">
            {uploadedFiles.filter((f) => f.status === "completed").length}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-white/60">Pending</p>
          <p className="text-2xl font-bold text-white">
            {uploadedFiles.filter((f) => f.status === "processing" || f.status === "uploading").length}
          </p>
        </div>
      </div>
    </div>
  );
}

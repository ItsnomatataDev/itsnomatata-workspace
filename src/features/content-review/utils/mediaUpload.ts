const VIDEO_EXTENSIONS = new Set(["mp4", "m4v", "mov", "webm", "ogv", "ogg", "mkv", "avi", "3gp", "3g2"]);

const VIDEO_MIME_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  ogv: "video/ogg",
  ogg: "video/ogg",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
};

export function fileNameExtension(fileName: string) {
  const part = fileName.split(".").pop();
  return part ? part.toLowerCase() : "";
}

export function isVideoExtension(extension: string) {
  return VIDEO_EXTENSIONS.has(extension);
}

export function isVideoUploadFile(file: Pick<File, "type" | "name">) {
  if (file.type.startsWith("video/")) return true;
  return isVideoExtension(fileNameExtension(file.name));
}

export function resolveUploadMimeType(file: Pick<File, "type" | "name">) {
  if (file.type) return file.type;
  const ext = fileNameExtension(file.name);
  return VIDEO_MIME_BY_EXTENSION[ext] ?? "";
}

export function isVideoAsset(asset: {
  asset_type?: string | null;
  mime_type?: string | null;
  file_name?: string | null;
}) {
  if (asset.asset_type === "video") return true;
  if (asset.mime_type?.startsWith("video/")) return true;
  if (asset.file_name && isVideoExtension(fileNameExtension(asset.file_name))) return true;
  return false;
}

export type PreparedMediaUpload = {
  file: File;
  compressionStatus: "compressed" | "stored_original" | "not_applicable";
  originalSize: number;
  storedSize: number;
};

/** Videos are never re-encoded in the browser — upload the file bytes as selected. */
export function prepareVideoUpload(file: File): PreparedMediaUpload {
  return {
    file,
    compressionStatus: "stored_original",
    originalSize: file.size,
    storedSize: file.size,
  };
}

/** Older uploads were re-encoded to WebM in-browser; re-upload the original file to restore quality. */
export function isLegacyCompressedVideo(asset: {
  asset_type?: string | null;
  mime_type?: string | null;
  file_name?: string | null;
  compression_status?: string | null;
  original_size_bytes?: number | null;
  stored_size_bytes?: number | null;
}) {
  if (!isVideoAsset(asset)) return false;
  if (asset.compression_status === "compressed") return true;
  const mime = asset.mime_type ?? "";
  const name = asset.file_name ?? "";
  if (mime === "video/webm" || /\.webm$/i.test(name)) {
    const original = asset.original_size_bytes ?? 0;
    const stored = asset.stored_size_bytes ?? 0;
    if (original > 0 && stored > 0 && stored < original * 0.85) return true;
  }
  return false;
}

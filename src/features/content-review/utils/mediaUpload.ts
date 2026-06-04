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

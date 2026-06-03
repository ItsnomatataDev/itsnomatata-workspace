export const CONTENT_CLIENT_MEDIA_DRAG_TYPE = "application/x-content-client-media-id";

type LibraryDragEvent = {
  dataTransfer: DataTransfer | null;
};

export function setDraggedLibraryMediaId(mediaId: string, event: LibraryDragEvent) {
  const dt = event.dataTransfer;
  if (!dt) return;
  dt.setData(CONTENT_CLIENT_MEDIA_DRAG_TYPE, mediaId);
  dt.effectAllowed = "copy";
}

export function readDraggedLibraryMediaId(event: LibraryDragEvent): string | null {
  const dt = event.dataTransfer;
  if (!dt) return null;
  const id = dt.getData(CONTENT_CLIENT_MEDIA_DRAG_TYPE);
  return id?.trim() || null;
}

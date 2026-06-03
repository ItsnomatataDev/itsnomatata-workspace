export const CONTENT_CLIENT_MEDIA_DRAG_TYPE = "application/x-content-client-media-id";

export function setDraggedLibraryMediaId(mediaId: string, event: DragEvent) {
  event.dataTransfer.setData(CONTENT_CLIENT_MEDIA_DRAG_TYPE, mediaId);
  event.dataTransfer.effectAllowed = "copy";
}

export function readDraggedLibraryMediaId(event: DragEvent): string | null {
  const id = event.dataTransfer.getData(CONTENT_CLIENT_MEDIA_DRAG_TYPE);
  return id?.trim() || null;
}

export async function getUserMediaStream(params: {
  audio: boolean;
  video: boolean;
}) {
  return navigator.mediaDevices.getUserMedia({
    audio: params.audio,
    video: params.video,
  });
}

export async function getScreenShareStream() {
  const mediaDevices = navigator.mediaDevices as Navigator["mediaDevices"] & {
    getDisplayMedia?: (constraints?: MediaStreamConstraints) => Promise<MediaStream>;
  };

  if (!mediaDevices.getDisplayMedia) {
    throw new Error("Screen sharing is not supported in this browser.");
  }

  return mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
  });
}

export function stopMediaStream(stream: MediaStream | null) {
  if (!stream) return;

  stream.getTracks().forEach((track) => {
    track.stop();
  });
}

export function setTrackEnabled(
  stream: MediaStream | null,
  kind: "audio" | "video",
  enabled: boolean,
) {
  if (!stream) return;

  stream.getTracks().forEach((track) => {
    if (track.kind === kind) {
      track.enabled = enabled;
    }
  });
}

export function getTrack(
  stream: MediaStream | null,
  kind: "audio" | "video",
): MediaStreamTrack | null {
  if (!stream) return null;
  return stream.getTracks().find((track) => track.kind === kind) ?? null;
}
export async function getUserMediaStream(params: {
  audio: boolean;
  video: boolean;
}): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera and microphone access is not supported in this browser.");
  }

  return navigator.mediaDevices.getUserMedia({
    audio: params.audio,
    video: params.video
      ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        }
      : false,
  });
}

export async function getScreenShareStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen sharing is not supported in this browser.");
  }

  return navigator.mediaDevices.getDisplayMedia({
    video: {
      width: { ideal: 1920, max: 2560 },
      height: { ideal: 1080, max: 1440 },
      frameRate: { ideal: 30, max: 60 },
      cursor: "always",
      displaySurface: "monitor",
    } as MediaTrackConstraints,
    audio: false,
  });
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

export function setTrackEnabled(
  stream: MediaStream | null,
  kind: "audio" | "video",
  enabled: boolean,
): void {
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
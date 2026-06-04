/** Capture one frame from a video URL for AI vision (does not modify the stored video). */
export async function captureVideoFrameDataUrl(
  videoUrl: string,
  options?: { seekSeconds?: number; maxWidth?: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const cleanup = () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };

    video.onerror = () =>
      fail(
        "Could not load the video for AI analysis. Try uploading a still image, or re-upload the video in full quality and try again.",
      );

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 1;
      const seek =
        options?.seekSeconds ??
        Math.min(1, Math.max(0.1, duration * 0.1));
      video.currentTime = seek;
    };

    video.onseeked = () => {
      try {
        const maxWidth = options?.maxWidth ?? 1280;
        let width = video.videoWidth;
        let height = video.videoHeight;
        if (!width || !height) {
          fail("Video has no readable frame dimensions.");
          return;
        }
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          fail("Could not capture a frame from the video.");
          return;
        }
        context.drawImage(video, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              fail("Could not encode a frame from the video.");
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              cleanup();
              resolve(String(reader.result));
            };
            reader.onerror = () => fail("Could not read the captured frame.");
            reader.readAsDataURL(blob);
          },
          "image/jpeg",
          0.92,
        );
      } catch (error) {
        fail(error instanceof Error ? error.message : "Frame capture failed.");
      }
    };

    video.src = videoUrl;
  });
}

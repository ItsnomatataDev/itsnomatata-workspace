import {
  AudioPresets,
  ScreenSharePresets,
  VideoPresets,
  type RoomOptions,
} from "livekit-client";

export interface MediaDeviceInfo {
  deviceId: string;
  kind: MediaDeviceKind;
  label: string;
  groupId?: string;
}

export interface DeviceConstraints {
  audio?: boolean | MediaTrackConstraints;
  video?: boolean | MediaTrackConstraints;
}

export interface OptimizedRoomOptions extends RoomOptions {
  // Enhanced adaptive streaming
  adaptiveStream: boolean;
  dynacast: boolean;
  
  // Optimized publishing defaults
  publishDefaults: {
    simulcast: boolean;
    videoCodec: "vp8" | "vp9" | "h264";
    videoEncoding: {
      maxBitrate: number;
      maxFramerate: number;
      priority?: RTCPriorityType;
    };
    screenShareEncoding: {
      maxBitrate: number;
      maxFramerate: number;
      priority?: RTCPriorityType;
    };
    audioPreset?: { maxBitrate: number };
    audioBitrate?: number;
    degradationPreference?: RTCDegradationPreference;
    screenShareSimulcastLayers?: Array<typeof ScreenSharePresets[keyof typeof ScreenSharePresets]>;
  };
  
  // Optimized capture defaults
  videoCaptureDefaults: {
    resolution: { width: number; height: number };
    frameRate: number;
  };
  
  audioCaptureDefaults: {
    autoGainControl: boolean;
    echoCancellation: boolean;
    noiseSuppression: boolean;
    sampleRate?: number;
    channelCount?: number;
  };
}

// Optimized LiveKit room configuration for clear meetings.
export const OPTIMIZED_ROOM_OPTIONS: OptimizedRoomOptions = {
  // Keep adaptive receive behavior, but publish a sharp primary stream.
  adaptiveStream: true,
  dynacast: true,
  
  publishDefaults: {
    simulcast: true,
    videoCodec: "vp8",
    videoEncoding: {
      ...VideoPresets.h720.encoding,
      maxBitrate: 1_700_000,
      maxFramerate: 30,
    },
    screenShareEncoding: {
      ...ScreenSharePresets.h1080fps30.encoding,
      maxBitrate: 5_000_000,
      maxFramerate: 30,
    },
    screenShareSimulcastLayers: [
      ScreenSharePresets.h720fps15,
      ScreenSharePresets.h1080fps30,
    ],
    audioPreset: AudioPresets.musicHighQuality,
    audioBitrate: 96_000,
    degradationPreference: "maintain-resolution",
  },
  
  // Optimized video capture settings
  videoCaptureDefaults: {
    resolution: VideoPresets.h720.resolution, // Use 720p as default
    frameRate: 30,
  },
  
  // Enhanced audio processing
  audioCaptureDefaults: {
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: 48000, // High quality audio
    channelCount: 2, // Stereo if available
  },
};

// Low bandwidth configuration for poor connections
export const LOW_BANDWIDTH_OPTIONS: OptimizedRoomOptions = {
  ...OPTIMIZED_ROOM_OPTIONS,
  publishDefaults: {
    ...OPTIMIZED_ROOM_OPTIONS.publishDefaults,
    videoEncoding: {
      maxBitrate: 500_000,
      maxFramerate: 24,
    },
    screenShareEncoding: {
      ...ScreenSharePresets.h720fps15.encoding,
      maxBitrate: 1_500_000,
      maxFramerate: 15,
    },
    screenShareSimulcastLayers: [ScreenSharePresets.h360fps15],
    audioPreset: AudioPresets.speech,
    audioBitrate: 32_000,
    degradationPreference: "balanced",
  },
  videoCaptureDefaults: {
    resolution: VideoPresets.h360.resolution,
    frameRate: 24,
  },
};

// High quality configuration for good connections
export const HIGH_QUALITY_OPTIONS: OptimizedRoomOptions = {
  ...OPTIMIZED_ROOM_OPTIONS,
  publishDefaults: {
    ...OPTIMIZED_ROOM_OPTIONS.publishDefaults,
    videoEncoding: {
      ...VideoPresets.h1080.encoding,
      maxBitrate: 3_000_000,
      maxFramerate: 30,
    },
    screenShareEncoding: {
      ...ScreenSharePresets.original.encoding,
      maxBitrate: 7_000_000,
      maxFramerate: 30,
    },
    screenShareSimulcastLayers: [
      ScreenSharePresets.h720fps15,
      ScreenSharePresets.h1080fps30,
    ],
    audioPreset: AudioPresets.musicHighQualityStereo,
    audioBitrate: 128_000,
    degradationPreference: "maintain-resolution",
  },
  videoCaptureDefaults: {
    resolution: VideoPresets.h1080.resolution,
    frameRate: 30,
  },
};

export async function getUserMediaStream(params: {
  audio: boolean | MediaTrackConstraints;
  video: boolean | MediaTrackConstraints;
  deviceId?: {
    audio?: string;
    video?: string;
  };
}): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera and microphone access is not supported in this browser.");
  }

  const constraints: MediaStreamConstraints = {
    audio: typeof params.audio === "boolean" 
      ? params.audio 
      : params.audio,
    video: typeof params.video === "boolean" 
      ? params.video 
        ? {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 },
            deviceId: params.deviceId?.video ? { exact: params.deviceId.video } : undefined,
          }
        : false
      : {
          ...params.video,
          deviceId: params.deviceId?.video ? { exact: params.deviceId.video } : undefined,
        },
  };

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    console.error("GET USER MEDIA ERROR:", error);
    
    // Fallback to lower quality if high quality fails
    if (typeof params.video === "boolean" && params.video) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: params.audio,
          video: {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 24, max: 30 },
            deviceId: params.deviceId?.video ? { exact: params.deviceId.video } : undefined,
          },
        });
      } catch (fallbackError) {
        console.error("FALLBACK GET USER MEDIA ERROR:", fallbackError);
        throw new Error("Failed to access camera and microphone. Please check permissions.");
      }
    }
    
    throw error;
  }
}

export async function getScreenShareStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen sharing is not supported in this browser.");
  }

  const constraints: MediaStreamConstraints = {
    video: {
      width: { ideal: 1920, max: 2560 },
      height: { ideal: 1080, max: 1440 },
      frameRate: { ideal: 30, max: 60 },
      cursor: "always",
      displaySurface: "monitor",
    } as MediaTrackConstraints,
    audio: false, // Audio in screen share can cause issues
  };

  try {
    return await navigator.mediaDevices.getDisplayMedia(constraints);
  } catch (error) {
    console.error("GET SCREEN SHARE ERROR:", error);
    throw new Error("Failed to start screen sharing. Please ensure you grant permission.");
  }
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;
  
  stream.getTracks().forEach((track) => {
    track.stop();
    track.enabled = false;
  });
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

// Device Management Functions
export async function getAvailableDevices(): Promise<{
  audioinput: MediaDeviceInfo[];
  audiooutput: MediaDeviceInfo[];
  videoinput: MediaDeviceInfo[];
}> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    throw new Error("Device enumeration is not supported in this browser.");
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    
    const audioinput: MediaDeviceInfo[] = [];
    const audiooutput: MediaDeviceInfo[] = [];
    const videoinput: MediaDeviceInfo[] = [];

    devices.forEach((device) => {
      const deviceInfo: MediaDeviceInfo = {
        deviceId: device.deviceId,
        kind: device.kind,
        label: device.label || `${device.kind} ${device.deviceId.slice(0, 8)}`,
        groupId: device.groupId,
      };

      switch (device.kind) {
        case "audioinput":
          audioinput.push(deviceInfo);
          break;
        case "audiooutput":
          audiooutput.push(deviceInfo);
          break;
        case "videoinput":
          videoinput.push(deviceInfo);
          break;
      }
    });

    return { audioinput, audiooutput, videoinput };
  } catch (error) {
    console.error("ENUMERATE DEVICES ERROR:", error);
    throw new Error("Failed to enumerate available devices.");
  }
}

export async function requestDevicePermissions(): Promise<boolean> {
  try {
    // Request minimal permissions to trigger permission prompt
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    
    // Immediately stop the stream after getting permissions
    stopMediaStream(stream);
    return true;
  } catch (error) {
    console.error("DEVICE PERMISSIONS ERROR:", error);
    return false;
  }
}

export function getDefaultDeviceId(devices: MediaDeviceInfo[]): string {
  if (devices.length === 0) return "";
  
  // Try to find a device with "default" in its label or the first available
  const defaultDevice = devices.find(device => 
    device.label.toLowerCase().includes("default") || 
    device.deviceId === "default"
  );
  
  return defaultDevice?.deviceId || devices[0]?.deviceId || "";
}

export async function switchAudioOutput(element: HTMLAudioElement | HTMLVideoElement, deviceId: string): Promise<void> {
  if (!element || !deviceId) return;
  
  // Check if setSinkId is supported
  if (!("setSinkId" in element)) {
    console.warn("Audio output switching is not supported in this browser.");
    return;
  }

  try {
    await (element as any).setSinkId(deviceId);
  } catch (error) {
    console.error("SWITCH AUDIO OUTPUT ERROR:", error);
    throw new Error(`Failed to switch audio output: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export function getOptimalRoomOptions(bandwidth?: "low" | "normal" | "high"): OptimizedRoomOptions {
  switch (bandwidth) {
    case "low":
      return LOW_BANDWIDTH_OPTIONS;
    case "high":
      return HIGH_QUALITY_OPTIONS;
    default:
      return OPTIMIZED_ROOM_OPTIONS;
  }
}

export function estimateConnectionQuality(): "low" | "normal" | "high" {
  // Simple heuristic based on navigator connection if available
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  if (!connection) {
    return "normal"; // Default to normal if no connection info available
  }

  const { effectiveType, downlink } = connection;
  
  // Use effective type as primary indicator
  switch (effectiveType) {
    case "slow-2g":
    case "2g":
      return "low";
    case "3g":
      return downlink < 1 ? "low" : "normal";
    case "4g":
      return downlink < 2 ? "normal" : "high";
    default:
      return "normal";
  }
}

export function createDeviceConstraints(deviceId?: string, quality: "low" | "normal" | "high" = "normal"): MediaTrackConstraints {
  const baseConstraints: MediaTrackConstraints = {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 30 },
  };

  if (deviceId) {
    baseConstraints.deviceId = { exact: deviceId };
  }

  // Adjust based on quality
  switch (quality) {
    case "low":
      return {
        ...baseConstraints,
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 },
        frameRate: { ideal: 24, max: 30 },
      };
    case "high":
      return {
        ...baseConstraints,
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
      };
    default:
      return baseConstraints;
  }
}

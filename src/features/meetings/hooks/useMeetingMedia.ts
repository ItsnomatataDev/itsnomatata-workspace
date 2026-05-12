import { useCallback, useEffect, useRef, useState } from "react";
import type { MeetingType } from "../types/meeting";
import {
  getAvailableDevices,
  getScreenShareStream,
  getTrack,
  getUserMediaStream,
  requestDevicePermissions,
  setTrackEnabled,
  stopMediaStream,
  switchAudioOutput,
  estimateConnectionQuality,
  getOptimalRoomOptions,
  type MediaDeviceInfo,
  type OptimizedRoomOptions,
} from "../services/meetingMediaService";

export interface UseMeetingMediaOptions {
  meetingType: MeetingType;
  autoInitialize?: boolean;
  adaptiveQuality?: boolean;
}

export interface UseMeetingMediaReturn {
  // Device state
  devices: {
    audioinput: MediaDeviceInfo[];
    audiooutput: MediaDeviceInfo[];
    videoinput: MediaDeviceInfo[];
  };
  selectedDevices: {
    audioinput: string;
    audiooutput: string;
    videoinput: string;
  };
  permissions: {
    camera: boolean;
    microphone: boolean;
  };
  
  // Stream state
  localStream: MediaStream | null;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  error: string | null;
  loading: boolean;
  
  // Quality and performance
  connectionQuality: "low" | "normal" | "high";
  optimizedOptions: OptimizedRoomOptions;
  
  // Actions
  initializeMedia: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  switchDevice: (kind: "audioinput" | "videoinput" | "audiooutput", deviceId: string) => Promise<void>;
  testAudio: (deviceId: string) => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  refreshDevices: () => Promise<void>;
  cleanup: () => void;
}

export function useMeetingMedia({
  meetingType,
  autoInitialize = true,
  adaptiveQuality = true,
}: UseMeetingMediaOptions): UseMeetingMediaReturn {
  // Device management
  const [devices, setDevices] = useState({
    audioinput: [] as MediaDeviceInfo[],
    audiooutput: [] as MediaDeviceInfo[],
    videoinput: [] as MediaDeviceInfo[],
  });
  const [selectedDevices, setSelectedDevices] = useState({
    audioinput: "",
    audiooutput: "",
    videoinput: "",
  });
  const [permissions, setPermissions] = useState({
    camera: false,
    microphone: false,
  });

  // Stream management
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenShareRef = useRef<MediaStream | null>(null);
  const audioTestRef = useRef<HTMLAudioElement | null>(null);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(meetingType === "video");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Quality management
  const [connectionQuality, setConnectionQuality] = useState<"low" | "normal" | "high">("normal");
  const [optimizedOptions, setOptimizedOptions] = useState<OptimizedRoomOptions>(getOptimalRoomOptions());

  // Load available devices
  const loadDevices = useCallback(async () => {
    try {
      const availableDevices = await getAvailableDevices();
      setDevices(availableDevices);
      
      // Set default devices if not already selected
      setSelectedDevices(prev => ({
        audioinput: prev.audioinput || getDefaultDeviceId(availableDevices.audioinput),
        audiooutput: prev.audiooutput || getDefaultDeviceId(availableDevices.audiooutput),
        videoinput: prev.videoinput || getDefaultDeviceId(availableDevices.videoinput),
      }));
    } catch (err) {
      console.error("LOAD DEVICES ERROR:", err);
      setError("Failed to load available devices");
    }
  }, []);

  // Check device permissions
  const checkPermissions = useCallback(async () => {
    try {
      const hasPermissions = await requestDevicePermissions();
      setPermissions({
        camera: hasPermissions,
        microphone: hasPermissions,
      });
      return hasPermissions;
    } catch (err) {
      console.error("CHECK PERMISSIONS ERROR:", err);
      setPermissions({ camera: false, microphone: false });
      return false;
    }
  }, []);

  // Initialize media with selected devices
  const initializeMedia = useCallback(async () => {
    if (!selectedDevices.audioinput && !selectedDevices.videoinput) {
      setError("No devices selected");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Stop existing stream
      if (localStreamRef.current) {
        stopMediaStream(localStreamRef.current);
        localStreamRef.current = null;
      }

      const stream = await getUserMediaStream({
        audio: selectedDevices.audioinput ? true : false,
        video: meetingType === "video" && selectedDevices.videoinput ? true : false,
        deviceId: {
          audio: selectedDevices.audioinput || undefined,
          video: selectedDevices.videoinput || undefined,
        },
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      setIsCameraOn(meetingType === "video");

      // Apply audio output device if supported
      if (selectedDevices.audiooutput && audioTestRef.current) {
        try {
          await switchAudioOutput(audioTestRef.current, selectedDevices.audiooutput);
        } catch (err) {
          console.warn("Failed to set audio output device:", err);
        }
      }

      console.log("MEDIA INITIALIZED:", {
        tracks: stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })),
        devices: selectedDevices,
      });
    } catch (err) {
      console.error("INITIALIZE MEDIA ERROR:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to initialize media devices";
      setError(errorMessage);
      setPermissions({ camera: false, microphone: false });
    } finally {
      setLoading(false);
    }
  }, [selectedDevices, meetingType]);

  // Toggle microphone
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const next = !isMuted;
    setTrackEnabled(stream, "audio", !next);
    setIsMuted(next);
  }, [isMuted]);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const next = !isCameraOn;
    setTrackEnabled(stream, "video", next);
    setIsCameraOn(next);
  }, [isCameraOn]);

  // Start screen sharing
  const startScreenShare = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const stream = await getScreenShareStream();
      screenShareRef.current = stream;
      setIsScreenSharing(true);

      // Handle screen share end
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener("ended", () => {
          stopScreenShare();
        }, { once: true });
      }

      console.log("SCREEN SHARE STARTED");
    } catch (err) {
      console.error("START SCREEN SHARE ERROR:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to start screen sharing";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Stop screen sharing
  const stopScreenShare = useCallback(() => {
    if (screenShareRef.current) {
      stopMediaStream(screenShareRef.current);
      screenShareRef.current = null;
    }
    setIsScreenSharing(false);
    console.log("SCREEN SHARE STOPPED");
  }, []);

  // Switch device
  const switchDevice = useCallback(async (kind: "audioinput" | "videoinput" | "audiooutput", deviceId: string) => {
    try {
      setError(null);
      
      setSelectedDevices(prev => ({ ...prev, [kind]: deviceId }));

      // For audio output, apply immediately
      if (kind === "audiooutput" && audioTestRef.current) {
        await switchAudioOutput(audioTestRef.current, deviceId);
        return;
      }

      // For input devices, reinitialize media
      if (kind === "audioinput" || kind === "videoinput") {
        await initializeMedia();
      }
    } catch (err) {
      console.error("SWITCH DEVICE ERROR:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to switch device";
      setError(errorMessage);
    }
  }, [initializeMedia]);

  // Test audio device
  const testAudio = useCallback(async (deviceId: string) => {
    if (!audioTestRef.current) return;

    try {
      // Create a test tone
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 440; // A4 note
      gainNode.gain.value = 0.1; // Low volume
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5); // Play for 0.5 seconds
    } catch (err) {
      console.error("AUDIO TEST ERROR:", err);
      setError("Failed to test audio device");
    }
  }, []);

  // Request permissions
  const requestPermissions = useCallback(async () => {
    const granted = await requestDevicePermissions();
    setPermissions({
      camera: granted,
      microphone: granted,
    });
    
    if (granted) {
      await loadDevices();
    }
    
    return granted;
  }, [loadDevices]);

  // Refresh devices
  const refreshDevices = useCallback(async () => {
    await loadDevices();
  }, [loadDevices]);

  // Update connection quality and optimize settings
  const updateConnectionQuality = useCallback(() => {
    if (!adaptiveQuality) return;

    const quality = estimateConnectionQuality();
    setConnectionQuality(quality);
    setOptimizedOptions(getOptimalRoomOptions(quality));
  }, [adaptiveQuality]);

  // Cleanup
  const cleanup = useCallback(() => {
    stopMediaStream(localStreamRef.current);
    stopMediaStream(screenShareRef.current);
    
    localStreamRef.current = null;
    screenShareRef.current = null;
    
    setLocalStream(null);
    setIsMuted(false);
    setIsCameraOn(meetingType === "video");
    setIsScreenSharing(false);
    setError(null);
  }, [meetingType]);

  // Auto-initialize
  useEffect(() => {
    if (!autoInitialize) return;

    const init = async () => {
      await loadDevices();
      await checkPermissions();
      
      if (permissions.microphone || permissions.camera) {
        await initializeMedia();
      }
      
      updateConnectionQuality();
    };

    init();
  }, [autoInitialize, loadDevices, checkPermissions, initializeMedia, permissions, updateConnectionQuality]);

  // Monitor connection quality
  useEffect(() => {
    if (!adaptiveQuality) return;

    const interval = setInterval(updateConnectionQuality, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [adaptiveQuality, updateConnectionQuality]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    devices,
    selectedDevices,
    permissions,
    localStream,
    isMuted,
    isCameraOn,
    isScreenSharing,
    error,
    loading,
    connectionQuality,
    optimizedOptions,
    initializeMedia,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    switchDevice,
    testAudio,
    requestPermissions,
    refreshDevices,
    cleanup,
  };
}

// Helper function to get default device ID
function getDefaultDeviceId(devices: MediaDeviceInfo[]): string {
  if (devices.length === 0) return "";
  
  const defaultDevice = devices.find(device => 
    device.label.toLowerCase().includes("default") || 
    device.deviceId === "default"
  );
  
  return defaultDevice?.deviceId || devices[0]?.deviceId || "";
}
import { useCallback, useEffect, useRef, useState } from "react";
import type { MeetingType, RemoteParticipantStream } from "../types/meeting";
import {
  getScreenShareStream,
  getTrack,
  getUserMediaStream,
  setTrackEnabled,
  stopMediaStream,
} from "../services/meetingMediaService";
import { WebRTCMeetingService } from "../services/webrtcService";

export function useMeetingMedia(meetingType: MeetingType) {
  const rtcRef = useRef<WebRTCMeetingService | null>(null);
  const screenShareRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteParticipantStream[]>(
    [],
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(meetingType === "video");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState("");

  if (!rtcRef.current) {
    rtcRef.current = new WebRTCMeetingService();
  }

  const initializeLocalMedia = useCallback(async () => {
    try {
      setError("");

      if (cameraStreamRef.current) {
        rtcRef.current?.setLocalStream(cameraStreamRef.current);
        setLocalStream(cameraStreamRef.current);
        return cameraStreamRef.current;
      }

      const stream = await getUserMediaStream({
        audio: true,
        video: meetingType === "video",
      });

      cameraStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      setIsCameraOn(meetingType === "video");

      rtcRef.current?.setLocalStream(stream);

      console.log(
        "LOCAL MEDIA INITIALIZED:",
        stream.getTracks().map((track) => ({
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
        })),
      );

      return stream;
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to access microphone/camera.");
      return null;
    }
  }, [meetingType]);

  const toggleMute = useCallback(() => {
    const stream = cameraStreamRef.current;
    const next = !isMuted;

    setTrackEnabled(stream, "audio", !next);
    setIsMuted(next);

    const audioTrack = getTrack(stream, "audio");
    rtcRef.current?.replaceAudioTrack(audioTrack);

    return next;
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const stream = cameraStreamRef.current;
    const next = !isCameraOn;

    setTrackEnabled(stream, "video", next);
    setIsCameraOn(next);

    const activeVideoSource =
      isScreenSharing && screenShareRef.current
        ? getTrack(screenShareRef.current, "video")
        : getTrack(stream, "video");

    rtcRef.current?.replaceVideoTrack(next ? activeVideoSource : null);

    return next;
  }, [isCameraOn, isScreenSharing]);

  const stopScreenShare = useCallback(async () => {
    stopMediaStream(screenShareRef.current);
    screenShareRef.current = null;

    const fallbackCameraStream = cameraStreamRef.current;
    setLocalStream(fallbackCameraStream);

    const cameraTrack =
      isCameraOn && fallbackCameraStream
        ? getTrack(fallbackCameraStream, "video")
        : null;

    rtcRef.current?.setLocalStream(fallbackCameraStream);
    rtcRef.current?.replaceVideoTrack(cameraTrack);

    setIsScreenSharing(false);
  }, [isCameraOn]);

  const startScreenShare = useCallback(async () => {
    try {
      setError("");

      const stream = await getScreenShareStream();
      screenShareRef.current = stream;

      setLocalStream(stream);

      const videoTrack = stream.getVideoTracks()[0] ?? null;
      rtcRef.current?.replaceVideoTrack(videoTrack);

      setIsScreenSharing(true);

      if (videoTrack) {
        videoTrack.onended = () => {
          void stopScreenShare();
        };
      }

      return stream;
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to start screen sharing.");
      return null;
    }
  }, [stopScreenShare]);

  const registerRemoteStream = useCallback(
    (userId: string, stream: MediaStream) => {
      setRemoteStreams((current) => {
        const existingIndex = current.findIndex((item) => item.userId === userId);

        if (existingIndex >= 0) {
          const next = [...current];
          next[existingIndex] = { userId, stream };
          return next;
        }

        return [...current, { userId, stream }];
      });
    },
    [],
  );

  const removeRemoteStream = useCallback((userId: string) => {
    setRemoteStreams((current) =>
      current.filter((item) => item.userId !== userId),
    );
    rtcRef.current?.removePeer(userId);
  }, []);

  const cleanup = useCallback(() => {
    stopMediaStream(screenShareRef.current);
    stopMediaStream(cameraStreamRef.current);

    screenShareRef.current = null;
    cameraStreamRef.current = null;

    setLocalStream(null);
    setRemoteStreams([]);
    setIsMuted(false);
    setIsCameraOn(meetingType === "video");
    setIsScreenSharing(false);

    rtcRef.current?.setLocalStream(null);
    rtcRef.current?.cleanup();
  }, [meetingType]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    rtcService: rtcRef.current,
    localStream,
    remoteStreams,
    isMuted,
    isCameraOn,
    isScreenSharing,
    error,
    initializeLocalMedia,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    registerRemoteStream,
    removeRemoteStream,
    cleanup,
  };
}
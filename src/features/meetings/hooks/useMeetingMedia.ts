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
  const localStreamRef = useRef<MediaStream | null>(null);

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

      if (localStreamRef.current) {
        return localStreamRef.current;
      }

      const stream = await getUserMediaStream({
        audio: true,
        video: meetingType === "video",
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      setIsCameraOn(meetingType === "video");
      rtcRef.current?.setLocalStream(stream);

      return stream;
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to access microphone/camera.");
      return null;
    }
  }, [meetingType]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    const next = !isMuted;

    setTrackEnabled(stream, "audio", !next);
    setIsMuted(next);

    const audioTrack = getTrack(stream, "audio");
    rtcRef.current?.replaceAudioTrack(audioTrack);

    return next;
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    const next = !isCameraOn;

    setTrackEnabled(stream, "video", next);
    setIsCameraOn(next);

    const videoTrack = getTrack(stream, "video");
    rtcRef.current?.replaceVideoTrack(videoTrack);

    return next;
  }, [isCameraOn]);

  const stopScreenShare = useCallback(async () => {
    stopMediaStream(screenShareRef.current);
    screenShareRef.current = null;

    const cameraTrack = getTrack(localStreamRef.current, "video");
    rtcRef.current?.replaceVideoTrack(cameraTrack);

    setIsScreenSharing(false);
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      setError("");

      const stream = await getScreenShareStream();
      screenShareRef.current = stream;

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
        const exists = current.some((item) => item.userId === userId);

        if (exists) {
          return current.map((item) =>
            item.userId === userId ? { ...item, stream } : item,
          );
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
    stopMediaStream(localStreamRef.current);
    stopMediaStream(screenShareRef.current);

    localStreamRef.current = null;
    screenShareRef.current = null;

    setLocalStream(null);
    setRemoteStreams([]);
    setIsMuted(false);
    setIsCameraOn(meetingType === "video");
    setIsScreenSharing(false);

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
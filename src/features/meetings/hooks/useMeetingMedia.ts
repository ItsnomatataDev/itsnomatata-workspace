import { useCallback, useMemo, useRef, useState } from "react";
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
  const rtcRef = useRef<WebRTCMeetingService>(new WebRTCMeetingService());
  const screenShareRef = useRef<MediaStream | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteParticipantStream[]>(
    [],
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(meetingType === "video");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState("");

  const initializeLocalMedia = useCallback(async () => {
    try {
      setError("");

      stopMediaStream(screenShareRef.current);
      screenShareRef.current = null;

      setRemoteStreams([]);

      setLocalStream((current) => {
        stopMediaStream(current);
        return null;
      });

      const stream = await getUserMediaStream({
        audio: true,
        video: meetingType === "video",
      });

      setLocalStream(stream);
      setIsMuted(false);
      setIsCameraOn(meetingType === "video");
      setIsScreenSharing(false);

      rtcRef.current.setLocalStream(stream);

      return stream;
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to access microphone/camera.",
      );
      return null;
    }
  }, [meetingType]);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setTrackEnabled(localStream, "audio", !nextMuted);
    setIsMuted(nextMuted);

    const audioTrack = getTrack(localStream, "audio");
    rtcRef.current.replaceAudioTrack(audioTrack);

    return nextMuted;
  }, [isMuted, localStream]);

  const toggleCamera = useCallback(() => {
    const nextCameraOn = !isCameraOn;
    setTrackEnabled(localStream, "video", nextCameraOn);
    setIsCameraOn(nextCameraOn);

    const videoTrack = nextCameraOn ? getTrack(localStream, "video") : null;
    rtcRef.current.replaceVideoTrack(videoTrack);

    return nextCameraOn;
  }, [isCameraOn, localStream]);

  const stopScreenShare = useCallback(async () => {
    stopMediaStream(screenShareRef.current);
    screenShareRef.current = null;

    const cameraTrack =
      isCameraOn && meetingType === "video"
        ? getTrack(localStream, "video")
        : null;

    rtcRef.current.replaceVideoTrack(cameraTrack);
    setIsScreenSharing(false);
  }, [isCameraOn, localStream, meetingType]);

  const startScreenShare = useCallback(async () => {
    try {
      setError("");

      const stream = await getScreenShareStream();
      screenShareRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0] ?? null;
      rtcRef.current.replaceVideoTrack(videoTrack);

      setIsScreenSharing(true);

      if (videoTrack) {
        videoTrack.onended = () => {
          void stopScreenShare();
        };
      }

      return stream;
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start screen sharing.",
      );
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
    setRemoteStreams((current) => {
      const target = current.find((item) => item.userId === userId);
      if (target?.stream) {
        stopMediaStream(target.stream);
      }
      return current.filter((item) => item.userId !== userId);
    });

    rtcRef.current.removePeer(userId);
  }, []);

  const cleanup = useCallback(() => {
    stopMediaStream(screenShareRef.current);
    screenShareRef.current = null;

    setLocalStream((current) => {
      stopMediaStream(current);
      return null;
    });

    setRemoteStreams((current) => {
      current.forEach((item) => stopMediaStream(item.stream));
      return [];
    });

    rtcRef.current.cleanup();
    setIsScreenSharing(false);
  }, []);

  return useMemo(
    () => ({
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
    }),
    [
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
    ],
  );
}
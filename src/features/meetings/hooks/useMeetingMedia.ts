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

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteParticipantStream[]>([]);
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

      const stream = await getUserMediaStream({
        audio: true,
        video: meetingType === "video",
      });

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
    const next = !isMuted;
    setTrackEnabled(localStream, "audio", !next);
    setIsMuted(next);

    const audioTrack = getTrack(localStream, "audio");
    rtcRef.current?.replaceAudioTrack(audioTrack && !next ? audioTrack : audioTrack);
    return next;
  }, [isMuted, localStream]);

  const toggleCamera = useCallback(() => {
    const next = !isCameraOn;
    setTrackEnabled(localStream, "video", next);
    setIsCameraOn(next);

    const videoTrack = getTrack(localStream, "video");
    rtcRef.current?.replaceVideoTrack(videoTrack);
    return next;
  }, [isCameraOn, localStream]);

  const startScreenShare = useCallback(async () => {
    try {
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
  }, []);

  const stopScreenShare = useCallback(async () => {
    stopMediaStream(screenShareRef.current);
    screenShareRef.current = null;

    const cameraTrack = getTrack(localStream, "video");
    rtcRef.current?.replaceVideoTrack(cameraTrack);

    setIsScreenSharing(false);
  }, [localStream]);

  const registerRemoteStream = useCallback((userId: string, stream: MediaStream) => {
    setRemoteStreams((current) => {
      const exists = current.some((item) => item.userId === userId);
      if (exists) {
        return current.map((item) =>
          item.userId === userId ? { ...item, stream } : item,
        );
      }
      return [...current, { userId, stream }];
    });
  }, []);

  const removeRemoteStream = useCallback((userId: string) => {
    setRemoteStreams((current) => current.filter((item) => item.userId !== userId));
    rtcRef.current?.removePeer(userId);
  }, []);

  useEffect(() => {
    return () => {
      stopMediaStream(localStream);
      stopMediaStream(screenShareRef.current);
      rtcRef.current?.cleanup();
    };
  }, [localStream]);

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
  };
}
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  PhoneOff,
  SendHorizontal,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../lib/hooks/useAuth";
import { useMeetingMedia } from "../hooks/useMeetingMedia";
import {
  endMeeting,
  getMeetingById,
  getMeetingMessages,
  joinMeeting,
  leaveMeeting,
  sendMeetingMessage,
  updateMeetingMediaState,
} from "../services/meetingService";
import { subscribeToMeetingRoom } from "../services/meetingRealtime";
import {
  sendMeetingSignal,
  subscribeToMeetingSignals,
} from "../services/meetingSignalService";
import type {
  MeetingMessage,
  MeetingParticipant,
  MeetingWithParticipants,
} from "../types/meeting";

function getParticipantLabel(participant: MeetingParticipant) {
  return (
    participant.profile?.full_name ||
    participant.profile?.email ||
    "Unnamed participant"
  );
}

function getInitials(label: string) {
  return label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function ParticipantTile({
  label,
  stream,
  muted = false,
  badge,
  isPinned = false,
  isHost = false,
  canManage = false,
  isVideoExpected = true,
  isCameraOn = true,
  isMutedState = false,
  onTogglePin,
}: {
  label: string;
  stream: MediaStream | null;
  muted?: boolean;
  badge?: string;
  isPinned?: boolean;
  isHost?: boolean;
  canManage?: boolean;
  isVideoExpected?: boolean;
  isCameraOn?: boolean;
  isMutedState?: boolean;
  onTogglePin?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
  }, [stream]);

  const showVideo = !!stream && (!isVideoExpected || isCameraOn);

  return (
    <div
      className={[
        "group relative overflow-hidden border border-white/10 bg-neutral-950 text-white",
        isPinned ? "min-h-[420px]" : "min-h-[220px]",
      ].join(" ")}
    >
      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
            {label}
          </span>

          {badge ? (
            <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-300">
              {badge}
            </span>
          ) : null}

          {isHost ? (
            <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80">
              Host
            </span>
          ) : null}
        </div>

        {canManage && onTogglePin ? (
          <button
            type="button"
            onClick={onTogglePin}
            className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-xs font-medium text-white transition hover:bg-black"
          >
            {isPinned ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {isPinned ? "Unpin" : "Pin"}
          </button>
        ) : null}
      </div>

      <div className="flex h-full min-h-[220px] items-center justify-center">
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-black">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-2xl font-semibold text-orange-400">
              {getInitials(label)}
            </div>
            <p className="mt-4 text-sm text-white/45">
              {!isVideoExpected ? "Audio only" : "Camera off"}
            </p>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 bg-linear-to-t from-black/90 to-transparent p-3">
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span
            className={[
              "rounded-full px-2 py-1",
              isMutedState
                ? "bg-red-500/15 text-red-300"
                : "bg-green-500/15 text-green-300",
            ].join(" ")}
          >
            {isMutedState ? "Muted" : "Mic on"}
          </span>

          <span
            className={[
              "rounded-full px-2 py-1",
              isVideoExpected && isCameraOn
                ? "bg-green-500/15 text-green-300"
                : "bg-white/10 text-white/60",
            ].join(" ")}
          >
            {isVideoExpected
              ? isCameraOn
                ? "Camera on"
                : "Camera off"
              : "Audio only"}
          </span>
        </div>
      </div>
    </div>
  );
}

function getGridClass(count: number, pinned: boolean) {
  if (pinned) {
    return "grid gap-4 md:grid-cols-2 xl:grid-cols-3";
  }

  if (count <= 1) return "grid gap-4 grid-cols-1";
  if (count === 2) return "grid gap-4 md:grid-cols-2";
  if (count <= 4) return "grid gap-4 md:grid-cols-2";
  if (count <= 6) return "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";
  if (count <= 9) return "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
  return "grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4";
}

export default function MeetingRoomPage() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [meeting, setMeeting] = useState<MeetingWithParticipants | null>(null);
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);

  const media = useMeetingMedia(meeting?.meeting_type ?? "video");

  const {
    rtcService,
    localStream,
    remoteStreams,
    isMuted,
    isCameraOn,
    isScreenSharing,
    error: mediaError,
    initializeLocalMedia,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    registerRemoteStream,
    removeRemoteStream,
    cleanup: cleanupMedia,
  } = media;

  const signalCleanupRef = useRef<null | (() => void)>(null);
  const realtimeCleanupRef = useRef<null | (() => void)>(null);
  const joinedRef = useRef(false);
  const offeredPeersRef = useRef<Set<string>>(new Set());

  const participants = useMemo(
    () => meeting?.participants ?? [],
    [meeting?.participants],
  );

  const activeParticipants = useMemo(() => {
    const seen = new Set<string>();

    return participants.filter((participant) => {
      if (!participant.user_id) return false;
      if (!participant.joined_at) return false;
      if (participant.left_at) return false;
      if (seen.has(participant.user_id)) return false;

      seen.add(participant.user_id);
      return true;
    });
  }, [participants]);

  const otherParticipants = useMemo(
    () =>
      activeParticipants.filter(
        (participant) => participant.user_id !== user?.id,
      ),
    [activeParticipants, user?.id],
  );

  const remoteLabelMap = useMemo(
    () =>
      new Map(
        otherParticipants.map((participant) => [
          participant.user_id,
          getParticipantLabel(participant),
        ]),
      ),
    [otherParticipants],
  );

  const remoteParticipantMap = useMemo(
    () =>
      new Map(
        otherParticipants.map((participant) => [
          participant.user_id,
          participant,
        ]),
      ),
    [otherParticipants],
  );

  const remoteTiles = useMemo(() => {
    return otherParticipants.map((participant) => {
      const streamRecord =
        remoteStreams.find((remote) => remote.userId === participant.user_id) ??
        null;

      return {
        userId: participant.user_id,
        label: getParticipantLabel(participant),
        participant,
        stream: streamRecord?.stream ?? null,
      };
    });
  }, [otherParticipants, remoteStreams]);

  const pinnedTile = useMemo(() => {
    if (!pinnedUserId) return null;
    return remoteTiles.find((tile) => tile.userId === pinnedUserId) ?? null;
  }, [pinnedUserId, remoteTiles]);

  const unpinnedTiles = useMemo(() => {
    return remoteTiles.filter((tile) => tile.userId !== pinnedUserId);
  }, [remoteTiles, pinnedUserId]);

  const joinLink = useMemo(() => {
    if (typeof window === "undefined" || !meetingId) return "";
    return `${window.location.origin}/meetings/${meetingId}`;
  }, [meetingId]);

  const isHost = meeting?.host_id === user?.id;

  useEffect(() => {
    if (!meetingId || !user?.id || joinedRef.current) return;

    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        setError("");

        joinedRef.current = true;

        await joinMeeting({
          meetingId,
          userId: user.id,
        });

        const [meetingData, messageData] = await Promise.all([
          getMeetingById(meetingId),
          getMeetingMessages(meetingId),
        ]);

        if (cancelled) return;

        if (!meetingData) {
          throw new Error("Meeting room not found.");
        }

        if (
          meetingData.status === "ended" ||
          meetingData.status === "cancelled"
        ) {
          throw new Error("This meeting has already ended.");
        }

        setMeeting(meetingData);
        setMessages(messageData);

        await initializeLocalMedia();
      } catch (err: unknown) {
        console.error(err);
        const message =
          err instanceof Error ? err.message : "Failed to load meeting room.";
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;

      if (meetingId && user?.id) {
        void leaveMeeting({ meetingId, userId: user.id });
      }

      if (signalCleanupRef.current) {
        signalCleanupRef.current();
        signalCleanupRef.current = null;
      }

      if (realtimeCleanupRef.current) {
        realtimeCleanupRef.current();
        realtimeCleanupRef.current = null;
      }

      offeredPeersRef.current.clear();
      cleanupMedia();
      joinedRef.current = false;
    };
  }, [meetingId, user?.id, initializeLocalMedia, cleanupMedia]);

  useEffect(() => {
    if (!meetingId) return;

    if (realtimeCleanupRef.current) {
      realtimeCleanupRef.current();
      realtimeCleanupRef.current = null;
    }

    realtimeCleanupRef.current = subscribeToMeetingRoom({
      meetingId,
      onMeetingChange: (nextMeeting) => {
        setMeeting(nextMeeting);

        if (
          nextMeeting &&
          (nextMeeting.status === "ended" || nextMeeting.status === "cancelled")
        ) {
          setError("This meeting has ended.");
          cleanupMedia();
          offeredPeersRef.current.clear();
          navigate("/meetings");
        }
      },
      onMessagesChange: (nextMessages) => {
        setMessages(nextMessages);
      },
      onMeetingEnded: () => {
        setError("This meeting has ended.");
        cleanupMedia();
        offeredPeersRef.current.clear();
        navigate("/meetings");
      },
      onError: (message) => {
        setError(message);
      },
    });

    return () => {
      if (realtimeCleanupRef.current) {
        realtimeCleanupRef.current();
        realtimeCleanupRef.current = null;
      }
    };
  }, [meetingId, cleanupMedia, navigate]);

  useEffect(() => {
    if (!meetingId || !user?.id || !localStream || !meeting || !rtcService) {
      return;
    }

    if (signalCleanupRef.current) {
      signalCleanupRef.current();
      signalCleanupRef.current = null;
    }

    signalCleanupRef.current = subscribeToMeetingSignals({
      meetingId,
      currentUserId: user.id,
      onSignal: async (signal) => {
        try {
          const senderId = signal.sender_id;

          rtcService.createPeerConnection(senderId, {
            onIceCandidate: async (candidate) => {
              await sendMeetingSignal({
                meetingId,
                senderId: user.id,
                receiverId: senderId,
                signalType: "ice-candidate",
                payload: candidate.toJSON(),
              });
            },
            onTrack: (stream) => {
              registerRemoteStream(senderId, stream);
            },
            onConnectionStateChange: (state) => {
              if (
                state === "disconnected" ||
                state === "closed" ||
                state === "failed"
              ) {
                removeRemoteStream(senderId);
                offeredPeersRef.current.delete(senderId);
              }
            },
          });

          if (signal.signal_type === "offer") {
            const answer = await rtcService.handleOffer(
              senderId,
              signal.payload as RTCSessionDescriptionInit,
            );

            await sendMeetingSignal({
              meetingId,
              senderId: user.id,
              receiverId: senderId,
              signalType: "answer",
              payload: answer,
            });
          } else if (signal.signal_type === "answer") {
            await rtcService.handleAnswer(
              senderId,
              signal.payload as RTCSessionDescriptionInit,
            );
          } else if (signal.signal_type === "ice-candidate") {
            await rtcService.addIceCandidate(
              senderId,
              signal.payload as RTCIceCandidateInit,
            );
          }
        } catch (err) {
          console.error("SIGNAL HANDLE ERROR:", err);
        }
      },
    });

    return () => {
      if (signalCleanupRef.current) {
        signalCleanupRef.current();
        signalCleanupRef.current = null;
      }
    };
  }, [
    meetingId,
    user?.id,
    localStream,
    meeting,
    rtcService,
    registerRemoteStream,
    removeRemoteStream,
  ]);

  useEffect(() => {
    if (
      !meetingId ||
      !user?.id ||
      !localStream ||
      otherParticipants.length === 0 ||
      !rtcService
    ) {
      return;
    }

    void (async () => {
      for (const participant of otherParticipants) {
        const peerUserId = participant.user_id;

        if (
          offeredPeersRef.current.has(peerUserId) ||
          rtcService.hasPeer(peerUserId)
        ) {
          continue;
        }

        try {
          rtcService.createPeerConnection(peerUserId, {
            onIceCandidate: async (candidate) => {
              await sendMeetingSignal({
                meetingId,
                senderId: user.id,
                receiverId: peerUserId,
                signalType: "ice-candidate",
                payload: candidate.toJSON(),
              });
            },
            onTrack: (stream) => {
              registerRemoteStream(peerUserId, stream);
            },
            onConnectionStateChange: (state) => {
              if (
                state === "disconnected" ||
                state === "closed" ||
                state === "failed"
              ) {
                removeRemoteStream(peerUserId);
                offeredPeersRef.current.delete(peerUserId);
              }
            },
          });

          const offer = await rtcService.createOffer(peerUserId);

          await sendMeetingSignal({
            meetingId,
            senderId: user.id,
            receiverId: peerUserId,
            signalType: "offer",
            payload: offer,
          });

          offeredPeersRef.current.add(peerUserId);
        } catch (err) {
          console.error("OFFER SEND ERROR:", err);
        }
      }
    })();
  }, [
    meetingId,
    user?.id,
    localStream,
    otherParticipants,
    rtcService,
    registerRemoteStream,
    removeRemoteStream,
  ]);

  useEffect(() => {
    const activeRemoteIds = new Set(otherParticipants.map((p) => p.user_id));

    remoteStreams.forEach((remote) => {
      if (!activeRemoteIds.has(remote.userId)) {
        removeRemoteStream(remote.userId);
        offeredPeersRef.current.delete(remote.userId);
      }
    });

    if (pinnedUserId && !activeRemoteIds.has(pinnedUserId)) {
      setPinnedUserId(null);
    }
  }, [otherParticipants, remoteStreams, removeRemoteStream, pinnedUserId]);

  async function handleToggleMute() {
    if (!meetingId || !user?.id) return;

    try {
      const nextMuted = toggleMute();

      await updateMeetingMediaState({
        meetingId,
        userId: user.id,
        isMuted: nextMuted,
      });
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to update microphone.";
      setError(message);
    }
  }

  async function handleToggleCamera() {
    if (!meetingId || !user?.id) return;

    try {
      const nextCameraOn = toggleCamera();

      await updateMeetingMediaState({
        meetingId,
        userId: user.id,
        isCameraOn: nextCameraOn,
      });
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to update camera.";
      setError(message);
    }
  }

  async function handleToggleScreenShare() {
    try {
      if (isScreenSharing) {
        await stopScreenShare();
        return;
      }

      await startScreenShare();
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to toggle screen share.";
      setError(message);
    }
  }

  async function handleSendMessage() {
    if (!meetingId || !user?.id || !chatInput.trim()) return;

    try {
      setSending(true);

      const created = await sendMeetingMessage({
        meetingId,
        senderId: user.id,
        body: chatInput,
      });

      if (created) {
        setMessages((current) => {
          const exists = current.some((item) => item.id === created.id);
          return exists ? current : [...current, created];
        });
      }

      setChatInput("");
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to send meeting message.";
      setError(message);
    } finally {
      setSending(false);
    }
  }

  async function handleLeaveMeeting() {
    if (!meetingId || !user?.id) return;

    try {
      await leaveMeeting({
        meetingId,
        userId: user.id,
      });

      if (signalCleanupRef.current) {
        signalCleanupRef.current();
        signalCleanupRef.current = null;
      }

      if (realtimeCleanupRef.current) {
        realtimeCleanupRef.current();
        realtimeCleanupRef.current = null;
      }

      cleanupMedia();
      offeredPeersRef.current.clear();
      joinedRef.current = false;

      navigate("/meetings");
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to leave meeting.";
      setError(message);
    }
  }

  async function handleEndMeeting() {
    if (!meetingId || !user?.id || meeting?.host_id !== user.id) return;

    try {
      await endMeeting(meetingId);

      if (signalCleanupRef.current) {
        signalCleanupRef.current();
        signalCleanupRef.current = null;
      }

      if (realtimeCleanupRef.current) {
        realtimeCleanupRef.current();
        realtimeCleanupRef.current = null;
      }

      cleanupMedia();
      offeredPeersRef.current.clear();
      joinedRef.current = false;

      navigate("/meetings");
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to end meeting.";
      setError(message);
    }
  }

  async function handleCopyJoinLink() {
    if (!joinLink) return;

    try {
      await navigator.clipboard.writeText(joinLink);
    } catch (err) {
      console.error("COPY LINK ERROR:", err);
    }
  }

  if (loading) {
    return (
      <div className="border border-white/10 bg-black px-6 py-8 text-sm text-white/50">
        Loading meeting room...
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="border border-red-500/20 bg-red-500/10 px-6 py-8 text-sm text-red-300">
        Meeting room not found or unavailable.
      </div>
    );
  }

  return (
    <div className="min-h-full bg-black text-white">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-5">
          <div className="border border-white/10 bg-black px-6 py-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-orange-300">
                  {meeting.meeting_type === "video"
                    ? "Video room"
                    : "Audio room"}
                </div>

                <h1 className="mt-4 text-3xl font-bold">
                  {meeting.title || "Meeting room"}
                </h1>

                <p className="mt-2 text-sm leading-6 text-white/45">
                  {meeting.description || "Live team collaboration room"}
                </p>
              </div>

              <div className="space-y-3">
                <div className="border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white/55">
                  Room code:{" "}
                  <span className="font-semibold text-white">
                    {meeting.room_code}
                  </span>
                </div>

                <div className="flex items-center gap-2 border border-white/10 bg-neutral-950 px-3 py-3">
                  <input
                    value={joinLink}
                    readOnly
                    className="w-[220px] bg-transparent text-xs text-white/60 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCopyJoinLink()}
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-black hover:bg-orange-400"
                  >
                    <Copy size={14} />
                    Copy link
                  </button>
                </div>
              </div>
            </div>
          </div>

          {error || mediaError ? (
            <div className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error || mediaError}
            </div>
          ) : null}

          <div className="space-y-4">
            {pinnedTile ? (
              <ParticipantTile
                label={pinnedTile.label}
                stream={pinnedTile.stream}
                badge="Pinned"
                isPinned
                canManage={isHost}
                isVideoExpected={meeting.meeting_type === "video"}
                isCameraOn={pinnedTile.participant.is_camera_on}
                isMutedState={pinnedTile.participant.is_muted}
                onTogglePin={() => setPinnedUserId(null)}
              />
            ) : null}

            <div
              className={getGridClass(
                (pinnedTile ? unpinnedTiles.length : remoteTiles.length) + 1,
                !!pinnedTile,
              )}
            >
              <ParticipantTile
                label="You"
                stream={localStream}
                muted
                badge={isScreenSharing ? "Sharing" : "Local"}
                isVideoExpected={meeting.meeting_type === "video"}
                isCameraOn={isCameraOn}
                isMutedState={isMuted}
              />

              {(pinnedTile ? unpinnedTiles : remoteTiles).map((tile) => (
                <ParticipantTile
                  key={tile.userId}
                  label={tile.label}
                  stream={tile.stream}
                  badge="Remote"
                  canManage={isHost}
                  isHost={meeting.host_id === tile.userId}
                  isVideoExpected={meeting.meeting_type === "video"}
                  isCameraOn={tile.participant.is_camera_on}
                  isMutedState={tile.participant.is_muted}
                  onTogglePin={() =>
                    setPinnedUserId((current) =>
                      current === tile.userId ? null : tile.userId,
                    )
                  }
                />
              ))}

              {remoteTiles.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center border border-white/10 bg-neutral-950 text-sm text-white/35">
                  Waiting for participants to join
                </div>
              ) : null}
            </div>
          </div>

          <div className="border border-white/10 bg-black p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <button
                type="button"
                onClick={() => void handleToggleMute()}
                className={[
                  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                  isMuted
                    ? "bg-red-500 text-white hover:bg-red-400"
                    : "border border-white/10 bg-neutral-950 text-white hover:border-orange-500/30 hover:bg-orange-500/5",
                ].join(" ")}
              >
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                {isMuted ? "Unmute" : "Mute"}
              </button>

              {meeting.meeting_type === "video" ? (
                <button
                  type="button"
                  onClick={() => void handleToggleCamera()}
                  className={[
                    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                    !isCameraOn
                      ? "bg-red-500 text-white hover:bg-red-400"
                      : "border border-white/10 bg-neutral-950 text-white hover:border-orange-500/30 hover:bg-orange-500/5",
                  ].join(" ")}
                >
                  {isCameraOn ? <Video size={16} /> : <VideoOff size={16} />}
                  {isCameraOn ? "Stop camera" : "Start camera"}
                </button>
              ) : (
                <div className="border border-white/10 bg-neutral-950 px-4 py-3 text-center text-sm text-white/35">
                  Audio only
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleToggleScreenShare()}
                className={[
                  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                  isScreenSharing
                    ? "bg-orange-500 text-black hover:bg-orange-400"
                    : "border border-white/10 bg-neutral-950 text-white hover:border-orange-500/30 hover:bg-orange-500/5",
                ].join(" ")}
              >
                <MonitorUp size={16} />
                {isScreenSharing ? "Stop share" : "Share screen"}
              </button>

              {isHost ? (
                <button
                  type="button"
                  onClick={() => void handleEndMeeting()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-400"
                >
                  <PhoneOff size={16} />
                  End meeting
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => void handleLeaveMeeting()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-400"
              >
                <PhoneOff size={16} />
                Leave
              </button>
            </div>
          </div>

          <div className="border border-white/10 bg-black p-5">
            <div className="mb-4 flex items-center gap-2">
              <Users size={18} className="text-orange-400" />
              <h2 className="text-lg font-semibold">
                Participants ({activeParticipants.length})
              </h2>
            </div>

            {activeParticipants.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-4 text-sm text-white/45">
                No participants have joined yet.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {activeParticipants.map((participant) => {
                  const isYou = participant.user_id === user?.id;

                  return (
                    <div
                      key={participant.id}
                      className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {getParticipantLabel(participant)}
                            {isYou ? (
                              <span className="ml-2 text-xs text-orange-400">
                                (You)
                              </span>
                            ) : null}
                          </p>

                          <p className="mt-1 text-xs uppercase tracking-[0.15em] text-white/45">
                            {participant.role}
                          </p>
                        </div>

                        <span className="rounded-full bg-green-500/15 px-2 py-1 text-[11px] font-medium text-green-300">
                          Joined
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                        <span
                          className={[
                            "rounded-full px-2 py-1",
                            participant.is_muted
                              ? "bg-red-500/15 text-red-300"
                              : "bg-green-500/15 text-green-300",
                          ].join(" ")}
                        >
                          {participant.is_muted ? "Muted" : "Mic on"}
                        </span>

                        <span
                          className={[
                            "rounded-full px-2 py-1",
                            participant.is_camera_on
                              ? "bg-green-500/15 text-green-300"
                              : "bg-white/10 text-white/60",
                          ].join(" ")}
                        >
                          {participant.is_camera_on
                            ? "Camera on"
                            : "Camera off"}
                        </span>
                      </div>

                      <p className="mt-3 text-[11px] text-white/30">
                        Joined:{" "}
                        {participant.joined_at
                          ? new Date(participant.joined_at).toLocaleTimeString()
                          : "Unknown"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col border border-white/10 bg-black p-4">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-lg font-semibold">Meeting chat</h2>
            <p className="mt-1 text-sm text-white/45">
              Share quick updates during the session
            </p>
          </div>

          <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-neutral-950 p-4 text-sm text-white/45">
                No messages yet.
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3"
                >
                  <p className="text-xs font-semibold text-orange-400">
                    {message.sender?.full_name ||
                      message.sender?.email ||
                      "User"}
                  </p>
                  <p className="mt-1 text-sm text-white">{message.body}</p>
                  <p className="mt-2 text-[11px] text-white/30">
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2">
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-orange-500"
              />
              <button
                type="button"
                onClick={() => void handleSendMessage()}
                disabled={!chatInput.trim() || sending}
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:opacity-50"
              >
                <SendHorizontal size={16} />
                Send
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

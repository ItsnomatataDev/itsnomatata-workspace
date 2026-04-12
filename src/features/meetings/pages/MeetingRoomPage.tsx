import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  SendHorizontal,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useLocalParticipant,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-core";
import { Track } from "livekit-client";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../lib/hooks/useAuth";
import { supabase } from "../../../lib/supabase/client";
import {
  endMeeting,
  getMeetingById,
  getMeetingMessages,
  joinMeeting,
  leaveMeeting,
  sendMeetingMessage,
} from "../services/meetingService";
import { subscribeToMeetingRoom } from "../services/meetingRealtime";
import { getMeetingLivekitToken } from "../services/meetingLivekitService";
import type {
  MeetingMessage,
  MeetingParticipant,
  MeetingWithParticipants,
} from "../types/meeting";

type LivekitSession = {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  name: string;
};

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

function getGridClass(count: number) {
  if (count <= 1) return "grid gap-4 grid-cols-1";
  if (count === 2) return "grid gap-4 md:grid-cols-2";
  if (count <= 4) return "grid gap-4 md:grid-cols-2";
  if (count <= 6) return "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";
  if (count <= 9) return "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
  return "grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4";
}

function hasPublication(
  trackRef: TrackReferenceOrPlaceholder,
): trackRef is Extract<TrackReferenceOrPlaceholder, { publication: unknown }> {
  return "publication" in trackRef && !!trackRef.publication;
}

function isPlaceholderTrack(trackRef: TrackReferenceOrPlaceholder): boolean {
  return !hasPublication(trackRef);
}

function LivekitParticipantGrid() {
  const cameraTracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);

  const screenTracks = useTracks([
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const allTracks = useMemo(() => {
    const seen = new Set<string>();
    const ordered = [...screenTracks, ...cameraTracks];

    return ordered.filter((trackRef) => {
      const key = `${trackRef.participant.identity}:${trackRef.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [cameraTracks, screenTracks]);

  return (
    <div className={getGridClass(allTracks.length || 1)}>
      {allTracks.length === 0 ? (
        <div className="flex min-h-55 items-center justify-center border border-white/10 bg-neutral-950 text-sm text-white/35">
          Waiting for participants to join
        </div>
      ) : (
        allTracks.map((trackRef) => {
          const participantName =
            trackRef.participant.name ||
            trackRef.participant.identity ||
            "Participant";

          const isScreenShare = trackRef.source === Track.Source.ScreenShare;
          const isPlaceholder = isPlaceholderTrack(trackRef);

          return (
            <div
              key={`${trackRef.participant.identity}:${trackRef.source}`}
              className="group relative min-h-55 overflow-hidden border border-white/10 bg-neutral-950 text-white"
            >
              <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                    {participantName}
                  </span>

                  {isScreenShare ? (
                    <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-300">
                      Sharing
                    </span>
                  ) : null}

                  {trackRef.participant.isLocal ? (
                    <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80">
                      You
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex h-full min-h-55 items-center justify-center bg-black">
                {!hasPublication(trackRef) ? (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-black">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-2xl font-semibold text-orange-400">
                      {getInitials(participantName)}
                    </div>
                    <p className="mt-4 text-sm text-white/45">Camera off</p>
                  </div>
                ) : (
                  <VideoTrack
                    trackRef={trackRef}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 bg-linear-to-t from-black/90 to-transparent p-3">
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span
                    className={[
                      "rounded-full px-2 py-1",
                      trackRef.participant.isMicrophoneEnabled
                        ? "bg-green-500/15 text-green-300"
                        : "bg-red-500/15 text-red-300",
                    ].join(" ")}
                  >
                    {trackRef.participant.isMicrophoneEnabled
                      ? "Mic on"
                      : "Muted"}
                  </span>

                  <span
                    className={[
                      "rounded-full px-2 py-1",
                      isScreenShare || trackRef.participant.isCameraEnabled
                        ? "bg-green-500/15 text-green-300"
                        : "bg-white/10 text-white/60",
                    ].join(" ")}
                  >
                    {isScreenShare
                      ? "Screen share"
                      : trackRef.participant.isCameraEnabled
                        ? "Camera on"
                        : "Camera off"}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function LivekitMeetingControls({
  onLeave,
  onEndMeeting,
  isHost,
}: {
  onLeave: () => Promise<void> | void;
  onEndMeeting?: () => Promise<void> | void;
  isHost: boolean;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [busy, setBusy] = useState<"" | "mic" | "camera" | "screen">("");

  const isMuted = !localParticipant.isMicrophoneEnabled;
  const isCameraOn = localParticipant.isCameraEnabled;
  const isScreenSharing = localParticipant.isScreenShareEnabled;

  async function toggleMic() {
    try {
      setBusy("mic");
      await localParticipant.setMicrophoneEnabled(
        !localParticipant.isMicrophoneEnabled,
      );
    } finally {
      setBusy("");
    }
  }

  async function toggleCamera() {
    try {
      setBusy("camera");
      await localParticipant.setCameraEnabled(
        !localParticipant.isCameraEnabled,
      );
    } finally {
      setBusy("");
    }
  }

  async function toggleScreenShare() {
    try {
      setBusy("screen");
      await localParticipant.setScreenShareEnabled(
        !localParticipant.isScreenShareEnabled,
      );
    } finally {
      setBusy("");
    }
  }

  async function handleLeave() {
    await room.disconnect();
    await onLeave();
  }

  async function handleEndMeeting() {
    await room.disconnect();
    await onEndMeeting?.();
  }

  return (
    <div className="border border-white/10 bg-black p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => void toggleMic()}
          disabled={busy === "mic"}
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

        <button
          type="button"
          onClick={() => void toggleCamera()}
          disabled={busy === "camera"}
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

        <button
          type="button"
          onClick={() => void toggleScreenShare()}
          disabled={busy === "screen"}
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
          onClick={() => void handleLeave()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-400"
        >
          <PhoneOff size={16} />
          Leave
        </button>
      </div>
    </div>
  );
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
  const [livekitSession, setLivekitSession] = useState<LivekitSession | null>(
    null,
  );

  const realtimeCleanupRef = useRef<null | (() => void)>(null);
  const joinedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  const joinLink = useMemo(() => {
    if (typeof window === "undefined" || !meetingId) return "";
    return `${window.location.origin}/meetings/${meetingId}`;
  }, [meetingId]);

  const isHost = meeting?.host_id === user?.id;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

      if (realtimeCleanupRef.current) {
        realtimeCleanupRef.current();
        realtimeCleanupRef.current = null;
      }

      joinedRef.current = false;
    };
  }, [meetingId, user?.id]);

  useEffect(() => {
    if (!meetingId || !meeting || !user?.id) return;

    let cancelled = false;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      console.log("SESSION DEBUG:", session);

      if (!session?.access_token) {
        console.warn("NO SESSION → skipping LiveKit request");
        return;
      }

      try {
        const sessionResult = await getMeetingLivekitToken(meetingId);

        if (cancelled) return;

        console.log("LIVEKIT SESSION:", sessionResult);
        setLivekitSession(sessionResult);
      } catch (err) {
        console.error("LIVEKIT SESSION FETCH FAILED:", err);

        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Failed to connect to meeting media.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [meetingId, meeting, user?.id]);

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
          navigate("/meetings");
        }
      },
      onMessagesChange: (nextMessages) => {
        setMessages(nextMessages);
      },
      onMeetingEnded: () => {
        setError("This meeting has ended.");
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
  }, [meetingId, navigate]);

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

      if (realtimeCleanupRef.current) {
        realtimeCleanupRef.current();
        realtimeCleanupRef.current = null;
      }

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

      if (realtimeCleanupRef.current) {
        realtimeCleanupRef.current();
        realtimeCleanupRef.current = null;
      }

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
                    className="w-55 bg-transparent text-xs text-white/60 outline-none"
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

          {error ? (
            <div className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <div className="border border-white/10 bg-black p-4">
            {!livekitSession ? (
              <div className="flex min-h-[420px] items-center justify-center text-white/40">
                Connecting to meeting media...
              </div>
            ) : (
              <div data-lk-theme="default" className="min-h-[420px]">
                <LiveKitRoom
                  token={livekitSession.token}
                  serverUrl={livekitSession.url}
                  connect={true}
                  audio={true}
                  video={meeting.meeting_type === "video"}
                  className="space-y-4"
                  onError={(err) => {
                    console.error("LIVEKIT ROOM ERROR:", err);
                    setError(
                      err.message || "Failed to connect to LiveKit room.",
                    );
                  }}
                >
                  <RoomAudioRenderer />
                  <StartAudio label="Enable audio" />
                  <LivekitParticipantGrid />
                  <LivekitMeetingControls
                    isHost={!!isHost}
                    onLeave={handleLeaveMeeting}
                    onEndMeeting={handleEndMeeting}
                  />
                </LiveKitRoom>
              </div>
            )}
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
              messages.map((message) => {
                const isMe = message.sender_id === user?.id;

                return (
                  <div
                    key={message.id}
                    className={[
                      "max-w-[88%] rounded-2xl px-4 py-3",
                      isMe
                        ? "ml-auto bg-orange-500 text-black"
                        : "border border-white/10 bg-neutral-950 text-white",
                    ].join(" ")}
                  >
                    <p
                      className={[
                        "text-xs font-semibold",
                        isMe ? "text-black/70" : "text-orange-400",
                      ].join(" ")}
                    >
                      {isMe
                        ? "You"
                        : message.sender?.full_name ||
                          message.sender?.email ||
                          "User"}
                    </p>
                    <p className="mt-1 text-sm">{message.body}</p>
                    <p
                      className={[
                        "mt-2 text-[11px]",
                        isMe ? "text-black/60" : "text-white/30",
                      ].join(" ")}
                    >
                      {new Date(message.created_at).toLocaleString()}
                    </p>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2">
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSendMessage();
                  }
                }}
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

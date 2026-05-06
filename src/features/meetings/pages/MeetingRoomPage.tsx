import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  MessageSquare,
  Radio,
  SendHorizontal,
  Users,
  X,
} from "lucide-react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
} from "@livekit/components-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../lib/hooks/useAuth";
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
import LivekitParticipantGrid from "../components/LivekitParticipantGrid";
import LivekitMeetingControls from "../components/LivekitMeetingControls";
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
  const [chatOpen, setChatOpen] = useState(true);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const realtimeCleanupRef = useRef<null | (() => void)>(null);
  const joinedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(0);

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
    if (chatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnreadMessages(0);
    }
  }, [messages, chatOpen]);

  useEffect(() => {
    const previousCount = previousMessageCountRef.current;

    if (!chatOpen && messages.length > previousCount) {
      setUnreadMessages(
        (current) => current + (messages.length - previousCount),
      );
    }

    previousMessageCountRef.current = messages.length;
  }, [messages.length, chatOpen]);

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
      setLivekitSession(null);
    };
  }, [meetingId, user?.id]);

  useEffect(() => {
    if (!meetingId || !meeting?.id || !user?.id || livekitSession) return;

    let cancelled = false;

    void (async () => {
      try {
        const sessionResult = await getMeetingLivekitToken(meetingId);

        if (cancelled) return;

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
  }, [meetingId, meeting?.id, user?.id, livekitSession]);

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
      setLivekitSession(null);
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
      setLivekitSession(null);
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
      <div className="flex min-h-[60vh] items-center justify-center bg-black text-white">
        <div className="rounded-3xl border border-white/10 bg-neutral-950 px-8 py-6 text-center shadow-2xl shadow-black/40">
          <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full bg-orange-500/20" />
          <p className="text-sm text-white/50">Loading meeting room...</p>
        </div>
      </div>
    );
  }

  if (!meeting || !meetingId || !user?.id) {
    return (
      <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-6 py-8 text-sm text-red-300">
        Meeting room not found or unavailable.
      </div>
    );
  }

  return (
    <div className="min-h-full bg-black text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_30%)]" />

      <div className="relative grid gap-5 p-3 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-6 xl:p-0">
        <section className="space-y-5">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/80 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="border-b border-white/10 bg-white/3 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-orange-300">
                    <Radio size={14} />
                    {meeting.meeting_type === "video"
                      ? "Live video room"
                      : "Live audio room"}
                  </div>

                  <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-4xl">
                    {meeting.title || "Meeting room"}
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
                    {meeting.description || "Live team collaboration room"}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/45">
                    <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
                      {activeParticipants.length} active participant
                      {activeParticipants.length === 1 ? "" : "s"}
                    </span>

                    {isHost ? (
                      <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-orange-300">
                        You are host
                      </span>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setParticipantsOpen((current) => !current)}
                      className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-white/55 transition hover:border-orange-500/30 hover:text-orange-300"
                    >
                      {participantsOpen
                        ? "Hide participants"
                        : "Show participants"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setChatOpen((current) => !current);
                        setUnreadMessages(0);
                      }}
                      className="relative rounded-full border border-white/10 bg-black/40 px-3 py-1 text-white/55 transition hover:border-orange-500/30 hover:text-orange-300 xl:hidden"
                    >
                      {chatOpen ? "Hide chat" : "Show chat"}
                      {unreadMessages > 0 ? (
                        <span className="absolute -right-2 -top-2 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-black">
                          {unreadMessages}
                        </span>
                      ) : null}
                    </button>
                  </div>
                </div>

                <div className="space-y-3 xl:w-90">
                  <div className="rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white/55">
                    Room code:{" "}
                    <span className="font-semibold text-white">
                      {meeting.room_code}
                    </span>
                  </div>

                  <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/50 px-3 py-3">
                    <input
                      value={joinLink}
                      readOnly
                      className="min-w-0 flex-1 bg-transparent text-xs text-white/60 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleCopyJoinLink()}
                      className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-black transition hover:bg-orange-400"
                    >
                      <Copy size={14} />
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {error ? (
              <div className="mx-5 mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300 sm:mx-6">
                {error}
              </div>
            ) : null}

            <div className="p-3 sm:p-5">
              {!livekitSession ? (
                <div className="flex min-h-80 items-center justify-center rounded-3xl border border-white/10 bg-black/60 text-white/40 sm:min-h-130">
                  Connecting to meeting media...
                </div>
              ) : (
                <div
                  data-lk-theme="default"
                  className="min-h-80 sm:min-h-130"
                >
                  <LiveKitRoom
                    key={livekitSession.roomName}
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
                      meetingId={meetingId}
                      userId={user.id}
                      isHost={!!isHost}
                      onLeave={handleLeaveMeeting}
                      onEndMeeting={handleEndMeeting}
                    />
                  </LiveKitRoom>
                </div>
              )}
            </div>
          </div>

          {participantsOpen ? (
            <div className="rounded-3xl border border-white/10 bg-neutral-950/80 p-5 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="mb-4 flex items-center gap-2">
                <Users size={18} className="text-orange-400" />
                <h2 className="text-lg font-semibold">
                  Participants ({activeParticipants.length})
                </h2>
              </div>

              {activeParticipants.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-white/45">
                  No participants have joined yet.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {activeParticipants.map((participant) => {
                    const isYou = participant.user_id === user.id;
                    const label = getParticipantLabel(participant);

                    return (
                      <div
                        key={participant.id}
                        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-sm font-bold text-orange-300">
                            {getInitials(label)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {label}
                              {isYou ? (
                                <span className="ml-2 text-xs text-orange-400">
                                  (You)
                                </span>
                              ) : null}
                            </p>

                            <p className="mt-1 text-xs uppercase tracking-[0.15em] text-white/35">
                              {participant.role}
                            </p>

                            <p className="mt-2 text-[11px] text-white/30">
                              Joined:{" "}
                              {participant.joined_at
                                ? new Date(
                                    participant.joined_at,
                                  ).toLocaleTimeString()
                                : "Unknown"}
                            </p>
                          </div>

                          <span className="rounded-full bg-green-500/15 px-2 py-1 text-[11px] font-medium text-green-300">
                            Live
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </section>

        {chatOpen ? (
          <aside className="flex max-h-[80dvh] min-h-96 flex-col rounded-3xl border border-white/10 bg-neutral-950/80 p-4 shadow-2xl shadow-black/30 backdrop-blur xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)]">
            <div className="border-b border-white/10 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-orange-400" />
                  <h2 className="text-lg font-semibold">Meeting chat</h2>
                </div>

                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  className="rounded-full border border-white/10 bg-black/40 p-2 text-white/50 transition hover:text-white xl:hidden"
                >
                  <X size={15} />
                </button>
              </div>

              <p className="mt-1 text-sm text-white/45">
                Share quick updates during the session
              </p>
            </div>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/45">
                  No messages yet.
                </div>
              ) : (
                messages.map((message) => {
                  const isMe = message.sender_id === user.id;

                  return (
                    <div
                      key={message.id}
                      className={[
                        "max-w-[88%] rounded-2xl px-4 py-3 shadow-lg",
                        isMe
                          ? "ml-auto bg-orange-500 text-black"
                          : "border border-white/10 bg-black/50 text-white",
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

                      <p className="mt-1 text-sm leading-5">{message.body}</p>

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
                  className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-orange-500"
                />

                <button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  disabled={!chatInput.trim() || sending}
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:opacity-50"
                >
                  <SendHorizontal size={16} />
                </button>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

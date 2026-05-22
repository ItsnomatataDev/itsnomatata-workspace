import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Globe2,
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
import type { RoomOptions } from "livekit-client";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../../../app/providers/AuthProvider";
import {
  endMeeting,
  getMeetingById,
  joinMeeting,
  leaveMeeting,
  updateMeetingGuestAccess,
} from "../services/meetingService";
import { subscribeToMeetingRoom } from "../services/meetingRealtime";
import {
  estimateConnectionQuality,
  getOptimalRoomOptions,
} from "../services/meetingMediaService";
import { getLiveKitConnectionErrorMessage } from "../utils/livekitErrors";
import { useLivekitRoom } from "../hooks/useLivekitRoom";
import { useLivekitToken } from "../hooks/useLivekitToken";
import { useMeetingChat } from "../hooks/useMeetingChat";
import { useMeetingModeration } from "../hooks/useMeetingModeration";
import LivekitParticipantGrid from "../components/LivekitParticipantGrid";
import LivekitMeetingControls from "../components/LivekitMeetingControls";
import MeetingParticipantList from "../components/MeetingParticipantList";
import MeetingRequestModal from "../components/MeetingRequestModal";
import type {
  MeetingParticipant,
  MeetingWithParticipants,
} from "../types/meeting";

const getLiveKitOptions = (): RoomOptions => {
  const quality = estimateConnectionQuality();
  return getOptimalRoomOptions(quality);
};

export default function MeetingRoomPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [meeting, setMeeting] = useState<MeetingWithParticipants | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [error, setError] = useState("");
  const [chatOpen, setChatOpen] = useState(true);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const roomOptions = useMemo(() => getLiveKitOptions(), []);

  const {
    messages,
    loading: chatLoading,
    sending: chatSending,
    error: chatError,
    isConnected: chatConnected,
    sendMessage,
    clearError: clearChatError,
  } = useMeetingChat({ meetingId: meetingId ?? "" });

  const isHost = meeting?.host_id === user?.id;

  const {
    currentRequest,
    hasPendingRequest,
    onRequestHandled,
  } = useMeetingModeration({
    meetingId: meetingId ?? "",
    isHost,
  });

  const realtimeCleanupRef = useRef<null | (() => void)>(null);
  const joinedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(0);

  const participants = useMemo<MeetingParticipant[]>(
    () => meeting?.participants ?? [],
    [meeting?.participants],
  );

  const activeParticipants = useMemo(() => {
    const seen = new Set<string>();

    return participants.filter((participant) => {
      if (!participant.user_id || !participant.joined_at || participant.left_at) {
        return false;
      }

      if (seen.has(participant.user_id)) {
        return false;
      }

      seen.add(participant.user_id);
      return true;
    });
  }, [participants]);

  const joinLink = useMemo(() => {
    if (typeof window === "undefined" || !meetingId) return "";
    return `${window.location.origin}/meetings/${meetingId}`;
  }, [meetingId]);

  const guestJoinLink = useMemo(() => {
    if (typeof window === "undefined" || !meeting?.guest_code) return "";
    return `${window.location.origin}/join/${meeting.guest_code}`;
  }, [meeting?.guest_code]);

  const canManageGuests =
    isHost ||
    profile?.primary_role === "admin" ||
    profile?.primary_role === "manager";

  const {
    session: livekitSession,
    loading: livekitTokenLoading,
    error: livekitTokenError,
    clearSession: clearLivekitSession,
  } = useLivekitToken({
    meetingId,
    enabled: Boolean(meeting?.id && user?.id),
  });

  const handleLivekitError = useCallback(
    (err: Error) => {
      console.error("LIVEKIT ROOM ERROR:", err);
      setError(getLiveKitConnectionErrorMessage(err, livekitSession?.url));
    },
    [livekitSession?.url],
  );

  const livekitRoom = useLivekitRoom({
    roomName: livekitSession?.roomName,
    options: roomOptions,
    onError: handleLivekitError,
  });

  useEffect(() => {
    if (livekitTokenError) {
      setError(livekitTokenError);
    }
  }, [livekitTokenError]);

  useEffect(() => {
    if (chatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnreadMessages(0);
    }
  }, [messages, chatOpen]);

  useEffect(() => {
    const previousCount = previousMessageCountRef.current;

    if (!chatOpen && messages.length > previousCount) {
      setUnreadMessages((current) => current + messages.length - previousCount);
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

        await joinMeeting({ meetingId, userId: user.id });

        const meetingData = await getMeetingById(meetingId);

        if (cancelled) return;

        if (!meetingData) {
          throw new Error("Meeting room not found.");
        }

        if (meetingData.status === "ended" || meetingData.status === "cancelled") {
          throw new Error("This meeting has already ended.");
        }

        setMeeting(meetingData);
      } catch (err: unknown) {
        console.error("MEETING ROOM LOAD ERROR:", err);
        setError(err instanceof Error ? err.message : "Failed to load meeting room.");
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

      realtimeCleanupRef.current?.();
      realtimeCleanupRef.current = null;
      joinedRef.current = false;
      clearLivekitSession();
    };
  }, [clearLivekitSession, meetingId, user?.id]);

  useEffect(() => {
    if (!meetingId) return;

    realtimeCleanupRef.current?.();

    realtimeCleanupRef.current = subscribeToMeetingRoom({
      meetingId,
      onMeetingChange: (nextMeeting) => {
        setMeeting(nextMeeting);

        if (nextMeeting && (nextMeeting.status === "ended" || nextMeeting.status === "cancelled")) {
          setError("This meeting has ended.");
          navigate("/meetings");
        }
      },
      onMeetingEnded: () => {
        setError("This meeting has ended.");
        navigate("/meetings");
      },
      onError: setError,
    });

    return () => {
      realtimeCleanupRef.current?.();
      realtimeCleanupRef.current = null;
    };
  }, [meetingId, navigate]);

  async function handleSendMessage() {
    const body = chatInput.trim();

    if (!body || chatSending) return;

    try {
      await sendMessage(body);
      setChatInput("");
      clearChatError();
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err: unknown) {
      console.error("MEETING MESSAGE SEND ERROR:", err);
      setError(err instanceof Error ? err.message : "Failed to send meeting message.");
    }
  }

  async function handleLeaveMeeting() {
    if (!meetingId || !user?.id) return;

    try {
      await leaveMeeting({ meetingId, userId: user.id });

      realtimeCleanupRef.current?.();
      realtimeCleanupRef.current = null;
      joinedRef.current = false;
      clearLivekitSession();

      navigate("/meetings");
    } catch (err: unknown) {
      console.error("LEAVE MEETING ERROR:", err);
      setError(err instanceof Error ? err.message : "Failed to leave meeting.");
    }
  }

  async function handleEndMeeting() {
    if (!meetingId || !user?.id || meeting?.host_id !== user.id) return;

    try {
      await endMeeting(meetingId);

      realtimeCleanupRef.current?.();
      realtimeCleanupRef.current = null;
      joinedRef.current = false;
      clearLivekitSession();

      navigate("/meetings");
    } catch (err: unknown) {
      console.error("END MEETING ERROR:", err);
      setError(err instanceof Error ? err.message : "Failed to end meeting.");
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

  async function handleCopyGuestLink() {
    if (!guestJoinLink) return;

    try {
      await navigator.clipboard.writeText(guestJoinLink);
    } catch (err) {
      console.error("COPY GUEST LINK ERROR:", err);
    }
  }

  async function handleToggleGuestAccess() {
    if (!meetingId || !canManageGuests) return;

    try {
      const next = await updateMeetingGuestAccess({
        meetingId,
        allowGuestAccess: !meeting?.allow_guest_access,
      });

      setMeeting((current) =>
        current
          ? {
              ...current,
              allow_guest_access: next.allow_guest_access,
              guest_code: next.guest_code,
            }
          : current,
      );
    } catch (err: unknown) {
      console.error("GUEST ACCESS UPDATE ERROR:", err);
      setError(err instanceof Error ? err.message : "Failed to update guest access.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-black text-white">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/60">
          Loading meeting room...
        </div>
      </div>
    );
  }

  if (!meeting || !meetingId || !user?.id) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-black p-4 text-white">
        <div className="max-w-md rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">
          {error || "Meeting room could not be loaded."}
        </div>
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
                    {meeting.meeting_type === "video" ? "Live video room" : "Live audio room"}
                  </div>

                  <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-4xl">
                    {meeting.title || "Meeting room"}
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
                    {meeting.description || "Live team collaboration room"}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/45">
                    <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
                      {activeParticipants.length} active participant{activeParticipants.length === 1 ? "" : "s"}
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
                      {participantsOpen ? "Hide participants" : "Show participants"}
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
                    Room code: <span className="font-semibold text-white">{meeting.room_code}</span>
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

                  <div className="rounded-2xl border border-white/10 bg-black/50 px-3 py-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Globe2 size={16} className="text-orange-400" />
                        <span className="text-sm font-semibold text-white">Guest access</span>
                        <span
                          className={[
                            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                            meeting.allow_guest_access
                              ? "border-green-500/20 bg-green-500/10 text-green-300"
                              : "border-white/10 bg-white/5 text-white/40",
                          ].join(" ")}
                        >
                          {meeting.allow_guest_access ? "Enabled" : "Off"}
                        </span>
                      </div>

                      {canManageGuests ? (
                        <button
                          type="button"
                          onClick={() => void handleToggleGuestAccess()}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-orange-500/30 hover:bg-orange-500/10 hover:text-orange-200"
                        >
                          {meeting.allow_guest_access ? "Disable" : "Enable"}
                        </button>
                      ) : null}
                    </div>

                    {meeting.allow_guest_access && guestJoinLink ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <input
                          value={guestJoinLink}
                          readOnly
                          className="min-w-0 flex-1 bg-transparent text-xs text-white/60 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => void handleCopyGuestLink()}
                          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-black transition hover:bg-orange-400"
                        >
                          <Copy size={14} />
                          Copy guest
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs leading-5 text-white/35">
                        Enable this only for meetings where external clients should join without an account.
                      </p>
                    )}
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
                  {livekitTokenLoading
                    ? "Creating secure media token..."
                    : "Connecting to meeting media..."}
                </div>
              ) : (
                <div data-lk-theme="default" data-meeting-media-root="true" className="min-h-80 sm:min-h-130">
                  <LiveKitRoom
                    key={livekitSession.roomName}
                    room={livekitRoom.room}
                    token={livekitSession.token}
                    serverUrl={livekitSession.url}
                    connect
                    audio
                    video={meeting.meeting_type === "video"}
                    className="space-y-4"
                    onConnected={() => setError("")}
                    onError={handleLivekitError}
                    onDisconnected={() => {
                      if (meeting.status !== "ended" && meeting.status !== "cancelled") {
                        console.warn("LIVEKIT ROOM DISCONNECTED");
                      }
                    }}
                  >
                    <RoomAudioRenderer />
                    <StartAudio label="Enable audio" />

                    {livekitRoom.isReconnecting ? (
                      <div className="mb-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                        Reconnecting to meeting media...
                      </div>
                    ) : null}

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
            <div className="rounded-3xl border border-white/10 bg-neutral-950/80 p-4 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-orange-400" />
                  <h2 className="text-lg font-semibold">
                    Participants ({activeParticipants.length})
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setParticipantsOpen(false)}
                  className="rounded-full border border-white/10 bg-black/40 p-2 text-white/50 transition hover:text-white"
                >
                  <X size={15} />
                </button>
              </div>

              <MeetingParticipantList
                participants={activeParticipants}
                meetingId={meetingId}
                isHost={!!isHost}
                onParticipantRemove={(participantId) => {
                  console.log("Participant removed:", participantId);
                }}
              />
            </div>
          ) : null}
        </section>

        {chatOpen ? (
          <aside className="flex max-h-[80dvh] min-h-96 flex-col rounded-3xl border border-white/10 bg-neutral-950/80 p-4 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="border-b border-white/10 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-orange-400" />
                  <h2 className="text-lg font-semibold">Meeting chat</h2>
                </div>

                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  className="rounded-full border border-white/10 bg-black/40 p-2 text-white/50 transition hover:text-white"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="text-sm text-white/45">Share quick updates during the session</p>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                    chatConnected
                      ? "bg-green-500/10 text-green-300"
                      : "bg-white/5 text-white/35",
                  ].join(" ")}
                >
                  {chatConnected ? "Live" : "Offline"}
                </span>
              </div>

              {chatError ? (
                <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {chatError}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {chatLoading ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/45">
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
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
                      <p className={["text-xs font-semibold", isMe ? "text-black/70" : "text-orange-400"].join(" ")}>
                        {isMe ? "You" : message.sender?.full_name || message.sender?.email || "User"}
                      </p>

                      <p className="mt-1 text-sm leading-5">{message.body}</p>

                      <p className={["mt-2 text-[11px]", isMe ? "text-black/60" : "text-white/30"].join(" ")}>
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
                  disabled={!chatInput.trim() || chatSending}
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send message"
                >
                  <SendHorizontal size={16} />
                </button>
              </div>
            </div>
          </aside>
        ) : (
          <aside className="hidden xl:block">
            <button
              type="button"
              onClick={() => {
                setChatOpen(true);
                setUnreadMessages(0);
              }}
              className="relative flex w-full items-center justify-center gap-2 rounded-3xl border border-white/10 bg-neutral-950/80 p-4 text-sm font-semibold text-white/70 shadow-2xl shadow-black/30 transition hover:border-orange-500/30 hover:text-orange-300"
            >
              <MessageSquare size={17} />
              Open meeting chat
              {unreadMessages > 0 ? (
                <span className="absolute right-4 top-3 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-black">
                  {unreadMessages}
                </span>
              ) : null}
            </button>
          </aside>
        )}

        {hasPendingRequest && currentRequest ? (
          <MeetingRequestModal
            isOpen={hasPendingRequest}
            onClose={onRequestHandled}
            request={{
              type: currentRequest.type,
              requestId: currentRequest.requestId,
              requestedBy: currentRequest.requestedBy,
              reason: currentRequest.reason,
              hostName: "Meeting Host",
            }}
            meetingId={meetingId}
            participantId={user.id}
            hostId={currentRequest.requestedBy}
          />
        ) : null}
      </div>
    </div>
  );
}

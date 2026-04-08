import { useEffect, useMemo, useRef, useState } from "react";
import {
  Mic,
  MicOff,
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
import {
  sendMeetingSignal,
  subscribeToMeetingSignals,
} from "../services/meetingSignalService";
import type {
  MeetingMessage,
  MeetingParticipant,
  MeetingWithParticipants,
} from "../types/meeting";

function VideoTile({
  label,
  stream,
  muted = false,
  placeholder,
  badge,
}: {
  label: string;
  stream: MediaStream | null;
  muted?: boolean;
  placeholder?: string;
  badge?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="border border-white/10 bg-black p-4 text-white">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="truncate text-sm font-semibold">{label}</p>

        {badge ? (
          <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300">
            {badge}
          </span>
        ) : null}
      </div>

      <div className="flex h-64 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-neutral-950">
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-sm text-white/30">
            {placeholder || "No video"}
          </span>
        )}
      </div>
    </div>
  );
}

function getParticipantLabel(participant: MeetingParticipant) {
  return (
    participant.profile?.full_name ||
    participant.profile?.email ||
    "Unnamed participant"
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

  const media = useMeetingMedia(meeting?.meeting_type ?? "video");
  const signalCleanupRef = useRef<null | (() => void)>(null);

  const participants = useMemo(
    () => meeting?.participants ?? [],
    [meeting?.participants],
  );

  const otherParticipants = useMemo(
    () =>
      participants.filter((participant) => participant.user_id !== user?.id),
    [participants, user?.id],
  );

  useEffect(() => {
    if (!meetingId || !user?.id) return;

    void (async () => {
      try {
        setLoading(true);
        setError("");

        await joinMeeting({
          meetingId,
          userId: user.id,
        });

        const [meetingData, messageData] = await Promise.all([
          getMeetingById(meetingId),
          getMeetingMessages(meetingId),
        ]);

        setMeeting(meetingData);
        setMessages(messageData);

        await media.initializeLocalMedia();
      } catch (err: unknown) {
        console.error(err);
        const message =
          err instanceof Error ? err.message : "Failed to load meeting room.";
        setError(message);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      if (!meetingId || !user?.id) return;
      void leaveMeeting({ meetingId, userId: user.id });
    };
  }, [meetingId, user?.id, media]);

  useEffect(() => {
    if (!meetingId || !user?.id || !media.localStream || !meeting) return;

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

          media.rtcService.createPeerConnection(senderId, {
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
              media.registerRemoteStream(senderId, stream);
            },
            onConnectionStateChange: (state) => {
              if (
                state === "disconnected" ||
                state === "closed" ||
                state === "failed"
              ) {
                media.removeRemoteStream(senderId);
              }
            },
          });

          if (signal.signal_type === "offer") {
            const answer = await media.rtcService.handleOffer(
              senderId,
              signal.payload as unknown as RTCSessionDescriptionInit,
            );

            await sendMeetingSignal({
              meetingId,
              senderId: user.id,
              receiverId: senderId,
              signalType: "answer",
              payload: answer,
            });
          } else if (signal.signal_type === "answer") {
            await media.rtcService.handleAnswer(
              senderId,
              signal.payload as unknown as RTCSessionDescriptionInit,
            );
          } else if (signal.signal_type === "ice-candidate") {
            await media.rtcService.addIceCandidate(
              senderId,
              signal.payload as unknown as RTCIceCandidateInit,
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
  }, [meetingId, user?.id, media.localStream, meeting, media]);

  useEffect(() => {
    if (
      !meetingId ||
      !user?.id ||
      !media.localStream ||
      otherParticipants.length === 0
    ) {
      return;
    }

    void (async () => {
      for (const participant of otherParticipants) {
        const peerUserId = participant.user_id;

        try {
          media.rtcService.createPeerConnection(peerUserId, {
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
              media.registerRemoteStream(peerUserId, stream);
            },
            onConnectionStateChange: (state) => {
              if (
                state === "disconnected" ||
                state === "closed" ||
                state === "failed"
              ) {
                media.removeRemoteStream(peerUserId);
              }
            },
          });

          const offer = await media.rtcService.createOffer(peerUserId);

          await sendMeetingSignal({
            meetingId,
            senderId: user.id,
            receiverId: peerUserId,
            signalType: "offer",
            payload: offer,
          });
        } catch (err) {
          console.error("OFFER SEND ERROR:", err);
        }
      }
    })();
  }, [meetingId, user?.id, media.localStream, otherParticipants, media]);

  async function handleToggleMute() {
    if (!meetingId || !user?.id) return;

    try {
      const nextMuted = media.toggleMute();

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
      const nextCameraOn = media.toggleCamera();

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
      if (media.isScreenSharing) {
        await media.stopScreenShare();
        return;
      }

      await media.startScreenShare();
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
        setMessages((current) => [...current, created]);
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

      media.rtcService.cleanup();

      if (media.localStream) {
        media.localStream.getTracks().forEach((track) => track.stop());
      }

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
      navigate("/meetings");
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to end meeting.";
      setError(message);
    }
  }

  const remoteLabelMap = new Map(
    otherParticipants.map((participant) => [
      participant.user_id,
      getParticipantLabel(participant),
    ]),
  );

  if (loading) {
    return (
      <div className="border border-white/10 bg-black px-6 py-8 text-sm text-white/50">
        Loading meeting room...
      </div>
    );
  }

  return (
    <div className="min-h-full bg-black text-white">
      <div className="grid gap-6 xl:grid-cols-[1.8fr_360px]">
        <section className="space-y-5">
          <div className="border border-white/10 bg-black px-6 py-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-orange-300">
                  {meeting?.meeting_type === "video"
                    ? "Video room"
                    : "Audio room"}
                </div>

                <h1 className="mt-4 text-3xl font-bold">
                  {meeting?.title || "Meeting room"}
                </h1>

                <p className="mt-2 text-sm leading-6 text-white/45">
                  {meeting?.description || "Live team collaboration room"}
                </p>
              </div>

              <div className="border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white/55">
                Room code:{" "}
                <span className="font-semibold text-white">
                  {meeting?.room_code}
                </span>
              </div>
            </div>
          </div>

          {error || media.error ? (
            <div className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error || media.error}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <VideoTile
              label="You"
              stream={media.localStream}
              muted
              badge={media.isScreenSharing ? "Sharing" : "Local"}
              placeholder={
                meeting?.meeting_type === "video" ? "Camera off" : "Audio only"
              }
            />

            {media.remoteStreams.length > 0 ? (
              media.remoteStreams.map((remote) => (
                <VideoTile
                  key={remote.userId}
                  label={remoteLabelMap.get(remote.userId) || "Participant"}
                  stream={remote.stream}
                  placeholder="Remote video unavailable"
                  badge="Remote"
                />
              ))
            ) : (
              <VideoTile
                label="Participants"
                stream={null}
                placeholder="Waiting for other participants to join"
                badge="Remote"
              />
            )}
          </div>

          <div className="border border-white/10 bg-black p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <button
                type="button"
                onClick={() => void handleToggleMute()}
                className={[
                  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                  media.isMuted
                    ? "bg-red-500 text-white hover:bg-red-400"
                    : "border border-white/10 bg-neutral-950 text-white hover:border-orange-500/30 hover:bg-orange-500/5",
                ].join(" ")}
              >
                {media.isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                {media.isMuted ? "Unmute" : "Mute"}
              </button>

              {meeting?.meeting_type === "video" ? (
                <button
                  type="button"
                  onClick={() => void handleToggleCamera()}
                  className={[
                    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                    !media.isCameraOn
                      ? "bg-red-500 text-white hover:bg-red-400"
                      : "border border-white/10 bg-neutral-950 text-white hover:border-orange-500/30 hover:bg-orange-500/5",
                  ].join(" ")}
                >
                  {media.isCameraOn ? (
                    <Video size={16} />
                  ) : (
                    <VideoOff size={16} />
                  )}
                  {media.isCameraOn ? "Stop camera" : "Start camera"}
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
                  media.isScreenSharing
                    ? "bg-orange-500 text-black hover:bg-orange-400"
                    : "border border-white/10 bg-neutral-950 text-white hover:border-orange-500/30 hover:bg-orange-500/5",
                ].join(" ")}
              >
                <MonitorUp size={16} />
                {media.isScreenSharing ? "Stop share" : "Share screen"}
              </button>

              {meeting?.host_id === user?.id ? (
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
              <h2 className="text-lg font-semibold">Participants</h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-4"
                >
                  <p className="font-medium">
                    {getParticipantLabel(participant)}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {participant.role}
                  </p>

                  <div className="mt-3 flex gap-2 text-[11px]">
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
                      {participant.is_camera_on ? "Camera on" : "Camera off"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
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

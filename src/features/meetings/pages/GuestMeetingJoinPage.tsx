import { useMemo, useState } from "react";
import { Loader2, LockKeyhole, Radio, UserRound, Video } from "lucide-react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
} from "@livekit/components-react";
import { useNavigate, useParams } from "react-router-dom";
import LivekitParticipantGrid from "../components/LivekitParticipantGrid";
import GuestMeetingControls from "../components/GuestMeetingControls";
import {
  getGuestLivekitToken,
  leaveGuestMeeting,
  type GuestLivekitTokenResponse,
} from "../services/meetingGuestService";
import { getOptimalRoomOptions, estimateConnectionQuality } from "../services/meetingMediaService";
import { getLiveKitConnectionErrorMessage } from "../utils/livekitErrors";
import MeetingReconnectBanner from "../components/MeetingReconnectBanner";

export default function GuestMeetingJoinPage() {
  const navigate = useNavigate();
  const { meetingCode, meetingId } = useParams<{
    meetingCode?: string;
    meetingId?: string;
  }>();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<GuestLivekitTokenResponse | null>(
    null,
  );

  const linkLabel = useMemo(
    () => meetingCode ?? meetingId ?? "meeting",
    [meetingCode, meetingId],
  );
  const roomOptions = useMemo(
    () => getOptimalRoomOptions(estimateConnectionQuality()),
    [],
  );
  async function handleJoin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setJoining(true);
      setError("");

      const result = await getGuestLivekitToken({
        meetingCode,
        name,
        email: email || null,
      });

      setSession(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not join this meeting. Please check your link.",
      );
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    if (session) {
      try {
        await leaveGuestMeeting({
          meetingId: session.meetingId,
          guestId: session.guestId,
        });
      } catch (err) {
        console.error("GUEST LEAVE ERROR:", err);
      }
    }

    setSession(null);
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_30%)]" />

      <main className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col justify-center">
        {!session ? (
          <div className="mx-auto w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/90 shadow-2xl shadow-black/50 backdrop-blur">
            <div className="border-b border-white/10 bg-white/3 px-5 py-6 sm:px-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-orange-300">
                <Radio size={14} />
                Guest meeting
              </div>

              <h1 className="mt-5 text-3xl font-bold tracking-tight">
                Join the meeting
              </h1>

              <p className="mt-3 text-sm leading-6 text-white/50">
                Enter your name to join as an external guest. This link only
                grants access to this meeting room.
              </p>
            </div>

            <form className="space-y-5 px-5 py-6 sm:px-7" onSubmit={handleJoin}>
              <div className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/30">
                  Meeting link
                </p>
                <p className="mt-2 truncate text-sm font-medium text-white/75">
                  {linkLabel}
                </p>
              </div>

              <div>
                <label
                  htmlFor="guest-name"
                  className="mb-2 block text-sm font-medium text-white"
                >
                  Your name
                </label>
                <div className="relative">
                  <UserRound
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                  />
                  <input
                    id="guest-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Jane Client"
                    className="w-full rounded-2xl border border-white/10 bg-black px-11 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-orange-500/50"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="guest-email"
                  className="mb-2 block text-sm font-medium text-white"
                >
                  Email <span className="text-white/35">(optional)</span>
                </label>
                <input
                  id="guest-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="jane@example.com"
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-orange-500/50"
                />
              </div>

              <div className="rounded-2xl border border-orange-500/15 bg-orange-500/5 p-4">
                <div className="flex items-start gap-3">
                  <LockKeyhole size={17} className="mt-0.5 text-orange-400" />
                  <p className="text-xs leading-6 text-white/45">
                    Guest access is limited to LiveKit media for this meeting.
                    It does not sign you into the internal workspace.
                  </p>
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={joining || !name.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {joining ? <Loader2 size={17} className="animate-spin" /> : <Video size={17} />}
                {joining ? "Joining..." : "Join meeting"}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-neutral-950/90 px-5 py-4 shadow-2xl shadow-black/30 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-400">
                Guest room
              </p>
              <h1 className="mt-1 text-xl font-semibold text-white">
                {session.meetingTitle}
              </h1>
              <p className="mt-1 text-sm text-white/45">
                Joined as {session.name}
              </p>
            </div>

            <div
              data-lk-theme="default"
              data-meeting-media-root="true"
              className="min-h-80 sm:min-h-130"
            >
              <LiveKitRoom
                key={session.roomName}
                options={roomOptions}
                token={session.token}
                serverUrl={session.url}
                connect={true}
                audio={true}
                video={session.meetingType === "video"}
                className="space-y-4"
                onError={(err) => {
                  setError(getLiveKitConnectionErrorMessage(err, session.url));
                }}
              >
                <RoomAudioRenderer />
                <StartAudio label="Enable audio" />
                <MeetingReconnectBanner />
                <LivekitParticipantGrid />
                <GuestMeetingControls onLeave={handleLeave} />
              </LiveKitRoom>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  Clock3,
  PlusCircle,
  Radio,
  Search,
  Video,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../lib/hooks/useAuth";
import CreateMeetingModal from "../components/CreateMeetingModal";
import MeetingCard from "../components/MeetingCard";
import { createMeeting, getMeetings } from "../services/meetingService";
import type { MeetingType, MeetingWithParticipants } from "../types/meeting";

export default function MeetingsPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [meetings, setMeetings] = useState<MeetingWithParticipants[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    void loadMeetings();
  }, [profile?.organization_id]);

  async function loadMeetings() {
    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await getMeetings(profile.organization_id);
      setMeetings(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load meetings.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateMeeting(values: {
    title: string;
    description: string;
    meetingType: MeetingType;
    scheduledFor: string | null;
  }) {
    if (!profile?.organization_id || !user?.id) return;

    try {
      setCreating(true);
      setError("");

      const meeting = await createMeeting({
        organization_id: profile.organization_id,
        title: values.title,
        description: values.description || null,
        host_id: user.id,
        meeting_type: values.meetingType,
        scheduled_start: values.scheduledFor
          ? new Date(values.scheduledFor).toISOString()
          : null,
      });

      setCreateOpen(false);
      await loadMeetings();
      navigate(`/meetings/${meeting.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to create meeting.");
    } finally {
      setCreating(false);
    }
  }

  const liveMeetings = meetings.filter((meeting) => meeting.status === "live");
  const scheduledMeetings = meetings.filter(
    (meeting) => meeting.status === "scheduled",
  );
  const endedMeetings = meetings.filter(
    (meeting) => meeting.status === "ended",
  );

  const filteredMeetings = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return meetings;

    return meetings.filter((meeting) => {
      return (
        meeting.title.toLowerCase().includes(term) ||
        meeting.description?.toLowerCase().includes(term) ||
        meeting.room_code.toLowerCase().includes(term) ||
        meeting.status.toLowerCase().includes(term) ||
        meeting.meeting_type.toLowerCase().includes(term)
      );
    });
  }, [meetings, search]);

  return (
    <>
      <div className="min-h-full bg-black px-4 py-5 text-white sm:px-6 lg:px-8">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_30%)]" />

        <div className="relative mx-auto max-w-7xl space-y-6">
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/85 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="border-b border-white/10 bg-white/3 px-5 py-6 sm:px-7">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex items-start gap-4">
                  <Link
                    to="/dashboard"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/50 text-white/70 shadow-lg transition hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-300"
                    aria-label="Back to dashboard"
                  >
                    <ChevronLeft size={21} />
                  </Link>

                  <div className="min-w-0 max-w-3xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-orange-300">
                      <Video size={14} />
                      Meetings hub
                    </div>

                    <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
                      Audio and video meetings
                    </h1>

                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
                      Create, manage, and join internal meetings from a clean
                      workspace built for fast team collaboration.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-black shadow-lg shadow-orange-500/10 transition hover:-translate-y-0.5 hover:bg-orange-400 sm:w-auto"
                >
                  <PlusCircle size={18} />
                  Create meeting
                </button>
              </div>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-black/45 px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                    Total meetings
                  </p>
                  <CalendarDays size={17} className="text-white/30" />
                </div>
                <p className="mt-4 text-3xl font-bold">{meetings.length}</p>
              </div>

              <div className="rounded-3xl border border-green-500/15 bg-green-500/5 px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-green-300/70">
                    Live now
                  </p>
                  <Radio size={17} className="text-green-300" />
                </div>
                <p className="mt-4 text-3xl font-bold text-green-400">
                  {liveMeetings.length}
                </p>
              </div>

              <div className="rounded-3xl border border-orange-500/15 bg-orange-500/5 px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-orange-300/75">
                    Scheduled
                  </p>
                  <Clock3 size={17} className="text-orange-300" />
                </div>
                <p className="mt-4 text-3xl font-bold text-orange-300">
                  {scheduledMeetings.length}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/45 px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                    Completed
                  </p>
                  <CalendarDays size={17} className="text-white/30" />
                </div>
                <p className="mt-4 text-3xl font-bold text-white/75">
                  {endedMeetings.length}
                </p>
              </div>
            </div>
          </section>

          {error ? (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300 shadow-lg shadow-red-950/20">
              {error}
            </div>
          ) : null}

          <section className="rounded-3xl border border-white/10 bg-neutral-950/80 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10">
                  <CalendarDays size={19} className="text-orange-400" />
                </div>

                <div>
                  <h2 className="text-xl font-semibold">All meetings</h2>
                  <p className="mt-1 text-sm text-white/40">
                    Browse current, upcoming, and completed meeting rooms.
                  </p>
                </div>
              </div>

              <div className="relative w-full lg:w-80">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search meetings..."
                  className="w-full rounded-2xl border border-white/10 bg-black/50 px-11 py-3 text-sm text-white outline-none placeholder:text-white/25 transition focus:border-orange-500/50"
                />
              </div>
            </div>

            {loading ? (
              <div className="rounded-3xl border border-white/10 bg-black/40 px-6 py-10 text-center text-sm text-white/50">
                Loading meetings...
              </div>
            ) : meetings.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-black/40 px-6 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-orange-500/20 bg-orange-500/10">
                  <Video size={24} className="text-orange-400" />
                </div>
                <p className="mt-5 text-lg font-semibold text-white/80">
                  No meetings yet
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">
                  Create your first meeting and invite your team to collaborate
                  live.
                </p>
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-orange-400"
                >
                  <PlusCircle size={18} />
                  Create meeting
                </button>
              </div>
            ) : filteredMeetings.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-black/40 px-6 py-12 text-center">
                <p className="text-lg font-semibold text-white/75">
                  No matching meetings
                </p>
                <p className="mt-2 text-sm text-white/45">
                  Try searching by title, room code, type, or status.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                {filteredMeetings.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    onJoin={(meetingId) => navigate(`/meetings/${meetingId}`)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <CreateMeetingModal
        open={createOpen}
        busy={creating}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreateMeeting}
      />
    </>
  );
}

import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, PlusCircle, Video } from "lucide-react";
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

  useEffect(() => {
    void loadMeetings();
  }, [profile?.organization_id]);

  async function loadMeetings() {
    if (!profile?.organization_id) return;

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

  return (
    <>
      <div className="min-h-full bg-black text-white">
        <section className="border border-white/10 bg-black">
          <div className="border-b border-white/10 px-6 py-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex items-center">
                <Link
                  to="/dashboard"
                  className="flex justify-center items-center gap-2 text-white/75 hover:text-white w-8 h-8 rounded-full border text-center  border-orange-400"
                >
                  <ChevronLeft
                    size={20}
                    className="inline-block text-orange-400"
                  />
                </Link>

                <div className="max-w-3xl  ml-2.5">
                  <div className="inline-flex items-center gap-2 border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-orange-300">
                    <Video size={14} />
                    Meetings hub
                  </div>

                  <h1 className="mt-5 text-3xl font-bold tracking-tight">
                    Audio and video meetings
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
                    Create, manage, and join internal meetings from one clean
                    workspace built for your team.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-orange-400"
              >
                <PlusCircle size={18} />
                Create meeting
              </button>
            </div>
          </div>

          <div className="grid gap-0 md:grid-cols-3">
            <div className="border-r border-t border-white/10 bg-black px-6 py-5 md:border-t-0">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                Total meetings
              </p>
              <p className="mt-3 text-3xl font-bold">{meetings.length}</p>
            </div>

            <div className="border-r border-t border-white/10 bg-black px-6 py-5 md:border-t-0">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                Live now
              </p>
              <p className="mt-3 text-3xl font-bold text-green-400">
                {liveMeetings.length}
              </p>
            </div>

            <div className="border-t border-white/10 bg-black px-6 py-5 md:border-t-0">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                Scheduled
              </p>
              <p className="mt-3 text-3xl font-bold text-orange-300">
                {scheduledMeetings.length}
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-6 border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <section className="mt-8 space-y-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-orange-400" />
            <h2 className="text-xl font-semibold">All meetings</h2>
          </div>

          {loading ? (
            <div className="border border-white/10 bg-black px-6 py-8 text-sm text-white/50">
              Loading meetings...
            </div>
          ) : meetings.length === 0 ? (
            <div className="border border-white/10 bg-black px-6 py-12 text-center">
              <p className="text-lg font-semibold text-white/75">
                No meetings yet
              </p>
              <p className="mt-2 text-sm text-white/45">
                Create your first meeting to get started.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              {meetings.map((meeting) => (
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

      <CreateMeetingModal
        open={createOpen}
        busy={creating}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreateMeeting}
      />
    </>
  );
}

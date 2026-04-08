import { ArrowRight, Phone, Users, Video } from "lucide-react";
import type { MeetingWithParticipants } from "../types/meeting";

function formatMeetingTime(value?: string | null) {
  if (!value) return "Start now";
  return new Date(value).toLocaleString();
}

function getStatusClasses(status: string) {
  switch (status) {
    case "live":
      return "border-green-500/20 bg-green-500/10 text-green-300";
    case "scheduled":
      return "border-orange-500/20 bg-orange-500/10 text-orange-300";
    case "ended":
      return "border-white/10 bg-white/5 text-white/55";
    case "cancelled":
      return "border-red-500/20 bg-red-500/10 text-red-300";
    default:
      return "border-white/10 bg-white/5 text-white/55";
  }
}

export default function MeetingCard({
  meeting,
  onJoin,
}: {
  meeting: MeetingWithParticipants;
  onJoin: (meetingId: string) => void;
}) {
  const participantCount = meeting.participants?.length ?? 0;

  return (
    <div className="border border-white/10 bg-black p-6 text-white transition duration-300 hover:border-orange-500/25 hover:bg-neutral-950">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
                getStatusClasses(meeting.status),
              ].join(" ")}
            >
              {meeting.status}
            </span>

            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-white/55">
              {meeting.meeting_type}
            </span>
          </div>

          <h3 className="mt-4 text-xl font-semibold text-white">
            {meeting.title}
          </h3>

          <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/45">
            {meeting.description || "No description provided for this meeting."}
          </p>
        </div>

        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-orange-500/15 bg-orange-500/10">
          {meeting.meeting_type === "video" ? (
            <Video size={22} className="text-orange-400" />
          ) : (
            <Phone size={22} className="text-orange-400" />
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/30">
            Scheduled start
          </p>
          <p className="mt-2 text-sm font-medium text-white/80">
            {formatMeetingTime(meeting.scheduled_start)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/30">
            Participants
          </p>
          <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-white/80">
            <Users size={14} className="text-orange-400" />
            {participantCount}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="truncate text-xs text-white/30">
          Room code: <span className="text-white/55">{meeting.room_code}</span>
        </p>

        <button
          type="button"
          onClick={() => onJoin(meeting.id)}
          className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400"
        >
          Join
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

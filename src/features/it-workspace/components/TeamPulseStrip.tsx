import type { TeamPulseMember } from "../services/controlCentreService";

const statusColors: Record<TeamPulseMember["status"], string> = {
  tracking: "bg-emerald-500 ring-emerald-500/40",
  online: "bg-blue-500 ring-blue-500/40",
  idle: "bg-amber-500 ring-amber-500/40",
  offline: "bg-white/20 ring-white/10",
};

const statusLabels: Record<TeamPulseMember["status"], string> = {
  tracking: "Tracking",
  online: "Online",
  idle: "Idle",
  offline: "Offline",
};

function getInitials(name: string | null, email: string) {
  if (name) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

type Props = {
  members: TeamPulseMember[];
  loading?: boolean;
};

export default function TeamPulseStrip({ members, loading }: Props) {
  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex animate-pulse flex-col items-center gap-2"
          >
            <div className="h-10 w-10 rounded-full bg-white/10" />
            <div className="h-2 w-12 rounded bg-white/10" />
          </div>
        ))}
      </div>
    );
  }

  const sorted = [...members].sort((a, b) => {
    const order = { tracking: 0, online: 1, idle: 2, offline: 3 };
    return order[a.status] - order[b.status];
  });

  const counts = {
    tracking: members.filter((m) => m.status === "tracking").length,
    online: members.filter((m) => m.status === "online").length,
    idle: members.filter((m) => m.status === "idle").length,
    offline: members.filter((m) => m.status === "offline").length,
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-white/80">Team Pulse</h3>
          <div className="flex gap-2 text-[11px]">
            <span className="text-emerald-400">{counts.tracking} tracking</span>
            <span className="text-white/30">·</span>
            <span className="text-blue-400">{counts.online} online</span>
            <span className="text-white/30">·</span>
            <span className="text-amber-400">{counts.idle} idle</span>
          </div>
        </div>
        <span className="text-[11px] text-white/30">
          {members.length} members
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {sorted.map((member) => (
          <div
            key={member.id}
            className="group relative flex shrink-0 flex-col items-center gap-1.5"
            title={`${member.full_name ?? member.email} — ${statusLabels[member.status]}`}
          >
            <div className="relative">
              {member.avatar_url ? (
                <img
                  src={member.avatar_url}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/60">
                  {getInitials(member.full_name, member.email)}
                </div>
              )}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-black ${statusColors[member.status]}`}
              />
            </div>
            <span className="max-w-14 truncate text-[10px] text-white/50">
              {member.full_name?.split(" ")[0] ?? member.email.split("@")[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

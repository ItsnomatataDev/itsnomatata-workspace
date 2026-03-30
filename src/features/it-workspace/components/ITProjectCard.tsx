import { ArrowRight, AlertTriangle, ShieldAlert, Users } from "lucide-react";
import { Link } from "react-router-dom";

type ITProjectCardProps = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  priority: string;
  membersCount: number;
  openTasksCount: number;
  blockedTasksCount: number;
  openIssuesCount: number;
  failedRuns24h: number;
  healthScore: number;
  healthStatus: "healthy" | "warning" | "critical";
  riskLevel: "low" | "medium" | "high";
};

function statusPill(_status: string) {
  return "rounded-full bg-orange-500/15 px-3 py-1 text-xs font-medium text-orange-400";
}

function healthPill(status: "healthy" | "warning" | "critical") {
  if (status === "healthy") {
    return "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300";
  }

  if (status === "warning") {
    return "rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300";
  }

  return "rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300";
}

function riskPill(level: "low" | "medium" | "high") {
  if (level === "low") {
    return "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300";
  }

  if (level === "medium") {
    return "rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300";
  }

  return "rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300";
}

export default function ITProjectCard({
  id,
  name,
  description,
  status,
  priority,
  membersCount,
  openTasksCount,
  blockedTasksCount,
  openIssuesCount,
  failedRuns24h,
  healthScore,
  healthStatus,
  riskLevel,
}: ITProjectCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{name}</h3>
          <p className="mt-2 text-sm text-white/60">
            {description || "No project description yet."}
          </p>
        </div>

        <div className="flex flex-col gap-2 text-right">
          <span className={statusPill(status)}>{status}</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
            {priority}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-xs uppercase tracking-wide text-white/45">
            Health
          </p>
          <p className="mt-2 text-xl font-bold text-white">{healthScore}%</p>
          <span className={`mt-2 inline-flex ${healthPill(healthStatus)}`}>
            {healthStatus}
          </span>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-xs uppercase tracking-wide text-white/45">Risk</p>
          <p className="mt-2 text-xl font-bold text-white">{riskLevel}</p>
          <span className={`mt-2 inline-flex ${riskPill(riskLevel)}`}>
            {riskLevel}
          </span>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-xs uppercase tracking-wide text-white/45">
            Issues
          </p>
          <p className="mt-2 text-xl font-bold text-white">{openIssuesCount}</p>
          <p className="mt-2 text-xs text-white/45">
            Failed runs 24h: {failedRuns24h}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-xs uppercase tracking-wide text-white/45">Tasks</p>
          <p className="mt-2 text-xl font-bold text-white">{openTasksCount}</p>
          <p className="mt-2 text-xs text-white/45">
            Blocked: {blockedTasksCount}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-white/55">
          <Users size={16} />
          {membersCount} members
        </div>

        <div className="flex items-center gap-2 text-xs text-white/50">
          {blockedTasksCount > 0 ? <AlertTriangle size={14} /> : null}
          {failedRuns24h > 0 ? <ShieldAlert size={14} /> : null}
          Live project risk derived from real workspace data
        </div>

        <Link
          to={`/it/projects/${id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-orange-500"
        >
          Open <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

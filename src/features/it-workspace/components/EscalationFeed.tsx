import { Link } from "react-router-dom";
import {
  AlertTriangle,
  XCircle,
  Info,
  Zap,
  Ban,
  Clock,
  FolderClock,
  Package,
  KeyRound,
} from "lucide-react";
import type { EscalationItem } from "../services/controlCentreService";

const severityConfig = {
  critical: {
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    pill: "bg-red-500/20 text-red-300",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    pill: "bg-amber-500/20 text-amber-300",
  },
  info: {
    icon: Info,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    pill: "bg-blue-500/20 text-blue-300",
  },
};

const typeIcons: Record<EscalationItem["type"], typeof Zap> = {
  failed_automation: Zap,
  blocked_task: Ban,
  stale_approval: Clock,
  overdue_project: FolderClock,
  critical_notification: AlertTriangle,
  low_stock: Package,
  urgent_support_ticket: KeyRound,
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type Props = {
  items: EscalationItem[];
  loading?: boolean;
};

export default function EscalationFeed({ items, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <div className="h-4 w-48 rounded bg-white/10" />
            <div className="mt-2 h-3 w-32 rounded bg-white/10" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center">
        <p className="text-sm text-emerald-400">All clear — no escalations</p>
        <p className="mt-1 text-xs text-white/40">
          No blocked tasks, failed automations, or stale items
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const sev = severityConfig[item.severity];
        const TypeIcon = typeIcons[item.type] ?? AlertTriangle;

        return (
          <Link
            key={item.id}
            to={item.route}
            className={`group flex items-start gap-3 rounded-xl border ${sev.border} ${sev.bg} p-3 transition-all hover:border-orange-500/30`}
          >
            <div className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${sev.bg}`}>
              <TypeIcon size={14} className={sev.color} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-white">
                  {item.title}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${sev.pill}`}
                >
                  {item.severity}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-white/45">{item.detail}</p>
            </div>
            <span className="shrink-0 text-[10px] text-white/30">
              {timeAgo(item.created_at)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

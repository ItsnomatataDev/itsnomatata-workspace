import { Link } from "react-router-dom";
import {
  KeyRound,
  ShieldAlert,
  UserCog,
  Smartphone,
  Lock,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import type { SupportTicket } from "../services/supportTicketService";

const priorityConfig = {
  urgent: { pill: "bg-red-500/20 text-red-300", dot: "bg-red-400" },
  high: { pill: "bg-orange-500/20 text-orange-300", dot: "bg-orange-400" },
  medium: { pill: "bg-amber-500/20 text-amber-300", dot: "bg-amber-400" },
  low: { pill: "bg-blue-500/20 text-blue-300", dot: "bg-blue-400" },
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_on_user: "Waiting on User",
  resolved: "Resolved",
  closed: "Closed",
};

const typeIcons: Record<string, typeof KeyRound> = {
  account_recovery: KeyRound,
  password_reset: Lock,
  access_request: ShieldAlert,
  mfa_reset: Smartphone,
  account_unlock: Lock,
  permission_change: UserCog,
  device_issue: Smartphone,
  other: HelpCircle,
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
  tickets: SupportTicket[];
  loading?: boolean;
  limit?: number;
};

export default function SupportTicketsFeed({ tickets, loading, limit }: Props) {
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

  if (tickets.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center">
        <p className="text-sm text-emerald-400">No support tickets</p>
        <p className="mt-1 text-xs text-white/40">
          No account recovery requests or IT support tickets pending
        </p>
      </div>
    );
  }

  const visibleTickets = limit ? tickets.slice(0, limit) : tickets;

  return (
    <div className="space-y-2">
      {visibleTickets.map((ticket) => {
        const prio = priorityConfig[ticket.priority] ?? priorityConfig.medium;
        const Icon = typeIcons[ticket.ticket_type] ?? HelpCircle;

        return (
          <Link
            key={ticket.id}
            to={`/it/support/${ticket.id}`}
            className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition-all hover:border-orange-500/30"
          >
            <div className="mt-0.5 shrink-0 rounded-lg bg-white/5 p-1.5">
              <Icon size={14} className="text-orange-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-white">
                  {ticket.title}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${prio.pill}`}
                >
                  {ticket.priority}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-white/45">
                <span>{statusLabels[ticket.status] ?? ticket.status}</span>
                <span>•</span>
                <span>
                  {ticket.requester_name ??
                    ticket.requester_email ??
                    "Unknown user"}
                </span>
                {ticket.assigned_name && (
                  <>
                    <span>→</span>
                    <span className="text-white/60">
                      {ticket.assigned_name}
                    </span>
                  </>
                )}
              </div>
            </div>
            <span className="shrink-0 text-[10px] text-white/30">
              {timeAgo(ticket.created_at)}
            </span>
          </Link>
        );
      })}
      {limit && tickets.length > limit && (
        <Link
          to="/it/support"
          className="inline-flex items-center gap-1 pt-2 text-xs font-medium text-orange-500"
        >
          View all {tickets.length} tickets <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}

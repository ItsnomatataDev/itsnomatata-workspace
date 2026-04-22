import React, { useEffect, useState } from "react";
import {
  ChevronRight,
  Settings,
  Users,
  Activity,
  MoreVertical,
  Archive,
  Trash2,
  Share2,
  Calendar,
  TrendingUp,
  MessageSquare,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";
import type { Board, BoardStats } from "../../../types/board";
import { getBoardStats } from "../services/boardService";
import { supabase } from "../../../lib/supabase/client";

interface BoardMember {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role: string | null;
}

interface BoardActivity {
  id: string;
  type: "card_created" | "card_moved" | "card_completed" | "comment_added";
  user: string;
  description: string;
  timestamp: string;
}

interface BoardSidebarProps {
  board: Board;
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
}

function getInitials(name?: string | null, email?: string | null): string {
  const src = name?.trim() || email?.trim() || "?";
  const parts = src.split(" ").filter(Boolean);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : src.slice(0, 2).toUpperCase();
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/4 p-3">
      <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
        {label}
      </p>
      <p
        className={`text-2xl font-bold ${accent ? "text-orange-400" : "text-white"}`}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function BoardSidebar({
  board,
  organizationId,
  isOpen,
  onClose,
}: BoardSidebarProps) {
  const [activeTab, setActiveTab] = useState<"info" | "members" | "activity">(
    "info",
  );
  const [stats, setStats] = useState<BoardStats | null>(null);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [activities, setActivities] = useState<BoardActivity[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (!board?.id || !organizationId) return;
    setLoadingStats(true);
    getBoardStats(organizationId, board.id)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoadingStats(false));
  }, [board?.id, organizationId]);


  useEffect(() => {
    if (!board?.id || !organizationId || activeTab !== "members") return;
    setLoadingMembers(true);

    (async () => {
      try {
        const { data: taskRows, error: taskError } = await supabase
          .from("tasks")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("client_id", board.id);

        if (taskError) {
          console.error(taskError);
          return;
        }

        const taskIds = (taskRows ?? []).map((r) => r.id) as string[];
        if (taskIds.length === 0) {
          setMembers([]);
          return;
        }

  
        const { data, error } = await supabase
          .from("task_assignees")
          .select(
            "user_id, profiles:user_id (id, full_name, email, primary_role)",
          )
          .in("task_id", taskIds);

        if (error) {
          console.error(error);
          return;
        }

        // Deduplicate by user_id
        const seen = new Set<string>();
        const unique: BoardMember[] = [];
        for (const row of data ?? []) {
          const p = (row as any).profiles as BoardMember | null;
          if (p && !seen.has(p.id)) {
            seen.add(p.id);
            unique.push(p);
          }
        }
        setMembers(unique);
      } finally {
        setLoadingMembers(false);
      }
    })();
  }, [board?.id, organizationId, activeTab]);

  // Load recent task activity (created/updated tasks) from DB
  useEffect(() => {
    if (!board?.id || !organizationId || activeTab !== "activity") return;

    supabase
      .from("tasks")
      .select(
        "id, title, status, created_at, updated_at, created_by, assigned_to, profiles:created_by(full_name)",
      )
      .eq("organization_id", organizationId)
      .eq("client_id", board.id)
      .order("updated_at", { ascending: false })
      .limit(15)
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          return;
        }

        const acts: BoardActivity[] = (data ?? []).map((t: any) => {
          const who = t.profiles?.full_name ?? "Someone";
          const isNew =
            new Date(t.created_at).getTime() > Date.now() - 1000 * 60 * 60 * 24;
          const type: BoardActivity["type"] =
            t.status === "done"
              ? "card_completed"
              : t.status === "in_progress"
                ? "card_moved"
                : isNew
                  ? "card_created"
                  : "card_moved";

          const desc =
            type === "card_completed"
              ? `Completed "${t.title}"`
              : type === "card_created"
                ? `Created "${t.title}"`
                : `Updated "${t.title}" → ${t.status.replace("_", " ")}`;

          const ago = (() => {
            const diff = Date.now() - new Date(t.updated_at).getTime();
            const mins = Math.floor(diff / 60000);
            const hrs = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);
            if (days > 0) return `${days}d ago`;
            if (hrs > 0) return `${hrs}h ago`;
            return `${mins}m ago`;
          })();

          return {
            id: t.id,
            type,
            user: who,
            description: desc,
            timestamp: ago,
          };
        });

        setActivities(acts);
      });
  }, [board?.id, organizationId, activeTab]);

  if (!isOpen) return null;

  const total = stats?.totalCards ?? 0;
  const done = stats?.cardsDone ?? 0;
  const inProgress = stats?.cardsInProgress ?? 0;
  const timeTracked = stats?.totalTimeTracked ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0a0a0a] border-l border-white/10">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Board Details</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-white/5 p-1">
          {(
            [
              { id: "info", label: "Info", icon: Settings },
              { id: "members", label: "Members", icon: Users },
              { id: "activity", label: "Activity", icon: Activity },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition ${
                activeTab === id
                  ? "bg-orange-500 text-white shadow"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* ── INFO TAB ── */}
        {activeTab === "info" && (
          <>
            {/* Board name + notes */}
            <div>
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-base font-bold text-white leading-tight">
                  {board.name}
                </h3>
                <button className="rounded-lg p-1 text-white/30 hover:bg-white/10 hover:text-white transition">
                  <MoreVertical size={15} />
                </button>
              </div>
              {board.notes && (
                <p className="text-xs text-white/50 leading-relaxed">
                  {board.notes}
                </p>
              )}
            </div>

            {/* Stats grid — real data */}
            {loadingStats ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="text-orange-400 animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Total Cards" value={total} />
                  <StatCard label="Completed" value={`${pct}%`} accent />
                  <StatCard label="In Progress" value={inProgress} />
                  <StatCard
                    label="Time Tracked"
                    value={formatTime(timeTracked)}
                    sub={`${total - done} remaining`}
                  />
                </div>

                {/* Completion bar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-white/60">
                      Overall Completion
                    </span>
                    <span className="text-xs font-bold text-white">{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-orange-500 to-orange-400 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-white/30">
                      {done} done
                    </span>
                    <span className="text-[10px] text-white/30">
                      {total} total
                    </span>
                  </div>
                </div>

                {/* Status breakdown */}
                <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3">
                  <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                    Status Breakdown
                  </p>
                  {[
                    { label: "Done", value: done, color: "bg-green-500" },
                    {
                      label: "In Progress",
                      value: inProgress,
                      color: "bg-orange-500",
                    },
                    {
                      label: "Remaining",
                      value: Math.max(0, total - done - inProgress),
                      color: "bg-white/20",
                    },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${color}`} />
                      <span className="text-xs text-white/60 flex-1">
                        {label}
                      </span>
                      <span className="text-xs font-semibold text-white">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Board details */}
            <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3">
              {board.industry && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">
                    Industry
                  </p>
                  <p className="text-sm text-white">{board.industry}</p>
                </div>
              )}
              {board.email && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">
                    Contact
                  </p>
                  <p className="text-sm text-orange-400">{board.email}</p>
                </div>
              )}
              {board.website && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">
                    Website
                  </p>
                  <a
                    href={board.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 transition break-all"
                  >
                    {board.website}
                  </a>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">
                  Created
                </p>
                <p className="text-sm text-white/60">
                  {new Date(board.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <button className="w-full flex items-center gap-2 rounded-xl border border-white/10 bg-white/3 px-4 py-2.5 text-sm text-white/70 hover:bg-white/8 hover:text-white transition">
                <Share2 size={15} />
                Share Board
              </button>
              <button className="w-full flex items-center gap-2 rounded-xl border border-white/10 bg-white/3 px-4 py-2.5 text-sm text-white/70 hover:bg-white/8 hover:text-white transition">
                <Archive size={15} />
                Archive Board
              </button>
              <button className="w-full flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/15 transition">
                <Trash2 size={15} />
                Delete Board
              </button>
            </div>
          </>
        )}

        {/* ── MEMBERS TAB ── */}
        {activeTab === "members" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">
                Board Members
                {members.length > 0 && (
                  <span className="ml-2 text-white/40 font-normal">
                    ({members.length})
                  </span>
                )}
              </p>
            </div>

            {loadingMembers ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="text-orange-400 animate-spin" />
              </div>
            ) : members.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/2 p-8 text-center">
                <Users size={24} className="text-white/20 mx-auto mb-3" />
                <p className="text-sm text-white/40">No members assigned yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/3 p-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 border border-orange-500/30 text-xs font-bold text-orange-400">
                      {getInitials(member.full_name, member.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {member.full_name ?? member.email ?? "Unknown"}
                      </p>
                      <p className="text-xs text-white/40 truncate">
                        {member.email}
                      </p>
                    </div>
                    {member.primary_role && (
                      <span className="shrink-0 text-[10px] font-medium px-2 py-1 rounded-lg bg-white/10 text-white/50 uppercase tracking-wide">
                        {member.primary_role}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ACTIVITY TAB ── */}
        {activeTab === "activity" && (
          <>
            <p className="text-sm font-semibold text-white">Recent Activity</p>

            {activities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/2 p-8 text-center">
                <Activity size={24} className="text-white/20 mx-auto mb-3" />
                <p className="text-sm text-white/40">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/3 p-3"
                  >
                    <div className="mt-0.5 shrink-0 rounded-lg bg-white/8 p-1.5">
                      {act.type === "card_completed" && (
                        <CheckCircle2 size={13} className="text-green-400" />
                      )}
                      {act.type === "card_moved" && (
                        <TrendingUp size={13} className="text-blue-400" />
                      )}
                      {act.type === "comment_added" && (
                        <MessageSquare size={13} className="text-purple-400" />
                      )}
                      {act.type === "card_created" && (
                        <Circle size={13} className="text-orange-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white leading-snug">
                        <span className="font-semibold">{act.user}</span>{" "}
                        <span className="text-white/60">{act.description}</span>
                      </p>
                      <p className="mt-1 text-[10px] text-white/30">
                        {act.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

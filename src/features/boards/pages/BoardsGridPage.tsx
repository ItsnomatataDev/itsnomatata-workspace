import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Clock,
  TrendingUp,
  LayoutGrid,
  CheckCircle2,
  X,
  Loader2,
  Building2,
} from "lucide-react";
import { createClient } from "../../clients/services/clientService";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { getBoards, getBoardStats } from "../services/boardService";
import { supabase } from "../../../lib/supabase/client";
import type { Board, BoardStats } from "../../../types/board";
import type { Client } from "../../../lib/supabase/queries/clients";

interface BoardTile extends Board {
  stats: BoardStats | null;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ── New Board Modal ────────────────────────────────────────────────────────────

function NewBoardModal({
  organizationId,
  onClose,
  onCreated,
}: {
  organizationId: string;
  onClose: () => void;
  onCreated: (board: Board) => void;
}) {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Board name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const boardData = await createClient({
        organizationId,
        name: name.trim(),
        industry: industry.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null,
        notes: notes.trim() || null,
      });
      onCreated(boardData as Board);
      onClose();
    } catch (dbError: any) {
      setError(dbError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 md:p-8">
      <div className="w-full max-w-sm sm:max-w-md rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-2xl mx-4">
        {/* Top bar */}
        <div className="h-1 w-full rounded-t-2xl bg-linear-to-r from-orange-500 to-orange-400" />

        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/20">
              <Building2 size={16} className="text-orange-400" />
            </div>
            <h2 className="text-base font-bold text-white">Create New Board</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Name — required */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">
              Board Name <span className="text-orange-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
              }}
              placeholder="e.g. Acme Corp"
              autoFocus
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-orange-500/50 transition"
            />
          </div>

          {/* Industry */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">
              Industry
            </label>
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. Technology, Retail…"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-orange-500/50 transition"
            />
          </div>

          {/* Email + Website */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">
                Contact Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@client.com"
                type="email"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-orange-500/50 transition"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">
                Website
              </label>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-orange-500/50 transition"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any context about this board…"
              rows={2}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-orange-500/50 transition"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:bg-white/5 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Plus size={15} />
              )}
              Create Board
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BoardsGridPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const profile = auth?.profile ?? null;
  const organizationId = profile?.organization_id ?? null;

  const [boards, setBoards] = useState<BoardTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [error, setError] = useState("");
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState<Client | null>(null);

  const loadBoards = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError("");
      const clients = await getBoards(organizationId);

      // Fetch real stats for every board in parallel, silently ignore failures
      const tiles = await Promise.all(
        clients.map(async (client) => {
          let stats: BoardStats | null = null;
          try {
            stats = await getBoardStats(organizationId, client.id);
          } catch {}
          return { ...client, stats };
        }),
      );
      setBoards(tiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load boards.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  const filteredBoards = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return boards;
    return boards.filter((b) =>
      [b.name, b.email, b.industry, b.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [boards, searchValue]);

  // Workspace totals from real stats
  const summary = useMemo(
    () =>
      boards.reduce(
        (acc, b) => ({
          totalBoards: acc.totalBoards + 1,
          totalCards: acc.totalCards + (b.stats?.totalCards ?? 0),
          inProgress: acc.inProgress + (b.stats?.cardsInProgress ?? 0),
          totalTime: acc.totalTime + (b.stats?.totalTimeTracked ?? 0),
        }),
        { totalBoards: 0, totalCards: 0, inProgress: 0, totalTime: 0 },
      ),
    [boards],
  );

  const handleBoardCreated = (board: Board) => {
    setBoards((prev) => [{ ...board, stats: null }, ...prev]);
  };

  if (!auth?.user || !profile || !organizationId) return null;

  return (
    <div className="min-h-screen bg-[#050505] flex">
      <Sidebar role={profile.primary_role ?? "manager"} />

      <main className="flex-1 overflow-y-auto">
        {/* ── Header ── */}
        <div className="border-b border-white/10 bg-linear-to-b from-white/4 to-transparent px-8 py-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500">
                    <LayoutGrid size={18} className="text-white" />
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-white">
                    Workspace
                  </h1>
                </div>
                <p className="text-sm text-white/40 ml-12">
                  All client boards — tasks, time & progress in one place
                </p>
              </div>

              <button
                onClick={() => setShowNewBoard(true)}
                className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/20"
              >
                <Plus size={18} /> New Board
              </button>
            </div>

            {/* ── Workspace Stats ── */}
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                {
                  label: "Total Boards",
                  value: summary.totalBoards,
                  icon: LayoutGrid,
                  color: "text-white",
                  bg: "bg-white/10",
                },
                {
                  label: "Total Cards",
                  value: summary.totalCards,
                  icon: TrendingUp,
                  color: "text-orange-400",
                  bg: "bg-orange-500/10",
                },
                {
                  label: "In Progress",
                  value: summary.inProgress,
                  icon: CheckCircle2,
                  color: "text-green-400",
                  bg: "bg-green-500/10",
                },
                {
                  label: "Time Tracked",
                  value: formatTime(summary.totalTime),
                  icon: Clock,
                  color: "text-blue-400",
                  bg: "bg-blue-500/10",
                  isText: true,
                },
              ].map(({ label, value, icon: Icon, color, bg, isText }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/3 px-5 py-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/40 mb-2">
                        {label}
                      </p>
                      <p
                        className={`font-bold text-white ${isText ? "text-2xl" : "text-3xl"}`}
                      >
                        {loading ? (
                          <span className="inline-block h-8 w-16 animate-pulse rounded bg-white/10" />
                        ) : (
                          value
                        )}
                      </p>
                    </div>
                    <div className={`rounded-xl ${bg} p-2.5`}>
                      <Icon size={20} className={color} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="px-8 py-8 mx-auto max-w-7xl">
          {/* Search */}
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search boards…"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-white/25 outline-none focus:border-orange-500/50 transition"
              />
            </div>
            {!loading && (
              <p className="text-sm text-white/30">
                {filteredBoards.length} board
                {filteredBoards.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-white/10 bg-white/5 h-52"
                />
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading && filteredBoards.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/2 p-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 mb-4">
                <Building2 className="text-white/30" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {searchValue ? "No boards match" : "No boards yet"}
              </h3>
              <p className="text-sm text-white/30 mb-6">
                {searchValue
                  ? "Try a different search term"
                  : "Create your first board to get started"}
              </p>
              {!searchValue && (
                <button
                  onClick={() => setShowNewBoard(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition"
                >
                  <Plus size={16} /> Create Board
                </button>
              )}
            </div>
          )}

          {/* ── Board Grid ── */}
          {!loading && filteredBoards.length > 0 && (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredBoards.map((board) => {
                const s = board.stats;
                const total = s?.totalCards ?? 0;
                const done = s?.cardsDone ?? 0;
                const inProgress = s?.cardsInProgress ?? 0;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                return (
                  <button
                    key={board.id}
                    type="button"
                    onClick={() => navigate(`/boards/${board.id}`)}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d] text-left transition-all duration-200 hover:border-orange-500/40 hover:shadow-xl hover:shadow-orange-500/5 hover:-translate-y-0.5"
                  >
                    {/* Top accent */}
                    <div className="h-1 w-full bg-linear-to-r from-orange-500 to-orange-400 opacity-50 group-hover:opacity-100 transition-opacity" />

                    <div className="flex flex-col flex-1 p-5 gap-4">
                      {/* Identity */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 border border-orange-500/20 text-sm font-bold text-orange-400">
                            {getInitials(board.name)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-white truncate">
                              {board.name}
                            </h3>
                            {board.industry && (
                              <p className="text-xs text-white/35 truncate mt-0.5">
                                {board.industry}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Cards", value: total, color: "text-white" },
                          {
                            label: "Active",
                            value: inProgress,
                            color: "text-orange-400",
                          },
                          {
                            label: "Done",
                            value: done,
                            color: "text-green-400",
                          },
                        ].map(({ label, value, color }) => (
                          <div
                            key={label}
                            className="rounded-lg bg-white/5 px-2 py-2 text-center"
                          >
                            <p
                              className={`text-lg font-bold leading-none ${color}`}
                            >
                              {value}
                            </p>
                            <p className="text-[10px] text-white/35 mt-1 uppercase tracking-wide">
                              {label}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Progress */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-white/40 flex items-center gap-1">
                            <CheckCircle2 size={10} /> Completion
                          </span>
                          <span className="text-[10px] font-semibold text-white/60">
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-linear-to-r from-orange-500 to-orange-400 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Time */}
                      <div className="flex items-center justify-between border-t border-white/8 pt-3 mt-auto">
                        <div className="flex items-center gap-1.5 text-xs text-white/35">
                          <Clock size={12} /> Time tracked
                        </div>
                        <span className="text-xs font-semibold text-white/60">
                          {formatTime(s?.totalTimeTracked ?? 0)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Create new board tile */}
              <button
                type="button"
                onClick={() => setShowNewBoard(true)}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/10 bg-transparent p-8 text-center transition hover:border-orange-500/40 hover:bg-orange-500/5 min-h-52"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  <Plus size={22} className="text-white/30" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/50">
                    New Board
                  </p>
                  <p className="text-xs text-white/25 mt-0.5">
                    Add a client workspace
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
      </main>

      {showNewBoard && organizationId && (
        <NewBoardModal
          organizationId={organizationId}
          onClose={() => setShowNewBoard(false)}
          onCreated={handleBoardCreated}
        />
      )}
    </div>
  );
}

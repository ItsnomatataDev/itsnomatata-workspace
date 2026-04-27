import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import {
  Clock,
  Users,
  TrendingUp,
  Filter,
  CalendarDays,
  Download,
  ChevronDown,
} from "lucide-react";
import { getBoards } from "../../../features/boards/services/boardService";
import { getAdminTimeEntries } from '../../../lib/supabase/queries/adminTime';
import type { Board } from "../../../types/board";
import type { AdminTimeEntryRow } from '../../../lib/supabase/queries/adminTime';

const PERIODS = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "Last Week", value: "last_week" },
  { label: "Last 2 Weeks", value: "last_2_weeks" },
  { label: "This Month", value: "month" },
  { label: "Last Month", value: "last_month" },
];

function getPeriodFilter(value: string): { from: string; to: string } {
  const now = new Date();
  const fromDate = new Date(now);
  switch (value) {
    case "today":
      fromDate.setHours(0, 0, 0, 0);
      return { from: fromDate.toISOString(), to: now.toISOString() };
    case "week":
      fromDate.setDate(now.getDate() - now.getDay());
      fromDate.setHours(0, 0, 0, 0);
      return { from: fromDate.toISOString(), to: now.toISOString() };
    case "last_week":
      const lastWeek = new Date(now);
      lastWeek.setDate(now.getDate() - now.getDay() - 7);
      lastWeek.setHours(0, 0, 0, 0);
      const lastWeekEnd = new Date(lastWeek);
      lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
      lastWeekEnd.setHours(23, 59, 59, 999);
      return { from: lastWeek.toISOString(), to: lastWeekEnd.toISOString() };
    case "last_2_weeks":
      const last2Week = new Date(now);
      last2Week.setDate(now.getDate() - now.getDay() - 14);
      last2Week.setHours(0, 0, 0, 0);
      return { from: last2Week.toISOString(), to: now.toISOString() };
    case "month":
      fromDate.setDate(1);
      fromDate.setHours(0, 0, 0, 0);
      return { from: fromDate.toISOString(), to: now.toISOString() };
    case "last_month":
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: lastMonth.toISOString(), to: lastMonthEnd.toISOString() };
    default:
      return { from: "2024-01-01T00:00:00Z", to: now.toISOString() };
  }
}

export default function EverhourHome() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const organizationId = profile?.organization_id ?? "";

  const [period, setPeriod] = useState("week");
  const [activeFilter, setActiveFilter] = useState<"all" | "active">("all");
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState<Board[]>([]);
  const [timeEntries, setTimeEntries] = useState<AdminTimeEntryRow[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!organizationId) return;
      setLoading(true);
      try {
        const [boardsData, entriesData] = await Promise.all([
          getBoards(organizationId),
          getAdminTimeEntries({
            organizationId,
            approvalStatus: "all",
            ...getPeriodFilter(period),
          }),
        ]);
        setBoards(boardsData);
        setTimeEntries(entriesData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [organizationId, period, activeFilter]);

  const topBoards = useMemo(() => {
    const boardMap = new Map<
      string,
      { board: Board; totalSeconds: number; users: Set<string> }
    >();
    for (const entry of timeEntries) {
      if (!entry.client_id || !entry.client_name) continue;
      const current = boardMap.get(entry.client_id) ?? {
        board: boards.find((b) => b.id === entry.client_id)!,
        totalSeconds: 0,
        users: new Set(),
      };
      current.totalSeconds += Number(entry.duration_seconds || 0);
      current.users.add(entry.user_id);
      boardMap.set(entry.client_id, current);
    }
    return Array.from(boardMap.values())
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .slice(0, 5);
  }, [timeEntries, boards]);

  const topUsers = useMemo(() => {
    const userMap = new Map<
      string,
      { name: string; email: string; totalSeconds: number; boards: number }
    >();
    for (const entry of timeEntries) {
      const name = entry.user_name || entry.full_name || "Unknown";
      const current = userMap.get(entry.user_id) ?? {
        name,
        email: entry.user_email || "",
        totalSeconds: 0,
        boards: 0,
      };
      current.totalSeconds += Number(entry.duration_seconds || 0);
      if (entry.client_id) current.boards += 1;
      userMap.set(entry.user_id, current);
    }
    return Array.from(userMap.values())
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .slice(0, 5);
  }, [timeEntries]);

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[#050505]">
      <Sidebar role={profile.primary_role ?? "manager"} />

      <main className="p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Everhour</h1>
            <p className="text-white/60 mt-2">Time tracking across boards</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as any)}
              className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
            </select>
          </div>
        </div>

        {/* Top Boards */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#080808] border border-white/10 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <TrendingUp className="text-orange-400" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Top Boards</h2>
                <p className="text-white/50">Most time tracked</p>
              </div>
            </div>
            <div className="space-y-3">
              {topBoards.map(({ board, totalSeconds, users }) => (
                <div
                  key={board.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center font-bold text-white text-sm">
                      {board.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{board.name}</p>
                      <p className="text-sm text-white/50">
                        {users.size} users
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-orange-400 text-lg">
                      {Math.round(totalSeconds / 3600)}h
                    </p>
                    <p className="text-xs text-white/50">
                      {Math.round(totalSeconds / 60)}m
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Users */}
          <div className="bg-[#080808] border border-white/10 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Users className="text-blue-400" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Top Members</h2>
                <p className="text-white/50">Most time tracked</p>
              </div>
            </div>
            <div className="space-y-3">
              {topUsers.map((user) => (
                <div
                  key={user.name}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center font-bold text-white text-sm">
                      {user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{user.name}</p>
                      <p className="text-xs text-white/50">
                        {user.boards} boards
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-400 text-lg">
                      {Math.round(user.totalSeconds / 3600)}h
                    </p>
                    <p className="text-xs text-white/50">
                      {Math.round(user.totalSeconds / 60)}m
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-[#080808] border border-white/10 rounded-3xl p-6 hover:shadow-lg transition">
            <div className="flex items-center gap-3 mb-4">
              <CalendarDays className="text-orange-400" size={24} />
              <h3 className="text-lg font-bold text-white">Calendar View</h3>
            </div>
            <p className="text-white/60 mb-4">Daily team hours overview</p>
            <a
              href="/everhour/calendar"
              className="inline-flex items-center gap-2 text-orange-400 font-semibold hover:text-orange-300"
            >
              View Calendar{" "}
              <ChevronDown className="-rotate-90" size={14} />
            </a>
          </div>
          <div className="bg-[#080808] border border-white/10 rounded-3xl p-6 hover:shadow-lg transition">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="text-green-400" size={24} />
              <h3 className="text-lg font-bold text-white">Team Timesheets</h3>
            </div>
            <p className="text-white/60 mb-4">Approve and review team hours</p>
            <a
              href="/everhour/team"
              className="inline-flex items-center gap-2 text-green-400 font-semibold hover:text-green-300"
            >
              View Timesheets{" "}
              <ChevronDown className="-rotate-90" size={14} />
            </a>
          </div>
          <div className="bg-[#080808] border border-white/10 rounded-3xl p-6 hover:shadow-lg transition">
            <div className="flex items-center gap-3 mb-4">
              <Users className="text-blue-400" size={24} />
              <h3 className="text-lg font-bold text-white">Board Reports</h3>
            </div>
            <p className="text-white/60 mb-4">
              Detailed board analytics & export
            </p>
            <button className="inline-flex items-center gap-2 text-blue-400 font-semibold hover:text-blue-300">
              Generate Report <Download size={14} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
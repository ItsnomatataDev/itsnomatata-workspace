import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import {
  Clock,
  Users,
  Download,
  Edit3,
  Check,
  DollarSign,
  ChevronLeft,
} from "lucide-react";
import { getAdminTimeEntries } from "../../../lib/supabase/queries/adminTime";
import type { AdminTimeEntryRow } from "../../../lib/supabase/queries/adminTime";
import { supabase } from "../../../lib/supabase/client";

type BoardUserTime = {
  user_id: string;
  user_name: string;
  user_email: string;
  total_seconds: number;
  billable_seconds: number;
  entries: AdminTimeEntryRow[];
};

export default function EverhourBoardDetail() {
  const { boardId } = useParams<{ boardId: string }>();
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const organizationId = profile?.organization_id ?? "";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [timeEntries, setTimeEntries] = useState<AdminTimeEntryRow[]>([]);
  const [editing, setEditing] = useState<Record<string, number>>({});
  const [period, setPeriod] = useState("week");

  useEffect(() => {
    if (!organizationId || !boardId) return;

    const load = async () => {
      setLoading(true);
      try {
        const entries = await getAdminTimeEntries({
          organizationId,
          clientId: boardId,
          approvalStatus: "all",
          ...getPeriodFilter(period),
        });
        setTimeEntries(entries);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [organizationId, boardId, period]);

  const boardUsers = useMemo((): BoardUserTime[] => {
    const userMap = new Map<string, BoardUserTime>();
    for (const entry of timeEntries) {
      const userId = entry.user_id;
      const current = userMap.get(userId) ?? {
        user_id: userId,
        user_name: entry.user_name || "Unknown",
        user_email: entry.user_email || "",
        total_seconds: 0,
        billable_seconds: 0,
        entries: [],
      };
      current.total_seconds += Number(entry.duration_seconds || 0);
      if (entry.is_billable)
        current.billable_seconds += Number(entry.duration_seconds || 0);
      current.entries.push(entry);
      userMap.set(userId, current);
    }
    return Array.from(userMap.values()).sort(
      (a, b) => b.total_seconds - a.total_seconds,
    );
  }, [timeEntries]);

  const formatHours = (seconds: number) =>
    `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;

  const updateHours = async (userId: string, newHours: number) => {
    const user = boardUsers.find((u) => u.user_id === userId);
    if (!user || !boardId) return;

    // Update first entry as proxy (or create new)
    const entryId = user.entries[0]?.id;
    if (entryId) {
      const newSeconds = newHours * 3600;
      const { error } = await supabase
        .from("time_entries")
        .update({ duration_seconds: newSeconds })
        .eq("id", entryId)
        .eq("organization_id", organizationId);
      if (!error) {
        setTimeEntries((prev) =>
          prev.map((e) =>
            e.id === entryId ? { ...e, duration_seconds: newSeconds } : e,
          ),
        );
      }
    }
  };

  const exportCSV = () => {
    const csv = [
      ["User", "Email", "Total Hours", "Billable Hours", "Tasks"],
      ...boardUsers.map((u) => [
        u.user_name,
        u.user_email,
        formatHours(u.total_seconds),
        formatHours(u.billable_seconds),
        u.entries.length,
      ]),
    ]
      .map((row) =>
        row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(","),
      )
      .join("\\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `board-${boardId}-timesheet.csv`;
    a.click();
  };

  if (!profile || !boardId) return null;

  return (
    <div className="min-h-screen bg-[#050505]">
      <Sidebar role={profile.primary_role ?? "manager"} />

      <main className="p-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => navigate("/everhour")}
            className="p-2 rounded-xl hover:bg-white/10"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">Board Timesheet</h1>
            <p className="text-white/60">Team time on this board</p>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="ml-auto rounded-xl bg-white/5 border px-4 py-2"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="last_week">Last Week</option>
          </select>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#080808] p-6 rounded-3xl border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <Users className="text-blue-400" size={24} />
              <h3 className="font-bold text-white">Team Members</h3>
            </div>
            <p className="text-3xl font-bold text-blue-400">
              {boardUsers.length}
            </p>
          </div>
          <div className="bg-[#080808] p-6 rounded-3xl border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="text-orange-400" size={24} />
              <h3 className="font-bold text-white">Total Hours</h3>
            </div>
            <p className="text-3xl font-bold text-orange-400">
              {formatHours(
                boardUsers.reduce((sum, u) => sum + u.total_seconds, 0),
              )}
            </p>
          </div>
          <div className="bg-[#080808] p-6 rounded-3xl border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="text-green-400" size={24} />
              <h3 className="font-bold text-white">Billable</h3>
            </div>
            <p className="text-3xl font-bold text-green-400">
              {formatHours(
                boardUsers.reduce((sum, u) => sum + u.billable_seconds, 0),
              )}
            </p>
          </div>
        </div>
        <div className="bg-[#080808] rounded-3xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Team Time</h2>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-xl text-white font-semibold"
            >
              <Download size={16} /> Export CSV
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400"></div>
            </div>
          ) : boardUsers.length === 0 ? (
            <div className="text-center py-12 text-white/50">
              No time entries for this board in selected period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 font-semibold text-white/70">
                      User
                    </th>
                    <th className="text-right p-4 font-semibold text-white/70">
                      Total Hours
                    </th>
                    <th className="text-right p-4 font-semibold text-white/70">
                      Billable
                    </th>
                    <th className="text-right p-4 font-semibold text-white/70">
                      Entries
                    </th>
                    <th className="text-right p-4 font-semibold text-white/70">
                      Edit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {boardUsers.map((user) => (
                    <tr
                      key={user.user_id}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="p-4">
                        <div>
                          <p className="font-semibold text-white">
                            {user.user_name}
                          </p>
                          <p className="text-sm text-white/50">
                            {user.user_email}
                          </p>
                        </div>
                      </td>
                      <td className="p-4 text-right font-semibold text-orange-400">
                        {formatHours(user.total_seconds)}
                      </td>
                      <td className="p-4 text-right font-semibold text-green-400">
                        {formatHours(user.billable_seconds)}
                      </td>
                      <td className="p-4 text-right text-white/50">
                        {user.entries.length}
                      </td>
                      <td className="p-4 text-right">
                        <input
                          type="number"
                          value={
                            editing[user.user_id] ||
                            Math.round(user.total_seconds / 3600)
                          }
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              [user.user_id]: Number(e.target.value),
                            })
                          }
                          onBlur={() =>
                            updateHours(
                              user.user_id,
                              editing[user.user_id] || 0,
                            )
                          }
                          className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-right text-white focus:outline-none focus:border-orange-400"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

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
      const lastWeekStart = new Date(now);
      lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
      lastWeekStart.setHours(0, 0, 0, 0);
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
      lastWeekEnd.setHours(23, 59, 59, 999);
      return {
        from: lastWeekStart.toISOString(),
        to: lastWeekEnd.toISOString(),
      };
    case "last_2_weeks":
      const last2WeeksStart = new Date(now);
      last2WeeksStart.setDate(now.getDate() - now.getDay() - 14);
      last2WeeksStart.setHours(0, 0, 0, 0);
      return { from: last2WeeksStart.toISOString(), to: now.toISOString() };
    case "month":
      fromDate.setDate(1);
      fromDate.setHours(0, 0, 0, 0);
      return { from: fromDate.toISOString(), to: now.toISOString() };
    case "last_month":
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        from: lastMonthStart.toISOString(),
        to: lastMonthEnd.toISOString(),
      };
    default:
      return { from: "2024-01-01T00:00:00Z", to: now.toISOString() };
  }
}

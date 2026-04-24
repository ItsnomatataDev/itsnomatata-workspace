import { useState, useEffect } from "react";
import { Calendar, Clock, User, CheckCircle, XCircle, Filter, Download, Search } from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { TimeTrackingService } from "../services/timeTrackingService";
import type { TimeSession, TimesheetSummary } from "../types/timeTracking";

export default function AdminTimesheetView() {
  const auth = useAuth();
  const userId = auth?.user?.id;
  const organizationId = auth?.profile?.organization_id;

  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [summaries, setSummaries] = useState<TimesheetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"sessions" | "summaries">("sessions");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (organizationId) {
      loadData();
    }
  }, [organizationId, startDate, endDate, selectedUser, viewMode]);

  const loadData = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      if (viewMode === "sessions") {
        const { sessions: sessionData } = await TimeTrackingService.getAllOrganizationSessions(
          organizationId,
          {
            startDate: startDate ? `${startDate}T00:00:00Z` : undefined,
            endDate: endDate ? `${endDate}T23:59:59Z` : undefined,
            userId: selectedUser || undefined,
            limit: 100,
          }
        );
        setSessions(sessionData);
      } else {
        const { summaries: summaryData } = await TimeTrackingService.getTimesheetSummaries({
          organizationId,
          periodStart: startDate ? `${startDate}T00:00:00Z` : "",
          periodEnd: endDate ? `${endDate}T23:59:59Z` : "",
          userId: selectedUser || undefined,
        });
        setSummaries(summaryData);
      }
    } catch (error) {
      console.error("Error loading timesheet data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (summaryId: string) => {
    if (!userId) return;
    try {
      await TimeTrackingService.approveTimesheet(summaryId, userId);
      loadData();
    } catch (error) {
      console.error("Error approving timesheet:", error);
      alert("Failed to approve timesheet");
    }
  };

  const handleReject = async (summaryId: string) => {
    if (!userId) return;
    const notes = prompt("Enter rejection reason:");
    if (notes === null) return;
    try {
      await TimeTrackingService.rejectTimesheet(summaryId, userId, notes);
      loadData();
    } catch (error) {
      console.error("Error rejecting timesheet:", error);
      alert("Failed to reject timesheet");
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "0h 0m";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/15 text-green-300";
      case "completed":
        return "bg-blue-500/15 text-blue-300";
      case "auto_clocked_out":
        return "bg-amber-500/15 text-amber-300";
      case "approved":
        return "bg-emerald-500/15 text-emerald-300";
      case "rejected":
        return "bg-red-500/15 text-red-300";
      case "submitted":
        return "bg-purple-500/15 text-purple-300";
      default:
        return "bg-gray-500/15 text-gray-300";
    }
  };

  const filteredSessions = sessions.filter((session) =>
    session.userId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSummaries = summaries.filter((summary) =>
    summary.userId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Timesheet Management</h2>
          <p className="text-white/60 mt-1">View and manage employee time tracking</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("sessions")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === "sessions"
                ? "bg-orange-500 text-white"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            Sessions
          </button>
          <button
            onClick={() => setViewMode("summaries")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === "summaries"
                ? "bg-orange-500 text-white"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            Summaries
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-orange-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-orange-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">User ID</label>
            <input
              type="text"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              placeholder="Filter by user ID"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-orange-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-3 py-2 text-white placeholder:text-white/40 focus:border-orange-500/50 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 mt-4">Loading...</p>
        </div>
      ) : viewMode === "sessions" ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/60">User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/60">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/60">Clock In</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/60">Clock Out</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/60">Duration</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/60">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-white/40">
                      No sessions found
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((session) => (
                    <tr key={session.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                            <User className="w-4 h-4 text-orange-400" />
                          </div>
                          <span className="text-sm text-white">{session.userId}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-white/80">{formatDate(session.clockIn)}</td>
                      <td className="px-6 py-4 text-sm text-white/80">{formatTime(session.clockIn)}</td>
                      <td className="px-6 py-4 text-sm text-white/80">
                        {session.clockOut ? formatTime(session.clockOut) : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-white/80">
                        {formatDuration(session.durationMinutes)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            session.status
                          )}`}
                        >
                          {session.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSummaries.length === 0 ? (
            <div className="text-center py-12 text-white/40">No summaries found</div>
          ) : (
            filteredSummaries.map((summary) => (
              <div
                key={summary.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-white/20 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <User className="w-6 h-6 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{summary.userId}</h3>
                      <p className="text-sm text-white/60">
                        {formatDate(summary.periodStart)} - {formatDate(summary.periodEnd)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      summary.status
                    )}`}
                  >
                    {summary.status}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="rounded-lg bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-white/60 mb-1">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Total Hours</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{summary.totalHours.toFixed(2)}h</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-white/60 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Sessions</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{summary.sessionsCount}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-white/60 mb-1">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Work Time</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{formatDuration(summary.workMinutes)}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-white/60 mb-1">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Break Time</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{formatDuration(summary.breakMinutes)}</p>
                  </div>
                </div>

                {summary.status === "submitted" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(summary.id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-all"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(summary.id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-all"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                )}

                {summary.notes && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-sm text-white/60">
                      <span className="font-medium">Notes:</span> {summary.notes}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

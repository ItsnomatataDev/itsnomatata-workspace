import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Mail, User, Clock3 } from "lucide-react";
import { useParams } from "react-router-dom";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  getEmployeeById,
  getEmployeeTimeEntries,
  type EmployeeDetailRow,
  type TimeEntryRow,
} from "../services/adminService";

function getEntrySeconds(entry: TimeEntryRow) {
  if (
    typeof entry.duration_seconds === "number" &&
    entry.duration_seconds >= 0
  ) {
    return entry.duration_seconds;
  }

  const startMs = new Date(entry.started_at).getTime();
  const endMs = entry.ended_at
    ? new Date(entry.ended_at).getTime()
    : Date.now();

  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatHours(totalSeconds: number) {
  return `${(totalSeconds / 3600).toFixed(2)}h`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Running";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function AdminEmployeeDetailsPage() {
  const { userId } = useParams();
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const authLoading = auth?.loading ?? true;
  const organizationId = profile?.organization_id ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [employee, setEmployee] = useState<EmployeeDetailRow | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntryRow[]>([]);

  const loadPage = useCallback(async () => {
    if (!organizationId || !userId) return;

    try {
      setLoading(true);
      setError("");

      const [employeeData, entriesData] = await Promise.all([
        getEmployeeById(userId),
        getEmployeeTimeEntries({
          organizationId,
          userId,
        }),
      ]);

      setEmployee(employeeData);
      setTimeEntries(entriesData);
    } catch (err: any) {
      console.error("ADMIN EMPLOYEE DETAILS LOAD ERROR:", err);
      setError(err?.message || "Failed to load employee details.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const totalSeconds = useMemo(() => {
    return timeEntries.reduce((sum, entry) => sum + getEntrySeconds(entry), 0);
  }, [timeEntries]);

  const handleDownload = () => {
    if (!employee) return;

    const rows = [
      ["Employee", employee.full_name || ""],
      ["Email", employee.email || ""],
      ["Role", employee.primary_role || ""],
      ["Total Time", formatDuration(totalSeconds)],
      [""],
      ["Started At", "Ended At", "Duration", "Hours", "Description"],
      ...timeEntries.map((entry) => {
        const seconds = getEntrySeconds(entry);

        return [
          entry.started_at,
          entry.ended_at || "",
          formatDuration(seconds),
          (seconds / 3600).toFixed(2),
          entry.description || "",
        ];
      }),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${employee.full_name || employee.email || "employee"}-timesheet.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">Loading...</div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile?.primary_role} />

        <main className="flex-1 p-6 lg:p-8">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading employee details...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
              {error}
            </div>
          ) : !employee ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Employee not found.
            </div>
          ) : (
            <>
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                    Admin Workspace
                  </p>
                  <h1 className="mt-2 text-3xl font-bold">
                    {employee.full_name || "Employee Details"}
                  </h1>
                  <p className="mt-2 text-sm text-white/50">
                    Individual user information and downloadable timesheet.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400"
                >
                  <Download size={16} />
                  Download Timesheet
                </button>
              </div>

              <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <User size={18} className="text-orange-500" />
                    <p className="text-sm text-white/60">Role</p>
                  </div>
                  <p className="mt-4 text-xl font-bold text-white">
                    {employee.primary_role || "No role"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <Mail size={18} className="text-orange-500" />
                    <p className="text-sm text-white/60">Email</p>
                  </div>
                  <p className="mt-4 text-sm font-medium text-white">
                    {employee.email || "No email"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <Clock3 size={18} className="text-orange-500" />
                    <p className="text-sm text-white/60">Entries</p>
                  </div>
                  <p className="mt-4 text-xl font-bold text-white">
                    {timeEntries.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <Clock3 size={18} className="text-orange-500" />
                    <p className="text-sm text-white/60">Total Time</p>
                  </div>
                  <p className="mt-4 text-xl font-bold text-white">
                    {formatHours(totalSeconds)}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {formatDuration(totalSeconds)}
                  </p>
                </div>
              </section>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-white/80">
                    <thead className="bg-white/5 text-white/50">
                      <tr>
                        <th className="px-4 py-3 font-medium">Started At</th>
                        <th className="px-4 py-3 font-medium">Ended At</th>
                        <th className="px-4 py-3 font-medium">Duration</th>
                        <th className="px-4 py-3 font-medium">Hours</th>
                        <th className="px-4 py-3 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeEntries.map((entry) => {
                        const seconds = getEntrySeconds(entry);

                        return (
                          <tr
                            key={entry.id}
                            className="border-t border-white/10"
                          >
                            <td className="px-4 py-3">
                              {formatDateTime(entry.started_at)}
                            </td>
                            <td className="px-4 py-3">
                              {formatDateTime(entry.ended_at)}
                            </td>
                            <td className="px-4 py-3">
                              {formatDuration(seconds)}
                            </td>
                            <td className="px-4 py-3">
                              {(seconds / 3600).toFixed(2)}h
                            </td>
                            <td className="px-4 py-3 text-white/65">
                              {entry.description || "No description"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

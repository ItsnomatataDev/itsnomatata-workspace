import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Clock3, Eye, FileText } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  getClientById,
  getClientInvitedTasks,
  getClientVisibleTaskTimeSummary,
  type ClientItem,
  type ClientWorkspaceTaskItem,
} from "../services/clientService";
import { getTaskSubmissions } from "../../../lib/supabase/queries/taskSubmissions";

function formatDurationHms(seconds?: number | null) {
  const total = Math.max(0, Math.floor(Number(seconds ?? 0)));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const hh = String(hrs).padStart(2, "0");
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");

  return `${hh}:${mm}:${ss}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function ClientWorkspacePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { clientId } = useParams();

  if (!auth?.user || !auth?.profile) return null;

  const { profile } = auth;
  const organizationId = profile.organization_id;

  if (!organizationId || !clientId) return null;

  const [client, setClient] = useState<ClientItem | null>(null);
  const [tasks, setTasks] = useState<ClientWorkspaceTaskItem[]>([]);
  const [timeMap, setTimeMap] = useState<Record<string, number>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskSubmissions, setSelectedTaskSubmissions] = useState<any[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const [clientRow, taskRows] = await Promise.all([
          getClientById(organizationId, clientId),
          getClientInvitedTasks({ organizationId, clientId }),
        ]);

        setClient(clientRow);
        setTasks(taskRows);

        const summaries = await Promise.all(
          taskRows.map((task) =>
            getClientVisibleTaskTimeSummary({
              organizationId,
              taskId: task.id,
            }),
          ),
        );

        const nextMap: Record<string, number> = {};
        for (const summary of summaries) {
          nextMap[summary.task_id] = summary.total_seconds;
        }
        setTimeMap(nextMap);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load client workspace.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [organizationId, clientId]);

  const handleOpenTask = async (taskId: string) => {
    try {
      setDetailLoading(true);
      setSelectedTaskId(taskId);
      const submissions = await getTaskSubmissions(taskId);
      setSelectedTaskSubmissions(submissions);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load task details.";
      setError(message);
    } finally {
      setDetailLoading(false);
    }
  };

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role ?? "manager"} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <button
            type="button"
            onClick={() => navigate(`/clients/${clientId}`)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80"
          >
            Back to client details
          </button>

          {loading ? (
            <div className="mt-6 text-white/60">
              Loading client workspace...
            </div>
          ) : error ? (
            <div className="mt-6 border border-red-500/20 bg-red-500/10 p-4 text-red-300">
              {error}
            </div>
          ) : !client ? (
            <div className="mt-6 text-white/50">Client not found.</div>
          ) : (
            <>
              <p className="mt-6 text-xs uppercase tracking-[0.3em] text-orange-500">
                Client Workspace
              </p>
              <h1 className="mt-2 text-3xl font-bold">{client.name}</h1>
              <p className="mt-2 text-sm text-white/50">
                Invited cards, tracked time, and submitted work.
              </p>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.95fr]">
                <section className="space-y-4">
                  {tasks.length === 0 ? (
                    <div className="border border-white/10 bg-[#050505] p-5 text-white/50">
                      No invited task cards for this client yet.
                    </div>
                  ) : (
                    tasks.map((task) => (
                      <div
                        key={task.id}
                        className="border border-white/10 bg-[#050505] p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h2 className="truncate text-lg font-semibold text-white">
                              {task.title}
                            </h2>
                            <p className="mt-2 text-sm text-white/60">
                              {task.description || "No description"}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => void handleOpenTask(task.id)}
                            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black"
                          >
                            <Eye size={14} />
                            Open
                          </button>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/70">
                            {task.status.replaceAll("_", " ")}
                          </span>
                          <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/70">
                            {task.priority}
                          </span>
                          <span className="rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-orange-300">
                            Due: {formatDate(task.due_date)}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center gap-2 text-sm text-white">
                          <Clock3 size={14} className="text-orange-400" />
                          <span>
                            Tracked on this card:{" "}
                            {formatDurationHms(
                              timeMap[task.id] ??
                                task.tracked_seconds_cache ??
                                0,
                            )}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </section>

                <section className="border border-white/10 bg-[#050505] p-6">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-orange-400" />
                    <h2 className="text-xl font-semibold">Task Details</h2>
                  </div>

                  {!selectedTask ? (
                    <p className="mt-6 text-white/50">
                      Select a card to view tracked time and submissions.
                    </p>
                  ) : detailLoading ? (
                    <p className="mt-6 text-white/60">
                      Loading task details...
                    </p>
                  ) : (
                    <div className="mt-6 space-y-4">
                      <div className="border border-white/10 bg-black/30 p-4">
                        <p className="text-sm text-white/45">Card</p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {selectedTask.title}
                        </p>
                        <p className="mt-2 text-sm text-white/65">
                          {selectedTask.description || "No description"}
                        </p>
                      </div>

                      <div className="border border-white/10 bg-black/30 p-4">
                        <p className="text-sm text-white/45">Tracked time</p>
                        <p className="mt-2 text-2xl font-bold text-white">
                          {formatDurationHms(
                            timeMap[selectedTask.id] ??
                              selectedTask.tracked_seconds_cache ??
                              0,
                          )}
                        </p>
                      </div>

                      <div className="border border-white/10 bg-black/30 p-4">
                        <p className="text-sm text-white/45">Submissions</p>

                        {selectedTaskSubmissions.length === 0 ? (
                          <p className="mt-2 text-sm text-white/50">
                            No submissions yet.
                          </p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {selectedTaskSubmissions.map((submission) => (
                              <div
                                key={submission.id}
                                className="rounded-xl border border-white/10 bg-[#050505] p-4"
                              >
                                <p className="font-medium text-white">
                                  {submission.title}
                                </p>
                                <p className="mt-1 text-xs text-white/45">
                                  {submission.submission_type} •{" "}
                                  {submission.approval_status}
                                </p>

                                {submission.link_url ? (
                                  <a
                                    href={submission.link_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-3 block text-sm text-orange-400 underline"
                                  >
                                    Open link
                                  </a>
                                ) : null}

                                {submission.signed_file_url ? (
                                  <a
                                    href={submission.signed_file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 block text-sm text-orange-400 underline"
                                  >
                                    Open file
                                  </a>
                                ) : null}

                                {submission.notes ? (
                                  <p className="mt-3 text-sm text-white/70">
                                    {submission.notes}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Brain, Clock3, Sparkles } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useTimeEntries } from "../../../lib/hooks/useTimeEntries";
import type { TimeEntryItem } from "../../../lib/supabase/mutations/timeEntries";
import TimerWidget from "../components/TimerWidget";
import MyTimeSummaryCards from "../components/MyTimeSummaryCards";
import MyTimeEntriesTable from "../components/MyTimeEntriesTable";
import TimeEntryFormModal from "../components/TimeEntryFormModal";
import { updateTimeEntry } from "../../../lib/supabase/mutations/timeEntries";

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfWeek(date: Date) {
  const clone = new Date(date);
  const day = clone.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  clone.setDate(clone.getDate() + diff);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function getEntrySeconds(entry: TimeEntryItem) {
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

function formatDuration(seconds: number) {
  const total = Math.max(0, Number(seconds || 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

export default function TimePage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const user = auth?.user ?? null;

  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntryItem | null>(null);

  if (!profile || !user) return null;

  const organizationId = profile.organization_id ?? null;

  const {
    entries,
    activeEntry,
    loading,
    mutating,
    startEntry,
    stopActiveEntry,
    resumeEntry,
    deleteEntry,
    createManualEntry,
    refresh,
  } = useTimeEntries({
    organizationId: organizationId ?? "",
    userId: user.id,
  });

  if (!organizationId) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="flex min-h-screen">
          <Sidebar role={profile.primary_role ?? "manager"} />
          <main className="min-w-0 flex-1 overflow-hidden p-6 lg:p-8">
            <div className="border border-red-500/20 bg-red-500/10 p-5 text-red-300">
              Your account is not linked to an organization yet.
            </div>
          </main>
        </div>
      </div>
    );
  }

  const now = new Date();
  const weekStart = startOfWeek(now);

  const todaySeconds = useMemo(() => {
    return entries.reduce((sum, entry) => {
      const started = new Date(entry.started_at);
      return sameDay(started, now) ? sum + getEntrySeconds(entry) : sum;
    }, 0);
  }, [entries]);

  const weekSeconds = useMemo(() => {
    return entries.reduce((sum, entry) => {
      const started = new Date(entry.started_at);
      return started >= weekStart ? sum + getEntrySeconds(entry) : sum;
    }, 0);
  }, [entries]);

  const billableSeconds = useMemo(() => {
    return entries.reduce((sum, entry) => {
      return entry.is_billable ? sum + getEntrySeconds(entry) : sum;
    }, 0);
  }, [entries]);

  const totalCost = useMemo(() => {
    return entries.reduce((sum, entry) => {
      return sum + Number(entry.cost_amount ?? 0);
    }, 0);
  }, [entries]);

  const recentEntries = useMemo(() => {
    return [...entries]
      .sort((a, b) => {
        return (
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        );
      })
      .slice(0, 20);
  }, [entries]);

  const insightMessages = useMemo(() => {
    const items: string[] = [];

    if (!activeEntry && todaySeconds === 0) {
      items.push("No time has been logged today yet.");
    }

    if (activeEntry) {
      items.push("You have a live timer running right now.");
    }

    const noDescriptionCount = entries.filter(
      (entry) => !entry.description || !entry.description.trim(),
    ).length;

    if (noDescriptionCount > 0) {
      items.push(
        `${noDescriptionCount} recent entr${
          noDescriptionCount === 1 ? "y has" : "ies have"
        } no description.`,
      );
    }

    if (billableSeconds > 0) {
      items.push(
        `${formatDuration(billableSeconds)} of your visible time is billable.`,
      );
    }

    if (items.length === 0) {
      items.push("Your recent time data looks healthy.");
    }

    return items.slice(0, 4);
  }, [activeEntry, todaySeconds, entries, billableSeconds]);

  const handleStartQuickTimer = async () => {
    await startEntry({
      description: "General work",
      isBillable: false,
      source: "timer",
      metadata: {
        started_from: "my_time_page",
      },
    });
  };

  const handleSaveManualEntry = async (values: {
    description: string;
    startedAt: string;
    endedAt: string;
    isBillable: boolean;
    taskId: string;
    projectId: string;
    clientId: string;
    campaignId: string;
  }) => {
    await createManualEntry({
      description: values.description || "Manual entry",
      startedAt: new Date(values.startedAt).toISOString(),
      endedAt: new Date(values.endedAt).toISOString(),
      taskId: values.taskId || undefined,
      projectId: values.projectId || undefined,
      clientId: values.clientId || undefined,
      campaignId: values.campaignId || undefined,
      isBillable: values.isBillable,
      source: "manual",
      metadata: {
        created_from: "my_time_manual_modal",
      },
    });

    setManualEntryOpen(false);
    await refresh();
  };

  const handleUpdateEntry = async (
    entryId: string,
    values: {
      description: string;
      startedAt: string;
      endedAt: string;
      isBillable: boolean;
      taskId: string;
      projectId: string;
      clientId: string;
      campaignId: string;
    },
  ) => {
    await updateTimeEntry({
      entryId,
      payload: {
        description: values.description || null,
        started_at: new Date(values.startedAt).toISOString(),
        ended_at: new Date(values.endedAt).toISOString(),
        task_id: values.taskId || null,
        project_id: values.projectId || null,
        client_id: values.clientId || null,
        campaign_id: values.campaignId || null,
        is_billable: values.isBillable,
      },
    });

    setEditingEntry(null);
    await refresh();
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role ?? "manager"} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Everhour Workspace
              </p>
              <h1 className="mt-2 text-3xl font-bold">My Time</h1>
              <p className="mt-2 text-sm text-white/50">
                Track work, add manual entries, and review your recent
                timesheet.
              </p>
            </div>

            <div className="border border-white/10 bg-[#050505] px-4 py-3 text-sm text-white/65">
              {loading
                ? "Loading entries..."
                : `${entries.length} visible entries`}
            </div>
          </div>

          <div className="mb-6">
            <MyTimeSummaryCards
              todaySeconds={todaySeconds}
              weekSeconds={weekSeconds}
              billableSeconds={billableSeconds}
              totalCost={totalCost}
            />
          </div>

          <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_380px]">
            <TimerWidget
              activeEntry={activeEntry}
              mutating={mutating}
              onStartQuickTimer={handleStartQuickTimer}
              onStopTimer={async () => {
                await stopActiveEntry();
              }}
              onOpenManualEntry={() => setManualEntryOpen(true)}
            />

            <section className="border border-white/10 bg-[#050505] p-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="border border-orange-500/20 bg-orange-500/10 p-2 text-orange-400">
                  <Brain size={18} />
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Time Insights
                  </h3>
                  <p className="text-sm text-white/45">
                    Smart signals from your recent work logs
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {insightMessages.map((message, index) => (
                  <div
                    key={`${message}-${index}`}
                    className="border border-white/10 bg-black/40 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-orange-400">
                        <Sparkles size={15} />
                      </div>
                      <p className="text-sm leading-6 text-white/75">
                        {message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="border border-white/10 bg-[#050505] p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Recent Entries
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  Resume, edit, delete, or review your last tracked sessions.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 border border-white/10 bg-black px-3 py-2 text-xs text-white/45">
                <Clock3 size={13} />
                Latest 20 entries
              </div>
            </div>

            <MyTimeEntriesTable
              entries={recentEntries}
              activeEntry={activeEntry}
              mutating={mutating}
              onResumeEntry={async (entryId) => {
                await resumeEntry(entryId);
              }}
              onDeleteEntry={deleteEntry}
              onEditEntry={(entry) => setEditingEntry(entry)}
            />
          </section>
        </main>
      </div>

      <TimeEntryFormModal
        open={manualEntryOpen}
        busy={mutating}
        title="Add Manual Time Entry"
        onClose={() => setManualEntryOpen(false)}
        onSaveManualEntry={handleSaveManualEntry}
        onUpdateEntry={handleUpdateEntry}
      />

      <TimeEntryFormModal
        open={Boolean(editingEntry)}
        busy={mutating}
        title="Edit Time Entry"
        initialEntry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSaveManualEntry={handleSaveManualEntry}
        onUpdateEntry={handleUpdateEntry}
      />
    </div>
  );
}

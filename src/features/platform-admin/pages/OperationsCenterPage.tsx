import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  Database,
  RefreshCw,
  ShieldCheck,
  Users,
  Video,
  Zap,
} from "lucide-react";

import Sidebar from "../../../components/dashboard/components/Sidebar";
import {
  checkIsPlatformAdmin,
  getOperationsCenterMetrics,
} from "../services/platformAdminService";
import type { OperationsCenterMetrics } from "../types/platformAdmin";

function metricTone(value: "healthy" | "warning" | "critical") {
  if (value === "critical") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (value === "warning") return "border-orange-500/30 bg-orange-500/10 text-orange-200";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
}

function OpsCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClasses = {
    default: "border-white/10 bg-[#151515]",
    warning: "border-orange-500/25 bg-orange-500/10",
    danger: "border-red-500/25 bg-red-500/10",
  };

  return (
    <div className={`rounded-3xl border p-5 shadow-xl shadow-black/25 ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold text-white">{value}</p>
          {hint ? <p className="mt-1 text-sm text-white/45">{hint}</p> : null}
        </div>
        <div className="rounded-2xl bg-orange-500/10 p-3 text-orange-400">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function OperationsCenterPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [metrics, setMetrics] = useState<OperationsCenterMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const isAdmin = await checkIsPlatformAdmin();
      setAllowed(isAdmin);
      if (!isAdmin) return;

      setMetrics(await getOperationsCenterMetrics());
    } catch (err) {
      console.error("LOAD OPERATIONS CENTER ERROR:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load operations center.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex min-h-screen bg-[#090909] text-white">
      <Sidebar />

      <main className="flex-1 space-y-6 overflow-x-hidden p-4 sm:p-6">
        <div className="rounded-3xl border border-white/10 bg-[#111111] p-5 shadow-xl shadow-black/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-orange-500">
                <Activity size={18} />
                Operations Center
              </div>
              <h1 className="mt-2 text-2xl font-bold text-white">
                Global Enterprise Control Room
              </h1>
              <p className="mt-1 text-sm text-white/60">
                Realtime platform health, adoption, automation, AI, meetings and
                organization activity from live Supabase data.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {allowed === false ? (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
            Platform admin access is required.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-[#111111] p-8 text-center text-sm text-white/45">
            Loading realtime operations...
          </div>
        ) : metrics ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <OpsCard
                label="Organizations"
                value={metrics.totalOrganizations}
                hint={`${metrics.activeOrganizations} active, ${metrics.suspendedOrganizations} suspended`}
                icon={Building2}
              />
              <OpsCard
                label="Active Users"
                value={metrics.totalActiveUsers}
                hint={`${metrics.usersOnlineNow} online now`}
                icon={Users}
              />
              <OpsCard
                label="Active Meetings"
                value={metrics.activeMeetings}
                hint={`${metrics.meetingFailures} meeting failures`}
                icon={Video}
                tone={metrics.meetingFailures > 0 ? "warning" : "default"}
              />
              <OpsCard
                label="AI Requests"
                value={metrics.aiRequests}
                hint="Last 7 days"
                icon={Bot}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <OpsCard
                label="Automations"
                value={metrics.automationExecutions}
                hint={`${metrics.failedAutomations} failed`}
                icon={Zap}
                tone={metrics.failedAutomations > 0 ? "warning" : "default"}
              />
              <OpsCard
                label="Task Completion"
                value={`${metrics.taskCompletionRate}%`}
                hint="All organizations"
                icon={CheckCircle2}
              />
              <OpsCard
                label="Attendance Summaries"
                value={metrics.attendanceSummaries}
                hint="Last 7 days"
                icon={ShieldCheck}
              />
              <OpsCard
                label="Storage Usage"
                value={`${metrics.storageUsage} GB`}
                hint="Supabase storage telemetry"
                icon={Database}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div
                className={`rounded-3xl border p-5 ${metricTone(metrics.realtimeSystemHealth)}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Realtime System Health
                </p>
                <p className="mt-3 text-2xl font-bold capitalize">
                  {metrics.realtimeSystemHealth}
                </p>
                <p className="mt-1 text-sm opacity-70">
                  {metrics.edgeFunctionFailures} edge function errors.
                </p>
              </div>

              <div
                className={`rounded-3xl border p-5 ${metricTone(metrics.notificationHealth)}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Notification Health
                </p>
                <p className="mt-3 text-2xl font-bold capitalize">
                  {metrics.notificationHealth}
                </p>
                <p className="mt-1 text-sm opacity-70">
                  Delivery failures are counted from notification logs.
                </p>
              </div>

              <div className="rounded-3xl border border-red-500/25 bg-red-500/10 p-5 text-red-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} />
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    Incidents & Workflow Failures
                  </p>
                </div>
                <p className="mt-3 text-2xl font-bold">
                  {metrics.incidents + metrics.workflowFailures}
                </p>
                <p className="mt-1 text-sm text-red-200/70">
                  {metrics.incidents} open incidents, {metrics.workflowFailures} workflow failures.
                </p>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

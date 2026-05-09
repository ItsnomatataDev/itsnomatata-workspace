import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  Lock,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  AUTOMATION_RECOMMENDATIONS,
  createAutomationBuildRequest,
  getAIReviewStatus,
  type AIReviewStatus,
  type AutomationRecommendation,
} from "../services/aiAutomationReviewService";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "yellow" | "red" | "blue";
}) {
  const tones = {
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
    red: "border-red-500/30 bg-red-500/10 text-red-200",
    blue: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  };

  return (
    <span className={cx("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", tones[tone])}>
      {label}
    </span>
  );
}

function priorityTone(priority: AutomationRecommendation["priority"]) {
  if (priority === "Easy") return "green";
  if (priority === "Medium") return "yellow";
  return "blue";
}

function riskTone(risk: AutomationRecommendation["risk"]) {
  if (risk === "Safe") return "green";
  if (risk === "Needs approval") return "yellow";
  return "red";
}

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  helper: string;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-white/55">{title}</p>
          <p className="mt-2 text-2xl font-bold text-white">{value}</p>
        </div>
        <div className="rounded-xl bg-orange-500/15 p-3 text-orange-300">
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-3 text-xs text-white/40">{helper}</p>
    </div>
  );
}

function RecommendationCard({
  item,
  disabled,
  onRequestBuild,
  busy,
}: {
  item: AutomationRecommendation;
  disabled: boolean;
  onRequestBuild: (item: AutomationRecommendation) => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#070707] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.22em] text-orange-400">
              {item.module}
            </p>
            {item.firstBuild ? <StatusPill label="Build first" tone="blue" /> : null}
          </div>
          <h3 className="mt-2 text-lg font-semibold text-white">{item.title}</h3>
          <p className="mt-2 text-sm leading-6 text-white/55">{item.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <StatusPill label={item.priority} tone={priorityTone(item.priority)} />
          <StatusPill label={item.risk} tone={riskTone(item.risk)} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.affectedTables.map((table) => (
          <span
            key={table}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/55"
          >
            {table}
          </span>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => onRequestBuild(item)}
          className="inline-flex items-center gap-2 rounded-xl border border-orange-500/35 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-100 transition hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldCheck size={15} />
          {busy ? "Saving..." : "Approve building later"}
        </button>
      </div>
    </div>
  );
}

export default function AIAutomationReviewPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const user = auth?.user ?? null;
  const authLoading = auth?.loading ?? true;
  const organizationId = profile?.organization_id ?? null;
  const userId = user?.id ?? null;

  const [status, setStatus] = useState<AIReviewStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const nextStatus = await getAIReviewStatus();
      setStatus(nextStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load AI automation review.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && userId) void loadStatus();
  }, [authLoading, loadStatus, userId]);

  const tableSummary = useMemo(() => {
    const checks = status?.tableChecks ?? [];
    const ready = checks.filter((item) => item.ok).length;
    const missing = checks.length - ready;
    return { ready, missing, total: checks.length };
  }, [status?.tableChecks]);

  const pendingSuggestions = useMemo(() => {
    const counts = status?.counts ?? [];
    return counts.find((item) => item.table === "ai_task_suggestions")?.count ?? 0;
  }, [status?.counts]);

  const handleRequestBuild = async (recommendation: AutomationRecommendation) => {
    if (!organizationId || !userId) return;

    try {
      setSavingId(recommendation.id);
      setNotice("");
      setError("");
      await createAutomationBuildRequest({
        organizationId,
        userId,
        recommendation,
      });
      setNotice(`Build request saved for ${recommendation.title}.`);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save build request.");
    } finally {
      setSavingId(null);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-black p-6 text-white">Loading AI automation review...</div>;
  }

  if (!user || !profile || !organizationId || !userId) {
    return <div className="min-h-screen bg-black p-6 text-white">Missing workspace context.</div>;
  }

  const connectionTone = status?.connection.status === "healthy"
    ? "green"
    : status?.connection.status === "offline"
      ? "red"
      : "yellow";

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile.primary_role} />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                AI Automation
              </p>
              <h1 className="mt-2 text-3xl font-bold">Automation Review</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
                Review n8n readiness, database coverage, and safe AI automation candidates before enabling anything live.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadStatus()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/75 hover:bg-white/5"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {error ? (
            <div className="mb-5 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="mb-5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              {notice}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Gateway"
              value={loading ? "..." : status?.connection.status ?? "Unknown"}
              helper={status?.connection.message ?? "Checking server-side AI gateway."}
              icon={PlugZap}
            />
            <MetricCard
              title="Required Tables"
              value={`${tableSummary.ready}/${tableSummary.total || "..."}`}
              helper={tableSummary.missing > 0 ? `${tableSummary.missing} table checks need attention.` : "Schema checks look ready."}
              icon={Database}
            />
            <MetricCard
              title="Pending Suggestions"
              value={pendingSuggestions}
              helper="AI-created work stays as suggestions before approval."
              icon={Bot}
            />
            <MetricCard
              title="n8n Webhook"
              value={status?.connection.n8nWebhookConfigured ? "Set" : "Not set"}
              helper="Production calls should go through the Edge Function gateway."
              icon={Lock}
            />
          </div>

          <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Connection Status</h2>
                <p className="mt-1 text-sm text-white/45">
                  Current AI/n8n readiness for this organization.
                </p>
              </div>
              <StatusPill label={status?.connection.status ?? "checking"} tone={connectionTone} />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <p className="text-sm text-white/45">Gateway checked</p>
                <p className="mt-2 text-sm font-medium text-white">
                  {status?.connection.checkedAt
                    ? new Date(status.connection.checkedAt).toLocaleString()
                    : "Not checked yet"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <p className="text-sm text-white/45">n8n webhook</p>
                <p className="mt-2 text-sm font-medium text-white">
                  {status?.connection.n8nWebhookConfigured ? "Configured server-side" : "Missing server-side env"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <p className="text-sm text-white/45">n8n API key</p>
                <p className="mt-2 text-sm font-medium text-white">
                  {status?.connection.n8nApiKeyConfigured ? "Configured" : "Optional or missing"}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Database size={18} className="text-orange-300" />
                <h2 className="text-xl font-semibold">Tables And Services</h2>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {(status?.tableChecks ?? []).map((item) => (
                  <div
                    key={item.table}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
                  >
                    <span className="min-w-0 truncate text-sm text-white/65">{item.table}</span>
                    {item.ok ? (
                      <CheckCircle2 size={16} className="shrink-0 text-emerald-300" />
                    ) : (
                      <AlertTriangle size={16} className="shrink-0 text-yellow-300" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={18} className="text-orange-300" />
                <h2 className="text-xl font-semibold">AI Recommendations</h2>
              </div>

              <div className="space-y-3">
                {(status?.recommendations ?? []).map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm leading-6 text-white/60"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Recommended Automations</h2>
                <p className="mt-1 text-sm text-white/45">
                  Approving here records a draft build request only. It does not enable auto-execution.
                </p>
              </div>
              <StatusPill label="No destructive AI actions" tone="green" />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {AUTOMATION_RECOMMENDATIONS.map((item) => (
                <RecommendationCard
                  key={item.id}
                  item={item}
                  disabled={!organizationId || !userId}
                  busy={savingId === item.id}
                  onRequestBuild={handleRequestBuild}
                />
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

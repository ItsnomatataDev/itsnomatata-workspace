import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock3,
  DollarSign,
  Timer,
  UserX,
} from "lucide-react";
import type { AdminTimeEntryRow } from "../../../lib/supabase/queries/adminTime";

function formatDuration(seconds: number) {
  const total = Math.max(0, Number(seconds || 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function formatMoney(amount: number) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

type InsightItem = {
  id: string;
  title: string;
  message: string;
  tone: "good" | "warning" | "neutral";
  icon: React.ReactNode;
};

export default function TimeInsightsPanel({
  entries,
  summary,
}: {
  entries: AdminTimeEntryRow[];
  summary: {
    totalSeconds: number;
    pendingCount: number;
    approvedSeconds: number;
    billableSeconds: number;
    activeCount: number;
    totalCost: number;
  };
}) {
  const insights: InsightItem[] = [];

  const rejectedCount = entries.filter(
    (entry) => entry.approval_status === "rejected",
  ).length;

  const pendingCount = entries.filter(
    (entry) => entry.approval_status === "pending",
  ).length;

  const missingDescriptionCount = entries.filter(
    (entry) => !entry.description || !entry.description.trim(),
  ).length;

  const longEntries = entries.filter(
    (entry) => Number(entry.duration_seconds ?? 0) >= 8 * 3600,
  );

  const memberTotals = new Map<
    string,
    { name: string; seconds: number; cost: number }
  >();

  for (const entry of entries) {
    const key = entry.user_id;
    const current = memberTotals.get(key) ?? {
      name: entry.user_name || "Unknown member",
      seconds: 0,
      cost: 0,
    };

    current.seconds += Number(entry.duration_seconds ?? 0);
    current.cost += Number(entry.cost_amount ?? 0);
    memberTotals.set(key, current);
  }

  const topMember = Array.from(memberTotals.values()).sort(
    (a, b) => b.seconds - a.seconds,
  )[0];

  if (topMember) {
    insights.push({
      id: "top-member",
      title: "Top tracked member",
      message: `${topMember.name} leads the visible period with ${formatDuration(
        topMember.seconds,
      )} tracked and ${formatMoney(topMember.cost)} in cost.`,
      tone: "good",
      icon: <CheckCircle2 size={16} />,
    });
  }

  if (summary.activeCount > 0) {
    insights.push({
      id: "active-timers",
      title: "Live timer activity",
      message: `${summary.activeCount} active timer${
        summary.activeCount === 1 ? "" : "s"
      } ${summary.activeCount === 1 ? "is" : "are"} running right now.`,
      tone: "neutral",
      icon: <Timer size={16} />,
    });
  }

  if (pendingCount > 0) {
    insights.push({
      id: "pending-approval",
      title: "Pending attention",
      message: `${pendingCount} time entr${
        pendingCount === 1 ? "y is" : "ies are"
      } still waiting in the current result set.`,
      tone: "warning",
      icon: <AlertTriangle size={16} />,
    });
  }

  if (rejectedCount > 0) {
    insights.push({
      id: "rejected",
      title: "Rejected entries found",
      message: `${rejectedCount} entr${
        rejectedCount === 1 ? "y has" : "ies have"
      } already been rejected and may need follow-up.`,
      tone: "warning",
      icon: <UserX size={16} />,
    });
  }

  if (missingDescriptionCount > 0) {
    insights.push({
      id: "missing-description",
      title: "Low-quality logs",
      message: `${missingDescriptionCount} entr${
        missingDescriptionCount === 1 ? "y has" : "ies have"
      } no description, which reduces reporting clarity.`,
      tone: "warning",
      icon: <Clock3 size={16} />,
    });
  }

  if (summary.totalCost > 0) {
    insights.push({
      id: "cost-footprint",
      title: "Cost visibility",
      message: `Visible tracked work currently represents ${formatMoney(
        summary.totalCost,
      )} in cost across the loaded entries.`,
      tone: "neutral",
      icon: <DollarSign size={16} />,
    });
  }

  if (longEntries.length > 0) {
    insights.push({
      id: "long-entries",
      title: "Long-duration entries",
      message: `${longEntries.length} entr${
        longEntries.length === 1 ? "y is" : "ies are"
      } 8 hours or longer and may be worth validating.`,
      tone: "warning",
      icon: <AlertTriangle size={16} />,
    });
  }

  const visibleInsights = insights.slice(0, 6);

  return (
    <section className="border border-white/10 bg-[#050505] p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="border border-orange-500/20 bg-orange-500/10 p-2 text-orange-400">
          <Brain size={18} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">
            AI-Style Insights
          </h3>
          <p className="text-sm text-white/45">
            Smart operational signals from your real tracked data
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {visibleInsights.length === 0 ? (
          <div className="border border-white/10 bg-black/40 p-4 text-sm text-white/50">
            No strong insights available yet for the current data set.
          </div>
        ) : (
          visibleInsights.map((insight) => (
            <div
              key={insight.id}
              className={`border p-4 ${
                insight.tone === "good"
                  ? "border-emerald-500/20 bg-emerald-500/10"
                  : insight.tone === "warning"
                    ? "border-orange-500/20 bg-orange-500/10"
                    : "border-white/10 bg-black/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 ${
                    insight.tone === "good"
                      ? "text-emerald-300"
                      : insight.tone === "warning"
                        ? "text-orange-300"
                        : "text-white/70"
                  }`}
                >
                  {insight.icon}
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {insight.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    {insight.message}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

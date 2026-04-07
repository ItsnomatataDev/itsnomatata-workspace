import { useMemo, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { generateDashboardSummary } from "../../ai-assistant/services/aiAssistantService";

type AIUserRole =
  | "admin"
  | "manager"
  | "it"
  | "social_media"
  | "media_team"
  | "seo_specialist";

type DashboardSummaryResult = {
  summary: string;
  suggestions?: string[];
};

function isAIUserRole(value: unknown): value is AIUserRole {
  return (
    value === "admin" ||
    value === "manager" ||
    value === "it" ||
    value === "social_media" ||
    value === "media_team" ||
    value === "seo_specialist"
  );
}

export default function AIAssistantPanel() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;

  const role = useMemo<AIUserRole | undefined>(() => {
    const rawRole = profile?.primary_role;
    return isAIUserRole(rawRole) ? rawRole : undefined;
  }, [profile?.primary_role]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<DashboardSummaryResult | null>(null);

  async function handleGenerateSummary() {
    if (!role) {
      setError("No valid workspace role found for AI assistant.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const result = await generateDashboardSummary({
        role,
      });

      setSummary(result as DashboardSummaryResult);
    } catch (err: any) {
      console.error("AI ASSISTANT SUMMARY ERROR:", err);
      setError(err?.message || "Failed to generate dashboard summary.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl bg-orange-500/15 p-2 text-orange-400">
          <Sparkles size={18} />
        </div>
        <div>
          <h2 className="text-lg font-semibold">AI Assistant</h2>
          <p className="text-sm text-white/55">
            Generate a quick dashboard summary for your current role.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void handleGenerateSummary()}
        disabled={loading || !role}
        className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Sparkles size={16} />
        )}
        {loading ? "Generating..." : "Generate Summary"}
      </button>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
        {!summary ? (
          <p className="text-sm text-white/50">No summary generated yet.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-orange-400">Summary</p>
              <p className="mt-2 text-sm leading-6 text-white/85">
                {summary.summary}
              </p>
            </div>

            {summary.suggestions && summary.suggestions.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-orange-400">
                  Suggestions
                </p>
                <ul className="mt-2 space-y-2 text-sm text-white/80">
                  {summary.suggestions.map((item, index) => (
                    <li
                      key={`${item}-${index}`}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { generateDashboardSummary, type AIUserRole } from "../../../lib/api/ai";

type AIAssistantPanelProps = {
  organizationId: string;
  userId: string;
  role?: AIUserRole;
  userName?: string;
  currentModule?: string;
  onPromptClick?: (prompt: string) => void;
};

export default function AIAssistantPanel({
  organizationId,
  userId,
  role = "employee",
  userName,
  currentModule = "dashboard",
  onPromptClick,
}: AIAssistantPanelProps) {
  const [summary, setSummary] = useState("Loading AI summary...");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function loadSummary() {
      if (!organizationId || !userId) {
        setSummary("Missing workspace context for AI summary.");
        setSuggestions([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
   const result = await generateDashboardSummary({
     organizationId,
     userId,
     role,
     userName,
     currentModule,
   });

        if (!ignore) {
          setSummary(result.summary);
          setSuggestions(result.suggestions ?? []);
        }
      } catch (error) {
        console.error("Failed to load dashboard AI summary:", error);

        if (!ignore) {
          setSummary(
            "I could not load the AI dashboard summary right now. Please try again in a moment.",
          );
          setSuggestions([
            "Summarize my current tasks",
            "What needs my attention today?",
            "Show pending approvals",
          ]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      ignore = true;
    };
  }, [organizationId, userId, role, userName, currentModule]);

  return (
    <section className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white shadow-lg">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-orange-500/15 p-2 text-orange-400">
              <Sparkles size={16} />
            </span>
            <div>
              <h2 className="text-lg font-semibold">AI Assistant</h2>
              <p className="text-sm text-white/60">
                {userName
                  ? `Welcome back, ${userName}.`
                  : "Workspace assistant"}
              </p>
            </div>
          </div>
        </div>

        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
          {role}
        </span>
      </div>

      <div className="rounded-xl bg-white/5 p-4">
        {loading ? (
          <p className="text-sm text-white/70">Generating your summary...</p>
        ) : (
          <p className="text-sm leading-6 text-white/90">{summary}</p>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-white/50">
            Suggested prompts
          </p>

          <div className="flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onPromptClick?.(item)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

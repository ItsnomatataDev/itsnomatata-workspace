import { useState, useCallback } from "react";
import {
  Sparkles,
  ListTodo,
  FolderKanban,
  FileText,
  Users,
  Activity,
  Workflow,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { runAIWorkspaceTool } from "../../ai-workspace/services/aiWorkspaceService";
import type { AIWorkspaceOutput } from "../../ai-workspace/types/aiWorkspace";

type QuickAction = {
  id: string;
  toolId: string;
  label: string;
  description: string;
  icon: typeof Sparkles;
  prompt?: string;
};

const quickActions: QuickAction[] = [
  {
    id: "qa_task_summary",
    toolId: "summarize_my_tasks",
    label: "Summarize Tasks",
    description: "AI summary of open/blocked/overdue tasks",
    icon: ListTodo,
  },
  {
    id: "qa_project_summary",
    toolId: "summarize_project",
    label: "Project Status",
    description: "AI project progress & blockers report",
    icon: FolderKanban,
    prompt:
      "Summarize all active project statuses, blockers, and health scores",
  },
  {
    id: "qa_weekly_report",
    toolId: "generate_weekly_report",
    label: "Weekly Report",
    description: "Generate a recapping report for this week",
    icon: FileText,
    prompt:
      "Generate a weekly summary report covering tasks, time, and project progress",
  },
  {
    id: "qa_team_overview",
    toolId: "admin_team_overview",
    label: "Team Overview",
    description: "Full team attendance & workload status",
    icon: Users,
  },
  {
    id: "qa_org_health",
    toolId: "admin_org_health",
    label: "Org Health Check",
    description: "Overdue tasks, budgets, pending approvals",
    icon: Activity,
  },
  {
    id: "qa_workload",
    toolId: "manager_team_workload",
    label: "Workload Analysis",
    description: "Who's overloaded and who has capacity",
    icon: Workflow,
  },
];

type Props = {
  organizationId: string;
  userId: string;
  role: string;
  fullName: string | null;
  email: string;
};

export default function AIQuickActions({
  organizationId,
  userId,
  role,
  fullName,
  email,
}: Props) {
  const [runningId, setRunningId] = useState<string | null>(null);
  const [result, setResult] = useState<AIWorkspaceOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = useCallback(
    async (action: QuickAction) => {
      setRunningId(action.id);
      setResult(null);
      setError(null);

      try {
        const output = await runAIWorkspaceTool({
          context: {
            userId,
            organizationId,
            fullName,
            email,
            role,
            currentModule: "it-control-centre",
            channel: "dashboard",
          },
          toolId: action.toolId,
          prompt: action.prompt,
        });

        setResult(output);
      } catch (err: any) {
        setError(err?.message ?? "AI action failed");
      } finally {
        setRunningId(null);
      }
    },
    [organizationId, userId, role, fullName, email],
  );

  // Filter actions visible to this role
  const visibleActions = quickActions.filter((a) => {
    if (a.toolId.startsWith("admin_") && role !== "admin") return false;
    if (a.toolId.startsWith("manager_") && !["admin", "manager"].includes(role))
      return false;
    return true;
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-purple-500/15 p-1.5">
            <Sparkles size={16} className="text-purple-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">AI Quick Actions</h3>
        </div>
        <Link
          to="/ai-workspace"
          className="flex items-center gap-1 text-[11px] text-orange-500 hover:text-orange-400"
        >
          All tools <ArrowRight size={10} />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visibleActions.map((action) => {
          const Icon = action.icon;
          const isRunning = runningId === action.id;

          return (
            <button
              key={action.id}
              onClick={() => handleRun(action)}
              disabled={runningId !== null}
              className="group flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-black/30 p-3 text-left transition-all hover:border-orange-500/30 hover:bg-white/5 disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <Loader2 size={14} className="animate-spin text-orange-500" />
                ) : (
                  <Icon
                    size={14}
                    className="text-white/50 group-hover:text-orange-500"
                  />
                )}
                <span className="text-xs font-medium text-white/80">
                  {action.label}
                </span>
              </div>
              <span className="text-[10px] text-white/40 line-clamp-2">
                {action.description}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-orange-500">
              {result.title}
            </p>
            <button
              onClick={() => setResult(null)}
              className="text-[10px] text-white/30 hover:text-white/60"
            >
              Dismiss
            </button>
          </div>
          <div className="prose prose-sm prose-invert max-w-none text-xs text-white/65">
            {result.content.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

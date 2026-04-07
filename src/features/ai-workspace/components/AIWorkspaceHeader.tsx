// src/features/ai-workspace/components/AIWorkspaceHeader.tsx

import { Sparkles } from "lucide-react";

interface AIWorkspaceHeaderProps {
  title?: string;
  subtitle?: string;
  role?: string | null;
  userName?: string | null;
}

export default function AIWorkspaceHeader({
  title = "AI Workspace",
  subtitle = "Launch AI tools for summaries, documents, tasks, reports, and workflow support.",
  role,
  userName,
}: AIWorkspaceHeaderProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0f0f10] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-orange-500/15 p-3 text-orange-400">
              <Sparkles size={18} />
            </span>

            <div>
              <h1 className="text-2xl font-bold text-white">{title}</h1>
              <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {userName && (
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-gray-200">
              {userName}
            </span>
          )}
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-gray-200">
            {role || "employee"}
          </span>
        </div>
      </div>
    </div>
  );
}

import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const promptMap: Record<string, string[]> = {
  social_media: [
    "Suggest caption ideas for my pending posts",
    "Summarize comments needing approval",
  ],
  media_team: [
    "Show content production tasks due soon",
    "Summarize assets uploaded this week",
  ],
  seo_specialist: [
    "Show SEO tasks in review",
    "Summarize blog and keyword work",
  ],
  admin: [
    "Show pending approvals and unread notifications",
    "Summarize client delivery blockers",
  ],
  it: [
    "Show workflow bottlenecks and automation status",
    "Summarize critical operations tasks",
  ],
};

export default function AIAssistantPanel({ role }: { role?: string }) {
  const prompts = role ? (promptMap[role] ?? []) : [];

  return (
    <div className="rounded-2xl border border-white/10 bg-linear-to-br from-orange-500/15 to-white/5 p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-orange-500 p-2 text-black">
          <Sparkles size={18} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">AI Assistant</h2>
          <p className="text-sm text-white/60">Role-aware workspace help</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {prompts.map((prompt) => (
          <div
            key={prompt}
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/80"
          >
            {prompt}
          </div>
        ))}
      </div>

      <Link
        to="/ai-assistant"
        className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-orange-500 hover:text-orange-400"
      >
        Open assistant
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}

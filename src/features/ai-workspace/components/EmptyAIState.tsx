import { Sparkles } from "lucide-react";

interface EmptyAIStateProps {
  title?: string;
  description?: string;
}

export default function EmptyAIState({
  title = "No AI activity yet",
  description = "Run a tool, ask a question, or search the workspace to start getting AI-powered results.",
}: EmptyAIStateProps) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center">
      <div className="mx-auto mb-4 inline-flex rounded-2xl bg-orange-500/15 p-3 text-orange-400">
        <Sparkles size={20} />
      </div>

      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-400">
        {description}
      </p>
    </div>
  );
}

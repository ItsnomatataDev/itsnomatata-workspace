import { useState } from "react";
import { Play, Sparkles } from "lucide-react";
import type { AIWorkspaceTool } from "../types/aiWorkspace";

interface AIActionLauncherProps {
  tool: AIWorkspaceTool | null;
  busy?: boolean;
  onRun: (params: { toolId: string; prompt?: string }) => Promise<void> | void;
}

export default function AIActionLauncher({
  tool,
  busy = false,
  onRun,
}: AIActionLauncherProps) {
  const [prompt, setPrompt] = useState("");

  if (!tool) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-gray-400">
        Select a tool to configure and run it.
      </div>
    );
  }

  const selectedTool = tool;
  const needsPrompt = selectedTool.inputType !== "none";

  async function handleRun() {
    await onRun({
      toolId: selectedTool.id,
      prompt: prompt.trim() || undefined,
    });

    setPrompt("");
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="rounded-xl bg-orange-500/15 p-2 text-orange-400">
          <Sparkles size={18} />
        </span>

        <div>
          <h3 className="text-base font-semibold text-white">
            {selectedTool.label}
          </h3>
          <p className="mt-1 text-sm text-gray-400">
            {selectedTool.description}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-white/10 px-3 py-1 text-gray-300">
          {selectedTool.category}
        </span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-gray-300">
          input: {selectedTool.inputType}
        </span>
        {selectedTool.requiresApproval && (
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-300">
            approval required
          </span>
        )}
      </div>

      {needsPrompt && (
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-200">
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder={`Describe what you want ${selectedTool.label.toLowerCase()} to do...`}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-orange-500"
          />
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={handleRun}
        className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
      >
        <Play size={16} />
        {busy ? "Running..." : "Run tool"}
      </button>
    </div>
  );
}

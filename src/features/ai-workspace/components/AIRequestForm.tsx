import { useState } from "react";
import { Send } from "lucide-react";
import type { AIWorkspaceTool } from "../types/aiWorkspace";

interface AIRequestFormProps {
  tool?: AIWorkspaceTool | null;
  busy?: boolean;
  onSubmit: (params: { prompt: string }) => Promise<void> | void;
}

export default function AIRequestForm({
  tool,
  busy = false,
  onSubmit,
}: AIRequestFormProps) {
  const [prompt, setPrompt] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = prompt.trim();
    if (!trimmed) return;

    await onSubmit({ prompt: trimmed });
    setPrompt("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/10 bg-white/5 p-5"
    >
      <div className="mb-3">
        <h3 className="text-base font-semibold text-white">
          {tool ? `Request for ${tool.label}` : "Quick AI Request"}
        </h3>
        <p className="mt-1 text-sm text-gray-400">
          Describe what you want the assistant to do.
        </p>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder={
          tool
            ? `What should ${tool.label.toLowerCase()} do for you?`
            : "Type your request here..."
        }
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-orange-500"
      />

      <div className="mt-4">
        <button
          type="submit"
          disabled={busy || !prompt.trim()}
          className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
        >
          <Send size={16} />
          {busy ? "Sending..." : "Submit request"}
        </button>
      </div>
    </form>
  );
}

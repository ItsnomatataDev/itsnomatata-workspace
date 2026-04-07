// src/features/ai-workspace/components/AIQuickSearch.tsx

import { useState } from "react";
import { Search } from "lucide-react";

interface AIQuickSearchProps {
  busy?: boolean;
  onSearch: (query: string) => Promise<void> | void;
}

export default function AIQuickSearch({
  busy = false,
  onSearch,
}: AIQuickSearchProps) {
  const [query, setQuery] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = query.trim();
    if (!trimmed) return;

    await onSearch(trimmed);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/10 bg-white/5 p-4"
    >
      <div className="mb-3 flex items-center gap-2 text-white">
        <Search size={18} className="text-orange-400" />
        <h3 className="text-base font-semibold">Quick Search</h3>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search knowledge, tasks, reports, or ask a question..."
          className="flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-orange-500"
        />

        <button
          type="submit"
          disabled={busy || !query.trim()}
          className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
        >
          {busy ? "Searching..." : "Search"}
        </button>
      </div>
    </form>
  );
}

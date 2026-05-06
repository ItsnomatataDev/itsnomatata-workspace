import { useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export interface AssetSearchSuggestion {
  label: string;
  value: string;
  sublabel?: string | null;
}

interface ProductionAssetSearchProps {
  onSearch?: (query: string) => void;
  suggestions?: AssetSearchSuggestion[];
  placeholder?: string;
  className?: string;
}

export default function ProductionAssetSearch({
  onSearch,
  suggestions = [],
  placeholder = "Search assets...",
  className = "",
}: ProductionAssetSearchProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const visibleSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!focused || q.length < 2) return [];

    const seen = new Set<string>();
    return suggestions
      .filter((suggestion) => {
        const text = `${suggestion.label} ${suggestion.value} ${suggestion.sublabel ?? ""}`.toLowerCase();
        return text.includes(q);
      })
      .filter((suggestion) => {
        const key = suggestion.value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
  }, [focused, query, suggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleSearch = () => {
    onSearch?.(query.trim());
    setFocused(false);
  };

  const clearSearch = () => {
    setQuery("");
    onSearch?.("");
    inputRef.current?.focus();
  };

  const chooseSuggestion = (suggestion: AssetSearchSuggestion) => {
    setQuery(suggestion.value);
    onSearch?.(suggestion.value);
    setFocused(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Search size={18} className="absolute left-3 text-white/40" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-white/10 bg-black/40 py-3 pl-10 pr-10 text-sm text-white placeholder-white/35 transition-all focus:border-orange-500/50 focus:bg-white/8 focus:outline-none"
        />
        
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 rounded-full p-1 transition-colors hover:bg-white/10"
          >
            <X size={16} className="text-white/60" />
          </button>
        )}
      </div>
      {visibleSuggestions.length > 0 && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl shadow-black/50">
          {visibleSuggestions.map((suggestion) => (
            <button
              key={`${suggestion.value}-${suggestion.label}`}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseSuggestion(suggestion)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-white/8"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-white">
                  {suggestion.label}
                </span>
                {suggestion.sublabel && (
                  <span className="block truncate text-xs text-white/40">
                    {suggestion.sublabel}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-orange-300">
                Search
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

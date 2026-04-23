import { useState, useRef } from "react";
import { Search, X } from "lucide-react";

interface MinimalAssetSearchProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export default function MinimalAssetSearch({
  onSearch,
  placeholder = "Search assets...",
  className = "",
}: MinimalAssetSearchProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (query.trim() && onSearch) {
      onSearch(query.trim());
    }
  };

  const clearSearch = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Search size={20} className="absolute left-3 text-white/40" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-500/50 focus:bg-white/10 transition-all"
        />
        
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={16} className="text-white/60" />
          </button>
        )}
      </div>
    </div>
  );
}

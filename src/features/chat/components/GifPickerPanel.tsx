import { useMemo, useState } from "react";
import { ImagePlus, Loader2, Search, X } from "lucide-react";

export type GifSelection = {
  mediaUrl: string;
  provider: "giphy" | "tenor" | "url";
  caption?: string | null;
};

type GifResult = {
  id: string;
  title: string;
  url: string;
  provider: "giphy" | "tenor";
};

type GiphyItem = {
  id: string;
  title?: string;
  images?: {
    fixed_height?: { url?: string };
    downsized_medium?: { url?: string };
    original?: { url?: string };
  };
};

type TenorItem = {
  id: string;
  title?: string;
  content_description?: string;
  media_formats?: {
    gif?: { url?: string };
    mediumgif?: { url?: string };
    tinygif?: { url?: string };
  };
};

export default function GifPickerPanel({
  open,
  disabled,
  onClose,
  onSelect,
}: {
  open: boolean;
  disabled?: boolean;
  onClose: () => void;
  onSelect: (selection: GifSelection) => void;
}) {
  const [query, setQuery] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const provider = useMemo(() => {
    if (import.meta.env.VITE_GIPHY_API_KEY) return "giphy";
    if (import.meta.env.VITE_TENOR_API_KEY) return "tenor";
    return null;
  }, []);

  async function searchGifs() {
    const term = query.trim();
    if (!term || !provider) return;

    try {
      setLoading(true);
      setError("");

      if (provider === "giphy") {
        const key = import.meta.env.VITE_GIPHY_API_KEY as string;
        const url = new URL("https://api.giphy.com/v1/gifs/search");
        url.searchParams.set("api_key", key);
        url.searchParams.set("q", term);
        url.searchParams.set("limit", "12");
        url.searchParams.set("rating", "pg-13");

        const response = await fetch(url);
        if (!response.ok) throw new Error("GIF search failed.");

        const json = await response.json() as { data?: GiphyItem[] };
        setResults(
          (json.data ?? [])
            .map((item) => ({
              id: item.id,
              title: item.title ?? "GIF",
              url:
                item.images?.fixed_height?.url ??
                item.images?.downsized_medium?.url ??
                item.images?.original?.url ??
                "",
              provider: "giphy" as const,
            }))
            .filter((item) => item.url),
        );
      } else {
        const key = import.meta.env.VITE_TENOR_API_KEY as string;
        const url = new URL("https://tenor.googleapis.com/v2/search");
        url.searchParams.set("key", key);
        url.searchParams.set("q", term);
        url.searchParams.set("limit", "12");
        url.searchParams.set("media_filter", "gif,tinygif,mediumgif");

        const response = await fetch(url);
        if (!response.ok) throw new Error("GIF search failed.");

        const json = await response.json() as { results?: TenorItem[] };
        setResults(
          (json.results ?? [])
            .map((item) => ({
              id: item.id,
              title: item.content_description ?? item.title ?? "GIF",
              url:
                item.media_formats?.mediumgif?.url ??
                item.media_formats?.gif?.url ??
                item.media_formats?.tinygif?.url ??
                "",
              provider: "tenor" as const,
            }))
            .filter((item) => item.url),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "GIF search failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="absolute bottom-full right-0 z-40 mb-3 w-[min(92vw,24rem)] rounded-3xl border border-white/10 bg-neutral-950 p-4 shadow-2xl shadow-black/70">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-400">
            GIFs and memes
          </p>
          <p className="mt-1 text-sm text-white/50">
            {provider
              ? "Search and send a lightweight media message."
              : "Add a GIF or meme URL to send media."}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
          aria-label="Close GIF picker"
        >
          <X size={16} />
        </button>
      </div>

      {provider ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void searchGifs();
                  }
                }}
                placeholder="Search GIFs"
                className="w-full rounded-2xl border border-white/10 bg-black px-9 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-orange-500/50"
              />
            </div>
            <button
              type="button"
              disabled={disabled || loading || !query.trim()}
              onClick={() => void searchGifs()}
              className="rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Search"}
            </button>
          </div>

          <input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Optional caption"
            className="w-full rounded-2xl border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-orange-500/50"
          />

          {error ? (
            <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          ) : null}

          <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1">
            {results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect({
                    mediaUrl: item.url,
                    provider: item.provider,
                    caption: caption.trim() || null,
                  });
                  onClose();
                  setCaption("");
                }}
                className="overflow-hidden rounded-2xl border border-white/10 bg-black transition hover:border-orange-500/40"
              >
                <img
                  src={item.url}
                  alt={item.title}
                  className="h-28 w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            value={manualUrl}
            onChange={(event) => setManualUrl(event.target.value)}
            placeholder="https://example.com/funny.gif"
            className="w-full rounded-2xl border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-orange-500/50"
          />
          <input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Optional caption"
            className="w-full rounded-2xl border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-orange-500/50"
          />
          <button
            type="button"
            disabled={disabled || !manualUrl.trim()}
            onClick={() => {
              onSelect({
                mediaUrl: manualUrl.trim(),
                provider: "url",
                caption: caption.trim() || null,
              });
              setManualUrl("");
              setCaption("");
              onClose();
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImagePlus size={16} />
            Send media URL
          </button>
        </div>
      )}
    </div>
  );
}

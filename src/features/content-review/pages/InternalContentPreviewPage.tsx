import { Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ContentReviewRenderer } from "../components/ContentReviewRenderer";
import {
  clientReviewStatusLabel,
  formatClientReviewDate,
} from "../utils/contentReviewDisplay";
import {
  getInternalContentReviewPreview,
  type ContentReviewAsset,
  type ContentReviewDraft,
} from "../services/contentReviewService";

export default function InternalContentPreviewPage() {
  const { token = "" } = useParams();
  const [draft, setDraft] = useState<ContentReviewDraft | null>(null);
  const [assets, setAssets] = useState<ContentReviewAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadPreview() {
      try {
        setLoading(true);
        const result = await getInternalContentReviewPreview(token);
        if (!mounted) return;
        if (!result.ok) {
          setError(
            result.error === "expired"
              ? "This preview link has expired."
              : "This preview link could not be found.",
          );
          return;
        }
        setDraft(result.draft ?? null);
        setAssets(result.assets ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load preview.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadPreview();
    return () => {
      mounted = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-white/70">
        Loading internal preview...
      </div>
    );
  }

  if (error && !draft) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-6">
        <div className="max-w-lg rounded-3xl border border-orange-500/30 bg-neutral-900 p-8 text-center shadow-xl">
          <p className="text-lg font-semibold text-white">{error}</p>
        </div>
      </div>
    );
  }

  if (!draft) return null;

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <Eye size={20} className="mt-0.5 shrink-0 text-amber-200" />
            <div>
              <p className="text-sm font-semibold text-amber-100">Internal preview only</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-100/80">
                This link is for your team while editing. Clients approve and comment in the client
                portal after you send the schedule — do not share this URL with clients.
              </p>
            </div>
          </div>
        </div>

        <header className="mb-6 rounded-3xl bg-black p-6 text-white shadow-xl ring-1 ring-white/10">
          <p className="text-xs uppercase tracking-[0.3em] text-orange-400">Staff preview</p>
          <h1 className="mt-4 text-3xl font-bold sm:text-5xl">{draft.title}</h1>
          {draft.subtitle ? (
            <p className="mt-3 text-lg text-white/70">{draft.subtitle}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-orange-500 px-3 py-1 font-semibold text-black">
              {clientReviewStatusLabel(draft.status)}
            </span>
            {formatClientReviewDate(draft.scheduled_at) ? (
              <span className="rounded-full border border-white/10 px-3 py-1 text-white/70">
                Publish {formatClientReviewDate(draft.scheduled_at)}
              </span>
            ) : null}
          </div>
        </header>

        <ContentReviewRenderer
          draft={draft}
          assets={assets}
          theme="public"
          hideScheduleHeaderInBody
        />
      </div>
    </main>
  );
}

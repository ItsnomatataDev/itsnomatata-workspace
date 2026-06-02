import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ContentReviewRenderer } from "../components/ContentReviewRenderer";
import { type ContentReviewDisplaySlot } from "../utils/assetDisplaySlots";
import {
  getPublicContentReview,
  submitPublicContentReviewFeedback,
  type ContentReviewAsset,
  type ContentReviewComment,
  type ContentReviewDraft,
} from "../services/contentReviewService";

function inputClassName() {
  return "w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition focus:border-orange-500";
}

export default function PublicClientReviewPage() {
  const { token = "" } = useParams();
  const [draft, setDraft] = useState<ContentReviewDraft | null>(null);
  const [assets, setAssets] = useState<ContentReviewAsset[]>([]);
  const [comments, setComments] = useState<ContentReviewComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submittedStatus, setSubmittedStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestingSlot, setRequestingSlot] = useState<ContentReviewDisplaySlot | null>(null);
  const [requestText, setRequestText] = useState("");
  const [client, setClient] = useState({
    name: "",
    email: token ? localStorage.getItem(`content-review-email:${token}`) ?? "" : "",
    company: "",
  });

  useEffect(() => {
    let mounted = true;

    async function loadReview() {
      try {
        setLoading(true);
        const viewerEmail = localStorage.getItem(`content-review-email:${token}`) ?? "";
        const result = await getPublicContentReview(token, viewerEmail);
        if (!mounted) return;
        if (!result.ok) {
          setError(
            result.error === "expired"
              ? "This review link has expired."
              : "This review link could not be found.",
          );
          return;
        }
        setDraft(result.draft ?? null);
        setAssets(result.assets ?? []);
        setComments(result.comments ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load review.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadReview();
    return () => {
      mounted = false;
    };
  }, [token]);

  const readOnly = draft
    ? ["approved", "archived", "published"].includes(draft.status)
    : false;

  async function submit(
    decision: "approved" | "changes_requested",
    suppliedComment: string,
  ) {
    if (!draft) return;
    const commentToUse = suppliedComment;
    if (!client.name.trim() || !client.email.trim()) {
      setError("Please enter your name and email.");
      return;
    }
    if (decision !== "approved" && !commentToUse.trim()) {
      setError("Please add a comment before submitting.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const result = await submitPublicContentReviewFeedback({
        token,
        name: client.name,
        email: client.email,
        company: client.company,
        comment: commentToUse,
        decision,
      });
      if (!result.ok) {
        setError(
          result.error === "expired"
            ? "This review link has expired."
            : result.error === "read_only"
              ? "This review is read-only."
              : result.error === "already_approved"
                ? "You have already approved this post."
                : result.error === "already_commented"
                  ? "You have already left your comment on this post."
                  : result.error === "already_requested_changes"
                    ? "You have already requested changes on this post."
                    : result.error === "comment_required"
                      ? "Please add a comment before submitting."
                      : "Unable to submit feedback.",
        );
        return;
      }
      localStorage.setItem(`content-review-email:${token}`, client.email.trim().toLowerCase());
      if (commentToUse.trim()) {
        setComments((current) => [
          ...current,
          {
            id: `local-${Date.now()}`,
            draft_id: draft.id,
            author_name: client.name.trim(),
            author_email: client.email.trim(),
            author_company: client.company.trim() || null,
            body: commentToUse.trim(),
            source: "client",
            client_visible: true,
            visibility: "client_visible",
            author_type: "client",
            comment_type:
              decision === "approved"
                ? "approval_note"
                : decision === "changes_requested"
                  ? "change_request"
                  : "client_comment",
            created_at: new Date().toISOString(),
          },
        ]);
      }
      setRequestingSlot(null);
      setRequestText("");
      setSubmittedStatus(result.status ?? decision);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSectionDecision(
    slot: ContentReviewDisplaySlot,
    decision: "approved" | "changes_requested",
    sectionComment?: string,
  ) {
    const slotComment = (sectionComment ?? "").trim();
    const slotLabel = `Slide ${slot.slot + 1}`;
    const sectionTitle = slot?.primary.heading?.trim() || slot?.primary.file_name || "";

    const compiled = [
      `[${slotLabel}]`,
      sectionTitle ? `Section: ${sectionTitle}` : null,
      slotComment || (decision === "approved" ? "Approved for this slide." : "Changes requested for this slide."),
    ]
      .filter(Boolean)
      .join("\n");

    await submit(decision, compiled);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-6 text-neutral-900">
        Loading review...
      </div>
    );
  }

  if (error && !draft) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-6">
        <div className="max-w-lg rounded-3xl border border-orange-200 bg-white p-8 text-center shadow-xl">
          <p className="text-lg font-semibold text-neutral-950">{error}</p>
        </div>
      </div>
    );
  }

  if (submittedStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-6">
        <div className="max-w-lg rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
            Thank you
          </p>
          <h1 className="mt-3 text-3xl font-bold text-neutral-950">
            Your feedback was received.
          </h1>
          <p className="mt-3 text-neutral-600">
            Current review status: {submittedStatus.replace(/_/g, " ")}.
          </p>
        </div>
      </div>
    );
  }

  if (!draft) return null;

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-6 text-neutral-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 rounded-3xl bg-black p-6 text-white shadow-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-orange-400">
            Client Content Review
          </p>
          <h1 className="mt-4 text-3xl font-bold sm:text-5xl">{draft.title}</h1>
          {draft.subtitle ? (
            <p className="mt-3 text-lg text-white/70">{draft.subtitle}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-orange-500 px-3 py-1 font-semibold text-black">
              {draft.status.replace(/_/g, " ")}
            </span>
            {draft.scheduled_at ? (
              <span className="rounded-full border border-white/10 px-3 py-1 text-white/70">
                Scheduled {new Date(draft.scheduled_at).toLocaleString()}
              </span>
            ) : null}
          </div>
        </header>

        <ContentReviewRenderer
          draft={draft}
          assets={assets}
          theme="public"
          renderSectionActions={(slot) => (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Slide {slot.slot + 1} feedback
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={readOnly || submitting}
                  onClick={() => void submitSectionDecision(slot, "approved")}
                  className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={readOnly || submitting}
                  onClick={() => {
                    setRequestingSlot(slot);
                    setRequestText("");
                  }}
                  className="rounded-xl border border-orange-500/40 px-3 py-2 text-sm font-bold text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Request changes
                </button>
              </div>
            </div>
          )}
        />

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold">Your comments</h2>
            <div className="mt-4 space-y-3">
              {comments.length === 0 ? (
                <p className="text-neutral-500">Your submitted comments will appear here.</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="rounded-2xl bg-neutral-100 p-4">
                    <p className="font-semibold">{comment.author_name}</p>
                    <p className="mt-2 text-neutral-700">{comment.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold">Client details</h2>
            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <div className="mt-4 space-y-3">
              <input
                value={client.name}
                onChange={(event) => setClient({ ...client, name: event.target.value })}
                placeholder="Name"
                className={inputClassName()}
              />
              <input
                type="email"
                value={client.email}
                onChange={(event) => setClient({ ...client, email: event.target.value })}
                placeholder="Email"
                className={inputClassName()}
              />
              <input
                value={client.company}
                onChange={(event) => setClient({ ...client, company: event.target.value })}
                placeholder="Company (optional)"
                className={inputClassName()}
              />
            </div>
            {readOnly ? (
              <p className="mt-4 text-center text-xs text-neutral-500">
                This review is read-only.
              </p>
            ) : null}
          </div>
        </section>
      </div>
      {requestingSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-orange-500">Request changes</p>
                <h3 className="mt-1 text-lg font-bold text-neutral-950">
                  Slide {requestingSlot.slot + 1} {requestingSlot.primary.heading ? `- ${requestingSlot.primary.heading}` : ""}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRequestingSlot(null)}
                className="rounded-full border border-neutral-300 p-2 text-neutral-600 hover:bg-neutral-100"
              >
                <X size={16} />
              </button>
            </div>
            <textarea
              value={requestText}
              onChange={(event) => setRequestText(event.target.value)}
              rows={5}
              placeholder="Tell the team exactly what needs to change on this section..."
              className={`${inputClassName()} mt-4`}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRequestingSlot(null)}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !requestText.trim()}
                onClick={() => void submitSectionDecision(requestingSlot, "changes_requested", requestText)}
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-50"
              >
                Submit changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

import { ArrowLeft, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ContentReviewRenderer } from "../components/ContentReviewRenderer";
import { type ContentReviewDisplaySlot } from "../utils/assetDisplaySlots";
import { contentClientSessionKey } from "./ClientPortalLoginPage";
import {
  getContentClientReview,
  submitContentClientReviewFeedback,
  type ContentClientFeedbackLimits,
  type ContentClientPortalSession,
  type ContentReviewAsset,
  type ContentReviewDraft,
} from "../services/contentReviewService";

function inputClassName() {
  return "w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition focus:border-orange-500";
}

function feedbackErrorMessage(error?: string) {
  switch (error) {
    case "already_approved":
      return "You have already approved this post.";
    case "already_commented":
      return "You have already left your comment on this post.";
    case "already_requested_changes":
      return "You have already requested changes on this post.";
    case "comment_required":
      return "Please add a comment before submitting.";
    case "read_only":
      return "This review is read-only.";
    case "unauthorized":
      return "Please sign in again.";
    default:
      return "Unable to submit feedback.";
  }
}

export default function ClientPortalReviewPage() {
  const { clientToken = "", draftId = "" } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<ContentClientPortalSession | null>(null);
  const [draft, setDraft] = useState<ContentReviewDraft | null>(null);
  const [assets, setAssets] = useState<ContentReviewAsset[]>([]);
  const [feedbackLimits, setFeedbackLimits] = useState<ContentClientFeedbackLimits>({
    has_approved: false,
    has_commented: false,
    has_requested_changes: false,
  });
  const [requestingSlot, setRequestingSlot] = useState<ContentReviewDisplaySlot | null>(null);
  const [requestText, setRequestText] = useState("");
  const [submittedStatus, setSubmittedStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const raw = localStorage.getItem(contentClientSessionKey(clientToken));
    if (!raw) {
      navigate(`/client-portal/${clientToken}/login`);
      return;
    }
    const parsed = JSON.parse(raw) as ContentClientPortalSession;
    try {
      setLoading(true);
      const result = await getContentClientReview({
        clientToken,
        sessionToken: parsed.sessionToken,
        email: parsed.email,
        draftId,
      });
      if (!result.ok || !result.draft) {
        setError(result.error === "unauthorized" ? "Please sign in again." : "Review not found.");
        return;
      }
      setSession({ ...parsed, client: result.client ?? parsed.client });
      setDraft(result.draft);
      setAssets(result.assets ?? []);
      setFeedbackLimits(
        result.feedback ?? {
          has_approved: false,
          has_commented: false,
          has_requested_changes: false,
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review.");
    } finally {
      setLoading(false);
    }
  }, [clientToken, draftId, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const readOnly = useMemo(
    () =>
      draft
        ? ["approved", "archived", "published"].includes(draft.status) ||
          feedbackLimits.has_approved
        : false,
    [draft, feedbackLimits.has_approved],
  );

  async function submit(
    decision: "comment" | "approved" | "changes_requested",
    suppliedComment = "",
  ) {
    if (!session || !draft) return;
    const commentToUse = suppliedComment;
    if (decision !== "approved" && !commentToUse.trim()) {
      setError("Please add a comment before submitting.");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      const result = await submitContentClientReviewFeedback({
        clientToken,
        sessionToken: session.sessionToken,
        email: session.email,
        draftId: draft.id,
        comment: commentToUse,
        decision,
      });
      if (!result.ok) {
        setError(feedbackErrorMessage(result.error));
        return;
      }
      if (result.feedback) {
        setFeedbackLimits(result.feedback);
      }
      setRequestingSlot(null);
      setRequestText("");
      setSubmittedStatus(result.status ?? decision);
      setDraft({ ...draft, status: (result.status ?? draft.status) as ContentReviewDraft["status"] });
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
    return <main className="flex min-h-screen items-center justify-center bg-neutral-100 text-neutral-900">Loading review...</main>;
  }

  if (!draft) {
    return <main className="flex min-h-screen items-center justify-center bg-neutral-100 p-6 text-neutral-900">{error || "Review not found."}</main>;
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-6 text-neutral-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link to={`/client-portal/${clientToken}`} className="mb-5 inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
          <ArrowLeft size={16} /> Back to portal
        </Link>
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
                  className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-50"
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
                  className="rounded-xl border border-orange-500/40 px-3 py-2 text-sm font-bold text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                >
                  Request changes
                </button>
              </div>
            </div>
          )}
        />
        {submittedStatus ? <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Status updated: {submittedStatus.replace(/_/g, " ")}.</div> : null}
        {error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {readOnly ? <p className="mt-4 text-center text-xs text-neutral-500">This review is read-only.</p> : null}
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

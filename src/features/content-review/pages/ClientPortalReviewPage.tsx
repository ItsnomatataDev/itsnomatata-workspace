import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ContentReviewRenderer } from "../components/ContentReviewRenderer";
import { groupAssetsByDisplaySlot } from "../utils/assetDisplaySlots";
import { contentClientSessionKey } from "./ClientPortalLoginPage";
import {
  getContentClientReview,
  submitContentClientReviewFeedback,
  type ContentClientFeedbackLimits,
  type ContentClientPortalSession,
  type ContentReviewAsset,
  type ContentReviewComment,
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
  const [comments, setComments] = useState<ContentReviewComment[]>([]);
  const [feedbackLimits, setFeedbackLimits] = useState<ContentClientFeedbackLimits>({
    has_approved: false,
    has_commented: false,
    has_requested_changes: false,
  });
  const [slideComments, setSlideComments] = useState<Record<number, string>>({});
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
      setComments(result.comments ?? []);
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
      if (commentToUse.trim()) {
        setComments((current) => [
          ...current,
          {
            id: `local-${Date.now()}`,
            draft_id: draft.id,
            client_id: session.client.id,
            author_name: session.client.contact_name,
            author_email: session.email,
            author_company: session.client.company_name,
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
      setSlideComments({});
      setSubmittedStatus(result.status ?? decision);
      setDraft({ ...draft, status: (result.status ?? draft.status) as ContentReviewDraft["status"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  const slideSlots = useMemo(() => groupAssetsByDisplaySlot(assets), [assets]);

  async function submitSlideDecision(
    slotIndex: number,
    decision: "approved" | "changes_requested",
  ) {
    const slotComment = (slideComments[slotIndex] ?? "").trim();
    const slot = slideSlots.find((item) => item.slot === slotIndex);
    const slotLabel = `Slide ${slotIndex + 1}`;
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
        <ContentReviewRenderer draft={draft} assets={assets} theme="public" />
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold">Your comments</h2>
            <div className="mt-4 space-y-3">
              {comments.map((item) => (
                <div key={item.id} className="rounded-2xl bg-neutral-100 p-4">
                  <p className="font-semibold">{item.author_name}</p>
                  <p className="mt-2 text-neutral-700">{item.body}</p>
                </div>
              ))}
              {comments.length === 0 ? <p className="text-neutral-500">Your submitted comments will appear here.</p> : null}
            </div>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold">Slide feedback</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Approve or request changes on each slide with a specific note.
            </p>
            {submittedStatus ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Status updated: {submittedStatus.replace(/_/g, " ")}.</div> : null}
            {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
            <div className="mt-4 space-y-3">
              {slideSlots.map((slot) => (
                <div key={slot.slot} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <p className="text-sm font-semibold text-neutral-900">
                    Slide {slot.slot + 1} {slot.primary.heading ? `- ${slot.primary.heading}` : ""}
                  </p>
                  <textarea
                    value={slideComments[slot.slot] ?? ""}
                    onChange={(event) =>
                      setSlideComments((current) => ({ ...current, [slot.slot]: event.target.value }))
                    }
                    placeholder="Suggestion for this slide..."
                    rows={3}
                    disabled={readOnly || submitting}
                    className={`${inputClassName()} mt-2 disabled:opacity-60`}
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={readOnly || feedbackLimits.has_approved || submitting}
                      onClick={() => void submitSlideDecision(slot.slot, "approved")}
                      className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-50"
                    >
                      Approve slide
                    </button>
                    <button
                      type="button"
                      disabled={readOnly || feedbackLimits.has_requested_changes || submitting}
                      onClick={() => void submitSlideDecision(slot.slot, "changes_requested")}
                      className="rounded-xl border border-orange-500/40 px-3 py-2 text-sm font-bold text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                    >
                      Request changes
                    </button>
                  </div>
                </div>
              ))}
              {slideSlots.length === 0 ? (
                <p className="text-sm text-neutral-500">No slides available on this post.</p>
              ) : null}
              {readOnly ? <p className="text-center text-xs text-neutral-500">This review is read-only.</p> : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

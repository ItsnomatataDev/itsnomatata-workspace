import { ArrowLeft, CheckCircle2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ContentReviewRenderer } from "../components/ContentReviewRenderer";
import { type ContentReviewDisplaySlot } from "../utils/assetDisplaySlots";
import { CONTENT_STUDIO_POSTS_PER_SCHEDULE } from "../utils/contentStudioTerms";
import { contentClientSessionKey } from "./ClientPortalLoginPage";
import {
  getContentClientReview,
  sendContentReviewFeedbackEmails,
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
    case "not_approved":
      return "There is no approval to withdraw on this schedule.";
    case "already_commented":
      return "You have already left your comment on this post.";
    case "already_requested_changes":
      return "You have already requested changes on this post.";
    case "comment_required":
      return "Please add a comment before submitting.";
    case "read_only":
      return "This review is read-only.";
    case "not_available":
      return "This schedule is not available for review yet. Your team will notify you when it is sent to the portal.";
    case "not_released":
      return "This schedule is assigned to you but has not been released for review yet. Ask your team to use Send to client in Content Studio.";
    case "unauthorized":
      return "Please sign in again.";
    default:
      return "Unable to submit feedback.";
  }
}

function normalizeFeedbackLimits(
  feedback?: ContentClientFeedbackLimits | null,
): ContentClientFeedbackLimits {
  const approvedSlots = feedback?.approved_slots ?? [];
  return {
    has_approved: feedback?.has_approved ?? approvedSlots.length > 0,
    has_commented: feedback?.has_commented ?? false,
    has_requested_changes: feedback?.has_requested_changes ?? false,
    expected_posts: feedback?.expected_posts ?? CONTENT_STUDIO_POSTS_PER_SCHEDULE,
    approved_slots: approvedSlots,
    changes_requested_slots: feedback?.changes_requested_slots ?? [],
    approved_count: feedback?.approved_count ?? approvedSlots.length,
    all_posts_approved:
      feedback?.all_posts_approved ??
      approvedSlots.length >= CONTENT_STUDIO_POSTS_PER_SCHEDULE,
  };
}

export default function ClientPortalReviewPage() {
  const { clientToken = "", draftId = "" } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<ContentClientPortalSession | null>(null);
  const [draft, setDraft] = useState<ContentReviewDraft | null>(null);
  const [assets, setAssets] = useState<ContentReviewAsset[]>([]);
  const [feedbackLimits, setFeedbackLimits] = useState<ContentClientFeedbackLimits>(
    normalizeFeedbackLimits(),
  );
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
        setError(
          result.error === "unauthorized"
            ? "Please sign in again."
            : result.error === "not_available" || result.error === "not_released"
              ? feedbackErrorMessage(result.error)
              : "Review not found.",
        );
        return;
      }
      setSession({ ...parsed, client: result.client ?? parsed.client });
      setDraft(result.draft);
      setAssets(result.assets ?? []);
      setFeedbackLimits(normalizeFeedbackLimits(result.feedback));
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
    () => (draft ? ["archived", "published"].includes(draft.status) : false),
    [draft],
  );

  const approvedSlots = useMemo(
    () => new Set(feedbackLimits.approved_slots ?? []),
    [feedbackLimits.approved_slots],
  );

  const readOnlyReview = readOnly;

  async function submit(
    decision: "comment" | "approved" | "changes_requested" | "revoke_approval",
    suppliedComment = "",
    displaySlot?: number | null,
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
        setFeedbackLimits(normalizeFeedbackLimits(result.feedback));
      }
      setRequestingSlot(null);
      setRequestText("");
      setSubmittedStatus(result.status ?? decision);
      setDraft({ ...draft, status: (result.status ?? draft.status) as ContentReviewDraft["status"] });

      const eventType =
        decision === "approved"
          ? "approval_note"
          : decision === "changes_requested" || decision === "revoke_approval"
            ? "change_request"
            : "client_comment";

      void sendContentReviewFeedbackEmails({
        draft: { ...draft, status: (result.status ?? draft.status) as ContentReviewDraft["status"] },
        source: "client",
        eventType,
        authorName: session.client?.contact_name ?? session.email,
        message: commentToUse.trim() || `Client ${eventType.replace(/_/g, " ")} on ${draft.title}.`,
        displaySlot: displaySlot ?? null,
        clientCompany: session.client?.company_name ?? null,
        dedupeKey: `content-client-feedback:${draft.id}:${decision}:${displaySlot ?? "schedule"}`,
      });
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
    const slotLabel = `Post ${slot.slot + 1}`;
    const sectionTitle = slot?.primary.heading?.trim() || slot?.primary.file_name || "";

    const compiled = [
      `[${slotLabel}]`,
      sectionTitle ? `Section: ${sectionTitle}` : null,
      slotComment || (decision === "approved" ? "Approved for this post." : "Changes requested for this post."),
    ]
      .filter(Boolean)
      .join("\n");

    await submit(decision, compiled, slot.slot);
    await load();
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

        {(feedbackLimits.all_posts_approved ?? false) ? (
          <div className="mb-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={22} className="mt-0.5 text-emerald-700" />
              <div>
                <p className="font-semibold text-emerald-950">All posts approved</p>
                <p className="mt-1 text-sm text-emerald-900/80">
                  You approved all {CONTENT_STUDIO_POSTS_PER_SCHEDULE} posts in this schedule.
                  The content team has been notified.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <ContentReviewRenderer
          draft={draft}
          assets={assets}
          theme="public"
          renderSectionActions={
            readOnlyReview
              ? undefined
              : (slot) => {
                  const slotApproved = approvedSlots.has(slot.slot);
                  if (slotApproved) {
                    return (
                      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                        Post {slot.slot + 1} approved
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Post {slot.slot + 1} feedback
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => void submitSectionDecision(slot, "approved")}
                          className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
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
                  );
                }
          }
        />
        {submittedStatus ? <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Status updated: {submittedStatus.replace(/_/g, " ")}.</div> : null}
        {error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {readOnlyReview ? <p className="mt-4 text-center text-xs text-neutral-500">This review is read-only.</p> : null}
      </div>
      {requestingSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-orange-500">Request changes</p>
                <h3 className="mt-1 text-lg font-bold text-neutral-950">
                  Post {requestingSlot.slot + 1} {requestingSlot.primary.heading ? `- ${requestingSlot.primary.heading}` : ""}
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

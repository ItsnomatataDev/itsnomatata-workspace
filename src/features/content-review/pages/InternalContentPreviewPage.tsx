import { CheckCircle2, Eye, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { canApproveContentStudio } from "../../../lib/auth/contentStudioAccess";
import { ContentReviewRenderer } from "../components/ContentReviewRenderer";
import { type ContentReviewDisplaySlot } from "../utils/assetDisplaySlots";
import {
  clientReviewStatusLabel,
  formatClientReviewDate,
} from "../utils/contentReviewDisplay";
import {
  getClientApprovedSlots,
  getInternalApprovedSlots,
} from "../utils/contentReviewFeedback";
import { CONTENT_STUDIO_POSTS_PER_SCHEDULE, postLabel } from "../utils/contentStudioTerms";
import {
  getInternalContentReviewPreview,
  sendContentReviewFeedbackEmails,
  submitInternalContentReviewFeedbackByToken,
  type ContentReviewAsset,
  type ContentReviewComment,
  type ContentReviewDraft,
  type ContentInternalFeedbackLimits,
} from "../services/contentReviewService";

function inputClassName() {
  return "w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-orange-400/70";
}

function internalFeedbackErrorMessage(error?: string) {
  switch (error) {
    case "unauthorized":
      return "Please sign in to Codex before submitting internal review.";
    case "forbidden":
      return "Your account cannot approve content on this schedule. Use a reviewer role (admin, media team, manager, etc.).";
    case "already_approved":
      return "This post was already approved internally.";
    case "read_only":
      return "This schedule is read-only.";
    case "comment_required":
      return "Please add a comment before submitting.";
    case "not_found":
      return "This review link could not be found.";
    default:
      return error || "Unable to submit internal review.";
  }
}

export default function InternalContentPreviewPage() {
  const { token = "" } = useParams();
  const auth = useAuth();
  const profile = auth.profile;
  const [draft, setDraft] = useState<ContentReviewDraft | null>(null);
  const [assets, setAssets] = useState<ContentReviewAsset[]>([]);
  const [comments, setComments] = useState<ContentReviewComment[]>([]);
  const [feedbackLimits, setFeedbackLimits] = useState<ContentInternalFeedbackLimits>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestingSlot, setRequestingSlot] = useState<ContentReviewDisplaySlot | null>(null);
  const [requestText, setRequestText] = useState("");

  const canReview = canApproveContentStudio(profile?.primary_role);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await getInternalContentReviewPreview(token);
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
      setComments(result.comments ?? []);
      setFeedbackLimits(result.feedback ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preview.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const clientApprovedSlots = useMemo(
    () => new Set(getClientApprovedSlots(comments)),
    [comments],
  );

  const internalApprovedSlots = useMemo(() => {
    const fromFeedback = feedbackLimits.approved_slots ?? [];
    if (fromFeedback.length > 0) return new Set(fromFeedback);
    return new Set(getInternalApprovedSlots(comments));
  }, [comments, feedbackLimits.approved_slots]);

  const allClientPostsApproved =
    clientApprovedSlots.size >= CONTENT_STUDIO_POSTS_PER_SCHEDULE ||
    Boolean(feedbackLimits.all_posts_approved);

  async function submitSectionDecision(
    slot: ContentReviewDisplaySlot,
    decision: "approved" | "changes_requested",
    sectionComment?: string,
  ) {
    if (!draft || !canReview) return;
    const slotComment = (sectionComment ?? "").trim();
    const slotLabel = `Post ${slot.slot + 1}`;
    const sectionTitle = slot.primary.heading?.trim() || slot.primary.file_name || "";
    const compiled = [
      `[${slotLabel}]`,
      sectionTitle ? `Section: ${sectionTitle}` : null,
      slotComment ||
        (decision === "approved"
          ? "Approved for this post."
          : "Changes requested for this post."),
    ]
      .filter(Boolean)
      .join("\n");

    try {
      setSubmitting(true);
      setError("");
      const result = await submitInternalContentReviewFeedbackByToken({
        token,
        slot: slot.slot,
        decision,
        message: compiled,
      });
      if (!result.ok) {
        setError(internalFeedbackErrorMessage(result.error));
        return;
      }
      if (result.comment) {
        setComments((current) => [...current, result.comment as ContentReviewComment]);
      }
      if (result.feedback) {
        setFeedbackLimits(result.feedback);
      }
      if (result.status && draft) {
        setDraft({ ...draft, status: result.status });
      }

      const eventType = decision === "approved" ? "approval_note" : "change_request";
      void sendContentReviewFeedbackEmails({
        draft: { ...draft, status: result.status ?? draft.status },
        source: "internal",
        eventType,
        authorName: profile?.full_name?.trim() || profile?.email || "Staff",
        message: compiled,
        displaySlot: slot.slot,
        dedupeKey: `content-internal-feedback:${draft.id}:${decision}:${slot.slot}:${Date.now()}`,
      });

      setMessage(
        decision === "approved"
          ? `${postLabel(slot.slot)} approved internally.`
          : `${postLabel(slot.slot)} flagged for internal changes.`,
      );
      setRequestingSlot(null);
      setRequestText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit internal review.");
    } finally {
      setSubmitting(false);
    }
  }

  function slotReviewState(slot: ContentReviewDisplaySlot) {
    if (clientApprovedSlots.has(slot.slot)) {
      return "client_approved" as const;
    }
    if (internalApprovedSlots.has(slot.slot)) {
      return "internal_approved" as const;
    }
    return "pending" as const;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-white/70">
        Loading internal review...
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
              <p className="text-sm font-semibold text-amber-100">Internal review only</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-100/80">
                Approve or request changes on each post here before the schedule is sent to the
                client. Clients review separately in the client portal — do not share this URL with
                clients.
              </p>
            </div>
          </div>
        </div>

        {!auth.user ? (
          <div className="mb-6 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-100">
            Sign in to Codex to approve or request changes.{" "}
            <Link
              to={`/login?returnTo=${encodeURIComponent(window.location.pathname)}`}
              className="font-semibold underline"
            >
              Sign in
            </Link>
          </div>
        ) : !canReview ? (
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Your role can view this preview but cannot submit internal approvals. Ask an admin or
            media team reviewer to open this link while signed in.
          </div>
        ) : null}

        {allClientPostsApproved ? (
          <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={22} className="mt-0.5 text-emerald-300" />
              <div>
                <p className="font-semibold text-emerald-100">All posts client-approved</p>
                <p className="mt-1 text-sm text-emerald-100/80">
                  The client approved every post in this schedule.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <header className="mb-6 rounded-3xl bg-black p-6 text-white shadow-xl ring-1 ring-white/10">
          <p className="text-xs uppercase tracking-[0.3em] text-orange-400">Internal review</p>
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
            <span className="rounded-full border border-white/10 px-3 py-1 text-white/70">
              Internal {internalApprovedSlots.size}/{CONTENT_STUDIO_POSTS_PER_SCHEDULE}
            </span>
          </div>
        </header>

        {message ? (
          <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <ContentReviewRenderer
          draft={draft}
          assets={assets}
          theme="public"
          hideScheduleHeaderInBody
          renderSectionActions={
            auth.user && canReview
              ? (slot) => {
                  const state = slotReviewState(slot);
                  if (state === "client_approved") {
                    return (
                      <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
                        Post {slot.slot + 1} approved by client
                      </p>
                    );
                  }
                  if (state === "internal_approved") {
                    return (
                      <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
                        Post {slot.slot + 1} approved internally
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
                        Post {slot.slot + 1} internal review
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
                          className="rounded-xl border border-orange-500/40 px-3 py-2 text-sm font-bold text-orange-200 hover:bg-orange-500/10 disabled:opacity-50"
                        >
                          Request changes
                        </button>
                      </div>
                    </div>
                  );
                }
              : undefined
          }
        />
      </div>

      {requestingSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-neutral-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-orange-400">Request changes</p>
                <h3 className="mt-1 text-lg font-bold text-white">
                  Post {requestingSlot.slot + 1}{" "}
                  {requestingSlot.primary.heading
                    ? `- ${requestingSlot.primary.heading}`
                    : ""}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRequestingSlot(null)}
                className="rounded-full border border-white/15 p-2 text-white/60 hover:bg-white/5"
              >
                <X size={16} />
              </button>
            </div>
            <textarea
              value={requestText}
              onChange={(event) => setRequestText(event.target.value)}
              rows={5}
              placeholder="Tell the creator what needs to change on this post..."
              className={`${inputClassName()} mt-4`}
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setRequestingSlot(null)}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/75"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() =>
                  void submitSectionDecision(
                    requestingSlot,
                    "changes_requested",
                    requestText,
                  )
                }
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

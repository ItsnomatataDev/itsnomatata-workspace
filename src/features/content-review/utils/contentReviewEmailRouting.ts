/** Final internal reviewer before schedules go to clients (client change requests). */
const DEFAULT_FINAL_CLIENT_REVIEWER_EMAIL = "tammie@itsnomatata.com";

export type ContentReviewFeedbackSource = "client" | "internal";
export type ContentReviewFeedbackEvent =
  | "approval_note"
  | "change_request"
  | "internal_comment"
  | "client_comment";

export function getFinalClientReviewerEmail() {
  const fromEnv = import.meta.env.VITE_CONTENT_STUDIO_FINAL_REVIEWER_EMAIL as
    | string
    | undefined;
  return (fromEnv?.trim() || DEFAULT_FINAL_CLIENT_REVIEWER_EMAIL).toLowerCase();
}

export type ContentReviewEmailRecipient = {
  email: string;
  fullName: string | null;
};

/** Client change requests go to the final reviewer; everything else goes to the schedule creator. */
export function shouldEmailFinalClientReviewer(
  source: ContentReviewFeedbackSource,
  eventType: ContentReviewFeedbackEvent,
) {
  return source === "client" && eventType === "change_request";
}

export function buildFinalClientReviewerRecipient(): ContentReviewEmailRecipient {
  const email = getFinalClientReviewerEmail();
  const localPart = email.split("@")[0] ?? "Team";
  const fullName = localPart.charAt(0).toUpperCase() + localPart.slice(1);
  return { email, fullName };
}

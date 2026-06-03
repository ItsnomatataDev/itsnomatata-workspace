/** Labels and formatting for client-facing review pages (not internal staff status). */

export function clientReviewStatusLabel(status: string) {
  switch (status) {
    case "approved":
      return "Approved";
    case "changes_requested":
      return "Changes requested";
    case "sent_to_client":
    case "viewed":
      return "Awaiting your review";
    case "ready_for_review":
      return "Ready for review";
    case "published":
      return "Published";
    case "archived":
      return "Archived";
    default:
      return "In preparation";
  }
}

export function formatClientReviewDate(scheduledAt: string | null | undefined) {
  if (!scheduledAt) return null;
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

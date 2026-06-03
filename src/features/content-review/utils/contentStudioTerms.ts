/** User-facing Content Studio vocabulary (see product hierarchy). */
export const CONTENT_STUDIO_POSTS_PER_SCHEDULE = 10;

/** @deprecated Use CONTENT_STUDIO_POSTS_PER_SCHEDULE */
export const CONTENT_STUDIO_POSTS_PER_CLIENT = CONTENT_STUDIO_POSTS_PER_SCHEDULE;

export function scheduleMonthKey(date: Date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function formatScheduleMonthLabel(monthKey: string) {
  const parsed = new Date(`${monthKey}-01T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return monthKey;
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(parsed);
}

export function postLabel(index: number) {
  return `Post ${index + 1}`;
}

export function defaultPostTitle(index: number) {
  return postLabel(index);
}

export function defaultScheduleTitle(monthKey: string = scheduleMonthKey()) {
  return `${formatScheduleMonthLabel(monthKey)} schedule`;
}

export const contentStudioCopy = {
  scheduleSingular: "Schedule",
  schedulePlural: "Schedules",
  postSingular: "Post",
  postPlural: "Posts",
  hierarchyLine:
    "Each client has one schedule per month. Open the schedule to add up to 10 posts (slides) inside it.",
  postsInSchedule: (count = CONTENT_STUDIO_POSTS_PER_SCHEDULE) =>
    `${count} posts in this schedule`,
  scheduleProgress: (ready: number, total = CONTENT_STUDIO_POSTS_PER_SCHEDULE) =>
    `${ready}/${total} posts ready`,
  unassignedHeading: "Unassigned posts",
  unassignedHelp:
    "These posts are not linked to a client schedule yet. Create the client if needed, then assign each post.",
  editorFilmstrip: "Posts in this schedule",
  publishDate: "Publish date",
  carouselInPost: "Add carousel image to this post",
  editorWorkflow:
    "Edit here first. The centre preview is what you are building; the client link only shows saved work.",
  editorWriteHint:
    "Social caption and story text apply to the whole schedule clients see on the review link.",
  editorMediaHint:
    "Ten posts per schedule. Drop images onto each post, drag between posts, and reorder carousel images inside a post.",
  editorSetupHint:
    "Start here: pick how photos and text are arranged on the client link, then assign the client and publish date.",
  editorLayoutHint:
    "Layouts control the client review page — not your editing screen. Showcase is the usual choice for monthly schedules.",
  clientReviewHeadline: "Client review headline",
  clientReviewHeadlineHelp:
    "Shown once at the top of the client link (e.g. GOAT June 2026 SM Schedule). Replaces the auto month title like “June 2026 schedule”.",
  clientReviewHeadlinePlaceholder: "e.g. GOAT June 2026 SM Schedule",
  clientReviewSubtitle: "Optional line under headline",
  clientReviewSubtitleHelp: "Leave empty if you only need the headline.",
};

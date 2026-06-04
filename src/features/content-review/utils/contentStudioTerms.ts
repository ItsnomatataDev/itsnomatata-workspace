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
    "Edit each post in the centre frames (media left, caption right). Save from the toolbar; use Portal preview to see what clients see after you send the schedule.",
  editorWriteHint:
    "Optional extras (CTA, internal notes). Post captions and media are edited in the centre frames.",
  editorDefaultSocialCaption: "Default social caption (optional)",
  editorDefaultSocialCaptionHelp:
    "Fallback copy when a post has no caption in its frame. Most teams only use per-post captions in the frames.",
  editorIntroAfterImages: "Intro paragraph after images (optional)",
  editorIntroAfterImagesHelp:
    "Only for Showcase/Gallery layouts: a short paragraph below all photos. Not the same as the client review headline above.",
  editorHeadlineVsPosts:
    "The headline is the page title in the client portal. Each post’s caption is edited in the centre frames.",
  editorMediaHint:
    "Up to 10 post slots per schedule — you only need as many as you plan to publish. Drop images onto each post, drag between posts, and reorder carousel images inside a post.",
  editorSetupHint:
    "Start here: pick how photos and text are arranged on the client link, then assign the client and publish date.",
  editorLayoutHint:
    "Layouts control the client portal review page — not your editing screen. Showcase is the usual choice for monthly schedules.",
  editorPostCopyHint:
    "Each post can have its own headline and caption. They show on that slide on the client link (especially with Split layout: image + text side by side).",
  editorPostCopySplitHint:
    "With Split layout, the caption below is the text shown beside this image. Add an image first, then write copy here.",
  editorPostCopyUnifiedNote:
    "Leave empty to use the default social caption from Setup — or type caption text for this post only.",
  editorPostCopyNoMedia:
    "Upload or pick an image in the filmstrip below the preview, then add text here.",
  editorSelectPostHint:
    "Select a post in the filmstrip below the preview to edit its image and caption here.",
  clientReviewHeadline: "Client review headline",
  clientReviewHeadlineHelp:
    "Shown once at the top of the client portal review (e.g. GOAT June 2026 SM Schedule). Replaces the auto month title like “June 2026 schedule”.",
  clientReviewHeadlinePlaceholder: "e.g. GOAT June 2026 SM Schedule",
  clientReviewSubtitle: "Optional line under headline",
  clientReviewSubtitleHelp: "Leave empty if you only need the headline.",
};

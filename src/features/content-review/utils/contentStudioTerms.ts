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
};

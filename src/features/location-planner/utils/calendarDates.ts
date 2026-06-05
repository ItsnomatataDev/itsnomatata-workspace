export function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export const HARARE_TIME_ZONE = "Africa/Harare";

export function toTimeZoneDateKey(
  value = new Date(),
  timeZone = HARARE_TIME_ZONE,
) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export function getHarareDateKey(value = new Date()) {
  return toTimeZoneDateKey(value, HARARE_TIME_ZONE);
}

export function parseDateKey(key: string) {
  return new Date(`${key}T12:00:00`);
}

export function addDays(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

export function startOfWeekDateKey(key: string) {
  const [year, month, dayOfMonth] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, dayOfMonth));
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return toDateKey(date);
}

export function getHarareWeekStart(value = new Date()) {
  return startOfWeekDateKey(getHarareDateKey(value));
}

export function startOfWeek(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function buildDayRange(start: string, end: string) {
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
    if (days.length > 366) break;
  }
  return days;
}

export function defaultWeekRange(reference = new Date()) {
  const start = startOfWeek(reference);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: toDateKey(start), end: toDateKey(end) };
}

export function formatDayLabel(key: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(parseDateKey(key));
}

export function formatTimeRange(start: string | null, end: string | null) {
  if (!start && !end) return "All day";
  const fmt = (value: string) => value.slice(0, 5);
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return start ? fmt(start) : end ? fmt(end) : "All day";
}

export function assignmentOnDay(
  startDate: string,
  endDate: string,
  dayKey: string,
) {
  return startDate <= dayKey && endDate >= dayKey;
}

export function rangeForView(
  anchor: string,
  mode: "day" | "week" | "month",
): { start: string; end: string } {
  if (mode === "day") return { start: anchor, end: anchor };
  if (mode === "month") {
    const date = parseDateKey(anchor);
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start: toDateKey(start), end: toDateKey(end) };
  }
  const weekStart = startOfWeek(parseDateKey(anchor));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return { start: toDateKey(weekStart), end: toDateKey(weekEnd) };
}

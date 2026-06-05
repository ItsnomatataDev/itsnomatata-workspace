import type { PlannerAvailability } from "../types";
import { formatDayLabel } from "./calendarDates";

export function formatDayCount(days?: number | null) {
  const value = Math.max(1, Math.round(Number(days ?? 1)));
  return `${value} day${value === 1 ? "" : "s"}`;
}

export function formatAvailabilityKind(item: PlannerAvailability) {
  return item.kind === "leave" ? "On leave" : "Off day";
}

export function formatAvailabilityRange(item: PlannerAvailability) {
  if (item.start_date === item.end_date) return formatDayLabel(item.start_date);
  return `${formatDayLabel(item.start_date)} - ${formatDayLabel(item.end_date)}`;
}

export function formatAvailabilitySummary(item: PlannerAvailability) {
  return `${formatAvailabilityKind(item)} · ${formatDayCount(item.day_count)} · ${formatAvailabilityRange(item)}`;
}

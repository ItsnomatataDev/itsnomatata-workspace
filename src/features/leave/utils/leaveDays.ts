import { supabase } from "../../../lib/supabase/client";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const LEAVE_OFFICES = ["IT's Nomatata", "Three Little Birds"] as const;
export type LeaveOffice = (typeof LEAVE_OFFICES)[number];

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function normalizeLeaveOffice(office?: string | null): LeaveOffice {
  const normalized = office?.trim().toLowerCase();

  if (normalized === "three little birds") return "Three Little Birds";

  return "IT's Nomatata";
}

export function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function calculateLeaveDays(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 0;

  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const diffMs = end.getTime() - start.getTime();

  if (Number.isNaN(diffMs) || diffMs < 0) return 0;

  return Math.floor(diffMs / MS_PER_DAY) + 1;
}

export async function calculateLeaveDaysWithExclusions(params: {
  organizationId: string;
  startDate: string;
  endDate: string;
  office?: string | null;
}) {
  return calculateLeaveDaysForOffice(params);
}

export async function getPublicHolidaysBetween(params: {
  organizationId: string;
  startDate: string;
  endDate: string;
}) {
  const normalizeHoliday = (holiday: Record<string, unknown>) => ({
    id: holiday.id as string,
    date: (holiday.holiday_date ?? holiday.date) as string,
    title: (holiday.title ?? holiday.name) as string,
  });

  const { data, error } = await supabase
    .from("public_holidays")
    .select("id, holiday_date, date, title, name, country_code")
    .eq("organization_id", params.organizationId)
    .eq("country_code", "ZW")
    .gte("holiday_date", params.startDate)
    .lte("holiday_date", params.endDate)
    .order("holiday_date", { ascending: true });

  if (error) {
    const missingNewColumns =
      error.message.includes("country_code") ||
      error.message.includes("holiday_date") ||
      error.message.includes("title");

    if (!missingNewColumns) throw error;

    const { data: legacyData, error: legacyError } = await supabase
      .from("public_holidays")
      .select("id, date, name")
      .eq("organization_id", params.organizationId)
      .gte("date", params.startDate)
      .lte("date", params.endDate)
      .order("date", { ascending: true });

    if (legacyError) throw legacyError;
    return (legacyData ?? []).map(normalizeHoliday);
  }

  return (data ?? []).map(normalizeHoliday);
}

export async function calculateLeaveDaysForOffice(params: {
  organizationId: string;
  startDate: string;
  endDate: string;
  office?: string | null;
}) {
  if (!params.startDate || !params.endDate) return 0;

  const start = parseDateOnly(params.startDate);
  const end = parseDateOnly(params.endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end.getTime() < start.getTime()) return 0;

  const office = normalizeLeaveOffice(params.office);

  if (office === "Three Little Birds") {
    return calculateLeaveDays(params.startDate, params.endDate);
  }

  const holidays = await getPublicHolidaysBetween({
    organizationId: params.organizationId,
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const holidaySet = new Set(holidays.map((holiday) => holiday.date));

  let dayCount = 0;
  let current = new Date(start);

  while (current <= end) {
    const dateString = formatDateOnly(current);

    if (!isWeekend(current) && !holidaySet.has(dateString)) {
      dayCount++;
    }

    current = new Date(current.getTime() + MS_PER_DAY);
  }

  return dayCount;
}

export function formatLeaveDaysLabel(days: number) {
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function getLeaveCountingRuleLabel(office?: string | null) {
  return normalizeLeaveOffice(office) === "Three Little Birds"
    ? "Three Little Birds counts every calendar day, including weekends and Zimbabwe public holidays."
    : "IT's Nomatata excludes Saturdays, Sundays, and Zimbabwe public holidays.";
}

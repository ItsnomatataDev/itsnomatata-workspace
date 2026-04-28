import { supabase } from "../../../lib/supabase/client";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00Z`);
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
}) {
  if (!params.startDate || !params.endDate) return 0;

  const start = parseDateOnly(params.startDate);
  const end = parseDateOnly(params.endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end.getTime() < start.getTime()) return 0;

  // Get organization settings
  const { data: org } = await supabase
    .from("organizations")
    .select("leave_settings")
    .eq("id", params.organizationId)
    .single();

  const settings = org?.leave_settings as {
    exclude_weekends?: boolean;
    include_public_holidays?: boolean;
  } || {};

  const excludeWeekends = settings.exclude_weekends ?? false;
  const includePublicHolidays = settings.include_public_holidays ?? false;

  // Get public holidays if needed
  let holidays: Date[] = [];
  if (includePublicHolidays) {
    const { data: holidayData } = await supabase
      .from("public_holidays")
      .select("date")
      .eq("organization_id", params.organizationId)
      .gte("date", params.startDate)
      .lte("date", params.endDate);

    holidays = holidayData?.map((h) => new Date(`${h.date}T00:00:00Z`)) || [];
  }

  // Count days excluding weekends and holidays
  let dayCount = 0;
  let current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6

    const isHoliday = holidays.some(
      (h) => h.toDateString() === current.toDateString()
    );

    if ((!excludeWeekends || !isWeekend) && !isHoliday) {
      dayCount++;
    }

    current = new Date(current.getTime() + MS_PER_DAY);
  }

  return Math.max(dayCount, 1);
}

export function formatLeaveDaysLabel(days: number) {
  return `${days} day${days === 1 ? "" : "s"}`;
}

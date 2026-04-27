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

export function formatLeaveDaysLabel(days: number) {
  return `${days} day${days === 1 ? "" : "s"}`;
}

export const ZIMBABWE_TIME_ZONE = "Africa/Harare";
export const ZIMBABWE_LOCALE = "en-ZW";
export const ZIMBABWE_WEEK_START = 1;

const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZIMBABWE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getZimbabweDateKey(value: Date | string | number): string {
  const parts = DATE_KEY_FORMATTER.formatToParts(new Date(value));
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function formatZimbabweDate(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat(ZIMBABWE_LOCALE, {
    timeZone: ZIMBABWE_TIME_ZONE,
    ...options,
  }).format(new Date(value));
}

export function formatZimbabweDateTime(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat(ZIMBABWE_LOCALE, {
    timeZone: ZIMBABWE_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  }).format(new Date(value));
}

export function startOfZimbabweWeek(date: Date, weekStart = ZIMBABWE_WEEK_START) {
  const clone = new Date(date);
  const day = clone.getDay();
  const distance = (day + 7 - weekStart) % 7;
  clone.setDate(clone.getDate() - distance);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

export function makeZimbabweLocalIso(dateKey: string, time = "09:00:00") {
  return new Date(`${dateKey}T${time}+02:00`).toISOString();
}

export function getZimbabweMonthRangeIso(value: Date | string | number = new Date()) {
  const dateKey = getZimbabweDateKey(value);
  const [yearText, monthText] = dateKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const startKey = `${yearText}-${monthText}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const endKey = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  return {
    start: makeZimbabweLocalIso(startKey, "00:00:00"),
    end: makeZimbabweLocalIso(endKey, "00:00:00"),
    label: formatZimbabweDate(makeZimbabweLocalIso(startKey, "12:00:00"), {
      month: "long",
      year: "numeric",
    }),
  };
}

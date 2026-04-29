import { startOfZimbabweWeek } from "./zimbabweCalendar";

export function secondsBetween(start: string, end?: string | null): number {
    const startMs = new Date(start).getTime();
    const endMs = end ? new Date(end).getTime() : Date.now();

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;

    return Math.max(0, Math.floor((endMs - startMs) / 1000));
}
export function calculateDurationSeconds(
    startedAt: string,
    endedAt: string,
): number {
    return secondsBetween(startedAt, endedAt);
}
export function getEntrySeconds(entry: {
    started_at: string;
    ended_at?: string | null;
    duration_seconds?: number | null;
}): number {
    if (
        typeof entry.duration_seconds === "number" &&
        entry.duration_seconds >= 0 &&
        entry.ended_at
    ) {
        return entry.duration_seconds;
    }

    return secondsBetween(entry.started_at, entry.ended_at);
}
export function getLiveDurationSeconds(entry: {
    started_at: string;
    ended_at?: string | null;
    duration_seconds?: number | null;
    is_running?: boolean;
}): number {
    if (!entry.is_running || entry.ended_at) {
        return getEntrySeconds(entry);
    }

    return secondsBetween(entry.started_at, null);
}
export function startOfTodayISO(): string {
    const now = new Date();
    return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
    ).toISOString();
}
export function startOfWeekISO(weekStart = 1): string {
    return startOfZimbabweWeek(new Date(), weekStart).toISOString();
}

export function formatDurationHms(totalSeconds: number): string {
    const safe = Math.max(0, Math.floor(Number(totalSeconds || 0)));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;

    const pad = (value: number) => String(value).padStart(2, "0");
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatDurationShort(seconds: number): string {
    const total = Math.max(0, Number(seconds || 0));
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

import {
    getZimbabweDateKey,
    makeZimbabweLocalIso,
    startOfZimbabweWeek,
} from "./zimbabweCalendar";

export type TimeEntryLike = {
    id?: string;
    task_id?: string | null;
    started_at: string;
    ended_at?: string | null;
    duration_seconds?: number | null;
    is_running?: boolean | null;
    deleted_at?: string | null;
};

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

// Shared time-tracking helpers. These intentionally separate completed totals
// from running elapsed time so active sessions are never counted twice.
export function getEntryDurationSeconds(entry: TimeEntryLike): number {
    return getEntrySeconds(entry);
}

export function getRunningEntryElapsedSeconds(
    entry?: TimeEntryLike | null,
    now: Date | number = Date.now(),
): number {
    if (!entry || entry.ended_at || entry.deleted_at) return 0;

    const startMs = new Date(entry.started_at).getTime();
    const nowMs = now instanceof Date ? now.getTime() : now;

    if (Number.isNaN(startMs) || Number.isNaN(nowMs)) return 0;
    return Math.max(0, Math.floor((nowMs - startMs) / 1000));
}

export function getLiveDurationSeconds(entry: TimeEntryLike): number {
    if (!entry.is_running || entry.ended_at) {
        return getEntrySeconds(entry);
    }

    return getRunningEntryElapsedSeconds(entry);
}

export function isEntryTodayZimbabwe(
    entry: TimeEntryLike,
    now: Date | string | number = new Date(),
): boolean {
    return getZimbabweDateKey(entry.started_at) === getZimbabweDateKey(now);
}

export function getZimbabweTodayRangeIso(
    now: Date | string | number = new Date(),
): { start: string; end: string; dateKey: string } {
    const dateKey = getZimbabweDateKey(now);
    const start = makeZimbabweLocalIso(dateKey, "00:00:00");
    const startDate = new Date(start);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    return {
        start,
        end: endDate.toISOString(),
        dateKey,
    };
}

export function startOfTodayISO(): string {
    return getZimbabweTodayRangeIso().start;
}

export function getTodayCompletedSeconds(
    entries: TimeEntryLike[],
    now: Date | string | number = new Date(),
): number {
    return entries
        .filter((entry) =>
            !entry.deleted_at &&
            Boolean(entry.ended_at) &&
            isEntryTodayZimbabwe(entry, now)
        )
        .reduce((sum, entry) => sum + getEntryDurationSeconds(entry), 0);
}

export function getTodayTotalSeconds(
    entries: TimeEntryLike[],
    activeTimer?: TimeEntryLike | null,
    now: Date | number = Date.now(),
): number {
    const completed = getTodayCompletedSeconds(entries, now);
    return completed + getRunningEntryElapsedSeconds(activeTimer, now);
}

export function getTaskTodaySeconds(
    taskId: string,
    entries: TimeEntryLike[],
    activeTimer?: TimeEntryLike | null,
    now: Date | number = Date.now(),
): number {
    const completed = getTodayCompletedSeconds(
        entries.filter((entry) => entry.task_id === taskId),
        now,
    );

    return completed +
        (activeTimer?.task_id === taskId
            ? getRunningEntryElapsedSeconds(activeTimer, now)
            : 0);
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

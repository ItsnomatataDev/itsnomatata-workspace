import { supabase } from "../../../lib/supabase/client";
import type { TimeEntryItem } from "../../../lib/supabase/mutations/timeEntries";
import { createManualTimeEntry } from "../../../lib/supabase/mutations/timeEntries";
import { getTrackedTimeByTask } from "../../../lib/supabase/queries/tasks";
import { getTimeEntries } from "../../../lib/supabase/queries/timeEntries";

export interface TaskTimeLogInput {
    organizationId: string;
    userId: string;
    taskId: string;
    duration_minutes: number;
    description?: string;
    isBillable?: boolean;
}

export interface TaskTimeEntrySummary {
    id: string;
    duration: number; // seconds
    type: "timer" | "manual";
    user_name: string;
    created_at: string;
    description?: string;
}

export interface TaskTimeResponse {
    total_time: number; // seconds
    total_minutes: number;
    entries: TaskTimeEntrySummary[];
}

export async function logTaskTime(
    input: TaskTimeLogInput,
): Promise<TimeEntryItem> {
    const {
        organizationId,
        userId,
        taskId,
        duration_minutes,
        description,
        isBillable = false,
    } = input;

    if (!organizationId || !userId || !taskId || duration_minutes <= 0) {
        throw new Error("Missing required fields or invalid duration");
    }

    const now = new Date();
    const durationSeconds = duration_minutes * 60;
    const startedAt = new Date(now.getTime() - durationSeconds * 1000);

    const payload = {
        organizationId,
        userId,
        taskId,
        startedAt: startedAt.toISOString(),
        endedAt: now.toISOString(),
        description: description ||
            `Manual time entry - ${duration_minutes} minutes`,
        isBillable,
        source: "manual" as const,
    };

    return createManualTimeEntry(payload as any); // type assertion for compatibility
}

export async function getTaskTime(
    organizationId: string,
    taskId: string,
): Promise<TaskTimeResponse> {
    if (!organizationId || !taskId) {
        throw new Error("organizationId and taskId required");
    }

    // Total time
    const tracked = await getTrackedTimeByTask(organizationId);
    const totalSeconds =
        tracked.find((t) => t.task_id === taskId)?.tracked_seconds || 0;

    // Entries with user names
    const entries = await getTimeEntries({
        organizationId,
        taskId,
    } as any); // fix type until queries updated

    // Fetch user profiles
    const userIds = [
        ...new Set(entries.map((e) => e.user_id).filter(Boolean)),
    ] as string[];
    let profileMap = new Map<string, string>();
    if (userIds.length > 0) {
        const { data } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds);

        profileMap = new Map(
            (data ?? []).map((p: any) => [p.id, p.full_name || "Unknown"]),
        );
    }

    const summaries = entries.map((entry) => ({
        id: entry.id,
        duration: entry.duration_seconds || 0,
        type: (entry as any).entry_type as "timer" | "manual",
        user_name: profileMap.get(entry.user_id!) || "Unknown",
        created_at: entry.created_at,
        description: entry.description || undefined,
    })).slice(0, 50); // recent 50

    return {
        total_time: totalSeconds,
        total_minutes: Math.round(totalSeconds / 60),
        entries: summaries,
    };
}

// Re-export for convenience
export {
    createManualTimeEntry,
    startTimeEntry,
    stopTimeEntry,
} from "../../../lib/supabase/mutations/timeEntries";
export type { TimeEntryItem } from "../../../lib/supabase/mutations/timeEntries";

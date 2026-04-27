import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase/client";
import type { AdminTimeEntryRow } from "../supabase/queries/adminTime";
import { getAdminTimeEntries } from "../supabase/queries/adminTime";

interface UseTeamTimesheetsRealtimeProps {
    organizationId: string;
    from?: string;
    to?: string;
    refreshIntervalMs?: number;
}

function getLiveDurationSeconds(entry: AdminTimeEntryRow): number {
    if (entry.ended_at) {
        return entry.duration_seconds ?? 0;
    }
    const startedMs = new Date(entry.started_at).getTime();
    const nowMs = Date.now();
    return Math.max(0, Math.floor((nowMs - startedMs) / 1000));
}

export function useTeamTimesheetsRealtime(
    {
        organizationId,
        from,
        to,
        refreshIntervalMs = 2000,
    }: UseTeamTimesheetsRealtimeProps,
) {
    const [entries, setEntries] = useState<AdminTimeEntryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(Date.now());

    const loadEntries = useCallback(async (options?: { silent?: boolean }) => {
        if (!options?.silent) {
            setLoading(true);
        }
        try {
            const rows = await getAdminTimeEntries({
                organizationId,
                approvalStatus: "all",
                from,
                to,
                limit: 1000,
            });
            setEntries(rows);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load");
        } finally {
            setLoading(false);
        }
    }, [organizationId, from, to]);

    useEffect(() => {
        if (!organizationId) return;
        loadEntries();
    }, [loadEntries]);

    useEffect(() => {
        if (!organizationId || refreshIntervalMs <= 0) return;
        const interval = setInterval(() => {
            loadEntries({ silent: true });
        }, refreshIntervalMs);
        return () => clearInterval(interval);
    }, [organizationId, refreshIntervalMs, loadEntries]);

    // Tick every second so running timers display live duration without page refresh
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!organizationId) return;

        const timeChannel = supabase
            .channel("timesheets-time-entries")
            .on(
                "postgres_changes" as any,
                {
                    event: "INSERT",
                    schema: "public",
                    table: "time_entries",
                    filter: `organization_id=eq.${organizationId}`,
                },
                () => {
                    // Reload to get fully enriched data (user names, task titles, etc.)
                    loadEntries({ silent: true });
                },
            )
            .on(
                "postgres_changes" as any,
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "time_entries",
                    filter: `organization_id=eq.${organizationId}`,
                },
                () => {
                    loadEntries({ silent: true });
                },
            )
            .on(
                "postgres_changes" as any,
                {
                    event: "DELETE",
                    schema: "public",
                    table: "time_entries",
                    filter: `organization_id=eq.${organizationId}`,
                },
                () => {
                    loadEntries({ silent: true });
                },
            )
            .subscribe();

        const taskChannel = supabase
            .channel("timesheets-tasks")
            .on(
                "postgres_changes" as any,
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "tasks",
                    filter: `organization_id=eq.${organizationId}`,
                },
                () => loadEntries({ silent: true }),
            )
            .subscribe();

        return () => {
            supabase.removeChannel(timeChannel);
            supabase.removeChannel(taskChannel);
        };
    }, [organizationId, loadEntries]);

    // Apply live duration to running entries so the UI shows real tracked time
    const liveEntries = useMemo(() => {
        return entries.map((entry) => {
            const isRunning = !entry.ended_at || entry.is_running;
            if (!isRunning) return entry;
            return {
                ...entry,
                is_running: true,
                duration_seconds: getLiveDurationSeconds(entry),
            };
        });
    }, [entries, now]);

    return {
        entries: liveEntries,
        rawEntries: entries,
        loading,
        error,
        refetch: () => loadEntries({ silent: true }),
    };
}

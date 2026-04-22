import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase/client";
import type { AdminTimeEntryRow } from "../supabase/queries/adminTime";
import { getAdminTimeEntries } from "../supabase/queries/adminTime";

interface UseTeamTimesheetsRealtimeProps {
    organizationId: string;
}

export function useTeamTimesheetsRealtime(
    { organizationId }: UseTeamTimesheetsRealtimeProps,
) {
    const [entries, setEntries] = useState<AdminTimeEntryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadEntries = useCallback(async () => {
        try {
            setLoading(true);
            // Remove date filter to fetch all recent data, page filters to 2-weeks
            const rows = await getAdminTimeEntries({
                organizationId,
                approvalStatus: "all",
                limit: 1000,
            });
            setEntries(rows);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load");
        } finally {
            setLoading(false);
        }
    }, [organizationId]);

    useEffect(() => {
        if (!organizationId) return;
        loadEntries();
    }, [loadEntries]);

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
                (payload) => {
                    setEntries((
                        prev,
                    ) => [payload.new as AdminTimeEntryRow, ...prev]);
                },
            )
            .on(
                "postgres_changes" as any,
                {
                    event: ["UPDATE", "DELETE"],
                    schema: "public",
                    table: "time_entries",
                    filter: `organization_id=eq.${organizationId}`,
                },
                () => {
                    loadEntries(); // Refresh on update/delete
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
                () => loadEntries(),
            )
            .subscribe();

        return () => {
            supabase.removeChannel(timeChannel);
            supabase.removeChannel(taskChannel);
        };
    }, [organizationId, loadEntries]);

    return { entries, loading, error, refetch: loadEntries };
}

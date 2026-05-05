import { useEffect, useState } from "react";
import { supabase } from "../supabase/client";
import type { TimeEntryItem } from "../supabase/mutations/timeEntries";
import {
  getZimbabweDateKey,
  startOfZimbabweWeek as startOfWeek,
} from "../utils/zimbabweCalendar";

export interface TimesheetSummary {
  totalSeconds: number;
  billableSeconds: number;
  entryCount: number;
  avgDailyHours: number;
}

export interface DailySummary {
  date: string;
  totalSeconds: number;
  billableSeconds: number;
  entries: TimeEntryItem[];
}

export interface TimesheetData {
  entries: TimeEntryItem[];
  summary: TimesheetSummary;
  daily: Record<string, DailySummary>;
  weekTotals: Record<string, number>;
  activeEntry: TimeEntryItem | null;
}

export type TimesheetView = "today" | "week" | "month" | "all" | "custom";

export interface UseUserTimesheetParams {
  organizationId: string;
  userId: string;
  view: TimesheetView;
  fromDate?: string;
  toDate?: string;
  realtime?: boolean;
}

function normalizeTimeEntry(entry: any): TimeEntryItem {
  return {
    ...entry,
    task_title: entry.tasks?.title ?? null,
    project_name: entry.projects?.name ?? null,
    client_name: entry.projects?.clients?.name ?? null,
  } as TimeEntryItem;
}

export function useUserTimesheet(params: UseUserTimesheetParams) {
  const {
    organizationId,
    userId,
    view,
    fromDate: fromDateParam,
    toDate: toDateParam,
    realtime = true,
  } = params;

  const [data, setData] = useState<TimesheetData>({
    entries: [],
    summary: {
      totalSeconds: 0,
      billableSeconds: 0,
      entryCount: 0,
      avgDailyHours: 0,
    },
    daily: {},
    weekTotals: {},
    activeEntry: null,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getDateRange = () => {
    const now = new Date();
    let from: Date;
    let to: Date = new Date(now);

    switch (view) {
      case "today":
        from = new Date(now);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        break;

      case "week":
        from = startOfWeek(now);
        to.setHours(23, 59, 59, 999);
        break;

      case "month":
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        break;

      case "all":
        from = new Date("2024-01-01T00:00:00.000Z");
        to.setHours(23, 59, 59, 999);
        break;

      case "custom":
        from = fromDateParam
          ? new Date(fromDateParam)
          : new Date("2024-01-01T00:00:00.000Z");

        to = toDateParam ? new Date(toDateParam) : new Date(now);

        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        break;

      default:
        from = new Date(now);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
    };
  };

  const fetchData = async () => {
    if (!organizationId || !userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { from, to } = getDateRange();

      const { data: entriesRaw, error: entriesError } = await supabase
        .from("time_entries")
        .select(`
          *,
          tasks!task_id (
            id,
            title
          ),
          projects (
            id,
            name,
            client_id,
            clients (
              id,
              name
            )
          )
        `)
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .gte("started_at", from)
        .lte("started_at", to)
        .is("deleted_at", null)
        .order("started_at", { ascending: false });

      if (entriesError) throw entriesError;

      const entries: TimeEntryItem[] = ((entriesRaw as any[]) || []).map(
        normalizeTimeEntry,
      );

      const { data: activeEntryRaw, error: activeEntryError } = await supabase
        .from("time_entries")
        .select(`
          *,
          tasks!task_id (
            id,
            title
          ),
          projects (
            id,
            name,
            client_id,
            clients (
              id,
              name
            )
          )
        `)
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .is("ended_at", null)
        .is("deleted_at", null)
        .maybeSingle();

      if (activeEntryError) throw activeEntryError;

      const activeEntry: TimeEntryItem | null = activeEntryRaw
        ? normalizeTimeEntry(activeEntryRaw)
        : null;

      const daily: Record<string, DailySummary> = {};
      const weekTotals: Record<string, number> = {};

      let totalSeconds = 0;
      let billableSeconds = 0;
      let entryCount = 0;

      entries.forEach((entry: any) => {
        const dayKey = getZimbabweDateKey(entry.started_at);
        const seconds = Number(entry.duration_seconds || 0);

        entryCount += 1;
        totalSeconds += seconds;

        if (entry.is_billable) {
          billableSeconds += seconds;
        }

        if (!daily[dayKey]) {
          daily[dayKey] = {
            date: dayKey,
            totalSeconds: 0,
            billableSeconds: 0,
            entries: [],
          };
        }

        daily[dayKey].totalSeconds += seconds;
        daily[dayKey].billableSeconds += entry.is_billable ? seconds : 0;
        daily[dayKey].entries.push(entry);

        weekTotals[dayKey] = (weekTotals[dayKey] || 0) + seconds;
      });

      const activeDays = Object.keys(daily).length;

      const avgDailyHours =
        activeDays > 0 ? totalSeconds / 3600 / activeDays : 0;

      setData({
        entries,
        summary: {
          totalSeconds,
          billableSeconds,
          entryCount,
          avgDailyHours,
        },
        daily,
        weekTotals,
        activeEntry,
      });
    } catch (err) {
      console.error("Failed to load user timesheet:", err);

      setError(
        err instanceof Error ? err.message : "Failed to load timesheet",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [organizationId, userId, view, fromDateParam, toDateParam]);

  useEffect(() => {
    if (!realtime || !organizationId || !userId) return;

    const channel = supabase
      .channel(`user_timesheet_${organizationId}_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "time_entries",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, userId, view, fromDateParam, toDateParam, realtime]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    dateRange: getDateRange(),
  };
}
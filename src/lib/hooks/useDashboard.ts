import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase/client";
import {
  getActiveTimeEntry,
  startTimeEntry,
  stopTimeEntry,
  type TimeEntryItem,
} from "../supabase/mutations/timeEntries";
import {
  getRunningEntryElapsedSeconds,
  getTaskTodaySeconds,
  getTodayTotalSeconds,
  getZimbabweTodayRangeIso,
} from "../utils/timeMath";
import { TIMER_STATE_CHANGED_EVENT } from "../timeTracking/timerEvents";

type DashboardStats = {
  openTasks: number;
  inProgressTasks: number;
  reviewTasks: number;
  doneTasks: number;
  unreadNotifications: number;
  pendingApprovals: number;
  todaySeconds: number;
  myProjects: number;
  completedProjects: number;
};

export type DashboardTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  created_by: string | null;
  assigned_to: string | null;


  client_id: string | null;
  office_id?: string | null;
  project_id: string | null;

  created_by_full_name?: string | null;
  created_by_email?: string | null;
};

type Announcement = {
  id: string;
  title: string;
  content: string;
  created_at: string;
};

type WeatherData = {
  temperature: number | null;
  windspeed: number | null;
  weathercode: number | null;
  cityLabel: string;
};

type RoleNewsItem = {
  title: string;
  description?: string;
  url?: string;
  publishedAt?: string;
  source?: string;
};

type ActiveTimer = TimeEntryItem | null;

export type DashboardTaskBucketKey = "open" | "in_progress" | "review";

export type DashboardTaskBuckets = Record<DashboardTaskBucketKey, DashboardTask[]>;

const OPEN_TASK_STATUSES = new Set(["todo", "backlog", "blocked"]);
const DASHBOARD_TASK_ID_CHUNK_SIZE = 75;

function isNetworkFetchError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Failed to fetch|NetworkError|Load failed/i.test(message);
}

export function isDashboardTaskOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function excludeOverdueTasks(tasks: DashboardTask[]) {
  return tasks.filter((task) => !isDashboardTaskOverdue(task.due_date));
}

function mapDashboardTaskRow(task: Record<string, unknown>): DashboardTask {
  const profiles = task.profiles as { full_name?: string | null; email?: string | null } | null;
  return {
    id: task.id as string,
    title: task.title as string,
    status: task.status as string,
    priority: task.priority as string,
    due_date: (task.due_date as string | null) ?? null,
    created_at: task.created_at as string,
    created_by: (task.created_by as string | null) ?? null,
    assigned_to: (task.assigned_to as string | null) ?? null,
    client_id: (task.client_id as string | null) ?? null,
    office_id: (task.office_id as string | null) ?? null,
    project_id: (task.project_id as string | null) ?? null,
    created_by_full_name: profiles?.full_name ?? null,
    created_by_email: profiles?.email ?? null,
  };
}

function buildDashboardTaskBuckets(tasks: DashboardTask[]): DashboardTaskBuckets {
  const open: DashboardTask[] = [];
  const inProgress: DashboardTask[] = [];
  const review: DashboardTask[] = [];

  for (const task of tasks) {
    if (OPEN_TASK_STATUSES.has(task.status)) open.push(task);
    else if (task.status === "in_progress") inProgress.push(task);
    else if (task.status === "review") review.push(task);
  }

  const byDueThenUpdated = (a: DashboardTask, b: DashboardTask) => {
    const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  };

  open.sort(byDueThenUpdated);
  inProgress.sort(byDueThenUpdated);
  review.sort(byDueThenUpdated);

  return { open, in_progress: inProgress, review };
}

async function fetchDashboardTasksByIds(params: {
  organizationId: string;
  taskIds: string[];
  officeId?: string | null;
  includeAllOffices: boolean;
}) {
  const chunks: string[][] = [];
  for (let index = 0; index < params.taskIds.length; index += DASHBOARD_TASK_ID_CHUNK_SIZE) {
    chunks.push(params.taskIds.slice(index, index + DASHBOARD_TASK_ID_CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map((chunk) => {
      let query = supabase
        .from("tasks")
        .select(`
          id,
          office_id,
          title,
          status,
          priority,
          due_date,
          created_at,
          created_by,
          assigned_to,
          client_id,
          project_id,
          profiles:created_by (
            full_name,
            email
          )
        `)
        .eq("organization_id", params.organizationId)
        .in("id", chunk)
        .is("archived_at", null)
        .not("status", "in", "(done,cancelled)");

      if (!params.includeAllOffices && params.officeId) {
        query = query.eq("office_id", params.officeId);
      }

      return query;
    }),
  );

  const firstError = results.find((result) => result.error)?.error;
  if (firstError) throw firstError;

  return results.flatMap((result) => (result.data ?? []) as Record<string, unknown>[]);
}

function isDashboardTaskOwnedByUser(
  task: DashboardTask,
  userId: string,
  assignedThroughAssigneeRows: Set<string>,
) {
  return (
    task.created_by === userId ||
    task.assigned_to === userId ||
    assignedThroughAssigneeRows.has(task.id)
  );
}

export function useDashboard(params: {
  userId?: string;
  organizationId?: string | null;
  officeId?: string | null;
  includeAllOffices?: boolean;
  role?: string | null;
  cityLabel?: string;
  latitude?: number | null;
  longitude?: number | null;
  enabled?: boolean;
}) {
  const {
    userId,
    organizationId,
    officeId,
    includeAllOffices = false,
    role,
    cityLabel,
    latitude,
    longitude,
    enabled = true,
  } = params;

  const [baseStats, setBaseStats] = useState<Omit<DashboardStats, "todaySeconds"> | null>(null);
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [taskBuckets, setTaskBuckets] = useState<DashboardTaskBuckets>({
    open: [],
    in_progress: [],
    review: [],
  });
  const [todayTimeEntries, setTodayTimeEntries] = useState<TimeEntryItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [roleNews, setRoleNews] = useState<RoleNewsItem[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer>(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const activeSessionSeconds = useMemo(
    () => getRunningEntryElapsedSeconds(activeTimer, now),
    [activeTimer, now],
  );

  const todaySeconds = useMemo(
    () => getTodayTotalSeconds(todayTimeEntries, activeTimer, now),
    [activeTimer, now, todayTimeEntries],
  );

  const taskTodaySeconds = useMemo(() => {
    const map: Record<string, number> = {};
    for (const task of tasks) {
      map[task.id] = getTaskTodaySeconds(
        task.id,
        todayTimeEntries,
        activeTimer,
        now,
      );
    }
    return map;
  }, [activeTimer, now, tasks, todayTimeEntries]);

  const stats = useMemo<DashboardStats | null>(() => {
    if (!baseStats) return null;
    return {
      ...baseStats,
      todaySeconds,
    };
  }, [baseStats, todaySeconds]);

  const roleNewsTopic = useMemo(() => {
    switch (role) {
      case "social_media":
        return "social media marketing";
      case "media_team":
        return "digital media production";
      case "seo_specialist":
        return "SEO search marketing";
      case "admin":
        return "business operations";
      case "it":
        return "software engineering automation";
      case "manager":
        return "business leadership operations";
      default:
        return "business technology";
    }
  }, [role]);

  const loadWeather = useCallback(async () => {
    if (latitude == null || longitude == null) {
      setWeather(null);
      return;
    }

    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,weather_code`,
      );

      if (!res.ok) throw new Error("Weather request failed");

      const json = await res.json();

      setWeather({
        temperature: json?.current?.temperature_2m ?? null,
        windspeed: json?.current?.wind_speed_10m ?? null,
        weathercode: json?.current?.weather_code ?? null,
        cityLabel: cityLabel || "Your city",
      });
    } catch (err) {
      if (!isNetworkFetchError(err)) {
        console.warn("WEATHER LOAD ERROR:", err);
      }
      setWeather(null);
    }
  }, [latitude, longitude, cityLabel]);

  const loadRoleNews = useCallback(async () => {
    if (!role) {
      setRoleNews([]);
      return;
    }

    const apiKey = import.meta.env.VITE_GNEWS_API_KEY;

    if (!apiKey) {
      setRoleNews([]);
      return;
    }

    try {
      const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(
        roleNewsTopic,
      )}&lang=en&max=5&token=${apiKey}`;

      const res = await fetch(url);

      if (!res.ok) throw new Error("News request failed");

      const json = await res.json();

      const articles = (json.articles || []).map((item: any) => ({
        title: item.title,
        description: item.description,
        url: item.url,
        publishedAt: item.publishedAt,
        source: item.source?.name,
      }));

      setRoleNews(articles);
    } catch (err) {
      if (!isNetworkFetchError(err)) {
        console.warn("ROLE NEWS LOAD ERROR:", err);
      }
      setRoleNews([]);
    }
  }, [role, roleNewsTopic]);

  const refreshTimeTrackingState = useCallback(async () => {
    if (!userId || !organizationId) return;

    const todayRange = getZimbabweTodayRangeIso();

    let timeEntriesQuery = supabase
      .from("time_entries")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("started_at", todayRange.start)
      .lt("started_at", todayRange.end);

    if (!includeAllOffices && officeId) {
      timeEntriesQuery = timeEntriesQuery.eq("office_id", officeId);
    }

    const [timeEntriesRes, activeTimerRes] = await Promise.all([
      timeEntriesQuery,
      getActiveTimeEntry({
        organizationId,
        userId,
      }),
    ]);

    if (timeEntriesRes.error) {
      console.error("DASHBOARD TIME REFRESH ERROR:", timeEntriesRes.error);
      return;
    }

    setTodayTimeEntries((timeEntriesRes.data ?? []) as TimeEntryItem[]);
    setActiveTimer((activeTimerRes as ActiveTimer) ?? null);
  }, [userId, organizationId, officeId, includeAllOffices]);

  const load = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading !== false;

    if (!enabled) {
      setLoading(false);
      setError("");
      return;
    }

    if (!userId) {
      setLoading(false);
      setError("Missing authenticated user.");
      return;
    }

    if (!organizationId) {
      setLoading(false);
      setError("Missing organization.");
      return;
    }

    try {
      if (showLoading) {
        setLoading(true);
      }
      setError("");

      const [
        { data: ownedTasks, error: ownedTasksError },
        { data: directAssignments, error: directAssignmentsError },
        { data: taskAssignments, error: taskAssignmentsError },
      ] = await Promise.all([
        (() => {
          let query = supabase
            .from("tasks")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("created_by", userId)
            .is("archived_at", null)
            .not("status", "in", "(done,cancelled)");
          if (!includeAllOffices && officeId) {
            query = query.eq("office_id", officeId);
          }
          return query;
        })(),
        (() => {
          let query = supabase
            .from("tasks")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("assigned_to", userId)
            .is("archived_at", null)
            .not("status", "in", "(done,cancelled)");
          if (!includeAllOffices && officeId) {
            query = query.eq("office_id", officeId);
          }
          return query;
        })(),
        supabase
          .from("task_assignees")
          .select("task_id")
          .eq("organization_id", organizationId)
          .eq("user_id", userId),
      ]);

      if (ownedTasksError) throw ownedTasksError;
      if (directAssignmentsError) throw directAssignmentsError;
      if (taskAssignmentsError) throw taskAssignmentsError;

      const assigneeTaskIds = new Set(
        (taskAssignments?.map((assignment: { task_id: string }) => assignment.task_id) ?? []).filter(Boolean),
      );

      const assignedTaskIds = Array.from(
        new Set(
          [
            ...(ownedTasks?.map((row: { id: string }) => row.id) ?? []),
            ...(directAssignments?.map((row: { id: string }) => row.id) ?? []),
            ...assigneeTaskIds,
          ].filter(Boolean),
        ),
      );

      const todayRange = getZimbabweTodayRangeIso();

      const [
        notificationsRes,
        approvalsRes,
        myProjectsRes,
        completedProjectsRes,
        announcementsRes,
        timeEntriesRes,
        activeTimerRes,
      ] = await Promise.all([
        supabase
          .from("notifications")
          .select("id", { head: true, count: "exact" })
          .eq("user_id", userId)
          .eq("is_read", false),

        supabase
          .from("approvals")
          .select("id", { head: true, count: "exact" })
          .eq("assigned_approver", userId)
          .eq("approval_status", "pending"),

        supabase
          .from("project_members")
          .select("id", { head: true, count: "exact" })
          .eq("user_id", userId),

        supabase
          .from("projects")
          .select("id", { head: true, count: "exact" })
          .eq("organization_id", organizationId)
          .eq("status", "completed"),

        supabase
          .from("announcements")
          .select("id,title,content,created_at,target_roles")
          .eq("organization_id", organizationId)
          .eq("is_active", true)
          .or(
            role
              ? `target_roles.is.null,target_roles.cs.{${role}}`
              : "target_roles.is.null",
          )
          .order("created_at", { ascending: false })
          .limit(5),

        (() => {
          let query = supabase
          .from("time_entries")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("user_id", userId)
          .is("deleted_at", null)
          .gte("started_at", todayRange.start)
          .lt("started_at", todayRange.end);
          if (!includeAllOffices && officeId) query = query.eq("office_id", officeId);
          return query;
        })(),

        getActiveTimeEntry({
          organizationId,
          userId,
        }),
      ]);

      const baseErrors = [
        notificationsRes.error,
        approvalsRes.error,
        myProjectsRes.error,
        completedProjectsRes.error,
        announcementsRes.error,
        timeEntriesRes.error,
      ].filter(Boolean);

      if (baseErrors.length > 0) {
        throw baseErrors[0];
      }

      const activeTimer = (activeTimerRes as ActiveTimer) ?? null;

      let buckets: DashboardTaskBuckets = {
        open: [],
        in_progress: [],
        review: [],
      };
      let doneTasks = 0;

      const taskIdsToFetch = Array.from(
        new Set(
          [
            ...assignedTaskIds,
            activeTimer?.task_id ?? null,
          ].filter(Boolean) as string[],
        ),
      );

      if (taskIdsToFetch.length > 0) {
        const taskRows = await fetchDashboardTasksByIds({
          organizationId,
          taskIds: taskIdsToFetch,
          officeId,
          includeAllOffices,
        });

        const allMapped = taskRows
          .map(mapDashboardTaskRow)
          .filter((task) =>
            task.id === activeTimer?.task_id ||
            isDashboardTaskOwnedByUser(task, userId, assigneeTaskIds)
          );
        doneTasks = 0;

        const activeMapped = excludeOverdueTasks(
          allMapped.filter((task) => task.status !== "done" && task.status !== "cancelled"),
        );
        buckets = buildDashboardTaskBuckets(activeMapped);
      }

      setBaseStats({
        openTasks: buckets.open.length,
        inProgressTasks: buckets.in_progress.length,
        reviewTasks: buckets.review.length,
        doneTasks,
        unreadNotifications: notificationsRes.count ?? 0,
        pendingApprovals: approvalsRes.count ?? 0,
        myProjects: myProjectsRes.count ?? 0,
        completedProjects: completedProjectsRes.count ?? 0,
      });

      const visibleTasks = [...buckets.in_progress, ...buckets.review];
      const activeTimerTask = activeTimer?.task_id
        ? [...buckets.open, ...visibleTasks].find((task) => task.id === activeTimer.task_id)
        : null;

      setTaskBuckets(buckets);
      setTasks(
        activeTimerTask && !visibleTasks.some((task) => task.id === activeTimerTask.id)
          ? [activeTimerTask, ...visibleTasks]
          : visibleTasks,
      );
      setTodayTimeEntries((timeEntriesRes.data ?? []) as TimeEntryItem[]);
      setAnnouncements((announcementsRes.data ?? []) as Announcement[]);
      setActiveTimer(activeTimer);

      await Promise.all([loadWeather(), loadRoleNews()]);
    } catch (err: any) {
      console.error("DASHBOARD LOAD ERROR:", err);
      setError(err?.message || "Failed to load dashboard.");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [enabled, userId, organizationId, officeId, includeAllOffices, role, loadWeather, loadRoleNews]);

  const startTimer = useCallback(
    async (taskId?: string | null, description?: string) => {
      if (!userId) {
        throw new Error("Missing authenticated user.");
      }

      if (!organizationId) {
        throw new Error("Missing organization.");
      }

      try {
        setBusy(true);

        const entry = await startTimeEntry({
          organizationId,
          userId,
          taskId: taskId ?? null,
          description: description ?? null,
          source: "dashboard",
        });

        setActiveTimer(entry);
        await refreshTimeTrackingState();
      } finally {
        setBusy(false);
      }
    },
    [userId, organizationId, refreshTimeTrackingState],
  );

  const stopTimer = useCallback(async () => {
    if (!activeTimer?.id || !activeTimer?.started_at) return;

    try {
      setBusy(true);

      const stoppedEntry = await stopTimeEntry(activeTimer.id, {
        userId,
        organizationId: organizationId ?? undefined,
      });

      setActiveTimer(null);
      setTodayTimeEntries((previous) => {
        const withoutStopped = previous.filter((entry) => entry.id !== stoppedEntry.id);
        return [...withoutStopped, stoppedEntry];
      });
      await refreshTimeTrackingState();
    } finally {
      setBusy(false);
    }
  }, [activeTimer, organizationId, refreshTimeTrackingState, userId]);

  useEffect(() => {
    void load({ showLoading: true });
  }, [load]);

  useEffect(() => {
    if (!organizationId || !userId) return;

    let refreshTimeout: ReturnType<typeof setTimeout> | undefined;

    const channel = supabase
      .channel(`dashboard-time:${organizationId}:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "time_entries",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (refreshTimeout) {
            clearTimeout(refreshTimeout);
          }
          refreshTimeout = setTimeout(() => {
            void refreshTimeTrackingState();
          }, 400);
        },
      )
      .subscribe();

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      void supabase.removeChannel(channel);
    };
  }, [organizationId, refreshTimeTrackingState, userId]);

  useEffect(() => {
    if (!organizationId || !userId) return;

    const handleTimerStateChanged = (event: Event) => {
      const detail = (event as CustomEvent<{
        organizationId?: string | null;
        userId?: string | null;
      }>).detail;

      if (detail?.organizationId && detail.organizationId !== organizationId) return;
      if (detail?.userId && detail.userId !== userId) return;
      void load({ showLoading: false });
    };

    window.addEventListener(TIMER_STATE_CHANGED_EVENT, handleTimerStateChanged);
    return () => {
      window.removeEventListener(TIMER_STATE_CHANGED_EVENT, handleTimerStateChanged);
    };
  }, [load, organizationId, userId]);

  return {
    loading,
    busy,
    error,
    stats,
    tasks,
    taskBuckets,
    taskTodaySeconds,
    announcements,
    weather,
    roleNews,
    roleNewsTopic,
    activeTimer,
    activeSessionSeconds,
    reload: load,
    startTimer,
    stopTimer,
  };
}

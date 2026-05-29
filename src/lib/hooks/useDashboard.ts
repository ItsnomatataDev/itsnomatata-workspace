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
      console.error("WEATHER LOAD ERROR:", err);
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
      console.error("ROLE NEWS LOAD ERROR:", err);
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

      const { data: taskAssignments, error: taskAssignmentsError } =
        await supabase
          .from("task_assignees")
          .select("task_id")
          .eq("user_id", userId);

      if (taskAssignmentsError) throw taskAssignmentsError;

      const assignedTaskIds =
        taskAssignments
          ?.map((assignment: any) => assignment.task_id)
          .filter(Boolean) || [];

      let timeEntryTasksQuery = supabase
          .from("time_entries")
          .select("task_id")
          .eq("organization_id", organizationId)
          .eq("user_id", userId)
          .not("task_id", "is", null)
          .is("deleted_at", null)
          .order("started_at", { ascending: false })
          .limit(20);

      if (!includeAllOffices && officeId) {
        timeEntryTasksQuery = timeEntryTasksQuery.eq("office_id", officeId);
      }

      const { data: timeEntryTasks, error: timeEntryTasksError } =
        await timeEntryTasksQuery;

      if (timeEntryTasksError) throw timeEntryTasksError;

      const trackedTaskIds =
        timeEntryTasks?.map((entry: any) => entry.task_id).filter(Boolean) ||
        [];

      const allTaskIds = Array.from(
        new Set([...assignedTaskIds, ...trackedTaskIds]),
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

      let dashboardTasks: DashboardTask[] = [];
      let openTasks = 0;
      let inProgressTasks = 0;
      let reviewTasks = 0;
      let doneTasks = 0;

      if (allTaskIds.length > 0) {
        let taskRowsQuery = supabase
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
            client_id,
            project_id,
            profiles:created_by (
              full_name,
              email
            )
          `)
          .eq("organization_id", organizationId)
          .in("id", allTaskIds)
          .order("updated_at", { ascending: false })
          .limit(10);

        if (!includeAllOffices && officeId) {
          taskRowsQuery = taskRowsQuery.eq("office_id", officeId);
        }

        const { data: taskRows, error: taskRowsError } = await taskRowsQuery;

        if (taskRowsError) throw taskRowsError;

        dashboardTasks = ((taskRows ?? []) as any[]).map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          due_date: task.due_date,
          created_at: task.created_at,
          created_by: task.created_by,
          client_id: task.client_id ?? null,
          office_id: task.office_id ?? null,
          project_id: task.project_id ?? null,
          created_by_full_name: task.profiles?.full_name ?? null,
          created_by_email: task.profiles?.email ?? null,
        }));

        openTasks = dashboardTasks.filter((task) =>
          ["todo", "backlog", "blocked"].includes(task.status),
        ).length;

        inProgressTasks = dashboardTasks.filter(
          (task) => task.status === "in_progress",
        ).length;

        reviewTasks = dashboardTasks.filter(
          (task) => task.status === "review",
        ).length;

        doneTasks = dashboardTasks.filter((task) => task.status === "done")
          .length;
      }

      setBaseStats({
        openTasks,
        inProgressTasks,
        reviewTasks,
        doneTasks,
        unreadNotifications: notificationsRes.count ?? 0,
        pendingApprovals: approvalsRes.count ?? 0,
        myProjects: myProjectsRes.count ?? 0,
        completedProjects: completedProjectsRes.count ?? 0,
      });

      setTasks(dashboardTasks);
      setTodayTimeEntries((timeEntriesRes.data ?? []) as TimeEntryItem[]);
      setAnnouncements((announcementsRes.data ?? []) as Announcement[]);
      setActiveTimer((activeTimerRes as ActiveTimer) ?? null);

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

  return {
    loading,
    busy,
    error,
    stats,
    tasks,
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

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase/client";
import {
  clampToZimbabweCutoff,
  isAtOrAfterZimbabweCutoff,
} from "../utils/zimbabweCalendar";

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

type DashboardTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  created_by: string | null;
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

type ActiveTimer = {
  id: string;
  organization_id?: string | null;
  user_id: string;
  task_id?: string | null;
  description?: string | null;
  started_at: string;
  ended_at?: string | null;
  duration_seconds?: number | null;
} | null;

const startOfToday = () => {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
};

const diffInSeconds = (start: string, end?: string | null) => {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;

  return Math.max(0, Math.floor((endMs - startMs) / 1000));
};

export function useDashboard(params: {
  userId?: string;
  organizationId?: string | null;
  role?: string | null;
  cityLabel?: string;
  latitude?: number | null;
  longitude?: number | null;
  enabled?: boolean;
}) {
  const {
    userId,
    organizationId,
    role,
    cityLabel,
    latitude,
    longitude,
    enabled = true,
  } = params;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [roleNews, setRoleNews] = useState<RoleNewsItem[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer>(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      console.error("Missing GNews API key");
      setRoleNews([]);
      return;
    }

    try {
      const url = `https://gnews.io/api/v4/search?q=${
        encodeURIComponent(
          roleNewsTopic,
        )
      }&lang=en&max=5&token=${apiKey}`;

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

  const load = useCallback(async () => {
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
      setLoading(true);
      setError("");

      // Get task IDs from task_assignees junction table
      const { data: taskAssignments } = await supabase
        .from("task_assignees")
        .select("task_id")
        .eq("user_id", userId);

      const assignedTaskIds = taskAssignments?.map((a) => a.task_id) || [];

      // Also get task IDs from active time entries (tasks user is tracking but not assigned to)
      const { data: timeEntryTasks } = await supabase
        .from("time_entries")
        .select("task_id")
        .eq("user_id", userId)
        .is("ended_at", null)
        .not("task_id", "is", null);

      const trackedTaskIds = timeEntryTasks?.map((t) =>
        t.task_id
      ).filter(Boolean) || [];

      // Combine all task IDs the user cares about
      const allTaskIds = Array.from(
        new Set([...assignedTaskIds, ...trackedTaskIds]),
      );

      const assignmentFilter = allTaskIds.length > 0
        ? `,id.in.(${allTaskIds.join(",")})`
        : "";

      const [
        openRes,
        progressRes,
        reviewRes,
        doneRes,
        notificationsRes,
        approvalsRes,
        myProjectsRes,
        completedProjectsRes,
        recentTasksRes,
        announcementsRes,
        timeEntriesRes,
        activeTimerRes,
      ] = await Promise.all([
        supabase
          .from("tasks")
          .select("id", { head: true, count: "exact" })
          .or(`assigned_to.eq.${userId}${assignmentFilter}`)
          .in("status", ["todo", "backlog", "blocked"]),

        supabase
          .from("tasks")
          .select("id", { head: true, count: "exact" })
          .or(`assigned_to.eq.${userId}${assignmentFilter}`)
          .eq("status", "in_progress"),

        supabase
          .from("tasks")
          .select("id", { head: true, count: "exact" })
          .or(`assigned_to.eq.${userId}${assignmentFilter}`)
          .eq("status", "review"),

        supabase
          .from("tasks")
          .select("id", { head: true, count: "exact" })
          .or(`assigned_to.eq.${userId}${assignmentFilter}`)
          .eq("status", "done"),

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
          .from("tasks")
          .select(`
            id,title,status,priority,due_date,created_at,created_by,
            profiles:created_by(full_name,email)
          `)
          .or(`assigned_to.eq.${userId}${assignmentFilter}`)
          .order("updated_at", { ascending: false })
          .limit(6),

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

        supabase
          .from("time_entries")
          .select("id,started_at,ended_at,duration_seconds,description,task_id")
          .eq("user_id", userId)
          .gte("started_at", startOfToday()),

        supabase
          .from("time_entries")
          .select(
            "id,organization_id,user_id,task_id,description,started_at,ended_at,duration_seconds",
          )
          .eq("user_id", userId)
          .is("ended_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const errors = [
        openRes.error,
        progressRes.error,
        reviewRes.error,
        doneRes.error,
        notificationsRes.error,
        approvalsRes.error,
        myProjectsRes.error,
        completedProjectsRes.error,
        recentTasksRes.error,
        announcementsRes.error,
        timeEntriesRes.error,
        activeTimerRes.error,
      ].filter(Boolean);

      if (errors.length > 0) {
        throw errors[0];
      }

      const todaySeconds = (timeEntriesRes.data ?? []).reduce(
        (sum, item: any) => {
          if (typeof item.duration_seconds === "number" && item.ended_at) {
            return sum + Math.max(0, item.duration_seconds);
          }

          return sum + diffInSeconds(item.started_at, item.ended_at);
        },
        0,
      );

      setStats({
        openTasks: openRes.count ?? 0,
        inProgressTasks: progressRes.count ?? 0,
        reviewTasks: reviewRes.count ?? 0,
        doneTasks: doneRes.count ?? 0,
        unreadNotifications: notificationsRes.count ?? 0,
        pendingApprovals: approvalsRes.count ?? 0,
        todaySeconds,
        myProjects: myProjectsRes.count ?? 0,
        completedProjects: completedProjectsRes.count ?? 0,
      });

      setTasks((recentTasksRes.data ?? []) as DashboardTask[]);
      setAnnouncements((announcementsRes.data ?? []) as Announcement[]);
      setActiveTimer((activeTimerRes.data as ActiveTimer) ?? null);

      await Promise.all([loadWeather(), loadRoleNews()]);
    } catch (err: any) {
      console.error("DASHBOARD LOAD ERROR:", err);
      setError(err?.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [enabled, userId, organizationId, role, loadWeather, loadRoleNews]);

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

        const { data: existingTimer, error: existingTimerError } =
          await supabase
            .from("time_entries")
            .select("id")
            .eq("user_id", userId)
            .is("ended_at", null)
            .maybeSingle();

        if (existingTimerError) throw existingTimerError;

        if (existingTimer) {
          throw new Error("A timer is already running.");
        }

        if (isAtOrAfterZimbabweCutoff()) {
          throw new Error("Timers stop at 7:00 PM Harare time. Add manual time for today if needed.");
        }

        const { error } = await supabase.from("time_entries").insert({
          organization_id: organizationId,
          user_id: userId,
          task_id: taskId ?? null,
          description: description ?? null,
          started_at: new Date().toISOString(),
          ended_at: null,
          is_running: true,
          duration_seconds: 0,
        });

        if (error) throw error;

        await load();
      } finally {
        setBusy(false);
      }
    },
    [userId, organizationId, load],
  );

  const stopTimer = useCallback(async () => {
    if (!activeTimer?.id || !activeTimer?.started_at) return;

    try {
      setBusy(true);

      const endedAt = clampToZimbabweCutoff(activeTimer.started_at);
      const durationSeconds = diffInSeconds(activeTimer.started_at, endedAt);

      const { error } = await supabase
        .from("time_entries")
        .update({
          ended_at: endedAt,
          is_running: false,
          duration_seconds: durationSeconds,
        })
        .eq("id", activeTimer.id);

      if (error) throw error;

      await load();
    } finally {
      setBusy(false);
    }
  }, [activeTimer, load]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    loading,
    busy,
    error,
    stats,
    tasks,
    announcements,
    weather,
    roleNews,
    roleNewsTopic,
    activeTimer,
    reload: load,
    startTimer,
    stopTimer,
  };
}

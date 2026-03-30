import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase/client";

type DashboardStats = {
  openTasks: number;
  inProgressTasks: number;
  reviewTasks: number;
  doneTasks: number;
  unreadNotifications: number;
  pendingApprovals: number;
  todayMinutes: number;
  myProjects: number;
  completedProjects: number;
};

type DashboardTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
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

const startOfToday = () => {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
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
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [loading, setLoading] = useState(Boolean(enabled));
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
          .eq("assigned_to", userId)
          .in("status", ["todo", "backlog", "blocked"]),
        supabase
          .from("tasks")
          .select("id", { head: true, count: "exact" })
          .eq("assigned_to", userId)
          .eq("status", "in_progress"),
        supabase
          .from("tasks")
          .select("id", { head: true, count: "exact" })
          .eq("assigned_to", userId)
          .eq("status", "review"),
        supabase
          .from("tasks")
          .select("id", { head: true, count: "exact" })
          .eq("assigned_to", userId)
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
          .select("id,title,status,priority,due_date")
          .eq("assigned_to", userId)
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
          .select("started_at,ended_at")
          .eq("user_id", userId)
          .gte("started_at", startOfToday()),
        supabase
          .from("time_entries")
          .select("*")
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

      const todayMinutes = (timeEntriesRes.data ?? []).reduce((sum, item) => {
        if (item.ended_at) {
          return (
            sum +
            Math.max(
              0,
              Math.floor(
                (new Date(item.ended_at).getTime() -
                  new Date(item.started_at).getTime()) /
                  60000,
              ),
            )
          );
        }

        return (
          sum +
          Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(item.started_at).getTime()) / 60000,
            ),
          )
        );
      }, 0);

      setStats({
        openTasks: openRes.count ?? 0,
        inProgressTasks: progressRes.count ?? 0,
        reviewTasks: reviewRes.count ?? 0,
        doneTasks: doneRes.count ?? 0,
        unreadNotifications: notificationsRes.count ?? 0,
        pendingApprovals: approvalsRes.count ?? 0,
        todayMinutes,
        myProjects: myProjectsRes.count ?? 0,
        completedProjects: completedProjectsRes.count ?? 0,
      });

      setTasks((recentTasksRes.data ?? []) as DashboardTask[]);
      setAnnouncements((announcementsRes.data ?? []) as Announcement[]);
      setActiveTimer(activeTimerRes.data ?? null);

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

      const { error } = await supabase.from("time_entries").insert({
        organization_id: organizationId,
        user_id: userId,
        task_id: taskId ?? null,
        description: description ?? null,
        started_at: new Date().toISOString(),
      });

      if (error) throw error;
      await load();
    },
    [userId, organizationId, load],
  );

  const stopTimer = useCallback(async () => {
    if (!activeTimer?.id) return;

    const { error } = await supabase
      .from("time_entries")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", activeTimer.id);

    if (error) throw error;
    await load();
  }, [activeTimer, load]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    loading,
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

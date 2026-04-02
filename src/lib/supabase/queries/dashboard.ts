import { supabase } from "../client";

export interface DashboardStats {
  myOpenTasks: number;
  myInProgressTasks: number;
  myReviewTasks: number;
  myCompletedTasks: number;
  unreadNotifications: number;
  pendingApprovals: number;
  todaySeconds: number;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  target_roles: string[] | null;
  created_at: string;
}

export interface DashboardTaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  client_id: string | null;
  campaign_id: string | null;
  created_at: string;
}

const startOfTodayIso = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return start.toISOString();
};

const diffInSeconds = (start: string, end?: string | null) => {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;

  return Math.max(0, Math.floor((endMs - startMs) / 1000));
};

export const getDashboardStats = async (
  userId: string,
  _role: string,
  organizationId: string,
): Promise<DashboardStats> => {
  const [
    openTasksRes,
    inProgressRes,
    reviewRes,
    completedRes,
    notificationsRes,
    approvalsRes,
    timeEntriesRes,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", userId)
      .in("status", ["todo", "backlog", "blocked"]),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", userId)
      .eq("status", "in_progress"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", userId)
      .eq("status", "review"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", userId)
      .eq("status", "done"),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false),
    supabase
      .from("approvals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("assigned_approver", userId)
      .eq("approval_status", "pending"),
    supabase
      .from("time_entries")
      .select("duration_seconds, started_at, ended_at")
      .eq("user_id", userId)
      .gte("started_at", startOfTodayIso()),
  ]);

  if (openTasksRes.error) throw openTasksRes.error;
  if (inProgressRes.error) throw inProgressRes.error;
  if (reviewRes.error) throw reviewRes.error;
  if (completedRes.error) throw completedRes.error;
  if (notificationsRes.error) throw notificationsRes.error;
  if (approvalsRes.error) throw approvalsRes.error;
  if (timeEntriesRes.error) throw timeEntriesRes.error;

  const todaySeconds = (timeEntriesRes.data ?? []).reduce((sum, item) => {
    if (typeof item.duration_seconds === "number" && item.ended_at) {
      return sum + Math.max(0, item.duration_seconds);
    }

    if (item.started_at) {
      return sum + diffInSeconds(item.started_at, item.ended_at);
    }

    return sum;
  }, 0);

  return {
    myOpenTasks: openTasksRes.count ?? 0,
    myInProgressTasks: inProgressRes.count ?? 0,
    myReviewTasks: reviewRes.count ?? 0,
    myCompletedTasks: completedRes.count ?? 0,
    unreadNotifications: notificationsRes.count ?? 0,
    pendingApprovals: approvalsRes.count ?? 0,
    todaySeconds,
  };
};

export const getDashboardAnnouncements = async (
  organizationId: string,
  role: string,
): Promise<AnnouncementItem[]> => {
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, content, target_roles, created_at")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .or(`target_roles.is.null,target_roles.cs.{${role}}`)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw error;
  return data ?? [];
};

export const getMyRecentTasks = async (
  userId: string,
): Promise<DashboardTaskItem[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, status, priority, due_date, client_id, campaign_id, created_at",
    )
    .eq("assigned_to", userId)
    .order("updated_at", { ascending: false })
    .limit(8);

  if (error) throw error;
  return data ?? [];
};

export const getActiveTimeEntry = async (userId: string) => {
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};

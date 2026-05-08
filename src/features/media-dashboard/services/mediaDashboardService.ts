import { supabase } from "../../../lib/supabase/client";
import { getZimbabweDateKey, makeZimbabweLocalIso } from "../../../lib/utils/zimbabweCalendar";
import { canManageAllOffices } from "../../../lib/offices";

const MEDIA_ROLES = [
  "media_team",
  "social_media",
  "seo_specialist",
  "marketing",
  "admin",
  "manager",
] as const;

const GEAR_KEYWORDS = [
  "camera",
  "drone",
  "microphone",
  "mic",
  "light",
  "lens",
  "tripod",
  "gimbal",
  "audio",
  "video",
] as const;

export type MediaProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role: string | null;
  department: string | null;
  avatar_url?: string | null;
};

export type MediaTask = {
  id: string;
  organization_id: string;
  office_id?: string | null;
  client_id: string | null;
  campaign_id: string | null;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  tracked_seconds_cache?: number | null;
  created_at: string;
  updated_at: string;
  client_name: string | null;
  campaign_name: string | null;
  assignees: MediaProfile[];
};

export type MediaAsset = {
  id: string;
  file_name: string;
  file_url: string | null;
  mime_type: string | null;
  asset_type: string | null;
  asset_status: string | null;
  file_size: number | null;
  client_name: string | null;
  campaign_name: string | null;
  created_at: string;
};

export type MediaSocialPost = {
  id: string;
  title: string;
  platform: string;
  status: string;
  scheduled_for: string | null;
  client_name: string | null;
  campaign_name: string | null;
};

export type MediaGearStatus = {
  category: string;
  total: number;
  available: number;
  assigned: number;
  maintenance: number;
  damagedOrLost: number;
};

export type MediaWorkload = {
  profile: MediaProfile;
  openTasks: number;
  overdueTasks: number;
  trackedSecondsThisWeek: number;
};

export type MediaDashboardData = {
  kpis: {
    activeCampaigns: number;
    dueTodayTasks: number;
    overdueTasks: number;
    assetsUploadedThisMonth: number;
    pendingApprovals: number;
    scheduledSocialPosts: number;
    publishedSocialPosts: number;
    trackedSecondsThisWeek: number;
  };
  mediaProfiles: MediaProfile[];
  productionTasks: MediaTask[];
  pipelineTasks: MediaTask[];
  approvalQueue: MediaTask[];
  contentCalendar: Array<MediaTask | MediaSocialPost>;
  assets: MediaAsset[];
  socialPosts: MediaSocialPost[];
  workload: MediaWorkload[];
  gear: MediaGearStatus[];
  notifications: Array<{
    id: string;
    title: string;
    message: string | null;
    type: string;
    action_url: string | null;
    created_at: string;
  }>;
  sectionErrors: string[];
};

type ProfileContext = {
  id: string;
  organization_id?: string | null;
  office_id?: string | null;
  primary_role?: string | null;
  office?: { is_primary?: boolean | null } | null;
};

type TaskRow = {
  id: string;
  organization_id: string;
  office_id?: string | null;
  client_id: string | null;
  campaign_id: string | null;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  tracked_seconds_cache?: number | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
};

type ClientRow = { id: string; name: string; office_id?: string | null };
type CampaignRow = { id: string; name: string; status: string };

function startOfWeekIso() {
  const now = new Date();
  const day = now.getDay();
  const distance = (day + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - distance);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function startOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function currentMonthEndIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
}

function isOverdue(task: MediaTask) {
  if (!task.due_date || ["done", "completed", "cancelled"].includes(task.status)) return false;
  return new Date(task.due_date).getTime() < new Date(makeZimbabweLocalIso(getZimbabweDateKey(new Date()), "00:00:00")).getTime();
}

function isDueToday(task: MediaTask) {
  return Boolean(task.due_date && getZimbabweDateKey(task.due_date) === getZimbabweDateKey(new Date()));
}

function isMediaProfile(profile: MediaProfile) {
  const role = String(profile.primary_role ?? "").toLowerCase();
  const department = String(profile.department ?? "").toLowerCase();
  return MEDIA_ROLES.includes(role as (typeof MEDIA_ROLES)[number]) ||
    department.includes("media") ||
    department.includes("marketing") ||
    department.includes("creative");
}

function safeLower(value: string | null | undefined) {
  return String(value ?? "").toLowerCase();
}

function isGearAsset(asset: { asset_name?: string | null; category?: { name?: string | null } | null }) {
  const haystack = `${asset.asset_name ?? ""} ${asset.category?.name ?? ""}`.toLowerCase();
  return GEAR_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function initials(name: string | null, email: string | null) {
  const value = name || email || "";
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "??";
}

export { initials as getMediaInitials };

async function optionalQuery<T>(label: string, query: PromiseLike<{ data: unknown; error: unknown }>, errors: string[]): Promise<T[]> {
  const result = await query;
  if (result.error) {
    const message = result.error instanceof Error
      ? result.error.message
      : typeof result.error === "object" && result.error && "message" in result.error
        ? String((result.error as { message?: unknown }).message)
        : `${label} could not be loaded.`;
    errors.push(message);
    return [];
  }
  return (result.data ?? []) as T[];
}

export async function getMediaDashboardData(profile: ProfileContext): Promise<MediaDashboardData> {
  const organizationId = profile.organization_id;
  if (!organizationId) throw new Error("Missing organization context.");

  const sectionErrors: string[] = [];
  const includeAllOffices = canManageAllOffices(profile);
  const officeId = !includeAllOffices ? profile.office_id ?? null : null;

  const todayKey = getZimbabweDateKey(new Date());
  const weekStart = startOfWeekIso();
  const monthStart = startOfMonthIso();
  const monthEnd = currentMonthEndIso();

  const [profiles, clients, campaigns] = await Promise.all([
    optionalQuery<MediaProfile>(
      "profiles",
      supabase
        .from("profiles")
        .select("id, full_name, email, primary_role, department, avatar_url")
        .eq("organization_id", organizationId)
        .eq("account_status", "active"),
      sectionErrors,
    ),
    optionalQuery<ClientRow>(
      "clients",
      supabase
        .from("clients")
        .select("id, name, office_id")
        .eq("organization_id", organizationId),
      sectionErrors,
    ),
    optionalQuery<CampaignRow>(
      "campaigns",
      supabase
        .from("campaigns")
        .select("id, name, status")
        .eq("organization_id", organizationId),
      sectionErrors,
    ),
  ]);

  const mediaProfiles = profiles.filter(isMediaProfile);
  const mediaUserIds = new Set(mediaProfiles.map((item) => item.id));
  const profileMap = new Map(profiles.map((item) => [item.id, item]));
  const clientMap = new Map(clients.map((item) => [item.id, item]));
  const campaignMap = new Map(campaigns.map((item) => [item.id, item]));

  let taskQuery = supabase
    .from("tasks")
    .select("id, organization_id, office_id, client_id, campaign_id, title, status, priority, due_date, assigned_to, tracked_seconds_cache, archived_at, created_at, updated_at")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(250);

  if (officeId) taskQuery = taskQuery.eq("office_id", officeId);

  const taskRows = await optionalQuery<TaskRow>("tasks", taskQuery, sectionErrors);
  const taskIds = taskRows.map((task) => task.id);

  const assigneeRows = taskIds.length > 0
    ? await optionalQuery<{ task_id: string; user_id: string }>(
        "task assignees",
        supabase
          .from("task_assignees")
          .select("task_id, user_id")
          .in("task_id", taskIds),
        sectionErrors,
      )
    : [];

  const assigneesByTask = new Map<string, MediaProfile[]>();
  for (const row of assigneeRows) {
    const assignee = profileMap.get(row.user_id);
    if (!assignee) continue;
    const list = assigneesByTask.get(row.task_id) ?? [];
    list.push(assignee);
    assigneesByTask.set(row.task_id, list);
  }

  const mediaTasks = taskRows
    .filter((task) => {
      if (task.assigned_to && mediaUserIds.has(task.assigned_to)) return true;
      const assignees = assigneesByTask.get(task.id) ?? [];
      if (assignees.some((assignee) => mediaUserIds.has(assignee.id))) return true;
      const client = task.client_id ? clientMap.get(task.client_id) : null;
      if (officeId && client?.office_id && client.office_id !== officeId) return false;
      return safeLower(task.title).includes("media") ||
        safeLower(task.title).includes("shoot") ||
        safeLower(task.title).includes("video") ||
        safeLower(task.title).includes("photo") ||
        safeLower(task.title).includes("content");
    })
    .map((task): MediaTask => ({
      ...task,
      client_name: task.client_id ? clientMap.get(task.client_id)?.name ?? null : null,
      campaign_name: task.campaign_id ? campaignMap.get(task.campaign_id)?.name ?? null : null,
      assignees: assigneesByTask.get(task.id) ?? (task.assigned_to && profileMap.get(task.assigned_to) ? [profileMap.get(task.assigned_to)!] : []),
    }));

  const [contentAssets, socialPosts, assetRows, timeRows, notifications] = await Promise.all([
    optionalQuery<{
      id: string;
      client_id: string | null;
      campaign_id: string | null;
      file_name: string;
      file_url: string | null;
      mime_type: string | null;
      asset_type: string | null;
      asset_status: string | null;
      file_size: number | null;
      created_at: string;
    }>(
      "content assets",
      supabase
        .from("content_assets")
        .select("id, client_id, campaign_id, file_name, file_url, mime_type, asset_type, asset_status, file_size, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(24),
      sectionErrors,
    ),
    optionalQuery<{
      id: string;
      client_id: string | null;
      campaign_id: string | null;
      title: string;
      platform: string;
      status: string;
      scheduled_for: string | null;
    }>(
      "social posts",
      supabase
        .from("social_posts")
        .select("id, client_id, campaign_id, title, platform, status, scheduled_for")
        .eq("organization_id", organizationId)
        .order("scheduled_for", { ascending: true, nullsFirst: false })
        .limit(80),
      sectionErrors,
    ),
    optionalQuery<{
      id: string;
      asset_name: string | null;
      status: string | null;
      condition: string | null;
      category: { name: string | null } | null;
    }>(
      "equipment",
      supabase
        .from("assets")
        .select("id, asset_name, status, condition, category:asset_categories(name)")
        .eq("organization_id", organizationId)
        .limit(300),
      sectionErrors,
    ),
    optionalQuery<{ user_id: string; duration_seconds: number | null; started_at: string }>(
      "time entries",
      supabase
        .from("time_entries")
        .select("user_id, duration_seconds, started_at")
        .eq("organization_id", organizationId)
        .gte("started_at", weekStart)
        .in("user_id", mediaProfiles.map((item) => item.id).length ? mediaProfiles.map((item) => item.id) : ["00000000-0000-0000-0000-000000000000"]),
      sectionErrors,
    ),
    optionalQuery<{
      id: string;
      title: string;
      message: string | null;
      type: string;
      action_url: string | null;
      created_at: string;
    }>(
      "notifications",
      supabase
        .from("notifications")
        .select("id, title, message, type, action_url, created_at")
        .eq("organization_id", organizationId)
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(12),
      sectionErrors,
    ),
  ]);

  const assets = contentAssets.map((asset): MediaAsset => ({
    ...asset,
    client_name: asset.client_id ? clientMap.get(asset.client_id)?.name ?? null : null,
    campaign_name: asset.campaign_id ? campaignMap.get(asset.campaign_id)?.name ?? null : null,
  }));

  const social = socialPosts.map((post): MediaSocialPost => ({
    ...post,
    client_name: post.client_id ? clientMap.get(post.client_id)?.name ?? null : null,
    campaign_name: post.campaign_id ? campaignMap.get(post.campaign_id)?.name ?? null : null,
  }));

  const trackedByUser = new Map<string, number>();
  for (const entry of timeRows) {
    trackedByUser.set(entry.user_id, (trackedByUser.get(entry.user_id) ?? 0) + Math.max(0, Number(entry.duration_seconds ?? 0)));
  }

  const workload = mediaProfiles.map((member) => {
    const assigned = mediaTasks.filter((task) =>
      task.assigned_to === member.id || task.assignees.some((assignee) => assignee.id === member.id)
    );
    return {
      profile: member,
      openTasks: assigned.filter((task) => !["done", "completed", "cancelled"].includes(task.status)).length,
      overdueTasks: assigned.filter(isOverdue).length,
      trackedSecondsThisWeek: trackedByUser.get(member.id) ?? 0,
    };
  });

  const gearMap = new Map<string, MediaGearStatus>();
  for (const asset of assetRows.filter(isGearAsset)) {
    const category = asset.category?.name ?? "Media gear";
    const current = gearMap.get(category) ?? {
      category,
      total: 0,
      available: 0,
      assigned: 0,
      maintenance: 0,
      damagedOrLost: 0,
    };
    const status = safeLower(asset.status);
    const condition = safeLower(asset.condition);
    current.total += 1;
    if (status.includes("available")) current.available += 1;
    if (status.includes("assigned") || status.includes("checked")) current.assigned += 1;
    if (status.includes("maintenance") || condition.includes("maintenance")) current.maintenance += 1;
    if (status.includes("lost") || status.includes("damaged") || condition.includes("lost") || condition.includes("damaged")) current.damagedOrLost += 1;
    gearMap.set(category, current);
  }

  const calendarTasks = mediaTasks.filter((task) => Boolean(task.due_date));
  const calendarSocial = social.filter((post) => Boolean(post.scheduled_for));
  const approvalQueue = mediaTasks.filter((task) =>
    ["review", "approval", "approved"].includes(task.status)
  );

  return {
    kpis: {
      activeCampaigns: campaigns.filter((campaign) => ["planned", "in_progress", "review"].includes(campaign.status)).length,
      dueTodayTasks: mediaTasks.filter(isDueToday).length,
      overdueTasks: mediaTasks.filter(isOverdue).length,
      assetsUploadedThisMonth: assets.filter((asset) => asset.created_at >= monthStart && asset.created_at < monthEnd).length,
      pendingApprovals: approvalQueue.filter((task) => task.status !== "approved").length,
      scheduledSocialPosts: social.filter((post) => post.status === "scheduled").length,
      publishedSocialPosts: social.filter((post) => post.status === "published").length,
      trackedSecondsThisWeek: timeRows.reduce((sum, entry) => sum + Math.max(0, Number(entry.duration_seconds ?? 0)), 0),
    },
    mediaProfiles,
    productionTasks: mediaTasks
      .filter((task) => isDueToday(task) || ["todo", "in_progress", "review"].includes(task.status))
      .slice(0, 12),
    pipelineTasks: mediaTasks,
    approvalQueue,
    contentCalendar: [...calendarTasks, ...calendarSocial]
      .sort((a, b) => {
        const left = "due_date" in a ? a.due_date : a.scheduled_for;
        const right = "due_date" in b ? b.due_date : b.scheduled_for;
        return new Date(left ?? 0).getTime() - new Date(right ?? 0).getTime();
      })
      .slice(0, 30),
    assets,
    socialPosts: social,
    workload,
    gear: [...gearMap.values()].sort((a, b) => b.total - a.total),
    notifications,
    sectionErrors,
  };
}

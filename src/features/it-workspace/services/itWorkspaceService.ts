import { supabase } from "../../../lib/supabase/client";

export type MemberRole = "owner" | "manager" | "member" | "viewer";

export type ITDashboardStats = {
  activeProjects: number;
  openIssues: number;
  automationCount: number;
  pendingInvites: number;
  systemHealthLabel: string;
};

export type ITProjectDashboardItem = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  membersCount: number;
  openTasksCount: number;
  blockedTasksCount: number;
  openIssuesCount: number;
  failedRuns24h: number;
  healthScore: number;
  healthStatus: "healthy" | "warning" | "critical";
  riskLevel: "low" | "medium" | "high";
};

export type ITRecentActivityItem = {
  id: string;
  action: string;
  created_at: string;
  full_name: string | null;
  email: string | null;
  details: Record<string, any> | null;
};

export type ProjectActivityItem = {
  id: string;
  action: string;
  created_at: string;
  full_name: string | null;
  email: string | null;
  details: Record<string, any> | null;
};

export type ProjectMemberItem = {
  id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string | null;
  full_name: string | null;
  email: string | null;
  primary_role: string | null;
};

export type WorkflowStatusSummary = {
  latestStatus: string | null;
  latestRunAt: string | null;
  latestMessage: string | null;
  totalRuns: number;
  successCount: number;
  failedCount: number;
};

export type SystemHealthSummary = {
  databaseStatus: "healthy" | "degraded" | "down";
  databaseLatencyMs: number | null;
  workspaceStatus: "healthy" | "degraded" | "down";
  workspaceLatencyMs: number | null;
  automationStatus: "healthy" | "degraded" | "down";
  automationLatencyMs: number | null;
  projectCount: number;
  memberCount: number;
  recentFailedRuns: number;
};

export type CreateProjectInput = {
  organizationId: string;
  createdBy: string;
  name: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
};

export type InviteProjectMemberInput = {
  organizationId: string;
  projectId: string;
  invitedBy: string;
  email: string;
  role: MemberRole;
};

function clamp(num: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, num));
}

function asHealthyStatus(ok: boolean): "healthy" | "degraded" | "down" {
  return ok ? "healthy" : "down";
}

function computeLatencyMs(start: number) {
  return Date.now() - start;
}

function computeHealth(args: {
  openTasks: number;
  blockedTasks: number;
  openIssues: number;
  failedRuns24h: number;
  dueDate: string | null;
}) {
  const overdue =
    !!args.dueDate && new Date(args.dueDate).getTime() < new Date().getTime();

  let score = 100;
  score -= args.blockedTasks * 12;
  score -= args.openIssues * 8;
  score -= args.failedRuns24h * 10;
  score -= Math.max(0, args.openTasks - 5) * 2;
  if (overdue) score -= 18;

  score = clamp(score);

  let healthStatus: "healthy" | "warning" | "critical" = "healthy";
  let riskLevel: "low" | "medium" | "high" = "low";

  if (score < 80) {
    healthStatus = "warning";
    riskLevel = "medium";
  }

  if (score < 55) {
    healthStatus = "critical";
    riskLevel = "high";
  }

  return { score, healthStatus, riskLevel };
}

async function getProfilesByIds(userIds: string[]) {
  if (userIds.length === 0) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, primary_role")
    .in("id", userIds);

  if (error) throw error;
  return data ?? [];
}

export async function getITDashboardStats(organizationId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [projectsRes, issuesRes, automationRes, invitesRes, failedRunsRes] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId)
        .neq("status", "archived"),

      supabase
        .from("issues")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId)
        .in("status", ["open", "in_progress"]),

      supabase
        .from("automation_runs")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId)
        .gte("created_at", since),

      supabase
        .from("project_invitations")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId)
        .eq("status", "pending"),

      supabase
        .from("automation_runs")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId)
        .gte("created_at", since)
        .neq("status", "success"),
    ]);

  const errors = [
    projectsRes.error,
    issuesRes.error,
    automationRes.error,
    invitesRes.error,
    failedRunsRes.error,
  ].filter(Boolean);

  if (errors.length > 0) throw errors[0];

  const failedRuns = failedRunsRes.count ?? 0;
  const systemHealthLabel =
    failedRuns === 0 ? "Healthy" : failedRuns < 3 ? "Warning" : "Critical";

  const stats: ITDashboardStats = {
    activeProjects: projectsRes.count ?? 0,
    openIssues: issuesRes.count ?? 0,
    automationCount: automationRes.count ?? 0,
    pendingInvites: invitesRes.count ?? 0,
    systemHealthLabel,
  };

  return stats;
}

export async function getITProjectsForDashboard(
  organizationId: string,
  userId: string,
) {
  const { data: membershipRows, error: membershipError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId);

  if (membershipError) throw membershipError;

  const projectIds = [
    ...new Set((membershipRows ?? []).map((row) => row.project_id)),
  ];

  if (projectIds.length === 0) {
    return [] as ITProjectDashboardItem[];
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [projectsRes, allMembersRes, tasksRes, issuesRes, failedRunsRes] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, name, description, status, priority, due_date")
        .eq("organization_id", organizationId)
        .in("id", projectIds)
        .order("created_at", { ascending: false }),

      supabase
        .from("project_members")
        .select("project_id")
        .in("project_id", projectIds),

      supabase
        .from("tasks")
        .select("id, project_id, status")
        .in("project_id", projectIds),

      supabase
        .from("issues")
        .select("id, project_id, status")
        .eq("organization_id", organizationId)
        .in("project_id", projectIds)
        .in("status", ["open", "in_progress"]),

      supabase
        .from("automation_runs")
        .select("id, project_id, status, created_at")
        .eq("organization_id", organizationId)
        .in("project_id", projectIds)
        .gte("created_at", since)
        .neq("status", "success"),
    ]);

  const errors = [
    projectsRes.error,
    allMembersRes.error,
    tasksRes.error,
    issuesRes.error,
    failedRunsRes.error,
  ].filter(Boolean);

  if (errors.length > 0) throw errors[0];

  const memberCounts = new Map<string, number>();
  (allMembersRes.data ?? []).forEach((row) => {
    memberCounts.set(
      row.project_id,
      (memberCounts.get(row.project_id) ?? 0) + 1,
    );
  });

  const openTaskCounts = new Map<string, number>();
  const blockedTaskCounts = new Map<string, number>();
  (tasksRes.data ?? []).forEach((row) => {
    if (!row.project_id) return;

    if (
      ["todo", "backlog", "in_progress", "review", "blocked"].includes(
        row.status,
      )
    ) {
      openTaskCounts.set(
        row.project_id,
        (openTaskCounts.get(row.project_id) ?? 0) + 1,
      );
    }

    if (row.status === "blocked") {
      blockedTaskCounts.set(
        row.project_id,
        (blockedTaskCounts.get(row.project_id) ?? 0) + 1,
      );
    }
  });

  const issueCounts = new Map<string, number>();
  (issuesRes.data ?? []).forEach((row) => {
    if (!row.project_id) return;
    issueCounts.set(row.project_id, (issueCounts.get(row.project_id) ?? 0) + 1);
  });

  const failedRunCounts = new Map<string, number>();
  (failedRunsRes.data ?? []).forEach((row) => {
    if (!row.project_id) return;
    failedRunCounts.set(
      row.project_id,
      (failedRunCounts.get(row.project_id) ?? 0) + 1,
    );
  });

  const items: ITProjectDashboardItem[] = (projectsRes.data ?? []).map(
    (project) => {
      const openTasks = openTaskCounts.get(project.id) ?? 0;
      const blockedTasks = blockedTaskCounts.get(project.id) ?? 0;
      const openIssues = issueCounts.get(project.id) ?? 0;
      const failedRuns24h = failedRunCounts.get(project.id) ?? 0;

      const computed = computeHealth({
        openTasks,
        blockedTasks,
        openIssues,
        failedRuns24h,
        dueDate: project.due_date,
      });

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        priority: project.priority,
        due_date: project.due_date,
        membersCount: memberCounts.get(project.id) ?? 0,
        openTasksCount: openTasks,
        blockedTasksCount: blockedTasks,
        openIssuesCount: openIssues,
        failedRuns24h,
        healthScore: computed.score,
        healthStatus: computed.healthStatus,
        riskLevel: computed.riskLevel,
      };
    },
  );

  return items;
}

export async function getRecentITActivity(organizationId: string, limit = 8) {
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id")
    .eq("organization_id", organizationId);

  if (projectsError) throw projectsError;

  const projectIds = (projects ?? []).map((row) => row.id);

  if (projectIds.length === 0) return [] as ITRecentActivityItem[];

  const { data: activityRows, error: activityError } = await supabase
    .from("project_activity")
    .select("id, user_id, action, details, created_at")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (activityError) throw activityError;

  const userIds = [
    ...new Set(
      (activityRows ?? [])
        .map((item) => item.user_id)
        .filter(Boolean) as string[],
    ),
  ];

  const profiles = await getProfilesByIds(userIds);
  const profileMap = new Map(profiles.map((item) => [item.id, item]));

  const items: ITRecentActivityItem[] = (activityRows ?? []).map((item) => {
    const actor = item.user_id ? profileMap.get(item.user_id) : null;

    return {
      id: item.id,
      action: item.action,
      created_at: item.created_at,
      full_name: actor?.full_name ?? null,
      email: actor?.email ?? null,
      details: (item.details as Record<string, any> | null) ?? null,
    };
  });

  return items;
}

export async function getProjectActivity(
  projectId: string,
  limit = 10,
): Promise<ProjectActivityItem[]> {
  const { data: activityRows, error } = await supabase
    .from("project_activity")
    .select("id, user_id, action, details, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const userIds = [
    ...new Set(
      (activityRows ?? [])
        .map((item) => item.user_id)
        .filter(Boolean) as string[],
    ),
  ];

  const profiles = await getProfilesByIds(userIds);
  const profileMap = new Map(profiles.map((item) => [item.id, item]));

  return (activityRows ?? []).map((item) => {
    const actor = item.user_id ? profileMap.get(item.user_id) : null;

    return {
      id: item.id,
      action: item.action,
      created_at: item.created_at,
      full_name: actor?.full_name ?? null,
      email: actor?.email ?? null,
      details: (item.details as Record<string, any> | null) ?? null,
    };
  });
}

export async function getProjectMembers(
  projectId: string,
): Promise<ProjectMemberItem[]> {
  const { data: memberRows, error } = await supabase
    .from("project_members")
    .select("id, user_id, role, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const userIds = [
    ...new Set((memberRows ?? []).map((row) => row.user_id).filter(Boolean)),
  ] as string[];

  const profiles = await getProfilesByIds(userIds);
  const profileMap = new Map(profiles.map((item) => [item.id, item]));

  return (memberRows ?? []).map((row) => {
    const profile = profileMap.get(row.user_id);

    return {
      id: row.id,
      user_id: row.user_id,
      role: row.role as MemberRole,
      joined_at: row.created_at ?? null,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      primary_role: profile?.primary_role ?? null,
    };
  });
}

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  role: MemberRole,
) {
  const { error } = await supabase
    .from("project_members")
    .update({ role })
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (error) throw error;
  return true;
}

export async function removeProjectMember(projectId: string, userId: string) {
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (error) throw error;
  return true;
}

export async function getWorkflowStatusSummary(args: {
  organizationId: string;
  workflowName: string;
  projectId?: string | null;
}): Promise<WorkflowStatusSummary> {
  const { organizationId, workflowName, projectId = null } = args;

  let query = supabase
    .from("automation_runs")
    .select("id, status, message, created_at, workflow_name")
    .eq("organization_id", organizationId)
    .eq("workflow_name", workflowName)
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query.limit(100);

  if (error) throw error;

  const rows = data ?? [];
  const latest = rows[0] ?? null;

  return {
    latestStatus: latest?.status ?? null,
    latestRunAt: latest?.created_at ?? null,
    latestMessage: latest?.message ?? null,
    totalRuns: rows.length,
    successCount: rows.filter((row) => row.status === "success").length,
    failedCount: rows.filter((row) => row.status !== "success").length,
  };
}

export async function getSystemHealthSummary(
  organizationId: string,
): Promise<SystemHealthSummary> {
  const dbStart = Date.now();
  const dbRes = await supabase.from("profiles").select("id").limit(1);
  const databaseLatencyMs = computeLatencyMs(dbStart);

  const workspaceStart = Date.now();
  const workspaceRes = await supabase
    .from("projects")
    .select("id", { head: true, count: "exact" })
    .eq("organization_id", organizationId);
  const workspaceLatencyMs = computeLatencyMs(workspaceStart);

  const automationStart = Date.now();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const automationRes = await supabase
    .from("automation_runs")
    .select("id, status", { count: "exact" })
    .eq("organization_id", organizationId)
    .gte("created_at", since)
    .limit(50);
  const automationLatencyMs = computeLatencyMs(automationStart);

  if (dbRes.error) throw dbRes.error;
  if (workspaceRes.error) throw workspaceRes.error;
  if (automationRes.error) throw automationRes.error;

  const membersRes = await supabase
    .from("profiles")
    .select("id", { head: true, count: "exact" })
    .eq("organization_id", organizationId);

  if (membersRes.error) throw membersRes.error;

  const recentFailedRuns = (automationRes.data ?? []).filter(
    (row) => row.status !== "success",
  ).length;

  return {
    databaseStatus: asHealthyStatus(!dbRes.error),
    databaseLatencyMs,
    workspaceStatus: asHealthyStatus(!workspaceRes.error),
    workspaceLatencyMs,
    automationStatus:
      recentFailedRuns >= 5
        ? "degraded"
        : asHealthyStatus(!automationRes.error),
    automationLatencyMs,
    projectCount: workspaceRes.count ?? 0,
    memberCount: membersRes.count ?? 0,
    recentFailedRuns,
  };
}

export async function createITProject(input: CreateProjectInput) {
  const {
    organizationId,
    createdBy,
    name,
    description = "",
    status = "active",
    priority = "medium",
    dueDate = null,
  } = input;

  const { data: createdProject, error: createError } = await supabase
    .from("projects")
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      name,
      description,
      status,
      priority,
      due_date: dueDate,
    })
    .select("id, name, description, status, priority, due_date")
    .single();

  if (createError) throw createError;

  const { error: memberError } = await supabase.from("project_members").insert({
    project_id: createdProject.id,
    user_id: createdBy,
    role: "owner",
    invited_by: createdBy,
  });

  if (memberError) throw memberError;

  await supabase.from("project_activity").insert({
    project_id: createdProject.id,
    user_id: createdBy,
    action: "Project created",
    details: {
      project_name: createdProject.name,
      status: createdProject.status,
      priority: createdProject.priority,
    },
  });

  return createdProject;
}

export async function inviteProjectMember(input: InviteProjectMemberInput) {
  const { organizationId, projectId, invitedBy, email, role } = input;

  const normalizedEmail = email.trim().toLowerCase();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, organization_id")
    .eq("email", normalizedEmail)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (profileError) throw profileError;

  const invitationToken =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const { error: invitationError } = await supabase
    .from("project_invitations")
    .insert({
      project_id: projectId,
      organization_id: organizationId,
      email: normalizedEmail,
      role,
      invited_by: invitedBy,
      status: "pending",
      token: invitationToken,
    });

  if (invitationError) throw invitationError;

  if (profile?.id) {
    const { error: memberError } = await supabase
      .from("project_members")
      .upsert(
        {
          project_id: projectId,
          user_id: profile.id,
          role,
          invited_by: invitedBy,
        },
        {
          onConflict: "project_id,user_id",
        },
      );

    if (memberError) throw memberError;
  }

  await supabase.from("project_activity").insert({
    project_id: projectId,
    user_id: invitedBy,
    action: "Project member invited",
    details: {
      email: normalizedEmail,
      role,
    },
  });

  return true;
}

import { supabase } from "../../../lib/supabase/client";

export type AlertSeverity = "warning" | "critical";
export type EventSeverity = "info" | "warning" | "critical";

export type WarRoomAlert = {
  id: string;
  module: string;
  severity: AlertSeverity;
  status: string;
  title: string;
  message: string | null;
  source: string | null;
  created_at: string;
  metadata: Record<string, any>;
};

export type WarRoomEvent = {
  id: string;
  module: string;
  event_type: string;
  severity: EventSeverity;
  title: string;
  description: string | null;
  created_at: string;
  metadata: Record<string, any>;
};

export type ModuleHealthItem = {
  module: string;
  status: "healthy" | "warning" | "critical";
  score: number;
  openAlerts: number;
  criticalAlerts: number;
  recentFailures: number;
  latestEventAt: string | null;
  reason: string;
};

export type PredictedFault = {
  module: string;
  confidence: number;
  reason: string;
  symptoms: string[];
};

export type WarRoomSummary = {
  overallStatus: "healthy" | "warning" | "critical";
  openAlerts: number;
  criticalAlerts: number;
  failedAutomations24h: number;
  failedLogins24h: number;
  passwordResetFailures24h: number;
  failedInvites24h: number;
  mostLikelyBrokenModule: PredictedFault | null;
};

function clamp(num: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, num));
}

function statusFromScore(score: number): "healthy" | "warning" | "critical" {
  if (score < 55) return "critical";
  if (score < 80) return "warning";
  return "healthy";
}

function sinceIso(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export async function getCriticalAlerts(
  organizationId: string,
  limit = 10,
): Promise<WarRoomAlert[]> {
  const { data, error } = await supabase
    .from("system_alerts")
    .select("id, module, severity, status, title, message, source, created_at, metadata")
    .eq("organization_id", organizationId)
    .in("status", ["open", "acknowledged"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    metadata: (row.metadata as Record<string, any> | null) ?? {},
  }));
}

export async function getOperationalFeed(
  organizationId: string,
  limit = 25,
): Promise<WarRoomEvent[]> {
  const { data, error } = await supabase
    .from("system_events")
    .select("id, module, event_type, severity, title, description, created_at, metadata")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    metadata: (row.metadata as Record<string, any> | null) ?? {},
  }));
}

export async function getModuleHealth(
  organizationId: string,
): Promise<ModuleHealthItem[]> {
  const since24h = sinceIso(24);

  const [alertsRes, eventsRes, automationRes, authRes, resetRes, inviteRes] =
    await Promise.all([
      supabase
        .from("system_alerts")
        .select("module, severity, status, created_at")
        .eq("organization_id", organizationId)
        .in("status", ["open", "acknowledged"]),

      supabase
        .from("system_events")
        .select("module, severity, created_at")
        .eq("organization_id", organizationId)
        .gte("created_at", since24h),

      supabase
        .from("automation_runs")
        .select("status, created_at")
        .eq("organization_id", organizationId)
        .gte("created_at", since24h),

      supabase
        .from("auth_events")
        .select("event_type, status, created_at")
        .eq("organization_id", organizationId)
        .gte("created_at", since24h),

      supabase
        .from("password_reset_events")
        .select("status, created_at")
        .eq("organization_id", organizationId)
        .gte("created_at", since24h),

      supabase
        .from("user_invitation_events")
        .select("status, created_at")
        .eq("organization_id", organizationId)
        .gte("created_at", since24h),
    ]);

  const errors = [
    alertsRes.error,
    eventsRes.error,
    automationRes.error,
    authRes.error,
    resetRes.error,
    inviteRes.error,
  ].filter(Boolean);

  if (errors.length) throw errors[0];

  const modules = [
    "database",
    "auth",
    "invitations",
    "password_resets",
    "automations",
    "projects",
    "issues",
    "notifications",
    "meetings",
    "chat",
    "storage",
    "stock",
  ];

  const alertRows = alertsRes.data ?? [];
  const eventRows = eventsRes.data ?? [];

  const moduleItems: ModuleHealthItem[] = modules.map((module) => {
    const moduleAlerts = alertRows.filter((a) => a.module === module);
    const moduleEvents = eventRows.filter((e) => e.module === module);

    let recentFailures = 0;

    if (module === "automations") {
      recentFailures = (automationRes.data ?? []).filter((r) => r.status !== "success").length;
    } else if (module === "auth") {
      recentFailures = (authRes.data ?? []).filter((r) => r.status === "failed").length;
    } else if (module === "password_resets") {
      recentFailures = (resetRes.data ?? []).filter((r) => r.status === "failed").length;
    } else if (module === "invitations") {
      recentFailures = (inviteRes.data ?? []).filter((r) => r.status === "failed").length;
    } else {
      recentFailures = moduleEvents.filter(
        (e) => e.severity === "warning" || e.severity === "critical",
      ).length;
    }

    const openAlerts = moduleAlerts.length;
    const criticalAlerts = moduleAlerts.filter((a) => a.severity === "critical").length;

    let score = 100;
    score -= openAlerts * 12;
    score -= criticalAlerts * 18;
    score -= recentFailures * 8;
    score = clamp(score);

    const latestEventAt =
      moduleEvents.length > 0
        ? moduleEvents
            .map((e) => e.created_at)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
        : null;

    const status = statusFromScore(score);

    let reason = "No major issues detected.";
    if (criticalAlerts > 0) reason = `${criticalAlerts} critical alert(s) open.`;
    else if (recentFailures > 0) reason = `${recentFailures} recent failure event(s) detected.`;
    else if (openAlerts > 0) reason = `${openAlerts} open alert(s) need review.`;

    return {
      module,
      status,
      score,
      openAlerts,
      criticalAlerts,
      recentFailures,
      latestEventAt,
      reason,
    };
  });

  return moduleItems.sort((a, b) => a.score - b.score);
}

export async function predictLikelyFault(
  organizationId: string,
): Promise<PredictedFault | null> {
  const moduleHealth = await getModuleHealth(organizationId);
  if (moduleHealth.length === 0) return null;

  const worst = moduleHealth[0];
  if (worst.status === "healthy") return null;

  const symptoms: string[] = [];
  if (worst.criticalAlerts > 0) symptoms.push(`${worst.criticalAlerts} critical alert(s)`);
  if (worst.openAlerts > 0) symptoms.push(`${worst.openAlerts} open alert(s)`);
  if (worst.recentFailures > 0) symptoms.push(`${worst.recentFailures} recent failure(s)`);
  if (worst.latestEventAt) symptoms.push(`latest event at ${worst.latestEventAt}`);

  const confidence = clamp(
    45 + worst.criticalAlerts * 15 + worst.openAlerts * 8 + worst.recentFailures * 5,
    0,
    98,
  );

  return {
    module: worst.module,
    confidence,
    reason: worst.reason,
    symptoms,
  };
}

export async function getWarRoomSummary(
  organizationId: string,
): Promise<WarRoomSummary> {
  const since24h = sinceIso(24);

  const [
    alertsRes,
    automationRes,
    authRes,
    resetRes,
    inviteRes,
    predictedFault,
  ] = await Promise.all([
    supabase
      .from("system_alerts")
      .select("severity, status")
      .eq("organization_id", organizationId)
      .in("status", ["open", "acknowledged"]),

    supabase
      .from("automation_runs")
      .select("id", { head: true, count: "exact" })
      .eq("organization_id", organizationId)
      .gte("created_at", since24h)
      .neq("status", "success"),

    supabase
      .from("auth_events")
      .select("id", { head: true, count: "exact" })
      .eq("organization_id", organizationId)
      .gte("created_at", since24h)
      .eq("status", "failed"),

    supabase
      .from("password_reset_events")
      .select("id", { head: true, count: "exact" })
      .eq("organization_id", organizationId)
      .gte("created_at", since24h)
      .eq("status", "failed"),

    supabase
      .from("user_invitation_events")
      .select("id", { head: true, count: "exact" })
      .eq("organization_id", organizationId)
      .gte("created_at", since24h)
      .eq("status", "failed"),

    predictLikelyFault(organizationId),
  ]);

  const errors = [
    alertsRes.error,
    automationRes.error,
    authRes.error,
    resetRes.error,
    inviteRes.error,
  ].filter(Boolean);

  if (errors.length) throw errors[0];

  const alertRows = alertsRes.data ?? [];
  const openAlerts = alertRows.length;
  const criticalAlerts = alertRows.filter((a) => a.severity === "critical").length;

  let overallStatus: "healthy" | "warning" | "critical" = "healthy";
  if (criticalAlerts > 0) overallStatus = "critical";
  else if (openAlerts > 0) overallStatus = "warning";

  return {
    overallStatus,
    openAlerts,
    criticalAlerts,
    failedAutomations24h: automationRes.count ?? 0,
    failedLogins24h: authRes.count ?? 0,
    passwordResetFailures24h: resetRes.count ?? 0,
    failedInvites24h: inviteRes.count ?? 0,
    mostLikelyBrokenModule: predictedFault,
  };
}

export async function acknowledgeAlert(alertId: string, userId: string) {
  const { error } = await supabase
    .from("system_alerts")
    .update({
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId,
    })
    .eq("id", alertId);

  if (error) throw error;
}

export async function resolveAlert(alertId: string, userId: string) {
  const { error } = await supabase
    .from("system_alerts")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    })
    .eq("id", alertId);

  if (error) throw error;
}
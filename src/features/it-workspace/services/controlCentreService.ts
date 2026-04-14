import { supabase } from "../../../lib/supabase/client";

// ── Types ──────────────────────────────────────────────────

export type ModuleSignal = "green" | "amber" | "red" | "grey";

export type ModuleHealthItem = {
    module: string;
    signal: ModuleSignal;
    label: string;
    detail: string;
    route: string;
};

export type TeamPulseMember = {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    primary_role: string | null;
    is_tracking: boolean;
    last_seen_at: string | null;
    status: "online" | "tracking" | "idle" | "offline";
};

export type EscalationItem = {
    id: string;
    type:
        | "failed_automation"
        | "blocked_task"
        | "stale_approval"
        | "overdue_project"
        | "critical_notification"
        | "low_stock"
        | "urgent_support_ticket";
    severity: "critical" | "warning" | "info";
    title: string;
    detail: string;
    entity_id: string | null;
    route: string;
    created_at: string;
};

export type KPITile = {
    label: string;
    value: string;
    trend?: "up" | "down" | "flat";
    detail?: string;
};

// ── Cross-Module Health Grid ───────────────────────────────

export async function getCrossModuleHealth(
    organizationId: string,
): Promise<ModuleHealthItem[]> {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        .toISOString();
    const since48h = new Date(now.getTime() - 48 * 60 * 60 * 1000)
        .toISOString();
    const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
    ).toISOString();

    const [
        tasksRes,
        blockedRes,
        overdueRes,
        failedRunsRes,
        totalRunsRes,
        timeRes,
        membersRes,
        pendingApprovalsRes,
        staleApprovalsRes,
        leaveRes,
        stockRes,
        clientsRes,
    ] = await Promise.all([
        // Tasks: total open
        supabase
            .from("tasks")
            .select("id", { head: true, count: "exact" })
            .eq("organization_id", organizationId)
            .in("status", ["todo", "backlog", "in_progress", "review"]),

        // Tasks: blocked
        supabase
            .from("tasks")
            .select("id", { head: true, count: "exact" })
            .eq("organization_id", organizationId)
            .eq("status", "blocked"),

        // Tasks: overdue
        supabase
            .from("tasks")
            .select("id", { head: true, count: "exact" })
            .eq("organization_id", organizationId)
            .in("status", [
                "todo",
                "backlog",
                "in_progress",
                "review",
                "blocked",
            ])
            .lt("due_date", now.toISOString()),

        // Automations: failed in 24h
        supabase
            .from("automation_runs")
            .select("id", { head: true, count: "exact" })
            .eq("organization_id", organizationId)
            .gte("created_at", since24h)
            .neq("status", "success"),

        // Automations: total in 24h
        supabase
            .from("automation_runs")
            .select("id", { head: true, count: "exact" })
            .eq("organization_id", organizationId)
            .gte("created_at", since24h),

        // Time: entries today
        supabase
            .from("time_entries")
            .select("id, user_id", { count: "exact" })
            .eq("organization_id", organizationId)
            .gte("started_at", todayStart),

        // Members: total active
        supabase
            .from("profiles")
            .select("id", { head: true, count: "exact" })
            .eq("organization_id", organizationId)
            .eq("is_active", true),

        // Approvals: pending
        supabase
            .from("approvals")
            .select("id", { head: true, count: "exact" })
            .eq("organization_id", organizationId)
            .eq("status", "pending"),

        // Approvals: stale (>48h)
        supabase
            .from("approvals")
            .select("id", { head: true, count: "exact" })
            .eq("organization_id", organizationId)
            .eq("status", "pending")
            .lt("created_at", since48h),

        // Leave: pending
        supabase
            .from("leave_requests")
            .select("id", { head: true, count: "exact" })
            .eq("organization_id", organizationId)
            .eq("status", "pending"),

        // Stock: low items
        supabase
            .from("stock_items")
            .select("id, quantity, min_quantity")
            .eq("organization_id", organizationId),

        // Clients: paused
        supabase
            .from("clients")
            .select("id", { head: true, count: "exact" })
            .eq("organization_id", organizationId)
            .eq("status", "paused"),
    ]);

    const modules: ModuleHealthItem[] = [];

    // Tasks
    const openTasks = tasksRes.count ?? 0;
    const blocked = blockedRes.count ?? 0;
    const overdue = overdueRes.count ?? 0;
    const taskSignal: ModuleSignal = blocked > 0 || overdue > 3
        ? "red"
        : overdue > 0
        ? "amber"
        : "green";
    modules.push({
        module: "Tasks",
        signal: taskSignal,
        label: taskSignal === "green"
            ? "On track"
            : `${overdue} overdue, ${blocked} blocked`,
        detail: `${openTasks} open tasks`,
        route: "/tasks",
    });

    // Automations
    const failedRuns = failedRunsRes.count ?? 0;
    const totalRuns = totalRunsRes.count ?? 0;
    const autoSignal: ModuleSignal = failedRuns >= 3
        ? "red"
        : failedRuns > 0
        ? "amber"
        : "green";
    modules.push({
        module: "Automations",
        signal: autoSignal,
        label: failedRuns === 0 ? "All passing" : `${failedRuns} failed (24h)`,
        detail: `${totalRuns} total runs today`,
        route: "/automations",
    });

    // Time Tracking
    const trackingUsers = new Set(
        (timeRes.data ?? []).map((r) => r.user_id),
    ).size;
    const totalMembers = membersRes.count ?? 1;
    const trackingPct = Math.round((trackingUsers / totalMembers) * 100);
    const timeSignal: ModuleSignal = trackingPct >= 80
        ? "green"
        : trackingPct >= 50
        ? "amber"
        : "red";
    modules.push({
        module: "Time",
        signal: timeSignal,
        label: `${trackingPct}% team tracked today`,
        detail: `${trackingUsers}/${totalMembers} members`,
        route: "/time",
    });

    // Approvals
    const pendingApprovals = pendingApprovalsRes.count ?? 0;
    const staleApprovals = staleApprovalsRes.count ?? 0;
    const approvalSignal: ModuleSignal = staleApprovals > 0
        ? "red"
        : pendingApprovals > 3
        ? "amber"
        : "green";
    modules.push({
        module: "Approvals",
        signal: approvalSignal,
        label: staleApprovals > 0
            ? `${staleApprovals} stale >48h`
            : pendingApprovals > 0
            ? `${pendingApprovals} pending`
            : "All clear",
        detail: `${pendingApprovals} total pending`,
        route: "/time-approval",
    });

    // Leave
    const pendingLeave = leaveRes.count ?? 0;
    const leaveSignal: ModuleSignal = pendingLeave > 5 ? "amber" : "green";
    modules.push({
        module: "Leave",
        signal: leaveSignal,
        label: pendingLeave === 0 ? "No pending" : `${pendingLeave} pending`,
        detail: "",
        route: "/admin/leave",
    });

    // Stock
    const stockItems = stockRes.data ?? [];
    const lowStock = stockItems.filter(
        (item) =>
            item.quantity != null && item.min_quantity != null &&
            item.quantity <= item.min_quantity,
    ).length;
    const stockSignal: ModuleSignal = lowStock >= 3
        ? "red"
        : lowStock > 0
        ? "amber"
        : "green";
    modules.push({
        module: "Stock",
        signal: stockSignal,
        label: lowStock === 0 ? "Levels OK" : `${lowStock} items low`,
        detail: `${stockItems.length} total items`,
        route: "/assets",
    });

    // Clients
    const pausedClients = clientsRes.count ?? 0;
    const clientSignal: ModuleSignal = pausedClients >= 3 ? "amber" : "green";
    modules.push({
        module: "Clients",
        signal: clientSignal,
        label: pausedClients === 0 ? "All active" : `${pausedClients} paused`,
        detail: "",
        route: "/clients",
    });

    return modules;
}

// ── Team Pulse ─────────────────────────────────────────────

export async function getTeamPulse(
    organizationId: string,
): Promise<TeamPulseMember[]> {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const [profilesRes, activeTimersRes] = await Promise.all([
        supabase
            .from("profiles")
            .select(
                "id, full_name, email, avatar_url, primary_role, last_seen_at, is_active",
            )
            .eq("organization_id", organizationId)
            .eq("is_active", true)
            .order("last_seen_at", { ascending: false }),

        supabase
            .from("time_entries")
            .select("user_id")
            .eq("organization_id", organizationId)
            .eq("is_running", true),
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (activeTimersRes.error) throw activeTimersRes.error;

    const trackingUserIds = new Set(
        (activeTimersRes.data ?? []).map((r) => r.user_id),
    );

    return (profilesRes.data ?? []).map((p) => {
        const isTracking = trackingUserIds.has(p.id);
        const isOnline = p.last_seen_at && p.last_seen_at >= fiveMinAgo;

        let status: TeamPulseMember["status"] = "offline";
        if (isTracking) status = "tracking";
        else if (isOnline) status = "online";
        else if (
            p.last_seen_at &&
            p.last_seen_at >=
                new Date(Date.now() - 30 * 60 * 1000).toISOString()
        ) {
            status = "idle";
        }

        return {
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            avatar_url: p.avatar_url ?? null,
            primary_role: p.primary_role,
            is_tracking: isTracking,
            last_seen_at: p.last_seen_at,
            status,
        };
    });
}

// ── Escalation Feed ────────────────────────────────────────

export async function getEscalationItems(
    organizationId: string,
): Promise<EscalationItem[]> {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        .toISOString();
    const since48h = new Date(now.getTime() - 48 * 60 * 60 * 1000)
        .toISOString();

    const [
        failedRunsRes,
        blockedTasksRes,
        staleApprovalsRes,
        overdueProjectsRes,
        lowStockRes,
        urgentTicketsRes,
    ] = await Promise.all([
        // Failed automation runs (24h)
        supabase
            .from("automation_runs")
            .select("id, workflow_name, message, created_at")
            .eq("organization_id", organizationId)
            .gte("created_at", since24h)
            .neq("status", "success")
            .order("created_at", { ascending: false })
            .limit(10),

        // Blocked tasks (>24h)
        supabase
            .from("tasks")
            .select("id, title, updated_at")
            .eq("organization_id", organizationId)
            .eq("status", "blocked")
            .lt("updated_at", since24h)
            .order("updated_at", { ascending: true })
            .limit(10),

        // Stale approvals (>48h)
        supabase
            .from("approvals")
            .select("id, type, description, created_at")
            .eq("organization_id", organizationId)
            .eq("status", "pending")
            .lt("created_at", since48h)
            .order("created_at", { ascending: true })
            .limit(10),

        // Overdue projects
        supabase
            .from("projects")
            .select("id, name, due_date")
            .eq("organization_id", organizationId)
            .lt("due_date", now.toISOString())
            .in("status", ["active", "in_progress"])
            .order("due_date", { ascending: true })
            .limit(10),

        // Low stock
        supabase
            .from("stock_items")
            .select("id, name, quantity, min_quantity")
            .eq("organization_id", organizationId),

        // Urgent/high-priority support tickets (account recovery, etc.)
        supabase
            .from("it_support_tickets")
            .select(
                "id, title, ticket_type, priority, requester_email, created_at",
            )
            .eq("organization_id", organizationId)
            .in("status", ["open", "in_progress"])
            .in("priority", ["urgent", "high"])
            .order("created_at", { ascending: false })
            .limit(10),
    ]);

    const items: EscalationItem[] = [];

    // Failed automations → critical
    for (const run of failedRunsRes.data ?? []) {
        items.push({
            id: `esc_run_${run.id}`,
            type: "failed_automation",
            severity: "critical",
            title: `Automation failed: ${run.workflow_name ?? "Unknown"}`,
            detail: run.message ?? "No details available",
            entity_id: run.id,
            route: "/automation-runs",
            created_at: run.created_at,
        });
    }

    // Blocked tasks → warning
    for (const task of blockedTasksRes.data ?? []) {
        items.push({
            id: `esc_task_${task.id}`,
            type: "blocked_task",
            severity: "warning",
            title: `Blocked: ${task.title}`,
            detail: "Blocked for more than 24 hours",
            entity_id: task.id,
            route: "/tasks",
            created_at: task.updated_at,
        });
    }

    // Stale approvals → warning
    for (const approval of staleApprovalsRes.data ?? []) {
        items.push({
            id: `esc_appr_${approval.id}`,
            type: "stale_approval",
            severity: "warning",
            title: `Stale approval: ${approval.type ?? "Request"}`,
            detail: approval.description ?? "Pending for over 48 hours",
            entity_id: approval.id,
            route: "/time-approval",
            created_at: approval.created_at,
        });
    }

    // Overdue projects → warning
    for (const project of overdueProjectsRes.data ?? []) {
        items.push({
            id: `esc_proj_${project.id}`,
            type: "overdue_project",
            severity: "warning",
            title: `Overdue: ${project.name}`,
            detail: `Due ${new Date(project.due_date!).toLocaleDateString()}`,
            entity_id: project.id,
            route: `/it/projects/${project.id}`,
            created_at: project.due_date!,
        });
    }

    // Low stock → info/warning
    const lowItems = (lowStockRes.data ?? []).filter(
        (item) =>
            item.quantity != null &&
            item.min_quantity != null &&
            item.quantity <= item.min_quantity,
    );
    for (const item of lowItems.slice(0, 5)) {
        items.push({
            id: `esc_stock_${item.id}`,
            type: "low_stock",
            severity: item.quantity === 0 ? "critical" : "warning",
            title: `Low stock: ${item.name}`,
            detail: `${item.quantity}/${item.min_quantity} remaining`,
            entity_id: item.id,
            route: "/assets",
            created_at: now.toISOString(),
        });
    }

    // Urgent support tickets (account recovery, etc.) → critical/warning
    for (const ticket of urgentTicketsRes.data ?? []) {
        const typeLabel = (ticket.ticket_type ?? "support").replace(/_/g, " ");
        items.push({
            id: `esc_ticket_${ticket.id}`,
            type: "urgent_support_ticket",
            severity: ticket.priority === "urgent" ? "critical" : "warning",
            title: `${typeLabel}: ${ticket.title}`,
            detail: ticket.requester_email
                ? `Requester: ${ticket.requester_email}`
                : "Support ticket requires attention",
            entity_id: ticket.id,
            route: "/it/support",
            created_at: ticket.created_at,
        });
    }

    // Sort: critical first, then by date (newest first)
    items.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        const diff = severityOrder[a.severity] - severityOrder[b.severity];
        if (diff !== 0) return diff;
        return new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime();
    });

    return items;
}

// ── KPI Tiles ──────────────────────────────────────────────

export async function getKPITiles(
    organizationId: string,
): Promise<KPITile[]> {
    const now = new Date();
    const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
    ).toISOString();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        .toISOString();

    const [timeRes, billableRes, projectsRes, automationRes, failedRes] =
        await Promise.all([
            // Total time today in seconds
            supabase
                .from("time_entries")
                .select("duration_seconds, user_id")
                .eq("organization_id", organizationId)
                .gte("started_at", todayStart),

            // Billable time today
            supabase
                .from("time_entries")
                .select("duration_seconds")
                .eq("organization_id", organizationId)
                .eq("is_billable", true)
                .gte("started_at", todayStart),

            // Projects with health
            supabase
                .from("projects")
                .select("id, status, due_date")
                .eq("organization_id", organizationId)
                .in("status", ["active", "in_progress"]),

            // All automation runs 24h
            supabase
                .from("automation_runs")
                .select("id", { head: true, count: "exact" })
                .eq("organization_id", organizationId)
                .gte("created_at", since24h),

            // Failed automation runs 24h
            supabase
                .from("automation_runs")
                .select("id", { head: true, count: "exact" })
                .eq("organization_id", organizationId)
                .gte("created_at", since24h)
                .neq("status", "success"),
        ]);

    // Utilisation: tracked hours today vs 8h per active user
    const totalSeconds = (timeRes.data ?? []).reduce(
        (sum, r) => sum + (r.duration_seconds ?? 0),
        0,
    );
    const uniqueTrackers = new Set(
        (timeRes.data ?? []).map((r) => r.user_id),
    ).size;
    const availableSeconds = Math.max(uniqueTrackers, 1) * 8 * 3600;
    const utilPct = Math.min(
        100,
        Math.round((totalSeconds / availableSeconds) * 100),
    );

    // Billable %
    const billableSeconds = (billableRes.data ?? []).reduce(
        (sum, r) => sum + (r.duration_seconds ?? 0),
        0,
    );
    const billablePct = totalSeconds > 0
        ? Math.round((billableSeconds / totalSeconds) * 100)
        : 0;

    // Project health avg
    const activeProjects = projectsRes.data ?? [];
    const overdueCount = activeProjects.filter(
        (p) => p.due_date && new Date(p.due_date) < now,
    ).length;
    const healthPct = activeProjects.length > 0
        ? Math.round(
            ((activeProjects.length - overdueCount) / activeProjects.length) *
                100,
        )
        : 100;

    // Automation success rate
    const totalAuto = automationRes.count ?? 0;
    const failedAuto = failedRes.count ?? 0;
    const autoSuccessRate = totalAuto > 0
        ? Math.round(((totalAuto - failedAuto) / totalAuto) * 100)
        : 100;

    return [
        {
            label: "Utilisation",
            value: `${utilPct}%`,
            trend: utilPct >= 70 ? "up" : "down",
            detail: `${Math.round(totalSeconds / 3600)}h tracked today`,
        },
        {
            label: "Billable",
            value: `${billablePct}%`,
            trend: billablePct >= 60 ? "up" : "down",
            detail: `${Math.round(billableSeconds / 3600)}h billable`,
        },
        {
            label: "Project Health",
            value: `${healthPct}%`,
            trend: healthPct >= 80 ? "up" : healthPct >= 60 ? "flat" : "down",
            detail: `${overdueCount} overdue of ${activeProjects.length}`,
        },
        {
            label: "Automation",
            value: `${autoSuccessRate}%`,
            trend: autoSuccessRate >= 90
                ? "up"
                : autoSuccessRate >= 70
                ? "flat"
                : "down",
            detail: `${totalAuto - failedAuto}/${totalAuto} passed (24h)`,
        },
    ];
}

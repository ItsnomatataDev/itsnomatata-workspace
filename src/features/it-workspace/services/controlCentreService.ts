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
    active_task_title: string | null;
    active_board_id: string | null;
    active_board_name: string | null;
    active_timer_started_at: string | null;
    last_seen_at: string | null;
    status: "online" | "tracking" | "idle" | "offline";
};

export type EscalationItem = {
    id: string;
    type:
        | "failed_automation"
        | "blocked_task"
        | "stale_approval"
        | "overdue_card"
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
        cardsRes,
        blockedRes,
        overdueRes,
        firstOpenCardRes,
        failedRunsRes,
        totalRunsRes,
        activeTimersRes,
        todayTrackersRes,
        membersRes,
        pendingApprovalsRes,
        staleApprovalsRes,
        leaveRes,
        stockRes,
        clientsRes,
    ] = await Promise.all([
        // Cards: total open cards under boards/clients
        supabase
            .from("tasks")
            .select("id", { head: true, count: "exact" })
            .eq("organization_id", organizationId)
            .not("client_id", "is", null)
            .in("status", ["todo", "backlog", "in_progress", "review"]),

        // Tasks: blocked
        supabase
            .from("tasks")
            .select("id", { head: true, count: "exact" })
            .eq("organization_id", organizationId)
            .not("client_id", "is", null)
            .eq("status", "blocked"),

        // Tasks: overdue
        supabase
            .from("tasks")
            .select("id", { head: true, count: "exact" })
            .eq("organization_id", organizationId)
            .not("client_id", "is", null)
            .in("status", [
                "todo",
                "backlog",
                "in_progress",
                "review",
                "blocked",
            ])
            .lt("due_date", now.toISOString()),

        // First actionable board/card target for drill-downs
        supabase
            .from("tasks")
            .select("id, client_id, priority, due_date, updated_at")
            .eq("organization_id", organizationId)
            .not("client_id", "is", null)
            .in("status", [
                "todo",
                "backlog",
                "in_progress",
                "review",
                "blocked",
            ])
            .order("priority", { ascending: false })
            .order("due_date", { ascending: true, nullsFirst: false })
            .order("updated_at", { ascending: false })
            .limit(1),

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

        // Time: active timers right now
        supabase
            .from("time_entries")
            .select("id, user_id", { count: "exact" })
            .eq("organization_id", organizationId)
            .is("ended_at", null)
            .is("deleted_at", null),

        // Time: users who have tracked anything today
        supabase
            .from("time_entries")
            .select("id, user_id", { count: "exact" })
            .eq("organization_id", organizationId)
            .is("deleted_at", null)
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

        // Boards/clients: total
        supabase
            .from("clients")
            .select("id", { head: true, count: "exact" })
            .eq("organization_id", organizationId),
    ]);

    const modules: ModuleHealthItem[] = [];

    const firstOpenCard = firstOpenCardRes.data?.[0] ?? null;
    const boardRoute = firstOpenCard?.client_id
        ? `/boards/${firstOpenCard.client_id}?cardId=${firstOpenCard.id}`
        : "/boards";

    // Cards
    const openCards = cardsRes.count ?? 0;
    const blocked = blockedRes.count ?? 0;
    const overdue = overdueRes.count ?? 0;
    const cardSignal: ModuleSignal = blocked > 0 || overdue > 3
        ? "red"
        : overdue > 0
        ? "amber"
        : "green";
    modules.push({
        module: "Cards",
        signal: cardSignal,
        label: cardSignal === "green"
            ? "On track"
            : `${overdue} overdue, ${blocked} blocked`,
        detail: `${openCards} open cards`,
        route: boardRoute,
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
    const activeTrackingUsers = new Set(
        (activeTimersRes.data ?? []).map((r) => r.user_id),
    ).size;
    const todayTrackingUsers = new Set(
        (todayTrackersRes.data ?? []).map((r) => r.user_id),
    ).size;
    const totalMembers = membersRes.count ?? 1;
    const trackingPct = Math.round((todayTrackingUsers / totalMembers) * 100);
    const timeSignal: ModuleSignal = trackingPct >= 80
        ? "green"
        : trackingPct >= 50
        ? "amber"
        : "red";
    modules.push({
        module: "Timesheet",
        signal: timeSignal,
        label: `${activeTrackingUsers} tracking now`,
        detail: `${todayTrackingUsers}/${totalMembers} tracked today`,
        route: "/timesheets/team",
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
        route: "/timesheets/team",
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
    const boardCount = clientsRes.count ?? 0;
    const clientSignal: ModuleSignal = boardCount === 0 ? "amber" : "green";
    modules.push({
        module: "Boards",
        signal: clientSignal,
        label: `${boardCount} total`,
        detail: "Clients and boards",
        route: "/boards",
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
            .select("id, user_id, task_id, client_id, started_at")
            .eq("organization_id", organizationId)
            .is("ended_at", null)
            .is("deleted_at", null)
            .order("started_at", { ascending: false }),
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (activeTimersRes.error) throw activeTimersRes.error;

    const activeTimers = activeTimersRes.data ?? [];
    const taskIds = [
        ...new Set(activeTimers.map((timer) => timer.task_id).filter(Boolean)),
    ] as string[];
    const boardIds = [
        ...new Set(activeTimers.map((timer) => timer.client_id).filter(Boolean)),
    ] as string[];

    const [tasksRes, boardsRes] = await Promise.all([
        taskIds.length
            ? supabase.from("tasks").select("id, title").in("id", taskIds)
            : Promise.resolve({ data: [], error: null }),
        boardIds.length
            ? supabase.from("clients").select("id, name").in("id", boardIds)
            : Promise.resolve({ data: [], error: null }),
    ]);

    if (tasksRes.error) throw tasksRes.error;
    if (boardsRes.error) throw boardsRes.error;

    const taskMap = new Map((tasksRes.data ?? []).map((task) => [task.id, task]));
    const boardMap = new Map((boardsRes.data ?? []).map((board) => [board.id, board]));
    const activeTimerByUser = new Map(
        activeTimers.map((timer) => [timer.user_id, timer]),
    );

    return (profilesRes.data ?? []).map((p) => {
        const activeTimer = activeTimerByUser.get(p.id) ?? null;
        const isTracking = Boolean(activeTimer);
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
            active_task_title: activeTimer?.task_id
                ? taskMap.get(activeTimer.task_id)?.title ?? null
                : null,
            active_board_id: activeTimer?.client_id ?? null,
            active_board_name: activeTimer?.client_id
                ? boardMap.get(activeTimer.client_id)?.name ?? null
                : null,
            active_timer_started_at: activeTimer?.started_at ?? null,
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
        overdueCardsRes,
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

        // Overdue cards under boards
        supabase
            .from("tasks")
            .select("id, title, due_date, client_id")
            .eq("organization_id", organizationId)
            .not("client_id", "is", null)
            .lt("due_date", now.toISOString())
            .in("status", ["todo", "backlog", "in_progress", "review", "blocked"])
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

    // Blocked cards → warning
    for (const task of blockedTasksRes.data ?? []) {
        items.push({
            id: `esc_task_${task.id}`,
            type: "blocked_task",
            severity: "warning",
            title: `Blocked: ${task.title}`,
            detail: "Blocked for more than 24 hours",
            entity_id: task.id,
            route: "/boards",
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
            route: "/timesheets/team",
            created_at: approval.created_at,
        });
    }

    // Overdue cards → warning
    for (const card of overdueCardsRes.data ?? []) {
        items.push({
            id: `esc_card_${card.id}`,
            type: "overdue_card",
            severity: "warning",
            title: `Overdue card: ${card.title}`,
            detail: `Due ${new Date(card.due_date!).toLocaleDateString()}`,
            entity_id: card.id,
            route: card.client_id
                ? `/boards/${card.client_id}?cardId=${card.id}`
                : "/boards",
            created_at: card.due_date!,
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

    const [timeRes, billableRes, cardsRes, boardsRes, automationRes, failedRes] =
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

            // Open cards with board/client linkage
            supabase
                .from("tasks")
                .select("id, status, due_date, client_id")
                .eq("organization_id", organizationId)
                .not("client_id", "is", null)
                .in("status", ["todo", "backlog", "in_progress", "review", "blocked"]),

            // Total boards/clients
            supabase
                .from("clients")
                .select("id", { head: true, count: "exact" })
                .eq("organization_id", organizationId),

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

    // Board/card health
    const activeCards = cardsRes.data ?? [];
    const overdueCount = activeCards.filter(
        (card) => card.due_date && new Date(card.due_date) < now,
    ).length;
    const healthPct = activeCards.length > 0
        ? Math.round(
            ((activeCards.length - overdueCount) / activeCards.length) *
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
            label: "Board Health",
            value: `${healthPct}%`,
            trend: healthPct >= 80 ? "up" : healthPct >= 60 ? "flat" : "down",
            detail: `${overdueCount} overdue of ${activeCards.length} open cards`,
        },
        {
            label: "Boards",
            value: `${boardsRes.count ?? 0}`,
            trend: (boardsRes.count ?? 0) > 0 ? "up" : "flat",
            detail: "Total clients/boards",
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

// ── IT Control Centre Snapshot ─────────────────────────────

export type ControlStatus = "green" | "amber" | "red";

export type ControlMetric = {
    label: string;
    value: number | string;
    status: ControlStatus;
    detail: string;
    route: string;
};

export type ControlAlert = {
    id: string;
    title: string;
    message: string | null;
    severity: "warning" | "critical";
    status: "open" | "acknowledged" | "resolved";
    module: string;
    route: string;
    created_at: string;
};

export type ControlMonitor = {
    id: string;
    name: string;
    monitor_type: string;
    status: "healthy" | "degraded" | "down" | string;
    last_checked_at: string | null;
    details: Record<string, unknown>;
};

export type ControlEvent = {
    id: string;
    title: string;
    description: string | null;
    module: string;
    severity: "info" | "warning" | "critical" | string;
    created_at: string;
};

export type ControlTicket = {
    id: string;
    title: string;
    priority: string;
    status: string;
    assigned_to: string | null;
    requester_email: string | null;
    created_at: string;
};

export type ControlBoardRisk = {
    board_id: string;
    board_name: string;
    open_cards: number;
    overdue_cards: number;
    blocked_cards: number;
    high_priority_cards: number;
    route: string;
    status: ControlStatus;
};

export type ITControlCentreData = {
    generatedAt: string;
    healthScore: number;
    healthStatus: ControlStatus;
    metrics: {
        activeUsers: number;
        suspendedUsers: number;
        pendingAccountRequests: number;
        activeTimers: number;
        usersNotTracking: number;
        attendanceActiveSessions: number;
        attendancePresentToday: number;
        attendanceLateToday: number;
        attendanceAbsentToday: number;
        openCards: number;
        overdueCards: number;
        blockedCards: number;
        unassignedCards: number;
        highCriticalPriorityCards: number;
        boardsCount: number;
        openSystemAlerts: number;
        criticalAlerts: number;
        acknowledgedAlerts: number;
        healthyMonitors: number;
        degradedMonitors: number;
        downMonitors: number;
        openSupportTickets: number;
        urgentSupportTickets: number;
        unassignedSupportTickets: number;
        totalAssets: number;
        inStockAssets: number;
        assignedAssets: number;
        damagedRepairAssets: number;
        warrantyExpiringSoon: number;
        uninsuredAssets: number;
        activeVehicles: number;
        vehiclesInMaintenance: number;
        serviceOverdue: number;
        serviceSoon: number;
        fuelSpendThisMonth: number;
        kmDrivenThisMonth: number;
        failedNotificationDeliveries24h: number;
        queuedEmailDeliveries: number;
        workflowFailures24h: number;
        aiActions24h: number;
    };
    topMetrics: ControlMetric[];
    alerts: ControlAlert[];
    monitors: ControlMonitor[];
    teamPulse: TeamPulseMember[];
    boardRisks: ControlBoardRisk[];
    supportTickets: ControlTicket[];
    recentEvents: ControlEvent[];
    workflowFailures: Array<{
        id: string;
        instance_id: string;
        execution_id: string;
        status: string;
        error_message: string | null;
        created_at: string;
        workflow_name: string | null;
    }>;
    aiLogs: Array<{
        id: string;
        prompt: string;
        response_summary: string | null;
        action_type: string | null;
        action_status: string;
        created_at: string;
    }>;
};

const OPEN_CARD_STATUSES = ["backlog", "todo", "in_progress", "review", "blocked"];
const HIGH_PRIORITIES = ["high", "urgent", "critical"];

function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
}

function inNextDays(value: string | null | undefined, days: number) {
    if (!value) return false;
    const time = new Date(value).getTime();
    const now = Date.now();
    return time >= now && time <= now + days * 24 * 60 * 60 * 1000;
}

function isPast(value: string | null | undefined) {
    return Boolean(value && new Date(value).getTime() < Date.now());
}

function numeric(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function metricStatus(value: number, amberAt: number, redAt: number): ControlStatus {
    if (value >= redAt) return "red";
    if (value >= amberAt) return "amber";
    return "green";
}

function alertRoute(alert: {
    related_entity_type?: string | null;
    related_entity_id?: string | null;
}) {
    if (alert.related_entity_type === "task" && alert.related_entity_id) {
        return "/boards";
    }
    if (alert.related_entity_type === "ticket" && alert.related_entity_id) {
        return "/it/support";
    }
    return "/it/dashboard";
}

export async function getITControlCentreData(
    organizationId: string,
): Promise<ITControlCentreData> {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const today = startOfToday().toISOString().slice(0, 10);
    const monthStartIso = startOfMonth().toISOString();

    const [
        profilesRes,
        accessRequestsRes,
        timersRes,
        attendanceSessionsRes,
        attendanceDailyRes,
        tasksRes,
        boardsRes,
        alertsRes,
        eventsRes,
        monitorsRes,
        ticketsRes,
        assetsRes,
        vehiclesRes,
        serviceSchedulesRes,
        fuelPurchasesRes,
        fuelLogsRes,
        mileageLogsRes,
        dailySummariesRes,
        orgNotificationsRes,
        workflowInstancesRes,
        aiLogsRes,
    ] = await Promise.all([
        supabase
            .from("profiles")
            .select("id, full_name, email, avatar_url, primary_role, last_seen_at, is_active, is_suspended, account_status")
            .eq("organization_id", organizationId),
        supabase
            .from("account_access_requests")
            .select("id, status")
            .or(`organization_id.eq.${organizationId},organization_id.is.null`),
        supabase
            .from("time_entries")
            .select("id, user_id, task_id, client_id, started_at, ended_at, deleted_at")
            .eq("organization_id", organizationId)
            .is("ended_at", null)
            .is("deleted_at", null),
        supabase
            .from("attendance_sessions")
            .select("id, user_id, status, clock_in_at, clock_out_at")
            .eq("organization_id", organizationId)
            .eq("status", "active"),
        supabase
            .from("attendance_daily_status")
            .select("id, user_id, status")
            .eq("organization_id", organizationId)
            .eq("attendance_date", today),
        supabase
            .from("tasks")
            .select("id, title, client_id, status, priority, assigned_to, due_date, blocked_reason, updated_at, archived_at")
            .eq("organization_id", organizationId)
            .not("client_id", "is", null)
            .is("archived_at", null),
        supabase
            .from("clients")
            .select("id, name, status, board_type")
            .eq("organization_id", organizationId),
        supabase
            .from("system_alerts")
            .select("id, module, severity, status, title, message, related_entity_type, related_entity_id, created_at")
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false })
            .limit(30),
        supabase
            .from("system_events")
            .select("id, event_type, module, severity, title, description, created_at")
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false })
            .limit(20),
        supabase
            .from("system_monitors")
            .select("id, name, monitor_type, status, last_checked_at, details")
            .eq("organization_id", organizationId)
            .order("name", { ascending: true }),
        supabase
            .from("it_support_tickets")
            .select("id, title, priority, status, assigned_to, requester_email, created_at")
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false })
            .limit(30),
        supabase
            .from("assets")
            .select("id, status, condition, assigned_to, warranty_expiry_date, insured")
            .eq("organization_id", organizationId),
        supabase
            .from("fleet_vehicles")
            .select("id, status, service_status, next_service_date")
            .eq("organization_id", organizationId),
        supabase
            .from("fleet_service_schedules")
            .select("id, status, next_service_date")
            .eq("organization_id", organizationId),
        supabase
            .from("fleet_fuel_purchases")
            .select("id, total_cost, purchase_date")
            .eq("organization_id", organizationId)
            .gte("purchase_date", monthStartIso),
        supabase
            .from("fleet_fuel_logs")
            .select("id, total_cost, fuel_date")
            .eq("organization_id", organizationId)
            .gte("fuel_date", monthStartIso.slice(0, 10)),
        supabase
            .from("fleet_mileage_logs")
            .select("id, distance_km, log_date")
            .eq("organization_id", organizationId)
            .gte("log_date", monthStartIso.slice(0, 10)),
        supabase
            .from("fleet_daily_summaries")
            .select("id, route_length_km, summary_date")
            .eq("organization_id", organizationId)
            .gte("summary_date", monthStartIso.slice(0, 10)),
        supabase
            .from("notifications")
            .select("id, user_id")
            .eq("organization_id", organizationId)
            .gte("created_at", since24h)
            .limit(500),
        supabase
            .from("workflow_instances")
            .select("id, name, organization_id")
            .eq("organization_id", organizationId),
        supabase
            .from("ai_workspace_logs")
            .select("id, prompt, response_summary, action_type, action_status, created_at")
            .eq("organization_id", organizationId)
            .gte("created_at", since24h)
            .order("created_at", { ascending: false })
            .limit(20),
    ]);

    const firstError = [
        profilesRes.error,
        accessRequestsRes.error,
        timersRes.error,
        attendanceSessionsRes.error,
        attendanceDailyRes.error,
        tasksRes.error,
        boardsRes.error,
        alertsRes.error,
        eventsRes.error,
        monitorsRes.error,
        ticketsRes.error,
        assetsRes.error,
        vehiclesRes.error,
        serviceSchedulesRes.error,
        fuelPurchasesRes.error,
        fuelLogsRes.error,
        mileageLogsRes.error,
        dailySummariesRes.error,
        orgNotificationsRes.error,
        workflowInstancesRes.error,
        aiLogsRes.error,
    ].find(Boolean);
    if (firstError) throw firstError;

    const notificationIds = (orgNotificationsRes.data ?? []).map((item) => item.id);
    const workflowInstances = workflowInstancesRes.data ?? [];
    const workflowInstanceIds = workflowInstances.map((item) => item.id);

    const [deliveryRes, workflowLogsRes] = await Promise.all([
        notificationIds.length
            ? supabase
                .from("notification_deliveries")
                .select("id, notification_id, channel, status, created_at")
                .in("notification_id", notificationIds)
            : Promise.resolve({ data: [], error: null }),
        workflowInstanceIds.length
            ? supabase
                .from("workflow_execution_logs")
                .select("id, instance_id, execution_id, status, error_message, created_at")
                .in("instance_id", workflowInstanceIds)
                .gte("created_at", since24h)
                .order("created_at", { ascending: false })
                .limit(30)
            : Promise.resolve({ data: [], error: null }),
    ]);
    if (deliveryRes.error) throw deliveryRes.error;
    if (workflowLogsRes.error) throw workflowLogsRes.error;

    const profiles = profilesRes.data ?? [];
    const activeUsers = profiles.filter(
        (profile) =>
            profile.is_active &&
            !profile.is_suspended &&
            (profile.account_status === "active" || profile.account_status == null),
    ).length;
    const suspendedUsers = profiles.filter(
        (profile) => profile.is_suspended || profile.account_status === "suspended",
    ).length;
    const pendingAccountRequests = profiles.filter(
        (profile) =>
            profile.account_status === "pending" ||
            profile.account_status === "pending_approval",
    ).length + (accessRequestsRes.data ?? []).filter((request) => request.status === "pending").length;

    const timers = timersRes.data ?? [];
    const activeTimerUsers = new Set(timers.map((timer) => timer.user_id).filter(Boolean));
    const usersNotTracking = Math.max(activeUsers - activeTimerUsers.size, 0);

    const dailyAttendance = attendanceDailyRes.data ?? [];
    const attendancePresentToday = dailyAttendance.filter((row) => row.status === "present").length;
    const attendanceLateToday = dailyAttendance.filter((row) => row.status === "late").length;
    const attendanceAbsentToday = dailyAttendance.filter((row) => row.status === "absent").length;

    const boards = boardsRes.data ?? [];
    const tasks = tasksRes.data ?? [];
    const openTasks = tasks.filter((task) => OPEN_CARD_STATUSES.includes(task.status));
    const overdueTasks = openTasks.filter((task) => isPast(task.due_date));
    const blockedTasks = openTasks.filter((task) => task.status === "blocked" || Boolean(task.blocked_reason));
    const unassignedTasks = openTasks.filter((task) => !task.assigned_to);
    const highPriorityTasks = openTasks.filter((task) => HIGH_PRIORITIES.includes(task.priority));

    const boardNameById = new Map(boards.map((board) => [board.id, board.name]));
    const boardRisks = [...new Set(openTasks.map((task) => task.client_id).filter(Boolean) as string[])]
        .map((boardId) => {
            const boardTasks = openTasks.filter((task) => task.client_id === boardId);
            const overdue = boardTasks.filter((task) => isPast(task.due_date)).length;
            const blocked = boardTasks.filter((task) => task.status === "blocked" || Boolean(task.blocked_reason)).length;
            const high = boardTasks.filter((task) => HIGH_PRIORITIES.includes(task.priority)).length;
            const firstRiskCard = boardTasks.find(
                (task) => task.status === "blocked" || isPast(task.due_date) || HIGH_PRIORITIES.includes(task.priority),
            ) ?? boardTasks[0];
            const status: ControlStatus = blocked > 0 || overdue > 2 ? "red" : overdue > 0 || high > 1 ? "amber" : "green";
            return {
                board_id: boardId,
                board_name: boardNameById.get(boardId) ?? "Untitled board",
                open_cards: boardTasks.length,
                overdue_cards: overdue,
                blocked_cards: blocked,
                high_priority_cards: high,
                route: firstRiskCard
                    ? `/boards/${boardId}?cardId=${firstRiskCard.id}`
                    : `/boards/${boardId}`,
                status,
            };
        })
        .sort((a, b) => {
            const rank = { red: 0, amber: 1, green: 2 };
            return rank[a.status] - rank[b.status] ||
                b.blocked_cards - a.blocked_cards ||
                b.overdue_cards - a.overdue_cards;
        })
        .slice(0, 8);

    const alerts = (alertsRes.data ?? []).map((alert) => ({
        id: alert.id,
        title: alert.title,
        message: alert.message,
        severity: alert.severity as "warning" | "critical",
        status: alert.status as "open" | "acknowledged" | "resolved",
        module: alert.module,
        route: alertRoute(alert),
        created_at: alert.created_at,
    }));

    const monitors = (monitorsRes.data ?? []).map((monitor) => ({
        ...monitor,
        details: (monitor.details ?? {}) as Record<string, unknown>,
    }));
    const tickets = ticketsRes.data ?? [];
    const assets = assetsRes.data ?? [];
    const vehicles = vehiclesRes.data ?? [];
    const serviceSchedules = serviceSchedulesRes.data ?? [];
    const deliveries = deliveryRes.data ?? [];
    const workflowNameById = new Map(workflowInstances.map((item) => [item.id, item.name]));
    const workflowFailures = (workflowLogsRes.data ?? [])
        .filter((log) => log.status !== "success" && log.status !== "completed")
        .map((log) => ({
            ...log,
            workflow_name: workflowNameById.get(log.instance_id) ?? null,
        }));

    const fuelSpendThisMonth = [
        ...(fuelPurchasesRes.data ?? []).map((row) => numeric(row.total_cost)),
        ...(fuelLogsRes.data ?? []).map((row) => numeric(row.total_cost)),
    ].reduce((sum, value) => sum + value, 0);
    const kmDrivenThisMonth = [
        ...(mileageLogsRes.data ?? []).map((row) => numeric(row.distance_km)),
        ...(dailySummariesRes.data ?? []).map((row) => numeric(row.route_length_km)),
    ].reduce((sum, value) => sum + value, 0);

    const openAlerts = alerts.filter((alert) => alert.status === "open");
    const metrics = {
        activeUsers,
        suspendedUsers,
        pendingAccountRequests,
        activeTimers: timers.length,
        usersNotTracking,
        attendanceActiveSessions: (attendanceSessionsRes.data ?? []).length,
        attendancePresentToday,
        attendanceLateToday,
        attendanceAbsentToday,
        openCards: openTasks.length,
        overdueCards: overdueTasks.length,
        blockedCards: blockedTasks.length,
        unassignedCards: unassignedTasks.length,
        highCriticalPriorityCards: highPriorityTasks.length,
        boardsCount: boards.length,
        openSystemAlerts: openAlerts.length,
        criticalAlerts: alerts.filter((alert) => alert.severity === "critical" && alert.status !== "resolved").length,
        acknowledgedAlerts: alerts.filter((alert) => alert.status === "acknowledged").length,
        healthyMonitors: monitors.filter((monitor) => monitor.status === "healthy").length,
        degradedMonitors: monitors.filter((monitor) => monitor.status === "degraded").length,
        downMonitors: monitors.filter((monitor) => monitor.status === "down").length,
        openSupportTickets: tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length,
        urgentSupportTickets: tickets.filter((ticket) => ticket.priority === "urgent" && !["resolved", "closed"].includes(ticket.status)).length,
        unassignedSupportTickets: tickets.filter((ticket) => !ticket.assigned_to && !["resolved", "closed"].includes(ticket.status)).length,
        totalAssets: assets.length,
        inStockAssets: assets.filter((asset) => asset.status === "in_stock").length,
        assignedAssets: assets.filter((asset) => asset.status === "assigned" || Boolean(asset.assigned_to)).length,
        damagedRepairAssets: assets.filter((asset) =>
            ["damaged", "repair", "maintenance"].includes(asset.status) ||
            ["damaged", "poor"].includes(asset.condition),
        ).length,
        warrantyExpiringSoon: assets.filter((asset) => inNextDays(asset.warranty_expiry_date, 30)).length,
        uninsuredAssets: assets.filter((asset) => asset.insured === false).length,
        activeVehicles: vehicles.filter((vehicle) => vehicle.status === "active").length,
        vehiclesInMaintenance: vehicles.filter((vehicle) => vehicle.status === "maintenance" || vehicle.status === "in_maintenance").length,
        serviceOverdue:
            vehicles.filter((vehicle) => vehicle.service_status === "service_overdue" || isPast(vehicle.next_service_date)).length +
            serviceSchedules.filter((schedule) => schedule.status === "active" && isPast(schedule.next_service_date)).length,
        serviceSoon:
            vehicles.filter((vehicle) => vehicle.service_status === "service_soon" || inNextDays(vehicle.next_service_date, 14)).length +
            serviceSchedules.filter((schedule) => schedule.status === "active" && inNextDays(schedule.next_service_date, 14)).length,
        fuelSpendThisMonth,
        kmDrivenThisMonth,
        failedNotificationDeliveries24h: deliveries.filter((delivery) => delivery.status === "failed").length,
        queuedEmailDeliveries: deliveries.filter((delivery) => delivery.channel === "email" && ["queued", "pending"].includes(delivery.status)).length,
        workflowFailures24h: workflowFailures.length,
        aiActions24h: (aiLogsRes.data ?? []).length,
    };

    let healthScore = 100;
    healthScore -= metrics.criticalAlerts * 10;
    healthScore -= metrics.downMonitors * 14;
    healthScore -= metrics.degradedMonitors * 6;
    healthScore -= Math.min(metrics.overdueCards * 2, 16);
    healthScore -= Math.min(metrics.blockedCards * 4, 18);
    healthScore -= Math.min(metrics.urgentSupportTickets * 5, 15);
    healthScore -= Math.min(metrics.workflowFailures24h * 5, 20);
    healthScore -= Math.min(metrics.failedNotificationDeliveries24h * 2, 12);
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));
    const healthStatus: ControlStatus = healthScore >= 82 ? "green" : healthScore >= 62 ? "amber" : "red";

    const topMetrics: ControlMetric[] = [
        {
            label: "Critical alerts",
            value: metrics.criticalAlerts,
            status: metricStatus(metrics.criticalAlerts, 1, 3),
            detail: `${metrics.openSystemAlerts} open system alerts`,
            route: "/it/dashboard",
        },
        {
            label: "Cards at risk",
            value: metrics.overdueCards + metrics.blockedCards,
            status: metricStatus(metrics.overdueCards + metrics.blockedCards, 1, 6),
            detail: `${metrics.overdueCards} overdue, ${metrics.blockedCards} blocked`,
            route: boardRisks[0]?.route ?? "/boards",
        },
        {
            label: "Support queue",
            value: metrics.openSupportTickets,
            status: metricStatus(metrics.urgentSupportTickets || metrics.unassignedSupportTickets, 1, 4),
            detail: `${metrics.urgentSupportTickets} urgent, ${metrics.unassignedSupportTickets} unassigned`,
            route: "/it/support",
        },
        {
            label: "Workflow failures",
            value: metrics.workflowFailures24h,
            status: metricStatus(metrics.workflowFailures24h, 1, 4),
            detail: "Failed in the last 24h",
            route: "/automation-runs",
        },
        {
            label: "Notification failures",
            value: metrics.failedNotificationDeliveries24h,
            status: metricStatus(metrics.failedNotificationDeliveries24h, 1, 8),
            detail: `${metrics.queuedEmailDeliveries} email deliveries queued`,
            route: "/notifications",
        },
        {
            label: "Fleet service",
            value: metrics.serviceOverdue + metrics.serviceSoon,
            status: metricStatus(metrics.serviceOverdue * 2 + metrics.serviceSoon, 1, 4),
            detail: `${metrics.serviceOverdue} overdue, ${metrics.serviceSoon} soon`,
            route: "/fleet",
        },
    ].sort((a, b) => {
        const rank = { red: 0, amber: 1, green: 2 };
        return rank[a.status] - rank[b.status];
    });

    return {
        generatedAt: now.toISOString(),
        healthScore,
        healthStatus,
        metrics,
        topMetrics,
        alerts,
        monitors,
        teamPulse: await getTeamPulse(organizationId),
        boardRisks,
        supportTickets: tickets.map((ticket) => ({
            id: ticket.id,
            title: ticket.title,
            priority: ticket.priority,
            status: ticket.status,
            assigned_to: ticket.assigned_to,
            requester_email: ticket.requester_email,
            created_at: ticket.created_at,
        })),
        recentEvents: (eventsRes.data ?? []).map((event) => ({
            id: event.id,
            title: event.title,
            description: event.description,
            module: event.module,
            severity: event.severity,
            created_at: event.created_at,
        })),
        workflowFailures,
        aiLogs: aiLogsRes.data ?? [],
    };
}

import { supabase } from "../../../lib/supabase/client";

// ── Types ──────────────────────────────────────────────────

export type TicketType =
    | "account_recovery"
    | "password_reset"
    | "access_request"
    | "mfa_reset"
    | "account_unlock"
    | "permission_change"
    | "device_issue"
    | "other";

export type TicketStatus =
    | "open"
    | "in_progress"
    | "waiting_on_user"
    | "resolved"
    | "closed";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type SupportTicket = {
    id: string;
    organization_id: string;
    requester_id: string | null;
    assigned_to: string | null;
    ticket_type: TicketType;
    status: TicketStatus;
    priority: TicketPriority;
    title: string;
    description: string | null;
    resolution_notes: string | null;
    requester_email: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    // Joined fields
    requester_name?: string | null;
    requester_avatar?: string | null;
    assigned_name?: string | null;
};

export type SupportTicketStats = {
    open: number;
    inProgress: number;
    waitingOnUser: number;
    resolved: number;
    urgent: number;
    accountRecovery: number;
};

// ── Queries ────────────────────────────────────────────────

export async function getSupportTickets(
    organizationId: string,
    filters?: {
        status?: TicketStatus[];
        type?: TicketType[];
        assignedTo?: string;
        limit?: number;
    },
): Promise<SupportTicket[]> {
    let query = supabase
        .from("it_support_tickets")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

    if (filters?.status?.length) {
        query = query.in("status", filters.status);
    }
    if (filters?.type?.length) {
        query = query.in("ticket_type", filters.type);
    }
    if (filters?.assignedTo) {
        query = query.eq("assigned_to", filters.assignedTo);
    }
    if (filters?.limit) {
        query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    const tickets = data ?? [];
    if (tickets.length === 0) return [];

    // Resolve requester + assigned names
    const userIds = new Set<string>();
    for (const t of tickets) {
        if (t.requester_id) userIds.add(t.requester_id);
        if (t.assigned_to) userIds.add(t.assigned_to);
    }

    const profileMap = new Map<
        string,
        { full_name: string | null; avatar_url: string | null }
    >();
    if (userIds.size > 0) {
        const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", Array.from(userIds));
        for (const p of profiles ?? []) {
            profileMap.set(p.id, {
                full_name: p.full_name,
                avatar_url: p.avatar_url,
            });
        }
    }

    return tickets.map((t) => ({
        ...t,
        metadata: (t.metadata as Record<string, unknown>) ?? {},
        requester_name: t.requester_id
            ? profileMap.get(t.requester_id)?.full_name ?? null
            : null,
        requester_avatar: t.requester_id
            ? profileMap.get(t.requester_id)?.avatar_url ?? null
            : null,
        assigned_name: t.assigned_to
            ? profileMap.get(t.assigned_to)?.full_name ?? null
            : null,
    }));
}

export async function getSupportTicketStats(
    organizationId: string,
): Promise<SupportTicketStats> {
    const { data, error } = await supabase
        .from("it_support_tickets")
        .select("status, priority, ticket_type")
        .eq("organization_id", organizationId)
        .in("status", ["open", "in_progress", "waiting_on_user", "resolved"]);

    if (error) throw error;

    const rows = data ?? [];
    return {
        open: rows.filter((r) => r.status === "open").length,
        inProgress: rows.filter((r) => r.status === "in_progress").length,
        waitingOnUser:
            rows.filter((r) => r.status === "waiting_on_user").length,
        resolved: rows.filter((r) => r.status === "resolved").length,
        urgent: rows.filter((r) => r.priority === "urgent").length,
        accountRecovery:
            rows.filter((r) => r.ticket_type === "account_recovery").length,
    };
}

export async function createSupportTicket(input: {
    organizationId: string;
    requesterId?: string;
    requesterEmail?: string;
    ticketType: TicketType;
    priority: TicketPriority;
    title: string;
    description?: string;
}): Promise<string> {
    const { data, error } = await supabase
        .from("it_support_tickets")
        .insert({
            organization_id: input.organizationId,
            requester_id: input.requesterId ?? null,
            requester_email: input.requesterEmail ?? null,
            ticket_type: input.ticketType,
            priority: input.priority,
            title: input.title,
            description: input.description ?? null,
        })
        .select("id")
        .single();

    if (error) throw error;
    return data.id;
}

export async function updateTicketStatus(
    ticketId: string,
    status: TicketStatus,
    resolutionNotes?: string,
): Promise<void> {
    const update: Record<string, unknown> = { status };
    if (status === "resolved" || status === "closed") {
        update.resolved_at = new Date().toISOString();
    }
    if (resolutionNotes) {
        update.resolution_notes = resolutionNotes;
    }

    const { error } = await supabase
        .from("it_support_tickets")
        .update(update)
        .eq("id", ticketId);

    if (error) throw error;
}

export async function assignTicket(
    ticketId: string,
    assignedTo: string,
): Promise<void> {
    const { error } = await supabase
        .from("it_support_tickets")
        .update({ assigned_to: assignedTo, status: "in_progress" })
        .eq("id", ticketId);

    if (error) throw error;
}

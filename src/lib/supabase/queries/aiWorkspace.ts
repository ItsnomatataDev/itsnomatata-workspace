import { supabase } from "../client";

// ── Row types ──────────────────────────────────────────────

export type AIConversationRow = {
    id: string;
    organization_id: string;
    user_id: string;
    title: string | null;
    tool_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
};

type AIConversationSummary = {
    id: string;
    title: string | null;
    tool_id: string | null;
    user_id: string;
};

export type AIMessageRow = {
    id: string;
    conversation_id: string;
    role: "user" | "assistant" | "system";
    content: string;
    type: string;
    tool_id: string | null;
    data: Record<string, unknown>;
    sources: Array<Record<string, unknown>>;
    actions: Array<Record<string, unknown>>;
    requires_approval: boolean;
    approval_id: string | null;
    error: boolean;
    created_at: string;
};

export type AIApprovalRow = {
    id: string;
    organization_id: string;
    conversation_id: string | null;
    message_id: string | null;
    user_id: string;
    reviewer_id: string | null;
    tool_id: string | null;
    title: string;
    description: string | null;
    status: "pending" | "approved" | "rejected";
    review_note: string | null;
    payload: Record<string, unknown>;
    reviewed_at: string | null;
    created_at: string;
};

// ── Conversations ──────────────────────────────────────────

export async function getConversations(userId: string, limit = 20) {
    const { data, error } = await supabase
        .from("ai_conversations")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return (data ?? []) as AIConversationRow[];
}

export async function getConversation(conversationId: string) {
    const { data, error } = await supabase
        .from("ai_conversations")
        .select("*")
        .eq("id", conversationId)
        .single();

    if (error) throw error;
    return data as AIConversationRow;
}

export async function createConversation(params: {
    organizationId: string;
    userId: string;
    title?: string | null;
    toolId?: string | null;
    metadata?: Record<string, unknown>;
}) {
    const { data, error } = await supabase
        .from("ai_conversations")
        .insert({
            organization_id: params.organizationId,
            user_id: params.userId,
            title: params.title ?? null,
            tool_id: params.toolId ?? null,
            metadata: params.metadata ?? {},
        })
        .select("*")
        .single();

    if (error) {
        // Backward-compatible fallback when the running DB schema does not
        // include the `metadata` column yet.
        if ((error as { code?: string }).code === "PGRST204") {
            const fallback = await supabase
                .from("ai_conversations")
                .insert({
                    organization_id: params.organizationId,
                    user_id: params.userId,
                    title: params.title ?? null,
                    tool_id: params.toolId ?? null,
                })
                .select("*")
                .single();

            if (fallback.error) throw fallback.error;
            return fallback.data as AIConversationRow;
        }

        throw error;
    }
    return data as AIConversationRow;
}

export async function updateConversationTitle(
    conversationId: string,
    title: string,
) {
    const { error } = await supabase
        .from("ai_conversations")
        .update({ title })
        .eq("id", conversationId);

    if (error) throw error;
}

// ── Messages ───────────────────────────────────────────────

export async function getMessages(conversationId: string, limit = 50) {
    const { data, error } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(limit);

    if (error) throw error;
    return (data ?? []) as AIMessageRow[];
}

export async function createMessage(params: {
    conversationId: string;
    role: "user" | "assistant" | "system";
    content: string;
    type?: string;
    toolId?: string | null;
    data?: Record<string, unknown>;
    sources?: Array<Record<string, unknown>>;
    actions?: Array<Record<string, unknown>>;
    requiresApproval?: boolean;
    approvalId?: string | null;
    error?: boolean;
}) {
    const basePayload = {
        conversation_id: params.conversationId,
        role: params.role,
        content: params.content,
        type: params.type ?? "text",
        tool_id: params.toolId ?? null,
        data: params.data ?? {},
        sources: params.sources ?? [],
        actions: params.actions ?? [],
        requires_approval: params.requiresApproval ?? false,
        approval_id: params.approvalId ?? null,
        error: params.error ?? false,
    };

    const attempt = async (payload: Record<string, unknown>) => {
        return supabase
            .from("ai_messages")
            .insert(payload)
            .select("*")
            .single();
    };

    let result = await attempt(basePayload);
    if (!result.error) return result.data as AIMessageRow;

    const initialError = result.error as { code?: string; message?: string };
    const missingOrgUser = initialError.code === "23502" &&
        /organization_id|user_id/i.test(initialError.message ?? "");

    if (missingOrgUser) {
        const conv = await getConversation(params.conversationId);
        result = await attempt({
            ...basePayload,
            organization_id: conv.organization_id,
            user_id: conv.user_id,
        });

        if (!result.error) return result.data as AIMessageRow;
    }

    const schemaColumnError = (result.error as { code?: string }).code ===
        "PGRST204";

    if (schemaColumnError) {
        const conv = await getConversation(params.conversationId);
        const metadata = {
            ...(params.data ?? {}),
            tool_id: params.toolId ?? null,
            requires_approval: params.requiresApproval ?? false,
            approval_id: params.approvalId ?? null,
            error: params.error ?? false,
        };

        const legacy = await attempt({
            conversation_id: params.conversationId,
            organization_id: conv.organization_id,
            user_id: conv.user_id,
            role: params.role,
            content: params.content,
            metadata,
        });

        if (!legacy.error) return legacy.data as AIMessageRow;
        throw legacy.error;
    }

    throw result.error;
}

// ── Approvals ──────────────────────────────────────────────

export async function getApproval(approvalId: string) {
    const { data, error } = await supabase
        .from("ai_approvals")
        .select("*")
        .eq("id", approvalId)
        .single();

    if (error) throw error;
    return data as AIApprovalRow;
}

export async function getPendingApprovals(organizationId: string, limit = 20) {
    const { data, error } = await supabase
        .from("ai_approvals")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return (data ?? []) as AIApprovalRow[];
}

export async function getUserApprovals(userId: string, limit = 20) {
    const { data, error } = await supabase
        .from("ai_approvals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return (data ?? []) as AIApprovalRow[];
}

export async function createApproval(params: {
    organizationId: string;
    userId: string;
    conversationId?: string | null;
    messageId?: string | null;
    toolId?: string | null;
    title: string;
    description?: string | null;
    payload?: Record<string, unknown>;
}) {
    const { data, error } = await supabase
        .from("ai_approvals")
        .insert({
            organization_id: params.organizationId,
            user_id: params.userId,
            conversation_id: params.conversationId ?? null,
            message_id: params.messageId ?? null,
            tool_id: params.toolId ?? null,
            title: params.title,
            description: params.description ?? null,
            payload: params.payload ?? {},
        })
        .select("*")
        .single();

    if (error) throw error;
    return data as AIApprovalRow;
}

export async function reviewApproval(params: {
    approvalId: string;
    reviewerId: string;
    status: "approved" | "rejected";
    reviewNote?: string | null;
}) {
    const { data, error } = await supabase
        .from("ai_approvals")
        .update({
            status: params.status,
            reviewer_id: params.reviewerId,
            review_note: params.reviewNote ?? null,
            reviewed_at: new Date().toISOString(),
        })
        .eq("id", params.approvalId)
        .select("*")
        .single();

    if (error) throw error;
    return data as AIApprovalRow;
}

// ── History (recent assistant messages across conversations) ──

export async function getRecentOutputs(userId: string, limit = 10) {
    const conversations = await getConversations(userId, 100);
    const conversationMap = new Map<string, AIConversationSummary>(
        conversations.map((conv) => [
            conv.id,
            {
                id: conv.id,
                title: conv.title,
                tool_id: conv.tool_id,
                user_id: conv.user_id,
            },
        ]),
    );

    const conversationIds = conversations.map((conv) => conv.id);
    if (conversationIds.length === 0) return [];

    const { data, error } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("role", "assistant")
        .eq("error", false)
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw error;

    return ((data ?? []) as AIMessageRow[])
        .map((msg) => ({
            ...msg,
            conversation: conversationMap.get(msg.conversation_id) ?? null,
        }))
        .filter((msg) => msg.conversation?.user_id === userId);
}

export async function getHistoryItems(userId: string, limit = 20) {
    const conversations = await getConversations(userId, 100);
    const conversationMap = new Map<string, AIConversationSummary>(
        conversations.map((conv) => [
            conv.id,
            {
                id: conv.id,
                title: conv.title,
                tool_id: conv.tool_id,
                user_id: conv.user_id,
            },
        ]),
    );

    const conversationIds = conversations.map((conv) => conv.id);
    if (conversationIds.length === 0) return [];

    const { data, error } = await supabase
        .from("ai_messages")
        .select("*")
        .in("role", ["assistant", "system"])
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw error;

    return ((data ?? []) as AIMessageRow[])
        .map((msg) => ({
            ...msg,
            conversation: conversationMap.get(msg.conversation_id) ?? null,
        }))
        .filter((msg) => msg.conversation?.user_id === userId);
}

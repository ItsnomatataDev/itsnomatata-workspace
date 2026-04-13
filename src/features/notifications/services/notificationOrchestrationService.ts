import type { AppRole } from "../../../lib/constants/roles";
import { supabase } from "../../../lib/supabase/client";
import type {
    NotificationPriority,
    NotificationType,
} from "../../../lib/supabase/mutations/notifications";
import { sendBulkNotifications } from "./notificationService";

export type NotificationRecipient = {
    id: string;
    full_name: string | null;
    email: string | null;
    primary_role: AppRole | null;
    is_active: boolean;
};

export async function getOrganizationRecipients(params: {
    organizationId: string;
    roles?: AppRole[];
    includeInactive?: boolean;
}) {
    let query = supabase
        .from("profiles")
        .select("id, full_name, email, primary_role, is_active")
        .eq("organization_id", params.organizationId);

    if (!params.includeInactive) {
        query = query.eq("is_active", true);
    }

    if (params.roles && params.roles.length > 0) {
        query = query.in("primary_role", params.roles);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data ?? []) as NotificationRecipient[];
}

function uniqueIds(userIds: string[]) {
    return [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
}

export async function notifyUsers(params: {
    organizationId: string;
    userIds: string[];
    type: NotificationType;
    title: string;
    message?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    actionUrl?: string | null;
    priority?: NotificationPriority;
    metadata?: Record<string, unknown>;
    referenceId?: string | null;
    referenceType?: string | null;
    sendEmail?: boolean;
}) {
    const recipients = uniqueIds(params.userIds);
    if (recipients.length === 0) return [];

    return sendBulkNotifications({
        organizationId: params.organizationId,
        userIds: recipients,
        type: params.type,
        title: params.title,
        message: params.message,
        entityType: params.entityType,
        entityId: params.entityId,
        actionUrl: params.actionUrl,
        priority: params.priority,
        metadata: params.metadata,
        referenceId: params.referenceId,
        referenceType: params.referenceType,
        sendEmail: params.sendEmail,
    });
}

export async function notifyRoles(params: {
    organizationId: string;
    roles: AppRole[];
    type: NotificationType;
    title: string;
    message?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    actionUrl?: string | null;
    priority?: NotificationPriority;
    metadata?: Record<string, unknown>;
    referenceId?: string | null;
    referenceType?: string | null;
    sendEmail?: boolean;
}) {
    const recipients = await getOrganizationRecipients({
        organizationId: params.organizationId,
        roles: params.roles,
    });

    return notifyUsers({
        organizationId: params.organizationId,
        userIds: recipients.map((user) => user.id),
        type: params.type,
        title: params.title,
        message: params.message,
        entityType: params.entityType,
        entityId: params.entityId,
        actionUrl: params.actionUrl,
        priority: params.priority,
        metadata: {
            ...(params.metadata ?? {}),
            target_roles: params.roles,
        },
        referenceId: params.referenceId,
        referenceType: params.referenceType,
        sendEmail: params.sendEmail,
    });
}

export async function notifyOrganization(params: {
    organizationId: string;
    type: NotificationType;
    title: string;
    message?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    actionUrl?: string | null;
    priority?: NotificationPriority;
    metadata?: Record<string, unknown>;
    referenceId?: string | null;
    referenceType?: string | null;
    sendEmail?: boolean;
}) {
    const recipients = await getOrganizationRecipients({
        organizationId: params.organizationId,
    });

    return notifyUsers({
        organizationId: params.organizationId,
        userIds: recipients.map((user) => user.id),
        type: params.type,
        title: params.title,
        message: params.message,
        entityType: params.entityType,
        entityId: params.entityId,
        actionUrl: params.actionUrl,
        priority: params.priority,
        metadata: params.metadata,
        referenceId: params.referenceId,
        referenceType: params.referenceType,
        sendEmail: params.sendEmail,
    });
}

import type { AppRole } from "../../../lib/constants/roles";
import { supabase } from "../../../lib/supabase/client";
import type {
  NotificationPriority,
  NotificationType,
} from "../../../lib/supabase/mutations/notifications";
import {
  sendBulkNotifications,
  sendNotification,
} from "./notificationService";

export type NotificationRecipient = {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role: AppRole | null;
  is_active: boolean;
  department?: string | null;
};

type BaseNotifyParams = {
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
};

function uniqueIds(userIds: string[]) {
  return [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
}

function excludeActor(userIds: string[], actorUserId?: string | null) {
  if (!actorUserId) return uniqueIds(userIds);
  return uniqueIds(userIds).filter((id) => id !== actorUserId);
}

async function getProfileBasic(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, primary_role, department, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getLeaveTypeName(leaveTypeId?: string | null) {
  if (!leaveTypeId) return null;

  const { data, error } = await supabase
    .from("leave_types")
    .select("name")
    .eq("id", leaveTypeId)
    .maybeSingle();

  if (error) throw error;
  return data?.name ?? null;
}

async function getTaskDetails(taskId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, assigned_to, created_by, organization_id")
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getTaskWatcherIds(taskId: string) {
  const { data, error } = await supabase
    .from("task_watchers")
    .select("user_id")
    .eq("task_id", taskId);

  if (error) throw error;
  return (data ?? [])
    .map((row) => row.user_id as string | null)
    .filter(Boolean) as string[];
}

async function getMeetingParticipantIds(meetingId: string) {
  const { data, error } = await supabase
    .from("meeting_participants")
    .select("user_id")
    .eq("meeting_id", meetingId);

  if (error) throw error;
  return (data ?? [])
    .map((row) => row.user_id as string | null)
    .filter(Boolean) as string[];
}

export async function getOrganizationRecipients(params: {
  organizationId: string;
  roles?: AppRole[];
  includeInactive?: boolean;
}) {
  let query = supabase
    .from("profiles")
    .select("id, full_name, email, primary_role, is_active, department")
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

export async function getDepartmentRecipients(params: {
  organizationId: string;
  department: string;
  includeInactive?: boolean;
}) {
  let query = supabase
    .from("profiles")
    .select("id, full_name, email, primary_role, is_active, department")
    .eq("organization_id", params.organizationId)
    .eq("department", params.department);

  if (!params.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as NotificationRecipient[];
}

export async function notifyUser(
  params: BaseNotifyParams & {
    userId: string;
  },
) {
  return sendNotification({
    organizationId: params.organizationId,
    userId: params.userId,
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

export async function notifyUsers(
  params: BaseNotifyParams & {
    userIds: string[];
  },
) {
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

export async function notifyRoles(
  params: BaseNotifyParams & {
    roles: AppRole[];
  },
) {
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

export async function notifyDepartment(
  params: BaseNotifyParams & {
    department: string;
  },
) {
  const recipients = await getDepartmentRecipients({
    organizationId: params.organizationId,
    department: params.department,
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
      target_department: params.department,
    },
    referenceId: params.referenceId,
    referenceType: params.referenceType,
    sendEmail: params.sendEmail,
  });
}

export async function notifyOrganization(
  params: BaseNotifyParams,
) {
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

/* -------------------------------------------------------------------------- */
/*                            BUSINESS EVENT METHODS                           */
/* -------------------------------------------------------------------------- */

export async function notifyLeaveRequestSubmitted(params: {
  organizationId: string;
  leaveRequestId: string;
  requesterId: string;
  leaveTypeId?: string | null;
  startDate: string;
  endDate: string;
  office?: string | null;
  sendEmail?: boolean;
}) {
  const [requester, leaveTypeName] = await Promise.all([
    getProfileBasic(params.requesterId),
    getLeaveTypeName(params.leaveTypeId),
  ]);

  const requesterName = requester?.full_name?.trim() || "Unknown user";
  const requesterEmail = requester?.email?.trim() || "No email";
  const resolvedLeaveTypeName = leaveTypeName || "General Leave";
  const officeLabel = params.office?.trim() || "Unspecified office";

  return notifyRoles({
    organizationId: params.organizationId,
    roles: ["admin", "manager"],
    type: "leave_request_submitted",
    title: "New Leave Request Submitted",
    message: `${requesterName} (${requesterEmail}) requested ${resolvedLeaveTypeName} for ${officeLabel} from ${params.startDate} to ${params.endDate}.`,
    entityType: "leave_request",
    entityId: params.leaveRequestId,
    referenceId: params.leaveRequestId,
    referenceType: "leave_request",
    actionUrl: "/admin/leave",
    priority: "high",
    metadata: {
      leaveRequestId: params.leaveRequestId,
      requesterId: params.requesterId,
      requesterName,
      requesterEmail,
      leaveTypeName: resolvedLeaveTypeName,
      office: officeLabel,
      startDate: params.startDate,
      endDate: params.endDate,
    },
    sendEmail: params.sendEmail,
  });
}

export async function notifyLeaveRequestDecision(params: {
  organizationId: string;
  requesterId: string;
  leaveRequestId: string;
  status: "approved" | "rejected";
  leaveTypeId?: string | null;
  startDate: string;
  endDate: string;
  rejectionReason?: string | null;
  decidedByUserId?: string | null;
  sendEmail?: boolean;
}) {
  const leaveTypeName = (await getLeaveTypeName(params.leaveTypeId)) || "Leave";
  const approved = params.status === "approved";

  return notifyUser({
    organizationId: params.organizationId,
    userId: params.requesterId,
    type: approved ? "leave_request_approved" : "leave_request_rejected",
    title: approved ? "Leave request approved" : "Leave request rejected",
    message: approved
      ? `Your ${leaveTypeName} request from ${params.startDate} to ${params.endDate} was approved.`
      : `Your ${leaveTypeName} request from ${params.startDate} to ${params.endDate} was rejected.${params.rejectionReason ? ` Reason: ${params.rejectionReason}` : ""}`,
    entityType: "leave_request",
    entityId: params.leaveRequestId,
    referenceId: params.leaveRequestId,
    referenceType: "leave_request",
    actionUrl: "/leave",
    priority: approved ? "medium" : "high",
    metadata: {
      leaveRequestId: params.leaveRequestId,
      requesterId: params.requesterId,
      decidedByUserId: params.decidedByUserId ?? null,
      status: params.status,
      leaveTypeName,
      startDate: params.startDate,
      endDate: params.endDate,
      rejectionReason: params.rejectionReason ?? null,
    },
    sendEmail: params.sendEmail,
  });
}

export async function notifyTaskAssigned(params: {
  organizationId: string;
  userId: string;
  taskId: string;
  taskTitle?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  sendEmail?: boolean;
}) {
  const task = params.taskTitle ? null : await getTaskDetails(params.taskId);
  const taskTitle = params.taskTitle || task?.title || "Untitled task";

  return notifyUser({
    organizationId: params.organizationId,
    userId: params.userId,
    type: "task_assigned",
    title: "New task assigned",
    message: params.actorName
      ? `${params.actorName} assigned you to "${taskTitle}".`
      : `You were assigned to "${taskTitle}".`,
    entityType: "task",
    entityId: params.taskId,
    referenceId: params.taskId,
    referenceType: "task",
    actionUrl: `/tasks/${params.taskId}`,
    priority: "high",
    metadata: {
      taskId: params.taskId,
      taskTitle,
      actorUserId: params.actorUserId ?? null,
      actorName: params.actorName ?? null,
    },
    sendEmail: params.sendEmail,
  });
}

export async function notifyTaskCollaborators(params: {
  organizationId: string;
  userIds: string[];
  taskId: string;
  taskTitle?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  sendEmail?: boolean;
}) {
  const task = params.taskTitle ? null : await getTaskDetails(params.taskId);
  const taskTitle = params.taskTitle || task?.title || "Untitled task";

  const recipients = excludeActor(params.userIds, params.actorUserId);
  if (recipients.length === 0) return [];

  return notifyUsers({
    organizationId: params.organizationId,
    userIds: recipients,
    type: "task_collaboration_invite" as NotificationType,
    title: "Task collaboration invite",
    message: params.actorName
      ? `${params.actorName} invited you to collaborate on "${taskTitle}".`
      : `You were invited to collaborate on "${taskTitle}".`,
    entityType: "task",
    entityId: params.taskId,
    referenceId: params.taskId,
    referenceType: "task",
    actionUrl: `/tasks/${params.taskId}`,
    priority: "medium",
    metadata: {
      taskId: params.taskId,
      taskTitle,
      actorUserId: params.actorUserId ?? null,
      actorName: params.actorName ?? null,
    },
    sendEmail: params.sendEmail,
  });
}

export async function notifyTaskCommented(params: {
  organizationId: string;
  taskId: string;
  commentId?: string | null;
  authorUserId: string;
  authorName?: string | null;
  taskTitle?: string | null;
  extraUserIds?: string[];
  sendEmail?: boolean;
}) {
  const [task, watcherIds] = await Promise.all([
    params.taskTitle ? Promise.resolve(null) : getTaskDetails(params.taskId),
    getTaskWatcherIds(params.taskId),
  ]);

  const taskTitle = params.taskTitle || task?.title || "Untitled task";
  const recipients = excludeActor(
    [
      ...(task?.assigned_to ? [task.assigned_to] : []),
      ...(task?.created_by ? [task.created_by] : []),
      ...watcherIds,
      ...(params.extraUserIds ?? []),
    ],
    params.authorUserId,
  );

  if (recipients.length === 0) return [];

  return notifyUsers({
    organizationId: params.organizationId,
    userIds: recipients,
    type: "task_comment",
    title: "New task comment",
    message: `${params.authorName || "Someone"} commented on "${taskTitle}".`,
    entityType: "task",
    entityId: params.taskId,
    referenceId: params.taskId,
    referenceType: "task",
    actionUrl: `/tasks/${params.taskId}`,
    priority: "medium",
    metadata: {
      taskId: params.taskId,
      taskTitle,
      commentId: params.commentId ?? null,
      authorUserId: params.authorUserId,
      authorName: params.authorName || null,
    },
    sendEmail: params.sendEmail,
  });
}

export async function notifyMeetingScheduled(params: {
  organizationId: string;
  meetingId: string;
  title: string;
  scheduledStart?: string | null;
  participantUserIds?: string[];
  actorUserId?: string | null;
  actorName?: string | null;
  sendEmail?: boolean;
}) {
  const participantIds = params.participantUserIds?.length
    ? params.participantUserIds
    : await getMeetingParticipantIds(params.meetingId);

  const recipients = excludeActor(participantIds, params.actorUserId);
  if (recipients.length === 0) return [];

  return notifyUsers({
    organizationId: params.organizationId,
    userIds: recipients,
    type: "meeting",
    title: "New meeting scheduled",
    message: params.scheduledStart
      ? `${params.actorName || "A team member"} scheduled "${params.title}" for ${params.scheduledStart}.`
      : `${params.actorName || "A team member"} scheduled "${params.title}".`,
    entityType: "meeting",
    entityId: params.meetingId,
    referenceId: params.meetingId,
    referenceType: "meeting",
    actionUrl: `/meetings/${params.meetingId}`,
    priority: "high",
    metadata: {
      meetingId: params.meetingId,
      meetingTitle: params.title,
      scheduledStart: params.scheduledStart ?? null,
      actorUserId: params.actorUserId ?? null,
      actorName: params.actorName ?? null,
    },
    sendEmail: params.sendEmail,
  });
}

export async function notifyApprovalNeeded(params: {
  organizationId: string;
  approverUserIds: string[];
  approvalId: string;
  title: string;
  message?: string | null;
  actionUrl?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  sendEmail?: boolean;
}) {
  const recipients = excludeActor(params.approverUserIds, params.actorUserId);
  if (recipients.length === 0) return [];

  return notifyUsers({
    organizationId: params.organizationId,
    userIds: recipients,
    type: "approval_needed",
    title: params.title,
    message:
      params.message ||
      `${params.actorName || "A team member"} submitted an item for approval.`,
    entityType: "approval",
    entityId: params.approvalId,
    referenceId: params.approvalId,
    referenceType: "approval",
    actionUrl: params.actionUrl || "/approvals",
    priority: "high",
    metadata: {
      approvalId: params.approvalId,
      actorUserId: params.actorUserId ?? null,
      actorName: params.actorName ?? null,
    },
    sendEmail: params.sendEmail,
  });
}

export async function notifyApprovalDecision(params: {
  organizationId: string;
  requesterUserId: string;
  approvalId: string;
  decision: "approved" | "rejected";
  title?: string;
  message?: string | null;
  actionUrl?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  sendEmail?: boolean;
}) {
  return notifyUser({
    organizationId: params.organizationId,
    userId: params.requesterUserId,
    type: "approval_decision",
    title:
      params.title ||
      (params.decision === "approved"
        ? "Approval granted"
        : "Approval rejected"),
    message:
      params.message ||
      (params.decision === "approved"
        ? `${params.actorName || "An approver"} approved your request.`
        : `${params.actorName || "An approver"} rejected your request.`),
    entityType: "approval",
    entityId: params.approvalId,
    referenceId: params.approvalId,
    referenceType: "approval",
    actionUrl: params.actionUrl || "/approvals",
    priority: params.decision === "approved" ? "medium" : "high",
    metadata: {
      approvalId: params.approvalId,
      decision: params.decision,
      actorUserId: params.actorUserId ?? null,
      actorName: params.actorName ?? null,
    },
    sendEmail: params.sendEmail,
  });
}

export async function notifyAnnouncementPublished(params: {
  organizationId: string;
  announcementId: string;
  title: string;
  message?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  roles?: AppRole[];
  department?: string | null;
  sendEmail?: boolean;
}) {
  const payload: BaseNotifyParams = {
    organizationId: params.organizationId,
    type: "announcement",
    title: "New announcement",
    message:
      params.message ||
      `${params.actorName || "Management"} posted "${params.title}".`,
    entityType: "announcement",
    entityId: params.announcementId,
    referenceId: params.announcementId,
    referenceType: "announcement",
    actionUrl: "/announcements",
    priority: "medium",
    metadata: {
      announcementId: params.announcementId,
      announcementTitle: params.title,
      actorUserId: params.actorUserId ?? null,
      actorName: params.actorName ?? null,
    },
    sendEmail: params.sendEmail,
  };

  if (params.department) {
    return notifyDepartment({
      ...payload,
      department: params.department,
    });
  }

  if (params.roles && params.roles.length > 0) {
    return notifyRoles({
      ...payload,
      roles: params.roles,
    });
  }

  return notifyOrganization(payload);
}

export async function notifySystemAlert(params: {
  organizationId: string;
  title: string;
  message: string;
  entityId?: string | null;
  referenceId?: string | null;
  actionUrl?: string | null;
  roles?: AppRole[];
  sendEmail?: boolean;
}) {
  const payload: BaseNotifyParams = {
    organizationId: params.organizationId,
    type: "system_alert",
    title: params.title,
    message: params.message,
    entityType: "system_alert",
    entityId: params.entityId ?? null,
    referenceId: params.referenceId ?? null,
    referenceType: "system_alert",
    actionUrl: params.actionUrl || "/it/system-monitor",
    priority: "urgent",
    metadata: {
      alertTitle: params.title,
    },
    sendEmail: params.sendEmail,
  };

  if (params.roles && params.roles.length > 0) {
    return notifyRoles({
      ...payload,
      roles: params.roles,
    });
  }

  return notifyRoles({
    ...payload,
    roles: ["admin", "it", "manager"],
  });
}

export async function notifyAutomationFailed(params: {
  organizationId: string;
  runId: string;
  flowName: string;
  message?: string | null;
  actionUrl?: string | null;
  sendEmail?: boolean;
}) {
  return notifyRoles({
    organizationId: params.organizationId,
    roles: ["admin", "it"],
    type: "automation",
    title: "Automation run failed",
    message:
      params.message || `The automation flow "${params.flowName}" failed.`,
    entityType: "automation_run",
    entityId: params.runId,
    referenceId: params.runId,
    referenceType: "automation_run",
    actionUrl: params.actionUrl || "/automation/runs",
    priority: "urgent",
    metadata: {
      runId: params.runId,
      flowName: params.flowName,
      status: "failed",
    },
    sendEmail: params.sendEmail,
  });
}
import { notifyTaskAssigned as notifyTaskAssignedOrchestrated } from "../../notifications/services/notificationOrchestrationService";

export async function notifyTaskAssigned(params: {
  organizationId: string;
  userId: string;
  taskId: string;
  taskTitle: string;
  boardId?: string | null;
  actorUserId?: string | null;
}) {
  return notifyTaskAssignedOrchestrated({
    organizationId: params.organizationId,
    userId: params.userId,
    taskId: params.taskId,
    taskTitle: params.taskTitle,
    boardId: params.boardId,
    actorUserId: params.actorUserId,
  });
}

export { notifyTaskCollaborators } from "../../notifications/services/notificationOrchestrationService";

export { notifyTaskCommented as notifyTaskComment } from "../../notifications/services/notificationOrchestrationService";
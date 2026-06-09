import type { AiRouterContext, AiRouterToolId } from "../types/aiToolTypes";
import { searchAssetsFallback } from "./assetTools";
import { searchNotificationsFallback } from "./notificationTools";
import { listBoardsFallback, summarizeMyTasksFallback } from "./taskBoardTools";
import {
  getActiveTimersFallback,
  getAttendanceFallback,
  searchTimeEntriesFallback,
} from "./timeTrackingTools";

export async function runAiToolFallback(
  toolId: AiRouterToolId,
  context: AiRouterContext,
  payload: Record<string, unknown> = {},
) {
  switch (toolId) {
    case "summarize_my_tasks":
      return summarizeMyTasksFallback(context);
    case "list_boards":
      return listBoardsFallback(context);
    case "get_active_time_trackers":
      return getActiveTimersFallback(context);
    case "get_user_timesheet":
      return searchTimeEntriesFallback(
        context,
        typeof payload.daysBack === "number" ? payload.daysBack : 7,
      );
    case "get_attendance_summary":
      return getAttendanceFallback(context);
    case "search_notifications":
      return searchNotificationsFallback(context, {
        unreadOnly: payload.unreadOnly === true,
        limit: typeof payload.limit === "number" ? payload.limit : 15,
      });
    case "search_assets":
      return searchAssetsFallback(
        context,
        typeof payload.query === "string" ? payload.query : undefined,
      );
    default:
      throw new Error(`Unsupported fallback tool: ${toolId}`);
  }
}

export const READ_ONLY_AI_TOOLS: AiRouterToolId[] = [
  "summarize_my_tasks",
  "list_boards",
  "get_active_time_trackers",
  "get_user_timesheet",
  "get_attendance_summary",
  "search_notifications",
  "search_assets",
];

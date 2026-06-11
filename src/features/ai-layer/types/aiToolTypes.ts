export type AiRouterToolId =
  | "summarize_my_tasks"
  | "list_boards"
  | "create_board_card"
  | "start_time_tracker"
  | "stop_time_tracker"
  | "get_active_time_trackers"
  | "get_user_timesheet"
  | "get_attendance_summary"
  | "get_leave_balance"
  | "search_leave_requests"
  | "search_notifications"
  | "search_assets";

export type AiToolResult = {
  toolId: AiRouterToolId | null;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

export type AiRouterMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  toolId?: AiRouterToolId | null;
  data?: Record<string, unknown>;
  error?: boolean;
};

export type AiRouterContext = {
  userId: string;
  organizationId: string;
  role: string | null;
  fullName: string | null;
  department: string | null;
  currentRoute?: string | null;
  currentModule?: string | null;
};

export type AiRouterRequest = {
  message: string;
  conversationId?: string | null;
  context?: Partial<AiRouterContext>;
};

export type AiRouterResponse = {
  reply: string;
  conversationId: string;
  messageId: string;
  toolId?: AiRouterToolId | null;
  data?: Record<string, unknown>;
};

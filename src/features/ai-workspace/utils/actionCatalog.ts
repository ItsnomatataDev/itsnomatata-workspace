export type AIRole =
  | "admin"
  | "manager"
  | "it"
  | "social_media"
  | "media_team"
  | "seo_specialist"
  | "employee";

export type AIActionCategory =
  | "chat"
  | "tasks"
  | "projects"
  | "leave"
  | "reports"
  | "knowledge"
  | "media"
  | "audio"
  | "images"
  | "automation"
  | "admin";

export type AIActionInputType =
  | "none"
  | "text"
  | "document"
  | "image"
  | "audio"
  | "mixed"
  | "form";

export interface AIWorkspaceAction {
  id: string;
  label: string;
  description: string;
  category: AIActionCategory;
  icon: string;
  allowedRoles: AIRole[];
  inputType: AIActionInputType;
  requiresApproval: boolean;
  featured?: boolean;
}

export const AI_ACTION_CATALOG: AIWorkspaceAction[] = [
  {
    id: "ask_codex",
    label: "Ask Codex",
    description:
      "Ask a general workspace question using your role and current context.",
    category: "chat",
    icon: "MessageSquare",
    allowedRoles: [
      "admin",
      "manager",
      "it",
      "social_media",
      "media_team",
      "seo_specialist",
      "employee",
    ],
    inputType: "text",
    requiresApproval: false,
    featured: true,
  },
  {
    id: "summarize_my_tasks",
    label: "Summarize My Tasks",
    description:
      "Summarize open, overdue, and in-progress tasks for the current user.",
    category: "tasks",
    icon: "ListTodo",
    allowedRoles: [
      "admin",
      "manager",
      "it",
      "social_media",
      "media_team",
      "seo_specialist",
      "employee",
    ],
    inputType: "none",
    requiresApproval: false,
    featured: true,
  },
  {
    id: "create_task_draft",
    label: "Create Task Draft",
    description: "Draft a new task from a prompt, meeting note, or request.",
    category: "tasks",
    icon: "SquarePen",
    allowedRoles: ["admin", "manager", "it"],
    inputType: "mixed",
    requiresApproval: true,
    featured: true,
  },
  {
    id: "summarize_project",
    label: "Summarize Project",
    description: "Summarize project progress, blockers, and recent activity.",
    category: "projects",
    icon: "FolderKanban",
    allowedRoles: ["admin", "manager", "it"],
    inputType: "text",
    requiresApproval: false,
    featured: true,
  },
  {
    id: "check_leave_conflicts",
    label: "Check Leave Conflicts",
    description:
      "Check leave overlaps, blackout periods, and team availability.",
    category: "leave",
    icon: "CalendarRange",
    allowedRoles: ["admin", "manager"],
    inputType: "form",
    requiresApproval: false,
  },
  {
    id: "summarize_leave_status",
    label: "Summarize Leave Status",
    description: "Show who is on leave and highlight upcoming leave events.",
    category: "leave",
    icon: "CalendarDays",
    allowedRoles: ["admin", "manager", "employee"],
    inputType: "none",
    requiresApproval: false,
  },
  {
    id: "generate_weekly_report",
    label: "Generate Weekly Report",
    description:
      "Generate a weekly summary for tasks, projects, and team activity.",
    category: "reports",
    icon: "FileText",
    allowedRoles: ["admin", "manager", "it"],
    inputType: "form",
    requiresApproval: false,
    featured: true,
  },
  {
    id: "search_knowledge",
    label: "Search Knowledge Base",
    description: "Search company documents, notes, and saved knowledge.",
    category: "knowledge",
    icon: "Database",
    allowedRoles: [
      "admin",
      "manager",
      "it",
      "social_media",
      "media_team",
      "seo_specialist",
      "employee",
    ],
    inputType: "text",
    requiresApproval: false,
    featured: true,
  },
  {
    id: "summarize_document",
    label: "Summarize Document",
    description: "Summarize an uploaded document and extract action items.",
    category: "knowledge",
    icon: "FileSearch",
    allowedRoles: [
      "admin",
      "manager",
      "it",
      "social_media",
      "media_team",
      "seo_specialist",
      "employee",
    ],
    inputType: "document",
    requiresApproval: false,
    featured: true,
  },
  {
    id: "analyze_screenshot",
    label: "Analyze Screenshot",
    description:
      "Analyze a screenshot or image and explain visible issues or details.",
    category: "images",
    icon: "Image",
    allowedRoles: [
      "admin",
      "manager",
      "it",
      "social_media",
      "media_team",
      "seo_specialist",
      "employee",
    ],
    inputType: "image",
    requiresApproval: false,
    featured: true,
  },
  {
    id: "transcribe_audio",
    label: "Transcribe Audio",
    description:
      "Transcribe a voice note and extract decisions or action items.",
    category: "audio",
    icon: "Mic",
    allowedRoles: [
      "admin",
      "manager",
      "it",
      "social_media",
      "media_team",
      "seo_specialist",
      "employee",
    ],
    inputType: "audio",
    requiresApproval: false,
  },
  {
    id: "generate_image",
    label: "Generate Image",
    description:
      "Generate a visual from a prompt for marketing, design, or concept work.",
    category: "media",
    icon: "Sparkles",
    allowedRoles: [
      "admin",
      "manager",
      "social_media",
      "media_team",
      "seo_specialist",
    ],
    inputType: "text",
    requiresApproval: false,
  },
  {
    id: "generate_social_caption",
    label: "Generate Social Caption",
    description:
      "Generate social media captions from a brief, image, or campaign goal.",
    category: "media",
    icon: "PenLine",
    allowedRoles: ["social_media", "media_team", "manager"],
    inputType: "mixed",
    requiresApproval: false,
  },
  {
    id: "draft_announcement",
    label: "Draft Announcement",
    description: "Draft an internal announcement for the workspace or a team.",
    category: "admin",
    icon: "Megaphone",
    allowedRoles: ["admin", "manager"],
    inputType: "text",
    requiresApproval: true,
  },
  {
    id: "run_automation_flow",
    label: "Run Automation Flow",
    description: "Trigger an approved AI automation or workflow.",
    category: "automation",
    icon: "Workflow",
    allowedRoles: ["admin", "manager", "it"],
    inputType: "form",
    requiresApproval: true,
  },
];

export function getActionById(actionId: string): AIWorkspaceAction | undefined {
  return AI_ACTION_CATALOG.find((action) => action.id === actionId);
}

export function getFeaturedActions(): AIWorkspaceAction[] {
  return AI_ACTION_CATALOG.filter((action) => action.featured);
}

export function getActionsByCategory(
  category: AIActionCategory,
): AIWorkspaceAction[] {
  return AI_ACTION_CATALOG.filter((action) => action.category === category);
}

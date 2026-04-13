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

  // ── Admin-specific tools ─────────────────────────────────

  {
    id: "admin_team_overview",
    label: "Team Overview",
    description:
      "Get a full status overview of all team members — attendance, active tasks, leave, and utilization.",
    category: "admin",
    icon: "Users",
    allowedRoles: ["admin"],
    inputType: "none",
    requiresApproval: false,
    featured: true,
  },
  {
    id: "admin_org_health",
    label: "Organization Health Check",
    description:
      "Review org-wide metrics — overdue tasks, budget usage, pending approvals, and team workload balance.",
    category: "admin",
    icon: "Activity",
    allowedRoles: ["admin"],
    inputType: "none",
    requiresApproval: false,
  },
  {
    id: "admin_generate_payroll_summary",
    label: "Generate Payroll Summary",
    description:
      "Summarize hours tracked, overtime, leave deductions, and billable vs internal time for payroll prep.",
    category: "reports",
    icon: "DollarSign",
    allowedRoles: ["admin"],
    inputType: "form",
    requiresApproval: true,
  },
  {
    id: "admin_draft_policy",
    label: "Draft Policy Document",
    description:
      "Draft an internal company policy or update to an existing policy from a brief.",
    category: "knowledge",
    icon: "ScrollText",
    allowedRoles: ["admin"],
    inputType: "text",
    requiresApproval: true,
  },
  {
    id: "admin_onboarding_checklist",
    label: "Generate Onboarding Checklist",
    description:
      "Create a role-specific onboarding checklist for a new team member.",
    category: "tasks",
    icon: "ClipboardList",
    allowedRoles: ["admin"],
    inputType: "text",
    requiresApproval: false,
  },

  // ── Manager-specific tools ───────────────────────────────

  {
    id: "manager_team_workload",
    label: "Team Workload Analysis",
    description:
      "Analyze current team workload — who's overloaded, who has capacity, and where to redistribute.",
    category: "projects",
    icon: "BarChart3",
    allowedRoles: ["manager", "admin"],
    inputType: "none",
    requiresApproval: false,
    featured: true,
  },
  {
    id: "manager_sprint_summary",
    label: "Sprint / Week Summary",
    description:
      "Generate a sprint or weekly recap with completed, in-progress, and blocked tasks per team member.",
    category: "reports",
    icon: "CalendarCheck",
    allowedRoles: ["manager", "admin"],
    inputType: "form",
    requiresApproval: false,
  },
  {
    id: "manager_client_status_update",
    label: "Client Status Update",
    description:
      "Draft a professional client-facing status update from current project data.",
    category: "projects",
    icon: "Mail",
    allowedRoles: ["manager", "admin"],
    inputType: "text",
    requiresApproval: false,
  },
  {
    id: "manager_meeting_prep",
    label: "Meeting Prep Brief",
    description:
      "Prepare a quick briefing for an upcoming meeting — agenda items, blockers, and talking points.",
    category: "knowledge",
    icon: "Presentation",
    allowedRoles: ["manager", "admin"],
    inputType: "text",
    requiresApproval: false,
  },
  {
    id: "manager_reassign_tasks",
    label: "Suggest Task Reassignment",
    description:
      "Recommend task reassignments based on team capacity, skills, and deadlines.",
    category: "tasks",
    icon: "ArrowLeftRight",
    allowedRoles: ["manager", "admin"],
    inputType: "none",
    requiresApproval: true,
  },

  // ── Social Media-specific tools ──────────────────────────

  {
    id: "social_content_calendar",
    label: "Generate Content Calendar",
    description:
      "Draft a weekly or monthly social media content calendar with post ideas, themes, and scheduling.",
    category: "media",
    icon: "Calendar",
    allowedRoles: ["social_media", "manager"],
    inputType: "text",
    requiresApproval: false,
    featured: true,
  },
  {
    id: "social_hashtag_research",
    label: "Hashtag Research",
    description:
      "Suggest relevant hashtags for a post, campaign, or niche to maximize reach and engagement.",
    category: "media",
    icon: "Hash",
    allowedRoles: ["social_media", "media_team", "seo_specialist"],
    inputType: "text",
    requiresApproval: false,
  },
  {
    id: "social_engagement_reply",
    label: "Draft Engagement Replies",
    description:
      "Generate professional, on-brand replies to comments, mentions, or DMs.",
    category: "media",
    icon: "MessageCircle",
    allowedRoles: ["social_media", "media_team"],
    inputType: "text",
    requiresApproval: false,
  },
  {
    id: "social_post_repurpose",
    label: "Repurpose Content",
    description:
      "Transform a blog post, article, or long content into short social media posts for multiple platforms.",
    category: "media",
    icon: "Repeat2",
    allowedRoles: ["social_media", "media_team", "seo_specialist"],
    inputType: "mixed",
    requiresApproval: false,
  },
  {
    id: "social_campaign_brief",
    label: "Draft Campaign Brief",
    description:
      "Create a campaign brief with objectives, target audience, key messages, and posting schedule.",
    category: "media",
    icon: "Target",
    allowedRoles: ["social_media", "manager"],
    inputType: "text",
    requiresApproval: false,
  },

  // ── Media Team-specific tools ────────────────────────────

  {
    id: "media_creative_brief",
    label: "Generate Creative Brief",
    description:
      "Create a creative brief for a design or video project — objectives, style guide, deliverables, and deadlines.",
    category: "media",
    icon: "Palette",
    allowedRoles: ["media_team", "manager"],
    inputType: "text",
    requiresApproval: false,
    featured: true,
  },
  {
    id: "media_video_script",
    label: "Draft Video Script",
    description:
      "Write a video script with intro, body, CTA, and timing cues from a topic or brief.",
    category: "media",
    icon: "Film",
    allowedRoles: ["media_team", "social_media"],
    inputType: "text",
    requiresApproval: false,
  },
  {
    id: "media_design_feedback",
    label: "Review Design Feedback",
    description:
      "Summarize design feedback from a document, screenshot, or discussion and create action items.",
    category: "media",
    icon: "MessageSquareText",
    allowedRoles: ["media_team", "manager"],
    inputType: "mixed",
    requiresApproval: false,
  },
  {
    id: "media_asset_naming",
    label: "Asset Naming Convention",
    description:
      "Generate consistent file naming and folder structure for a media project or campaign.",
    category: "media",
    icon: "FolderTree",
    allowedRoles: ["media_team", "social_media"],
    inputType: "text",
    requiresApproval: false,
  },

  // ── SEO Specialist-specific tools ────────────────────────

  {
    id: "seo_keyword_research",
    label: "Keyword Research",
    description:
      "Research and suggest target keywords, long-tails, and related terms for a topic or page.",
    category: "knowledge",
    icon: "Search",
    allowedRoles: ["seo_specialist", "social_media"],
    inputType: "text",
    requiresApproval: false,
    featured: true,
  },
  {
    id: "seo_meta_tags",
    label: "Generate Meta Tags",
    description:
      "Write SEO-optimized title tags, meta descriptions, and OG tags for a page or post.",
    category: "knowledge",
    icon: "Code",
    allowedRoles: ["seo_specialist", "social_media"],
    inputType: "text",
    requiresApproval: false,
  },
  {
    id: "seo_content_audit",
    label: "Content SEO Audit",
    description:
      "Audit a page or article for SEO issues — keyword density, readability, headings, and internal links.",
    category: "knowledge",
    icon: "FileSearch2",
    allowedRoles: ["seo_specialist"],
    inputType: "mixed",
    requiresApproval: false,
  },
  {
    id: "seo_blog_outline",
    label: "Blog Post Outline",
    description:
      "Generate an SEO-friendly blog post outline with headings, keywords, and content suggestions.",
    category: "knowledge",
    icon: "List",
    allowedRoles: ["seo_specialist", "social_media", "media_team"],
    inputType: "text",
    requiresApproval: false,
  },
  {
    id: "seo_competitor_brief",
    label: "Competitor Analysis Brief",
    description:
      "Draft a competitive content analysis for a keyword or topic — what competitors cover and gaps to target.",
    category: "reports",
    icon: "TrendingUp",
    allowedRoles: ["seo_specialist", "manager"],
    inputType: "text",
    requiresApproval: false,
  },

  // ── IT-specific tools ────────────────────────────────────

  {
    id: "it_system_health",
    label: "System Health Summary",
    description:
      "Summarize system health — uptime, error rates, recent deployments, and active alerts.",
    category: "automation",
    icon: "Server",
    allowedRoles: ["it", "admin"],
    inputType: "none",
    requiresApproval: false,
    featured: true,
  },
  {
    id: "it_incident_report",
    label: "Draft Incident Report",
    description:
      "Generate an incident report from a description — timeline, root cause, impact, and remediation steps.",
    category: "automation",
    icon: "AlertTriangle",
    allowedRoles: ["it"],
    inputType: "text",
    requiresApproval: false,
  },
  {
    id: "it_code_review_summary",
    label: "Code Review Summary",
    description:
      "Summarize code changes, highlight potential issues, and suggest improvements from a PR description.",
    category: "automation",
    icon: "GitPullRequest",
    allowedRoles: ["it"],
    inputType: "text",
    requiresApproval: false,
  },
  {
    id: "it_deploy_checklist",
    label: "Deployment Checklist",
    description:
      "Generate a pre-deployment checklist for a release — tests, migrations, env vars, and rollback plan.",
    category: "automation",
    icon: "Rocket",
    allowedRoles: ["it"],
    inputType: "text",
    requiresApproval: false,
  },
  {
    id: "it_troubleshoot",
    label: "Troubleshoot Issue",
    description:
      "Help diagnose a technical issue from error logs, screenshots, or descriptions.",
    category: "automation",
    icon: "Bug",
    allowedRoles: ["it"],
    inputType: "mixed",
    requiresApproval: false,
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

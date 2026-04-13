import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Types ──────────────────────────────────────────────────

interface AIRequestBody {
    action?: string;
    chatInput?: string;
    sessionId?: string;
    message?: string;
    context?: {
        userId?: string;
        organizationId?: string;
        role?: string;
        fullName?: string;
        department?: string;
        currentModule?: string;
        currentRoute?: string;
        channel?: string;
        timezone?: string;
    };
    actionId?: string;
    attachments?: Array<{
        name?: string;
        type?: string;
        url?: string;
        mimeType?: string;
        textContent?: string;
    }>;
    metadata?: Record<string, unknown>;
}

// ── CORS ───────────────────────────────────────────────────

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
    });
}

// ── OpenAI helper ──────────────────────────────────────────

async function callOpenAI(
    systemPrompt: string,
    userMessage: string,
    model = "gpt-4o-mini",
): Promise<string> {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured.");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            temperature: 0.7,
            max_tokens: 2048,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "No response generated.";
}

// ── System prompt builder ──────────────────────────────────

function getRoleSystemContext(role?: string): string {
    const rolePrompts: Record<string, string> = {
        admin: [
            "You are assisting an ADMIN user who manages the entire organization.",
            "They handle team oversight, payroll, policies, onboarding/offboarding, leave management, budgets, and company-wide operations.",
            "Focus on organizational health, team utilization, approvals, compliance, and strategic decision support.",
            "They can see all data across the organization including all employees, projects, and financials.",
        ].join("\n"),

        manager: [
            "You are assisting a MANAGER who leads a team or department.",
            "They handle project oversight, team workload balancing, sprint planning, client communication, and task delegation.",
            "Focus on team productivity, project status, blockers, deadline tracking, and client-facing updates.",
            "Help them make decisions about task assignment, resource allocation, and progress reporting.",
        ].join("\n"),

        social_media: [
            "You are assisting a SOCIAL MEDIA specialist who manages the company's social media presence.",
            "They create social media posts, captions, content calendars, hashtag strategies, and engagement replies.",
            "Focus on content creation, platform-specific best practices, audience engagement, campaign planning, and scheduling.",
            "Use a creative, on-brand tone. Provide multiple variants when creating captions or posts.",
            "Be familiar with Instagram, Twitter/X, LinkedIn, Facebook, TikTok, and YouTube content formats.",
        ].join("\n"),

        media_team: [
            "You are assisting a MEDIA TEAM member (designer, videographer, or creative).",
            "They handle visual content, creative briefs, video scripts, design projects, and asset management.",
            "Focus on creative workflows, project briefs, design feedback, brand consistency, and production timelines.",
            "Help with naming conventions, folder structures, script drafts, and creative direction summaries.",
        ].join("\n"),

        seo_specialist: [
            "You are assisting an SEO SPECIALIST who optimizes content and web presence.",
            "They handle keyword research, meta tags, content audits, blog outlines, competitor analysis, and search rankings.",
            "Focus on search optimization, keyword targeting, content structure, link strategy, and SERP performance.",
            "Provide data-driven suggestions. Reference SEO best practices from Google's guidelines.",
            "Be specific about keyword placement, heading structure, internal linking, and readability scores.",
        ].join("\n"),

        it: [
            "You are assisting an IT team member who manages technical infrastructure and development.",
            "They handle system monitoring, deployments, incident response, code reviews, troubleshooting, and automation.",
            "Focus on technical accuracy, system health, error diagnosis, deployment safety, and workflow automation.",
            "Use technical language appropriate for developers. Include code examples or log analysis when relevant.",
            "Help with incident reports, deployment checklists, debugging, and architecture decisions.",
        ].join("\n"),

        employee: [
            "You are assisting a general EMPLOYEE in the workspace.",
            "They handle their own tasks, time tracking, leave requests, and general workspace queries.",
            "Focus on personal productivity, task management, finding information, and workspace navigation.",
        ].join("\n"),
    };

    return rolePrompts[role ?? "employee"] ?? rolePrompts.employee;
}

function buildSystemPrompt(context?: AIRequestBody["context"]): string {
    const parts = [
        "You are an intelligent workspace assistant for a business management platform (ITsNomatata).",
        "Be concise, operational, and action-oriented. Use bullet points where helpful.",
        "Never make up data — if you do not have information, say so clearly.",
        "Format your responses with markdown when appropriate (bold, bullets, headers).",
        "",
        getRoleSystemContext(context?.role),
    ];

    if (context?.fullName) {
        parts.push(`\nThe user's name is: ${context.fullName}.`);
    }
    if (context?.department) {
        parts.push(`Department: ${context.department}.`);
    }
    if (context?.currentModule) {
        parts.push(
            `They are currently in the ${context.currentModule} module.`,
        );
    }

    return parts.join("\n");
}

// ── Action router ──────────────────────────────────────────

function getActionSystemPrompt(actionId: string): string {
    const prompts: Record<string, string> = {
        // ── General tools ──────────────────────────────────
        summarize_my_tasks:
            "Summarize the user's pending and overdue tasks. Group by priority and suggest what to focus on first.",
        create_task_draft:
            "Draft a new task based on the user's description. Include a suggested title, description, priority, and assignee if mentioned.",
        summarize_project:
            "Summarize the described project including progress, blockers, recent activity, and recommended next steps.",
        check_leave_conflicts:
            "Check for leave conflicts and overlaps. Identify any blackout periods or team availability issues.",
        summarize_leave_status:
            "Summarize current leave status across the team. Show who is on leave, upcoming leave, and any coverage gaps.",
        generate_weekly_report:
            "Generate a concise weekly report covering completed work, ongoing items, blockers, and planned next steps.",
        search_knowledge:
            "Search the knowledge base for relevant information. Return the most relevant findings with source references.",
        summarize_document:
            "Summarize the submitted document. Extract key points, action items, and important decisions.",
        analyze_screenshot:
            "Analyze the described screenshot or image. Identify visible issues, UI elements, or important details.",
        transcribe_audio:
            "Transcribe the described audio. Summarize key points, decisions made, and any action items.",
        generate_image:
            "Generate an image description based on the prompt. Describe what the generated image would look like in detail.",
        generate_social_caption:
            "Generate engaging social media captions. Provide 3 variants: professional, casual, and creative. Include relevant hashtags.",
        draft_announcement:
            "Draft a professional internal announcement. Keep it clear, concise, and include any required action from readers.",
        run_automation_flow:
            "Describe the automation flow to be triggered and confirm the parameters. List the expected steps and outcomes.",
        dashboard_summary:
            "Generate a short operational dashboard summary. Include key metrics, pending items, and recommended actions. Return 3-5 suggested follow-up prompts.",
        it_workspace_summary:
            "Generate an IT workspace summary. Cover active projects, system health, workflow issues, and recommended priorities.",

        // ── Admin tools ────────────────────────────────────
        admin_team_overview:
            "Provide a comprehensive team overview. Cover each team member's status: attendance today, active task count, leave status, recent activity, and utilization rate. Flag anyone who is overloaded or idle.",
        admin_org_health:
            "Generate an organization health check. Cover: total overdue tasks, budget utilization, pending approvals backlog, average team workload, upcoming deadlines, and flagged risks. Provide actionable recommendations.",
        admin_generate_payroll_summary:
            "Generate a payroll preparation summary. Cover: total hours tracked per employee, overtime hours, leave deductions, billable vs internal time split, and any discrepancies. Format as a clean table.",
        admin_draft_policy:
            "Draft a professional internal policy document. Include: policy title, purpose, scope, definitions, policy statement, procedures, compliance requirements, and effective date. Use formal language.",
        admin_onboarding_checklist:
            "Create a comprehensive onboarding checklist for the described role. Include: pre-arrival setup (accounts, hardware), day-one tasks, first-week goals, training schedule, key contacts, and 30/60/90-day milestones.",

        // ── Manager tools ──────────────────────────────────
        manager_team_workload:
            "Analyze team workload distribution. For each team member show: assigned tasks, estimated hours, capacity remaining, and risk level (overloaded/balanced/underutilized). Recommend specific task redistribution actions.",
        manager_sprint_summary:
            "Generate a sprint/weekly summary. Cover: completed tasks per person, in-progress work, blocked items, velocity trend, and carry-over items. Include highlights and concerns sections.",
        manager_client_status_update:
            "Draft a professional client-facing status update email. Include: project progress summary, completed milestones, current focus areas, upcoming deliverables, any risks or timeline changes, and next steps. Use a confident, professional tone.",
        manager_meeting_prep:
            "Prepare a meeting briefing document. Include: meeting objective, agenda items with time allocations, key discussion points, current blockers to address, decision items needed, and pre-read materials. Keep it scannable.",
        manager_reassign_tasks:
            "Suggest task reassignments based on team capacity and deadlines. For each suggestion show: task, current assignee, recommended assignee, reason, and expected impact. Prioritize urgent and blocked items.",

        // ── Social Media tools ─────────────────────────────
        social_content_calendar:
            "Create a social media content calendar. For each day include: platform, post type (carousel, reel, story, text), topic/theme, caption draft, best posting time, and hashtag suggestions. Organize by week.",
        social_hashtag_research:
            "Research and suggest hashtags. Provide: 10 high-volume hashtags, 10 mid-range niche hashtags, 5 branded/unique hashtags. Group by reach potential (high/medium/niche). Include estimated reach where possible.",
        social_engagement_reply:
            "Draft professional, on-brand engagement replies. Provide 3 variants for each: friendly, professional, and witty. Keep replies conversational and authentic. Match the brand voice.",
        social_post_repurpose:
            "Repurpose the content into social media posts. Create versions for: Instagram (carousel + caption), Twitter/X (thread), LinkedIn (professional post), and Facebook. Adapt tone and format for each platform.",
        social_campaign_brief:
            "Create a campaign brief. Include: campaign name, objective, target audience, key messages, content pillars, posting schedule, platform strategy, success metrics (KPIs), and budget allocation if applicable.",

        // ── Media Team tools ───────────────────────────────
        media_creative_brief:
            "Generate a creative brief. Include: project title, objective, target audience, key message, brand guidelines to follow, deliverables list, dimensions/formats needed, style references, timeline, and approval workflow.",
        media_video_script:
            "Draft a video script. Include: hook (first 3 seconds), intro, main content sections with timing cues, b-roll suggestions, on-screen text overlays, voiceover notes, call-to-action, and total estimated duration.",
        media_design_feedback:
            "Summarize the design feedback into actionable items. For each item include: what to change, priority (critical/important/nice-to-have), reference to the specific element, and the desired outcome. Organize by section.",
        media_asset_naming:
            "Generate a file naming convention and folder structure. Include: naming pattern with examples, folder hierarchy, version numbering system, and archive strategy. Make it consistent and scalable.",

        // ── SEO Specialist tools ───────────────────────────
        seo_keyword_research:
            "Conduct keyword research for the topic. Provide: primary keyword, 10+ secondary keywords, long-tail variations, search intent classification (informational/transactional/navigational), and suggested content angle for each.",
        seo_meta_tags:
            "Write SEO-optimized meta tags. Provide: title tag (50-60 chars), meta description (150-160 chars), OG title, OG description, canonical URL suggestion, and structured data recommendations. Include the target keyword naturally.",
        seo_content_audit:
            "Audit the content for SEO. Check: keyword density, heading structure (H1-H4), readability score, internal linking opportunities, image alt tags, meta tags quality, content length, and mobile-friendliness suggestions. Score each area.",
        seo_blog_outline:
            "Create an SEO-optimized blog outline. Include: title options (3), target keyword placement, H2/H3 structure, word count target per section, internal linking opportunities, FAQ section suggestions, and featured snippet optimization.",
        seo_competitor_brief:
            "Create a competitive content analysis. Cover: top 5 ranking pages for the keyword, their content structure, word count, unique angles, backlink profile summary, content gaps you can exploit, and recommended differentiation strategy.",

        // ── IT tools ───────────────────────────────────────
        it_system_health:
            "Generate a system health summary. Cover: uptime status, recent deployments, error rates, active alerts/incidents, performance metrics (response times, CPU/memory), pending maintenance, and recommended actions.",
        it_incident_report:
            "Draft an incident report. Include: incident ID, severity level, timeline (detection → response → resolution), root cause analysis, impacted systems/users, remediation steps taken, prevention measures, and follow-up actions.",
        it_code_review_summary:
            "Summarize the code changes. Cover: what changed and why, files affected, potential breaking changes, test coverage assessment, security concerns, performance implications, and specific improvement suggestions.",
        it_deploy_checklist:
            "Generate a deployment checklist. Include: pre-deploy (tests, code freeze, DB migrations, env vars), deploy steps (order of operations), post-deploy (smoke tests, monitoring, rollback criteria), and communication plan.",
        it_troubleshoot:
            "Help diagnose the technical issue. Analyze the provided information, identify likely causes (ranked by probability), suggest diagnostic steps to confirm, provide a resolution path for each, and list preventive measures.",
    };

    return prompts[actionId] ?? "Help the user with their workspace request.";
}

// ── Persistence helpers ────────────────────────────────────

function getSupabaseClient() {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return null;
    return createClient(url, key);
}

async function persistConversation(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    organizationId: string,
    title: string,
    toolId?: string | null,
) {
    try {
        const { data } = await supabase
            .from("ai_conversations")
            .insert({
                user_id: userId,
                organization_id: organizationId,
                title,
                tool_id: toolId ?? null,
                metadata: {},
            })
            .select("id")
            .single();
        return data?.id ?? null;
    } catch {
        return null;
    }
}

async function persistMessage(
    supabase: ReturnType<typeof createClient>,
    conversationId: string,
    role: "user" | "assistant",
    content: string,
    extra?: {
        type?: string;
        toolId?: string | null;
        data?: Record<string, unknown>;
        error?: boolean;
        requiresApproval?: boolean;
    },
) {
    try {
        await supabase.from("ai_messages").insert({
            conversation_id: conversationId,
            role,
            content,
            type: extra?.type ?? "text",
            tool_id: extra?.toolId ?? null,
            data: extra?.data ?? {},
            sources: [],
            actions: [],
            requires_approval: extra?.requiresApproval ?? false,
            error: extra?.error ?? false,
        });
    } catch {
        // Non-critical — don't break the response
    }
}

async function createApprovalRecord(
    supabase: ReturnType<typeof createClient>,
    params: {
        organizationId: string;
        userId: string;
        conversationId: string;
        toolId: string;
        title: string;
        description: string;
        payload: Record<string, unknown>;
    },
): Promise<string | null> {
    try {
        const { data } = await supabase
            .from("ai_approvals")
            .insert({
                organization_id: params.organizationId,
                user_id: params.userId,
                conversation_id: params.conversationId,
                tool_id: params.toolId,
                title: params.title,
                description: params.description,
                payload: params.payload,
                status: "pending",
            })
            .select("id")
            .single();
        return data?.id ?? null;
    } catch {
        return null;
    }
}

// ── Request handler ────────────────────────────────────────

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
        const body = (await req.json().catch(() => ({}))) as AIRequestBody;

        // Extract the user message from either chatInput or message field
        const userMessage = body.chatInput ?? body.message ??
            body.metadata?.prompt as string ?? "";

        if (!userMessage && body.action !== "sendMessage") {
            return jsonResponse(
                { error: "No message or chatInput provided." },
                400,
            );
        }

        // Parse context from the chatInput if it contains [Context] blocks
        const context = body.context ?? {};
        const actionId = body.actionId ??
            (body.metadata?.actionId as string) ??
            extractActionFromMessage(userMessage);

        const systemPrompt = actionId
            ? `${buildSystemPrompt(context)}\n\n${
                getActionSystemPrompt(actionId)
            }`
            : buildSystemPrompt(context);

        // Check if OpenAI is available
        const hasOpenAI = Boolean(Deno.env.get("OPENAI_API_KEY"));

        let reply: string;
        let responseType: string = "text";
        let requiresApproval = false;

        if (hasOpenAI) {
            reply = await callOpenAI(systemPrompt, userMessage);
        } else {
            // Fallback: echo-style response with useful context
            reply = buildFallbackResponse(actionId, userMessage, context);
        }

        // Check if action requires approval
        const approvalActions = [
            "create_task_draft",
            "draft_announcement",
            "run_automation_flow",
            "admin_generate_payroll_summary",
            "admin_draft_policy",
            "manager_reassign_tasks",
        ];
        if (actionId && approvalActions.includes(actionId)) {
            requiresApproval = true;
            responseType = "approval_request";
        }

        // Persist to database if possible
        const supabase = getSupabaseClient();
        let conversationId: string | null = body.sessionId ?? null;
        let approvalId: string | null = null;

        if (supabase && context.userId && context.organizationId) {
            // Create conversation if none exists
            if (!conversationId) {
                conversationId = await persistConversation(
                    supabase,
                    context.userId,
                    context.organizationId,
                    actionId
                        ? actionId.replace(/_/g, " ")
                        : userMessage.slice(0, 80),
                    actionId ?? null,
                );
            }

            if (conversationId) {
                await persistMessage(
                    supabase,
                    conversationId,
                    "user",
                    userMessage,
                    {
                        toolId: actionId ?? null,
                    },
                );

                await persistMessage(
                    supabase,
                    conversationId,
                    "assistant",
                    reply,
                    {
                        type: responseType,
                        toolId: actionId ?? null,
                        requiresApproval,
                    },
                );

                // Create approval record
                if (requiresApproval) {
                    approvalId = await createApprovalRecord(supabase, {
                        organizationId: context.organizationId,
                        userId: context.userId,
                        conversationId,
                        toolId: actionId!,
                        title: actionId!.replace(/_/g, " "),
                        description: reply.slice(0, 500),
                        payload: {
                            actionId,
                            prompt: userMessage,
                            response: reply,
                        },
                    });
                }
            }

            // Log to audit trail
            try {
                await supabase.from("ai_audit_logs").insert({
                    organization_id: context.organizationId,
                    user_id: context.userId,
                    action: actionId ?? "chat",
                    status: "success",
                    request_payload: { message: userMessage, actionId },
                    response_payload: {
                        type: responseType,
                        length: reply.length,
                    },
                });
            } catch {
                // Non-critical
            }
        }

        return jsonResponse({
            success: true,
            output: reply,
            message: reply,
            type: responseType,
            conversationId,
            requestId: crypto.randomUUID(),
            requiresApproval,
            approvalId,
            data: {
                actionId: actionId ?? null,
                model: hasOpenAI ? "gpt-4o-mini" : "fallback",
            },
            actions: [],
            sources: [],
        });
    } catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Unknown error occurred.";
        return jsonResponse(
            {
                success: false,
                type: "error",
                message,
                output: message,
            },
            500,
        );
    }
});

// ── Helpers ────────────────────────────────────────────────

function extractActionFromMessage(message: string): string | null {
    const actionMatch = message.match(/\[Action:\s*([^\]]+)\]/i);
    if (actionMatch) {
        return actionMatch[1]
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_");
    }

    const knownActions = [
        // General
        "summarize_my_tasks",
        "create_task_draft",
        "summarize_project",
        "check_leave_conflicts",
        "summarize_leave_status",
        "generate_weekly_report",
        "search_knowledge",
        "summarize_document",
        "analyze_screenshot",
        "transcribe_audio",
        "generate_image",
        "generate_social_caption",
        "draft_announcement",
        "run_automation_flow",
        // Admin
        "admin_team_overview",
        "admin_org_health",
        "admin_generate_payroll_summary",
        "admin_draft_policy",
        "admin_onboarding_checklist",
        // Manager
        "manager_team_workload",
        "manager_sprint_summary",
        "manager_client_status_update",
        "manager_meeting_prep",
        "manager_reassign_tasks",
        // Social Media
        "social_content_calendar",
        "social_hashtag_research",
        "social_engagement_reply",
        "social_post_repurpose",
        "social_campaign_brief",
        // Media Team
        "media_creative_brief",
        "media_video_script",
        "media_design_feedback",
        "media_asset_naming",
        // SEO
        "seo_keyword_research",
        "seo_meta_tags",
        "seo_content_audit",
        "seo_blog_outline",
        "seo_competitor_brief",
        // IT
        "it_system_health",
        "it_incident_report",
        "it_code_review_summary",
        "it_deploy_checklist",
        "it_troubleshoot",
    ];

    for (const action of knownActions) {
        if (message.toLowerCase().includes(action.replace(/_/g, " "))) {
            return action;
        }
    }

    if (/dashboard.?summary/i.test(message)) return "dashboard_summary";
    if (/it.?workspace.?summary/i.test(message)) return "it_workspace_summary";

    return null;
}

function buildFallbackResponse(
    actionId: string | null,
    message: string,
    context: AIRequestBody["context"],
): string {
    const role = context?.role ?? "employee";
    const roleLabel = role.replace(/_/g, " ");
    const name = context?.fullName ?? "there";

    // Role-specific dashboard summaries
    if (actionId === "dashboard_summary") {
        const roleSummaries: Record<string, string> = {
            admin: `Hi ${name}, here's your admin dashboard summary:\n\n` +
                "• **Team status** — Review attendance, active tasks, and who's on leave today\n" +
                "• **Pending approvals** — Check payroll, leave, and AI action approvals\n" +
                "• **Organization health** — Monitor overdue tasks and budget utilization\n" +
                "• **Onboarding** — Follow up on any new hire onboarding progress\n\n" +
                "Set OPENAI_API_KEY for personalized, data-driven admin summaries.",
            manager: `Hi ${name}, here's your manager dashboard summary:\n\n` +
                "• **Team workload** — Check who's overloaded and who has capacity\n" +
                "• **Sprint progress** — Review completed vs remaining items this week\n" +
                "• **Client updates** — Prepare status updates for active clients\n" +
                "• **Blockers** — Address blocked tasks and reassign if needed\n\n" +
                "Set OPENAI_API_KEY for live team analytics.",
            social_media:
                `Hi ${name}, here's your social media dashboard:\n\n` +
                "• **Content calendar** — Check today's scheduled posts\n" +
                "• **Engagement** — Review recent comments and DMs needing replies\n" +
                "• **Campaigns** — Check active campaign performance\n" +
                "• **Content ideas** — Draft posts for upcoming themes\n\n" +
                "Set OPENAI_API_KEY for AI-generated content suggestions.",
            media_team: `Hi ${name}, here's your media team dashboard:\n\n` +
                "• **Active projects** — Check current design/video deliverables\n" +
                "• **Feedback pending** — Review any design feedback awaiting action\n" +
                "• **Briefs** — Check new creative briefs assigned\n" +
                "• **Assets** — Organize and archive completed deliverables\n\n" +
                "Set OPENAI_API_KEY for creative workflow intelligence.",
            seo_specialist: `Hi ${name}, here's your SEO dashboard:\n\n` +
                "• **Rankings** — Monitor keyword position changes\n" +
                "• **Content pipeline** — Check blog posts pending optimization\n" +
                "• **Technical SEO** — Review any site health issues\n" +
                "• **Competitor moves** — Track new competitor content\n\n" +
                "Set OPENAI_API_KEY for automated SEO insights.",
            it: `Hi ${name}, here's your IT dashboard:\n\n` +
                "• **System health** — Check uptime and error rates\n" +
                "• **Open issues** — Review unresolved bugs and incidents\n" +
                "• **Deployments** — Check recent and upcoming releases\n" +
                "• **Automation** — Review workflow status and failed runs\n\n" +
                "Set OPENAI_API_KEY for intelligent system monitoring.",
        };

        return roleSummaries[role] ??
            `Hi ${name}, here's your ${roleLabel} dashboard summary:\n\n` +
                "• Review your open and overdue tasks first\n" +
                "• Check pending approvals and team notifications\n" +
                "• Follow up on blockers and ownership gaps\n\n" +
                "Set OPENAI_API_KEY for personalized summaries.";
    }

    if (actionId === "summarize_my_tasks") {
        return `Task summary for ${name} (${roleLabel}):\n\n` +
            "• **Open tasks** — check your task board for current assignments\n" +
            "• **Overdue items** — review items past their due date\n" +
            "• **Priority focus** — start with high-priority blocked items\n\n" +
            "Set OPENAI_API_KEY for AI-powered task analysis.";
    }

    if (actionId) {
        const actionLabel = actionId.replace(/_/g, " ");
        return `**${actionLabel}** received for ${roleLabel} role.\n\n` +
            `Request: ${message.slice(0, 300)}\n\n` +
            "The AI workspace is running — set OPENAI_API_KEY for intelligent responses.";
    }

    return `Hi ${name} (${roleLabel}), I received your message:\n\n"${
        message.slice(0, 300)
    }"\n\n` +
        "I'm your workspace AI assistant. Set OPENAI_API_KEY to enable full AI capabilities.";
}

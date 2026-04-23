import { supabase } from "../../../lib/supabase/client";

export interface TaskAutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: {
    type: "email" | "meeting" | "document" | "schedule" | "manual" | "webhook";
    conditions: Record<string, any>;
  };
  actions: Array<{
    type: "create_task" | "assign_task" | "send_notification" | "update_status" | "create_project";
    parameters: Record<string, any>;
  }>;
  role: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomationSuggestion {
  type: "task_creation" | "task_assignment" | "deadline_adjustment" | "priority_update";
  confidence: number;
  suggestion: string;
  reason: string;
  impact: "high" | "medium" | "low";
  estimatedTimeSaved: number; // in minutes
}

export class TaskAutomationService {
  // Email pattern matching for task creation
  private static emailPatterns = {
    urgent: /\b(urgent|asap|immediately|emergency|critical)\b/i,
    deadline: /\b(due|deadline|by|before|end of|need by)\s+(\d{1,2}\/\d{1,2}|\d{1,2}\s*\w+\s*\d{4}|\w+\s*\d{1,2})/i,
    assignee: /\b(assign|assigned to|for|please have|@)(\s+\w+)+/i,
    action: /\b(action|task|todo|please|need to|should|will|going to)\s+\w+/i,
  };

  // Meeting pattern matching
  private static meetingPatterns = {
    actionItem: /\b(action\s+item|next\s+steps|follow\s+up|to\s+do)\b/i,
    decision: /\b(decided|agreed|confirmed|approved|rejected)\b/i,
    deadline: /\b(by|before|due|deadline)\s+(\d{1,2}\/\d{1,2}|\d{1,2}\s*\w+\s*\d{4}|\w+\s*\d{1,2})/i,
    owner: /\b(owner|responsible|led\s+by|assigned\s+to)\s+(\w+)/i,
  };

  static async analyzeEmailForTasks(email: {
    subject: string;
    body: string;
    from: string;
    to: string[];
    date: string;
  }): Promise<AutomationSuggestion[]> {
    const suggestions: AutomationSuggestion[] = [];
    const content = `${email.subject} ${email.body}`;

    // Check for urgent tasks
    if (this.emailPatterns.urgent.test(content)) {
      suggestions.push({
        type: "task_creation",
        confidence: 0.8,
        suggestion: "Create high-priority task from urgent email",
        reason: "Email contains urgent keywords",
        impact: "high",
        estimatedTimeSaved: 15,
      });
    }

    // Check for deadline mentions
    const deadlineMatch = content.match(this.emailPatterns.deadline);
    if (deadlineMatch) {
      suggestions.push({
        type: "task_creation",
        confidence: 0.7,
        suggestion: `Create task with deadline: ${deadlineMatch[0]}`,
        reason: "Email specifies a deadline",
        impact: "medium",
        estimatedTimeSaved: 10,
      });
    }

    // Check for action items
    const actionMatches = content.match(this.emailPatterns.action);
    if (actionMatches && actionMatches.length > 0) {
      suggestions.push({
        type: "task_creation",
        confidence: 0.6,
        suggestion: `Extract ${actionMatches.length} potential action items as tasks`,
        reason: "Email contains action-oriented language",
        impact: "medium",
        estimatedTimeSaved: 20,
      });
    }

    // Check for assignee mentions
    const assigneeMatch = content.match(this.emailPatterns.assignee);
    if (assigneeMatch) {
      suggestions.push({
        type: "task_assignment",
        confidence: 0.7,
        suggestion: "Auto-assign task based on email recipient/mentions",
        reason: "Email specifies who should handle the task",
        impact: "medium",
        estimatedTimeSaved: 5,
      });
    }

    return suggestions;
  }

  static async analyzeMeetingForTasks(meeting: {
    title: string;
    transcript?: string;
    notes?: string;
    attendees: string[];
    date: string;
  }): Promise<AutomationSuggestion[]> {
    const suggestions: AutomationSuggestion[] = [];
    const content = `${meeting.title} ${meeting.transcript || ""} ${meeting.notes || ""}`;

    // Extract action items
    const actionMatches = content.match(this.meetingPatterns.actionItem);
    if (actionMatches) {
      suggestions.push({
        type: "task_creation",
        confidence: 0.8,
        suggestion: `Create ${actionMatches.length} action items from meeting`,
        reason: "Meeting transcript contains action items",
        impact: "high",
        estimatedTimeSaved: 30,
      });
    }

    // Check for decisions that might require tasks
    const decisionMatches = content.match(this.meetingPatterns.decision);
    if (decisionMatches) {
      suggestions.push({
        type: "task_creation",
        confidence: 0.6,
        suggestion: "Create follow-up tasks for decisions made",
        reason: "Meeting contains decisions that may require implementation",
        impact: "medium",
        estimatedTimeSaved: 15,
      });
    }

    // Check for deadlines in meeting
    const deadlineMatch = content.match(this.meetingPatterns.deadline);
    if (deadlineMatch) {
      suggestions.push({
        type: "deadline_adjustment",
        confidence: 0.7,
        suggestion: "Set task deadlines based on meeting commitments",
        reason: "Meeting specifies timing for deliverables",
        impact: "medium",
        estimatedTimeSaved: 10,
      });
    }

    // Check for task owners
    const ownerMatch = content.match(this.meetingPatterns.owner);
    if (ownerMatch) {
      suggestions.push({
        type: "task_assignment",
        confidence: 0.8,
        suggestion: "Assign tasks to mentioned owners",
        reason: "Meeting clearly specifies task owners",
        impact: "high",
        estimatedTimeSaved: 10,
      });
    }

    return suggestions;
  }

  static async createAutomatedTask(params: {
    title: string;
    description?: string;
    assigneeId?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    dueDate?: string;
    projectId?: string;
    tags?: string[];
    source: "email" | "meeting" | "document" | "manual";
    sourceId?: string;
  }): Promise<{ taskId: string; status: string }> {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: params.title,
          description: params.description || "",
          assigned_to: params.assigneeId,
          priority: params.priority || "medium",
          due_date: params.dueDate,
          project_id: params.projectId,
          tags: params.tags || [],
          status: "open",
          created_at: new Date().toISOString(),
          metadata: {
            source: params.source,
            source_id: params.sourceId,
            automated: true,
          },
        })
        .select()
        .single();

      if (error) throw error;

      // Log the automation
      await this.logAutomation({
        action: "create_task",
        parameters: params,
        result: { taskId: data.id, status: "created" },
        confidence: 0.8,
      });

      return { taskId: data.id, status: "created" };
    } catch (error) {
      console.error("Error creating automated task:", error);
      throw new Error("Failed to create automated task");
    }
  }

  static async suggestTaskAssignments(taskId: string): Promise<{
    suggestions: Array<{
      userId: string;
      userName: string;
      confidence: number;
      reasons: string[];
    }>;
  }> {
    try {
      // Get task details
      const { data: task } = await supabase
        .from("tasks")
        .select("title, description, tags, project_id")
        .eq("id", taskId)
        .single();

      if (!task) throw new Error("Task not found");

      // Get team members with their skills and workload
      const { data: teamMembers } = await supabase
        .from("profiles")
        .select(`
          id, 
          full_name, 
          primary_role, 
          skills,
          current_workload,
          task_completion_rate
        `);

      const suggestions = teamMembers?.map(member => {
        let confidence = 0.5; // Base confidence
        const reasons: string[] = [];

        // Role-based matching
        if (this.isRoleSuitableForTask(member.primary_role, task.title, task.tags)) {
          confidence += 0.2;
          reasons.push(`Role ${member.primary_role} is suitable for this task`);
        }

        // Skills matching
        if (member.skills && task.tags) {
          const matchingSkills = task.tags.filter((tag: string) => 
            member.skills?.some((skill: string) => 
              skill.toLowerCase().includes(tag.toLowerCase()) || 
              tag.toLowerCase().includes(skill.toLowerCase())
            )
          );
          if (matchingSkills.length > 0) {
            confidence += 0.15;
            reasons.push(`Has relevant skills: ${matchingSkills.join(", ")}`);
          }
        }

        // Workload consideration
        if (member.current_workload && member.current_workload < 80) {
          confidence += 0.1;
          reasons.push("Has available capacity");
        } else if (member.current_workload && member.current_workload > 90) {
          confidence -= 0.2;
          reasons.push("Currently overloaded");
        }

        // Historical performance
        if (member.task_completion_rate && member.task_completion_rate > 0.85) {
          confidence += 0.1;
          reasons.push("High completion rate");
        }

        return {
          userId: member.id,
          userName: member.full_name || "Unknown",
          confidence: Math.max(0, Math.min(1, confidence)),
          reasons,
        };
      }) || [];

      // Sort by confidence
      suggestions.sort((a, b) => b.confidence - a.confidence);

      return { suggestions: suggestions.slice(0, 5) }; // Return top 5
    } catch (error) {
      console.error("Error suggesting task assignments:", error);
      throw new Error("Failed to generate task assignment suggestions");
    }
  }

  static async createRoleBasedAutomationRules(role: string): Promise<TaskAutomationRule[]> {
    const rules: TaskAutomationRule[] = [];

    switch (role) {
      case "admin":
        rules.push(
          {
            id: "admin_compliance_tasks",
            name: "Compliance Task Auto-Creation",
            description: "Automatically create compliance-related tasks from policy updates",
            trigger: {
              type: "document",
              conditions: { documentType: "policy", keywords: ["compliance", "audit", "regulation"] },
            },
            actions: [
              {
                type: "create_task",
                parameters: { priority: "high", tags: ["compliance"] },
              },
              {
                type: "assign_task",
                parameters: { assigneeRole: "admin" },
              },
            ],
            role: "admin",
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "admin_team_review_tasks",
            name: "Weekly Team Review Tasks",
            description: "Create weekly review tasks for each team member",
            trigger: {
              type: "schedule",
              conditions: { frequency: "weekly", day: "monday", time: "09:00" },
            },
            actions: [
              {
                type: "create_task",
                parameters: { 
                  title: "Weekly Performance Review",
                  description: "Review team performance and provide feedback",
                  priority: "medium",
                  tags: ["review", "weekly"]
                },
              },
            ],
            role: "admin",
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        );
        break;

      case "manager":
        rules.push(
          {
            id: "manager_project_checkin",
            name: "Project Check-in Tasks",
            description: "Create regular project check-in tasks",
            trigger: {
              type: "schedule",
              conditions: { frequency: "biweekly", day: "friday", time: "16:00" },
            },
            actions: [
              {
                type: "create_task",
                parameters: { 
                  title: "Project Progress Check-in",
                  priority: "medium",
                  tags: ["project", "checkin"]
                },
              },
            ],
            role: "manager",
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "manager_team_meeting_prep",
            name: "Team Meeting Preparation",
            description: "Prepare agenda and materials for team meetings",
            trigger: {
              type: "schedule",
              conditions: { frequency: "weekly", day: "wednesday", time: "14:00" },
            },
            actions: [
              {
                type: "create_task",
                parameters: { 
                  title: "Prepare Team Meeting",
                  description: "Create agenda and gather status updates",
                  priority: "high",
                  tags: ["meeting", "prep"]
                },
              },
            ],
            role: "manager",
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        );
        break;

      case "social_media":
        rules.push(
          {
            id: "social_content_calendar",
            name: "Content Calendar Tasks",
            description: "Create content planning and posting tasks",
            trigger: {
              type: "schedule",
              conditions: { frequency: "weekly", day: "monday", time: "10:00" },
            },
            actions: [
              {
                type: "create_task",
                parameters: { 
                  title: "Plan Weekly Social Content",
                  priority: "high",
                  tags: ["social", "content", "planning"]
                },
              },
            ],
            role: "social_media",
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "social_analytics_review",
            name: "Social Media Analytics Review",
            description: "Review and analyze social media performance",
            trigger: {
              type: "schedule",
              conditions: { frequency: "monthly", day: 1, time: "09:00" },
            },
            actions: [
              {
                type: "create_task",
                parameters: { 
                  title: "Monthly Social Analytics Review",
                  priority: "medium",
                  tags: ["analytics", "social", "monthly"]
                },
              },
            ],
            role: "social_media",
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        );
        break;

      case "it":
        rules.push(
          {
            id: "it_system_maintenance",
            name: "System Maintenance Tasks",
            description: "Schedule regular system maintenance and updates",
            trigger: {
              type: "schedule",
              conditions: { frequency: "monthly", day: 15, time: "02:00" },
            },
            actions: [
              {
                type: "create_task",
                parameters: { 
                  title: "Monthly System Maintenance",
                  description: "Perform system updates, backups, and security checks",
                  priority: "high",
                  tags: ["maintenance", "system", "security"]
                },
              },
            ],
            role: "it",
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "it_security_audit",
            name: "Security Audit Tasks",
            description: "Regular security audits and vulnerability checks",
            trigger: {
              type: "schedule",
              conditions: { frequency: "quarterly", month: [1, 4, 7, 10], day: 1, time: "09:00" },
            },
            actions: [
              {
                type: "create_task",
                parameters: { 
                  title: "Quarterly Security Audit",
                  priority: "high",
                  tags: ["security", "audit", "quarterly"]
                },
              },
            ],
            role: "it",
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        );
        break;

      case "employee":
        rules.push(
          {
            id: "employee_timesheet_reminder",
            name: "Timesheet Submission Reminder",
            description: "Remind to submit timesheets",
            trigger: {
              type: "schedule",
              conditions: { frequency: "weekly", day: "friday", time: "16:30" },
            },
            actions: [
              {
                type: "create_task",
                parameters: { 
                  title: "Submit Weekly Timesheet",
                  priority: "medium",
                  tags: ["timesheet", "weekly"]
                },
              },
            ],
            role: "employee",
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        );
        break;
    }

    return rules;
  }

  static async optimizeWorkloadForRole(role: string): Promise<{
    recommendations: Array<{
      type: "reassign" | "prioritize" | "automate" | "delegate";
      description: string;
      impact: "high" | "medium" | "low";
      estimatedTimeSaved: number;
    }>;
  }> {
    const recommendations: Array<{
      type: "reassign" | "prioritize" | "automate" | "delegate";
      description: string;
      impact: "high" | "medium" | "low";
      estimatedTimeSaved: number;
    }> = [];

    try {
      // Get current workload for role
      const { data: roleTasks } = await supabase
        .from("tasks")
        .select("status, priority, due_date, assigned_to")
        .eq("assignee_role", role);

      if (roleTasks) {
        // Analyze workload patterns
        const overdueTasks = roleTasks.filter(t => 
          t.due_date && new Date(t.due_date) < new Date() && t.status !== "completed"
        );

        const highPriorityTasks = roleTasks.filter(t => t.priority === "high" || t.priority === "urgent");

        // Generate recommendations based on analysis
        if (overdueTasks.length > 3) {
          recommendations.push({
            type: "prioritize",
            description: "Focus on completing overdue tasks first",
            impact: "high",
            estimatedTimeSaved: 30,
          });
        }

        if (highPriorityTasks.length > 5) {
          recommendations.push({
            type: "delegate",
            description: "Consider delegating some high-priority tasks to balance workload",
            impact: "medium",
            estimatedTimeSaved: 45,
          });
        }

        // Role-specific recommendations
        switch (role) {
          case "social_media":
            recommendations.push({
              type: "automate",
              description: "Automate social media posting schedules and analytics reports",
              impact: "high",
              estimatedTimeSaved: 120,
            });
            break;

          case "manager":
            recommendations.push({
              type: "automate",
              description: "Automate weekly status report generation and team meeting prep",
              impact: "medium",
              estimatedTimeSaved: 60,
            });
            break;

          case "it":
            recommendations.push({
              type: "automate",
              description: "Automate system health checks and maintenance reminders",
              impact: "high",
              estimatedTimeSaved: 90,
            });
            break;
        }
      }

      return { recommendations };
    } catch (error) {
      console.error("Error optimizing workload:", error);
      return { recommendations: [] };
    }
  }

  private static isRoleSuitableForTask(role: string, taskTitle: string, taskTags: string[]): boolean {
    const roleKeywords = {
      admin: ["admin", "policy", "compliance", "report", "audit", "budget"],
      manager: ["manage", "project", "team", "review", "plan", "coordinate"],
      social_media: ["social", "media", "content", "post", "marketing", "campaign"],
      media_team: ["design", "creative", "video", "image", "brand", "visual"],
      seo_specialist: ["seo", "content", "keywords", "analytics", "search"],
      it: ["system", "technical", "development", "maintenance", "security", "infrastructure"],
      employee: ["general", "support", "administrative", "coordination"],
    };

    const keywords = roleKeywords[role as keyof typeof roleKeywords] || [];
    const content = `${taskTitle} ${taskTags.join(" ")}`.toLowerCase();

    return keywords.some(keyword => content.includes(keyword.toLowerCase()));
  }

  private static async logAutomation(params: {
    action: string;
    parameters: Record<string, any>;
    result: Record<string, any>;
    confidence: number;
  }): Promise<void> {
    try {
      await supabase
        .from("automation_logs")
        .insert({
          action: params.action,
          parameters: params.parameters,
          result: params.result,
          confidence: params.confidence,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error("Failed to log automation:", error);
    }
  }

  static async getAutomationMetrics(): Promise<{
    totalAutomations: number;
    successfulAutomations: number;
    timeSaved: number;
    byRole: Record<string, { count: number; timeSaved: number }>;
    byType: Record<string, { count: number; successRate: number }>;
  }> {
    try {
      const { data: logs } = await supabase
        .from("automation_logs")
        .select("action, parameters, result, confidence, created_at");

      if (!logs) {
        return {
          totalAutomations: 0,
          successfulAutomations: 0,
          timeSaved: 0,
          byRole: {},
          byType: {},
        };
      }

      const totalAutomations = logs.length;
      const successfulAutomations = logs.filter(log => 
        log.result && log.result.status === "created"
      ).length;

      // Calculate metrics by role
      const byRole = logs.reduce((acc, log) => {
        const role = log.parameters?.role || "unknown";
        if (!acc[role]) {
          acc[role] = { count: 0, timeSaved: 0 };
        }
        acc[role].count++;
        // Estimate time saved based on action type
        acc[role].timeSaved += this.estimateTimeSaved(log.action);
        return acc;
      }, {} as Record<string, { count: number; timeSaved: number }>);

      // Calculate metrics by type
      const byType = logs.reduce((acc, log) => {
        const type = log.action;
        if (!acc[type]) {
          acc[type] = { count: 0, successRate: 0 };
        }
        acc[type].count++;
        const success = log.result && log.result.status === "created" ? 1 : 0;
        acc[type].successRate = ((acc[type].successRate * (acc[type].count - 1)) + success) / acc[type].count;
        return acc;
      }, {} as Record<string, { count: number; successRate: number }>);

      const total_timeSaved = Object.values(byRole).reduce((sum, role) => sum + role.timeSaved, 0);

      return {
        totalAutomations,
        successfulAutomations,
        timeSaved: total_timeSaved,
        byRole,
        byType,
      };
    } catch (error) {
      console.error("Error getting automation metrics:", error);
      return {
        totalAutomations: 0,
        successfulAutomations: 0,
        timeSaved: 0,
        byRole: {},
        byType: {},
      };
    }
  }

  private static estimateTimeSaved(action: string): number {
    const timeEstimates = {
      create_task: 15,
      assign_task: 5,
      send_notification: 2,
      update_status: 3,
      create_project: 30,
    };

    return timeEstimates[action as keyof typeof timeEstimates] || 10;
  }
}

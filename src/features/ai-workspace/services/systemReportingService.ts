import { supabase } from "../../../lib/supabase/client";

export interface SystemReportData {
  period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  startDate: string;
  endDate: string;
  includeSections: {
    tasks: boolean;
    projects: boolean;
    team: boolean;
    time: boolean;
    performance: boolean;
    communications: boolean;
    system_health: boolean;
  };
  filters?: {
    departments?: string[];
    roles?: string[];
    users?: string[];
    projectIds?: string[];
  };
}

export interface ComprehensiveSystemReport {
  summary: {
    totalUsers: number;
    activeUsers: number;
    totalTasks: number;
    completedTasks: number;
    totalProjects: number;
    activeProjects: number;
    overallProductivity: number;
    systemHealth: number;
  };
  tasks: {
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byAssignee: Array<{ user: string; count: number; completionRate: number }>;
    overdueTasks: Array<{ id: string; title: string; assignee: string; daysOverdue: number }>;
    completionTrend: Array<{ date: string; completed: number; created: number }>;
  };
  projects: {
    byStatus: Record<string, number>;
    progress: Array<{ id: string; name: string; progress: number; health: string }>;
    bottlenecks: Array<{ projectId: string; issue: string; severity: string }>;
    timelinePerformance: Array<{ projectId: string; onTime: boolean; delayDays?: number }>;
  };
  team: {
    activity: Array<{ userId: string; name: string; lastActive: string; tasksCompleted: number; hoursLogged: number }>;
    workloadBalance: Array<{ userId: string; currentLoad: number; capacity: number; utilization: number }>;
    collaboration: Array<{ user1: string; user2: string; collaborationScore: number; sharedTasks: number }>;
    sentiment: Array<{ userId: string; sentiment: "positive" | "neutral" | "negative"; confidence: number }>;
  };
  time: {
    totalHours: number;
    byProject: Array<{ projectId: string; projectName: string; hours: number; percentage: number }>;
    byUser: Array<{ userId: string; userName: string; hours: number; efficiency: number }>;
    overtime: Array<{ userId: string; overtimeHours: number; trend: "increasing" | "decreasing" | "stable" }>;
    billableVsInternal: { billable: number; internal: number; ratio: number };
  };
  performance: {
    systemMetrics: {
      uptime: number;
      responseTime: number;
      errorRate: number;
      throughput: number;
    };
    userEngagement: {
      dailyActiveUsers: number;
      averageSessionTime: number;
      featureUsage: Record<string, number>;
    };
    efficiency: {
      taskCompletionRate: number;
      averageTaskDuration: number;
      reworkRate: number;
    };
  };
  communications: {
    messages: {
      total: number;
      byChannel: Record<string, number>;
      byTimeOfDay: Record<string, number>;
    };
    meetings: {
      total: number;
      attendance: number;
      actionItemsGenerated: number;
    };
    notifications: {
      sent: number;
      opened: number;
      clicked: number;
    };
  };
  system_health: {
    integrations: Array<{ name: string; status: "healthy" | "warning" | "error"; lastCheck: string }>;
    errors: Array<{ type: string; count: number; trend: "increasing" | "decreasing" | "stable" }>;
    performance: Array<{ metric: string; current: number; threshold: number; status: "good" | "warning" | "critical" }>;
  };
  insights: Array<{
    category: string;
    type: "opportunity" | "risk" | "trend" | "achievement";
    title: string;
    description: string;
    impact: "high" | "medium" | "low";
    recommendations: string[];
  }>;
  recommendations: Array<{
    priority: "high" | "medium" | "low";
    category: string;
    title: string;
    description: string;
    expectedImpact: string;
    implementation: string;
  }>;
}

export async function generateComprehensiveSystemReport(
  params: SystemReportData
): Promise<ComprehensiveSystemReport> {
  const report: ComprehensiveSystemReport = {
    summary: {
      totalUsers: 0,
      activeUsers: 0,
      totalTasks: 0,
      completedTasks: 0,
      totalProjects: 0,
      activeProjects: 0,
      overallProductivity: 0,
      systemHealth: 0,
    },
    tasks: {
      byStatus: {},
      byPriority: {},
      byAssignee: [],
      overdueTasks: [],
      completionTrend: [],
    },
    projects: {
      byStatus: {},
      progress: [],
      bottlenecks: [],
      timelinePerformance: [],
    },
    team: {
      activity: [],
      workloadBalance: [],
      collaboration: [],
      sentiment: [],
    },
    time: {
      totalHours: 0,
      byProject: [],
      byUser: [],
      overtime: [],
      billableVsInternal: { billable: 0, internal: 0, ratio: 0 },
    },
    performance: {
      systemMetrics: {
        uptime: 0,
        responseTime: 0,
        errorRate: 0,
        throughput: 0,
      },
      userEngagement: {
        dailyActiveUsers: 0,
        averageSessionTime: 0,
        featureUsage: {},
      },
      efficiency: {
        taskCompletionRate: 0,
        averageTaskDuration: 0,
        reworkRate: 0,
      },
    },
    communications: {
      messages: {
        total: 0,
        byChannel: {},
        byTimeOfDay: {},
      },
      meetings: {
        total: 0,
        attendance: 0,
        actionItemsGenerated: 0,
      },
      notifications: {
        sent: 0,
        opened: 0,
        clicked: 0,
      },
    },
    system_health: {
      integrations: [],
      errors: [],
      performance: [],
    },
    insights: [],
    recommendations: [],
  };

  try {
    // Get basic user and activity summary
    if (params.includeSections.team) {
      const { data: users } = await supabase
        .from("profiles")
        .select("id, full_name, primary_role, department, last_seen_at");

      report.summary.totalUsers = users?.length || 0;
      report.summary.activeUsers = users?.filter(u => 
        u.last_seen_at && new Date(u.last_seen_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length || 0;
    }

    // Get tasks data
    if (params.includeSections.tasks) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, status, priority, assigned_to, created_at, due_date, completed_at")
        .gte("created_at", params.startDate)
        .lte("created_at", params.endDate);

      if (tasks) {
        report.summary.totalTasks = tasks.length;
        report.summary.completedTasks = tasks.filter(t => t.status === "completed").length;

        // Group by status
        report.tasks.byStatus = tasks.reduce((acc, task) => {
          acc[task.status] = (acc[task.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Group by priority
        report.tasks.byPriority = tasks.reduce((acc, task) => {
          acc[task.priority] = (acc[task.priority] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // By assignee
        const assigneeStats = tasks.reduce((acc, task) => {
          const assigneeId = task.assigned_to || "unassigned";
          const assigneeName = "User"; // Will be populated with actual names later
          
          if (!acc[assigneeId]) {
            acc[assigneeId] = { user: assigneeName, count: 0, completed: 0 };
          }
          acc[assigneeId].count++;
          if (task.status === "completed") acc[assigneeId].completed++;
          
          return acc;
        }, {} as Record<string, { user: string; count: number; completed: number }>);

        report.tasks.byAssignee = Object.entries(assigneeStats).map(([userId, stats]) => ({
          userId,
          user: stats.user,
          count: stats.count,
          completionRate: stats.count > 0 ? (stats.completed / stats.count) * 100 : 0,
        }));

        // Overdue tasks
        const now = new Date();
        report.tasks.overdueTasks = tasks
          .filter(t => t.due_date && new Date(t.due_date) < now && t.status !== "completed")
          .map(t => ({
            id: t.id,
            title: t.title,
            assignee: "User", // Will be populated with actual names later
            daysOverdue: Math.floor((now.getTime() - new Date(t.due_date!).getTime()) / (1000 * 60 * 60 * 24)),
          }));
      }
    }

    // Get projects data
    if (params.includeSections.projects) {
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name, status, progress, start_date, end_date")
        .gte("created_at", params.startDate)
        .lte("created_at", params.endDate);

      if (projects) {
        report.summary.totalProjects = projects.length;
        report.summary.activeProjects = projects.filter(p => p.status === "active").length;

        report.projects.byStatus = projects.reduce((acc, project) => {
          acc[project.status] = (acc[project.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        report.projects.progress = projects.map(p => ({
          id: p.id,
          name: p.name,
          progress: p.progress || 0,
          health: p.progress >= 80 ? "excellent" : p.progress >= 60 ? "good" : p.progress >= 40 ? "warning" : "critical",
        }));
      }
    }

    // Get time tracking data
    if (params.includeSections.time) {
      const { data: timeEntries } = await supabase
        .from("time_entries")
        .select("hours, user_id, project_id, date, is_billable")
        .gte("date", params.startDate)
        .lte("date", params.endDate);

      if (timeEntries) {
        report.time.totalHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);

        // By project
        const projectHours = timeEntries.reduce((acc, entry) => {
          acc[entry.project_id] = (acc[entry.project_id] || 0) + entry.hours;
          return acc;
        }, {} as Record<string, number>);

        // Get project names
        const { data: projectNames } = await supabase
          .from("projects")
          .select("id, name")
          .in("id", Object.keys(projectHours));

        report.time.byProject = Object.entries(projectHours).map(([projectId, hours]) => ({
          projectId,
          projectName: projectNames?.find(p => p.id === projectId)?.name || "Unknown",
          hours,
          percentage: report.time.totalHours > 0 ? (hours / report.time.totalHours) * 100 : 0,
        }));

        // Billable vs internal
        const billableHours = timeEntries.filter(e => e.is_billable).reduce((sum, e) => sum + e.hours, 0);
        const internalHours = report.time.totalHours - billableHours;
        
        report.time.billableVsInternal = {
          billable: billableHours,
          internal: internalHours,
          ratio: internalHours > 0 ? billableHours / internalHours : 0,
        };
      }
    }

    // Generate insights and recommendations
    report.insights = generateInsights(report);
    report.recommendations = generateRecommendations(report);

    // Calculate overall metrics
    report.summary.overallProductivity = calculateProductivityScore(report);
    report.summary.systemHealth = calculateSystemHealthScore(report);

  } catch (error) {
    console.error("Error generating system report:", error);
    throw new Error("Failed to generate comprehensive system report");
  }

  return report;
}

function generateInsights(report: ComprehensiveSystemReport): ComprehensiveSystemReport["insights"] {
  const insights: ComprehensiveSystemReport["insights"] = [];

  // Task completion insights
  if (report.summary.totalTasks > 0) {
    const completionRate = (report.summary.completedTasks / report.summary.totalTasks) * 100;
    if (completionRate > 85) {
      insights.push({
        category: "productivity",
        type: "achievement",
        title: "Excellent Task Completion",
        description: `Team has maintained a ${completionRate.toFixed(1)}% task completion rate`,
        impact: "high",
        recommendations: ["Maintain current workflows", "Document best practices"],
      });
    } else if (completionRate < 60) {
      insights.push({
        category: "productivity",
        type: "risk",
        title: "Low Task Completion Rate",
        description: `Only ${completionRate.toFixed(1)}% of tasks are being completed`,
        impact: "high",
        recommendations: ["Review workload distribution", "Identify blockers", "Provide additional resources"],
      });
    }
  }

  // Overdue tasks insight
  if (report.tasks.overdueTasks.length > 0) {
    insights.push({
      category: "risk",
      type: "risk",
      title: "Overdue Tasks Need Attention",
      description: `${report.tasks.overdueTasks.length} tasks are overdue and require immediate attention`,
      impact: "medium",
      recommendations: ["Prioritize overdue tasks", "Review deadlines", "Allocate resources"],
    });
  }

  // Team workload balance
  const overloadedUsers = report.team.workloadBalance.filter(u => u.utilization > 90);
  if (overloadedUsers.length > 0) {
    insights.push({
      category: "workload",
      type: "risk",
      title: "Team Workload Imbalance",
      description: `${overloadedUsers.length} team members are over 90% capacity`,
      impact: "medium",
      recommendations: ["Redistribute tasks", "Consider temporary help", "Review deadlines"],
    });
  }

  return insights;
}

function generateRecommendations(report: ComprehensiveSystemReport): ComprehensiveSystemReport["recommendations"] {
  const recommendations: ComprehensiveSystemReport["recommendations"] = [];

  // Task management recommendations
  if (report.tasks.overdueTasks.length > report.summary.totalTasks * 0.2) {
    recommendations.push({
      priority: "high",
      category: "task_management",
      title: "Implement Task Prioritization System",
      description: "Too many tasks are becoming overdue. A better prioritization system is needed.",
      expectedImpact: "Reduce overdue tasks by 40%",
      implementation: "Use Eisenhower matrix for task categorization and set up automated reminders",
    });
  }

  // Team collaboration recommendations
  const avgCollaboration = report.team.collaboration.reduce((sum, c) => sum + c.collaborationScore, 0) / (report.team.collaboration.length || 1);
  if (avgCollaboration < 50) {
    recommendations.push({
      priority: "medium",
      category: "collaboration",
      title: "Improve Team Collaboration",
      description: "Low collaboration scores indicate silos in team communication",
      expectedImpact: "Increase cross-functional project success by 25%",
      implementation: "Set up regular cross-team meetings and shared project spaces",
    });
  }

  // Time management recommendations
  if (report.time.billableVsInternal.ratio < 1.5) {
    recommendations.push({
      priority: "medium",
      category: "time_management",
      title: "Optimize Billable Time Ratio",
      description: "Billable to internal time ratio could be improved for better profitability",
      expectedImpact: "Increase profitability by 15%",
      implementation: "Review internal processes and automate where possible",
    });
  }

  return recommendations;
}

function calculateProductivityScore(report: ComprehensiveSystemReport): number {
  let score = 0;
  let factors = 0;

  // Task completion factor (30%)
  if (report.summary.totalTasks > 0) {
    const completionRate = report.summary.completedTasks / report.summary.totalTasks;
    score += completionRate * 30;
    factors += 30;
  }

  // Project progress factor (25%)
  if (report.summary.totalProjects > 0) {
    const avgProgress = report.projects.progress.reduce((sum, p) => sum + p.progress, 0) / report.projects.progress.length;
    score += (avgProgress / 100) * 25;
    factors += 25;
  }

  // Team utilization factor (20%)
  if (report.team.workloadBalance.length > 0) {
    const avgUtilization = report.team.workloadBalance.reduce((sum, u) => sum + u.utilization, 0) / report.team.workloadBalance.length;
    score += (avgUtilization / 100) * 20;
    factors += 20;
  }

  // Time efficiency factor (15%)
  if (report.time.totalHours > 0) {
    const billableRatio = report.time.billableVsInternal.billable / report.time.totalHours;
    score += billableRatio * 15;
    factors += 15;
  }

  // System health factor (10%)
  score += (report.summary.systemHealth / 100) * 10;
  factors += 10;

  return factors > 0 ? Math.round((score / factors) * 100) : 0;
}

function calculateSystemHealthScore(report: ComprehensiveSystemReport): number {
  let score = 100;

  // Deduct points for overdue tasks
  const overdueRatio = report.tasks.overdueTasks.length / Math.max(report.summary.totalTasks, 1);
  score -= overdueRatio * 30;

  // Deduct points for system errors
  const criticalErrors = report.system_health.performance.filter(p => p.status === "critical").length;
  score -= criticalErrors * 15;

  // Deduct points for low team morale
  const negativeSentiment = report.team.sentiment.filter(s => s.sentiment === "negative").length;
  const sentimentRatio = negativeSentiment / Math.max(report.team.sentiment.length, 1);
  score -= sentimentRatio * 20;

  return Math.max(0, Math.round(score));
}

export async function scheduleAutomatedReport(
  params: SystemReportData & {
    schedule: "daily" | "weekly" | "monthly";
    recipients: string[];
    format: "email" | "dashboard" | "both";
  }
): Promise<{ id: string; status: string }> {
  try {
    const { data, error } = await supabase
      .from("automated_reports")
      .insert({
        organization_id: params.filters?.departments?.[0] || "default", // This should come from context
        report_config: params,
        schedule: params.schedule,
        recipients: params.recipients,
        format: params.format,
        active: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return { id: data.id, status: "scheduled" };
  } catch (error) {
    console.error("Error scheduling automated report:", error);
    throw new Error("Failed to schedule automated report");
  }
}

export async function getSystemMetrics(): Promise<{
  users: { total: number; active: number; new_this_month: number };
  tasks: { total: number; completed_today: number; overdue: number };
  projects: { total: number; active: number; at_risk: number };
  performance: { uptime: number; response_time: number; error_rate: number };
}> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    const [
      usersResult,
      tasksResult,
      projectsResult,
    ] = await Promise.all([
      supabase.from("profiles").select("id, created_at, last_seen_at"),
      supabase.from("tasks").select("id, status, created_at, due_date"),
      supabase.from("projects").select("id, status, progress"),
    ]);

    const users = usersResult.data || [];
    const tasks = tasksResult.data || [];
    const projects = projectsResult.data || [];

    return {
      users: {
        total: users.length,
        active: users.filter(u => u.last_seen_at && new Date(u.last_seen_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
        new_this_month: users.filter(u => u.created_at && new Date(u.created_at) >= startOfMonth).length,
      },
      tasks: {
        total: tasks.length,
        completed_today: tasks.filter(t => t.status === "completed" && t.created_at && new Date(t.created_at) >= startOfDay).length,
        overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== "completed").length,
      },
      projects: {
        total: projects.length,
        active: projects.filter(p => p.status === "active").length,
        at_risk: projects.filter(p => p.progress < 50 && p.status === "active").length,
      },
      performance: {
        uptime: 99.9, // This should come from monitoring system
        response_time: 245, // This should come from monitoring system
        error_rate: 0.02, // This should come from monitoring system
      },
    };
  } catch (error) {
    console.error("Error getting system metrics:", error);
    throw new Error("Failed to retrieve system metrics");
  }
}

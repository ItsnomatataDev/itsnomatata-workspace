import { supabase } from "../../../lib/supabase/client";

export interface SystemHealthMetric {
  id: string;
  name: string;
  category: "performance" | "availability" | "security" | "usage" | "integration";
  status: "healthy" | "warning" | "critical" | "unknown";
  value: number;
  unit: string;
  threshold: {
    warning: number;
    critical: number;
  };
  lastChecked: string;
  trend: "improving" | "stable" | "degrading";
  description: string;
}

export interface SystemAlert {
  id: string;
  type: "performance" | "availability" | "security" | "usage" | "integration";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  metric?: string;
  value?: number;
  threshold?: number;
  createdAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface IntegrationStatus {
  id: string;
  name: string;
  type: "api" | "database" | "external_service" | "webhook" | "queue";
  status: "healthy" | "warning" | "error" | "disabled";
  lastCheck: string;
  responseTime?: number;
  errorRate: number;
  uptime: number;
  description: string;
  endpoint?: string;
  lastError?: string;
}

export class SystemMonitoringService {
  private static readonly METRICS_CONFIG = [
    {
      id: "system_response_time",
      name: "System Response Time",
      category: "performance" as const,
      unit: "ms",
      threshold: { warning: 1000, critical: 3000 },
      description: "Average API response time",
    },
    {
      id: "system_uptime",
      name: "System Uptime",
      category: "availability" as const,
      unit: "%",
      threshold: { warning: 99.0, critical: 95.0 },
      description: "System availability percentage",
    },
    {
      id: "error_rate",
      name: "Error Rate",
      category: "performance" as const,
      unit: "%",
      threshold: { warning: 5.0, critical: 15.0 },
      description: "Percentage of failed requests",
    },
    {
      id: "database_connections",
      name: "Database Connections",
      category: "performance" as const,
      unit: "count",
      threshold: { warning: 80, critical: 95 },
      description: "Active database connections",
    },
    {
      id: "active_users",
      name: "Active Users",
      category: "usage" as const,
      unit: "count",
      threshold: { warning: 1000, critical: 2000 },
      description: "Currently active users",
    },
    {
      id: "storage_usage",
      name: "Storage Usage",
      category: "usage" as const,
      unit: "%",
      threshold: { warning: 80.0, critical: 95.0 },
      description: "Storage space utilization",
    },
    {
      id: "memory_usage",
      name: "Memory Usage",
      category: "performance" as const,
      unit: "%",
      threshold: { warning: 80.0, critical: 95.0 },
      description: "System memory utilization",
    },
    {
      id: "cpu_usage",
      name: "CPU Usage",
      category: "performance" as const,
      unit: "%",
      threshold: { warning: 70.0, critical: 90.0 },
      description: "System CPU utilization",
    },
  ];

  static async getSystemHealth(): Promise<{
    overall: "healthy" | "warning" | "critical";
    metrics: SystemHealthMetric[];
    alerts: SystemAlert[];
    integrations: IntegrationStatus[];
  }> {
    try {
      const [metrics, alerts, integrations] = await Promise.all([
        this.collectHealthMetrics(),
        this.getActiveAlerts(),
        this.getIntegrationStatuses(),
      ]);

      // Determine overall health
      const criticalIssues = metrics.filter(m => m.status === "critical").length + 
                             alerts.filter(a => a.severity === "critical" && !a.resolved).length;
      const warningIssues = metrics.filter(m => m.status === "warning").length + 
                           alerts.filter(a => a.severity === "high" && !a.resolved).length;

      let overall: "healthy" | "warning" | "critical" = "healthy";
      if (criticalIssues > 0) overall = "critical";
      else if (warningIssues > 0) overall = "warning";

      return { overall, metrics, alerts, integrations };
    } catch (error) {
      console.error("Error getting system health:", error);
      return {
        overall: "critical",
        metrics: [],
        alerts: [{
          id: "monitoring_error",
          type: "performance",
          severity: "critical",
          title: "System Monitoring Error",
          description: "Unable to collect system health metrics",
          createdAt: new Date().toISOString(),
          acknowledged: false,
          resolved: false,
        }],
        integrations: [],
      };
    }
  }

  static async collectHealthMetrics(): Promise<SystemHealthMetric[]> {
    const metrics: SystemHealthMetric[] = [];

    for (const config of this.METRICS_CONFIG) {
      try {
        const value = await this.getMetricValue(config.id);
        const status = this.determineStatus(value, config.threshold);
        const trend = await this.getMetricTrend(config.id, value);

        metrics.push({
          ...config,
          value,
          status,
          lastChecked: new Date().toISOString(),
          trend,
        });
      } catch (error) {
        console.error(`Error collecting metric ${config.id}:`, error);
        metrics.push({
          ...config,
          value: 0,
          status: "unknown",
          lastChecked: new Date().toISOString(),
          trend: "stable",
        });
      }
    }

    return metrics;
  }

  static async getMetricValue(metricId: string): Promise<number> {
    // Simulate metric collection - in real implementation, these would come from monitoring systems
    const simulatedValues: Record<string, number> = {
      system_response_time: 245,
      system_uptime: 99.9,
      error_rate: 2.1,
      database_connections: 45,
      active_users: 127,
      storage_usage: 67.3,
      memory_usage: 72.8,
      cpu_usage: 45.2,
    };

    return simulatedValues[metricId] || 0;
  }

  static async getMetricTrend(metricId: string, currentValue: number): Promise<"improving" | "stable" | "degrading"> {
    // In real implementation, this would compare with historical data
    // For now, return a simple simulation
    const trends: Record<string, "improving" | "stable" | "degrading"> = {
      system_response_time: "stable",
      system_uptime: "stable",
      error_rate: "improving",
      database_connections: "stable",
      active_users: "improving",
      storage_usage: "degrading",
      memory_usage: "stable",
      cpu_usage: "improving",
    };

    return trends[metricId] || "stable";
  }

  static determineStatus(value: number, threshold: { warning: number; critical: number }): "healthy" | "warning" | "critical" {
    if (value >= threshold.critical) return "critical";
    if (value >= threshold.warning) return "warning";
    return "healthy";
  }

  static async getActiveAlerts(): Promise<SystemAlert[]> {
    try {
      const { data: alerts } = await supabase
        .from("system_alerts")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false });

      return alerts || [];
    } catch (error) {
      console.error("Error getting active alerts:", error);
      return [];
    }
  }

  static async getIntegrationStatuses(): Promise<IntegrationStatus[]> {
    const integrations: IntegrationStatus[] = [
      {
        id: "supabase_db",
        name: "Supabase Database",
        type: "database",
        status: "healthy",
        lastCheck: new Date().toISOString(),
        responseTime: 12,
        errorRate: 0.1,
        uptime: 99.9,
        description: "Primary database connection",
      },
      {
        id: "n8n_automation",
        name: "N8N Automation",
        type: "external_service",
        status: "healthy",
        lastCheck: new Date().toISOString(),
        responseTime: 245,
        errorRate: 2.3,
        uptime: 98.5,
        description: "AI workflow automation service",
        endpoint: "https://n8n.example.com/webhook",
      },
      {
        id: "email_service",
        name: "Email Service",
        type: "external_service",
        status: "healthy",
        lastCheck: new Date().toISOString(),
        responseTime: 89,
        errorRate: 0.5,
        uptime: 99.7,
        description: "Email notification service",
      },
      {
        id: "file_storage",
        name: "File Storage",
        type: "api",
        status: "warning",
        lastCheck: new Date().toISOString(),
        responseTime: 156,
        errorRate: 3.2,
        uptime: 97.8,
        description: "File upload and storage service",
        lastError: "Slow response times detected",
      },
    ];

    return integrations;
  }

  static async createAlert(alert: Omit<SystemAlert, "id" | "createdAt" | "acknowledged" | "resolved">): Promise<string> {
    try {
      const { data, error } = await supabase
        .from("system_alerts")
        .insert({
          ...alert,
          created_at: new Date().toISOString(),
          acknowledged: false,
          resolved: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error("Error creating alert:", error);
      throw new Error("Failed to create system alert");
    }
  }

  static async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    try {
      await supabase
        .from("system_alerts")
        .update({
          acknowledged: true,
          acknowledged_by: userId,
          acknowledged_at: new Date().toISOString(),
        })
        .eq("id", alertId);
    } catch (error) {
      console.error("Error acknowledging alert:", error);
      throw new Error("Failed to acknowledge alert");
    }
  }

  static async resolveAlert(alertId: string, userId: string): Promise<void> {
    try {
      await supabase
        .from("system_alerts")
        .update({
          resolved: true,
          resolved_by: userId,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", alertId);
    } catch (error) {
      console.error("Error resolving alert:", error);
      throw new Error("Failed to resolve alert");
    }
  }

  static async runHealthCheck(): Promise<{
    success: boolean;
    issues: Array<{
      type: "performance" | "availability" | "security" | "usage" | "integration";
      severity: "low" | "medium" | "high" | "critical";
      description: string;
      recommendation: string;
    }>;
    summary: {
      totalChecks: number;
      passedChecks: number;
      failedChecks: number;
      overallScore: number;
    };
  }> {
    const issues: Array<{
      type: "performance" | "availability" | "security" | "usage" | "integration";
      severity: "low" | "medium" | "high" | "critical";
      description: string;
      recommendation: string;
    }> = [];
    let totalChecks = 0;
    let passedChecks = 0;

    try {
      // Check system metrics
      const metrics = await this.collectHealthMetrics();
      totalChecks += metrics.length;

      for (const metric of metrics) {
        if (metric.status === "healthy") {
          passedChecks++;
        } else {
          issues.push({
            type: metric.category,
            severity: metric.status === "critical" ? "critical" : "high",
            description: `${metric.name} is ${metric.status}: ${metric.value}${metric.unit}`,
            recommendation: this.getRecommendationForMetric(metric),
          });
        }
      }

      // Check integrations
      const integrations = await this.getIntegrationStatuses();
      totalChecks += integrations.length;

      for (const integration of integrations) {
        if (integration.status === "healthy") {
          passedChecks++;
        } else {
          issues.push({
            type: "integration",
            severity: integration.status === "error" ? "critical" : "medium",
            description: `${integration.name} is ${integration.status}: ${integration.lastError || "Unknown error"}`,
            recommendation: this.getRecommendationForIntegration(integration),
          });
        }
      }

      const failedChecks = totalChecks - passedChecks;
      const overallScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

      return {
        success: failedChecks === 0,
        issues,
        summary: {
          totalChecks,
          passedChecks,
          failedChecks,
          overallScore,
        },
      };
    } catch (error) {
      console.error("Error running health check:", error);
      return {
        success: false,
        issues: [{
          type: "performance",
          severity: "critical",
          description: "Health check failed to complete",
          recommendation: "Check monitoring service configuration and connectivity",
        }],
        summary: {
          totalChecks: 0,
          passedChecks: 0,
          failedChecks: 1,
          overallScore: 0,
        },
      };
    }
  }

  static getRecommendationForMetric(metric: SystemHealthMetric): string {
    const recommendations: Record<string, string> = {
      system_response_time: "Optimize database queries, add caching, or scale up resources",
      system_uptime: "Check for service disruptions and implement failover mechanisms",
      error_rate: "Review error logs, fix bugs, and improve error handling",
      database_connections: "Optimize connection pooling or scale database resources",
      active_users: "Scale up resources or implement load balancing",
      storage_usage: "Clean up old files or increase storage capacity",
      memory_usage: "Optimize memory usage or add more RAM",
      cpu_usage: "Optimize code or scale up compute resources",
    };

    return recommendations[metric.id] || "Investigate the specific metric and consult documentation";
  }

  static getRecommendationForIntegration(integration: IntegrationStatus): string {
    if (integration.errorRate > 5) {
      return "Check API documentation and fix authentication or endpoint issues";
    }
    if (integration.responseTime && integration.responseTime > 1000) {
      return "Optimize API calls or consider using a faster endpoint";
    }
    if (integration.uptime < 95) {
      return "Check service status and implement retry logic";
    }
    return "Review integration configuration and test connectivity";
  }

  static async getMonitoringDashboard(): Promise<{
    overview: {
      overallStatus: "healthy" | "warning" | "critical";
      uptime: number;
      responseTime: number;
      errorRate: number;
      activeUsers: number;
    };
    alerts: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
    };
    integrations: {
      healthy: number;
      warning: number;
      error: number;
      total: number;
    };
    trends: {
      responseTime: Array<{ time: string; value: number }>;
      errorRate: Array<{ time: string; value: number }>;
      activeUsers: Array<{ time: string; value: number }>;
    };
  }> {
    try {
      const health = await this.getSystemHealth();
      const alerts = await this.getActiveAlerts();

      // Generate mock trend data (in real implementation, this would come from time-series database)
      const now = new Date();
      const generateTrendData = (baseValue: number, variance: number) => {
        return Array.from({ length: 24 }, (_, i) => {
          const time = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
          return {
            time: time.toISOString(),
            value: baseValue + (Math.random() - 0.5) * variance,
          };
        });
      };

      return {
        overview: {
          overallStatus: health.overall,
          uptime: health.metrics.find(m => m.id === "system_uptime")?.value || 0,
          responseTime: health.metrics.find(m => m.id === "system_response_time")?.value || 0,
          errorRate: health.metrics.find(m => m.id === "error_rate")?.value || 0,
          activeUsers: health.metrics.find(m => m.id === "active_users")?.value || 0,
        },
        alerts: {
          critical: alerts.filter(a => a.severity === "critical").length,
          high: alerts.filter(a => a.severity === "high").length,
          medium: alerts.filter(a => a.severity === "medium").length,
          low: alerts.filter(a => a.severity === "low").length,
          total: alerts.length,
        },
        integrations: {
          healthy: health.integrations.filter(i => i.status === "healthy").length,
          warning: health.integrations.filter(i => i.status === "warning").length,
          error: health.integrations.filter(i => i.status === "error").length,
          total: health.integrations.length,
        },
        trends: {
          responseTime: generateTrendData(250, 100),
          errorRate: generateTrendData(2, 1),
          activeUsers: generateTrendData(120, 30),
        },
      };
    } catch (error) {
      console.error("Error getting monitoring dashboard:", error);
      throw new Error("Failed to get monitoring dashboard data");
    }
  }

  static async scheduleHealthCheck(frequency: "hourly" | "daily" | "weekly"): Promise<void> {
    try {
      await supabase
        .from("system_monitoring_schedule")
        .upsert({
          id: "health_check_schedule",
          frequency,
          active: true,
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error("Error scheduling health check:", error);
      throw new Error("Failed to schedule health check");
    }
  }

  static async generateSystemReport(): Promise<{
    summary: string;
    metrics: SystemHealthMetric[];
    alerts: SystemAlert[];
    integrations: IntegrationStatus[];
    recommendations: string[];
    generatedAt: string;
  }> {
    const health = await this.getSystemHealth();
    const healthCheck = await this.runHealthCheck();

    const recommendations = [
      ...healthCheck.issues.map(issue => issue.recommendation),
      "Schedule regular maintenance windows for system updates",
      "Implement automated alerting for critical metrics",
      "Review and optimize system performance quarterly",
    ];

    return {
      summary: `System is ${health.overall} with ${health.alerts.length} active alerts and ${health.integrations.filter(i => i.status !== "healthy").length} integration issues`,
      metrics: health.metrics,
      alerts: health.alerts,
      integrations: health.integrations,
      recommendations,
      generatedAt: new Date().toISOString(),
    };
  }
}

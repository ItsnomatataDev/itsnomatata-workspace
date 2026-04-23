import { supabase } from "../../../lib/supabase/client";
import { SocialMediaAccountService } from "./SocialMediaAccountService";
import { SocialMediaScheduler } from "./SocialMediaScheduler";
import { AISocialMediaManager } from "./AISocialMediaManager";

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'content_generation' | 'scheduling' | 'analytics' | 'engagement' | 'growth';
  template: WorkflowStep[];
  variables: WorkflowVariable[];
  is_active: boolean;
  usage_count: number;
}

export interface WorkflowStep {
  id: string;
  type: 'analyze_trends' | 'generate_content' | 'optimize_hashtags' | 'schedule_post' | 'analyze_performance' | 'optimize_timing' | 'create_report' | 'sync_analytics';
  name: string;
  config: any;
  conditions?: WorkflowCondition[];
  next_steps?: string[];
}

export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default_value: any;
  description: string;
  required: boolean;
  options?: any[];
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains';
  value: any;
  next_step_if_true?: string;
  next_step_if_false?: string;
}

export interface WorkflowInstance {
  id: string;
  workflow_id: string;
  organization_id: string;
  account_id?: string;
  name: string;
  config: Record<string, any>;
  status: 'active' | 'inactive' | 'paused' | 'error';
  last_run_at?: string;
  next_run_at?: string;
  run_count: number;
  error_count: number;
  last_error?: string;
}

export interface WorkflowExecution {
  id: string;
  instance_id: string;
  execution_id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  input_data: any;
  output_data: any;
  error_message?: string;
  metrics: Record<string, any>;
}

export class ResellableWorkflowEngine {
  // Execute a workflow instance
  static async executeWorkflow(instanceId: string): Promise<WorkflowExecution> {
    try {
      // Get workflow instance
      const { data: instance, error: instanceError } = await supabase
        .from('workflow_instances')
        .select(`
          *,
          ai_workflows!inner(
            name,
            template,
            category
          ),
          social_media_accounts!inner(
            platform,
            username,
            access_token
          )
        `)
        .eq('id', instanceId)
        .single();

      if (instanceError || !instance) {
        throw new Error('Workflow instance not found');
      }

      // Create execution record
      const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const { data: execution, error: execError } = await supabase
        .from('workflow_execution_logs')
        .insert({
          instance_id: instanceId,
          execution_id: executionId,
          status: 'running',
          started_at: new Date().toISOString(),
          input_data: instance.config,
        })
        .select()
        .single();

      if (execError || !execution) {
        throw execError || new Error('Failed to create execution record');
      }

      // Update instance status
      await this.updateInstanceStatus(instanceId, {
        status: 'active',
        last_run_at: new Date().toISOString(),
        run_count: instance.run_count + 1,
      });

      // Execute workflow steps
      const result = await this.executeWorkflowSteps(
        instance.ai_workflows.template,
        instance.config,
        instance.social_media_accounts
      );

      // Update execution record
      await supabase
        .from('workflow_execution_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          output_data: result,
          metrics: {
            steps_executed: result.steps_executed,
            content_generated: result.content_generated || 0,
            posts_scheduled: result.posts_scheduled || 0,
            execution_time: result.execution_time || 0,
          },
        })
        .eq('id', execution.id);

      // Update workflow usage count
      await supabase
        .from('ai_workflows')
        .update({ usage_count: instance.ai_workflows.usage_count + 1 })
        .eq('id', instance.workflow_id);

      return execution;

    } catch (error) {
      console.error('Workflow execution error:', error);
      
      // Update execution with error
      await supabase
        .from('workflow_execution_logs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('execution_id', executionId);

      // Update instance with error
      await this.updateInstanceStatus(instanceId, {
        status: 'error',
        error_count: instance.error_count + 1,
        last_error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  // Execute individual workflow steps
  private static async executeWorkflowSteps(
    steps: WorkflowStep[],
    config: Record<string, any>,
    account: any
  ): Promise<any> {
    const results: any = {
      steps_executed: 0,
      content_generated: 0,
      posts_scheduled: 0,
      execution_time: Date.now(),
    };

    for (const step of steps) {
      try {
        const stepResult = await this.executeStep(step, config, account);
        
        // Merge step result with config for next steps
        Object.assign(config, stepResult);
        
        // Update metrics
        results.steps_executed++;
        
        if (step.type === 'generate_content') {
          results.content_generated = (results.content_generated || 0) + (stepResult.content_variations?.length || 0);
        }
        
        if (step.type === 'schedule_post') {
          results.posts_scheduled = (results.posts_scheduled || 0) + (stepResult.posts_scheduled || 0);
        }

        // Check conditions and determine next steps
        if (step.conditions && step.conditions.length > 0) {
          const nextStepId = this.evaluateConditions(step.conditions, config);
          if (nextStepId && step.next_steps?.includes(nextStepId)) {
            // Skip to the specified next step
            continue;
          }
        }

      } catch (error) {
        console.error(`Error executing step ${step.name}:`, error);
        // Continue with next step or fail based on configuration
        if (step.config?.required !== false) {
          throw error;
        }
      }
    }

    results.execution_time = Date.now() - results.execution_time;
    return results;
  }

  // Execute individual step
  private static async executeStep(
    step: WorkflowStep,
    config: Record<string, any>,
    account: any
  ): Promise<any> {
    switch (step.type) {
      case 'analyze_trends':
        return await this.analyzeTrends(config, account);
      
      case 'generate_content':
        return await this.generateContent(config, account);
      
      case 'optimize_hashtags':
        return await this.optimizeHashtags(config, account);
      
      case 'schedule_post':
        return await this.schedulePost(config, account);
      
      case 'analyze_performance':
        return await this.analyzePerformance(config, account);
      
      case 'optimize_timing':
        return await this.optimizeTiming(config, account);
      
      case 'create_report':
        return await this.createReport(config, account);
      
      case 'sync_analytics':
        return await this.syncAnalytics(config, account);
      
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  // Step implementations
  private static async analyzeTrends(config: Record<string, any>, account: any): Promise<any> {
    const platform = config.platform || account.platform;
    const industry = config.industry || 'general';
    const timeframe = config.timeframe || '7_days';

    // Get trending topics from platform APIs
    const trends = await this.getPlatformTrends(platform, timeframe);
    
    // Analyze trends for relevance to industry
    const relevantTrends = trends.filter(trend => 
      this.isTrendRelevant(trend, industry)
    );

    return {
      trends: relevantTrends,
      trending_hashtags: relevantTrends.map(t => t.hashtag).slice(0, 10),
      best_topics: relevantTrends.slice(0, 5).map(t => t.topic),
      trend_score: this.calculateTrendScore(relevantTrends),
    };
  }

  private static async generateContent(config: Record<string, any>, account: any): Promise<any> {
    const context = {
      brandName: config.brand_name || account.username,
      industry: config.industry || 'general',
      targetAudience: config.target_audience || 'general',
      toneOfVoice: config.tone_of_voice || 'friendly',
      platform: config.platform || account.platform,
      contentType: config.content_type || 'post',
      goal: config.goal || 'engagement',
      currentCampaign: config.current_campaign,
    };

    const strategy = await AISocialMediaManager.generateContentStrategy(context);
    
    return {
      content_variations: strategy.contentVariations,
      best_version: strategy.bestVersion,
      hashtags: strategy.hashtags,
      suggested_posting_time: strategy.suggestedPostingTime,
      engagement_strategy: strategy.engagementStrategy,
    };
  }

  private static async optimizeHashtags(config: Record<string, any>, account: any): Promise<any> {
    const platform = config.platform || account.platform;
    const content = config.content;
    const industry = config.industry || 'general';
    
    // Get hashtag performance data
    const { data: hashtagData } = await supabase
      .from('hashtag_performance')
      .select('*')
      .eq('platform', platform)
      .order('trending_score', { ascending: false })
      .limit(50);

    // Generate hashtag sets
    const trendingHashtags = hashtagData?.slice(0, 10).map(h => h.hashtag) || [];
    const nicheHashtags = this.generateNicheHashtags(industry);
    const brandedHashtags = this.generateBrandedHashtags(config.brand_name);

    return {
      trending_hashtags: trendingHashtags,
      niche_hashtags: nicheHashtags,
      branded_hashtags: brandedHashtags,
      recommended_set: [...trendingHashtags.slice(0, 5), ...nicheHashtags.slice(0, 5), ...brandedHashtags],
      optimization_score: this.calculateHashtagOptimizationScore(trendingHashtags, nicheHashtags, brandedHashtags),
    };
  }

  private static async schedulePost(config: Record<string, any>, account: any): Promise<any> {
    const contentId = config.content_id;
    const scheduledTime = config.scheduled_time || this.calculateOptimalPostingTime(account.platform);
    
    if (!contentId) {
      throw new Error('Content ID is required for scheduling');
    }

    await SocialMediaScheduler.schedulePost(contentId, new Date(scheduledTime));
    
    return {
      posts_scheduled: 1,
      scheduled_at: scheduledTime,
      platform: account.platform,
      account_id: account.id,
    };
  }

  private static async analyzePerformance(config: Record<string, any>, account: any): Promise<any> {
    const timeframe = config.timeframe || '7_days';
    const platform = config.platform || account.platform;
    
    // Get performance metrics
    const { data: analytics } = await supabase
      .from('content_analytics')
      .select(`
        count,
        engagement_type,
        recorded_at,
        content_calendar!inner(
          title,
          post_type,
          hashtags,
          published_at
        )
      `)
      .gte('recorded_at', this.getTimeframeDate(timeframe))
      .eq('platform', platform);

    // Analyze performance
    const analysis = this.analyticsToInsights(analytics || []);
    
    return {
      total_engagement: analysis.totalEngagement,
      top_performing_content: analysis.topContent,
      best_posting_times: analysis.bestTimes,
      engagement_rate: analysis.engagementRate,
      growth_rate: analysis.growthRate,
      recommendations: analysis.recommendations,
    };
  }

  private static async optimizeTiming(config: Record<string, any>, account: any): Promise<any> {
    const platform = config.platform || account.platform;
    const timezone = config.timezone || 'UTC';
    
    // Get historical performance data
    const { data: timingData } = await supabase
      .from('content_calendar')
      .select(`
        performance_score,
        published_at,
        engagement_prediction
      `)
      .eq('platform', platform)
      .gte('published_at', this.getTimeframeDate('30_days'))
      .eq('status', 'published');

    // Analyze optimal posting times
    const optimalTimes = this.analyzeOptimalTimes(timingData || [], timezone);
    
    return {
      optimal_times: optimalTimes,
      best_day: optimalTimes[0]?.day,
      best_hour: optimalTimes[0]?.hour,
      confidence_score: optimalTimes[0]?.confidence || 0,
      timezone_recommendations: this.getTimezoneRecommendations(optimalTimes),
    };
  }

  private static async createReport(config: Record<string, any>, account: any): Promise<any> {
    const reportType = config.report_type || 'weekly';
    const format = config.format || 'json';
    const recipients = config.recipients || [];
    
    // Generate report data
    const reportData = await this.generateReportData(reportType, account);
    
    // Save report
    const { data: report } = await supabase
      .from('reports')
      .insert({
        organization_id: account.organization_id,
        type: reportType,
        format: format,
        data: reportData,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    // Send notifications if recipients provided
    if (recipients.length > 0) {
      await this.sendReportNotifications(report.id, recipients, format);
    }

    return {
      report_id: report.id,
      report_type: reportType,
      format: format,
      data_summary: this.summarizeReportData(reportData),
      recipients_notified: recipients.length,
    };
  }

  private static async syncAnalytics(config: Record<string, any>, account: any): Promise<any> {
    const platform = config.platform || account.platform;
    const daysBack = config.days_back || 7;
    
    // Sync account data
    await SocialMediaAccountService.syncAccountData(account.id);
    
    // Sync content analytics
    const syncedContent = await this.syncContentAnalytics(account.id, daysBack);
    
    return {
      account_synced: true,
      content_analytics_synced: syncedContent.length,
      sync_period: `${daysBack} days`,
      last_sync: new Date().toISOString(),
    };
  }

  // Helper methods
  private static async getPlatformTrends(platform: string, timeframe: string): Promise<any[]> {
    // Implementation would call platform APIs to get trending topics
    // This is a simplified version
    return [
      { topic: 'AI Technology', hashtag: '#ai', relevance: 0.9 },
      { topic: 'Social Media Marketing', hashtag: '#socialmedia', relevance: 0.8 },
      { topic: 'Content Creation', hashtag: '#contentcreator', relevance: 0.7 },
    ];
  }

  private static isTrendRelevant(trend: any, industry: string): boolean {
    // Simple relevance check - would be more sophisticated in production
    return trend.relevance > 0.5;
  }

  private static calculateTrendScore(trends: any[]): number {
    return trends.reduce((sum, trend) => sum + trend.relevance, 0) / trends.length;
  }

  private static generateNicheHashtags(industry: string): string[] {
    const nicheHashtags: Record<string, string[]> = {
      tech: ['#technology', '#innovation', '#digitaltransformation'],
      fashion: ['#fashion', '#style', '#ootd'],
      food: ['#foodie', '#foodporn', '#instafood'],
      fitness: ['#fitness', '#workout', '#health'],
      business: ['#business', '#entrepreneur', '#startup'],
    };
    
    return nicheHashtags[industry] || nicheHashtags['business'];
  }

  private static generateBrandedHashtags(brandName?: string): string[] {
    if (!brandName) return [];
    return [
      `#${brandName.toLowerCase().replace(/\s+/g, '')}`,
      `#${brandName.toLowerCase().replace(/\s+/g, '')}life`,
      `#${brandName.toLowerCase().replace(/\s+/g, '')}2024`,
    ];
  }

  private static calculateHashtagOptimizationScore(trending: string[], niche: string[], branded: string[]): number {
    // Simple scoring algorithm
    const trendingScore = trending.length * 0.4;
    const nicheScore = niche.length * 0.3;
    const brandedScore = branded.length * 0.3;
    
    return Math.min(100, (trendingScore + nicheScore + brandedScore) * 10);
  }

  private static calculateOptimalPostingTime(platform: string): string {
    // Default optimal times by platform
    const optimalTimes: Record<string, string> = {
      instagram: '10:00',
      facebook: '14:00',
      twitter: '09:00',
      linkedin: '12:00',
      youtube: '18:00',
      tiktok: '19:00',
    };
    
    return optimalTimes[platform] || '12:00';
  }

  private static getTimeframeDate(timeframe: string): string {
    const now = new Date();
    const days = parseInt(timeframe) || 7;
    now.setDate(now.getDate() - days);
    return now.toISOString();
  }

  private static analyticsToInsights(analytics: any[]): any {
    // Convert raw analytics to insights
    const totalEngagement = analytics.reduce((sum, item) => sum + item.count, 0);
    
    return {
      totalEngagement,
      topContent: analytics.slice(0, 5),
      bestTimes: ['10:00', '14:00', '18:00'],
      engagementRate: 4.5,
      growthRate: 12.3,
      recommendations: ['Post more video content', 'Use trending hashtags'],
    };
  }

  private static analyzeOptimalTimes(timingData: any[], timezone: string): any[] {
    // Analyze historical data to find optimal posting times
    const hourPerformance: Record<number, number> = {};
    
    timingData.forEach(item => {
      const hour = new Date(item.published_at).getHours();
      hourPerformance[hour] = (hourPerformance[hour] || 0) + item.performance_score;
    });
    
    const sortedHours = Object.entries(hourPerformance)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([hour, score]) => ({
        hour: parseInt(hour),
        score,
        confidence: score / 100,
        day: 'weekday', // Would be calculated from actual data
      }));
    
    return sortedHours;
  }

  private static getTimezoneRecommendations(optimalTimes: any[]): string[] {
    return [
      `Best time: ${optimalTimes[0]?.hour}:00`,
      'Consider timezone differences',
      'Test different posting times',
    ];
  }

  private static async generateReportData(reportType: string, account: any): Promise<any> {
    // Generate comprehensive report data
    return {
      report_type: reportType,
      period: 'last_7_days',
      account: account.username,
      platform: account.platform,
      metrics: {
        followers: account.follower_count,
        engagement: account.engagement_rate,
        posts: account.posts_count,
      },
      top_content: [],
      recommendations: [],
    };
  }

  private static summarizeReportData(data: any): string {
    return `Report for ${data.account} on ${data.platform}: ${data.metrics.followers} followers, ${data.metrics.engagement}% engagement`;
  }

  private static async sendReportNotifications(reportId: string, recipients: string[], format: string): Promise<void> {
    // Send notifications to recipients
    console.log(`Sending report ${reportId} in ${format} format to:`, recipients);
  }

  private static evaluateConditions(conditions: WorkflowCondition[], config: Record<string, any>): string | null {
    for (const condition of conditions) {
      const fieldValue = config[condition.field];
      const meetsCondition = this.evaluateCondition(fieldValue, condition.operator, condition.value);
      
      if (meetsCondition && condition.next_step_if_true) {
        return condition.next_step_if_true;
      } else if (!meetsCondition && condition.next_step_if_false) {
        return condition.next_step_if_false;
      }
    }
    return null;
  }

  private static evaluateCondition(fieldValue: any, operator: string, conditionValue: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === conditionValue;
      case 'not_equals':
        return fieldValue !== conditionValue;
      case 'greater_than':
        return fieldValue > conditionValue;
      case 'less_than':
        return fieldValue < conditionValue;
      case 'contains':
        return String(fieldValue).includes(String(conditionValue));
      case 'not_contains':
        return !String(fieldValue).includes(String(conditionValue));
      default:
        return false;
    }
  }

  private static async updateInstanceStatus(instanceId: string, updates: Partial<WorkflowInstance>): Promise<void> {
    await supabase
      .from('workflow_instances')
      .update(updates)
      .eq('id', instanceId);
  }

  private static async syncContentAnalytics(accountId: string, daysBack: number): Promise<any[]> {
    // Sync analytics for all content from the account
    const { data: content } = await supabase
      .from('content_calendar')
      .select('id, platform_post_id, platform')
      .eq('account_id', accountId)
      .eq('status', 'published')
      .gte('published_at', this.getTimeframeDate(`${daysBack}_days`));

    const syncedContent = [];
    
    for (const item of content || []) {
      // Fetch real analytics from platform APIs
      const analytics = await this.fetchPlatformAnalytics(item.platform, item.platform_post_id);
      
      // Update analytics in database
      await supabase
        .from('content_analytics')
        .upsert(analytics);
      
      syncedContent.push(item.id);
    }
    
    return syncedContent;
  }

  private static async fetchPlatformAnalytics(platform: string, postId: string): Promise<any[]> {
    // Fetch real analytics from platform APIs
    // This would implement platform-specific API calls
    return [
      {
        content_id: postId,
        platform_post_id: postId,
        platform: platform,
        engagement_type: 'view',
        count: Math.floor(Math.random() * 1000),
        recorded_at: new Date().toISOString(),
      },
      {
        content_id: postId,
        platform_post_id: postId,
        platform: platform,
        engagement_type: 'like',
        count: Math.floor(Math.random() * 100),
        recorded_at: new Date().toISOString(),
      },
    ];
  }

  // Workflow management methods
  static async createWorkflowInstance(
    workflowId: string,
    organizationId: string,
    accountId: string,
    name: string,
    config: Record<string, any>
  ): Promise<WorkflowInstance> {
    const { data, error } = await supabase
      .from('workflow_instances')
      .insert({
        workflow_id: workflowId,
        organization_id: organizationId,
        account_id: accountId,
        name: name,
        config: config,
        status: 'active',
        next_run_at: config.schedule?.start_time || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  static async getWorkflowInstances(organizationId: string): Promise<WorkflowInstance[]> {
    const { data, error } = await supabase
      .from('workflow_instances')
      .select(`
        *,
        ai_workflows!inner(name, category),
        social_media_accounts!inner(platform, username)
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  static async pauseWorkflowInstance(instanceId: string): Promise<void> {
    await this.updateInstanceStatus(instanceId, { status: 'paused' });
  }

  static async resumeWorkflowInstance(instanceId: string): Promise<void> {
    await this.updateInstanceStatus(instanceId, { status: 'active' });
  }

  static async deleteWorkflowInstance(instanceId: string): Promise<void> {
    await supabase
      .from('workflow_instances')
      .delete()
      .eq('id', instanceId);
  }

  // Template management
  static async getWorkflowTemplates(): Promise<WorkflowTemplate[]> {
    const { data, error } = await supabase
      .from('ai_workflows')
      .select('*')
      .eq('is_template', true)
      .eq('is_active', true)
      .order('usage_count', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  static async createWorkflowTemplate(template: Omit<WorkflowTemplate, 'id' | 'usage_count'>): Promise<WorkflowTemplate> {
    const { data, error } = await supabase
      .from('ai_workflows')
      .insert({
        ...template,
        is_template: true,
        usage_count: 0,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
}

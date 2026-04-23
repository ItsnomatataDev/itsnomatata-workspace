-- Social Media Management System Database Schema
-- Production-ready schema for multi-tenant social media management

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Social Media Platforms Enum
CREATE TYPE social_platform AS ENUM (
    'facebook',
    'instagram', 
    'twitter',
    'linkedin',
    'youtube',
    'tiktok'
);

-- Content Status Enum
CREATE TYPE content_status AS ENUM (
    'draft',
    'scheduled',
    'processing',
    'published',
    'failed',
    'archived'
);

-- Post Type Enum
CREATE TYPE post_type AS ENUM (
    'post',
    'reel',
    'story',
    'carousel',
    'video',
    'image',
    'text'
);

-- Engagement Type Enum
CREATE TYPE engagement_type AS ENUM (
    'like',
    'comment',
    'share',
    'save',
    'view',
    'click'
);

-- Workflow Status Enum
CREATE TYPE workflow_status AS ENUM (
    'active',
    'inactive',
    'paused',
    'error'
);

-- Organizations Table (create if not exists)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    website TEXT,
    settings JSONB DEFAULT '{}',
    social_media_enabled BOOLEAN DEFAULT false,
    social_media_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add columns if organizations table already exists
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS social_media_enabled BOOLEAN DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS social_media_settings JSONB DEFAULT '{}';

-- Social Media Accounts Table
CREATE TABLE social_media_accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    platform social_platform NOT NULL,
    account_id TEXT NOT NULL, -- Platform-specific account ID
    username TEXT NOT NULL,
    display_name TEXT,
    profile_image_url TEXT,
    access_token TEXT, -- Encrypted OAuth token
    refresh_token TEXT, -- Encrypted refresh token
    token_expires_at TIMESTAMP WITH TIME ZONE,
    api_key TEXT, -- For platforms using API keys
    api_secret TEXT, -- Encrypted API secret
    webhook_secret TEXT, -- For webhook verification
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    follower_count BIGINT DEFAULT 0,
    following_count BIGINT DEFAULT 0,
    posts_count BIGINT DEFAULT 0,
    engagement_rate DECIMAL(5,2) DEFAULT 0,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status TEXT DEFAULT 'pending',
    platform_data JSONB DEFAULT '{}', -- Platform-specific data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    UNIQUE(organization_id, platform, account_id)
);

-- Content Campaigns Table
CREATE TABLE content_campaigns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    goal TEXT, -- Primary campaign goal
    target_audience TEXT,
    brand_voice TEXT, -- Brand voice guidelines
    hashtag_strategy JSONB DEFAULT '{}',
    start_date DATE,
    end_date DATE,
    budget DECIMAL(10,2),
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Content Calendar Table
CREATE TABLE content_calendar (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    campaign_id UUID REFERENCES content_campaigns(id) ON DELETE SET NULL,
    account_id UUID REFERENCES social_media_accounts(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    post_type post_type NOT NULL,
    platform social_platform NOT NULL,
    status content_status DEFAULT 'draft',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    hashtags TEXT[] DEFAULT '{}',
    mentions TEXT[] DEFAULT '{}',
    media_urls TEXT[] DEFAULT '{}',
    media_metadata JSONB DEFAULT '{}',
    location_data JSONB DEFAULT '{}',
    targeting JSONB DEFAULT '{}', -- Audience targeting options
    engagement_prediction DECIMAL(5,2), -- AI-predicted engagement rate
    performance_score DECIMAL(5,2), -- Actual performance score
    cost_per_engagement DECIMAL(8,2),
    ai_generated BOOLEAN DEFAULT false,
    ai_version TEXT, -- AI model version used
    workflow_id UUID, -- Link to workflow if auto-generated
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Content Analytics Table
CREATE TABLE content_analytics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content_id UUID REFERENCES content_calendar(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES social_media_accounts(id) ON DELETE CASCADE NOT NULL,
    platform social_platform NOT NULL,
    platform_post_id TEXT, -- ID of post on platform
    engagement_type engagement_type NOT NULL,
    count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}', -- Additional engagement data
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    UNIQUE(content_id, platform, platform_post_id, engagement_type)
);

-- Hashtag Performance Table
CREATE TABLE hashtag_performance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    hashtag TEXT NOT NULL,
    platform social_platform NOT NULL,
    usage_count INTEGER DEFAULT 0,
    total_engagement BIGINT DEFAULT 0,
    avg_engagement_rate DECIMAL(5,2) DEFAULT 0,
    trending_score DECIMAL(5,2) DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    UNIQUE(organization_id, hashtag, platform)
);

-- AI Workflows Table (Resellable Templates)
CREATE TABLE ai_workflows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 'content_generation', 'scheduling', 'analytics', etc.
    template JSONB NOT NULL, -- Workflow template definition
    variables JSONB DEFAULT '{}', -- Configurable variables
    is_template BOOLEAN DEFAULT true, -- Template vs instance
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- AI Workflow Instances Table
CREATE TABLE workflow_instances (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workflow_id UUID REFERENCES ai_workflows(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES social_media_accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    config JSONB NOT NULL, -- Instance-specific configuration
    status workflow_status DEFAULT 'active',
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    run_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Workflow Execution Logs Table
CREATE TABLE workflow_execution_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    instance_id UUID REFERENCES workflow_instances(id) ON DELETE CASCADE NOT NULL,
    execution_id TEXT NOT NULL,
    status TEXT NOT NULL, -- 'running', 'completed', 'failed'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Content Templates Table
CREATE TABLE content_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    platform social_platform NOT NULL,
    post_type post_type NOT NULL,
    template_content JSONB NOT NULL, -- Template structure with variables
    variables JSONB DEFAULT '{}', -- Template variables definition
    is_public BOOLEAN DEFAULT false, -- Shareable within organization
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Scheduled Posts Queue Table
CREATE TABLE scheduled_posts_queue (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content_id UUID REFERENCES content_calendar(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES social_media_accounts(id) ON DELETE CASCADE NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    next_attempt_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    platform_response JSONB, -- Response from platform API
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Social Media Settings Table
CREATE TABLE social_media_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    UNIQUE(organization_id, key)
);

-- Indexes for Performance
CREATE INDEX idx_social_media_accounts_org_platform ON social_media_accounts(organization_id, platform);
CREATE INDEX idx_social_media_accounts_user ON social_media_accounts(user_id);
CREATE INDEX idx_content_calendar_org ON content_calendar(organization_id);
CREATE INDEX idx_content_calendar_account ON content_calendar(account_id);
CREATE INDEX idx_content_calendar_scheduled ON content_calendar(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_content_calendar_status ON content_calendar(status);
CREATE INDEX idx_content_analytics_content ON content_analytics(content_id);
CREATE INDEX idx_content_analytics_account ON content_analytics(account_id);
CREATE INDEX idx_hashtag_performance_org ON hashtag_performance(organization_id);
CREATE INDEX idx_workflow_instances_org ON workflow_instances(organization_id);
CREATE INDEX idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX idx_workflow_instances_next_run ON workflow_instances(next_run_at) WHERE status = 'active';
CREATE INDEX idx_scheduled_posts_queue_scheduled ON scheduled_posts_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_scheduled_posts_queue_status ON scheduled_posts_queue(status);

-- Row Level Security Policies

-- Social Media Accounts
ALTER TABLE social_media_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own organization accounts" ON social_media_accounts
    FOR SELECT USING (organization_id = current_setting('app.current_organization_id')::uuid);
CREATE POLICY "Users can insert own organization accounts" ON social_media_accounts
    FOR INSERT WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);
CREATE POLICY "Users can update own organization accounts" ON social_media_accounts
    FOR UPDATE USING (organization_id = current_setting('app.current_organization_id')::uuid);
CREATE POLICY "Users can delete own organization accounts" ON social_media_accounts
    FOR DELETE USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Content Campaigns
ALTER TABLE content_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own organization campaigns" ON content_campaigns
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Content Calendar
ALTER TABLE content_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own organization content" ON content_calendar
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Content Analytics
ALTER TABLE content_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own organization analytics" ON content_analytics
    FOR SELECT USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Workflow Instances
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own organization workflows" ON workflow_instances
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Content Templates
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own organization templates" ON content_templates
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Functions and Triggers

-- Update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_social_media_accounts_updated_at BEFORE UPDATE ON social_media_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_campaigns_updated_at BEFORE UPDATE ON content_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_calendar_updated_at BEFORE UPDATE ON content_calendar
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hashtag_performance_updated_at BEFORE UPDATE ON hashtag_performance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflow_instances_updated_at BEFORE UPDATE ON workflow_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_templates_updated_at BEFORE UPDATE ON content_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_social_media_settings_updated_at BEFORE UPDATE ON social_media_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate engagement rate
CREATE OR REPLACE FUNCTION calculate_engagement_rate(
    p_likes BIGINT DEFAULT 0,
    p_comments BIGINT DEFAULT 0,
    p_shares BIGINT DEFAULT 0,
    p_followers BIGINT DEFAULT 1
) RETURNS DECIMAL(5,2) AS $$
BEGIN
    RETURN CASE 
        WHEN p_followers = 0 THEN 0
        ELSE ROUND(((p_likes + p_comments + p_shares) * 100.0 / p_followers), 2)
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to get best posting times
CREATE OR REPLACE FUNCTION get_best_posting_times(
    p_organization_id UUID,
    p_platform social_platform,
    p_days INTEGER DEFAULT 7
) RETURNS TABLE (
    hour INTEGER,
    engagement_rate DECIMAL(5,2),
    post_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXTRACT(HOUR FROM ca.published_at) AS hour,
        AVG(ca.performance_score) AS engagement_rate,
        COUNT(*) AS post_count
    FROM content_calendar ca
    JOIN social_media_accounts sma ON ca.account_id = sma.id
    WHERE ca.organization_id = p_organization_id
        AND sma.platform = p_platform
        AND ca.status = 'published'
        AND ca.published_at >= NOW() - INTERVAL '1 day' * p_days
        AND ca.published_at <= NOW()
    GROUP BY EXTRACT(HOUR FROM ca.published_at)
    HAVING COUNT(*) >= 3 -- Minimum posts for statistical significance
    ORDER BY engagement_rate DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- Function to create scheduled post queue entry
CREATE OR REPLACE FUNCTION enqueue_scheduled_post(
    p_content_id UUID
) RETURNS UUID AS $$
DECLARE
    v_queue_id UUID;
BEGIN
    INSERT INTO scheduled_posts_queue (content_id, account_id, scheduled_at)
    SELECT 
        p_content_id,
        account_id,
        scheduled_at
    FROM content_calendar
    WHERE id = p_content_id AND status = 'scheduled'
    RETURNING id INTO v_queue_id;
    
    RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql;

-- Insert default AI workflow templates
INSERT INTO ai_workflows (name, description, category, template, variables) VALUES
(
    'Daily Content Generator',
    'Automatically generates daily social media content based on brand voice and trends',
    'content_generation',
    '{
        "steps": [
            {
                "type": "analyze_trends",
                "platform": "{{platform}}",
                "industry": "{{industry}}",
                "brand_voice": "{{brand_voice}}"
            },
            {
                "type": "generate_content",
                "variations": 3,
                "post_type": "{{post_type}}",
                "goal": "{{goal}}"
            },
            {
                "type": "optimize_hashtags",
                "count": 15,
                "mix": ["trending", "niche", "branded"]
            },
            {
                "type": "schedule_post",
                "time": "{{optimal_time}}",
                "auto_approve": false
            }
        ]
    }',
    '{
        "platform": "instagram",
        "industry": "general",
        "brand_voice": "friendly",
        "post_type": "post",
        "goal": "engagement",
        "optimal_time": "10:00"
    }'
),
(
    'Weekly Analytics Reporter',
    'Generates weekly performance reports and optimization recommendations',
    'analytics',
    '{
        "steps": [
            {
                "type": "gather_metrics",
                "period": "7_days",
                "platforms": ["{{platforms}}"]
            },
            {
                "type": "analyze_performance",
                "compare_previous": true
            },
            {
                "type": "generate_insights",
                "focus_areas": ["engagement", "growth", "content"]
            },
            {
                "type": "create_report",
                "format": "pdf",
                "recipients": ["{{recipients}}"]
            }
        ]
    }',
    '{
        "platforms": ["instagram", "facebook"],
        "recipients": ["manager@company.com"]
    }'
),
(
    'Smart Scheduler',
    'Optimizes posting schedule based on audience behavior and platform algorithms',
    'scheduling',
    '{
        "steps": [
            {
                "type": "analyze_audience",
                "timezone": "{{timezone}}",
                "platform": "{{platform}}"
            },
            {
                "type": "determine_optimal_times",
                "lookback_days": 30,
                "min_posts_per_hour": 3
            },
            {
                "type": "batch_schedule",
                "content_pool": "{{content_pool}}",
                "frequency": "{{frequency}}"
            }
        ]
    }',
    '{
        "timezone": "UTC",
        "platform": "instagram",
        "content_pool": "draft_posts",
        "frequency": "daily"
    }'
);

-- Create default social media settings
INSERT INTO social_media_settings (organization_id, key, value, description) VALUES
('00000000-0000-0000-0000-000000000000', 'auto_approve_posts', 'false', 'Automatically approve AI-generated posts'),
('00000000-0000-0000-0000-000000000000', 'max_daily_posts', '5', 'Maximum posts per day per platform'),
('00000000-0000-0000-0000-000000000000', 'engagement_threshold', '2.5', 'Minimum engagement rate threshold'),
('00000000-0000-0000-0000-000000000000', 'retry_failed_posts', 'true', 'Automatically retry failed posts'),
('00000000-0000-0000-0000-000000000000', 'analytics_retention_days', '365', 'Days to retain analytics data');

COMMIT;

-- Social Media Management System Database Schema - FIXED VERSION
-- This version handles existing database structures

-- First, let's check if we need to use 'clients' instead of 'organizations'
-- Based on the existing migrations, it seems like 'clients' might be the correct table

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

-- Check if organizations table exists, if not, create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
        CREATE TABLE organizations (
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
    END IF;
END $$;

-- Add columns to organizations table if they don't exist
DO $$
BEGIN
    -- Check if column exists before adding
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'social_media_enabled') THEN
        ALTER TABLE organizations ADD COLUMN social_media_enabled BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'social_media_settings') THEN
        ALTER TABLE organizations ADD COLUMN social_media_settings JSONB DEFAULT '{}';
    END IF;
END $$;

-- Social Media Accounts Table
CREATE TABLE IF NOT EXISTS social_media_accounts (
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
CREATE TABLE IF NOT EXISTS content_campaigns (
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
CREATE TABLE IF NOT EXISTS content_calendar (
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
CREATE TABLE IF NOT EXISTS content_analytics (
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
CREATE TABLE IF NOT EXISTS hashtag_performance (
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
CREATE TABLE IF NOT EXISTS ai_workflows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL for global templates
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
CREATE TABLE IF NOT EXISTS workflow_instances (
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
CREATE TABLE IF NOT EXISTS workflow_execution_logs (
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
CREATE TABLE IF NOT EXISTS content_templates (
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
CREATE TABLE IF NOT EXISTS scheduled_posts_queue (
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
CREATE TABLE IF NOT EXISTS social_media_settings (
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_media_accounts_org_platform ON social_media_accounts(organization_id, platform);
CREATE INDEX IF NOT EXISTS idx_social_media_accounts_user ON social_media_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_content_calendar_org ON content_calendar(organization_id);
CREATE INDEX IF NOT EXISTS idx_content_calendar_account ON content_calendar(account_id);
CREATE INDEX IF NOT EXISTS idx_content_calendar_scheduled ON content_calendar(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_content_calendar_status ON content_calendar(status);
CREATE INDEX IF NOT EXISTS idx_content_analytics_content ON content_analytics(content_id);
CREATE INDEX IF NOT EXISTS idx_content_analytics_account ON content_analytics(account_id);
CREATE INDEX IF NOT EXISTS idx_hashtag_performance_org ON hashtag_performance(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_org ON workflow_instances(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_next_run ON workflow_instances(next_run_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_queue_scheduled ON scheduled_posts_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_queue_status ON scheduled_posts_queue(status);

-- Update updated_at function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DO $$
BEGIN
    -- Only create triggers if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_organizations_updated_at') THEN
        CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_social_media_accounts_updated_at') THEN
        CREATE TRIGGER update_social_media_accounts_updated_at BEFORE UPDATE ON social_media_accounts
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_content_campaigns_updated_at') THEN
        CREATE TRIGGER update_content_campaigns_updated_at BEFORE UPDATE ON content_campaigns
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_content_calendar_updated_at') THEN
        CREATE TRIGGER update_content_calendar_updated_at BEFORE UPDATE ON content_calendar
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_hashtag_performance_updated_at') THEN
        CREATE TRIGGER update_hashtag_performance_updated_at BEFORE UPDATE ON hashtag_performance
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_workflow_instances_updated_at') THEN
        CREATE TRIGGER update_workflow_instances_updated_at BEFORE UPDATE ON workflow_instances
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_content_templates_updated_at') THEN
        CREATE TRIGGER update_content_templates_updated_at BEFORE UPDATE ON content_templates
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_social_media_settings_updated_at') THEN
        CREATE TRIGGER update_social_media_settings_updated_at BEFORE UPDATE ON social_media_settings
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

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

-- Insert default AI workflow templates (global templates - organization_id = NULL)
INSERT INTO ai_workflows (organization_id, name, description, category, template, variables)
SELECT 
    NULL,
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
WHERE NOT EXISTS (SELECT 1 FROM ai_workflows WHERE name = 'Daily Content Generator');

INSERT INTO ai_workflows (organization_id, name, description, category, template, variables)
SELECT 
    NULL,
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
WHERE NOT EXISTS (SELECT 1 FROM ai_workflows WHERE name = 'Weekly Analytics Reporter');

INSERT INTO ai_workflows (organization_id, name, description, category, template, variables)
SELECT 
    NULL,
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
WHERE NOT EXISTS (SELECT 1 FROM ai_workflows WHERE name = 'Smart Scheduler');

-- Note: Default social media settings will be created when organizations are added
-- This avoids foreign key constraint violations with non-existent organization IDs

COMMIT;

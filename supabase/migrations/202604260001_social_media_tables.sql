create table public.social_media_accounts (
  id uuid not null default extensions.uuid_generate_v4 (),
  organization_id uuid not null,
  user_id uuid not null,
  platform public.social_platform not null,
  account_id text not null,
  username text not null,
  display_name text null,
  profile_image_url text null,
  access_token text null,
  refresh_token text null,
  token_expires_at timestamp with time zone null,
  api_key text null,
  api_secret text null,
  webhook_secret text null,
  is_active boolean null default true,
  is_verified boolean null default false,
  follower_count bigint null default 0,
  following_count bigint null default 0,
  posts_count bigint null default 0,
  engagement_rate numeric(5, 2) null default 0,
  last_sync_at timestamp with time zone null,
  sync_status text null default 'pending'::text,
  platform_data jsonb null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint social_media_accounts_pkey primary key (id),
  constraint social_media_accounts_organization_id_platform_account_id_key unique (organization_id, platform, account_id),
  constraint social_media_accounts_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint social_media_accounts_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_social_media_accounts_org_platform on public.social_media_accounts using btree (organization_id, platform) TABLESPACE pg_default;

create index IF not exists idx_social_media_accounts_user on public.social_media_accounts using btree (user_id) TABLESPACE pg_default;

create trigger update_social_media_accounts_updated_at BEFORE
update on social_media_accounts for EACH row
execute FUNCTION update_updated_at_column ();

create table public.social_media_settings (
  id uuid not null default extensions.uuid_generate_v4 (),
  organization_id uuid not null,
  key text not null,
  value jsonb not null,
  description text null,
  is_public boolean null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint social_media_settings_pkey primary key (id),
  constraint social_media_settings_organization_id_key_key unique (organization_id, key),
  constraint social_media_settings_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger update_social_media_settings_updated_at BEFORE
update on social_media_settings for EACH row
execute FUNCTION update_updated_at_column ();

create table public.social_post_assets (
  id uuid not null default gen_random_uuid (),
  social_post_id uuid not null,
  content_asset_id uuid not null,
  sort_order integer not null default 0,
  notes text null,
  created_at timestamp with time zone not null default now(),
  constraint social_post_assets_pkey primary key (id),
  constraint social_post_assets_unique unique (social_post_id, content_asset_id),
  constraint social_post_assets_content_asset_id_fkey foreign KEY (content_asset_id) references content_assets (id) on delete CASCADE,
  constraint social_post_assets_social_post_id_fkey foreign KEY (social_post_id) references social_posts (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_social_post_assets_post on public.social_post_assets using btree (social_post_id, sort_order) TABLESPACE pg_default;

create table public.social_posts (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  client_id uuid null,
  campaign_id uuid null,
  title text not null,
  body text null,
  platform text not null,
  status text not null default 'draft'::text,
  priority text not null default 'medium'::text,
  scheduled_for timestamp with time zone null,
  estimated_hours numeric(8, 2) not null default 1,
  spent_hours numeric(8, 2) not null default 0,
  ai_angle text null,
  owner_id uuid null,
  created_by uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint social_posts_pkey primary key (id),
  constraint social_posts_client_id_fkey foreign KEY (client_id) references clients (id) on delete set null,
  constraint social_posts_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint social_posts_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint social_posts_owner_id_fkey foreign KEY (owner_id) references profiles (id) on delete set null,
  constraint social_posts_campaign_id_fkey foreign KEY (campaign_id) references campaigns (id) on delete set null,
  constraint social_posts_platform_check check (
    (
      platform = any (
        array[
          'LinkedIn'::text,
          'Instagram'::text,
          'Facebook'::text,
          'X'::text,
          'TikTok'::text
        ]
      )
    )
  ),
  constraint social_posts_priority_check check (
    (
      priority = any (array['low'::text, 'medium'::text, 'high'::text])
    )
  ),
  constraint social_posts_status_check check (
    (
      status = any (
        array[
          'draft'::text,
          'review'::text,
          'approval'::text,
          'scheduled'::text,
          'published'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_social_posts_campaign on public.social_posts using btree (campaign_id) TABLESPACE pg_default;

create index IF not exists idx_social_posts_org_status on public.social_posts using btree (organization_id, status, scheduled_for) TABLESPACE pg_default;

create trigger trg_social_posts_updated_at BEFORE
update on social_posts for EACH row
execute FUNCTION set_updated_at (); 
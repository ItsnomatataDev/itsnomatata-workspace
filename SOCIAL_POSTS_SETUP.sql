
create table if not exists public.social_posts (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid null,
  campaign_id uuid null,
  title text not null,
  body text null,
  platform text not null,
  status text not null default 'draft',
  priority text not null default 'medium',
  scheduled_for timestamp with time zone null,
  estimated_hours numeric(8,2) not null default 1,
  spent_hours numeric(8,2) not null default 0,
  ai_angle text null,
  owner_id uuid null,
  created_by uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint social_posts_pkey primary key (id),
  constraint social_posts_organization_id_fkey foreign key (organization_id) references organizations (id) on delete cascade,
  constraint social_posts_client_id_fkey foreign key (client_id) references clients (id) on delete set null,
  constraint social_posts_campaign_id_fkey foreign key (campaign_id) references campaigns (id) on delete set null,
  constraint social_posts_owner_id_fkey foreign key (owner_id) references profiles (id) on delete set null,
  constraint social_posts_created_by_fkey foreign key (created_by) references profiles (id) on delete set null,
  constraint social_posts_platform_check check (
    platform in ('LinkedIn', 'Instagram', 'Facebook', 'X', 'TikTok')
  ),
  constraint social_posts_status_check check (
    status in ('draft', 'review', 'approval', 'scheduled', 'published')
  ),
  constraint social_posts_priority_check check (
    priority in ('low', 'medium', 'high')
  )
) tablespace pg_default;

-- Create indexes for better query performance
create index if not exists idx_social_posts_org_status
  on public.social_posts using btree (organization_id, status, scheduled_for)
  tablespace pg_default;

create index if not exists idx_social_posts_campaign
  on public.social_posts using btree (campaign_id)
  tablespace pg_default;

create index if not exists idx_social_posts_client
  on public.social_posts using btree (client_id)
  tablespace pg_default;

create index if not exists idx_social_posts_created_by
  on public.social_posts using btree (created_by)
  tablespace pg_default;

-- Create updated_at trigger
drop trigger if exists trg_social_posts_updated_at on public.social_posts;
create trigger trg_social_posts_updated_at
before update on public.social_posts
for each row
execute function set_updated_at();

-- Step 2: Create the social_post_assets table (for linking posts to content assets)
create table if not exists public.social_post_assets (
  id uuid not null default gen_random_uuid(),
  social_post_id uuid not null,
  content_asset_id uuid not null,
  sort_order integer not null default 0,
  notes text null,
  created_at timestamp with time zone not null default now(),
  constraint social_post_assets_pkey primary key (id),
  constraint social_post_assets_social_post_id_fkey foreign key (social_post_id) references social_posts (id) on delete cascade,
  constraint social_post_assets_content_asset_id_fkey foreign key (content_asset_id) references content_assets (id) on delete cascade,
  constraint social_post_assets_unique unique (social_post_id, content_asset_id)
) tablespace pg_default;

create index if not exists idx_social_post_assets_post
  on public.social_post_assets using btree (social_post_id, sort_order)
  tablespace pg_default;

-- Step 3: Enable Row Level Security (RLS)
alter table if exists public.social_posts enable row level security;
alter table if exists public.social_post_assets enable row level security;

-- Step 4: Create RLS Policies for social_posts
-- Allow users to view posts from their organization
create policy if not exists "users_can_view_org_social_posts"
  on public.social_posts
  for select
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- Allow users to create posts in their organization
create policy if not exists "users_can_create_org_social_posts"
  on public.social_posts
  for insert
  with check (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- Allow users to update posts in their organization
create policy if not exists "users_can_update_org_social_posts"
  on public.social_posts
  for update
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- Allow users to delete posts in their organization
create policy if not exists "users_can_delete_org_social_posts"
  on public.social_posts
  for delete
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- Step 5: Create RLS Policies for social_post_assets
-- Allow users to view post assets from their organization's posts
create policy if not exists "users_can_view_org_social_post_assets"
  on public.social_post_assets
  for select
  using (
    social_post_id in (
      select id from public.social_posts
      where organization_id in (
        select organization_id from public.profiles where id = auth.uid()
      )
    )
  );

-- Allow users to create post assets for posts in their organization
create policy if not exists "users_can_create_org_social_post_assets"
  on public.social_post_assets
  for insert
  with check (
    social_post_id in (
      select id from public.social_posts
      where organization_id in (
        select organization_id from public.profiles where id = auth.uid()
      )
    )
  );

-- Allow users to delete post assets from posts in their organization
create policy if not exists "users_can_delete_org_social_post_assets"
  on public.social_post_assets
  for delete
  using (
    social_post_id in (
      select id from public.social_posts
      where organization_id in (
        select organization_id from public.profiles where id = auth.uid()
      )
    )
  );

-- ====================================================================
-- SUCCESS: All tables, indexes, triggers, and RLS policies created!
-- ====================================================================

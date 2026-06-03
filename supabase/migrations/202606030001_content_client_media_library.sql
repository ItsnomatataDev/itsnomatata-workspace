create table if not exists public.content_client_media (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.content_clients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  office_id uuid not null references public.company_offices(id) on delete restrict,
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_name text not null,
  file_url text not null,
  storage_path text,
  mime_type text,
  asset_type text not null default 'image',
  label text,
  original_size_bytes bigint,
  stored_size_bytes bigint,
  compression_status text not null default 'not_applicable',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint content_client_media_asset_type_check check (asset_type in ('image', 'video')),
  constraint content_client_media_compression_status_check check (
    compression_status in ('compressed', 'stored_original', 'not_applicable')
  )
);

create index if not exists content_client_media_client_idx
  on public.content_client_media (client_id, created_at desc);

create index if not exists content_client_media_org_office_idx
  on public.content_client_media (organization_id, office_id, created_at desc);

alter table public.content_client_media enable row level security;

drop policy if exists "content_client_media_internal_read" on public.content_client_media;
create policy "content_client_media_internal_read"
on public.content_client_media for select
to authenticated
using (public.can_manage_content_review(organization_id, office_id));

drop policy if exists "content_client_media_internal_manage" on public.content_client_media;
create policy "content_client_media_internal_manage"
on public.content_client_media for all
to authenticated
using (public.can_manage_content_review(organization_id, office_id))
with check (public.can_manage_content_review(organization_id, office_id));

alter table public.content_review_assets
  add column if not exists library_media_id uuid references public.content_client_media(id) on delete set null;

create index if not exists content_review_assets_library_media_idx
  on public.content_review_assets (library_media_id)
  where library_media_id is not null;

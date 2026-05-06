alter table public.meetings
  add column if not exists allow_guest_access boolean not null default false,
  add column if not exists guest_code text null;

create unique index if not exists meetings_guest_code_unique_idx
  on public.meetings (guest_code)
  where guest_code is not null;

create table if not exists public.meeting_guests (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  name text not null,
  email text null,
  joined_at timestamptz null,
  left_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists meeting_guests_meeting_id_idx
  on public.meeting_guests (meeting_id, created_at desc);

alter table public.meeting_guests enable row level security;

comment on table public.meeting_guests is
  'External meeting guests. Access is intentionally mediated through the livekit-guest-token Edge Function using the service role.';

comment on column public.meetings.allow_guest_access is
  'When true, the livekit-guest-token Edge Function may issue limited guest LiveKit tokens for this meeting.';

comment on column public.meetings.guest_code is
  'Opaque public guest join code. Use this instead of exposing internal room codes.';

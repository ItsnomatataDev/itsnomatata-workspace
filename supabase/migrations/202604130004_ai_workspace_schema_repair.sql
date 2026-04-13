alter table public.ai_conversations
  add column if not exists tool_id text;

alter table public.ai_conversations
  add column if not exists metadata jsonb;

update public.ai_conversations
set metadata = '{}'::jsonb
where metadata is null;

alter table public.ai_conversations
  alter column metadata set default '{}'::jsonb;

alter table public.ai_conversations
  alter column metadata set not null;

alter table public.ai_messages
  add column if not exists type text;

update public.ai_messages
set type = 'text'
where type is null or btrim(type) = '';

alter table public.ai_messages
  alter column type set default 'text';

alter table public.ai_messages
  alter column type set not null;

alter table public.ai_messages
  add column if not exists tool_id text;

alter table public.ai_messages
  add column if not exists data jsonb;

update public.ai_messages
set data = coalesce(data, '{}'::jsonb) || coalesce(metadata, '{}'::jsonb)
where data is null or data = '{}'::jsonb;

alter table public.ai_messages
  alter column data set default '{}'::jsonb;

alter table public.ai_messages
  alter column data set not null;

alter table public.ai_messages
  add column if not exists sources jsonb;

update public.ai_messages
set sources = '[]'::jsonb
where sources is null;

alter table public.ai_messages
  alter column sources set default '[]'::jsonb;

alter table public.ai_messages
  alter column sources set not null;

alter table public.ai_messages
  add column if not exists actions jsonb;

update public.ai_messages
set actions = '[]'::jsonb
where actions is null;

alter table public.ai_messages
  alter column actions set default '[]'::jsonb;

alter table public.ai_messages
  alter column actions set not null;

alter table public.ai_messages
  add column if not exists requires_approval boolean;

update public.ai_messages
set requires_approval = false
where requires_approval is null;

alter table public.ai_messages
  alter column requires_approval set default false;

alter table public.ai_messages
  alter column requires_approval set not null;

alter table public.ai_messages
  add column if not exists approval_id uuid;

alter table public.ai_messages
  add column if not exists error boolean;

update public.ai_messages
set error = false
where error is null;
alter table public.ai_messages
alter column error set default false;
alter table public.ai_messages
alter column error set not null;
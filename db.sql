create table public.organizations (
  id uuid not null default gen_random_uuid (),
  name text not null,
  slug text not null,
  timezone text not null default 'Africa/Harare'::text,
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint organizations_pkey primary key (id),
  constraint organizations_slug_key unique (slug)
) TABLESPACE pg_default;

create trigger trg_organizations_updated_at BEFORE
update on organizations for EACH row
execute FUNCTION set_updated_at (); 

create table public.organization_members (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  user_id uuid not null,
  role public.app_role not null,
  status public.member_status not null default 'active'::member_status,
  joined_at timestamp with time zone not null default now(),
  invited_by uuid null,
  notes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint organization_members_pkey primary key (id),
  constraint organization_members_org_user_unique unique (organization_id, user_id),
  constraint organization_members_user_id_key unique (user_id),
  constraint organization_members_invited_by_fkey foreign KEY (invited_by) references profiles (id) on delete set null,
  constraint organization_members_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint organization_members_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_org_members_org on public.organization_members using btree (organization_id, role, status) TABLESPACE pg_default;

create trigger trg_organization_members_sync_profile
after INSERT
or
update on organization_members for EACH row
execute FUNCTION sync_member_to_profile ();

create trigger trg_organization_members_updated_at BEFORE
update on organization_members for EACH row
execute FUNCTION set_updated_at ();

create trigger trg_organization_members_validate_one_org BEFORE INSERT
or
update on organization_members for EACH row
execute FUNCTION validate_one_org_per_user ();


create table public.organization_invites (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  email public.citext not null,
  full_name text null,
  role public.app_role not null,
  status public.invite_status not null default 'pending'::invite_status,
  invite_token text not null default encode(extensions.gen_random_bytes (24), 'hex'::text),
  invited_by uuid null,
  invited_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone null,
  accepted_by uuid null,
  accepted_at timestamp with time zone null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint organization_invites_pkey primary key (id),
  constraint organization_invites_invite_token_key unique (invite_token),
  constraint organization_invites_accepted_by_fkey foreign KEY (accepted_by) references profiles (id) on delete set null,
  constraint organization_invites_invited_by_fkey foreign KEY (invited_by) references profiles (id) on delete set null,
  constraint organization_invites_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_org_invites_org on public.organization_invites using btree (organization_id, status) TABLESPACE pg_default;

create index IF not exists idx_org_invites_email on public.organization_invites using btree (email) TABLESPACE pg_default;

create trigger trg_organization_invites_updated_at BEFORE
update on organization_invites for EACH row
execute FUNCTION set_updated_at ();
create table public.profiles (
  id uuid not null,
  organization_id uuid null,
  email public.citext null,
  full_name text null,
  phone text null,
  avatar_url text null,
  job_title text null,
  department text null,
  primary_role public.app_role not null default 'social_media'::app_role,
  employee_code text null,
  manager_pin_hash text null,
  manager_pin_set_at timestamp with time zone null,
  manager_pin_last_changed_at timestamp with time zone null,
  last_seen_at timestamp with time zone null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_email_key unique (email),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE,
  constraint profiles_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_profiles_org on public.profiles using btree (organization_id) TABLESPACE pg_default;

create index IF not exists idx_profiles_role on public.profiles using btree (primary_role) TABLESPACE pg_default;

create trigger trg_add_user_to_default_chat_groups
after INSERT on profiles for EACH row
execute FUNCTION add_user_to_default_chat_groups ();

create trigger trg_profiles_updated_at BEFORE
update on profiles for EACH row
execute FUNCTION set_updated_at ();
create table public.clients (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  name text not null,
  slug text not null,
  industry text null,
  description text null,
  logo_url text null,
  website_url text null,
  contact_name text null,
  contact_email public.citext null,
  contact_phone text null,
  brand_voice text null,
  status public.client_status not null default 'active'::client_status,
  created_by uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint clients_pkey primary key (id),
  constraint clients_org_slug_unique unique (organization_id, slug),
  constraint clients_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint clients_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_clients_org on public.clients using btree (organization_id, status) TABLESPACE pg_default;

create trigger trg_clients_updated_at BEFORE
update on clients for EACH row
execute FUNCTION set_updated_at ();
create table public.task_checklist_items (
  id uuid not null default gen_random_uuid (),
  checklist_id uuid not null,
  task_id uuid not null,
  organization_id uuid not null,
  content text not null,
  is_completed boolean not null default false,
  completed_at timestamp with time zone null,
  completed_by uuid null,
  position integer not null default 0,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint task_checklist_items_pkey primary key (id),
  constraint task_checklist_items_checklist_id_fkey foreign KEY (checklist_id) references task_checklists (id) on delete CASCADE,
  constraint task_checklist_items_completed_by_fkey foreign KEY (completed_by) references profiles (id) on delete set null,
  constraint task_checklist_items_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint task_checklist_items_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint task_checklist_items_task_id_fkey foreign KEY (task_id) references tasks (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists task_checklist_items_checklist_id_idx on public.task_checklist_items using btree (checklist_id) TABLESPACE pg_default;

create index IF not exists task_checklist_items_task_id_idx on public.task_checklist_items using btree (task_id) TABLESPACE pg_default;

create index IF not exists task_checklist_items_org_id_idx on public.task_checklist_items using btree (organization_id) TABLESPACE pg_default;

create trigger task_checklist_items_set_updated_at BEFORE
update on task_checklist_items for EACH row
execute FUNCTION set_updated_at ();
create table public.task_checklists (
  id uuid not null default gen_random_uuid (),
  task_id uuid not null,
  organization_id uuid not null,
  title text not null,
  position integer not null default 0,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint task_checklists_pkey primary key (id),
  constraint task_checklists_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint task_checklists_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint task_checklists_task_id_fkey foreign KEY (task_id) references tasks (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists task_checklists_task_id_idx on public.task_checklists using btree (task_id) TABLESPACE pg_default;

create index IF not exists task_checklists_org_id_idx on public.task_checklists using btree (organization_id) TABLESPACE pg_default;

create trigger task_checklists_set_updated_at BEFORE
update on task_checklists for EACH row
execute FUNCTION set_updated_at ();
create table public.task_checklists (
  id uuid not null default gen_random_uuid (),
  task_id uuid not null,
  organization_id uuid not null,
  title text not null,
  position integer not null default 0,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint task_checklists_pkey primary key (id),
  constraint task_checklists_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint task_checklists_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint task_checklists_task_id_fkey foreign KEY (task_id) references tasks (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists task_checklists_task_id_idx on public.task_checklists using btree (task_id) TABLESPACE pg_default;

create index IF not exists task_checklists_org_id_idx on public.task_checklists using btree (organization_id) TABLESPACE pg_default;

create trigger task_checklists_set_updated_at BEFORE
update on task_checklists for EACH row
execute FUNCTION set_updated_at ();
create table public.task_watchers (
  id uuid not null default gen_random_uuid (),
  task_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone not null default now(),
  constraint task_watchers_pkey primary key (id),
  constraint task_watchers_unique unique (task_id, user_id),
  constraint task_watchers_task_id_fkey foreign KEY (task_id) references tasks (id) on delete CASCADE,
  constraint task_watchers_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists task_watchers_task_id_user_id_key on public.task_watchers using btree (task_id, user_id) TABLESPACE pg_default;

create table public.tasks (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  project_id uuid null,
  client_id uuid null,
  campaign_id uuid null,
  parent_task_id uuid null,
  title text not null,
  description text null,
  status public.task_status not null default 'todo'::task_status,
  priority public.task_priority not null default 'medium'::task_priority,
  assigned_to uuid null,
  assigned_by uuid null,
  created_by uuid null,
  department text null,
  due_date timestamp with time zone null,
  start_date timestamp with time zone null,
  completed_at timestamp with time zone null,
  blocked_reason text null,
  ai_generated boolean not null default false,
  position integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint tasks_pkey primary key (id),
  constraint tasks_assigned_to_fkey foreign KEY (assigned_to) references profiles (id) on delete set null,
  constraint tasks_campaign_id_fkey foreign KEY (campaign_id) references campaigns (id) on delete set null,
  constraint tasks_client_id_fkey foreign KEY (client_id) references clients (id) on delete set null,
  constraint tasks_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint tasks_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint tasks_parent_task_id_fkey foreign KEY (parent_task_id) references tasks (id) on delete CASCADE,
  constraint tasks_assigned_by_fkey foreign KEY (assigned_by) references profiles (id) on delete set null,
  constraint tasks_project_id_fkey foreign KEY (project_id) references projects (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_tasks_org_status on public.tasks using btree (organization_id, status) TABLESPACE pg_default;

create index IF not exists idx_tasks_assigned_to on public.tasks using btree (assigned_to, status) TABLESPACE pg_default;

create index IF not exists idx_tasks_project on public.tasks using btree (project_id) TABLESPACE pg_default;

create index IF not exists idx_tasks_org_assigned_status on public.tasks using btree (organization_id, assigned_to, status) TABLESPACE pg_default;

create trigger trg_tasks_updated_at BEFORE
update on tasks for EACH row
execute FUNCTION set_updated_at ();
create table public.tasks (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  project_id uuid null,
  client_id uuid null,
  campaign_id uuid null,
  parent_task_id uuid null,
  title text not null,
  description text null,
  status public.task_status not null default 'todo'::task_status,
  priority public.task_priority not null default 'medium'::task_priority,
  assigned_to uuid null,
  assigned_by uuid null,
  created_by uuid null,
  department text null,
  due_date timestamp with time zone null,
  start_date timestamp with time zone null,
  completed_at timestamp with time zone null,
  blocked_reason text null,
  ai_generated boolean not null default false,
  position integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint tasks_pkey primary key (id),
  constraint tasks_assigned_to_fkey foreign KEY (assigned_to) references profiles (id) on delete set null,
  constraint tasks_campaign_id_fkey foreign KEY (campaign_id) references campaigns (id) on delete set null,
  constraint tasks_client_id_fkey foreign KEY (client_id) references clients (id) on delete set null,
  constraint tasks_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint tasks_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint tasks_parent_task_id_fkey foreign KEY (parent_task_id) references tasks (id) on delete CASCADE,
  constraint tasks_assigned_by_fkey foreign KEY (assigned_by) references profiles (id) on delete set null,
  constraint tasks_project_id_fkey foreign KEY (project_id) references projects (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_tasks_org_status on public.tasks using btree (organization_id, status) TABLESPACE pg_default;

create index IF not exists idx_tasks_assigned_to on public.tasks using btree (assigned_to, status) TABLESPACE pg_default;

create index IF not exists idx_tasks_project on public.tasks using btree (project_id) TABLESPACE pg_default;

create index IF not exists idx_tasks_org_assigned_status on public.tasks using btree (organization_id, assigned_to, status) TABLESPACE pg_default;

create trigger trg_tasks_updated_at BEFORE
update on tasks for EACH row
execute FUNCTION set_updated_at ();
create table public.notification_deliveries (
  id uuid not null default gen_random_uuid (),
  notification_id uuid not null,
  channel public.notification_channel not null,
  destination text null,
  status text not null default 'queued'::text,
  provider text null,
  provider_message_id text null,
  error_message text null,
  attempted_at timestamp with time zone null,
  delivered_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint notification_deliveries_pkey primary key (id),
  constraint notification_deliveries_notification_id_fkey foreign KEY (notification_id) references notifications (id) on delete CASCADE
) TABLESPACE pg_default;
create table public.notification_preferences (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  user_id uuid not null,
  notification_type public.notification_type not null,
  channel public.notification_channel not null,
  is_enabled boolean not null default true,
  quiet_hours jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint notification_preferences_pkey primary key (id),
  constraint notification_preferences_unique unique (user_id, notification_type, channel),
  constraint notification_preferences_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint notification_preferences_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger trg_notification_preferences_updated_at BEFORE
update on notification_preferences for EACH row
execute FUNCTION set_updated_at ();
create table public.notifications (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  user_id uuid not null,
  type public.notification_type not null,
  title text not null,
  message text null,
  entity_type text null,
  entity_id uuid null,
  action_url text null,
  is_read boolean not null default false,
  read_at timestamp with time zone null,
  priority public.notification_priority not null default 'medium'::notification_priority,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  reference_id uuid null,
  reference_type text null,
  actor_user_id uuid null,
  constraint notifications_pkey primary key (id),
  constraint notifications_actor_user_id_fkey foreign KEY (actor_user_id) references profiles (id) on delete set null,
  constraint notifications_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint notifications_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_notifications_user_created on public.notifications using btree (user_id, created_at desc) TABLESPACE pg_default;

create index IF not exists idx_notifications_user_unread on public.notifications using btree (user_id, is_read) TABLESPACE pg_default;

create index IF not exists idx_notifications_org_created on public.notifications using btree (organization_id, created_at desc) TABLESPACE pg_default;

create index IF not exists idx_notifications_user_isread_created on public.notifications using btree (user_id, is_read, created_at desc) TABLESPACE pg_default;
create table public.approvals (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  approval_type public.approval_type not null,
  approval_status public.approval_status not null default 'pending'::approval_status,
  requested_by uuid null,
  assigned_approver uuid null,
  reviewed_by uuid null,
  request_notes text null,
  decision_notes text null,
  entity_type text null,
  entity_id uuid null,
  requested_at timestamp with time zone not null default now(),
  reviewed_at timestamp with time zone null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint approvals_pkey primary key (id),
  constraint approvals_assigned_approver_fkey foreign KEY (assigned_approver) references profiles (id) on delete set null,
  constraint approvals_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint approvals_requested_by_fkey foreign KEY (requested_by) references profiles (id) on delete set null,
  constraint approvals_reviewed_by_fkey foreign KEY (reviewed_by) references profiles (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_approvals_org_status on public.approvals using btree (organization_id, approval_status) TABLESPACE pg_default;

create index IF not exists idx_approvals_assigned on public.approvals using btree (assigned_approver, approval_status) TABLESPACE pg_default;

create trigger trg_approvals_updated_at BEFORE
update on approvals for EACH row
execute FUNCTION set_updated_at ();
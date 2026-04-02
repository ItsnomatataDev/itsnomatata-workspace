create table public.ai_activity_logs (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  user_id uuid null,
  client_id uuid null,
  campaign_id uuid null,
  task_id uuid null,
  action_name text not null,
  provider text null,
  model text null,
  prompt_text text null,
  response_text text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint ai_activity_logs_pkey primary key (id),
  constraint ai_activity_logs_campaign_id_fkey foreign KEY (campaign_id) references campaigns (id) on delete set null,
  constraint ai_activity_logs_client_id_fkey foreign KEY (client_id) references clients (id) on delete set null,
  constraint ai_activity_logs_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint ai_activity_logs_task_id_fkey foreign KEY (task_id) references tasks (id) on delete set null,
  constraint ai_activity_logs_user_id_fkey foreign KEY (user_id) references profiles (id) on delete set null
) TABLESPACE pg_default;

create table public.ai_assistant_logs (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  user_id uuid null,
  role text null,
  prompt text null,
  response text null,
  action_type text null,
  status text not null default 'completed'::text,
  created_at timestamp with time zone not null default now(),
  constraint ai_assistant_logs_pkey primary key (id),
  constraint ai_assistant_logs_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint ai_assistant_logs_user_id_fkey foreign KEY (user_id) references profiles (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_ai_logs_org on public.ai_assistant_logs using btree (organization_id) TABLESPACE pg_default;

create table public.ai_assistant_settings (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  role text not null,
  enabled boolean not null default true,
  can_trigger_automations boolean not null default false,
  can_send_messages boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint ai_assistant_settings_pkey primary key (id),
  constraint ai_assistant_settings_organization_id_role_key unique (organization_id, role),
  constraint ai_assistant_settings_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.announcements (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  title text not null,
  content text not null,
  target_roles app_role[] null,
  is_active boolean not null default true,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint announcements_pkey primary key (id),
  constraint announcements_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint announcements_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_announcements_org_created_at on public.announcements using btree (organization_id, created_at desc) TABLESPACE pg_default;

create trigger set_updated_at_announcements_trigger BEFORE
update on announcements for EACH row
execute FUNCTION set_updated_at ();

create table public.approvals (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  approval_type public.approval_type not null,
  approval_status public.approval_status not null default 'pending'::approval_status,
  client_id uuid null,
  campaign_id uuid null,
  task_id uuid null,
  social_post_id uuid null,
  asset_id uuid null,
  requested_by uuid null,
  assigned_approver uuid null,
  reviewed_by uuid null,
  request_notes text null,
  decision_notes text null,
  requested_at timestamp with time zone not null default now(),
  reviewed_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint approvals_pkey primary key (id),
  constraint approvals_assigned_approver_fkey foreign KEY (assigned_approver) references profiles (id) on delete set null,
  constraint approvals_campaign_id_fkey foreign KEY (campaign_id) references campaigns (id) on delete CASCADE,
  constraint approvals_client_id_fkey foreign KEY (client_id) references clients (id) on delete CASCADE,
  constraint approvals_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint approvals_requested_by_fkey foreign KEY (requested_by) references profiles (id) on delete set null,
  constraint approvals_reviewed_by_fkey foreign KEY (reviewed_by) references profiles (id) on delete set null,
  constraint approvals_social_post_id_fkey foreign KEY (social_post_id) references social_posts (id) on delete CASCADE,
  constraint approvals_asset_id_fkey foreign KEY (asset_id) references content_assets (id) on delete CASCADE,
  constraint approvals_task_id_fkey foreign KEY (task_id) references tasks (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger set_updated_at_approvals BEFORE
update on approvals for EACH row
execute FUNCTION set_updated_at ();

create table public.automation_flows (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  name text not null,
  slug text not null,
  description text null,
  n8n_workflow_id text null,
  is_active boolean not null default true,
  trigger_type text null,
  config jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  project_id uuid null,
  webhook_url text null,
  status text not null default 'active'::text,
  constraint automation_flows_pkey primary key (id),
  constraint automation_flows_organization_id_slug_key unique (organization_id, slug),
  constraint automation_flows_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint automation_flows_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint automation_flows_project_id_fkey foreign KEY (project_id) references projects (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_automation_flows_org on public.automation_flows using btree (organization_id) TABLESPACE pg_default;

create index IF not exists idx_automation_flows_project on public.automation_flows using btree (project_id) TABLESPACE pg_default;

create index IF not exists idx_automation_flows_status on public.automation_flows using btree (status) TABLESPACE pg_default;

create trigger set_updated_at_automation_flows BEFORE
update on automation_flows for EACH row
execute FUNCTION set_updated_at ();

create table public.automation_runs (
  id uuid not null default gen_random_uuid (),
  automation_flow_id uuid not null,
  status public.automation_run_status not null default 'success'::automation_run_status,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  error_message text null,
  started_at timestamp with time zone null,
  finished_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  organization_id uuid null,
  project_id uuid null,
  workflow_name text not null default 'Unnamed Workflow'::text,
  message text null,
  triggered_by uuid null,
  constraint automation_runs_pkey primary key (id),
  constraint automation_runs_automation_flow_id_fkey foreign KEY (automation_flow_id) references automation_flows (id) on delete CASCADE,
  constraint automation_runs_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint automation_runs_project_id_fkey foreign KEY (project_id) references projects (id) on delete set null,
  constraint automation_runs_triggered_by_fkey foreign KEY (triggered_by) references profiles (id) on delete set null
) TABLESPACE pg_default;

create table public.campaigns (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  client_id uuid not null,
  name text not null,
  description text null,
  objective text null,
  start_date date null,
  end_date date null,
  status public.campaign_status not null default 'draft'::campaign_status,
  budget numeric(12, 2) null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint campaigns_pkey primary key (id),
  constraint campaigns_client_id_fkey foreign KEY (client_id) references clients (id) on delete CASCADE,
  constraint campaigns_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint campaigns_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger set_updated_at_campaigns BEFORE
update on campaigns for EACH row
execute FUNCTION set_updated_at ();

create table public.chat_channel_members (
  id uuid not null default gen_random_uuid (),
  channel_id uuid not null,
  user_id uuid not null,
  role text not null default 'member'::text,
  joined_at timestamp with time zone not null default now(),
  constraint chat_channel_members_pkey primary key (id),
  constraint chat_channel_members_channel_id_user_id_key unique (channel_id, user_id),
  constraint chat_channel_members_channel_id_fkey foreign KEY (channel_id) references chat_channels (id) on delete CASCADE,
  constraint chat_channel_members_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.chat_channels (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  name text not null,
  slug text not null,
  description text null,
  is_private boolean not null default false,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  constraint chat_channels_pkey primary key (id),
  constraint chat_channels_organization_id_slug_key unique (organization_id, slug),
  constraint chat_channels_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint chat_channels_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_chat_channels_org on public.chat_channels using btree (organization_id) TABLESPACE pg_default;

create table public.chat_messages (
  id uuid not null default gen_random_uuid (),
  channel_id uuid not null,
  sender_id uuid not null,
  body text null,
  message_type text not null default 'text'::text,
  google_meet_url text null,
  created_at timestamp with time zone not null default now(),
  constraint chat_messages_pkey primary key (id),
  constraint chat_messages_channel_id_fkey foreign KEY (channel_id) references chat_channels (id) on delete CASCADE,
  constraint chat_messages_sender_id_fkey foreign KEY (sender_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_chat_messages_channel on public.chat_messages using btree (channel_id) TABLESPACE pg_default;

create table public.chat_messages (
  id uuid not null default gen_random_uuid (),
  channel_id uuid not null,
  sender_id uuid not null,
  body text null,
  message_type text not null default 'text'::text,
  google_meet_url text null,
  created_at timestamp with time zone not null default now(),
  constraint chat_messages_pkey primary key (id),
  constraint chat_messages_channel_id_fkey foreign KEY (channel_id) references chat_channels (id) on delete CASCADE,
  constraint chat_messages_sender_id_fkey foreign KEY (sender_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_chat_messages_channel on public.chat_messages using btree (channel_id) TABLESPACE pg_default;

create table public.clients (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  name text not null,
  slug text not null,
  industry text null,
  description text null,
  logo_url text null,
  website_url text null,
  brand_voice text null,
  status public.client_status not null default 'active'::client_status,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint clients_pkey primary key (id),
  constraint clients_organization_id_slug_key unique (organization_id, slug),
  constraint clients_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint clients_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger set_updated_at_clients BEFORE
update on clients for EACH row
execute FUNCTION set_updated_at ();

create table public.content_assets (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  client_id uuid null,
  campaign_id uuid null,
  task_id uuid null,
  uploaded_by uuid null,
  file_name text not null,
  file_path text not null,
  file_url text null,
  mime_type text null,
  asset_type public.asset_type not null default 'other'::asset_type,
  asset_status public.asset_status not null default 'uploaded'::asset_status,
  file_size bigint null,
  width integer null,
  height integer null,
  duration_seconds integer null,
  alt_text text null,
  tags text[] null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint content_assets_pkey primary key (id),
  constraint content_assets_campaign_id_fkey foreign KEY (campaign_id) references campaigns (id) on delete CASCADE,
  constraint content_assets_client_id_fkey foreign KEY (client_id) references clients (id) on delete CASCADE,
  constraint content_assets_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint content_assets_task_id_fkey foreign KEY (task_id) references tasks (id) on delete set null,
  constraint content_assets_uploaded_by_fkey foreign KEY (uploaded_by) references profiles (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_content_assets_client_id on public.content_assets using btree (client_id) TABLESPACE pg_default;

create index IF not exists idx_content_assets_campaign_id on public.content_assets using btree (campaign_id) TABLESPACE pg_default;

create trigger set_updated_at_content_assets BEFORE
update on content_assets for EACH row
execute FUNCTION set_updated_at ();
create table public.crm_companies (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  name text not null,
  industry text null,
  website text null,
  phone text null,
  email text null,
  notes text null,
  status text not null default 'active'::text,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  constraint crm_companies_pkey primary key (id),
  constraint crm_companies_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint crm_companies_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_crm_companies_org on public.crm_companies using btree (organization_id) TABLESPACE pg_default;

create table public.crm_contacts (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  company_id uuid null,
  full_name text not null,
  email text null,
  phone text null,
  position text null,
  notes text null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  constraint crm_contacts_pkey primary key (id),
  constraint crm_contacts_company_id_fkey foreign KEY (company_id) references crm_companies (id) on delete set null,
  constraint crm_contacts_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint crm_contacts_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_crm_contacts_org on public.crm_contacts using btree (organization_id) TABLESPACE pg_default;
create table public.crm_deals (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  company_id uuid null,
  contact_id uuid null,
  title text not null,
  value numeric(12, 2) null default 0,
  stage text not null default 'lead'::text,
  expected_close_date date null,
  owner_id uuid null,
  created_at timestamp with time zone not null default now(),
  constraint crm_deals_pkey primary key (id),
  constraint crm_deals_company_id_fkey foreign KEY (company_id) references crm_companies (id) on delete set null,
  constraint crm_deals_contact_id_fkey foreign KEY (contact_id) references crm_contacts (id) on delete set null,
  constraint crm_deals_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint crm_deals_owner_id_fkey foreign KEY (owner_id) references profiles (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_crm_deals_org on public.crm_deals using btree (organization_id) TABLESPACE pg_default;
create table public.duty_roster_entries (
  id uuid not null default gen_random_uuid (),
  roster_id uuid not null,
  user_id uuid not null,
  shift_date date not null,
  shift_name text not null,
  start_time time without time zone null,
  end_time time without time zone null,
  notes text null,
  created_at timestamp with time zone not null default now(),
  constraint duty_roster_entries_pkey primary key (id),
  constraint duty_roster_entries_roster_id_fkey foreign KEY (roster_id) references duty_rosters (id) on delete CASCADE,
  constraint duty_roster_entries_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_roster_entries_roster on public.duty_roster_entries using btree (roster_id) TABLESPACE pg_default;
create table public.crm_deals (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  company_id uuid null,
  contact_id uuid null,
  title text not null,
  value numeric(12, 2) null default 0,
  stage text not null default 'lead'::text,
  expected_close_date date null,
  owner_id uuid null,
  created_at timestamp with time zone not null default now(),
  constraint crm_deals_pkey primary key (id),
  constraint crm_deals_company_id_fkey foreign KEY (company_id) references crm_companies (id) on delete set null,
  constraint crm_deals_contact_id_fkey foreign KEY (contact_id) references crm_contacts (id) on delete set null,
  constraint crm_deals_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint crm_deals_owner_id_fkey foreign KEY (owner_id) references profiles (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_crm_deals_org on public.crm_deals using btree (organization_id) TABLESPACE pg_default;


create table public.duty_rosters (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  title text not null,
  department text null,
  week_start date not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  constraint duty_rosters_pkey primary key (id),
  constraint duty_rosters_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint duty_rosters_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_duty_rosters_org on public.duty_rosters using btree (organization_id) TABLESPACE pg_default;


create table public.issues (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  project_id uuid null,
  reported_by uuid null,
  assigned_to uuid null,
  title text not null,
  description text null,
  severity text not null default 'medium'::text,
  status text not null default 'open'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint issues_pkey primary key (id),
  constraint issues_assigned_to_fkey foreign KEY (assigned_to) references profiles (id) on delete set null,
  constraint issues_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint issues_project_id_fkey foreign KEY (project_id) references projects (id) on delete set null,
  constraint issues_reported_by_fkey foreign KEY (reported_by) references profiles (id) on delete set null
) TABLESPACE pg_default;

create table public.knowledge_documents (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  client_id uuid null,
  title text not null,
  document_type text null,
  content text null,
  file_url text null,
  tags text[] null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint knowledge_documents_pkey primary key (id),
  constraint knowledge_documents_client_id_fkey foreign KEY (client_id) references clients (id) on delete CASCADE,
  constraint knowledge_documents_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint knowledge_documents_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger set_updated_at_knowledge_documents BEFORE
update on knowledge_documents for EACH row
execute FUNCTION set_updated_at ();

create table public.leave_requests (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  user_id uuid not null,
  leave_type_id uuid null,
  start_date date not null,
  end_date date not null,
  reason text null,
  status text not null default 'pending'::text,
  approved_by uuid null,
  approved_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  rejection_reason text null,
  constraint leave_requests_pkey primary key (id),
  constraint leave_requests_approved_by_fkey foreign KEY (approved_by) references profiles (id) on delete set null,
  constraint leave_requests_leave_type_id_fkey foreign KEY (leave_type_id) references leave_types (id) on delete set null,
  constraint leave_requests_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint leave_requests_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_leave_requests_org on public.leave_requests using btree (organization_id) TABLESPACE pg_default;

create index IF not exists idx_leave_requests_user on public.leave_requests using btree (user_id) TABLESPACE pg_default;

create table public.leave_types (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  name text not null,
  description text null,
  default_days integer not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint leave_types_pkey primary key (id),
  constraint leave_types_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.message_attachments (
  id uuid not null default gen_random_uuid (),
  message_id uuid not null,
  file_name text not null,
  file_url text not null,
  mime_type text null,
  uploaded_at timestamp with time zone not null default now(),
  constraint message_attachments_pkey primary key (id),
  constraint message_attachments_message_id_fkey foreign KEY (message_id) references chat_messages (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.notifications (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  user_id uuid not null,
  type public.notification_type not null,
  title text not null,
  message text null,
  entity_type text null,
  entity_id uuid null,
  is_read boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint notifications_pkey primary key (id),
  constraint notifications_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint notifications_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_notifications_user_id on public.notifications using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_notifications_is_read on public.notifications using btree (is_read) TABLESPACE pg_default;

create table public.organization_invites (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  email text not null,
  full_name text null,
  role text not null,
  status text not null default 'pending'::text,
  invited_by uuid null,
  invited_at timestamp with time zone not null default now(),
  accepted_at timestamp with time zone null,
  constraint organization_invites_pkey primary key (id),
  constraint organization_invites_organization_id_email_key unique (organization_id, email),
  constraint organization_invites_invited_by_fkey foreign KEY (invited_by) references profiles (id) on delete set null,
  constraint organization_invites_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_organization_invites_org on public.organization_invites using btree (organization_id) TABLESPACE pg_default;

create index IF not exists idx_organization_invites_email on public.organization_invites using btree (email) TABLESPACE pg_default;


create table public.organization_members (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  user_id uuid not null,
  role public.app_role not null default 'social_media'::app_role,
  status public.membership_status not null default 'active'::membership_status,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint organization_members_pkey primary key (id),
  constraint organization_members_organization_id_user_id_role_key unique (organization_id, user_id, role),
  constraint organization_members_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint organization_members_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger set_updated_at_organization_members BEFORE
update on organization_members for EACH row
execute FUNCTION set_updated_at ();

create table public.organizations (
  id uuid not null default gen_random_uuid (),
  name text not null,
  slug text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint organizations_pkey primary key (id),
  constraint organizations_slug_key unique (slug)
) TABLESPACE pg_default;

create trigger set_updated_at_organizations BEFORE
update on organizations for EACH row
execute FUNCTION set_updated_at ();

create table public.profiles (
  id uuid not null,
  organization_id uuid null,
  full_name text null,
  email text null,
  phone text null,
  avatar_url text null,
  job_title text null,
  department text null,
  primary_role public.app_role not null default 'social_media'::app_role,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone null,
  constraint profiles_pkey primary key (id),
  constraint profiles_email_key unique (email),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE,
  constraint profiles_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete set null
) TABLESPACE pg_default;

create trigger set_updated_at_profiles BEFORE
update on profiles for EACH row
execute FUNCTION set_updated_at ();

create table public.project_activity (
  id uuid not null default gen_random_uuid (),
  project_id uuid not null,
  user_id uuid null,
  action text not null,
  details jsonb null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint project_activity_pkey primary key (id),
  constraint project_activity_project_id_fkey foreign KEY (project_id) references projects (id) on delete CASCADE,
  constraint project_activity_user_id_fkey foreign KEY (user_id) references profiles (id) on delete set null
) TABLESPACE pg_default;

create table public.project_invitations (
  id uuid not null default gen_random_uuid (),
  project_id uuid not null,
  organization_id uuid not null,
  email text not null,
  role text not null default 'member'::text,
  invited_by uuid not null,
  status text not null default 'pending'::text,
  token text not null,
  expires_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint project_invitations_pkey primary key (id),
  constraint project_invitations_token_key unique (token),
  constraint project_invitations_invited_by_fkey foreign KEY (invited_by) references profiles (id) on delete CASCADE,
  constraint project_invitations_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint project_invitations_project_id_fkey foreign KEY (project_id) references projects (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.project_members (
  id uuid not null default gen_random_uuid (),
  project_id uuid not null,
  user_id uuid not null,
  role text not null default 'member'::text,
  invited_by uuid null,
  joined_at timestamp with time zone null default now(),
  constraint project_members_pkey primary key (id),
  constraint project_members_project_id_user_id_key unique (project_id, user_id),
  constraint project_members_invited_by_fkey foreign KEY (invited_by) references profiles (id) on delete set null,
  constraint project_members_project_id_fkey foreign KEY (project_id) references projects (id) on delete CASCADE,
  constraint project_members_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.projects (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  created_by uuid not null,
  name text not null,
  description text null,
  status text not null default 'active'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  due_date date null,
  priority text not null default 'medium'::text,
  constraint projects_pkey primary key (id),
  constraint projects_created_by_fkey foreign KEY (created_by) references profiles (id) on delete CASCADE,
  constraint projects_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.reports (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  client_id uuid not null,
  campaign_id uuid null,
  title text not null,
  period_start date null,
  period_end date null,
  status public.report_status not null default 'draft'::report_status,
  summary text null,
  file_url text null,
  generated_by uuid null,
  approved_by uuid null,
  sent_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint reports_pkey primary key (id),
  constraint reports_approved_by_fkey foreign KEY (approved_by) references profiles (id) on delete set null,
  constraint reports_campaign_id_fkey foreign KEY (campaign_id) references campaigns (id) on delete set null,
  constraint reports_client_id_fkey foreign KEY (client_id) references clients (id) on delete CASCADE,
  constraint reports_generated_by_fkey foreign KEY (generated_by) references profiles (id) on delete set null,
  constraint reports_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger set_updated_at_reports BEFORE
update on reports for EACH row
execute FUNCTION set_updated_at ();

create table public.seo_items (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  client_id uuid not null,
  campaign_id uuid null,
  task_id uuid null,
  item_type public.seo_item_type not null,
  title text not null,
  target_keyword text null,
  description text null,
  status public.task_status not null default 'todo'::task_status,
  priority public.task_priority not null default 'medium'::task_priority,
  assigned_to uuid null,
  due_date timestamp with time zone null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint seo_items_pkey primary key (id),
  constraint seo_items_campaign_id_fkey foreign KEY (campaign_id) references campaigns (id) on delete CASCADE,
  constraint seo_items_client_id_fkey foreign KEY (client_id) references clients (id) on delete CASCADE,
  constraint seo_items_assigned_to_fkey foreign KEY (assigned_to) references profiles (id) on delete set null,
  constraint seo_items_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint seo_items_task_id_fkey foreign KEY (task_id) references tasks (id) on delete set null,
  constraint seo_items_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null
) TABLESPACE pg_default;

create trigger set_updated_at_seo_items BEFORE
update on seo_items for EACH row
execute FUNCTION set_updated_at ();

create table public.social_post_assets (
  id uuid not null default gen_random_uuid (),
  social_post_id uuid not null,
  asset_id uuid not null,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint social_post_assets_pkey primary key (id),
  constraint social_post_assets_social_post_id_asset_id_key unique (social_post_id, asset_id),
  constraint social_post_assets_asset_id_fkey foreign KEY (asset_id) references content_assets (id) on delete CASCADE,
  constraint social_post_assets_social_post_id_fkey foreign KEY (social_post_id) references social_posts (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.social_posts (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  client_id uuid not null,
  campaign_id uuid null,
  task_id uuid null,
  title text null,
  caption text null,
  platform public.post_platform not null,
  status public.post_status not null default 'draft'::post_status,
  scheduled_for timestamp with time zone null,
  published_at timestamp with time zone null,
  external_post_id text null,
  created_by uuid null,
  updated_by uuid null,
  ai_generated boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint social_posts_pkey primary key (id),
  constraint social_posts_client_id_fkey foreign KEY (client_id) references clients (id) on delete CASCADE,
  constraint social_posts_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint social_posts_campaign_id_fkey foreign KEY (campaign_id) references campaigns (id) on delete CASCADE,
  constraint social_posts_task_id_fkey foreign KEY (task_id) references tasks (id) on delete set null,
  constraint social_posts_updated_by_fkey foreign KEY (updated_by) references profiles (id) on delete set null,
  constraint social_posts_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger set_updated_at_social_posts BEFORE
update on social_posts for EACH row
execute FUNCTION set_updated_at ();

create table public.stock_items (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  name text not null,
  sku text null,
  category text null,
  quantity integer not null default 0,
  reorder_level integer not null default 0,
  unit_price numeric(12, 2) null default 0,
  status text not null default 'active'::text,
  created_at timestamp with time zone not null default now(),
  constraint stock_items_pkey primary key (id),
  constraint stock_items_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_stock_items_org on public.stock_items using btree (organization_id) TABLESPACE pg_default;

create table public.stock_movements (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  stock_item_id uuid not null,
  movement_type text not null,
  quantity integer not null,
  reason text null,
  performed_by uuid null,
  created_at timestamp with time zone not null default now(),
  constraint stock_movements_pkey primary key (id),
  constraint stock_movements_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint stock_movements_performed_by_fkey foreign KEY (performed_by) references profiles (id) on delete set null,
  constraint stock_movements_stock_item_id_fkey foreign KEY (stock_item_id) references stock_items (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_stock_movements_org on public.stock_movements using btree (organization_id) TABLESPACE pg_default;

create table public.task_comments (
  id uuid not null default gen_random_uuid (),
  task_id uuid not null,
  user_id uuid null,
  comment text not null,
  is_internal boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint task_comments_pkey primary key (id),
  constraint task_comments_task_id_fkey foreign KEY (task_id) references tasks (id) on delete CASCADE,
  constraint task_comments_user_id_fkey foreign KEY (user_id) references profiles (id) on delete set null
) TABLESPACE pg_default;

create trigger set_updated_at_task_comments BEFORE
update on task_comments for EACH row
execute FUNCTION set_updated_at ();

create table public.task_watchers (
  id uuid not null default gen_random_uuid (),
  task_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone not null default now(),
  constraint task_watchers_pkey primary key (id),
  constraint task_watchers_task_id_user_id_key unique (task_id, user_id),
  constraint task_watchers_task_id_fkey foreign KEY (task_id) references tasks (id) on delete CASCADE,
  constraint task_watchers_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.tasks (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  client_id uuid null,
  campaign_id uuid null,
  parent_task_id uuid null,
  title text not null,
  description text null,
  status public.task_status not null default 'todo'::task_status,
  priority public.task_priority not null default 'medium'::task_priority,
  assigned_to uuid null,
  assigned_by uuid null,
  department text null,
  due_date timestamp with time zone null,
  start_date timestamp with time zone null,
  completed_at timestamp with time zone null,
  ai_generated boolean not null default false,
  blocked_reason text null,
  position integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  project_id uuid null,
  constraint tasks_pkey primary key (id),
  constraint tasks_assigned_to_fkey foreign KEY (assigned_to) references profiles (id) on delete set null,
  constraint tasks_campaign_id_fkey foreign KEY (campaign_id) references campaigns (id) on delete CASCADE,
  constraint tasks_client_id_fkey foreign KEY (client_id) references clients (id) on delete CASCADE,
  constraint tasks_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint tasks_parent_task_id_fkey foreign KEY (parent_task_id) references tasks (id) on delete CASCADE,
  constraint tasks_assigned_by_fkey foreign KEY (assigned_by) references profiles (id) on delete set null,
  constraint tasks_project_id_fkey foreign KEY (project_id) references projects (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_tasks_campaign_id on public.tasks using btree (campaign_id) TABLESPACE pg_default;

create index IF not exists idx_tasks_client_id on public.tasks using btree (client_id) TABLESPACE pg_default;

create index IF not exists idx_tasks_assigned_to on public.tasks using btree (assigned_to) TABLESPACE pg_default;

create index IF not exists idx_tasks_status on public.tasks using btree (status) TABLESPACE pg_default;

create trigger set_updated_at_tasks BEFORE
update on tasks for EACH row
execute FUNCTION set_updated_at ();

create table public.time_entries (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  user_id uuid not null,
  task_id uuid null,
  description text null,
  started_at timestamp with time zone not null,
  ended_at timestamp with time zone null,
  duration_minutes integer GENERATED ALWAYS as (
    case
      when (ended_at is null) then null::integer
      else GREATEST(
        (
          floor(
            (
              EXTRACT(
                epoch
                from
                  (ended_at - started_at)
              ) / (60)::numeric
            )
          )
        )::integer,
        0
      )
    end
  ) STORED null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  duration_seconds integer not null default 0,
  is_running boolean not null default true,
  constraint time_entries_pkey primary key (id),
  constraint time_entries_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint time_entries_task_id_fkey foreign KEY (task_id) references tasks (id) on delete set null,
  constraint time_entries_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_time_entries_user_started_at on public.time_entries using btree (user_id, started_at desc) TABLESPACE pg_default;

create trigger set_time_entries_updated_at BEFORE
update on time_entries for EACH row
execute FUNCTION set_updated_at ();

create trigger set_updated_at_time_entries_trigger BEFORE
update on time_entries for EACH row
execute FUNCTION set_updated_at ();
create extension if not exists citext;

insert into storage.buckets (id, name, public)
values ('employee-documents', 'employee-documents', false)
on conflict (id) do update set public = false;

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  message text null,
  document_type text not null,
  file_bucket text null default 'employee-documents',
  file_path text null,
  file_name text null,
  mime_type text null,
  size_bytes bigint null,
  requires_acknowledgement boolean not null default false,
  is_confidential boolean not null default true,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  constraint employee_documents_type_check check (
    document_type in (
      'payslip',
      'warning',
      'letter',
      'contract',
      'policy',
      'announcement',
      'leave',
      'asset',
      'performance',
      'notice'
    )
  )
);

create table if not exists public.employee_document_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.employee_documents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'unread',
  delivered_at timestamptz not null default now(),
  read_at timestamptz null,
  acknowledged_at timestamptz null,
  archived_at timestamptz null,
  acknowledgement_note text null,
  created_at timestamptz not null default now(),
  unique(document_id, user_id),
  constraint employee_document_recipients_status_check check (
    status in ('unread', 'read', 'acknowledged', 'archived')
  )
);

create table if not exists public.employee_document_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid null references public.employee_documents(id) on delete set null,
  recipient_id uuid null references public.employee_document_recipients(id) on delete set null,
  actor_user_id uuid null references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payslip_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  payroll_month integer not null,
  payroll_year integer not null,
  status text not null default 'draft',
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  constraint payslip_batches_month_check check (payroll_month between 1 and 12),
  constraint payslip_batches_status_check check (
    status in ('draft', 'processing', 'delivered', 'partial_failed', 'failed')
  )
);

create table if not exists public.payslip_batch_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.payslip_batches(id) on delete cascade,
  user_id uuid null references public.profiles(id) on delete set null,
  employee_email citext null,
  employee_name text null,
  document_id uuid null references public.employee_documents(id) on delete set null,
  file_name text not null,
  file_path text null,
  match_status text not null default 'pending',
  error_message text null,
  created_at timestamptz not null default now(),
  constraint payslip_batch_items_match_status_check check (
    match_status in ('pending', 'matched', 'unmatched', 'duplicate', 'delivered', 'failed')
  )
);

create index if not exists employee_documents_org_type_created_idx
  on public.employee_documents (organization_id, document_type, created_at desc);
create index if not exists employee_document_recipients_user_status_delivered_idx
  on public.employee_document_recipients (user_id, status, delivered_at desc);
create index if not exists employee_document_recipients_org_status_idx
  on public.employee_document_recipients (organization_id, status);
create index if not exists employee_document_audit_logs_org_created_idx
  on public.employee_document_audit_logs (organization_id, created_at desc);
create index if not exists payslip_batches_org_period_idx
  on public.payslip_batches (organization_id, payroll_year, payroll_month);
create index if not exists payslip_batch_items_batch_status_idx
  on public.payslip_batch_items (batch_id, match_status);

create or replace function public.set_employee_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists employee_documents_set_updated_at on public.employee_documents;
create trigger employee_documents_set_updated_at
before update on public.employee_documents
for each row execute function public.set_employee_documents_updated_at();

create or replace function public.is_document_admin(check_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = check_organization_id
      and coalesce(p.account_status, 'active') = 'active'
      and coalesce(p.is_suspended, false) = false
      and p.primary_role in ('admin', 'manager', 'hr', 'it', 'superadmin', 'it-superadmin')
  );
$$;

alter table public.employee_documents enable row level security;
alter table public.employee_document_recipients enable row level security;
alter table public.employee_document_audit_logs enable row level security;
alter table public.payslip_batches enable row level security;
alter table public.payslip_batch_items enable row level security;

drop policy if exists "Document admins select org documents" on public.employee_documents;
create policy "Document admins select org documents"
  on public.employee_documents for select
  to authenticated
  using (public.is_document_admin(organization_id));

drop policy if exists "Employees select assigned documents" on public.employee_documents;
create policy "Employees select assigned documents"
  on public.employee_documents for select
  to authenticated
  using (
    exists (
      select 1
      from public.employee_document_recipients r
      where r.document_id = employee_documents.id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "Document admins insert org documents" on public.employee_documents;
create policy "Document admins insert org documents"
  on public.employee_documents for insert
  to authenticated
  with check (public.is_document_admin(organization_id));

drop policy if exists "Document admins update org documents" on public.employee_documents;
create policy "Document admins update org documents"
  on public.employee_documents for update
  to authenticated
  using (public.is_document_admin(organization_id))
  with check (public.is_document_admin(organization_id));

drop policy if exists "Document admins delete org documents" on public.employee_documents;
create policy "Document admins delete org documents"
  on public.employee_documents for delete
  to authenticated
  using (public.is_document_admin(organization_id));

drop policy if exists "Employees select own document recipients" on public.employee_document_recipients;
create policy "Employees select own document recipients"
  on public.employee_document_recipients for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Document admins select org recipients" on public.employee_document_recipients;
create policy "Document admins select org recipients"
  on public.employee_document_recipients for select
  to authenticated
  using (public.is_document_admin(organization_id));

drop policy if exists "Employees update own document status" on public.employee_document_recipients;
create policy "Employees update own document status"
  on public.employee_document_recipients for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Document admins manage org recipients" on public.employee_document_recipients;
create policy "Document admins manage org recipients"
  on public.employee_document_recipients for all
  to authenticated
  using (public.is_document_admin(organization_id))
  with check (public.is_document_admin(organization_id));

drop policy if exists "Document admins read org document audit logs" on public.employee_document_audit_logs;
create policy "Document admins read org document audit logs"
  on public.employee_document_audit_logs for select
  to authenticated
  using (public.is_document_admin(organization_id));

drop policy if exists "Users read own document audit logs" on public.employee_document_audit_logs;
create policy "Users read own document audit logs"
  on public.employee_document_audit_logs for select
  to authenticated
  using (actor_user_id = auth.uid());

drop policy if exists "Users insert own document audit logs" on public.employee_document_audit_logs;
create policy "Users insert own document audit logs"
  on public.employee_document_audit_logs for insert
  to authenticated
  with check (
    actor_user_id = auth.uid()
    and exists (
      select 1
      from public.employee_document_recipients r
      where r.id = employee_document_audit_logs.recipient_id
        and r.user_id = auth.uid()
        and r.organization_id = employee_document_audit_logs.organization_id
    )
  );

drop policy if exists "Document admins insert org document audit logs" on public.employee_document_audit_logs;
create policy "Document admins insert org document audit logs"
  on public.employee_document_audit_logs for insert
  to authenticated
  with check (public.is_document_admin(organization_id));

drop policy if exists "Document admins manage payslip batches" on public.payslip_batches;
create policy "Document admins manage payslip batches"
  on public.payslip_batches for all
  to authenticated
  using (public.is_document_admin(organization_id))
  with check (public.is_document_admin(organization_id));

drop policy if exists "Document admins manage payslip batch items" on public.payslip_batch_items;
create policy "Document admins manage payslip batch items"
  on public.payslip_batch_items for all
  to authenticated
  using (public.is_document_admin(organization_id))
  with check (public.is_document_admin(organization_id));

drop policy if exists "Document admins can upload employee document files" on storage.objects;
create policy "Document admins can upload employee document files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'employee-documents'
    and public.is_document_admin((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Document admins can manage employee document files" on storage.objects;
create policy "Document admins can manage employee document files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'employee-documents'
    and public.is_document_admin((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'employee-documents'
    and public.is_document_admin((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Document admins can delete employee document files" on storage.objects;
create policy "Document admins can delete employee document files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'employee-documents'
    and public.is_document_admin((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Assigned employees can read employee document files" on storage.objects;
create policy "Assigned employees can read employee document files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'employee-documents'
    and (
      public.is_document_admin((storage.foldername(name))[1]::uuid)
      or exists (
        select 1
        from public.employee_documents d
        join public.employee_document_recipients r on r.document_id = d.id
        where d.file_bucket = 'employee-documents'
          and d.file_path = storage.objects.name
          and r.user_id = auth.uid()
      )
    )
  );

grant select, insert, update, delete on public.employee_documents to authenticated;
grant select, insert, update, delete on public.employee_document_recipients to authenticated;
grant select, insert on public.employee_document_audit_logs to authenticated;
grant select, insert, update, delete on public.payslip_batches to authenticated;
grant select, insert, update, delete on public.payslip_batch_items to authenticated;

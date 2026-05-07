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
      and p.primary_role in ('admin', 'manager', 'hr', 'superadmin', 'it-superadmin')
  );
$$;

create or replace function public.is_document_auditor(check_organization_id uuid)
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

drop policy if exists "Document admins read org document audit logs" on public.employee_document_audit_logs;
create policy "Document admins read org document audit logs"
  on public.employee_document_audit_logs for select
  to authenticated
  using (public.is_document_auditor(organization_id));

drop policy if exists "Employees select assigned documents" on public.employee_documents;
create policy "Employees select assigned documents"
  on public.employee_documents for select
  to authenticated
  using (
    exists (
      select 1
      from public.employee_document_recipients r
      where r.document_id = employee_documents.id
        and r.organization_id = employee_documents.organization_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "Employees update own document status" on public.employee_document_recipients;
create policy "Employees update own document status"
  on public.employee_document_recipients for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and organization_id = (
      select p.organization_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );

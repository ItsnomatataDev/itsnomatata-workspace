create or replace function public.resolve_signup_account_status(
  p_email text,
  p_organization_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(coalesce(p_email, '')) like '%@itsnomatata.com'
      and exists (
        select 1
        from public.organizations o
        where o.id = p_organization_id
          and (
            o.slug in ('its-nomatata', 'itsnomatata')
            or coalesce(o.is_system_organization, false) = true
          )
      )
    then 'active'
    else 'pending_approval'
  end;
$$;

grant execute on function public.resolve_signup_account_status(text, uuid) to authenticated;

create or replace function public.ensure_current_user_profile(host_name text default null)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := lower(btrim(coalesce(auth.email(), '')));
  metadata jsonb := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb);
  full_name_value text := nullif(btrim(coalesce(metadata ->> 'full_name', metadata ->> 'name', '')), '');
  active_membership record;
  pending_invitation record;
  host_organization record;
  selected_organization_id uuid;
  selected_office_id uuid;
  selected_role text := 'user';
  selected_status text := 'pending_approval';
  existing_profile public.profiles%rowtype;
  result_profile public.profiles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into existing_profile
  from public.profiles
  where id = current_user_id;

  select *
  into active_membership
  from public.get_my_active_memberships()
  limit 1;

  if active_membership.organization_id is not null then
    selected_organization_id := active_membership.organization_id;
    selected_role := public.safe_profile_role(active_membership.organization_id, active_membership.role);
    selected_status := 'active';
  else
    select oi.organization_id, oi.role_key
    into pending_invitation
    from public.organization_invitations oi
    join public.organizations o on o.id = oi.organization_id
    where lower(oi.email) = current_email
      and oi.status = 'pending'
      and (oi.expires_at is null or oi.expires_at > now())
      and coalesce(o.status, 'active') = 'active'
      and coalesce(o.is_active, true) = true
      and coalesce(o.access_status, 'active') in ('active', 'trialing')
    order by oi.created_at desc
    limit 1;

    if pending_invitation.organization_id is not null then
      selected_organization_id := pending_invitation.organization_id;
      selected_role := public.safe_profile_role(pending_invitation.organization_id, pending_invitation.role_key);
      selected_status := 'pending_approval';
    else
      select *
      into host_organization
      from public.get_organization_by_host(host_name)
      limit 1;

      if host_organization.id is null
         and nullif(btrim(metadata ->> 'organization_slug_hint'), '') is not null then
        select *
        into host_organization
        from public.organizations o
        where o.slug = nullif(btrim(metadata ->> 'organization_slug_hint'), '')
          and coalesce(o.status, 'active') = 'active'
          and coalesce(o.is_active, true) = true
          and coalesce(o.access_status, 'active') in ('active', 'trialing')
        limit 1;
      end if;

      if host_organization.id is not null then
        selected_organization_id := host_organization.id;
        selected_role := public.safe_profile_role(host_organization.id, 'user');
        selected_status := public.resolve_signup_account_status(current_email, host_organization.id);
      end if;
    end if;
  end if;

  if selected_organization_id is not null
     and nullif(btrim(metadata ->> 'office_slug'), '') is not null then
    select co.id
    into selected_office_id
    from public.company_offices co
    where co.organization_id = selected_organization_id
      and co.slug = nullif(btrim(metadata ->> 'office_slug'), '')
    limit 1;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    organization_id,
    office_id,
    primary_role,
    organization_role_key,
    account_status,
    is_active,
    is_suspended,
    last_seen_at
  )
  values (
    current_user_id,
    nullif(current_email, ''),
    coalesce(full_name_value, existing_profile.full_name),
    selected_organization_id,
    selected_office_id,
    selected_role::public.app_role,
    selected_role,
    selected_status,
    selected_status = 'active',
    false,
    now()
  )
  on conflict (id) do update
  set
    email = coalesce(excluded.email, public.profiles.email),
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    organization_id = coalesce(public.profiles.organization_id, excluded.organization_id),
    office_id = coalesce(public.profiles.office_id, excluded.office_id),
    primary_role = selected_role::public.app_role,
    organization_role_key = selected_role,
    account_status = case
      when coalesce(public.profiles.account_status, '') in ('suspended', 'rejected', 'deleted')
        then public.profiles.account_status
      else selected_status
    end,
    is_active = case
      when coalesce(public.profiles.account_status, '') in ('suspended', 'rejected', 'deleted')
        then false
      else selected_status = 'active'
    end,
    is_suspended = coalesce(public.profiles.is_suspended, false),
    last_seen_at = now();

  select *
  into result_profile
  from public.profiles
  where id = current_user_id;

  if selected_organization_id is not null
     and coalesce(result_profile.account_status, '') not in ('suspended', 'rejected', 'deleted') then
    insert into public.organization_members (
      organization_id,
      user_id,
      role,
      status,
      joined_at,
      removed_at,
      removed_by
    )
    values (
      selected_organization_id,
      current_user_id,
      selected_role::public.app_role,
      (case when selected_status = 'active' then 'active' else 'pending' end)::public.member_status,
      now(),
      null,
      null
    )
    on conflict (organization_id, user_id) do update
    set
      role = case
        when public.organization_members.status::text = 'active'
          then public.organization_members.role
        else excluded.role
      end,
      status = case
        when public.organization_members.status::text = 'active'
          then public.organization_members.status
        else excluded.status
      end,
      joined_at = case
        when public.organization_members.status::text = 'active'
          then public.organization_members.joined_at
        when excluded.status::text = 'active'
          then coalesce(public.organization_members.joined_at, now())
        else public.organization_members.joined_at
      end,
      removed_at = case
        when excluded.status::text = 'active' then null
        else public.organization_members.removed_at
      end,
      removed_by = case
        when excluded.status::text = 'active' then null
        else public.organization_members.removed_by
      end;
  end if;

  return result_profile;
end;
$$;

grant execute on function public.ensure_current_user_profile(text) to authenticated;

create or replace function public.notify_admins_of_pending_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_record record;
  requested_name text;
  notification_id uuid;
begin
  if coalesce(new.account_status, '') <> 'pending_approval' then
    return new;
  end if;

  if new.organization_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.account_status, '') = 'pending_approval' then
    return new;
  end if;

  requested_name := coalesce(nullif(trim(new.full_name), ''), new.email, 'A new user');

  for admin_record in
    select distinct p.id
    from public.profiles p
    inner join public.organization_members om
      on om.user_id = p.id
     and om.organization_id = new.organization_id
     and om.status::text = 'active'
    left join public.organization_roles r
      on r.organization_id = om.organization_id
     and r.role_key = om.role::text
    where p.organization_id = new.organization_id
      and coalesce(p.account_status, 'active') = 'active'
      and coalesce(p.is_suspended, false) = false
      and (
        om.role::text in ('admin', 'org_admin', 'super_admin', 'superadmin', 'it-superadmin')
        or coalesce(r.is_admin_role, false) = true
      )
  loop
    insert into public.notifications (
      organization_id,
      user_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      action_url,
      priority,
      metadata,
      category,
      dedupe_key,
      delivery_state
    )
    values (
      new.organization_id,
      admin_record.id,
      'user_signup',
      'New user approval request',
      requested_name || ' signed up and is waiting for approval.',
      'profile',
      new.id,
      '/admin/employees?status=pending_approval',
      'high',
      jsonb_build_object(
        'target_user_id', new.id,
        'email', new.email,
        'source', 'profiles_pending_approval_trigger'
      ),
      'admin',
      'pending-approval:' || new.id,
      'pending'
    )
    on conflict do nothing
    returning id into notification_id;

    if notification_id is not null then
      insert into public.notification_deliveries (
        notification_id,
        channel,
        status,
        provider,
        attempted_at
      )
      values (
        notification_id,
        'push',
        'queued',
        'supabase-edge:web-push',
        now()
      );
    end if;
  end loop;

  return new;
end;
$$;

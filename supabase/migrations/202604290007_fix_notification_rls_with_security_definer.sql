create or replace function public.can_create_notification_for_user(
  target_organization_id uuid,
  target_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    auth.uid() = target_user_id
    or exists (
      select 1
      from public.profiles actor
      join public.profiles recipient
        on recipient.id = target_user_id
      where actor.id = auth.uid()
        and actor.organization_id = target_organization_id
        and recipient.organization_id = target_organization_id
    )
    or exists (
      select 1
      from public.organization_members actor_member
      join public.profiles recipient
        on recipient.id = target_user_id
      where actor_member.user_id = auth.uid()
        and actor_member.organization_id = target_organization_id
        and actor_member.status = 'active'
        and recipient.organization_id = target_organization_id
    );
$$;

create or replace function public.can_manage_notification_delivery(
  target_notification_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.notifications n
    where n.id = target_notification_id
      and public.can_create_notification_for_user(n.organization_id, n.user_id)
  );
$$;

grant execute on function public.can_create_notification_for_user(uuid, uuid)
  to authenticated;
grant execute on function public.can_manage_notification_delivery(uuid)
  to authenticated;

alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "org_members_insert_notifications" on public.notifications;
create policy "org_members_insert_notifications"
on public.notifications
for insert
to authenticated
with check (
  public.can_create_notification_for_user(organization_id, user_id)
);

drop policy if exists "org_members_update_notification_delivery_state" on public.notifications;
create policy "org_members_update_notification_delivery_state"
on public.notifications
for update
to authenticated
using (
  public.can_create_notification_for_user(organization_id, user_id)
)
with check (
  public.can_create_notification_for_user(organization_id, user_id)
);

drop policy if exists "org_members_insert_deliveries" on public.notification_deliveries;
create policy "org_members_insert_deliveries"
on public.notification_deliveries
for insert
to authenticated
with check (
  public.can_manage_notification_delivery(notification_id)
);

drop policy if exists "org_members_update_deliveries" on public.notification_deliveries;
create policy "org_members_update_deliveries"
on public.notification_deliveries
for update
to authenticated
using (
  public.can_manage_notification_delivery(notification_id)
)
with check (
  public.can_manage_notification_delivery(notification_id)
);

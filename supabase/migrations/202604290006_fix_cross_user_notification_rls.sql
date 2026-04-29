
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "org_members_insert_notifications" on public.notifications;
create policy "org_members_insert_notifications"
on public.notifications
for insert
to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles actor
    join public.profiles recipient
      on recipient.id = notifications.user_id
    where actor.id = auth.uid()
      and actor.organization_id = notifications.organization_id
      and recipient.organization_id = notifications.organization_id
  )
  or exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = notifications.organization_id
      and om.status = 'active'
  )
);

drop policy if exists "org_members_update_notification_delivery_state" on public.notifications;
create policy "org_members_update_notification_delivery_state"
on public.notifications
for update
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.organization_id = notifications.organization_id
  )
  or exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = notifications.organization_id
      and om.status = 'active'
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.organization_id = notifications.organization_id
  )
  or exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = notifications.organization_id
      and om.status = 'active'
  )
);

drop policy if exists "org_members_insert_deliveries" on public.notification_deliveries;
create policy "org_members_insert_deliveries"
on public.notification_deliveries
for insert
to authenticated
with check (
  exists (
    select 1
    from public.notifications n
    where n.id = notification_deliveries.notification_id
      and (
        n.user_id = auth.uid()
        or exists (
          select 1
          from public.profiles actor
          where actor.id = auth.uid()
            and actor.organization_id = n.organization_id
        )
        or exists (
          select 1
          from public.organization_members om
          where om.user_id = auth.uid()
            and om.organization_id = n.organization_id
            and om.status = 'active'
        )
      )
  )
);

drop policy if exists "org_members_update_deliveries" on public.notification_deliveries;
create policy "org_members_update_deliveries"
on public.notification_deliveries
for update
to authenticated
using (
  exists (
    select 1
    from public.notifications n
    where n.id = notification_deliveries.notification_id
      and (
        n.user_id = auth.uid()
        or exists (
          select 1
          from public.profiles actor
          where actor.id = auth.uid()
            and actor.organization_id = n.organization_id
        )
        or exists (
          select 1
          from public.organization_members om
          where om.user_id = auth.uid()
            and om.organization_id = n.organization_id
            and om.status = 'active'
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.notifications n
    where n.id = notification_deliveries.notification_id
      and (
        n.user_id = auth.uid()
        or exists (
          select 1
          from public.profiles actor
          where actor.id = auth.uid()
            and actor.organization_id = n.organization_id
        )
        or exists (
          select 1
          from public.organization_members om
          where om.user_id = auth.uid()
            and om.organization_id = n.organization_id
            and om.status = 'active'
        )
      )
  )
);

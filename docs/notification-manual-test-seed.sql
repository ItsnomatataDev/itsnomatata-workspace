
begin;

insert into public.notifications (
  organization_id,
  user_id,
  type,
  title,
  message,
  body,
  action_url,
  link,
  priority,
  category,
  dedupe_key,
  metadata,
  delivery_state,
  is_read
) values (
  :'organization_id',
  :'user_id',
  'workspace_admin_notice',
  'Workspace notification test',
  'This is a test notification for validating in-app delivery and read state updates.',
  'This is a test notification for validating in-app delivery and read state updates.',
  '/notifications',
  '/notifications',
  'normal',
  'system',
  'manual-test:' || :'user_id',
  jsonb_build_object('source', 'manual_test_seed'),
  'delivered',
  false
);

insert into public.email_events (
  organization_id,
  user_id,
  notification_id,
  event_type,
  recipient_email,
  recipient_name,
  subject,
  template_key,
  payload,
  status
)
select
  :'organization_id',
  :'user_id',
  n.id,
  'workspace_admin_notice',
  :'recipient_email',
  :'recipient_name',
  'Workspace notification test',
  'workspace_admin_notice',
  jsonb_build_object(
    'title', 'Workspace notification test',
    'body', 'This is a test email event for validating n8n processing.',
    'action_url', '/notifications',
    'app_name', 'Nomatata Workspace'
  ),
  'pending'
from public.notifications n
where n.user_id = :'user_id'
  and n.dedupe_key = 'manual-test:' || :'user_id'
limit 1;

commit;

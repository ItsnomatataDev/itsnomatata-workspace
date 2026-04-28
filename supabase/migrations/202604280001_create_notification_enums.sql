-- Create notification channel enum
do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'notification_channel'
  ) then
    create type public.notification_channel as enum (
      'in_app',
      'email',
      'push',
      'sms',
      'webhook'
    );
  end if;
end;
$$;

-- Ensure notification_type enum has all required values
do $$
declare
  vals text[] := array[
    'task_assigned',
    'task_updated',
    'task_comment',
    'task_completed',
    'approval_needed',
    'approval_decision',
    'meeting',
    'meeting_reminder',
    'announcement',
    'leave_request_submitted',
    'leave_request_approved',
    'leave_request_rejected',
    'leave_reminder',
    'system_alert',
    'automation',
    'chat_message',
    'duty_roster_assigned',
    'duty_roster_updated',
    'shift_reminder',
    'user_signup',
    'user_invite',
    'campaign_update',
    'campaign_assigned',
    'timesheet_reminder',
    'invoice_update',
    'budget_alert',
    'expense_submitted',
    'expense_approved',
    'expense_rejected',
    'task_collaboration_invite'
  ];
  v text;
begin
  foreach v in array vals loop
    begin
      execute format('alter type public.notification_type add value if not exists %L', v);
    exception when others then
    end;
  end loop;
end;
$$;

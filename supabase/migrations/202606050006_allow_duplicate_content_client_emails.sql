drop index if exists public.content_clients_org_email_idx;

create index if not exists content_clients_org_email_lookup_idx
  on public.content_clients (organization_id, lower(email));

create or replace function public.update_content_client_details(
  target_client_id uuid,
  target_company_name text,
  target_contact_name text,
  target_email text,
  target_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  client_record public.content_clients%rowtype;
  next_company_name text := nullif(trim(coalesce(target_company_name, '')), '');
  next_contact_name text := nullif(trim(coalesce(target_contact_name, '')), '');
  next_email text := lower(nullif(trim(coalesce(target_email, '')), ''));
begin
  select *
  into client_record
  from public.content_clients
  where id = target_client_id;

  if not found or not public.can_edit_content_client_details(target_client_id) then
    raise exception 'not allowed';
  end if;

  if next_company_name is null
    or next_contact_name is null
    or next_email is null then
    raise exception 'company_name, contact_name, and email are required';
  end if;

  update public.content_clients
  set company_name = next_company_name,
      contact_name = next_contact_name,
      email = next_email,
      phone = nullif(trim(coalesce(target_phone, '')), '')
  where id = target_client_id
  returning * into client_record;

  return jsonb_build_object(
    'ok', true,
    'client', to_jsonb(client_record) - 'login_pin_hash'
  );
end;
$$;

grant execute on function public.update_content_client_details(uuid, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

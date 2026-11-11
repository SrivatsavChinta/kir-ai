-- Operations used by the application.
--
-- Rent obligation rows stay snapshots: nothing here changes expected_amount
-- when a tenancy's rent changes. The app inserts a missing month once and
-- leaves that row alone.
--
-- These functions run as the signed-in user (security invoker), so row level
-- security still applies. landlord_id is always auth.uid().

-- One active tenancy's phone and email are unique per landlord. The same
-- checks already run in lib/tenant-validation.ts.
create unique index tenants_landlord_phone_uidx
  on public.tenants (landlord_id, phone);

create unique index tenants_landlord_email_uidx
  on public.tenants (landlord_id, lower(email));

-- ---------------------------------------------------------------------------
-- Tenancies. Ending, starting and moving run in one transaction so a unit
-- cannot be left let and vacant at the same time, and a move cannot keep two
-- active tenancies for one tenant.
-- ---------------------------------------------------------------------------

create or replace function public.end_tenancy(p_tenancy_id uuid, p_move_out_date date)
returns public.tenancies
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.tenancies;
  landlord uuid := auth.uid();
begin
  if landlord is null then
    raise exception 'You need to be logged in.';
  end if;

  update public.tenancies
  set status = 'Ended',
      move_out_date = p_move_out_date,
      end_reason = 'Moved out'
  where id = p_tenancy_id
    and landlord_id = landlord
    and status = 'Active'
  returning * into result;

  if not found then
    raise exception 'This tenancy has already ended.';
  end if;

  update public.rental_units
  set status = 'Vacant'
  where id = result.unit_id
    and landlord_id = landlord
    and not exists (
      select 1 from public.tenancies
      where unit_id = result.unit_id and status = 'Active'
    );

  return result;
end;
$$;

create or replace function public.start_tenancy(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_monthly_rent integer,
  p_security_deposit integer,
  p_rent_due_day integer,
  p_move_in_date date,
  p_agreement_start_date date,
  p_agreement_end_date date
) returns public.tenancies
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.tenancies;
  landlord uuid := auth.uid();
begin
  if landlord is null then
    raise exception 'You need to be logged in.';
  end if;

  insert into public.tenancies (
    landlord_id, tenant_id, unit_id, monthly_rent, security_deposit, rent_due_day,
    move_in_date, agreement_start_date, agreement_end_date, status
  ) values (
    landlord, p_tenant_id, p_unit_id, p_monthly_rent, p_security_deposit, p_rent_due_day,
    p_move_in_date, p_agreement_start_date, p_agreement_end_date, 'Active'
  ) returning * into result;

  update public.rental_units
  set status = 'Occupied'
  where id = p_unit_id and landlord_id = landlord;

  return result;
end;
$$;

create or replace function public.create_tenant_with_tenancy(
  p_full_name text,
  p_phone text,
  p_email text,
  p_current_address text,
  p_emergency_name text,
  p_emergency_phone text,
  p_unit_id uuid,
  p_monthly_rent integer,
  p_security_deposit integer,
  p_rent_due_day integer,
  p_move_in_date date,
  p_agreement_start_date date,
  p_agreement_end_date date
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  tenant_row public.tenants;
  tenancy_row public.tenancies;
  landlord uuid := auth.uid();
begin
  if landlord is null then
    raise exception 'You need to be logged in.';
  end if;

  insert into public.tenants (
    landlord_id, full_name, phone, email, current_address,
    emergency_contact_name, emergency_contact_phone
  ) values (
    landlord, p_full_name, p_phone, p_email, p_current_address,
    p_emergency_name, p_emergency_phone
  ) returning * into tenant_row;

  insert into public.tenancies (
    landlord_id, tenant_id, unit_id, monthly_rent, security_deposit, rent_due_day,
    move_in_date, agreement_start_date, agreement_end_date, status
  ) values (
    landlord, tenant_row.id, p_unit_id, p_monthly_rent, p_security_deposit, p_rent_due_day,
    p_move_in_date, p_agreement_start_date, p_agreement_end_date, 'Active'
  ) returning * into tenancy_row;

  update public.rental_units
  set status = 'Occupied'
  where id = p_unit_id and landlord_id = landlord;

  return jsonb_build_object('tenant', to_jsonb(tenant_row), 'tenancy', to_jsonb(tenancy_row));
end;
$$;

create or replace function public.move_tenancy(
  p_tenancy_id uuid,
  p_unit_id uuid,
  p_monthly_rent integer,
  p_security_deposit integer,
  p_rent_due_day integer,
  p_move_in_date date,
  p_agreement_start_date date,
  p_agreement_end_date date
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  ended public.tenancies;
  started public.tenancies;
  landlord uuid := auth.uid();
begin
  if landlord is null then
    raise exception 'You need to be logged in.';
  end if;

  select * into ended
  from public.tenancies
  where id = p_tenancy_id and landlord_id = landlord
  for update;

  if not found then
    raise exception 'This tenancy no longer exists.';
  end if;

  if ended.status <> 'Active' then
    raise exception 'Only an active tenancy can be changed.';
  end if;

  if ended.unit_id = p_unit_id then
    raise exception 'Choose a different unit to move this tenancy.';
  end if;

  update public.tenancies
  set status = 'Ended',
      move_out_date = p_move_in_date,
      end_reason = 'Moved to another unit'
  where id = ended.id
  returning * into ended;

  insert into public.tenancies (
    landlord_id, tenant_id, unit_id, monthly_rent, security_deposit, rent_due_day,
    move_in_date, agreement_start_date, agreement_end_date, status
  ) values (
    landlord, ended.tenant_id, p_unit_id, p_monthly_rent, p_security_deposit, p_rent_due_day,
    p_move_in_date, p_agreement_start_date, p_agreement_end_date, 'Active'
  ) returning * into started;

  update public.rental_units
  set status = 'Vacant'
  where id = ended.unit_id
    and landlord_id = landlord
    and not exists (
      select 1 from public.tenancies
      where unit_id = ended.unit_id and status = 'Active'
    );

  update public.rental_units
  set status = 'Occupied'
  where id = p_unit_id and landlord_id = landlord;

  return jsonb_build_object('ended', to_jsonb(ended), 'tenancy', to_jsonb(started));
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments. The allocation trigger locks the obligation in this same
-- transaction, so two payments cannot both pass the balance check.
-- ---------------------------------------------------------------------------

create or replace function public.record_payment(
  p_tenancy_id uuid,
  p_obligation_id uuid,
  p_amount integer,
  p_payment_date date,
  p_payment_method text,
  p_transaction_reference text,
  p_notes text
) returns public.payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.payments;
  landlord uuid := auth.uid();
begin
  if landlord is null then
    raise exception 'You need to be logged in.';
  end if;

  insert into public.payments (
    landlord_id, tenancy_id, obligation_id, amount, payment_date,
    payment_method, transaction_reference, notes
  ) values (
    landlord, p_tenancy_id, p_obligation_id, p_amount, p_payment_date,
    p_payment_method, nullif(btrim(p_transaction_reference), ''), nullif(btrim(p_notes), '')
  ) returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Maintenance. A status change and its history rows commit together.
-- Events passed in are the descriptions the application already builds.
-- ---------------------------------------------------------------------------

create or replace function public.change_maintenance_status(
  p_request_id uuid,
  p_status text,
  p_events jsonb
) returns public.maintenance_requests
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.maintenance_requests;
  landlord uuid := auth.uid();
  event jsonb;
begin
  if landlord is null then
    raise exception 'You need to be logged in.';
  end if;

  update public.maintenance_requests
  set status = p_status
  where id = p_request_id and landlord_id = landlord
  returning * into result;

  if not found then
    raise exception 'This maintenance request no longer exists.';
  end if;

  for event in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb))
  loop
    insert into public.maintenance_events (
      landlord_id, request_id, event_type, description, occurred_at
    ) values (
      landlord, result.id, event->>'event_type', event->>'description', now()
    );
  end loop;

  return result;
end;
$$;

create or replace function public.insert_maintenance_request(
  p_title text,
  p_description text,
  p_category text,
  p_priority text,
  p_property_id uuid,
  p_unit_id uuid,
  p_tenant_id uuid,
  p_tenancy_id uuid,
  p_reported_at date,
  p_target_resolution_date date,
  p_assigned_vendor_id uuid,
  p_events jsonb
) returns public.maintenance_requests
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.maintenance_requests;
  landlord uuid := auth.uid();
  event jsonb;
begin
  if landlord is null then
    raise exception 'You need to be logged in.';
  end if;

  insert into public.maintenance_requests (
    landlord_id, title, description, category, priority, status,
    property_id, unit_id, tenant_id, tenancy_id, reported_at,
    target_resolution_date, assigned_vendor_id
  ) values (
    landlord, btrim(p_title), p_description, p_category, p_priority, 'Open',
    p_property_id, p_unit_id, p_tenant_id, p_tenancy_id, p_reported_at,
    p_target_resolution_date, p_assigned_vendor_id
  ) returning * into result;

  for event in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb))
  loop
    insert into public.maintenance_events (
      landlord_id, request_id, event_type, description, occurred_at
    ) values (
      landlord, result.id, event->>'event_type', event->>'description', now()
    );
  end loop;

  return result;
end;
$$;

create or replace function public.update_maintenance_request(
  p_request_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_priority text,
  p_property_id uuid,
  p_unit_id uuid,
  p_tenant_id uuid,
  p_tenancy_id uuid,
  p_reported_at date,
  p_target_resolution_date date,
  p_assigned_vendor_id uuid,
  p_events jsonb
) returns public.maintenance_requests
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.maintenance_requests;
  landlord uuid := auth.uid();
  event jsonb;
begin
  if landlord is null then
    raise exception 'You need to be logged in.';
  end if;

  update public.maintenance_requests
  set title = btrim(p_title),
      description = p_description,
      category = p_category,
      priority = p_priority,
      property_id = p_property_id,
      unit_id = p_unit_id,
      tenant_id = p_tenant_id,
      tenancy_id = p_tenancy_id,
      reported_at = p_reported_at,
      target_resolution_date = p_target_resolution_date,
      assigned_vendor_id = p_assigned_vendor_id
  where id = p_request_id and landlord_id = landlord
  returning * into result;

  if not found then
    raise exception 'This maintenance request no longer exists.';
  end if;

  for event in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb))
  loop
    insert into public.maintenance_events (
      landlord_id, request_id, event_type, description, occurred_at
    ) values (
      landlord, result.id, event->>'event_type', event->>'description', now()
    );
  end loop;

  return result;
end;
$$;

create or replace function public.add_maintenance_note(p_request_id uuid, p_description text)
returns public.maintenance_events
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.maintenance_events;
  landlord uuid := auth.uid();
  found uuid;
begin
  if landlord is null then
    raise exception 'You need to be logged in.';
  end if;

  select id into found
  from public.maintenance_requests
  where id = p_request_id and landlord_id = landlord;

  if not found then
    raise exception 'This maintenance request no longer exists.';
  end if;

  -- Closed requests reject updates. A note is still allowed, and only bumps
  -- updated_at while the request can still be edited.
  update public.maintenance_requests
  set description = description
  where id = p_request_id and landlord_id = landlord and status <> 'Closed';

  insert into public.maintenance_events (
    landlord_id, request_id, event_type, description, occurred_at
  ) values (
    landlord, p_request_id, 'note_added', p_description, now()
  ) returning * into result;

  return result;
end;
$$;

revoke all on function public.end_tenancy(uuid, date) from public, anon;
revoke all on function public.start_tenancy(uuid, uuid, integer, integer, integer, date, date, date) from public, anon;
revoke all on function public.create_tenant_with_tenancy(text, text, text, text, text, text, uuid, integer, integer, integer, date, date, date) from public, anon;
revoke all on function public.move_tenancy(uuid, uuid, integer, integer, integer, date, date, date) from public, anon;
revoke all on function public.record_payment(uuid, uuid, integer, date, text, text, text) from public, anon;
revoke all on function public.change_maintenance_status(uuid, text, jsonb) from public, anon;
revoke all on function public.insert_maintenance_request(text, text, text, text, uuid, uuid, uuid, uuid, date, date, uuid, jsonb) from public, anon;
revoke all on function public.update_maintenance_request(uuid, text, text, text, text, uuid, uuid, uuid, uuid, date, date, uuid, jsonb) from public, anon;
revoke all on function public.add_maintenance_note(uuid, text) from public, anon;

grant execute on function public.end_tenancy(uuid, date) to authenticated;
grant execute on function public.start_tenancy(uuid, uuid, integer, integer, integer, date, date, date) to authenticated;
grant execute on function public.create_tenant_with_tenancy(text, text, text, text, text, text, uuid, integer, integer, integer, date, date, date) to authenticated;
grant execute on function public.move_tenancy(uuid, uuid, integer, integer, integer, date, date, date) to authenticated;
grant execute on function public.record_payment(uuid, uuid, integer, date, text, text, text) to authenticated;
grant execute on function public.change_maintenance_status(uuid, text, jsonb) to authenticated;
grant execute on function public.insert_maintenance_request(text, text, text, text, uuid, uuid, uuid, uuid, date, date, uuid, jsonb) to authenticated;
grant execute on function public.update_maintenance_request(uuid, text, text, text, text, uuid, uuid, uuid, uuid, date, date, uuid, jsonb) to authenticated;
grant execute on function public.add_maintenance_note(uuid, text) to authenticated;

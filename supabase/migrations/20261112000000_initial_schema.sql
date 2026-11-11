-- kir.ai initial schema.
--
-- Landlord ownership is the authenticated user id (auth.uid()). Policies and
-- triggers never trust an owner id that does not match that identity.
-- The service role bypasses row level security and is for server-side scripts
-- only. It must not be used in browser code.
--
-- Rent obligations are stored as snapshots. The application still derives them
-- in lib/rent-calculations.ts and does not read this table yet. Nothing here
-- recomputes expected_amount when a tenancy's rent changes.
--
-- A unit's status can still be Occupied without a tenancy. That matches the
-- current application and is intentionally not forced by a constraint.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Rejects changing landlord_id, and rejects a signed-in user writing a row
-- for anyone else. auth.uid() is null for the service role, which is how the
-- demo seed writes a specific landlord's rows.
create or replace function public.enforce_landlord_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.landlord_id is distinct from old.landlord_id then
    raise exception 'landlord_id cannot be changed';
  end if;

  if auth.uid() is not null and new.landlord_id is distinct from auth.uid() then
    raise exception 'landlord_id must be the signed-in landlord';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles. One row per auth user, created by the trigger below.
-- Login email lives on auth.users. This table does not copy it, so the two
-- cannot drift.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  account_type text not null default 'Landlord' check (account_type = 'Landlord'),
  portfolio_name text not null default 'My Portfolio',
  date_format text not null default 'd MMM yyyy'
    check (date_format in ('d MMM yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd')),
  timestamp_display text not null default 'relative'
    check (timestamp_display in ('relative', 'exact')),
  dashboard_view text not null default 'rent-first'
    check (dashboard_view in ('rent-first', 'attention-first')),
  notify_rent_overdue boolean not null default true,
  notify_agreement_ending boolean not null default true,
  notify_maintenance_updates boolean not null default true,
  notify_weekly_summary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (char_length(btrim(full_name)) between 1 and 80),
  constraint profiles_portfolio_name_length check (char_length(btrim(portfolio_name)) between 1 and 60)
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Removes a landlord's rows in dependency order before the profile itself goes.
-- auth.users deletion cascades to profiles, which runs this trigger.
create or replace function public.delete_landlord_data()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.payments where landlord_id = old.id;
  delete from public.documents where landlord_id = old.id;
  delete from public.maintenance_events where landlord_id = old.id;
  delete from public.rent_obligations where landlord_id = old.id;
  delete from public.maintenance_requests where landlord_id = old.id;
  delete from public.tenancies where landlord_id = old.id;
  delete from public.rental_units where landlord_id = old.id;
  delete from public.tenants where landlord_id = old.id;
  delete from public.vendors where landlord_id = old.id;
  delete from public.properties where landlord_id = old.id;
  return old;
end;
$$;

create trigger profiles_delete_data
before delete on public.profiles
for each row execute function public.delete_landlord_data();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 'Landlord'),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Portfolio
-- ---------------------------------------------------------------------------

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  property_type text not null
    check (property_type in ('Apartment Building', 'Independent House', 'Villa')),
  address text not null,
  city text not null,
  state text not null,
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (landlord_id, id)
);

create index properties_landlord_id_idx on public.properties (landlord_id);

create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

create trigger properties_enforce_landlord
before insert or update on public.properties
for each row execute function public.enforce_landlord_identity();

create table public.rental_units (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles (id) on delete restrict,
  property_id uuid not null,
  unit_number text not null,
  floor integer check (floor between -5 and 200),
  bedrooms integer check (bedrooms between 0 and 20),
  bathrooms integer check (bathrooms between 0 and 20),
  monthly_rent integer not null check (monthly_rent >= 0),
  security_deposit integer check (security_deposit is null or security_deposit >= 0),
  status text not null check (status in ('Occupied', 'Vacant')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Same comparison the app uses: trimmed, internal whitespace collapsed, case-insensitive.
  unit_number_key text generated always as (
    lower(regexp_replace(btrim(unit_number), '\s+', ' ', 'g'))
  ) stored,
  unique (landlord_id, id),
  unique (property_id, unit_number_key),
  foreign key (landlord_id, property_id)
    references public.properties (landlord_id, id)
    on delete cascade
);

create index rental_units_landlord_id_idx on public.rental_units (landlord_id);
create index rental_units_property_id_idx on public.rental_units (property_id);

create trigger rental_units_set_updated_at
before update on public.rental_units
for each row execute function public.set_updated_at();

create trigger rental_units_enforce_landlord
before insert or update on public.rental_units
for each row execute function public.enforce_landlord_identity();

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles (id) on delete restrict,
  full_name text not null,
  phone text not null,
  email text not null,
  current_address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (landlord_id, id),
  constraint tenants_emergency_contact_pair check (
    (emergency_contact_name is null and emergency_contact_phone is null)
    or (emergency_contact_name is not null and emergency_contact_phone is not null)
  )
);

create index tenants_landlord_id_idx on public.tenants (landlord_id);

create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

create trigger tenants_enforce_landlord
before insert or update on public.tenants
for each row execute function public.enforce_landlord_identity();

create table public.tenancies (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles (id) on delete restrict,
  tenant_id uuid not null,
  unit_id uuid not null,
  monthly_rent integer not null check (monthly_rent >= 0),
  security_deposit integer not null check (security_deposit >= 0),
  rent_due_day integer not null check (rent_due_day between 1 and 28),
  move_in_date date not null,
  agreement_start_date date not null,
  agreement_end_date date not null,
  status text not null check (status in ('Active', 'Ended')),
  move_out_date date,
  end_reason text check (
    end_reason is null or end_reason in ('Moved out', 'Moved to another unit')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (landlord_id, id),
  foreign key (landlord_id, tenant_id)
    references public.tenants (landlord_id, id)
    on delete restrict,
  foreign key (landlord_id, unit_id)
    references public.rental_units (landlord_id, id)
    on delete restrict,
  constraint tenancies_agreement_order check (agreement_start_date <= agreement_end_date),
  constraint tenancies_move_out_order check (
    move_out_date is null or move_out_date >= move_in_date
  ),
  constraint tenancies_end_fields check (
    (status = 'Active' and move_out_date is null and end_reason is null)
    or (status = 'Ended' and move_out_date is not null and end_reason is not null)
  )
);

-- A unit and a tenant each have at most one active tenancy. Ended rows stay.
create unique index tenancies_one_active_per_unit
  on public.tenancies (unit_id)
  where status = 'Active';

create unique index tenancies_one_active_per_tenant
  on public.tenancies (tenant_id)
  where status = 'Active';

create index tenancies_landlord_id_idx on public.tenancies (landlord_id);
create index tenancies_tenant_id_idx on public.tenancies (tenant_id);
create index tenancies_unit_id_idx on public.tenancies (unit_id);

create or replace function public.enforce_tenancy_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'Ended' then
    raise exception 'An ended tenancy can''t be changed';
  end if;

  if tg_op = 'UPDATE' and new.tenant_id is distinct from old.tenant_id then
    raise exception 'A tenancy cannot move to a different tenant';
  end if;

  return new;
end;
$$;

create trigger tenancies_enforce_rules
before update on public.tenancies
for each row execute function public.enforce_tenancy_rules();

create trigger tenancies_set_updated_at
before update on public.tenancies
for each row execute function public.set_updated_at();

create trigger tenancies_enforce_landlord
before insert or update on public.tenancies
for each row execute function public.enforce_landlord_identity();

-- A unit with an active tenancy cannot be marked vacant. Occupied without a
-- tenancy remains allowed, matching the application.
create or replace function public.prevent_vacant_while_let()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'Vacant' and exists (
    select 1
    from public.tenancies
    where unit_id = new.id
      and status = 'Active'
  ) then
    raise exception 'A unit with an active tenancy can''t be marked vacant';
  end if;

  return new;
end;
$$;

create trigger rental_units_prevent_vacant_while_let
before insert or update on public.rental_units
for each row execute function public.prevent_vacant_while_let();

-- ---------------------------------------------------------------------------
-- Rent. Obligations and payments are separate. Payments may be unallocated
-- (obligation_id null) or allocated to one obligation of the same tenancy.
-- ---------------------------------------------------------------------------

create table public.rent_obligations (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles (id) on delete restrict,
  tenancy_id uuid not null,
  billing_month text not null check (billing_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  due_date date not null,
  expected_amount integer not null check (expected_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenancy_id, billing_month),
  unique (landlord_id, id),
  foreign key (landlord_id, tenancy_id)
    references public.tenancies (landlord_id, id)
    on delete restrict
);

create index rent_obligations_landlord_id_idx on public.rent_obligations (landlord_id);
create index rent_obligations_tenancy_id_idx on public.rent_obligations (tenancy_id);

comment on table public.rent_obligations is
  'Snapshot of rent billed for one tenancy and month. Not recomputed when the tenancy rent changes. The app still derives figures in lib/rent-calculations.ts until providers are migrated.';

create trigger rent_obligations_set_updated_at
before update on public.rent_obligations
for each row execute function public.set_updated_at();

create trigger rent_obligations_enforce_landlord
before insert or update on public.rent_obligations
for each row execute function public.enforce_landlord_identity();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles (id) on delete restrict,
  tenancy_id uuid not null,
  obligation_id uuid,
  amount integer not null check (amount > 0),
  payment_date date not null,
  payment_method text not null
    check (payment_method in ('Cash', 'Bank transfer', 'UPI', 'Cheque', 'Other')),
  transaction_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (landlord_id, tenancy_id)
    references public.tenancies (landlord_id, id)
    on delete restrict,
  foreign key (landlord_id, obligation_id)
    references public.rent_obligations (landlord_id, id)
    on delete restrict
);

create index payments_landlord_id_idx on public.payments (landlord_id);
create index payments_tenancy_id_idx on public.payments (tenancy_id);
create index payments_obligation_id_idx on public.payments (obligation_id);

create or replace function public.enforce_payment_allocation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  obligation_tenancy uuid;
  expected integer;
  already integer;
begin
  if new.obligation_id is null then
    return new;
  end if;

  select tenancy_id, expected_amount
  into obligation_tenancy, expected
  from public.rent_obligations
  where id = new.obligation_id
    and landlord_id = new.landlord_id
  for update;

  if obligation_tenancy is null then
    raise exception 'The rent obligation must belong to the same landlord';
  end if;

  if obligation_tenancy is distinct from new.tenancy_id then
    raise exception 'A payment can only be allocated to rent for its own tenancy';
  end if;

  select coalesce(sum(amount), 0)
  into already
  from public.payments
  where obligation_id = new.obligation_id
    and id is distinct from new.id;

  if already + new.amount > expected then
    raise exception 'This payment would exceed the rent due for that month';
  end if;

  return new;
end;
$$;

create trigger payments_enforce_allocation
before insert or update on public.payments
for each row execute function public.enforce_payment_allocation();

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger payments_enforce_landlord
before insert or update on public.payments
for each row execute function public.enforce_landlord_identity();

-- ---------------------------------------------------------------------------
-- Documents. Metadata only. File bytes belong in the private Storage bucket
-- created in the following migration, under {landlord_id}/...
-- ---------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null check (category in (
    'Rental Agreement',
    'Tenant ID',
    'Property Document',
    'Invoice / Bill',
    'Maintenance Document',
    'Other'
  )),
  description text check (description is null or char_length(description) <= 300),
  association_type text not null check (association_type in ('property', 'tenant', 'tenancy')),
  associated_record_id uuid not null,
  original_file_name text not null,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size integer not null check (file_size > 0 and file_size <= 10485760),
  uploaded_at timestamptz not null default now(),
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_landlord_id_idx on public.documents (landlord_id);
create index documents_association_idx
  on public.documents (landlord_id, association_type, associated_record_id);

create or replace function public.enforce_document_association()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  linked boolean;
begin
  if new.association_type = 'property' then
    select exists (
      select 1 from public.properties
      where id = new.associated_record_id and landlord_id = new.landlord_id
    ) into linked;
  elsif new.association_type = 'tenant' then
    select exists (
      select 1 from public.tenants
      where id = new.associated_record_id and landlord_id = new.landlord_id
    ) into linked;
  elsif new.association_type = 'tenancy' then
    select exists (
      select 1 from public.tenancies
      where id = new.associated_record_id and landlord_id = new.landlord_id
    ) into linked;
  else
    linked := false;
  end if;

  if not linked then
    raise exception 'A document can only be linked to your own %', new.association_type;
  end if;

  if new.storage_path not like (new.landlord_id::text || '/%') then
    raise exception 'Document files must be stored under the landlord''s own folder';
  end if;

  return new;
end;
$$;

create trigger documents_enforce_association
before insert or update on public.documents
for each row execute function public.enforce_document_association();

create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create trigger documents_enforce_landlord
before insert or update on public.documents
for each row execute function public.enforce_landlord_identity();

-- ---------------------------------------------------------------------------
-- Maintenance. Events are append-only.
-- ---------------------------------------------------------------------------

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  service_category text not null check (service_category in (
    'Plumbing', 'Electrical', 'Carpentry', 'Painting', 'Appliance',
    'Structural', 'Pest Control', 'Cleaning', 'Other'
  )),
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (landlord_id, id)
);

create index vendors_landlord_id_idx on public.vendors (landlord_id);

create trigger vendors_set_updated_at
before update on public.vendors
for each row execute function public.set_updated_at();

create trigger vendors_enforce_landlord
before insert or update on public.vendors
for each row execute function public.enforce_landlord_identity();

create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text not null check (char_length(description) <= 1000),
  category text not null check (category in (
    'Plumbing', 'Electrical', 'Carpentry', 'Painting', 'Appliance',
    'Structural', 'Pest Control', 'Cleaning', 'Other'
  )),
  priority text not null check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  status text not null check (status in ('Open', 'In Progress', 'On Hold', 'Resolved', 'Closed')),
  property_id uuid not null,
  unit_id uuid,
  tenant_id uuid,
  tenancy_id uuid,
  reported_at date not null,
  target_resolution_date date,
  resolved_at timestamptz,
  assigned_vendor_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (landlord_id, id),
  foreign key (landlord_id, property_id)
    references public.properties (landlord_id, id)
    on delete restrict,
  foreign key (landlord_id, unit_id)
    references public.rental_units (landlord_id, id)
    on delete restrict,
  foreign key (landlord_id, tenant_id)
    references public.tenants (landlord_id, id)
    on delete restrict,
  foreign key (landlord_id, tenancy_id)
    references public.tenancies (landlord_id, id)
    on delete restrict,
  foreign key (landlord_id, assigned_vendor_id)
    references public.vendors (landlord_id, id)
    on delete restrict
);

create index maintenance_requests_landlord_id_idx on public.maintenance_requests (landlord_id);
create index maintenance_requests_property_id_idx on public.maintenance_requests (property_id);
create index maintenance_requests_status_idx on public.maintenance_requests (landlord_id, status);

create or replace function public.enforce_maintenance_request()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  unit_property uuid;
  tenancy_tenant uuid;
  tenancy_unit uuid;
begin
  if tg_op = 'UPDATE' and old.status = 'Closed' then
    raise exception 'Closed requests can''t be changed';
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not (
      (old.status = 'Open' and new.status in ('In Progress', 'On Hold', 'Resolved'))
      or (old.status = 'In Progress' and new.status in ('On Hold', 'Resolved'))
      or (old.status = 'On Hold' and new.status in ('In Progress', 'Resolved'))
      or (old.status = 'Resolved' and new.status in ('Closed', 'Open'))
    ) then
      raise exception 'A request that is % can''t be moved to %', old.status, new.status;
    end if;
  end if;

  if new.status = 'Resolved' and (tg_op = 'INSERT' or old.status is distinct from 'Resolved') then
    new.resolved_at := coalesce(new.resolved_at, now());
  elsif new.status in ('Open', 'In Progress', 'On Hold') then
    new.resolved_at := null;
  end if;

  if new.unit_id is not null then
    select property_id into unit_property
    from public.rental_units
    where id = new.unit_id and landlord_id = new.landlord_id;

    if unit_property is null or unit_property <> new.property_id then
      raise exception 'The unit must belong to this property and landlord';
    end if;
  end if;

  if new.tenancy_id is not null then
    select tenant_id, unit_id into tenancy_tenant, tenancy_unit
    from public.tenancies
    where id = new.tenancy_id and landlord_id = new.landlord_id;

    if tenancy_tenant is null then
      raise exception 'The tenancy must belong to the same landlord';
    end if;

    if new.tenant_id is not null and new.tenant_id <> tenancy_tenant then
      raise exception 'The tenancy does not belong to the linked tenant';
    end if;

    if new.unit_id is not null and new.unit_id <> tenancy_unit then
      raise exception 'The tenancy does not belong to the linked unit';
    end if;
  end if;

  return new;
end;
$$;

create trigger maintenance_requests_enforce_rules
before insert or update on public.maintenance_requests
for each row execute function public.enforce_maintenance_request();

create trigger maintenance_requests_set_updated_at
before update on public.maintenance_requests
for each row execute function public.set_updated_at();

create trigger maintenance_requests_enforce_landlord
before insert or update on public.maintenance_requests
for each row execute function public.enforce_landlord_identity();

create table public.maintenance_events (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles (id) on delete restrict,
  request_id uuid not null references public.maintenance_requests (id) on delete cascade,
  event_type text not null check (event_type in (
    'created',
    'details_updated',
    'priority_changed',
    'status_changed',
    'resolved',
    'reopened',
    'closed',
    'vendor_assigned',
    'vendor_changed',
    'vendor_removed',
    'note_added'
  )),
  description text not null check (char_length(description) between 1 and 1000),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index maintenance_events_landlord_id_idx on public.maintenance_events (landlord_id);
create index maintenance_events_request_id_idx
  on public.maintenance_events (request_id, occurred_at);

create or replace function public.enforce_maintenance_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  request_landlord uuid;
begin
  -- Updates would rewrite history. Deletes are allowed only so a request or
  -- account can be removed; authenticated clients have no delete policy.
  if tg_op = 'UPDATE' then
    raise exception 'Maintenance events are historical and cannot be changed';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  select landlord_id into request_landlord
  from public.maintenance_requests
  where id = new.request_id;

  if request_landlord is null or request_landlord <> new.landlord_id then
    raise exception 'A maintenance event must belong to the same landlord as its request';
  end if;

  return new;
end;
$$;

create trigger maintenance_events_append_only
before insert or update or delete on public.maintenance_events
for each row execute function public.enforce_maintenance_event();

create trigger maintenance_events_enforce_landlord
before insert or update on public.maintenance_events
for each row execute function public.enforce_landlord_identity();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.rental_units enable row level security;
alter table public.tenants enable row level security;
alter table public.tenancies enable row level security;
alter table public.rent_obligations enable row level security;
alter table public.payments enable row level security;
alter table public.documents enable row level security;
alter table public.vendors enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.maintenance_events enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated
using (id = auth.uid());

create policy profiles_update_own on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- No insert or delete policy: the signup trigger creates the row, and
-- deleting the auth user cascades it.

create policy properties_select_own on public.properties
for select to authenticated using (landlord_id = auth.uid());
create policy properties_insert_own on public.properties
for insert to authenticated with check (landlord_id = auth.uid());
create policy properties_update_own on public.properties
for update to authenticated
using (landlord_id = auth.uid()) with check (landlord_id = auth.uid());
create policy properties_delete_own on public.properties
for delete to authenticated using (landlord_id = auth.uid());

create policy rental_units_select_own on public.rental_units
for select to authenticated using (landlord_id = auth.uid());
create policy rental_units_insert_own on public.rental_units
for insert to authenticated with check (landlord_id = auth.uid());
create policy rental_units_update_own on public.rental_units
for update to authenticated
using (landlord_id = auth.uid()) with check (landlord_id = auth.uid());
create policy rental_units_delete_own on public.rental_units
for delete to authenticated using (landlord_id = auth.uid());

create policy tenants_select_own on public.tenants
for select to authenticated using (landlord_id = auth.uid());
create policy tenants_insert_own on public.tenants
for insert to authenticated with check (landlord_id = auth.uid());
create policy tenants_update_own on public.tenants
for update to authenticated
using (landlord_id = auth.uid()) with check (landlord_id = auth.uid());
create policy tenants_delete_own on public.tenants
for delete to authenticated using (landlord_id = auth.uid());

create policy tenancies_select_own on public.tenancies
for select to authenticated using (landlord_id = auth.uid());
create policy tenancies_insert_own on public.tenancies
for insert to authenticated with check (landlord_id = auth.uid());
create policy tenancies_update_own on public.tenancies
for update to authenticated
using (landlord_id = auth.uid()) with check (landlord_id = auth.uid());
create policy tenancies_delete_own on public.tenancies
for delete to authenticated using (landlord_id = auth.uid());

create policy rent_obligations_select_own on public.rent_obligations
for select to authenticated using (landlord_id = auth.uid());
create policy rent_obligations_insert_own on public.rent_obligations
for insert to authenticated with check (landlord_id = auth.uid());
create policy rent_obligations_update_own on public.rent_obligations
for update to authenticated
using (landlord_id = auth.uid()) with check (landlord_id = auth.uid());
create policy rent_obligations_delete_own on public.rent_obligations
for delete to authenticated using (landlord_id = auth.uid());

create policy payments_select_own on public.payments
for select to authenticated using (landlord_id = auth.uid());
create policy payments_insert_own on public.payments
for insert to authenticated with check (landlord_id = auth.uid());
create policy payments_update_own on public.payments
for update to authenticated
using (landlord_id = auth.uid()) with check (landlord_id = auth.uid());
create policy payments_delete_own on public.payments
for delete to authenticated using (landlord_id = auth.uid());

create policy documents_select_own on public.documents
for select to authenticated using (landlord_id = auth.uid());
create policy documents_insert_own on public.documents
for insert to authenticated with check (landlord_id = auth.uid());
create policy documents_update_own on public.documents
for update to authenticated
using (landlord_id = auth.uid()) with check (landlord_id = auth.uid());
create policy documents_delete_own on public.documents
for delete to authenticated using (landlord_id = auth.uid());

create policy vendors_select_own on public.vendors
for select to authenticated using (landlord_id = auth.uid());
create policy vendors_insert_own on public.vendors
for insert to authenticated with check (landlord_id = auth.uid());
create policy vendors_update_own on public.vendors
for update to authenticated
using (landlord_id = auth.uid()) with check (landlord_id = auth.uid());
create policy vendors_delete_own on public.vendors
for delete to authenticated using (landlord_id = auth.uid());

create policy maintenance_requests_select_own on public.maintenance_requests
for select to authenticated using (landlord_id = auth.uid());
create policy maintenance_requests_insert_own on public.maintenance_requests
for insert to authenticated with check (landlord_id = auth.uid());
create policy maintenance_requests_update_own on public.maintenance_requests
for update to authenticated
using (landlord_id = auth.uid()) with check (landlord_id = auth.uid());
create policy maintenance_requests_delete_own on public.maintenance_requests
for delete to authenticated using (landlord_id = auth.uid());

-- Events can be read and appended. They cannot be updated or deleted.
create policy maintenance_events_select_own on public.maintenance_events
for select to authenticated using (landlord_id = auth.uid());
create policy maintenance_events_insert_own on public.maintenance_events
for insert to authenticated with check (landlord_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Privileges. RLS still applies to authenticated. anon has no table access.
-- The signup trigger is security definer and is not granted to clients.
-- ---------------------------------------------------------------------------

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.enforce_landlord_identity() from public, anon, authenticated;
revoke all on function public.enforce_tenancy_rules() from public, anon, authenticated;
revoke all on function public.prevent_vacant_while_let() from public, anon, authenticated;
revoke all on function public.enforce_payment_allocation() from public, anon, authenticated;
revoke all on function public.enforce_document_association() from public, anon, authenticated;
revoke all on function public.enforce_maintenance_request() from public, anon, authenticated;
revoke all on function public.enforce_maintenance_event() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.delete_landlord_data() from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.properties to authenticated;
grant select, insert, update, delete on public.rental_units to authenticated;
grant select, insert, update, delete on public.tenants to authenticated;
grant select, insert, update, delete on public.tenancies to authenticated;
grant select, insert, update, delete on public.rent_obligations to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.vendors to authenticated;
grant select, insert, update, delete on public.maintenance_requests to authenticated;
grant select, insert on public.maintenance_events to authenticated;

-- OAuth 2.1 authorization-server state for the kir.ai remote MCP connector.
-- These tables are not portfolio data. The service role is the only role that
-- can read or write them. Authenticated landlords reach them through server
-- code that filters by auth.uid(). Portfolio queries never use that role.

create table public.oauth_clients (
  id text primary key,
  client_name text not null,
  redirect_uris text[] not null,
  grant_types text[] not null,
  response_types text[] not null,
  token_endpoint_auth_method text not null default 'none'
    check (token_endpoint_auth_method = 'none'),
  created_at timestamptz not null default now()
);

create table public.oauth_authorization_codes (
  code_hash text primary key,
  client_id text not null,
  client_label text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  code_challenge_method text not null check (code_challenge_method = 'S256'),
  scope text not null,
  resource text,
  supabase_refresh_encrypted text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index oauth_authorization_codes_user_idx
  on public.oauth_authorization_codes (user_id);

create table public.oauth_grants (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  client_label text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null,
  resource text,
  access_token_hash text unique,
  access_expires_at timestamptz,
  refresh_token_hash text unique,
  refresh_expires_at timestamptz,
  supabase_refresh_encrypted text not null,
  supabase_access_encrypted text,
  supabase_access_expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index oauth_grants_user_idx on public.oauth_grants (user_id);

alter table public.oauth_clients enable row level security;
alter table public.oauth_authorization_codes enable row level security;
alter table public.oauth_grants enable row level security;

-- No policies: anon and authenticated are denied. The service role bypasses RLS
-- and is the only caller. Do not add a policy that exposes token columns.

revoke all on table public.oauth_clients from anon, authenticated;
revoke all on table public.oauth_authorization_codes from anon, authenticated;
revoke all on table public.oauth_grants from anon, authenticated;

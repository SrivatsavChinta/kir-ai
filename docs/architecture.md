# kir.ai architecture

kir.ai is a landlord's system of record. Claude, when a landlord connects it, is an external client of that system. The application does not call Anthropic and does not embed a model.

## Application

Next.js 16 App Router, React 19, TypeScript and Tailwind. Signed-in screens live under `app/(app)/`. Sign-in and registration live under `app/(auth)/`. `proxy.ts` refreshes the Supabase cookie session and sends anonymous visitors to `/login`, except for the auth pages, `/api/mcp`, the OAuth token endpoints and `/.well-known`.

Screens read a workspace loaded on the server (`lib/data/workspace.ts`) and write through server actions in `lib/data/actions/`. Those actions validate with the same functions the forms use, then call Supabase as the signed-in user. Client providers are a cache of that server state. They are not the source of truth.

Rent months, balances and overdue status come from `lib/rent-calculations.ts` and the stored `rent_obligations` rows. `syncRentObligations` inserts a missing month once and does not rewrite a bill that already exists. Payments cannot exceed the outstanding amount. Maintenance changes go through the database functions that append history. Ended tenancies stay ended.

## Supabase

PostgreSQL holds properties, units, tenants, tenancies, rent obligations, payments, documents, maintenance requests, maintenance events, vendors and the landlord profile. Migrations:

1. `20261112000000_initial_schema.sql` — tables, constraints, RLS.
2. `20261112000100_storage.sql` — private `documents` bucket.
3. `20261112000200_operations.sql` — tenancy, payment and maintenance functions. They are `security invoker` and take the landlord from `auth.uid()`.
4. `20261112000300_mcp_oauth.sql` — OAuth clients, authorization codes and grants. RLS is on and there are no policies, so a signed-in landlord cannot read tokens through the API.

Every portfolio policy is `landlord_id = auth.uid()` (or the equivalent ownership check). The service-role key is read only by `lib/supabase/admin.ts` and the seed, RLS and MCP live-check scripts. The OAuth store is the only application path that uses it, and only for the OAuth tables.

Files live at `{landlord_id}/{document_id}/{file_name}` in a private bucket. The app opens them with signed URLs that expire after 120 seconds.

## Authentication

Landlords sign in with email and password through Supabase Auth. The server client keeps the session in cookies. `requireSession()` uses that cookie, unless an MCP request has already installed an actor for the same call.

The actor is the important boundary. An MCP tool never receives a landlord id. `lib/data/actor.ts` holds the user-scoped Supabase client in async local storage for the duration of one request. `requireSession()` prefers that actor, so the existing server actions run unchanged and still hit Postgres as that user.

## Remote MCP

`app/api/mcp/route.ts` serves Streamable HTTP with `@modelcontextprotocol/server` `createMcpHandler`. Each request builds a new server. There is no in-memory session, so any Vercel instance can answer. The handler speaks the current protocol and, by default, the 2025 handshake Claude uses today (`2025-03-26`, `2025-06-18`, `2025-11-25`).

Tools are registered in `lib/mcp/tools.ts`. Writes call the existing server actions. Reads use the same mappers and, for rent, `syncRentObligations` and `buildRentLedger`.

### Claude's role

```text
Landlord  →  Claude
Claude    →  POST /api/mcp   (Bearer token)
kir.ai    →  Supabase as that landlord
Landlord  →  kir.ai screens  (same rows)
```

A create from Claude is a row in `properties`. The properties page loads it on the next visit. An edit in the properties page is what `get_property` returns afterwards. Nothing is stored only for MCP.

### OAuth

kir.ai is its own OAuth 2.1 authorization server, because Supabase Auth is the landlord login and is not a public authorization server for Claude.

| Piece | Where |
| --- | --- |
| Protected resource metadata | `/.well-known/oauth-protected-resource` and the `/api/mcp` suffix |
| Authorization server metadata | `/.well-known/oauth-authorization-server` |
| Dynamic client registration | `POST /oauth/register` |
| Client metadata documents | fetched when `client_id` is an HTTPS URL |
| Consent | `/oauth/authorize`, after the landlord signs in |
| Token | `POST /oauth/token`, form-encoded, PKCE S256, refresh rotation |
| Revoke | `POST /oauth/revoke` and Settings → Claude |

The access token Claude sends is an opaque kir.ai token. Its hash is stored. The grant also holds the landlord's Supabase refresh token, encrypted with `MCP_TOKEN_ENCRYPTION_KEY`. When the Supabase access token is near expiry, kir.ai rotates it and writes the new refresh token back. Portfolio queries use `createUserClient` with that access token, not the service role.

Allowed redirects are `https://claude.ai/api/mcp/auth_callback`, `https://claude.com/api/mcp/auth_callback`, and loopback `localhost` / `127.0.0.1` with any port.

## Security boundaries

- No Anthropic SDK, API URL or API key.
- MCP arguments cannot set `landlord_id`. Schemas reject unknown fields.
- A token for landlord A cannot read or update landlord B, because the query runs as A.
- OAuth tables are not readable with the anon or authenticated keys.
- Document links expire. The bucket is not public.
- The consent screen shows the client host and the redirect host before anything is granted.

## What is implemented

- Remote MCP endpoint, discovery, DCR, PKCE, refresh, revoke and consent.
- The read, create and update tools listed in `docs/claude-mcp-setup.md`.
- Settings control to disconnect a grant.
- Tests for the protocol, tool validation, property create/read/update, landlord isolation, OAuth token rotation, and the existing rent rules.
- A live check (`npm run test:mcp-live`) that creates two temporary landlords in the configured Supabase project.

## Not done yet

- The OAuth migration has to be applied in the Supabase project. Until then, consent and token storage cannot succeed there.
- The app is not deployed. Claude's hosted connector needs the public `/api/mcp` URL.
- A real Claude account has not been connected. Protocol tests and the Supabase data-path check stand in for that click-through.
- Document upload through MCP.
- Rate limiting, audit logging beyond maintenance events, and organisation roles.
- `docs/production-readiness.md` describes the earlier prototype. Where it says there is no login or no database, `docs/supabase-setup.md` and this file replace it.

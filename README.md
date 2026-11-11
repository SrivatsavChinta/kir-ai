# kir.ai

Residential rental management for a single landlord. Properties, tenants, rent, documents and maintenance are stored in Supabase. Claude can read and update that same portfolio through a remote MCP connector. The app does not call an AI API.

## Local setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key. Row level security limits it. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Seed, RLS check, and OAuth token storage. |
| `NEXT_PUBLIC_SITE_URL` | Public origin, no trailing slash. |
| `MCP_TOKEN_ENCRYPTION_KEY` | 32 bytes, base64. `openssl rand -base64 32` |
| `DEMO_LANDLORD_EMAIL` / `DEMO_LANDLORD_PASSWORD` | Used only by the demo seed. |

Apply the SQL files in `supabase/migrations/` in order, in the Supabase SQL editor. Add `http://localhost:3000/auth/callback` under Authentication → URL configuration. Then:

```bash
npm run dev
npm run db:seed-demo
```

Open [http://localhost:3000](http://localhost:3000). The demo landlord is `jamie.sample@example.com` unless you changed the email. A newly registered account starts empty.

Setup detail is in [docs/supabase-setup.md](docs/supabase-setup.md). Connecting Claude is in [docs/claude-mcp-setup.md](docs/claude-mcp-setup.md). The shape of the system is in [docs/architecture.md](docs/architecture.md).

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run db:check
npm run build
```

`npm run db:verify-rls` and `npm run test:mcp-live` sign in as temporary landlords against the project in `.env.local`. They skip if those keys are missing. `test:mcp-live` also needs the OAuth migration and `MCP_TOKEN_ENCRYPTION_KEY`.

## Deploy on Vercel

The project is ready to import. It is not deployed from this repository.

1. Push the repository to GitHub yourself. Do not commit `.env.local`.
2. In Vercel, import the project. Framework preset is Next.js.
3. Set the same environment variables as `.env.local`. Use the production origin for `NEXT_PUBLIC_SITE_URL`. Generate a new `MCP_TOKEN_ENCRYPTION_KEY` for production. Do not reuse a key you pasted into a chat.
4. In Supabase → Authentication → URL configuration, set the site URL to the production origin and add `https://YOUR_DOMAIN/auth/callback`.
5. Apply all four SQL migrations if this production project does not already have them.
6. Deploy. Confirm:
   - `https://YOUR_DOMAIN/.well-known/oauth-authorization-server` returns JSON
   - `https://YOUR_DOMAIN/api/mcp` with no token returns 401 and a `WWW-Authenticate` header
7. In Claude, add a custom connector whose URL is `https://YOUR_DOMAIN/api/mcp`.

`app/api/mcp/route.ts` sets `maxDuration` to 60. If the Vercel plan rejects that, lower the export to the plan's limit and redeploy.

The MCP route is stateless Streamable HTTP, so it does not need a sticky server or a session store.

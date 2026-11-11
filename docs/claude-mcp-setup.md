# Connect Claude to kir.ai

kir.ai is the system of record for a landlord's portfolio. Claude is the assistant, and it stays outside the app. There is no Anthropic API key and no chatbot inside kir.ai. Claude reaches the portfolio only through the remote MCP connector at `/api/mcp`.

The connector can list, create and update the signed-in landlord's properties, units, tenants, tenancies, rent, payments and maintenance. It can list document metadata and mint a short-lived download link. It cannot see another landlord's rows. The same Supabase tables and the same validation, rent and maintenance rules back both Claude and the kir.ai screens.

## 1. Before you connect Claude

1. Apply every file in `supabase/migrations/`, including `20261112000300_mcp_oauth.sql`. The OAuth tables have row level security and no policies. Only the service role, used by the authorization server, can read them.
2. Set `MCP_TOKEN_ENCRYPTION_KEY` to 32 bytes of base64 (`openssl rand -base64 32`). kir.ai uses it to encrypt the Supabase refresh token it stores when you approve Claude. Do not commit it.
3. Set `NEXT_PUBLIC_SITE_URL` to the public origin, with no trailing slash. Locally that is `http://localhost:3000`. On Vercel it is the deployment origin, for example `https://your-app.vercel.app`.
4. In the Supabase dashboard, under Authentication → URL configuration, add these redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR_PRODUCTION_DOMAIN/auth/callback`

Claude itself is not a Supabase OAuth redirect. Supabase still needs the kir.ai callback for landlord sign-in and email confirmation. Claude's callback is `https://claude.ai/api/mcp/auth_callback`, and kir.ai allows that address directly.

The OAuth migration is not applied automatically. Until it is, discovery and the unauthenticated MCP response work, and approving Claude fails when kir.ai tries to store the grant.

## 2. The public endpoint

```text
https://YOUR_PRODUCTION_DOMAIN/api/mcp
```

Locally, Claude cannot call `http://localhost:3000` from claude.ai. Use the deployed URL, or a temporary HTTPS tunnel such as `cloudflared tunnel --url http://localhost:3000`, and paste the tunnel's `/api/mcp` URL. Stop the tunnel when you finish testing.

These discovery documents are served from the same origin:

- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-protected-resource/api/mcp`
- `/.well-known/oauth-authorization-server`

An unauthenticated call to `/api/mcp` returns HTTP 401 with a `WWW-Authenticate` header that points at the protected-resource document. That is what starts Claude's sign-in. A normal tool error does not.

## 3. Add the connector in Claude

1. Open Claude (claude.ai, the desktop app, or Claude Code).
2. Go to **Customize → Connectors → Add custom connector**.
3. Paste the MCP URL, including `/api/mcp`.
4. Claude fetches the discovery documents, registers itself (or presents its client metadata document), and sends you to kir.ai.
5. Sign in with your kir.ai landlord account. A new account is empty. The demo landlord is `jamie.sample@example.com` if you have run `npm run db:seed-demo`.
6. On **Connect Claude to kir.ai**, choose **Allow Claude**. You are sent back to `claude.ai`.
7. Enable the connector for the conversation.

Claude Code uses a loopback redirect (`http://localhost:<port>/callback` or `http://127.0.0.1:<port>/callback`). kir.ai accepts that, and ignores the port. Other redirect hosts are rejected.

## 4. What the approval stores

kir.ai does not give Claude your Supabase password or the service-role key.

1. You sign in with Supabase Auth. The browser session stays in an HTTP-only cookie.
2. When you allow Claude, kir.ai stores an encrypted copy of that session's Supabase refresh token against a one-time authorization code.
3. Claude exchanges the code, with PKCE, for a kir.ai access token (1 hour) and a refresh token (30 days).
4. On each MCP call, kir.ai looks up the hash of the access token, decrypts the Supabase refresh token, and uses a short-lived Supabase user JWT.
5. Portfolio queries run with that JWT. Row level security still applies. Tool arguments are never trusted for `landlord_id`.

Refresh tokens rotate. A reused refresh token is rejected. Disconnecting a grant deletes the stored Supabase credential.

## 5. Try the tools

These prompts are real tool calls, not canned replies. Claude chooses the tool. The records then show up in kir.ai, and edits you make in kir.ai show up the next time Claude reads them.

- "Show me all properties in my kir.ai portfolio."
- "Add a new two-bedroom apartment in Whitefield, Bengaluru."
- "Create a tenant named Rahul Sharma and associate him with the new property."
- "Show me the rent payments received this month."
- "Create a maintenance request for a leaking bathroom tap in apartment 203."
- "Update the maintenance request to resolved."
- "Show me all overdue rent obligations."

A two-bedroom apartment still needs a property and a unit. Claude should call `create_property`, then `create_unit` with `bedrooms: 2`. Associating a tenant means `create_tenant` and then `create_tenancy` for a unit that does not already have an active tenancy. Rent amounts are whole rupees. Dates are `YYYY-MM-DD`.

The tools are:

| Tool | What it does |
| --- | --- |
| `list_properties`, `get_property` | Read properties. `get_property` includes that property's units. |
| `list_units`, `list_tenants`, `get_tenant`, `list_tenancies` | Read units, tenants and tenancy history. |
| `list_rent_obligations`, `list_payments` | Rent bills, including overdue, and payments received. |
| `list_maintenance_requests`, `get_maintenance_request` | Requests and their activity history. |
| `list_documents` | Document metadata. Pass `documentId` and `includeSignedUrl: true` for one link that expires in 120 seconds. |
| `create_property`, `update_property` | Create a property, or change only the fields you send. |
| `create_unit`, `update_unit` | Add or change a unit. A unit with an active tenancy cannot be marked Vacant. |
| `create_tenant`, `update_tenant` | Create a person, or change their contact details. |
| `create_tenancy` | Start a tenancy. One active tenancy per tenant and per unit. |
| `record_rent_payment` | Record money against one bill. It cannot exceed the outstanding balance. |
| `create_maintenance_request`, `update_maintenance_request`, `update_maintenance_status` | Open a request, edit it, or move it to Resolved or another allowed status. History is appended. |

There are no delete tools.

## 6. Disconnect

In kir.ai, open **Settings → Claude → Show connections → Disconnect**. That revokes the grant. Claude's next call gets 401 and must be approved again.

You can also remove the connector in Claude's connector settings. Claude may call `POST /oauth/revoke`. If it does not, disconnect from Settings so the stored Supabase refresh token is wiped.

Signing out of kir.ai does not by itself revoke a grant you already approved.

## 7. Limitations

- File upload through MCP is not implemented. Listing metadata and a 120-second signed URL are. Uploads stay in the kir.ai documents screen, in the private `documents` bucket.
- The MCP server is stateless. It does not keep a live SSE session between requests. That is what makes it safe on Vercel. Claude's tool calls are ordinary POST requests.
- `maxDuration` on `/api/mcp` is 60 seconds. A Vercel Hobby plan may reject that and require it to be lowered to the plan limit in `app/api/mcp/route.ts`.
- OAuth clients can only use Claude's hosted callback or a loopback redirect. Dynamic client registration is open on purpose, because Claude registers itself, but a foreign redirect URL is refused.
- There is no rate limit yet.
- This has been tested with the MCP protocol, with an in-memory portfolio, and against the real Supabase project for create, isolation and update through the same functions the tools call. It has not been clicked through from a Claude account, because the OAuth tables are not in the database until you apply the migration and the app is not deployed.

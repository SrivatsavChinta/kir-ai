# Supabase setup

kir.ai stores each landlord's portfolio in Supabase. Properties, units, tenants, tenancies, rent obligations, payments, documents, maintenance and settings are read and written for the signed-in user. Row level security is the isolation layer. The service-role key is not available to the browser.

Until `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, portfolio pages show a configuration message and do not load sample records. Once they are set, every portfolio page requires a signed-in landlord. A new account starts empty.

## 1. Create a project

1. Create a project at [supabase.com](https://supabase.com).
2. In Project Settings → API, copy the project URL, the anon public key and the service role key.
3. Copy `.env.example` to `.env.local` and fill in the values. Do not commit `.env.local`.
4. Restart `npm run dev`.

The service role key bypasses row level security. It is read only by `lib/supabase/admin.ts` (server-only) and by the seed and RLS scripts. It must not be exposed to the browser.

For local email-and-password testing, turn off "Confirm email" under Authentication → Providers → Email, or use the confirmation link. New accounts are not given the sample portfolio.

In Authentication → URL configuration, add `http://localhost:3000/auth/callback` as a redirect URL.

## 2. Apply the migrations

Run these files, in order, in the Supabase SQL editor, or with the Supabase CLI (`supabase db push`) after linking the project:

1. `supabase/migrations/20261112000000_initial_schema.sql`
2. `supabase/migrations/20261112000100_storage.sql`
3. `supabase/migrations/20261112000200_operations.sql`
4. `supabase/migrations/20261112000300_mcp_oauth.sql`

The fourth file is the OAuth state for the Claude connector. It does not change portfolio tables. Apply it before connecting Claude. Details are in `docs/claude-mcp-setup.md`.

The second file creates a private Storage bucket named `documents` (10 MB, PDF/JPEG/PNG). Object names are `{landlord_id}/{document_id}/{file_name}`. The app uploads with the signed-in user's token and opens files through short-lived signed URLs. The bucket is not public.

The third file adds unique phone and email indexes and the functions the app uses for tenancies, payments and maintenance. Those functions are `security invoker`: they run as the signed-in user, and `landlord_id` comes from `auth.uid()`.

There is no hosted database in this repository, so applying the SQL is a manual step. The app does not fall back to sample data if a function is missing.

## 3. Demo landlord

Sample rows are not copied when someone registers. To load the fictional portfolio for one landlord:

```bash
npm run db:seed-demo
```

The script uses the service role key. It creates `DEMO_LANDLORD_EMAIL` (default `jamie.sample@example.com`) if that user does not exist, confirms the email, and replaces only that landlord's portfolio with the files in `lib/mock-data/`. Running it again deletes that landlord's rows and storage objects, then inserts them again, and does not change the password of an existing demo user. Other accounts are left empty.

If Supabase rejects `@example.com` addresses, set `DEMO_LANDLORD_EMAIL` to an address the project accepts. The profile name is still the fictional "Jamie Sample".

Rent obligations are inserted once per tenancy and billing month by `generateRentObligations`, using the sample date 11 Nov 2026 so the fictional history matches. After that, the app treats those rows as snapshots: the expected amount and due date are not rewritten when rent or the due day later changes. The dashboard and payments page read the stored rows. A missing month is inserted once; the unique `(tenancy_id, billing_month)` constraint stops a second copy. Unpaid months that a tenancy no longer covers are removed. Paid months are kept, and a date change that would drop a paid month is rejected in the app.

Placeholder files in `public/sample-documents/` are uploaded into the private bucket, except the Banjara water bill, which is metadata only. `file_size` is taken from the file on disk when it is uploaded.

## 4. Checks

```bash
npm run db:check
npm run db:verify-rls
```

`db:check` reads the migration files and does not need a database. `db:verify-rls` signs in as two temporary landlords and checks that one cannot read or change the other's properties, units, tenants, tenancies, payments, documents, maintenance rows or storage objects, then deletes both users. Without credentials it prints `SKIP` and exits 0. That is not a passing remote test.

## 5. What stays as it is

- Currency stays INR and the time zone stays Asia/Kolkata. They are not columns.
- "Today" for a signed-in landlord is the server's calendar date in Asia/Kolkata. The demo seed still uses 11 Nov 2026 so the sample months stay the same.
- A unit can still be Occupied with no tenancy. The database does not forbid that. It does forbid marking a unit Vacant while it has an active tenancy.
- Ended tenancies cannot be updated. Closed maintenance requests cannot be updated except to add a note. Maintenance events cannot be edited or deleted. Deleting a request removes its events, because the events belong to that request.
- Notification choices are stored and labelled Preview only. Nothing is sent.
- Billing rules that decide which months exist (full month, no proration, hold-on-due-date, tracking from September 2026) still live in `lib/rent-calculations.ts`. A direct database call can insert or change dates without that check. Overpayment, landlord identity and one active tenancy per unit and tenant are enforced in the database.

# kir.ai production readiness

Status as of the Supabase persistence pass (November 2026).

**kir.ai now stores a signed-in landlord's portfolio in Supabase, with row level security.** It is still a prototype and not production-ready for real tenant data. Do not enter real tenant or landlord information. The sections below describe the earlier prototype and the decisions that are still open. Where a bullet says there is no persistence or no login, that part has been replaced: see `docs/supabase-setup.md`.

What this pass changed:

- Portfolio, document, maintenance and settings screens read and write the signed-in landlord's rows. They do not fall back to `lib/mock-data/` when the database is unavailable.
- Document files go to the private `documents` bucket. Previews use signed URLs that expire after 120 seconds.
- Rent bills are stored `rent_obligations` rows, one per tenancy and billing month. `generateRentObligations` decides which months to create. The stored expected amount is not rewritten when the agreed rent later changes.
- "Today" is the server's Asia/Kolkata calendar date. The demo seed still uses 11 Nov 2026 so the fictional history stays aligned.
- Recent activity is built from that landlord's payments, tenants, documents and maintenance requests.
- Notification choices are saved and still send nothing.

What is still true: no payment gateway, no email or WhatsApp, no malware scanning, no audit log beyond maintenance events, no organisation roles, and validation messages still use the default date format. Currency stays INR. The time zone stays Asia/Kolkata.

## 1. Current limitations

### Data and persistence

- All state is held in client-side React context providers: `SettingsProvider`, `PortfolioProvider`, `DocumentsProvider` and `MaintenanceProvider`. Nothing is written to a server, `localStorage`, `sessionStorage` or IndexedDB, by design.
- A reload, a new tab or a direct URL visit starts again from the sample data in `lib/mock-data/`.
- Uploaded files are held as in-memory `Blob`s behind `blob:` URLs (`lib/document-storage/memory-storage.ts`). Large uploads use browser memory until the tab closes. The adapter adds a simulated 400 ms delay.
- IDs come from `crypto.randomUUID()`, with a time-and-random fallback. They are unique per tab only.
- There is one implicit landlord and one portfolio. There is no concept of an account, organisation or ownership on any record.

### Time

- "Today" is fixed to the sample data's reference time, 11 Nov 2026 18:30 IST (`lib/mock-data/dashboard.ts`, `asOf`). Rent status, overdue days, agreement expiry and maintenance targets are all calculated from it.
- Maintenance events and document uploads are stamped with the real clock (`new Date()`). Once the real date moves past the sample date, these timestamps can appear to be "in the future" relative to the dashboard. A real backend needs one authoritative clock.
- IST is treated as a fixed UTC+05:30 offset. India has no daylight saving, so this is correct for India, but the app cannot serve other time zones.
- Rent is tracked only from `RENT_TRACKING_START_MONTH` (September 2026). Earlier months are treated as settled outside the app.

### Settings

- Profile, portfolio and application settings are kept in memory and reset on reload.
- These settings take effect: name, email, phone and portfolio name (header, sidebar and dashboard); date format (all displayed dates); activity time display (dashboard Recent Activity); and dashboard card order.
- Notification preferences are stored but nothing is sent. The settings page labels them "Preview only".
- Currency (INR) and time zone (Asia/Kolkata) are fixed and shown as read-only.
- Validation error messages produced by `lib/*-validation.ts` always use the default date format ("30 Nov 2026"), whatever format the landlord chooses. The validators don't know about settings.

### Features that are placeholders

- Recent Activity on the dashboard is static sample data and is labelled "Sample". It does not reflect changes made in the session.
- Help & Support has no content.
- There is no search, no notifications, no email or SMS, no payment gateway, no exports and no audit log.

## 2. Security risks (if this code were deployed as-is)

| Area | Current state | Risk |
| --- | --- | --- |
| Authentication | None. Every route is public. | Anyone with the URL sees and changes everything. |
| Authorisation | None. No record has an owner. | No isolation between landlords once data is shared. |
| Data storage | Client memory only. | No durability; nothing to protect yet, but nothing is recoverable. |
| Input validation | Client-side only (`lib/*-validation.ts`). | A real API must re-validate everything; client checks can be bypassed. |
| File uploads | Type checked by MIME type and extension, size ≤ 10 MB, in the browser only. | No server-side content sniffing, malware scanning or storage quotas. A spoofed MIME type is accepted. |
| File previews | PDFs render in an `<iframe>` from a `blob:` URL; images in `<img>`. | With real storage, previews must use short-lived signed URLs and safe `Content-Type`/`Content-Disposition` headers. |
| Personal data | Phone numbers, emails, addresses, ID documents (Aadhaar, PAN and so on) are modelled. | Real use falls under India's Digital Personal Data Protection Act 2023. This requires consent, purpose limitation, retention rules and breach handling. |
| Secrets | None in the repo. `.env*` files are git-ignored. | Future Supabase service-role keys must never reach the client bundle. |
| Security headers | Next.js defaults only. | No Content Security Policy, frame-ancestors or rate limiting. |
| Audit | Maintenance has an in-memory activity history only. | No tamper-evident record of who changed rent, payments or tenancies. |

## 3. Backend requirements

1. **Authentication**, with email verification and session handling done on the server. Supabase Auth with server-side session cookies via `@supabase/ssr` is the expected route.
2. **Server-side writes.** Every mutation that providers perform today must become a server action or API route. Each one validates its input again with the same rules as `lib/*-validation.ts` (share the schemas rather than duplicating them).
3. **Transactional operations.** These must be atomic on the server:
   - Recording a payment. It checks the obligation's remaining balance and inserts the payment in one transaction, so concurrent submissions can't overpay.
   - Starting, editing or ending a tenancy. This checks the unit is free and that recorded payments still map to billed months (`findPaymentConflict`), then updates the tenancy and the unit's status together.
   - Replacing a document file. Upload the new object, update the record, then delete the old object, with clean-up if any step fails.
   - Deleting records that others refer to (properties, units, tenants, documents).
4. **Idempotency.** The client now prevents double submission (`useSubmitLock`), but the server still needs idempotency keys or unique constraints on payment creation.
5. **File storage.** A private bucket, signed URLs, server-side type and size checks, and per-landlord path prefixes. The `DocumentStorage` interface in `lib/document-storage/types.ts` is the seam for a Supabase Storage adapter.
6. **A single clock.** Server timestamps (`now()`) for every event, and a server-provided "today" in IST for rent calculations.
7. **Background jobs**, if notifications are built: overdue rent, agreement expiry and maintenance reminders.

## 4. Multi-tenant isolation

Today there is no owner on any record. Before real data:

- Add an owning account (`landlord_id`, or `organisation_id` if more than one person will manage a portfolio) to every table: properties, units, tenants, tenancies, payments, documents, maintenance requests and their events.
- Enable Postgres Row Level Security on every table. Policies must check ownership through `auth.uid()`, not trust IDs sent from the client.
- Child rows must not be attachable to another landlord's parent. For example, a tenancy's tenant and unit must belong to the same landlord. Enforce this with RLS `WITH CHECK` clauses or composite foreign keys that include the owner ID.
- Storage object paths should be prefixed with the owner ID, with storage policies matching the table policies.
- Never use the service-role key in code paths reachable from the browser.
- Test isolation explicitly: one landlord must not be able to read, list, update or delete another landlord's records or files, including by guessing IDs.

## 5. Data-integrity constraints the database must enforce

The prototype enforces these in client code only:

- **One active tenancy per unit**, and one active tenancy per tenant. Use a partial unique index on `unit_id` and on `tenant_id` where `status = 'Active'`.
- **Tenancy dates.** Move-in ≤ move-out. Agreement start ≤ agreement end. Rent due day between 1 and 28. Monthly rent and deposit are non-negative integers (whole rupees).
- **Ended tenancies are final.** The UI says "An ended tenancy can't be reopened". The database should reject status changes from Ended.
- **Payments.** Amount > 0, in whole rupees. Each payment belongs to a tenancy, and its obligation must belong to the same tenancy. The total paid against an obligation must not exceed its expected amount.
- **Unit status vs tenancies.** Currently a unit's status is synced from tenancies, but the landlord can also set "Occupied" by hand with no tenancy. The dashboard occupancy figure counts these. Decide which is the source of truth (see section 7) and enforce it.
- **Unique unit numbers per property.** Unique tenant email or phone only if the business wants it; it isn't enforced today.
- **Referential integrity on deletes.** Decide between restricting deletes and soft-deleting for properties, units and tenants that have tenancies, payments, documents or maintenance history. Documents can currently point at records that no longer exist ("Linked record no longer exists").
- **Maintenance.** Status transitions follow the rules in `lib/maintenance.ts`. A closed request isn't reopened. Events are append-only.

## 6. Supabase migration considerations

- **Stored rent obligations.** Each bill is inserted once for a tenancy and billing month and keeps the expected amount from that moment. Editing the agreed rent does not change past bills. `findPaymentConflict` still rejects a date change that would drop a month that already has payments. The billing rules in section 6 still decide which months are created.
- **Billing rules to carry over exactly:** full-month rent with no proration; a month is billed if the tenant holds the unit on that month's due date; in the move-in month the due date is the move-in date if that is later; a tenant who moves units mid-month can be billed by both tenancies; billing starts from `RENT_TRACKING_START_MONTH`.
- **Amounts** are whole rupees stored as JavaScript numbers. Use `integer` or `bigint` rupees (or paise) in Postgres, never floating point.
- **Dates.** Calendar dates (move-in, due dates, agreement dates, payment dates) are `YYYY-MM-DD` strings and should be `date` columns. Event times are ISO timestamps and should be `timestamptz`. Keep the two separate, as the app does now (`lib/dates.ts`).
- **IDs.** Sample IDs are readable slugs such as `tenant-priya-sharma`. Real rows should use UUIDs. Routes use `generateStaticParams` over sample IDs, so they must switch to dynamic rendering with server-side lookups and `notFound()`.
- **Provider boundaries.** Each provider's mutation functions return `MutationResult` (`{ ok, error, field? }`). Keep that contract so forms don't change when the providers call server actions instead of setting state.
- **Activity feed.** Recent Activity should be built from real event rows (payments, tenancies, documents, maintenance events), filtered by owner, rather than the static `lib/mock-data/dashboard.ts` list.
- **Settings.** `AppSettings` maps naturally to a `landlord_profiles` table and a `portfolio_settings` table. Keep currency and time zone as fixed values until multi-currency or multi-time-zone support is actually designed.
- **Sample documents** in `public/sample-documents/` are publicly served static files. Real documents must never be placed in `public/`.

## 7. Decisions needed before production

1. **Unit status source of truth.** Should a unit's occupancy be derived purely from active tenancies, or may landlords mark a unit occupied without recording a tenancy? Dashboard occupancy and vacancy figures depend on this.
2. **Which rent is the landlord's "potential rent"?** Property pages use each unit's listed rent; Rent & Payments uses the agreed rent on each tenancy. These legitimately differ (for example, the ended Arjun tenancy at A-202 was ₹29,000 against a listed ₹30,000). Decide which figure each screen should show and label it.
3. **Past bills stay frozen.** Editing a tenancy's rent does not change obligations that already exist. Whether a later rent change should rewrite unpaid months is still an open product choice.
4. **Proration** for mid-month move-ins and move-outs, which are currently billed as a full month.
5. **Arrears before the tracking start month,** and how to import opening balances.
6. **Delete policy:** hard delete, soft delete or archive, for each record type, and retention periods for personal data and ID documents.
7. **Account model:** single landlord vs organisation with several users, and what roles exist (owner, manager, accountant, read-only).
8. **Tenant access:** whether tenants will ever log in. This changes the RLS model significantly.
9. **Notifications:** channels (email, SMS, WhatsApp), consent capture and opt-out handling under DPDP rules.
10. **Document handling:** allowed types, maximum size, virus scanning, whether ID documents need extra protection (encryption, restricted access, redaction).
11. **Audit requirements:** which changes must be logged, for how long, and who can view the log.
12. **Hosting region and data residency** for personal data.

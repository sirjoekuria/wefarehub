# Stanriders — Riders Welfare Contribution System

An admin-only contribution register for a Kenyan motorbike riders' association. Built with React 19, TypeScript, Next.js App Router, Tailwind CSS 4, Supabase (PostgreSQL, Auth, Edge Functions), Chart.js, jsPDF / jspdf-autotable, JSZip and Papa Parse.

## What is included

- Email/password administrator login; no member accounts or public sign-up.
- Dashboard: all-time collections, today's payments, unmatched count, contribution chart, recent payments and pickup-point overview.
- Pickup points: search, pagination, creation, editing, deactivation/reactivation. Codes are immutable after creation to preserve account references.
- Members: pickup/status filters, name/phone/QR search, add/edit, active/inactive status, atomic CSV import with validation preview.
- Payments: pickup/date/status filters, receipt/reference search, payment details, searchable member assignment, pagination.
- Reports: pickup point and inclusive date range, paginated preview, A4 PDF, all-points ZIP with progress.
- Daraja C2B validation, confirmation and authenticated one-time URL registration.
- Explicit local demo adapter backed by PostgreSQL/Drizzle. It is **not** a replacement for Supabase in production.

## Folder structure

```
src/
  app/
    page.tsx                    React admin entry point
    layout.tsx                  Metadata and global styles
    globals.css                 Tailwind theme, responsive components and motion
    api/health/route.ts          Database healthcheck
    api/auth/session/route.ts    Explicit local-demo session adapter
    api/data/route.ts            Explicit local-demo data adapter
  components/
    admin-app.tsx               Auth state, navigation, guide and notifications
    admin-shell.tsx             Responsive sidebar and header
    login.tsx                   Administrator login
    dashboard.tsx               Chart.js contribution dashboard
    pickup-points.tsx           Pickup-point CRUD
    members.tsx                 Member CRUD and filters
    import-members.tsx          CSV validation preview and import
    payments.tsx                Payment filters and member assignment
    payment-details.tsx         Original payment record details
    reports.tsx                 Report configuration and preview
    ui.tsx                      Accessible dialogs, pagination, feedback states
  db/
    schema.ts                   Drizzle mirror of the SQL schema + demo-only admins
    index.ts                    Local PostgreSQL connection
  lib/
    api.ts                      Supabase client / demo adapter boundary
    auth.ts                     Verified Supabase user / open sample-demo adapter
    demo-mode.ts                Sandbox demo detection and sample admin identity
    local-service.ts            Drizzle queries for local preview
    validation.ts               Shared client/server input validation
    utils.ts                    KES, Kenyan phones, references, Nairobi dates
    reports.ts                  A4 PDFs and all-points ZIP
    types.ts                    Shared contracts
    use-points.ts               Paginated pickup-point options loader
supabase/
  migrations/20260601000000_initial.sql
  functions/
    _shared/c2b.ts               Database, OAuth and callback helpers
    mpesa-validation/index.ts
    mpesa-confirmation/index.ts
    register-c2b/index.ts
  config.toml                   Callback JWT settings
scripts/
  seed.ts                       Demo data only; refuses to run without DEMO_MODE
  register-c2b.ts                Authenticated, one-time URL registration
supabase/tests/
  setup-local.sql                Disposable-DB Auth stub (never deploy)
  database.test.sql              Totals, chart dates, uniqueness and RLS assertions
supabase/functions/_shared/
  c2b_test.ts                    Deno callback/parser unit tests
tests/admin.spec.ts              Playwright admin workflows and actual downloads
playwright.config.ts
public/
  samples/members.csv            Import template
.env.example
```

## 1. Try the working preview

The hosted sandbox opens a clearly labeled sample admin workspace automatically: **no login, session cookie, or credentials are required for the demo**. This remains steady even if optional `.env` values are reset, because the sandbox preview is detected explicitly. Old logout cookies are ignored. The email/password login and Sign out action remain active for real Supabase deployments; the demo bypass never applies when Supabase is configured or when `DEMO_MODE=false`.

The local demo stores sample records in the sandbox PostgreSQL database through Drizzle. Optional local demo passwords are salted and hashed with scrypt and can be reset with the seed script. These credentials and sample payments must never be used for a real association.

Seed: 108 pickup points (104 active), 1,944 members, and approximately 6,000 sample payments, including unmatched records. Dates are relative to the seeding date. No live Daraja requests are made by the demo.

```sh
npm install
cp .env.example .env
# Set DATABASE_URL and DEMO_MODE=true. Optionally set DEMO_ADMIN_EMAIL /
# DEMO_ADMIN_PASSWORD for the local password form. Leave Supabase URLs blank.
npx drizzle-kit push
npx tsx scripts/seed.ts
npm run dev
```

For the local adapter only, Drizzle uses camelCase TypeScript properties mapped to the exact snake_case database columns. The seed is idempotent and never overwrites existing contribution records.

## 2. Create the Supabase project (database first)

1. Create a Supabase project in an appropriate region.
2. Apply `supabase/migrations/20260601000000_initial.sql` using the SQL editor, or link the project and run `supabase db push`.
3. Confirm the three tables, `payment_status` enum, foreign keys, unique constraints, indexes, RLS policies, and two reporting RPCs exist.
4. In **Authentication → Providers → Email**, enable email/password authentication.
5. Disable **Allow new users to sign up**. Invite/create the association's administrators in **Authentication → Users**. Every authenticated user is an administrator; there are no member roles.
6. Configure Auth Site URL and redirect URLs for your deployed admin domain. Use strong passwords and your project's normal Auth rate limits/CAPTCHA settings.
7. Set the frontend environment variables and deploy the Next.js app. `DEMO_MODE` must be `false` (or unset) in production.

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migration enables RLS on all business tables, revokes anonymous access, and grants authenticated administrators SELECT/INSERT/UPDATE. There are no DELETE policies. Service-role credentials are used only by the callback Edge Functions. Reporting RPCs are `SECURITY INVOKER`, check authentication, and have no anonymous execute grant.

QR numbers are strings, so `001` stays `001`. `(pickup_point_id, qr_number)` is unique. Pickup codes are uppercase letters/digits, 2–16 characters, beginning with a letter. Phones are normalized to `2547XXXXXXXX` or `2541XXXXXXXX`.

## 3. Configure Daraja C2B

Create a Daraja app with C2B access, obtain a C2B-enabled Paybill/shortcode, and request external validation if required. The association's specified production Paybill is **234567**. Sandbox usually uses a different test shortcode supplied in your Daraja portal. Use that test shortcode for simulation; do not send sandbox requests to a real production Paybill.

Set these **Edge Function secrets**, not browser variables:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Target Supabase project URL (also injected by Supabase) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only callback database access; never `NEXT_PUBLIC` |
| `MPESA_ENVIRONMENT` | `sandbox` or `production`; defaults to sandbox |
| `MPESA_CONSUMER_KEY` | Daraja app consumer key |
| `MPESA_CONSUMER_SECRET` | Daraja app consumer secret |
| `MPESA_SHORTCODE` | The actual C2B Paybill/shortcode for this environment |
| `MPESA_PASSKEY` | Daraja OAuth passkey, supplied for credential setup; **not used by C2B** |
| `C2B_RESPONSE_TYPE` | `Completed` (default) or `Cancelled` if validation is unavailable |
| `CALLBACK_BASE_URL` | Optional; defaults to `SUPABASE_URL/functions/v1` |

The passkey is not an initiator security credential. C2B needs neither a passkey nor an initiator credential. Do not confuse these values.

Frontend/build variables:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key, protected by RLS; not the service-role key |
| `DEMO_MODE` | Must not enable local demo in a real deployment |

Local-only variables are `DATABASE_URL`, `DEMO_MODE`, `DEMO_ADMIN_EMAIL`, and `DEMO_ADMIN_PASSWORD`. `DATABASE_URL` is not required by the Supabase frontend or Edge Functions.

```sh
supabase secrets set --project-ref YOUR_PROJECT_REF \
  MPESA_ENVIRONMENT=sandbox \
  MPESA_CONSUMER_KEY=YOUR_KEY \
  MPESA_CONSUMER_SECRET=YOUR_SECRET \
  MPESA_SHORTCODE=YOUR_SANDBOX_SHORTCODE \
  MPESA_PASSKEY=YOUR_DARAJA_PASSKEY \
  C2B_RESPONSE_TYPE=Completed

supabase functions deploy mpesa-validation mpesa-confirmation register-c2b --project-ref YOUR_PROJECT_REF
```

`supabase/config.toml` disables gateway JWT verification **only** for the two public Safaricom callbacks. Registration still requires an authenticated admin JWT. The callback handlers check the configured shortcode, payment amount, receipt and timestamp. Restrict callback access at your gateway/WAF to Safaricom's published source ranges where available; Safaricom C2B does not provide a configurable signing secret.

### Register URLs once per shortcode/environment

Use an administrator in the **target** Supabase project. Do not put its password in source code or shell history.

```sh
export SUPABASE_URL=https://YOUR_PROJECT.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
export ADMIN_EMAIL=admin@yourassociation.co.ke
read -s ADMIN_PASSWORD
export ADMIN_PASSWORD
npx tsx scripts/register-c2b.ts
unset ADMIN_PASSWORD
```

The script signs in, invokes `register-c2b` with that user's JWT, and prints Daraja's registration response. For production, consciously set `MPESA_ENVIRONMENT=production`, use production Edge secrets, and set `CONFIRM_PRODUCTION=yes` for the script. Register again only if callback URLs change.

Registered endpoints:

- `POST /functions/v1/mpesa-validation`
- `POST /functions/v1/mpesa-confirmation`

OAuth uses `/oauth/v1/generate?grant_type=client_credentials` on `sandbox.safaricom.co.ke` or `api.safaricom.co.ke`. Registration uses `/mpesa/c2b/v1/registerurl` with `ShortCode`, `ResponseType`, `ValidationURL`, and `ConfirmationURL`.

Some Daraja configurations reject callback URLs containing the word `mpesa`. If the registration response reports this restriction, deploy the same handlers behind gateway aliases without that word and set `CALLBACK_BASE_URL` to the alias base. Do not change account-reference parsing or disable registration authentication.

`Completed` accepts a payment if validation cannot be reached; confirmation therefore always supports an unmatched fallback. `Cancelled` is only appropriate when the association explicitly wants to cancel payments when validation is unavailable.

### Rocpay Offline Central Payment Sync

For offline collections synced from Rocpay to Stanriders Welfare:

- **Endpoint:** `POST /api/webhooks/rocpay`
- **Auth Header:** `x-rocpay-secret: <ROCPAY_WEBHOOK_SECRET>` (or `Authorization: Bearer <ROCPAY_WEBHOOK_SECRET>`)
- **Payload:** Accepts single transaction object or `{ "batch": [ ... ] }` / array for offline batch synchronisation.
- **Member Matching:** Matches via `account_reference` (`KM001#001`) or explicit `pickup_code` + `qr_number`. Secondary fallback matches by registered member phone.
- **Idempotency:** Unique `transaction_id` prevents duplicate credit upon offline retry. Unmatched payments are flagged for administrative assignment on the Payments page.
- **Test Script:** Run `npx tsx scripts/test-rocpay-sync.ts` to simulate offline sync.

## 4. Payment behavior

Members use **Lipa na M-Pesa → Pay Bill**, business **234567**, account **PICKUPCODE#QRNUMBER**, for example **KM001#001**, and any positive amount in KES.

- Validation trims, uppercases and removes spaces, then requires exactly one `#`, a valid pickup code, and a numeric QR. Both the pickup point and member must exist and be active. Invalid format or unknown/inactive member returns a clear nonzero result.
- Confirmation parses the reference again, looks up an active member, and stores matched or unmatched. The original reference, payer phone and M-Pesa receipt are preserved.
- `mpesa_receipt` is unique. Repeated `TransID` uses an idempotent conflict-ignore upsert, so a duplicate never doubles a total or overwrites an assigned member.
- Confirmation always returns HTTP 200 with `{"ResultCode":0,"ResultDesc":"Accepted"}` as requested. Persistence/validation failures are logged for reconciliation; **monitor Edge Function logs** because the required acknowledgement does not imply database success.
- `TransTime` is interpreted in Africa/Nairobi (UTC+03:00). Dashboard “today” and inclusive report dates use Nairobi time, not the administrator's browser timezone.
- Assigning an unmatched payment is an atomic update conditioned on its current unmatched status. A second admin cannot silently overwrite the first assignment. Historical parsed references remain unchanged.
- Reports include matched payments only. Assign unmatched payments first. Inactive members remain in historical reports; deactivation never removes records.

## 5. CSV import

Required header (see `public/samples/members.csv`):

```csv
full_name,phone,qr_number,pickup_code
Jane Wanjiku,0712345678,025,KM001
Paul Otieno,0112345678,026,KM001
```

- Up to 5,000 rows / 2 MB per file.
- Accepts `07XXXXXXXX`, `01XXXXXXXX`, `+2547XXXXXXXX`, `+2541XXXXXXXX`, and the corresponding `254` forms.
- QR: 1–12 digits; keep leading zeros by formatting the spreadsheet column as text.
- Pickup code must exist and be active.
- Preview checks missing headers, CSV quoting/field errors, names, phones, QR formats, pickup codes and duplicate QR numbers in the file **and existing register**.
- Any invalid row blocks the import. Correct the CSV and upload again.
- The server revalidates everything and checks the database uniqueness constraint. Local imports run in a transaction; Supabase imports use one atomic insert. A concurrent duplicate cannot create a partial import.

## 6. PDF and ZIP reports

Choose one point or all points and an inclusive date range (up to 366 days), then **Preview report**. The preview is paginated; the PDF always includes every member in the selected report, including zero-payment members.

PDFs are A4 portrait and contain association branding, pickup name/code, date range, QR No, Name, Phone, No. of payments, Total paid, grand total, generated date and `Page X of Y`. Currency is KES. **Download all pickup points** creates one PDF per point, including inactive points, inside a ZIP. Generation is chunked to avoid launching 100+ report requests at once.

## Sandbox / acceptance test checklist

These are deployment tests, not a claim that live Safaricom credentials were supplied.

### Authentication and access
- [ ] Sign out; verify the login screen. Wrong password fails. Correct admin email/password succeeds.
- [ ] Public sign-up is disabled. Member credentials do not exist.
- [ ] Anonymous Supabase REST/RPC reads and writes fail. Authenticated admin access succeeds.
- [ ] Calling `register-c2b` without an admin JWT fails.
- [ ] In production, `/api/data` and local session login cannot bypass Supabase.

### Pickup points and members
- [ ] Create a point with a unique code; duplicate code is rejected.
- [ ] Edit its display name; code remains unchanged. Deactivate and reactivate without losing history.
- [ ] Search by code/name; test pagination and empty results.
- [ ] Add a member with `07...`, `01...`, and `+254...`; stored phone is normalized.
- [ ] Preserve QR `001`; duplicate `001` at the same point fails, but `001` at another point succeeds.
- [ ] Import the sample CSV into a fresh test point. Preview shows two valid rows.
- [ ] Test bad phone, missing name, unknown/inactive point, malformed QR and duplicate QR. Invalid rows are visible; no partial import occurs.
- [ ] From a pickup point's member count, open Members filtered to that point.

### Daraja sandbox simulation
- [ ] Deploy functions, set sandbox secrets, register URLs, and confirm external validation is enabled for the test shortcode.
- [ ] Seed a test member and point using the admin UI.
- [ ] In Daraja, simulate C2B `CustomerPayBillOnline` using the supplied test MSISDN, test shortcode and a variable amount.
- [ ] Use `BillRefNumber: " KM001#001 "` to test trimming/case/space normalization.
- [ ] Validation accepts; confirmation inserts one matched payment with the original reference and correct Nairobi payment time.
- [ ] Dashboard total, today's count, recent payments and member report reflect the amount.

You can also simulate with Daraja's `/mpesa/c2b/v1/simulate` API using `ShortCode`, `CommandID: CustomerPayBillOnline`, `Amount`, `Msisdn`, and `BillRefNumber`. Use the portal's test MSISDN and shortcode.

### Duplicate receipt
- [ ] Send the same confirmation body twice, including the same `TransID`.
- [ ] Both responses are `ResultCode: 0, ResultDesc: Accepted`.
- [ ] Only one payment row exists; dashboard and report totals do not change after the second call.
- [ ] A duplicate of an already assigned payment does not reset its member or status.

### Wrong account / unmatched assignment
- [ ] Validation rejects `KM001001`, `KM001#`, `#001`, `KM001#ABC`, and an unknown member with clear descriptions.
- [ ] With validation disabled (or `Completed` fallback), send confirmation with `KM999#001` or an empty reference.
- [ ] Confirmation still acknowledges; payment is stored unmatched with a null member ID and the original reference.
- [ ] Open Payments → Unmatched, choose **Assign member**, search by name/phone/QR, and confirm the correct member.
- [ ] Payment becomes matched, unmatched count decreases, and the member's report includes the payment.
- [ ] Repeat assignment from a second admin session: it cannot overwrite an already matched payment.

### Reporting and usability
- [ ] Date boundaries include payments on both start and end dates in Nairobi, including near midnight EAT.
- [ ] Preview totals match the PDF grand total. Unmatched payments are excluded until assigned.
- [ ] A report with more than one page repeats table headers and has correct page numbers and generated date.
- [ ] All-points ZIP contains a PDF for every pickup point, with correct code/date filenames.
- [ ] Test at phone, tablet and desktop widths; tables scroll horizontally, dialogs remain reachable, and loading/empty/error states are visible.
- [ ] Copy payment reference, clear filters, paginate, cancel dialogs and use Escape/Tab navigation.

## Validation commands

```sh
npx next typegen
npm exec tsc -- --noEmit --pretty false
npm run build
```

The platform's `build_and_start` verification additionally checks `/api/health`. The included demo is functional without Daraja keys; live payment acceptance requires the Supabase/Daraja setup above.

Automated checks (run against a started **demo** preview for browser tests):

```sh
# Callback parsing, phone formats, amounts and Nairobi timestamps
npx deno test --allow-env supabase/functions/_shared/c2b_test.ts
npx deno check supabase/functions/mpesa-validation/index.ts supabase/functions/mpesa-confirmation/index.ts supabase/functions/register-c2b/index.ts

# Browser tests: CRUD, CSV, assignment, PDF/ZIP, direct demo access and mobile navigation
npx playwright install chromium
# On Linux, install browser system libraries if needed:
npx playwright install-deps chromium
PLAYWRIGHT_BASE_URL=https://YOUR_PREVIEW_URL npx playwright test

# SQL migration test: use a disposable database, never the real project.
createdb migration_validation
psql -d migration_validation -v ON_ERROR_STOP=1 \
  -f supabase/tests/setup-local.sql \
  -f supabase/migrations/20260601000000_initial.sql
# Load sample pickup_points, members and payments into this test database.
psql -d migration_validation -v ON_ERROR_STOP=1 -f supabase/tests/database.test.sql
```

The browser suite creates clearly named `QA` / `QT` test records. Run it only in a disposable demo database. PDF/ZIP test artifacts are written to `test-results/` and the system temporary directory. Production dependencies were checked with `npm audit --omit=dev`; rerun after updating dependencies.

## Assets and branding

STANRIDERS is used as the association identity based on the supplied pickup-name example. Update the shared association constant and Brand component if the registered association name differs. Icons are Lucide. Login photograph: marie frank / Pexels, “Urban Motorcycle Taxi Rider in Nairobi Street” (photo 33757408). Fonts: Manrope and DM Sans via Google Fonts, with local sans-serif fallbacks.

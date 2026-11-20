# RentPadi — Implementation Roadmap

Companion to [Rent Manager — Landlord Interviews & MVP Plan](./Rent%20Manager%20—%20Landlord%20Interviews%20&%20MVP%20Plan.md).
That doc says **what** to build and **whether** to build it. This one says **how** and **in what order**.

Starting point: Vite 8 + React 19 + TypeScript scaffold, nothing else yet.

---

## Guiding principles

1. **The interviews gate the build.** Phase 0 setup work is safe to do in parallel, but don't go past Phase 2 until you hit the bar: at least 8 of 20 landlords with strong pain and 3 committed pilots.
2. **Money is never ours.** Funds settle straight to the landlord's bank account through a Paystack subaccount (0% split to RentPadi; Flutterwave until Phase 7). We never hold a balance.
3. **The ledger is the product.** Every naira is stored as integer kobo. Charges and payments are append-friendly, and nothing is silently overwritten.
4. **Mobile-first, low-bandwidth.** Assume a mid-range Android phone on 3G. Pages stay small and forms stay short.
5. **Ship to pilots every phase.** Each phase ends with something a pilot landlord could see, even if you're the one driving it.

---

## Phase 0 — Validation & long-lead setup (now → end of interviews, ~2 weeks)

Some of these approvals take days or weeks, so **start them today**, even before the interviews finish.

| Task | Why now |
| --- | --- |
| Create a **Paystack business account** and complete its compliance checks (CAC docs or a starter-business route). *(Originally Flutterwave; see Phase 7.)* | Going live and creating subaccounts needs approval. This can take 1–3 weeks. |
| Create a **Termii account** and register a **sender ID** (e.g. `RentMgr`) | Sender ID approval takes days. Without it, messages to DND numbers fail. |
| Create the **Supabase project** (choose the region closest to Nigeria, e.g. `eu-west`) and the **Vercel project** | Free, instant, and unblocks Phase 1. |
| Buy a domain (e.g. `rentmanager.ng` or `.com.ng`) | SMS links look more trustworthy with a short, branded domain. |
| Keep the **manual pilot** running: one Google Sheet plus WhatsApp reminders sent by hand | Real data and real objections to design against. |

**Repo foundation (≈1 evening):**
- [x] Add Tailwind v4 (`@tailwindcss/vite`) and initialise shadcn/ui
- [x] Add `react-router`, `@tanstack/react-query`, `@supabase/supabase-js`, `react-hook-form` + `zod`, `date-fns`
- [x] Add the Supabase CLI, run `supabase init`, and keep migrations in `supabase/migrations/`
- [x] Set up `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, plus `.env.example`
- [x] Add `vercel.json` with an SPA rewrite to `/index.html`
- [x] Add Vitest for unit tests (charge and date maths especially)
- [x] Replace the Vite template README with a project README

**Done when:** the interview scorecard has 20 entries and the go/no-go decision is written down. If interviews show **caretakers** are the main collectors, or that **monthly savings** matters more than reminders, revise this roadmap before Phase 1.

---

## Phase 1 — Foundation (~1 week): auth, schema, properties, units, tenants

**Goal:** a landlord can sign in with their phone and enter their whole portfolio.

### Database (first migration)
- [x] Create the portfolio tables (landlords, properties, units, tenants) with enums, foreign keys and indexes. Charges and payments tables come in their own phases
- [x] Turn on **RLS on every table**. Policies chain ownership back to `landlords.id = auth.uid()`
- [x] TypeScript types: hand-written in generated format for now; `npm run db:types` replaces them once the CLI is linked

### Auth
- [x] Supabase **phone OTP** login
- [x] **Send SMS Auth Hook**, demo version: a Postgres hook stores OTPs in `dev_sms_outbox`
- [x] Edge function `sms-hook` (signed Send SMS hook) that delivers OTPs through Termii: built and deployed, **switched on once Termii approves the sender ID** (steps in README)
- [x] Normalise phone numbers to E.164 (`+234…`). Accept `080…`, `234…` and `+234…` input
- [x] First login → onboarding: name (bank details come in Phase 3)

### Screens
- [x] App shell: bottom nav (Dashboard · Properties · Tenants · Settings)
- [x] Properties: list, add, edit, delete (blocked once a unit has tenant history)
- [x] Units within a property: label, type, rent amount, rent period; "save and add another"
- [x] Tenants: add to a vacant unit (name, phone, start date, period, agreed amount, "paid up to"), edit, mark moved out
- [x] Empty states that guide the next step ("Add your first property")

**Done when:** you can enter a real pilot landlord's portfolio (from the manual-pilot sheet) in under 10 minutes on a phone.

---

## Phase 2 — Charges engine & dashboard (~1 week)

**Goal:** the app knows what each tenant owes and when, and the landlord can see it at a glance.

### Charge generation (the core logic; test it well)
- [x] A pure SQL function (`chargeable_periods`) returns each period's `period_start` and `period_end`; `due_date` = `period_start`
  - Rent is due on `period_start` (Nigerian norm: rent is paid in advance)
  - Watch month-end edge cases: a tenancy starting Jan 31 should not drift to Feb 28 forever. Anchor to the original start day
- [x] When a tenant is added or their terms change, a trigger (re)builds their unpaid charges. "Paid up to" stops existing tenants showing as overdue
- [x] A **daily `pg_cron` job** (00:30 Lagos) creates the next charge **45 days before** it's due
  - Changed: "overdue" is not a stored status. The `charge_overview` view derives it from `due_date` vs today (Lagos time), so it's always current without a job flipping it
- [x] Unique constraint on `(tenant_id, charge_type, period_start)` so the job can rerun without creating duplicates
- [x] SQL tests for yearly, 6-monthly and monthly periods, leap years, month-end starts, paid-up-to and move-out (`supabase/tests/chargeable_periods.sql`)

### Dashboard
- [x] Summary cards: collected this month, overdue and due in 30 days (amount + count)
- [x] Lists: **Overdue** → **Due in 30 days** → **Paid recently**, each row showing tenant, unit, amount and days late or left
- [x] Tap a row → tenant detail with their charges
- [x] Queries go through the `charge_overview` view (security_invoker, so RLS applies)

**Done when:** the dashboard for a pilot landlord matches their own notebook or sheet.

---

## Phase 3 — Payments (~1 week)

**Goal:** a tenant pays online and the charge flips to paid automatically, with money landing in the landlord's account.

> **Built on Flutterwave, since moved to Paystack (Phase 7).** The design below still holds (on-demand checkout, verify before recording, one `record_payment`), but the functions are now `payout`, `pay-checkout`, `pay-verify` and `pay-webhook`, and the landlord's subaccount is a Paystack one. Setup steps are in the README.

### Landlord payout setup
- [x] Bank picker (popular banks first) from Flutterwave `GET /banks/NG`
- [x] **Resolve the account name** (`POST /accounts/resolve`) and show it back to the landlord to confirm. This catches typos before money goes astray
- [x] Edge function `flw-payout` (banks / resolve / save): creates or updates the subaccount and stores `flw_subaccount_id`. Payout columns are writable only by the function. Secret keys live only in edge function secrets, never in the client

### Checkout
- [x] Create the Flutterwave checkout **on demand** when the tenant taps Pay, rather than pre-generating static links. Amounts change (partial payments, edits), and on-demand checkout always uses the current balance
- [x] Edge function `flw-checkout`: takes the tenant token and charge ID, then:
  - inserts a `payment_attempts` row with a unique `tx_ref`
  - calls Flutterwave `POST /v3/payments` with the `subaccounts` split, `redirect_url` and customer phone
  - returns the hosted checkout URL

### Webhook (the part that must be bulletproof)
- [x] Edge function `flw-webhook`:
  1. Check the `verif-hash` header against your secret hash
  2. Store the raw event in `webhook_events` (helps debugging and makes replays safe)
  3. **Re-verify** via `GET /transactions/{id}/verify`. Never trust the webhook body alone
  4. Check status `successful`, the currency `NGN` and the amount against the attempt
  5. Inside a single SQL function (`record_payment`): insert the payment (`reference` is unique, so duplicates are no-ops) and update the charge's `amount_paid_kobo` and `status`
- [x] The redirect page (`/t/:token/paid`) calls `flw-verify`, so the tenant sees a result even if the webhook is slow
- [x] Unit tests for settlement: underpayment, wrong currency, failed / pending / unknown transactions, kobo conversion (`npm run test:functions`)
- [x] Basic tenant page (`/t/:token`) with a Pay button per open charge, via the token-checked `tenant_portal` RPC (full page in Phase 5)
- [x] Tested end-to-end in Flutterwave **test mode**: two payments recorded, a resent webhook was processed without double-counting

**Done when:** a test payment flips the charge to paid within seconds, and replaying the webhook changes nothing.

---

## Phase 4 — Reminders & manual payments (~1 week)

**Goal:** tenants get nudged automatically, and cash payments are recorded too.

### Reminders
- [x] Daily `pg_cron` job (`queue-rent-reminders`, 9am WAT) queues each day's reminders in SQL (`queue_reminders`)
- [x] Sender: edge function `send-reminders` (pg_cron, every 5 minutes) delivers queued reminders by SMS through Termii and on WhatsApp. **SMS goes out once the `TERMII_*` secrets are set and Termii approves the sender ID**; until then SMS reminders stay **queued** and are shown on the tenant page
- [x] Schedule before due: **yearly 60, 30, 14, 7, 1 days**; **six-monthly 30, 14, 7, 1**; **monthly 14, 7, 1**. Then overdue at **+1, +7 and +14 days**. Yearly charges are created 75 days ahead (45 otherwise) so the first reminder has a charge
- [x] Unique constraint on `reminders (charge_id, kind)` so each reminder sends at most once, even across retries
- [x] Skip charges that are paid; for partially paid charges, mention the balance
- [x] Keep SMS short (≤160 characters, one segment): `Hi Tola, your rent of N350,000 for Flat 2 is due 1 Dec. Pay securely: rent-padi.vercel.app/t/x7Kp2 – Mr Adeyemi`
- [x] Reminders card on the tenant page: each reminder's date, timing, status and text
- [x] **Send reminder on WhatsApp** button (same wording as the SMS), works without any SMS provider
- [x] Store the provider's message ID (`provider_message_id`) and mark send failures; WhatsApp delivery failures come back through `wa-webhook`
- [ ] Termii delivery reports (delivered / undelivered) for SMS
- [x] Per-tenant toggle to pause reminders (tenant form, since Phase 1) for a tenant (landlords will ask for this)

### Manual payments
- [x] "Record payment" on a charge: amount, method (cash / transfer), date, optional note or reference
- [x] Partial amounts allowed (never more than owed); the status updates via the same `record_payment` function as the webhook
- [x] Void a hand-recorded payment with a reason, keeping the row. Mistakes happen, but the ledger stays auditable

**Done when:** a pilot tenant receives the reminder and the landlord can log a cash payment in three taps.

---

## Phase 5 — Receipts, tenant page, history (~1 week)

**Goal:** tenants get proof of payment, and landlords get a full ledger.

### Tenant page (no login): `/t/:token`
- [x] `tenants.access_token` is random and unguessable (24 URL-safe characters, 144 bits)
- [x] Data is served through a `SECURITY DEFINER` RPC (`tenant_portal`) or edge function that takes the token. **Don't** open RLS to anonymous users
- [x] Shows the landlord's name, unit, the earliest amount due (one at a time) with a **Pay** button, the next amount, and past receipts
- [x] Trust signals: landlord name, the payment company's name (now Paystack), and "Money goes directly to [landlord's bank name] account ending 1234"
- [x] Landlord can regenerate the token (**Reset link**), which invalidates the old link

### Receipts
- [x] A sequential receipt number per landlord (`RP-0001`), assigned after insert so webhook replays never skip a number
- [x] Receipt page at `/r/:token`, printable (voided payments marked VOID). Show the amount, period covered, method, date and balance remaining
- [x] Receipt SMS queued automatically after every payment (online or manual); delivered once the SMS sender exists. **Send on WhatsApp** works now

### History
- [x] Tenant statement: all charges and payments with a running balance (`/tenants/:id/statement`)
- [x] Unit history: all tenants over time (on the unit's page)
- [x] CSV export: per-tenant statement, and all payments from Settings (formula-injection safe)

**Done when:** a tenant can open their link on a cheap phone, pay, and receive a receipt, all without an account.

---

## Phase 6 — Pilot launch & hardening (~1 week)

- [x] Speed on slow connections: pages load on demand; tenant links skip the login system and supabase-js (252 kB → 141 kB gzipped); loading screen in the HTML; non-blocking font; landlord pages prefetched when idle (not on Data Saver/2G)
- [ ] Switch Paystack and Termii to **live** keys and do one real ₦100 payment end-to-end
- [ ] Error monitoring (Sentry free tier) on the frontend and edge functions
- [ ] Daily Supabase backups (or a scheduled `pg_dump` while on the free tier)
- [x] Short privacy notice and terms (NDPA 2023), accepted at onboarding with version and time recorded; changing `TERMS_VERSION` asks everyone again. **Have a lawyer review the drafts and set a real support mailbox before launch.**
- [x] Proper landlord onboarding: email (the payment company's contact for the landlord's subaccount, instead of a placeholder), optional name shown to tenants, terms consent; existing landlords asked once
- [x] Support mailbox: `SUPPORT_EMAIL` (website) and `VITE_SUPPORT_EMAIL` (app) settings, default rentpadiii@gmail.com
- [x] Login: plain-English errors, resend with 60 s countdown, code auto-submits
- [x] Guided setup: dashboard checklist + spotlight tour that dims the app and points at each button (property → unit → tenant → payout)
- [ ] Onboard 3–5 pilot landlords **in person**: enter their data with them and watch where they hesitate
- [ ] Message tenants beforehand (through the landlord) so the first SMS isn't mistaken for a scam
- [ ] Weekly check-in with each pilot; log every confusion in a single "pilot feedback" list
- [ ] Track: % of charges paid via link vs cash, days late on average, reminder → payment conversion

**Exit criteria for the MVP:** for one full rent cycle, at least one pilot landlord's tenants pay through the links, and the landlord stops using their notebook.

---

## Phase 7 — After the pilot (pick based on evidence)

Pick from the "Later" list in the plan, prioritised by what the pilots ask for and pay for:

| Trigger from pilot | Build next |
| --- | --- |
| Caretakers do most collecting | Caretaker accounts with role-based RLS (view and record payments, no payout changes) |
| Tenants struggle with lump sums | Rent savings (only with a licensed partner; we still don't hold money) |
| Landlords ask "can it also do…" | Service charge, electricity and water as extra charge types (the schema handles this via `charge_type`) |
| Older landlords struggle | Yoruba and Pidgin UI (set up `i18n` keys from Phase 1 to make this cheap), voice-note help |
| Low SMS open rates | ✅ **Built (branch `phase-7-whatsapp`):** WhatsApp Business (Meta Cloud API). A tenant chat to check rent, pay and get receipt PDFs; reminders and receipts on WhatsApp alongside SMS (landlord switch); one sender for SMS and WhatsApp. Live once Meta is set up (README). |
| Paperwork pain | Tenancy agreement and quit notice templates (PDF) |
| Gateway fees too high | ✅ **Built (branch `phase-7-paystack`):** rent moved from Flutterwave (uncapped 2%) to Paystack (capped fee). Landlord subaccounts with a 0% split and `bearer: "subaccount"`, so tenants pay exactly the rent; functions `payout`, `pay-checkout`, `pay-verify`, `pay-webhook`. Existing landlords confirm their payout account once. Steps in the README. |
| Ready to charge | Pricing: a free plan that takes a capped % of online rent (Paystack split, `transaction_charge`), or subscription tiers with no %. Plan in [PRICING.md](PRICING.md) |

### Also built in Phase 7

- **WhatsApp login codes** for landlords (`sms-hook`, order set by `OTP_CHANNELS`)
- **Send a reminder now** from RentPadi's WhatsApp number, at most one every 12 hours (`send-reminder-now`)
- **Brand:** the Rent Padi logo across the app, icons and link previews ([BRAND.md](BRAND.md))
- **Settings:** collapsible cards; Appearance (device, light or dark); short, purposeful motion
- **Desktop layout:** sidebar from 1024px, wider dashboard, tenant table and search, split login screen; tenant search on phones too
- **Marketing website** in `website/` (static pages, deployed on Cloudflare Pages)
- **Paystack payout:** at most one account lookup per save (signed lookup proof)
- **Fees on every online payment:** `gateway_fee_kobo` (Paystack's fee, from verify) and `platform_fee_kobo` (RentPadi's, fixed at checkout on `payment_attempts`, ₦0 in the pilot). Landlords see "Paystack fee ₦322.50 · RentPadi fee ₦0 · ₦99,677.50 to your bank" on each payment and in the CSV export; tenants never see fees
- *In review:* test-mode shortcut that skips the account lookup (`PAYSTACK_TEST_SKIP_LOOKUP`, branch `phase-7-test-lookup-shortcut`)

### Next up

1. **Plans and entitlements:** plan tables and one `landlord_entitlements` function, everyone on a pilot plan; gate WhatsApp reminders first to test the gating (step 2 of the [PRICING.md](PRICING.md) rollout; step 1 is done).
2. **Before charging anyone, finish Phase 6:** live keys and one real ₦100 payment, error monitoring, daily backups, and the pilot itself.

---

## Schema (refined)

Changes from the plan doc: amounts stored as **kobo**, partial-payment support, tenant access tokens, idempotency tables, and `charge_type` for later bills.

```sql
-- enums
create type rent_period    as enum ('monthly','six_monthly','yearly');
create type charge_status  as enum ('unpaid','partially_paid','paid','cancelled');  -- overdue is derived (charge_overview)
create type payment_method as enum ('link','cash','transfer');

landlords        (id uuid pk = auth.users.id, name, phone unique,
                  bank_code, account_number, account_name,
                  paystack_subaccount_code, created_at)

properties       (id, landlord_id fk, name, address, created_at)

units            (id, property_id fk, label, unit_type,
                  rent_amount_kobo bigint, rent_period, created_at)

tenants          (id, unit_id fk, name, phone, start_date,
                  rent_amount_kobo bigint, rent_period,   -- snapshot; unit rent can change later
                  status ('active','moved_out'), moved_out_at,
                  access_token unique, reminders_enabled bool default true)
                  -- partial unique index: one active tenant per unit

rent_charges     (id, tenant_id fk, charge_type default 'rent',
                  period_start, period_end, due_date,
                  amount_kobo bigint, amount_paid_kobo bigint default 0,
                  status charge_status,
                  unique (tenant_id, charge_type, period_start))

payment_attempts (id, charge_id fk, tx_ref unique, amount_kobo, gateway, platform_fee_kobo,
                  status ('pending','successful','failed'), created_at)

payments         (id, charge_id fk, amount_kobo, method,
                  reference unique, gateway ('paystack','flutterwave' | null for manual),
                  gateway_transaction_id, gateway_fee_kobo, platform_fee_kobo,
                  receipt_number, receipt_token unique,
                  recorded_by uuid null, note,
                  voided_at, void_reason, paid_at)

reminders        (id, charge_id fk,
                  kind ('d60','d30','d14','d7','d1','od1','od7','od14','receipt','manual'),
                  channel ('sms','whatsapp'), scheduled_for, sent_at,
                  provider_message_id, status ('queued','sending','sent','failed','skipped'),
                  unique (charge_id, kind))

webhook_events   (id, provider, event_type, external_id, payload jsonb,
                  received_at, processed_at, error)
```

`landlord_id` lives only on `properties`. RLS on deeper tables joins up the chain. If that gets slow or awkward, denormalise `landlord_id` onto `tenants` and `rent_charges`.

---

## Project structure

```
src/
  app/            routes, layout, providers (QueryClient, auth)
  features/
    auth/         OTP login
    landlord/     onboarding, profile
    onboarding/   setup checklist, guided tour
    properties/   properties + units
    tenants/      tenant CRUD, tenant detail, statement
    charges/      rent charges
    dashboard/
    payments/     record payment, payment history, reminders
    payout/       payout account (Paystack)
    settings/
    legal/        terms, privacy
    public/       tenant page (/t/:token), payment result, receipt (/r/:token)
  components/ui/  shadcn components
  lib/            supabase client, money (kobo ⇄ ₦ formatting), dates, phone
  types/          generated database types
supabase/
  migrations/
  functions/      payout, pay-checkout, pay-verify, pay-webhook (Paystack),
                  send-reminders, send-reminder-now, wa-webhook, sms-hook
website/          marketing site (static HTML, its own build: npm run site:build)
```

---

## Decisions to make (ideally from the interviews)

1. ✅ **Who pays the payment company's fee?** Decided: the landlord, deducted from their share (Paystack `bearer: "subaccount"`). Tenants always pay exactly the rent. See [PRICING.md](PRICING.md).
2. **Partial payments:** this roadmap assumes yes, since paying in instalments is common. Confirm with landlords.
3. **Existing tenants mid-tenancy:** onboarding needs a "last paid up to" date rather than only a start date.
4. **Unit rent changes:** apply to the next tenancy only, or at renewal? This roadmap snapshots rent on the tenant row.
5. **Reminder sender name:** the landlord's name in the message body vs a neutral brand. Tenants may trust their landlord's name more.

## Key risks

| Risk | Mitigation |
| --- | --- |
| Paystack live approval is slow, or the gateway changes again | Start in Phase 0. The payment functions are gateway-neutral (`pay-*`, `payout`) and payments record their `gateway`, so switching again is contained |
| SMS blocked by DND or not delivered | Registered sender ID, Termii's DND route, delivery-status tracking |
| Tenants think the payment link is a scam | Landlord warns tenants first, landlord name on the page, branded domain, small first payment |
| Double-counting payments | Unique `reference`, verify before recording, one `record_payment` function for every path |
| Scope creep before the pilot proves value | Anything not in the Must-have table waits for Phase 7 |

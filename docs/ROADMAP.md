# Rent Manager — Implementation Roadmap

Companion to [Rent Manager — Landlord Interviews & MVP Plan](./Rent%20Manager%20—%20Landlord%20Interviews%20&%20MVP%20Plan.md).
That doc says **what** to build and **whether** to build it. This one says **how** and **in what order**.

Starting point: Vite 8 + React 19 + TypeScript scaffold, nothing else yet.

---

## Guiding principles

1. **The interviews gate the build.** Phase 0 setup work is safe to do in parallel, but don't go past Week 2 until you hit the bar: at least 8 of 20 landlords with strong pain and 3 committed pilots.
2. **Money is never ours.** Funds settle straight to the landlord's bank account through a Flutterwave subaccount. We never hold a balance.
3. **The ledger is the product.** Every naira is stored as integer kobo. Charges and payments are append-friendly, and nothing is silently overwritten.
4. **Mobile-first, low-bandwidth.** Assume a mid-range Android phone on 3G. Pages stay small and forms stay short.
5. **Ship to pilots weekly.** Each week ends with something a pilot landlord could see, even if you're the one driving it.

---

## Phase 0 — Validation & long-lead setup (now → end of interviews, ~2 weeks)

Some of these approvals take days or weeks, so **start them today**, even before the interviews finish.

| Task | Why now |
| --- | --- |
| Create a **Flutterwave business account** and submit KYC (CAC docs or a starter-business route) | Going live and creating subaccounts needs approval. This can take 1–3 weeks. |
| Create a **Termii account** and register a **sender ID** (e.g. `RentMgr`) | Sender ID approval takes days. Without it, messages to DND numbers fail. |
| Create the **Supabase project** (choose the region closest to Nigeria, e.g. `eu-west`) and the **Vercel project** | Free, instant, and unblocks Week 1. |
| Buy a domain (e.g. `rentmanager.ng` or `.com.ng`) | SMS links look more trustworthy with a short, branded domain. |
| Keep the **manual pilot** running: one Google Sheet plus WhatsApp reminders sent by hand | Real data and real objections to design against. |

**Repo foundation (≈1 evening):**
- [ ] Add Tailwind v4 (`@tailwindcss/vite`) and initialise shadcn/ui
- [ ] Add `react-router`, `@tanstack/react-query`, `@supabase/supabase-js`, `react-hook-form` + `zod`, `date-fns`
- [ ] Add the Supabase CLI, run `supabase init`, and keep migrations in `supabase/migrations/`
- [ ] Set up `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, plus `.env.example`
- [ ] Add `vercel.json` with an SPA rewrite to `/index.html`
- [ ] Add Vitest for unit tests (charge and date maths especially)
- [ ] Replace the Vite template README with a project README

**Done when:** the interview scorecard has 20 entries and the go/no-go decision is written down. If interviews show **caretakers** are the main collectors, or that **monthly savings** matters more than reminders, revise this roadmap before Week 1.

---

## Phase 1 — Foundation (Week 1): auth, schema, properties, units, tenants

**Goal:** a landlord can sign in with their phone and enter their whole portfolio.

### Database (first migration)
- [ ] Create all core tables (see [Schema](#schema-refined)), enums, foreign keys and indexes
- [ ] Turn on **RLS on every table**. Policies chain ownership back to `landlords.id = auth.uid()`
- [ ] Generate TypeScript types with `supabase gen types typescript` and add an npm script for it

### Auth
- [ ] Supabase **phone OTP** login
- [ ] Supabase has no built-in Termii provider, so use the **Send SMS Auth Hook** (an edge function, `auth-sms-hook`) to deliver OTPs through Termii. Use Supabase's test OTP numbers during development.
- [ ] Normalise phone numbers to E.164 (`+234…`). Accept `080…`, `234…` and `+234…` input
- [ ] First login → onboarding: name, then optionally bank details (bank details can be skipped until Week 3)

### Screens
- [ ] App shell: bottom nav (Dashboard · Properties · Tenants · Settings)
- [ ] Properties: list, add, edit
- [ ] Units within a property: label, type (room / flat / shop), rent amount, rent period
- [ ] Tenants: add to a vacant unit (name, phone, start date, period, agreed amount), edit, mark moved out
- [ ] Empty states that guide the next step ("Add your first property")

**Done when:** you can enter a real pilot landlord's portfolio (from the manual-pilot sheet) in under 10 minutes on a phone.

---

## Phase 2 — Charges engine & dashboard (Week 2)

**Goal:** the app knows what each tenant owes and when, and the landlord can see it at a glance.

### Charge generation (the core logic; test it well)
- [ ] A pure TS/SQL function: given `start_date`, `period` and `amount`, return the next period's `period_start`, `period_end` and `due_date`
  - Rent is due on `period_start` (Nigerian norm: rent is paid in advance)
  - Watch month-end edge cases: a tenancy starting Jan 31 should not drift to Feb 28 forever. Anchor to the original start day
- [ ] When a tenant is added, create the **current** charge. Offer "already paid this period?" so existing tenants aren't shown as overdue
- [ ] A **daily `pg_cron` job** that:
  - creates the next charge **45 days before** it's due (so the 30-day reminder has something to point at)
  - moves unpaid charges past `due_date` to `overdue`
- [ ] Unique constraint on `(tenant_id, period_start)` so the job can rerun without creating duplicates
- [ ] Unit tests for yearly, 6-monthly and monthly periods, leap years and month-end starts

### Dashboard
- [ ] Summary cards: collected this month, outstanding, overdue count
- [ ] Lists: **Overdue** → **Due in 30 days** → **Paid recently**, each row showing tenant, unit, amount and days late or left
- [ ] Tap a row → tenant detail with their charges
- [ ] Wrap the queries in a SQL view or RPC (`dashboard_summary`) so the client stays light

**Done when:** the dashboard for a pilot landlord matches their own notebook or sheet.

---

## Phase 3 — Payments (Week 3)

**Goal:** a tenant pays online and the charge flips to paid automatically, with money landing in the landlord's account.

### Landlord payout setup
- [ ] Bank picker from Flutterwave `GET /banks/NG`
- [ ] **Resolve the account name** (`POST /accounts/resolve`) and show it back to the landlord to confirm. This catches typos before money goes astray
- [ ] Edge function `flw-create-subaccount`: creates the subaccount and stores `flw_subaccount_id`. Secret keys live only in edge function secrets, never in the client

### Checkout
- [ ] Create the Flutterwave checkout **on demand** when the tenant taps Pay, rather than pre-generating static links. Amounts change (partial payments, edits), and on-demand checkout always uses the current balance
- [ ] Edge function `flw-checkout`: takes the tenant token and charge ID, then:
  - inserts a `payment_attempts` row with a unique `tx_ref`
  - calls Flutterwave `POST /v3/payments` with the `subaccounts` split, `redirect_url` and customer phone
  - returns the hosted checkout URL

### Webhook (the part that must be bulletproof)
- [ ] Edge function `flw-webhook`:
  1. Check the `verif-hash` header against your secret hash
  2. Store the raw event in `webhook_events` (helps debugging and makes replays safe)
  3. **Re-verify** via `GET /transactions/{id}/verify`. Never trust the webhook body alone
  4. Check status `successful`, the currency `NGN` and the amount against the attempt
  5. Inside a single SQL function (`record_payment`): insert the payment (`reference` is unique, so duplicates are no-ops) and update the charge's `amount_paid_kobo` and `status`
- [ ] The redirect page also calls verify, so the tenant sees a result even if the webhook is slow
- [ ] Test end-to-end in Flutterwave **test mode**, including a duplicate webhook delivery and an underpayment

**Done when:** a test payment flips the charge to paid within seconds, and replaying the webhook changes nothing.

---

## Phase 4 — Reminders & manual payments (Week 4)

**Goal:** tenants get nudged automatically, and cash payments are recorded too.

### Reminders
- [ ] Daily `pg_cron` job → edge function `send-reminders` (run around 9am WAT, never at night)
- [ ] Schedule: **30, 14, 7 and 1 days before** due, then overdue at **+1, +7 and +14 days** (cap it; don't spam)
- [ ] Unique constraint on `reminders (charge_id, kind)` so each reminder sends at most once, even across retries
- [ ] Skip charges that are paid; for partially paid charges, mention the balance
- [ ] Keep SMS short (≤160 characters, one segment): `Hi Tola, your rent of N350,000 for Flat 2 is due 1 Dec. Pay securely: rentmgr.ng/t/x7Kp2 – Mr Adeyemi`
- [ ] Store the Termii message ID and delivery status. Show "reminder sent" on the tenant's row
- [ ] Per-landlord toggle to pause reminders for a tenant (landlords will ask for this)

### Manual payments
- [ ] "Record payment" on a charge: amount, method (cash / transfer), date, optional note or reference
- [ ] Partial amounts allowed; the status updates via the same `record_payment` function as the webhook
- [ ] Void a payment with a reason, keeping the row. Mistakes happen, but the ledger stays auditable

**Done when:** a pilot tenant receives the reminder and the landlord can log a cash payment in three taps.

---

## Phase 5 — Receipts, tenant page, history (Week 5)

**Goal:** tenants get proof of payment, and landlords get a full ledger.

### Tenant page (no login): `/t/:token`
- [ ] `tenants.access_token` is random and unguessable (≥ 22 characters, base62)
- [ ] Data is served through a `SECURITY DEFINER` RPC or edge function that takes the token. **Don't** open RLS to anonymous users
- [ ] Shows the landlord's name, unit, amount due and due date, a **Pay** button and past receipts
- [ ] Trust signals: landlord name, the Flutterwave badge, and "Money goes directly to [landlord's bank name] account ending 1234"
- [ ] Landlord can regenerate the token, which invalidates the old link

### Receipts
- [ ] A sequential receipt number per landlord (e.g. `RM-0001`)
- [ ] Receipt page at `/r/:token`, printable. Show the amount, period covered, method, date and balance remaining
- [ ] Send the receipt link by SMS automatically after every payment (online or manual)

### History
- [ ] Tenant ledger: all charges and payments with a running balance
- [ ] Unit history: all tenants over time
- [ ] CSV export (cheap to build, and landlords and accountants like it)

**Done when:** a tenant can open their link on a cheap phone, pay, and receive a receipt, all without an account.

---

## Phase 6 — Pilot launch & hardening (Week 6)

- [ ] Switch Flutterwave and Termii to **live** keys and do one real ₦100 payment end-to-end
- [ ] Error monitoring (Sentry free tier) on the frontend and edge functions
- [ ] Daily Supabase backups (or a scheduled `pg_dump` while on the free tier)
- [ ] Short privacy notice and terms (NDPA 2023: you're storing tenants' phone numbers)
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
| Older landlords struggle | Yoruba and Pidgin UI (set up `i18n` keys from Week 1 to make this cheap), voice-note help |
| Low SMS open rates | WhatsApp Business API reminders |
| Paperwork pain | Tenancy agreement and quit notice templates (PDF) |
| Ready to charge | Pricing: a platform fee via the Flutterwave split, or a flat monthly subscription |

---

## Schema (refined)

Changes from the plan doc: amounts stored as **kobo**, partial-payment support, tenant access tokens, idempotency tables, and `charge_type` for later bills.

```sql
-- enums
create type rent_period    as enum ('monthly','six_monthly','yearly');
create type charge_status  as enum ('due','partially_paid','paid','overdue','cancelled');
create type payment_method as enum ('link','cash','transfer');

landlords        (id uuid pk = auth.users.id, name, phone unique,
                  bank_code, account_number, account_name,
                  flw_subaccount_id, created_at)

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

payment_attempts (id, charge_id fk, tx_ref unique, amount_kobo,
                  status ('pending','successful','failed'), created_at)

payments         (id, charge_id fk, amount_kobo, method,
                  reference unique, flw_transaction_id,
                  receipt_number, receipt_token unique,
                  recorded_by uuid null, note,
                  voided_at, void_reason, paid_at)

reminders        (id, charge_id fk, kind ('d30','d14','d7','d1','od1','od7','od14'),
                  channel ('sms','whatsapp'), scheduled_for, sent_at,
                  provider_message_id, status,
                  unique (charge_id, kind))

webhook_events   (id, provider, event_id unique, payload jsonb, received_at, processed_at)
```

`landlord_id` lives only on `properties`. RLS on deeper tables joins up the chain. If that gets slow or awkward, denormalise `landlord_id` onto `tenants` and `rent_charges`.

---

## Project structure

```
src/
  app/            routes, layout, providers (QueryClient, auth)
  features/
    auth/         OTP login, onboarding
    properties/   properties + units
    tenants/      tenant CRUD, tenant detail, ledger
    dashboard/
    payments/     record payment, payout setup
    public/       tenant page (/t/:token), receipt (/r/:token)
  components/ui/  shadcn components
  lib/            supabase client, money (kobo ⇄ ₦ formatting), dates, phone
  types/          generated database types
supabase/
  migrations/
  functions/      auth-sms-hook, flw-create-subaccount, flw-checkout,
                  flw-webhook, send-reminders, tenant-portal
```

---

## Decisions to make (ideally from the interviews)

1. **Who pays the Flutterwave fee** (~1.4%, capped)? The tenant (added at checkout) or the landlord (deducted). This affects trust either way, so ask in the interviews.
2. **Partial payments:** this roadmap assumes yes, since paying in instalments is common. Confirm with landlords.
3. **Existing tenants mid-tenancy:** onboarding needs a "last paid up to" date rather than only a start date.
4. **Unit rent changes:** apply to the next tenancy only, or at renewal? This roadmap snapshots rent on the tenant row.
5. **Reminder sender name:** the landlord's name in the message body vs a neutral brand. Tenants may trust their landlord's name more.

## Key risks

| Risk | Mitigation |
| --- | --- |
| Flutterwave KYC / live approval is slow | Start in Phase 0. Have Paystack (which also offers subaccounts) as a fallback |
| SMS blocked by DND or not delivered | Registered sender ID, Termii's DND route, delivery-status tracking |
| Tenants think the payment link is a scam | Landlord warns tenants first, landlord name on the page, branded domain, small first payment |
| Double-counting payments | Unique `reference`, verify before recording, one `record_payment` function for every path |
| Scope creep before the pilot proves value | Anything not in the Must-have table waits for Phase 7 |

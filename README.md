# RentPadi

Rent reminders, payments and records for Nigerian landlords with 4–15 units.
Tenants get reminded by SMS and pay through a link; the money settles straight into the landlord's bank account (Paystack subaccounts); every payment gets a receipt.

- Product plan: [docs/Rent Manager — Landlord Interviews & MVP Plan.md](docs/Rent%20Manager%20—%20Landlord%20Interviews%20&%20MVP%20Plan.md)
- Build roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)
- Brand (logo, colours, icon files): [docs/BRAND.md](docs/BRAND.md)

## Stack

React 19 · TypeScript · Vite · Tailwind v4 · shadcn/ui · React Router · TanStack Query · Supabase (Postgres, phone OTP, edge functions, pg_cron) · Paystack · Termii · Vercel

## Getting started (demo mode)

Demo mode uses a **free hosted Supabase project** and **Paystack test keys**. No Docker, no SMS provider, and no real money.

1. `npm install`
2. Create a free project at [supabase.com](https://supabase.com) (pick a region close to Nigeria, e.g. *West EU (London)*).
3. **Apply the migrations.** Either:
   - **CLI:** run `npx supabase login`, then `npx supabase link --project-ref <your-project-ref>`, then `npx supabase db push`. The project ref is the `xxxx` in `https://xxxx.supabase.co`. These commands don't need Docker.
   - **Dashboard:** paste each file from `supabase/migrations/` into the **SQL Editor**, oldest first, and run it.
4. **Route login codes to the database instead of SMS:**
   Dashboard → **Authentication → Auth Hooks** → add a **Send SMS** hook → type **Postgres** → schema `public`, function `dev_send_sms_hook`.
5. **Turn on phone login:** Dashboard → **Authentication → Sign In / Providers → Phone** → enable it.
   With the Send SMS hook on, you don't need an SMS provider. If the form still asks for provider credentials, enter placeholder values. They're never used while the hook is on.
6. `cp .env.example .env.local` and paste in the **Project URL** and **anon key** (Dashboard → Project Settings → API).
7. `npm run dev` → http://localhost:5173
8. Sign in with any Nigerian number. To get the code, open Dashboard → **Table Editor → `dev_sms_outbox`**.

> Optional: under the Phone provider you can also add **test phone numbers** with fixed codes (e.g. `2348000000001` → `123456`) so you don't have to look up codes.

> `dev_sms_outbox` and its hook are **demo only**. Real codes can go out on **WhatsApp** (see [docs/WHATSAPP_SETUP.md](docs/WHATSAPP_SETUP.md), step 11) and/or by **SMS** once Termii has approved your sender ID:
>
> 1. Dashboard → Authentication → Hooks → **Send SMS** → switch the type to **HTTPS**, URL `https://<project-ref>.supabase.co/functions/v1/sms-hook`, and generate a secret.
> 2. `npx supabase secrets set TERMII_API_KEY=… TERMII_SENDER_ID=RentPadi TERMII_BASE_URL=<your Termii base URL> SEND_SMS_HOOK_SECRET='v1,whsec_…'`
> 3. Sign in with your own number and check the SMS arrives. If it fails, the function logs show Termii's reason (never the code).

## Online payments (Paystack test mode)

Each landlord gets a Paystack **subaccount** with a 0% split to RentPadi, so rent settles straight into their bank. Checkouts set `bearer: "subaccount"`: Paystack's fee comes out of the landlord's share and tenants pay exactly the rent.

1. In the Paystack dashboard, turn on **Test mode**. Under **Settings → API Keys & Webhooks**, copy the **test secret key** (`sk_test_…`) and **test public key** (`pk_test_…`).
2. On the same page, set the **Test Webhook URL** to `https://<project-ref>.supabase.co/functions/v1/pay-webhook`. Paystack signs each call with your secret key, so there's no separate webhook secret.
3. Give the edge functions their secrets. They live in Supabase, never in `.env.local`:
   ```sh
   npx supabase secrets set PAYSTACK_SECRET_KEY=sk_test_... APP_URL=http://localhost:5173
   ```
   `APP_URL` is where Paystack sends tenants back after paying. Change it to the Vercel URL when you deploy.
4. Put the public key in `.env.local` as `VITE_PAYSTACK_PUBLIC_KEY=pk_test_...`. The app only uses it to show test-mode hints.
5. In the app: go to **Settings → Payout account**, choose a bank and enter an account number. Paystack looks up the account name; test mode allows only **3 lookups a day**.
   Changing an account that's already saved needs a 6-digit code sent to the landlord's WhatsApp (the `login_code` template; demo mode puts it in `dev_sms_outbox`). It expires after 10 minutes and allows 5 tries; one code a minute, 5 a day.
   > Ran out? `npx supabase secrets set PAYSTACK_TEST_SKIP_LOOKUP=true` skips the lookup and saves the account as **"TEST MODE: NAME NOT CHECKED"**. It only works with a test key (`sk_test_…`); with a live key the account is always looked up. Paystack may still check the account when it creates the subaccount. Turn it off with `npx supabase secrets unset PAYSTACK_TEST_SKIP_LOOKUP`.
6. Open a tenant, copy their payment link, open it, and tap **Pay**. Use one of Paystack's [test cards](https://paystack.com/docs/payments/test-payments/).
7. Back in the app, the tenant's charge shows **Paid**.

The functions: `payout` (banks, account lookup, subaccount), `pay-checkout` (starts a checkout), `pay-verify` (the page tenants return to) and `pay-webhook` (Paystack's `charge.success`). Both `pay-verify` and `pay-webhook` re-check every payment with Paystack before recording it.

Each online payment records Paystack's fee (`gateway_fee_kobo`, from Paystack's verify response) and RentPadi's (`platform_fee_kobo`, fixed at checkout; ₦0 in the pilot). Landlords see the breakdown on the tenant's **Payments** card and in **Settings → Export**; tenants never see fees. When deploying a database change that the functions depend on, run `npm run db:push` **before** `npm run functions:deploy`.

### Switching an existing project from Flutterwave

1. `npm run db:push`: applies `20261127090000_paystack.sql`. It drops the Flutterwave subaccount columns, keeps every landlord's bank details, and marks past online payments as `gateway = 'flutterwave'`.
2. Set `PAYSTACK_SECRET_KEY` (above), then `npm run functions:deploy`.
3. Delete the old functions and secrets:
   ```sh
   npx supabase functions delete flw-checkout
   npx supabase functions delete flw-verify
   npx supabase functions delete flw-webhook
   npx supabase functions delete flw-payout
   npx supabase secrets unset FLW_SECRET_KEY FLW_WEBHOOK_HASH
   ```
4. In `.env.local` and on Vercel, replace `VITE_FLW_PUBLIC_KEY` with `VITE_PAYSTACK_PUBLIC_KEY`.
5. Each landlord confirms their payout account once (the dashboard and Settings ask them to). That creates their Paystack subaccount. Until then their tenants see "not set up for online payment yet".
6. `npm run db:types` to regenerate `src/types/database.ts` from the database.

The Terms and Privacy notice now name Paystack, so landlords are asked to accept them again on their next visit.

Edge functions are in `supabase/functions/`. Deploy them with `npm run functions:deploy` (no Docker needed). Test them with `npm run test:functions` (uses `npx deno`).

## WhatsApp (Meta Cloud API)

Tenants message RentPadi's WhatsApp number to check what they owe, pay (Paystack link), and get receipt PDFs. Landlords who switch on **Settings → WhatsApp** also send reminders and receipts on WhatsApp, alongside SMS.

- `wa-webhook`: the tenant chat. Tenants are recognised by the number they message from: their WhatsApp number, or their phone number.
- `send-reminders`: runs every 5 minutes (pg_cron). It delivers queued WhatsApp messages once WhatsApp is set up, and queued SMS once Termii is set up.

**Setup:** follow [docs/WHATSAPP_SETUP.md](docs/WHATSAPP_SETUP.md), a step-by-step guide using Meta's free test number. It covers the Meta app, a permanent token, secrets, the webhook, the three message templates, the scheduled sender, end-to-end testing, troubleshooting, and going live.

## Error monitoring (Sentry)

Optional, and off until a DSN is set. Errors from the app and the edge functions go to Sentry, so a broken payment, reminder or login code shows up as an alert instead of failing silently.

Sentry organization **rent-padi** (EU data region) has two projects: **rent-padi-frontend** (React app) and **rent-padi-functions** (Deno edge functions). Both have **Prevent Storing of IP Addresses** and the **Data Scrubber** on (Settings → Security & Privacy); keep them on.

1. **App:** in Vercel, set `VITE_SENTRY_DSN` to rent-padi-frontend's DSN (Settings → Client Keys) and `VITE_SENTRY_ENVIRONMENT=production`, then redeploy. For local development, put the same DSN in `.env.local` with `VITE_SENTRY_ENVIRONMENT=development`.
2. **Functions:** `npx supabase secrets set SENTRY_DSN=<rent-padi-functions' DSN> SENTRY_ENVIRONMENT=production`, then `npm run functions:deploy`.
3. **Readable production stack traces (source maps):** create an **organization auth token** in Sentry (Settings → Auth Tokens) and add it to Vercel as `SENTRY_AUTH_TOKEN`, **Production** environment only. Production builds then make source maps, upload them to Sentry under the release `VERCEL_GIT_COMMIT_SHA`, and delete them, so they're never deployed. Builds without the token make no source maps. Never commit the token.
4. **Check it:** open the app, wait a few seconds, and in the browser console run `setTimeout(() => { throw new Error('Sentry test') })`. The error appears under **Issues** in rent-padi-frontend, with readable file names and lines once source maps are uploaded.

**What's sent, and what isn't:**

- Pages that crash, and unexpected failures in edge functions: payments (`pay-*`, `payout`), reminders, login codes and the WhatsApp chat. Expected answers ("account not found", a form error, a dropped connection) are not reported.
- Collection is minimal (`MINIMAL_DATA_COLLECTION` in `supabase/functions/_shared/scrub.ts`): no user info, cookies, headers, bodies, query strings or local variables. Every event is then scrubbed (`scrubDeep`): tenant and receipt link tokens, phone numbers, emails, account numbers, keys and JWTs are replaced before it leaves.
- In the browser, Sentry (about 31 kB) loads only when the page is idle, and not at all with Data Saver on or on 2G.

## Database backups

A GitHub Actions job (`.github/workflows/backup.yml`) dumps the database every night with a read-only login, encrypts it with an age public key, uploads it to a private Cloudflare R2 bucket (35 days of dailies, 13 months of monthlies) and proves the dump restores into an empty Supabase. Setup (secrets, bucket, key) and how to restore: [docs/BACKUPS.md](docs/BACKUPS.md).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app with hot reload |
| `npm run build` | Typecheck and build for production |
| `npm run lint` | Lint with oxlint |
| `npm test` | Run unit tests (Vitest) |
| `npm run db:push` | Apply new migrations to the linked Supabase project |
| `npm run db:types` | Regenerate `src/types/database.ts` from the linked project |

## Project layout

```
src/
  app/          router, layout
  features/     auth, dashboard, properties, tenants, settings, public (tenant page, receipts)
  components/   shared components; ui/ = shadcn
  lib/          supabase client, money (kobo), phone (NG numbers), utils
  types/        generated database types
supabase/
  config.toml   local Supabase config (phone auth + demo numbers)
  migrations/   SQL migrations
  functions/    edge functions (Paystack payments, reminders, WhatsApp, …)
```

## Conventions

- **Money is integer kobo** everywhere (`350000 naira = 35_000_000`). Use `formatKobo` / `parseNairaToKobo` from `src/lib/money.ts`.
- **Phone numbers are E.164** (`+2348031234567`). Normalise input with `normalizeNgPhone`.
- **Secrets never go in `VITE_*` vars.** The Paystack secret key and Termii keys live in Supabase edge function secrets.

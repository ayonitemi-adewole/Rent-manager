# RentPadi

Rent reminders, payments and records for Nigerian landlords with 4–15 units.
Tenants get reminded by SMS and pay through a link; the money settles straight into the landlord's bank account (Flutterwave subaccounts); every payment gets a receipt.

- Product plan: [docs/Rent Manager — Landlord Interviews & MVP Plan.md](docs/Rent%20Manager%20—%20Landlord%20Interviews%20&%20MVP%20Plan.md)
- Build roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)

## Stack

React 19 · TypeScript · Vite · Tailwind v4 · shadcn/ui · React Router · TanStack Query · Supabase (Postgres, phone OTP, edge functions, pg_cron) · Flutterwave · Termii · Vercel

## Getting started (demo mode)

Demo mode uses a **free hosted Supabase project** and **Flutterwave test keys**. No Docker, no SMS provider, and no real money.

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

> `dev_sms_outbox` and its hook are **demo only**. Before the pilot, switch the Send SMS hook to the Termii edge function (Roadmap, Phase 1).

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
  functions/    edge functions (Flutterwave, reminders, …)
```

## Conventions

- **Money is integer kobo** everywhere (`350000 naira = 35_000_000`). Use `formatKobo` / `parseNairaToKobo` from `src/lib/money.ts`.
- **Phone numbers are E.164** (`+2348031234567`). Normalise input with `normalizeNgPhone`.
- **Secrets never go in `VITE_*` vars.** Flutterwave secret keys and Termii keys live in Supabase edge function secrets.

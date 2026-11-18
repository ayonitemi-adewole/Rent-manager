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

> `dev_sms_outbox` and its hook are **demo only**. To send real codes once Termii has approved your sender ID:
>
> 1. Dashboard → Authentication → Hooks → **Send SMS** → switch the type to **HTTPS**, URL `https://<project-ref>.supabase.co/functions/v1/sms-hook`, and generate a secret.
> 2. `npx supabase secrets set TERMII_API_KEY=… TERMII_SENDER_ID=RentPadi TERMII_BASE_URL=<your Termii base URL> SEND_SMS_HOOK_SECRET='v1,whsec_…'`
> 3. Sign in with your own number and check the SMS arrives. If it fails, the function logs show Termii's reason (never the code).

## Online payments (Flutterwave test mode)

1. In the Flutterwave dashboard, switch to **Test mode**. Copy your **secret key** from Settings → API keys.
2. Under Settings → Webhooks:
   - **URL:** `https://<project-ref>.supabase.co/functions/v1/flw-webhook`
   - **Secret hash:** any long random string you make up.
3. Give the edge functions their secrets. They live in Supabase, never in `.env.local`:
   ```sh
   npx supabase secrets set FLW_SECRET_KEY=FLWSECK_TEST-... FLW_WEBHOOK_HASH=<your-secret-hash> APP_URL=http://localhost:5173
   ```
   `APP_URL` is where Flutterwave sends tenants back after paying. Change it to the Vercel URL when you deploy.
4. In the app: go to **Settings → Payout account**, choose a bank and enter an account number.
   > In test mode, Flutterwave's account lookup may only work for its test accounts, e.g. Access Bank (044) `0690000031`.
5. Open a tenant, copy their payment link, open it, and tap **Pay**. Use a Flutterwave [test card](https://developer.flutterwave.com/docs/test-cards).
6. Back in the app, the tenant's charge shows **Paid**.

Edge functions are in `supabase/functions/`. Deploy them with `npm run functions:deploy` (no Docker needed). Test them with `npm run test:functions` (uses `npx deno`).

## WhatsApp (Meta Cloud API)

Tenants message RentPadi's WhatsApp number to check what they owe, pay (Flutterwave link), and get receipt PDFs. Landlords who switch on **Settings → WhatsApp** also send reminders and receipts on WhatsApp, alongside SMS.

- `wa-webhook`: the tenant chat. Tenants are recognised by the number they message from: their WhatsApp number, or their phone number.
- `send-reminders`: runs every 5 minutes (pg_cron). It delivers queued WhatsApp messages once WhatsApp is set up, and queued SMS once Termii is set up.

Setup with Meta's free test number (about 20 minutes, no business verification needed):

1. **Create the app.** At [developers.facebook.com](https://developers.facebook.com/apps), go to **Create app → Business**, then add the **WhatsApp** product.
2. **Test number.** Under **WhatsApp → API Setup**:
   - Note the test number and its **Phone number ID**.
   - Add up to 5 **recipient numbers** (your own phones). The test number can only message these.
3. **Permanent token.** In Business settings, go to **Users → System users**.
   - Add an admin system user and assign the app.
   - Generate a token with `whatsapp_business_messaging` and `whatsapp_business_management`. The token on the API Setup page expires in 24 hours.
4. **App secret.** Under **App settings → Basic**, copy the **App secret**.
5. **Set the function secrets.** Make up two long random strings for the last two values:

   ```sh
   npx supabase secrets set WHATSAPP_TOKEN=… WHATSAPP_PHONE_NUMBER_ID=… WHATSAPP_APP_SECRET=…      WHATSAPP_VERIFY_TOKEN=<random string> MESSAGE_SENDER_SECRET=<another random string>
   ```
6. **Webhook.** Under **WhatsApp → Configuration**:
   - Callback URL: `https://<project-ref>.supabase.co/functions/v1/wa-webhook`
   - Verify token: your `WHATSAPP_VERIFY_TOKEN`
   - Click **Verify and save**, then subscribe to the **messages** field.
7. **Templates.** In **WhatsApp Manager → Message templates**, create these three. Use category **Utility**, language **English**, and add one **Quick reply** button each. Meta asks for sample values; any realistic ones work.

   | Name | Header | Body | Quick reply |
   | --- | --- | --- | --- |
   | `rent_due_reminder` | none | Hi {{1}}, your rent of {{2}} for {{3}} is due on {{4}}. Pay securely here: {{5}}<br><br>Sent for {{6}} by RentPadi. Tap below to check your rent or get receipts. | Check my rent |
   | `rent_overdue_reminder` | none | Hi {{1}}, your rent of {{2}} for {{3}} was due on {{4}} and has not been paid yet. Please pay here: {{5}}<br><br>Sent for {{6}} by RentPadi. Already paid? Tap below to check. | Check my rent |
   | `rent_receipt` | Document | Hi {{1}}, your payment of {{2}} for {{3}} has been received. Receipt {{4}} is attached.<br><br>Sent for {{5}} by RentPadi. | My receipts |

   The wording must match `supabase/functions/_shared/wa-templates.ts`. Approval usually takes minutes to hours.
8. **Switch on the sender.** In the Supabase SQL editor, run this once:

   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<your MESSAGE_SENDER_SECRET>', 'message_sender_secret');
   ```
9. **Show the chat button.** Add `VITE_WHATSAPP_NUMBER=+1555…` (the test number) to `.env.local` and restart the dev server.

To try it, give a tenant one of your recipient numbers as their WhatsApp number, then send "Hi" to the test number from that phone.

Notes:
- Links in WhatsApp messages use `APP_URL`, so they only open on a phone once the app is deployed somewhere public.
- Reminders go out between 8am and 8pm Lagos time; receipts go any time. Anything queued more than 2 days ago is skipped, not sent late.
- Meta charges per template message (reminders, receipts), at low rates in Nigeria. Replies within 24 hours of a tenant's message are free. Check Meta's current pricing before launch.

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

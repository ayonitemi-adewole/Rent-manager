# Setting up WhatsApp (Meta Cloud API)

This guide connects RentPadi to WhatsApp, step by step. Once it's done:

- **Tenants** can message RentPadi's WhatsApp number to see what they owe, get a Paystack payment link, and receive their receipts as PDFs.
- **Landlords** who switch on **Settings → WhatsApp** send their rent reminders and receipts on WhatsApp as well as by SMS.
- **Landlords' login codes** can arrive on WhatsApp, so sign-in works before Termii SMS is ready (step 11).

You'll use **Meta's free test number**. You don't need business verification, a new SIM, or a payment method yet. Plan for **30–45 minutes**, plus however long Meta takes to approve the three message templates (usually minutes, sometimes a few hours).

> Meta renames its menus often. If a button in this guide has a slightly different name on your screen, look for the closest match. The flow stays the same.

---

## Contents

1. [Before you start](#1-before-you-start)
2. [Create a Meta developer app](#2-create-a-meta-developer-app)
3. [Get the test number and add your phones](#3-get-the-test-number-and-add-your-phones)
4. [Create a permanent access token](#4-create-a-permanent-access-token)
5. [Copy the app secret](#5-copy-the-app-secret)
6. [Give the edge functions their secrets](#6-give-the-edge-functions-their-secrets)
7. [Connect the webhook](#7-connect-the-webhook)
8. [Create the three message templates](#8-create-the-three-message-templates)
9. [Switch on the scheduled sender](#9-switch-on-the-scheduled-sender)
10. [Show the WhatsApp button to tenants](#10-show-the-whatsapp-button-to-tenants)
11. [Send landlord login codes on WhatsApp](#11-send-landlord-login-codes-on-whatsapp)
12. [Test everything end to end](#12-test-everything-end-to-end)
13. [Troubleshooting](#13-troubleshooting)
14. [Going live with a real number](#14-going-live-with-a-real-number)
15. [Reference: every value and where it goes](#15-reference-every-value-and-where-it-goes)

---

## 1. Before you start

You need:

- A **Facebook account**. Meta's developer tools sign in with it. A personal account is fine.
- **One or two phones with WhatsApp** to test with (yours, a family member's). The test number can only message numbers you add to an allow-list, and you can add at most 5.
- The **Supabase CLI logged in and linked** to the project (`npx supabase login`, then `npx supabase link --project-ref <ref>`). See [Getting started](../README.md#getting-started-demo-mode).
- Your **project ref**: the `xxxx` in `https://xxxx.supabase.co`. This guide writes it as `<project-ref>`.
- The **latest migrations applied** (`npm run db:push`) and **functions deployed** (`npm run functions:deploy`). The WhatsApp ones are `wa-webhook` and `send-reminders`.

Keep a notepad open (not a file in this repo). You'll collect five values along the way:

| Value | Looks like | Step |
| --- | --- | --- |
| Phone number ID | `123456789012345` (15–16 digits) | 3 |
| Test phone number | `+1 555 123 4567` | 3 |
| Access token | `EAAG…` (very long) | 4 |
| App secret | 32 hex characters | 5 |
| Verify token | a random string you make up | 6 |
| Sender secret | another random string you make up | 6 |

> **Never paste these into chat, a commit, or `.env.local`.** The only one that goes in the frontend is the test *phone number*, which is public anyway.

---

## 2. Create a Meta developer app

1. Go to [developers.facebook.com](https://developers.facebook.com) and sign in with Facebook.
   - First time? Click **Get started** and register as a developer. Meta asks you to verify your phone or email and accept the developer terms.
2. Open **My Apps** → **Create app**.
3. **App name:** `RentPadi` (or `RentPadi Dev`). **App contact email:** yours.
4. **Use case:** choose **Connect with customers through WhatsApp**. On older screens, choose app type **Business** instead.
5. **Business portfolio:** if Meta asks, pick an existing one or let it create one. The name doesn't matter for testing.
6. Click **Create app**, then re-enter your Facebook password if asked.
7. In the app dashboard, find **WhatsApp** and click **Set up** (or **Customize use case → WhatsApp**).

You now have a **WhatsApp** section in the left sidebar, with **API Setup** (also called **Quickstart**) and **Configuration** pages.

---

## 3. Get the test number and add your phones

1. In the sidebar, open **WhatsApp → API Setup**.
2. Under **Send and receive messages**, the **From** dropdown already shows a **test number** (a US `+1 555…` number). Next to it:
   - Copy the **Phone number ID** → notepad.
     ⚠️ This is **not** the phone number itself, and **not** the *WhatsApp Business Account ID* shown nearby. It's the field labelled **Phone number ID**.
   - Copy the **test phone number** itself → notepad, in the form `+15551234567` (no spaces).
3. Under **To**, click **Manage phone number list** → **Add phone number**.
   - Enter your own WhatsApp number (`+234…`).
   - WhatsApp sends a code to that phone. Enter it to confirm.
   - Repeat for up to 5 numbers in total.
4. Optional sanity check: click **Send message**. You should get Meta's `hello_world` message on your phone within seconds. If it doesn't arrive, double-check the number you added.

---

## 4. Create a permanent access token

The token on the API Setup page **expires after 24 hours**. RentPadi needs one that doesn't expire, which comes from a *system user*.

1. Go to [business.facebook.com/settings](https://business.facebook.com/settings) and pick the business portfolio your app belongs to.
2. **Users → System users → Add**.
   - Name: `rentpadi-server`
   - Role: **Admin**
   - Click **Create system user**.
3. With the new system user selected, click **Assign assets** (or **Add assets**):
   - **Apps** → tick your RentPadi app → turn on **Full control** (Manage app) → **Save changes**.
   - **WhatsApp accounts** → tick the test WhatsApp account (often named *Test WhatsApp Business Account*) → **Full control** → **Save changes**.
4. Still on the system user, click **Generate new token**:
   - **App:** your RentPadi app.
   - **Token expiration:** **Never**.
   - **Permissions:** tick **`whatsapp_business_messaging`** and **`whatsapp_business_management`**. You don't need any others.
   - Click **Generate token**.
5. Copy the token → notepad. **Meta shows it only once.** If you lose it, generate a new one; the old one keeps working until you revoke it.

> If the token works for a few minutes and then fails with *"Object … does not exist, cannot be loaded due to missing permissions"*, the WhatsApp account wasn't assigned in step 3. Assign it and generate a fresh token.

---

## 5. Copy the app secret

Meta signs every webhook it sends with this secret. RentPadi refuses any request without a valid signature, so nobody else can pretend to be a tenant messaging you.

1. Back at [developers.facebook.com](https://developers.facebook.com/apps), open your app.
2. Go to **App settings → Basic**.
3. Next to **App secret**, click **Show**, re-enter your password, and copy it → notepad.

---

## 6. Give the edge functions their secrets

1. Make up two long random strings: the **verify token** and the **sender secret**. In Git Bash:

   ```sh
   openssl rand -hex 24   # verify token
   openssl rand -hex 24   # sender secret
   ```

   Or in PowerShell:

   ```powershell
   -join ((48..57) + (97..122) | Get-Random -Count 40 | ForEach-Object { [char]$_ })
   ```

   Run it twice and copy both into your notepad.

2. Set all five secrets in one command, from the repo folder. Replace every `…` with the value from your notepad, and keep the quotes:

   ```sh
   npx supabase secrets set \
     WHATSAPP_TOKEN='…' \
     WHATSAPP_PHONE_NUMBER_ID='…' \
     WHATSAPP_APP_SECRET='…' \
     WHATSAPP_VERIFY_TOKEN='…' \
     MESSAGE_SENDER_SECRET='…'
   ```

   In PowerShell, put it on one line, or replace each trailing `\` with a backtick `` ` ``.

3. Check they're there. The command lists names and hashes, never the values:

   ```sh
   npx supabase secrets list
   ```

   You should see the five names above, plus `APP_URL` from the Paystack setup. If `APP_URL` is missing, set it now (`npx supabase secrets set APP_URL=http://localhost:5173`). The bot uses it to build payment and receipt links.

4. Secrets take effect on the next request, so you don't need to redeploy. If you deployed the functions *before* this branch, deploy once now:

   ```sh
   npm run functions:deploy
   ```

5. Quick check that the webhook is reachable and knows your verify token. Replace both placeholders:

   ```sh
   curl "https://<project-ref>.supabase.co/functions/v1/wa-webhook?hub.mode=subscribe&hub.verify_token=<your verify token>&hub.challenge=hello"
   ```

   It should print `hello`. If it prints `Forbidden`, the verify token doesn't match what you set.

---

## 7. Connect the webhook

This tells Meta where to deliver tenants' messages.

1. In your app, open **WhatsApp → Configuration**.
2. Under **Webhook**, click **Edit**:
   - **Callback URL:** `https://<project-ref>.supabase.co/functions/v1/wa-webhook`
   - **Verify token:** the same verify token you set as `WHATSAPP_VERIFY_TOKEN`.
   - Click **Verify and save**. Meta calls the URL right away, so the check from step 6.5 must already pass.
3. Under **Webhook fields**, click **Manage**. Find **`messages`** and click **Subscribe**. Nothing else is needed.
   - `messages` covers both tenants' messages *and* delivery statuses. RentPadi uses the statuses to mark a reminder **failed** when, for example, the number isn't on WhatsApp.
4. **Subscribe your app to the WhatsApp account.** Meta doesn't always do this for you. Without it, the dashboard's **Test** button still works, but real messages from phones never reach RentPadi.
   1. In **WhatsApp → API Setup**, copy the **WhatsApp Business Account ID** (not the Phone number ID) and the temporary **Access token**.
   2. Check what's subscribed now (PowerShell):
      ```powershell
      curl.exe -s "https://graph.facebook.com/v23.0/<WABA_ID>/subscribed_apps" -H "Authorization: Bearer <token>"
      ```
      If the list is empty, or only shows *WA DevX Webhook Events 1P App* (that's Meta's own app for the Test button), your app isn't subscribed.
   3. Subscribe it:
      ```powershell
      curl.exe -s -X POST "https://graph.facebook.com/v23.0/<WABA_ID>/subscribed_apps" -H "Authorization: Bearer <token>"
      ```
      It should print `{"success":true}`.
5. Test it: from one of your allow-listed phones, send `Hi` to the test number. You should get the reply *"Hello! This WhatsApp number isn't linked to a rent account on RentPadi…"*. That's correct for now: no tenant has your number yet. You'll link one in step 12.

> No reply at all? See [Troubleshooting](#13-troubleshooting). Meta's app dashboard also has a **Test** button next to the `messages` field, which sends a sample event.

---

## 8. Create the three message templates

WhatsApp only lets a business *start* a conversation with a pre-approved **template**. RentPadi uses three: two for reminders and one for receipts. (Replies to a tenant who messaged you in the last 24 hours don't need templates. That's how the chat menu works.)

The **name, language, and wording must match exactly** what's in [`supabase/functions/_shared/wa-templates.ts`](../supabase/functions/_shared/wa-templates.ts). Otherwise Meta rejects the messages at send time.

### Where to create them

[business.facebook.com/wa/manage/message-templates](https://business.facebook.com/wa/manage/message-templates). Or, in your app, **WhatsApp → API Setup → Step 2: Create a message template**. Make sure the WhatsApp account selected at the top is the **test account** from step 3.

### Settings that apply to all three

| Setting | Choose |
| --- | --- |
| Category | **Utility** (not Marketing: it's cheaper and isn't blocked by spam filters) |
| Type | **Custom** / **Default** |
| Language | **English**, exactly. ⚠️ **Not** *English (US)* or *English (UK)*. RentPadi sends language code `en`. |
| Variable type (if asked) | **Number** (`{{1}}`, `{{2}}`, …), not *Name* |

### Template 1: `rent_in_due_reminder`

- **Name:** `rent_in_due_reminder`
- **Header:** none
- **Body:** paste exactly, including the blank line:

  ```
  Hi {{1}}, your rent of {{2}} for {{3}} is due on {{4}}. Pay securely here: {{5}}

  Sent for {{6}} by RentPadi. Tap below to check your rent or get receipts.
  ```

- **Footer:** none
- **Buttons:** **Add button → Quick reply** (sometimes listed as **Custom**). Button text: `Check my rent`
- **Sample values** (Meta requires them for review):

  | Variable | Sample |
  | --- | --- |
  | `{{1}}` | `Chidi` |
  | `{{2}}` | `₦350,000` |
  | `{{3}}` | `Flat 2` |
  | `{{4}}` | `17 Dec 2026` |
  | `{{5}}` | `https://rentpadi.app/t/abc123` |
  | `{{6}}` | `Adewole Properties` |

### Template 2: `rent_overdue_reminder`

- **Name:** `rent_overdue_reminder`
- **Header:** none
- **Body:**

  ```
  Hi {{1}}, your rent of {{2}} for {{3}} was due on {{4}} and has not been paid yet. Please pay here: {{5}}

  Sent for {{6}} by RentPadi. Already paid? Tap below to check.
  ```

- **Buttons:** Quick reply, `Check my rent`
- **Samples:** same as template 1, with a past date for `{{4}}` (e.g. `1 Nov 2026`).

### Template 3: `rent_receipt`

- **Name:** `rent_receipt`
- **Header:** **Media → Document**. Meta asks for a sample PDF: download any receipt from the app (open a payment → **Download PDF**) and upload it.
- **Body:**

  ```
  Hi {{1}}, your payment of {{2}} for {{3}} has been received. Receipt {{4}} is attached.

  Sent for {{5}} by RentPadi.
  ```

- **Buttons:** Quick reply, `My receipts`
- **Samples:**

  | Variable | Sample |
  | --- | --- |
  | `{{1}}` | `Chidi` |
  | `{{2}}` | `₦350,000` |
  | `{{3}}` | `Flat 2` |
  | `{{4}}` | `RP-0007` |
  | `{{5}}` | `Adewole Properties` |

### Submit and wait

Click **Submit** on each. Status goes **In review → Active**, usually within minutes and occasionally up to 24 hours. Meta emails you if one is rejected; the reason is shown on the template. Common fixes:

- *"Variables can't be at the start or end"* or *"too many variables for the length"*: check that you pasted the full body text, including the second paragraph.
- *Wrong category*: Meta sometimes re-files Utility templates as Marketing. Appeal, or keep the wording strictly transactional (it already is).

> If you ever change a template's wording, change it in `wa-templates.ts` too, and keep the same number of `{{n}}` variables. The test `template parameter counts match the definitions` (`npm run test:functions`) catches a mismatch in the code.

---

## 9. Switch on the scheduled sender

A pg_cron job (`send-messages`) runs every 5 minutes and calls the `send-reminders` function. To call it, the job needs the project URL and the sender secret, which it reads from **Supabase Vault**. Until both exist, it quietly does nothing.

1. Supabase dashboard → **SQL Editor** → **New query**.
2. Paste the following. Replace both placeholders: the second value must be **identical** to the `MESSAGE_SENDER_SECRET` from step 6. Then click **Run**:

   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<your MESSAGE_SENDER_SECRET>', 'message_sender_secret');
   ```

   Run it **once**. A second run fails with a duplicate-name error. To change a value later:

   ```sql
   select vault.update_secret(
     (select id from vault.secrets where name = 'message_sender_secret'),
     '<new value>'
   );
   ```

3. Check the job is calling the function. Run the sender once by hand:

   ```sql
   select public.run_message_sender();
   ```

   Then, after a few seconds:

   ```sql
   select status_code, content, created
   from net._http_response
   order by created desc
   limit 3;
   ```

   - `200` with `{"sent":0,"failed":0}` (or higher numbers): everything is connected.
   - `401 Unauthorized`: the Vault secret doesn't match `MESSAGE_SENDER_SECRET` exactly. Watch for spaces or quotes.
   - `404`: the `project_url` is wrong, or `send-reminders` isn't deployed.

4. From now on the job runs on its own. Its history is at Dashboard → **Integrations → Cron → `send-messages`**, or:

   ```sql
   select status, return_message, start_time
   from cron.job_run_details
   where jobid = (select jobid from cron.job where jobname = 'send-messages')
   order by start_time desc
   limit 5;
   ```

---

## 10. Show the WhatsApp button to tenants

The tenant payment page (`/t/…`) can show a **"Check rent and receipts on WhatsApp"** button.

1. In `.env.local`, add the test number from step 3 (E.164, no spaces):

   ```
   VITE_WHATSAPP_NUMBER=+15551234567
   ```

2. Restart `npm run dev`. Vite only reads env files at startup.
3. When you deploy (e.g. Vercel), add the same variable in the host's environment settings and redeploy.

---

## 11. Send landlord login codes on WhatsApp

Landlords sign in with a 6-digit code. Supabase creates the code and hands it to the `sms-hook` function, which delivers it:

- **on WhatsApp first**, as the `login_code` template, once WhatsApp is set up (steps 2–7);
- **by SMS through Termii** if WhatsApp refuses the message, or if WhatsApp isn't set up. This only works once Termii is set up.

You can do this step before Termii is ready. While you're on the test number, though, only your allow-listed phones (step 3) can receive codes, so only those numbers can sign in.

The same `login_code` template carries the code a landlord must enter to **set up or change their payout account** (the `payout` function, `send_code`). That code goes on WhatsApp only, never SMS. Until WhatsApp is set up it goes to `dev_sms_outbox`, like demo login codes.

### a. Create the `login_code` template

Meta writes the wording for login-code templates itself; you only choose the options.

1. In **WhatsApp Manager → Message templates → Create template**, choose category **Authentication**.
2. **Name:** `login_code`. **Language:** **English** (plain English, not US or UK, as in step 8).
3. **Code delivery:** **Copy code**. The landlord taps the button, then pastes the code into RentPadi.
4. **Content:** tick **Add security recommendation** ("For your security, do not share this code."). Also tick **Add expiry time** and set it to **10 minutes**, unless you've changed the OTP expiry in Supabase (**Authentication → Sign In / Providers → Phone**).
5. **Button text:** leave Meta's default **Copy code**.
6. **Submit.** Authentication templates are usually approved within minutes.

The landlord sees something like: *"**482913** is your verification code. For your security, do not share this code. This code expires in 10 minutes."* with a **Copy code** button.

### b. Point Supabase's Send SMS hook at the function

Right now, login codes go to the demo table `dev_sms_outbox`. To send them for real:

1. Supabase dashboard → **Authentication → Auth Hooks** → the **Send SMS** hook → **Edit**.
2. Change the type from **Postgres** to **HTTPS**.
3. **URL:** `https://<project-ref>.supabase.co/functions/v1/sms-hook`
4. Click **Generate secret**. Copy it (it looks like `v1,whsec_…`) and keep the dialog open.
5. In a terminal, set it as a function secret. Keep the quotes, because of the comma:

   ```sh
   npx supabase secrets set SEND_SMS_HOOK_SECRET='v1,whsec_…'
   ```

6. Back in the dashboard, click **Save** / **Update hook**.
7. Make sure `sms-hook` is deployed: `npm run functions:deploy`.

### c. Try it

1. Sign out of RentPadi, and sign in with one of your allow-listed numbers.
2. WhatsApp shows the code from the RentPadi test number within a few seconds. Tap **Copy code**, go back to RentPadi and paste it. It signs you in as soon as it has 6 digits.
3. If nothing arrives, check **Edge Functions → `sms-hook` → Logs**. It logs which channel failed and Meta's reason; it never logs the code itself.

### d. Choosing the order (optional)

By default the hook tries WhatsApp, then SMS. To change the order, or to use only one channel, set `OTP_CHANNELS`:

```sh
npx supabase secrets set OTP_CHANNELS=sms,whatsapp   # SMS first, WhatsApp as backup
npx supabase secrets set OTP_CHANNELS=whatsapp       # WhatsApp only
```

> **What the fallback can't catch:** it only switches to SMS when Meta **refuses** the message straight away (for example, the template isn't approved yet, or the account is locked). If Meta accepts the message but can't deliver it later, because the number isn't on WhatsApp, the landlord gets nothing. The `wa-webhook` logs then show `WhatsApp could not deliver …`. Once Termii is live, a "Send by SMS instead" link on the code screen would cover this.

### e. Going back to demo codes

To go back to the demo table, switch the Send SMS hook to **Postgres**, schema `public`, function `dev_send_sms_hook`. Nothing else needs to change.

---

## 12. Test everything end to end

### a. The tenant chat

1. In RentPadi, open a tenant (or create a test one) and put **one of your allow-listed numbers** in their **WhatsApp number** field. If the number is already their main phone number, that works too.
2. From that phone, send `Hi` to the test number. You should get a menu with **My rent · Pay rent · Receipts**.
3. Try each:
   - **My rent**: shows the next rent due (or how late it is), what's left if part-paid, and later unpaid periods.
   - **Pay rent**: replies with a **Pay ₦…** button that opens Paystack checkout. This needs the landlord's payout account to be set up (Settings → Payout account). Use a Paystack test card.
   - **Receipts**: lists receipts; tap one and the PDF arrives in the chat.
4. Free text works too: `how much do I owe`, `I want to pay`, `send my receipts`.
5. If the same number is the WhatsApp number for **two tenancies** (e.g. a shop and a flat), the bot first asks which one.

### b. Receipts sent automatically

1. In RentPadi, go to **Settings → WhatsApp** and switch on **Also send reminders and receipts on WhatsApp**.
2. Record a payment for the test tenant (manually, or pay via the link with a test card).
3. Within 5 minutes, the phone gets the `rent_receipt` template with the PDF attached and a **My receipts** button. (Receipts go out at any hour.)
4. In the tenant's **Reminders** list, the WhatsApp row moves from **Queued → Sending → Sent**.

### c. Reminders

Reminders are queued once a day at 8:00 Lagos time, on fixed days relative to the due date: 60 days before (yearly rent), 30 days before (not monthly rent), then 14, 7 and 1 day before, and 1, 7 and 14 days late. They're only sent between **8am and 8pm Lagos time**.

To test without waiting:

1. Give the test tenant an unpaid rent due **exactly 7 days from today**. For example, add a tenant whose next rent date is a week away.
2. In the SQL Editor, queue and send immediately. The second command needs the time in Lagos to be between 8am and 8pm:

   ```sql
   select public.queue_reminders();     -- returns how many rows it queued
   select public.run_message_sender();
   ```

3. The phone gets `rent_in_due_reminder`. Tap **Check my rent**: the bot answers with that tenancy's details.

> The phone also gets the SMS copy only once Termii is set up. Until then SMS rows stay **Queued**, and anything older than 2 days is marked **Skipped**. That's expected.

---

## 13. Troubleshooting

Logs first: Dashboard → **Edge Functions → `wa-webhook` (or `send-reminders`) → Logs**. Errors from Meta are logged with their status and message.

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| **Verify and save** fails | Function not deployed, or verify token mismatch | Run the `curl` check from step 6.5 until it prints the challenge |
| `Hi` gets no reply, and the logs show nothing (the dashboard **Test** button works) | Your app isn't subscribed to the WhatsApp account, or the `messages` field isn't subscribed | Step 7.4 (`subscribed_apps`), then step 7.3. Also check you're messaging the right test number |
| Logs: `WhatsApp could not deliver …: (#131031) Business Account locked` (or the dashboard **Send message** test fails with it) | Meta has restricted the WhatsApp account. Common with brand-new business portfolios | [Business Support Home](https://business.facebook.com/business-support-home) → **Request review**, and complete **Business info**. Or create a new app (new test account), then redo steps 3–8 and update the three `WHATSAPP_*` secrets |
| Login: *"We could not send your code just now"* | `sms-hook` couldn't send on any channel: the `login_code` template isn't approved, Termii isn't set up, or `SEND_SMS_HOOK_SECRET` doesn't match the hook | **Edge Functions → `sms-hook` → Logs**. A `rejected unsigned` line means the hook secret is wrong; redo step 11b |
| Login code never arrives, and no error shows | WhatsApp accepted the code but couldn't deliver it (number not on WhatsApp, or not on the test number's allow-list) | `wa-webhook` logs show `WhatsApp could not deliver …`. Add the number in step 3, or set up Termii as a fallback |
| Created a new Meta app, and now nothing works | The secrets still belong to the old app | A new app means a new **app secret**, **Phone number ID**, **token**, webhook, templates and recipient list. Redo steps 3–8 |
| Logs: `rejected unsigned or badly signed request` | Wrong `WHATSAPP_APP_SECRET` | Re-copy it from **App settings → Basic** and set it again |
| Logs: `WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set` | Secrets missing | Step 6.2, then `npx supabase secrets list` |
| Logs: `WhatsApp 401: … access token …` | Token expired (the 24-hour one) or revoked | Step 4: system-user token with **Never** expiry |
| Logs: `WhatsApp 400: … Recipient phone number not in allowed list` (code 131030) | Test number messaging a phone not on the list | Step 3.3: add the number |
| Logs: `WhatsApp 404: … template name does not exist in the translation` (132001) | Template not approved yet, wrong name, or language isn't plain **English** (`en`) | Step 8: check the name, language and status = Active |
| Logs: `WhatsApp 400: … number of parameters does not match` (132000) | Template body differs from `wa-templates.ts` | Recreate the template with the exact body text |
| Reminder shows **Failed**: *message undeliverable* | Number isn't on WhatsApp | Correct the tenant's WhatsApp number |
| Bot says the number isn't linked | Tenant's WhatsApp/phone doesn't match, or the tenant is archived | Check the number in the tenant form; only active tenants are recognised |
| Messages stay **Queued** forever | Vault secrets missing, or outside 8am–8pm for reminders | Step 9.3, or wait for the window |
| Links in messages open `localhost` | `APP_URL` still points at your dev server | Set `APP_URL` to the deployed URL (see below) |

---

## 14. Going live with a real number

The test number is for development only. Before real tenants use it:

1. **Deploy the app publicly** (e.g. Vercel). Then point both places that build links at it:
   - Function secret: `npx supabase secrets set APP_URL=https://your-domain`
   - SMS link base (SQL Editor): `update public.app_config set value = 'https://your-domain' where key = 'app_url';`
2. **Verify your business** in Meta Business settings → **Security center**. You'll need CAC registration documents and a website on the business's domain.
3. **Add a real phone number** under **WhatsApp → API Setup → Add phone number**. It must not already be in use on the WhatsApp app (a fresh SIM is easiest). Set a **display name** (e.g. *RentPadi*). Meta reviews it. Under **WhatsApp Manager → Phone numbers → Profile**, upload [`docs/brand/whatsapp-profile.png`](brand/whatsapp-profile.png) as the profile photo. The test number's profile can be set the same way.
4. **Add a payment method** in WhatsApp Manager. Meta charges per *template* message (reminders, receipts). Replies to tenants within 24 hours of their message are free. Check Meta's current Nigeria rates.
5. **Recreate the templates** (the three in step 8, plus `login_code`) under the real number's WhatsApp account, if it's different from the test one.
6. **Switch the secrets** to the real number: `WHATSAPP_PHONE_NUMBER_ID`, and a new system-user token with that WhatsApp account assigned.
7. **Update the frontend:** `VITE_WHATSAPP_NUMBER=+234…` in the host's environment, then redeploy.
8. **Publish the app** (switch it from Development to **Live** in the app dashboard). This needs a privacy policy URL; use `https://your-domain/privacy`.
9. **Watch the messaging limit.** New numbers can only start conversations with a limited number of people per day (250 at the time of writing). The limit rises automatically as long as tenants don't block or report the number.

---

## 15. Reference: every value and where it goes

**Supabase edge function secrets** (`npx supabase secrets set …`):

| Name | What it is | Used by |
| --- | --- | --- |
| `WHATSAPP_TOKEN` | System-user access token (step 4) | wa-webhook, send-reminders, sms-hook |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID (step 3) | wa-webhook, send-reminders, sms-hook |
| `WHATSAPP_APP_SECRET` | App secret (step 5), checks Meta's signatures | wa-webhook |
| `WHATSAPP_VERIFY_TOKEN` | Your random string (step 6), for Meta's one-time check | wa-webhook |
| `MESSAGE_SENDER_SECRET` | Your random string (step 6), so only the cron job can trigger sending | send-reminders |
| `APP_URL` | Public app URL, used to build payment and receipt links | wa-webhook, send-reminders, pay-checkout |
| `SEND_SMS_HOOK_SECRET` | Generated by Supabase for the Send SMS hook (step 11b) | sms-hook |
| `OTP_CHANNELS` | *Optional.* Order of login-code channels, default `whatsapp,sms` | sms-hook |
| `WHATSAPP_API_VERSION` | *Optional.* Graph API version, default `v23.0` | wa-webhook, send-reminders |

**Supabase Vault** (SQL, step 9):

| Name | Value |
| --- | --- |
| `project_url` | `https://<project-ref>.supabase.co` |
| `message_sender_secret` | Same as `MESSAGE_SENDER_SECRET` |

**Frontend** (`.env.local` / hosting env):

| Name | Value |
| --- | --- |
| `VITE_WHATSAPP_NUMBER` | The WhatsApp number in E.164, e.g. `+15551234567` |

**Meta dashboard:**

| Where | Value |
| --- | --- |
| WhatsApp → Configuration → Callback URL | `https://<project-ref>.supabase.co/functions/v1/wa-webhook` |
| WhatsApp → Configuration → Verify token | Same as `WHATSAPP_VERIFY_TOKEN` |
| WhatsApp → Configuration → Webhook fields | `messages` subscribed |
| Message templates | `rent_in_due_reminder`, `rent_overdue_reminder`, `rent_receipt`: Utility, English, Active. `login_code`: Authentication, English, Copy code, Active |
| Supabase → Auth Hooks → Send SMS | HTTPS, `https://<project-ref>.supabase.co/functions/v1/sms-hook` |

**How the pieces fit:**

```
Tenant's WhatsApp ──message──▶ Meta ──signed webhook──▶ wa-webhook ──▶ reply (menu, rent, pay link, receipt PDF)

pg_cron (every 5 min) ──▶ run_message_sender() ──x-sender-secret──▶ send-reminders
                                                                       ├─▶ WhatsApp templates (Meta)
                                                                       └─▶ SMS (Termii, once set up)
```

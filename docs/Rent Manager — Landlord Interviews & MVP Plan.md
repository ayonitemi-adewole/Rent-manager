# Rent Manager — Landlord Interviews & MVP Plan

Nov 17, 2026 · @Ayo

## How to run the interviews

Goal: within two weeks, find out if Ibadan landlords with 4–15 units feel rent collection is painful enough to pay for help, and sign up 3–5 for a free manual pilot.

**Who to talk to**

- 15–20 landlords with 4–15 units ("face-me-I-face-you", flats, mini-flats, shops). Aim for a mix of ages; include some 50+.
- 5–8 tenants, ideally of the landlords you interview.
- 3–5 caretakers or agents. They often collect rent and can introduce you to many landlords.
- Where to find them: family and friends, church or mosque, landlord associations (CDAs), estate agents, NYSC colleagues' parents.

**How to run each interview**

- 20–30 minutes, in person if possible. Use English, Yoruba or Pidgin, whichever they're comfortable with.
- Ask about what happened last time, not opinions about the future. "Tell me about the last time a tenant paid late" beats "Would you use an app?"
- Don't pitch until the end. Listen more than you talk.
- Write notes straight after, using the scorecard in "What to listen for".
- Close every interview by asking for a referral to another landlord.

## Landlord interview questions

Ask these roughly in order; the ones in bold matter most if time is short.

**1. Their property (warm-up)**

1. How many properties and units do you have, and what kind (rooms, flats, shops)?
2. How long have you been a landlord?
3. Do you manage them yourself, or does a caretaker, agent or family member help?

**2. How rent works today**

1. **Walk me through how you collected rent the last time it was due.**
2. Do tenants pay yearly, every six months or monthly? Cash, transfer or something else?
3. How do you keep track of who has paid and when each rent expires? Can you show me?
4. Do you give tenants receipts? How?

**3. The pain**

1. **Tell me about the last time a tenant paid late or didn't pay. What happened?**
2. Out of your tenants, roughly how many paid late in the last year?
3. How much time do you spend chasing rent? Calls, visits, sending someone?
4. Have you ever had a dispute about whether someone paid, or how much? What happened?
5. Has a caretaker or agent ever held back or mishandled rent money?
6. **What's the most annoying part of being a landlord right now?**

**4. What they've tried**

1. Have you tried anything to make this easier: a notebook, Excel, an app, a lawyer?
2. What did you like or dislike about it? Why did you stop, if you did?

**5. Money and willingness to pay**

1. How much do you pay your caretaker or agent to manage things today?
2. If tenants could pay monthly instead of yearly, but you got the money reliably, would you allow it? What would worry you?
3. **If something reminded tenants, collected rent into your account and kept the records, what would that be worth to you each month?**

**6. Phone and tech habits**

1. What phone do you use? Do you use WhatsApp, bank apps or USSD?
2. Who helps you with your phone when you're stuck?

**7. Close (only now, briefly describe the idea)**

1. "I'm building a simple tool that reminds your tenants, collects rent straight into your account, and shows you who has paid. Would you try it free for the next rent cycle?"
2. Can I get the number of 1–2 other landlords who might want to talk to me?

## Tenant interview questions

Keep these to 10–15 minutes. Tenants decide whether payment links get used, so their view matters.

1. How do you pay rent today, and how often?
2. **Tell me about the last time rent was due. How did you raise the money?**
3. Have you ever been late? What happened with the landlord?
4. Do you get a receipt? Have you ever had a dispute about payment?
5. If you could pay monthly, or save toward rent automatically, would you? How much per month could you manage?
6. Would you pay rent through a link sent on WhatsApp? What would make you trust it?

## What to listen for

Build only if at least 8 of 20 landlords show strong pain and 3 agree to a free pilot. Score each interview straight after.

| Signal | Good sign | Warning sign |
| --- | --- | --- |
| Late payment | Several tenants late every year; real stories | "My tenants always pay on time" |
| Time spent | Repeated calls, visits, sending people | Little or no effort |
| Record keeping | Notebook, memory, confusion over expiry dates | Already uses a working system |
| Disputes or leakage | Payment disputes, caretaker mishandling money | None mentioned |
| Already paying | Pays a caretaker or agent to manage | Does everything free, no budget |
| Phone use | WhatsApp and bank transfers daily | No smartphone and no one to help |
| Commitment | Agrees to a pilot, gives referrals | "Nice idea", then no next step |

Two things to note if they come up often, because they change the product:

- Many tenants want to pay monthly but landlords refuse. Then the savings feature matters more than reminders.
- Caretakers handle most collection. Then the caretaker, not the landlord, may be your main user.

## MVP feature map

Version 1 does one job: a landlord sees who owes what, tenants get reminded, and rent arrives in the landlord's own account with a receipt. Adjust this after the interviews.

**Must-have (version 1)**

| Feature | What it does | Who uses it |
| --- | --- | --- |
| Landlord sign-up | Phone number + OTP login; add bank account for payouts | Landlord |
| Properties and units | Add properties, units and rent amount per unit | Landlord |
| Tenants | Add tenant name, phone, unit, rent start date and period (yearly, 6-monthly, monthly) | Landlord |
| Rent dashboard | Who has paid, who is due soon, who is overdue, total collected | Landlord |
| Payment links | Unique Flutterwave link per tenant per rent; money settles to the landlord's account | Tenant |
| Auto reminders | SMS or WhatsApp at 30, 14, 7 and 1 days before due, then on overdue | Tenant |
| Record cash payments | Landlord marks a cash or direct transfer payment manually | Landlord |
| Receipts | Auto-generated receipt link sent to tenant after each payment | Both |
| Payment history | Full ledger per tenant and per unit | Landlord |
| Tenant page (no login) | Opens from the link: shows amount due, pay button, past receipts | Tenant |

**Later (after the pilot works)**

- Caretaker accounts with limited access
- Rent savings: tenants save monthly toward yearly rent (needs a licensed partner)
- Service charge, electricity and water bills alongside rent
- Tenancy agreements and quit notices from templates
- Yoruba and Pidgin interface
- Monthly statements and simple reports for tax

**Not now**

- Native mobile apps (a fast mobile web app is enough)
- Property listings or finding tenants
- Holding money in your own wallet
- Maintenance requests and chat

## Tech stack, data model and build plan

You can build version 1 alone in about 6 weeks of evenings and weekends, using tools you already know.

**Stack**

| Part | Tool | Why |
| --- | --- | --- |
| Frontend | React + TypeScript + Tailwind + ShadCN, mobile-first web app | Your core skills; no app store needed |
| Backend and auth | Supabase (Postgres, phone OTP, edge functions, scheduled jobs) | Relational data suits rent ledgers; free tier to start |
| Payments | Flutterwave payment links + subaccounts + webhooks | Money settles directly to each landlord |
| Reminders | An SMS provider such as Termii first; WhatsApp Business API later | SMS reaches every phone |
| Hosting | Vercel | Free tier, you already use it |

**Data model (core tables)**

| Table | Key fields |
| --- | --- |
| landlords | id, name, phone, bank details, Flutterwave subaccount id |
| properties | id, landlord\_id, name, address |
| units | id, property\_id, label, rent\_amount, rent\_period |
| tenants | id, unit\_id, name, phone, start\_date, status |
| rent\_charges | id, tenant\_id, period\_start, period\_end, amount, due\_date, status (due, paid, overdue) |
| payments | id, charge\_id, amount, method (link, cash, transfer), reference, paid\_at |
| reminders | id, charge\_id, channel, scheduled\_for, sent\_at, status |

**Build plan**

1. Week 1: data model, auth, properties, units and tenants screens.
2. Week 2: rent charges and the dashboard (paid, due, overdue).
3. Week 3: Flutterwave links, subaccounts and webhook that marks charges paid.
4. Week 4: scheduled SMS reminders and manual cash payments.
5. Week 5: receipts, tenant page and payment history.
6. Week 6: onboard the 3–5 pilot landlords yourself; fix what confuses them.

While you build, keep the manual pilot running with a spreadsheet and WhatsApp, so real landlords shape the product.

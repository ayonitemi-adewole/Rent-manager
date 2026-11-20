# Pricing: subscriptions and the free plan (brainstorm)

> **Status: rough idea, not built.** These are notes for later. All the numbers are placeholders to test with pilot landlords, not decisions.

## The idea in one paragraph

A landlord picks one of two ways to pay for RentPadi:

1. **Free plan.** No monthly bill. RentPadi keeps a small, capped percentage of each rent payment a tenant makes **online** through RentPadi.
2. **Subscription.** A flat monthly or yearly price, with **no percentage taken**. There are a few tiers, sized by number of units and features.

The free plan gets landlords in the door with no risk. The subscription is cheaper once they collect a lot of rent through the app. Moving between the two should take one tap.

---

## 1. How the free plan earns

### Mechanism: Flutterwave split

Tenants already pay through Flutterwave, and the money settles into the landlord's **subaccount**. Flutterwave lets each checkout say how much of the payment the main account (RentPadi) keeps (`transaction_charge_type` + `transaction_charge` on the subaccount entry). So:

- **No money passes through us.** This keeps the Phase 1 rule that RentPadi never holds rent money.
- **The fee is decided per payment, at checkout**, from the landlord's plan *at that moment*. No subaccount settings need changing when a landlord switches plans.
- **Every payment records the fee it paid** (`platform_fee_kobo`), so revenue reports and receipts are exact.

### The fee must be capped

Nigerian rent is often paid yearly, in big amounts. An uncapped percentage feels like a tax:

| Rent payment | 1% uncapped | 1% capped at ₦3,000 |
| --- | --- | --- |
| ₦40,000 (shop, monthly) | ₦400 | ₦400 |
| ₦350,000 (flat, yearly) | ₦3,500 | ₦3,000 |
| ₦1,500,000 (duplex, yearly) | ₦15,000 | ₦3,000 |

**Starting point:** about 1% per online payment, capped at about ₦3,000. This sits on top of Flutterwave's own fee (about 1.4%, capped), so the two together must still feel fair.

### Who pays it: landlord or tenant?

This is linked to the open question in the roadmap about the Flutterwave fee.

- **Deducted from the landlord (recommended to start).** The tenant pays exactly the rent, so there are no surprises at checkout. The landlord sees *"₦350,000 paid · ₦3,000 RentPadi fee · ₦347,000 to your bank"*.
- **Added on for the tenant.** The landlord gets the full rent. But tenants may complain to the landlord, and that's a trust problem for the landlord.
- **Possibly a landlord setting later:** "Who pays the fees? Me / my tenants".

### The big gap: cash and bank transfers

The fee only applies to **online payments through RentPadi**. Rent paid in cash or by direct transfer, and recorded by hand, earns nothing. A free-plan landlord could simply tell tenants to transfer directly.

Ways to handle this, from softest to strictest:

1. **Accept it.** Manual recording is the ledger, and the ledger is the product. Earn on online payments, and make online payment the easiest path for tenants (WhatsApp pay button, payment link in every reminder, instant receipt).
2. **Tie the free plan's automation to online payment.** For example, on the free plan, automatic receipts and WhatsApp messages only follow online payments, while manually recorded payments get a receipt the landlord has to send themselves.
3. **Limit manual records on the free plan** (e.g. 10 per month). This is the strictest option, and the most likely to annoy people.

**Leaning:** start with (1). Track what share of a free landlord's rent comes in online. If it's low, move to (2).

---

## 2. Subscription tiers

The plan doc targets landlords with **4–15 units**, so the tiers are sized around unit counts. The costs that grow with use are **messages**: SMS through Termii, and WhatsApp template messages through Meta.

| | **Free** | **Starter** | **Standard** | **Pro** |
| --- | --- | --- | --- | --- |
| Price (placeholder) | ₦0 + capped % of online rent | ~₦2,000 / month | ~₦5,000 / month | ~₦10,000 / month |
| Units | up to 15 | up to 5 | up to 15 | unlimited |
| Platform % on online rent | yes | **none** | **none** | **none** |
| Tenant payment link, receipts, ledger | ✅ | ✅ | ✅ | ✅ |
| Automatic SMS reminders | ✅ (limited allowance) | ✅ | ✅ | ✅ |
| WhatsApp reminders + receipts | — | ✅ | ✅ | ✅ |
| Tenant WhatsApp chat (check rent, pay, receipts) | ✅ | ✅ | ✅ | ✅ |
| Custom reminder schedule / wording | — | — | ✅ | ✅ |
| Caretaker accounts | — | — | 1 | several |
| Agreements and quit notices (PDF) | — | — | ✅ | ✅ |
| Reports and export (CSV / PDF statements) | basic | basic | ✅ | ✅ |
| Landlord's name/logo on receipts | — | ✅ | ✅ | ✅ |

Notes:

- **Keep the tenant chat free on every plan.** Replies to tenants inside the 24-hour window cost Meta nothing, and the chat drives online payments, which is how the free plan earns.
- **Give each tier a message allowance** (e.g. Starter 100 SMS / month) to protect margins, with paid top-ups. This needs real Termii and Meta prices first.
- **Yearly billing at about 2 months free.** Many landlords think in yearly rent, so yearly may be the main option, not the extra.
- **Maybe drop Starter.** Three choices (Free, Standard, Pro) are easier to explain than four.

### When does subscribing beat the free plan?

The landlord should be able to see this in the app. For example:

> 10 units × ₦300,000 yearly rent, all paid online → 10 × ₦3,000 (capped) = **₦30,000/year** on Free.
> Standard yearly ≈ ₦50,000 → Free is cheaper for this landlord.
> 10 units × ₦40,000 **monthly** shops → 120 payments × ₦400 = **₦48,000/year** on Free. Now Standard is about the same, and comes with more features.

So the cap matters a lot. A free plan that's *too* cheap means nobody subscribes. The balance should come from (a) features only subscribers get, and (b) a cap that makes Free cost more than a subscription for landlords collecting monthly or high volumes.

**Idea:** a "You'd have saved ₦X on Standard this year" card in Settings, shown once the gap is meaningful.

---

## 3. Billing the subscription

Nigerian specifics:

- **Recurring card charges are unreliable.** Cards expire, banks block debits, and many landlords prefer bank transfer. Offer:
  - card subscription through Flutterwave **payment plans** (auto-renew), *and*
  - **one-off payment for a period** (card, transfer or USSD via Flutterwave checkout), with renewal reminders 7 days and 1 day before expiry, by SMS and WhatsApp.
- **VAT (7.5%)** applies to the subscription and the platform fee once the company is VAT-registered. Show prices including VAT.
- **Invoices and receipts** for subscription payments, using the same PDF writer as rent receipts.

---

## 4. Trials, lapses and switching

- **Trial:** new landlords get **30 days of Standard** free, then choose a plan. Doing nothing means the Free plan.
- **Pilot landlords:** "founder pricing", e.g. Standard free for a year, or half price for life. Promised in writing.
- **When a subscription lapses:** a **7-day grace period**, then automatic fallback to **Free**. Never:
  - lock the landlord out of their ledger or history;
  - stop tenants from paying;
  - delete data.

  Subscriber-only features pause; they don't disappear. For example, WhatsApp reminders stop, but the setting is remembered.
- **Upgrading:** takes effect immediately. The platform fee stops from the next checkout.
- **Downgrading:** takes effect at the end of the paid period.
- **Going over the unit limit:** warn, and let them keep working for 14 days, then ask them to upgrade. Never block recording a payment.

---

## 5. What it would take to build (sketch)

**Database:**

- `plans`: code, name, monthly and yearly price (kobo), unit limit, platform fee % and cap, message allowances, and feature flags (jsonb).
- `landlord_subscriptions`: landlord, plan, status (`trialing | active | grace | lapsed | cancelled`), period start and end, billing method, provider reference.
- `subscription_payments`: the invoice and receipt ledger for what landlords pay RentPadi. Kept separate from rent payments.
- `payments.platform_fee_kobo`: the fee taken on each online rent payment.
- `landlord_entitlements(landlord_id)`: one SQL function that returns the effective plan and features. It's the single source of truth for gating.
  - It handles trial, grace and lapse in one place.
  - RLS, `queue_reminders`, `flw-checkout` and the UI all ask it, so nothing reimplements the rules.

**Functions:**

- `flw-checkout`: reads the landlord's entitlements and sets the split's `transaction_charge` (0 for subscribers).
- `flw-webhook`: also handles subscription payments; extends or renews the period.
- A daily cron job: moves expired subscriptions through grace → lapsed, and queues renewal reminders.

**UI:**

- **Settings → Plan & billing:**
  - current plan, renewal date, and the "you'd save" card;
  - **Change plan**;
  - billing history with PDF receipts.
- **Upgrade prompts** at the point of need, e.g. turning on WhatsApp reminders on Free shows "Available on Starter and up".
- **Payment details** show the platform fee on the landlord's side only.

**Admin (later):** a simple page for us to see subscribers, revenue and fees collected, and to grant founder pricing.

---

## 6. Open questions to answer with pilots

1. Would landlords rather lose ~1% (capped) or pay a fixed fee? Does the answer change for monthly versus yearly rent?
2. What's an honest monthly price for a 10-unit landlord in Ibadan? Ask them directly: "Would you pay ₦3,000 a month for this? ₦5,000?"
3. Should the platform fee be deducted from the landlord, or added for the tenant, or should the landlord choose?
4. Do landlords prefer paying monthly, yearly, or "per rent cycle"?
5. How many free-plan tenants actually pay online versus by transfer? This decides how big the cash/transfer gap is (section 1).
6. Which features would make a landlord upgrade? Caretakers, WhatsApp, documents, or reports?
7. Do landlords with fewer than 5 units exist in enough numbers to need a Starter tier?

## 7. Possible rollout order

1. **Record the fee only:** add `platform_fee_kobo` and the split at 0%. Show "RentPadi fee: ₦0 (pilot)" so landlords get used to seeing it.
2. **Plans and entitlements:** add the tables and `landlord_entitlements`, with everyone on a pilot plan. Gate one feature (WhatsApp reminders) to test the gating.
3. **Free plan fee:** switch the split on for new landlords on Free.
4. **Subscriptions:** one-off yearly payment first (simplest). Add auto-renewing card plans afterwards.
5. **Polish:** the "you'd save" card, admin view, VAT invoices.

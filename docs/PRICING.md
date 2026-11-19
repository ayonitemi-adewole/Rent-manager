# Pricing: subscriptions and the free plan

> **Status: proposed model, not built.** The tiers and prices below are the working plan. Test them with pilot landlords before building billing. Costs use a planning rate of **₦1,500 = $1**. That is about 10% weaker than the official rate of ₦1,357 (16 Nov 2026), to cover bank-card FX spreads. Check the live rates before launch (see section 7).

## The idea in one paragraph

A landlord picks one of four plans:

1. **Padi Free.** No monthly bill, up to 5 units. RentPadi keeps **1% of each rent bill a tenant pays online** through RentPadi, **capped at ₦2,000 per rent bill**.
2. **Padi.** **₦2,400 / month** or **₦24,000 / year**, up to 10 units. No percentage taken.
3. **Padi Plus.** **₦5,000 / month** or **₦50,000 / year**, up to 25 units. No percentage taken.
4. **Padi Pro.** **₦10,000 / month** or **₦100,000 / year**, up to 50 units, then ₦200 per extra unit a month. No percentage taken. For bigger landlords and caretakers.

**Tenants always pay exactly their rent.** The payment company's fee comes out of the landlord's share, at cost, on every plan. RentPadi never holds rent money: the gateway pays each landlord directly, and only RentPadi's own fee comes to RentPadi.

Rent payments go through **Paystack**, not Flutterwave. Flutterwave now charges an uncapped 2%, which is ₦64,500 on a ₦3M rent. Paystack's fee is capped at ₦2,150 (card, including VAT) or ₦322.50 (bank transfer to a virtual account).

Every plan costs a little less than the closest competitor plan of the same size. Moving between plans should take one tap.

**Keep it to these four plans.** Many landlords are older and will drop out if the choice feels complicated.

---

## 1. The plans

| | **Padi Free** | **Padi** | **Padi Plus** | **Padi Pro** |
| --- | --- | --- | --- | --- |
| Monthly | ₦0 | **₦2,400** | **₦5,000** | **₦10,000** |
| Yearly (2 months free) | ₦0 | **₦24,000** | **₦50,000** | **₦100,000** |
| Units | up to 5 | up to 10 | up to 25 | up to 50, then ₦200 per extra unit a month |
| RentPadi fee on online rent | **1%, capped at ₦2,000 per rent bill** | none | none | none |
| Payment company's fee on rent | landlord pays, at cost | landlord pays, at cost | landlord pays, at cost | landlord pays, at cost |
| Ledger, payment links, receipts | ✅ | ✅ | ✅ | ✅ |
| Bank-transfer account per tenant (when available, see section 7) | ✅ | ✅ | ✅ | ✅ |
| Tenant WhatsApp chat (check rent, pay, receipts) | ✅ | ✅ | ✅ | ✅ |
| Reminders | SMS only, 2 per rent bill | WhatsApp, with SMS fallback (3 per rent bill) | WhatsApp, with SMS fallback | WhatsApp, with SMS fallback |
| Tenancy expiry alerts | ✅ | ✅ | ✅ | ✅ |
| Export your ledger (CSV) | ✅ | ✅ | ✅ | ✅ |
| Landlord's name/logo on receipts | — | ✅ | ✅ | ✅ |
| Custom reminder schedule and wording | — | — | ✅ | ✅ |
| Agreements and quit notices (PDF) | — | — | ✅ | ✅ |
| PDF statements and reports | basic | basic | full | full |
| Caretaker accounts | — | — | 1 | up to 5 |

Notes:

- **Price per unit falls as landlords grow.** At full use, Padi costs ₦240 per unit a month (₦2,400 ÷ 10), Padi Plus ₦200 (₦5,000 ÷ 25) and Padi Pro ₦200 (₦10,000 ÷ 50). Growing never makes a landlord pay more per unit.
- **Padi's ₦2,400 is chosen on purpose.** Paystack waives its ₦100 fixed fee on payments under ₦2,500. At ₦2,400 the fee on our own subscription is ₦36 instead of ₦136.
- **Padi Free allows 5 units.** That matches the market's free plans (Ledge 5, LandlordNG 3). With the lower cap, a Free unit earns at most ₦2,000 a year, less than the ₦2,400 a year each unit brings on a full Padi plan, so a bigger Free plan no longer pays.
- **Everyone can export their own data.** CSV export of the ledger is on every plan, including Free. Landlords should never feel their records are held hostage.
- **Keep the tenant chat free for tenants on every plan.** It drives online payments. It is no longer completely free for us (see section 4), but it is cheap.
- **Yearly billing is the default, not an extra.** Nigerian rent is usually paid yearly, so landlords already think in years, and a monthly fee can feel wasted in months when no rent is due. Show yearly first and monthly as the more expensive option.
- **No VAT is charged.** RentPadi is a small company under the VAT threshold, so the prices above are the full price. Invoices say "VAT not charged: small business exemption" (see section 4, Tax).

---

## 2. How the free plan earns

### Mechanism: Paystack split

Each landlord has a Paystack **subaccount**, and rent settles straight into the landlord's bank. At checkout we tell Paystack how much of the payment the main account (RentPadi) keeps (`transaction_charge`, a flat amount in kobo), and we set **`bearer: "subaccount"`** so the landlord's share carries Paystack's fee. So:

- **No money passes through us.** This keeps the rule that RentPadi never holds rent money.
- **RentPadi's fee always arrives in full.** On Flutterwave, the docs show the payment company's fee coming out of *our* share. On a ₦3M rent that would have turned a ₦7,500 fee into a ₦57,000 loss.
- **The fee is decided per payment, at checkout**, from the landlord's plan *at that moment*. No subaccount settings need changing when a landlord switches plans.
- **Every payment records the fee it paid** (`platform_fee_kobo`) and the gateway fee (`gateway_fee_kobo`), so revenue reports and receipts are exact.

The fee is `min(1% × amount, ₦2,000 − fee already charged on this rent bill)`. The cap is **per rent bill, not per payment**. A tenant who pays a ₦1M rent in four parts gives RentPadi ₦2,000 in total, not ₦8,000. The cap is reached on any rent bill of ₦200,000 or more.

| Rent bill | Padi Free fee | Paystack fee, bank transfer to virtual account (1%, max ₦300, + 7.5% VAT) | Paystack fee, card (1.5% + ₦100, max ₦2,000, + 7.5% VAT) |
| --- | --- | --- | --- |
| ₦100,000 (monthly) | ₦1,000 | ₦322.50 | ₦1,720 |
| ₦500,000 | ₦2,000 (cap reached) | ₦322.50 | ₦2,150 |
| ₦3,000,000 (yearly) | ₦2,000 | ₦322.50 | ₦2,150 |

*(We assume Paystack adds 7.5% VAT to its fee. If it doesn't, the gateway figures are 7% lower.)*

### Who pays what

- **Tenants pay exactly the rent, on every plan.** No RentPadi fee, no VAT and no payment-company fee. Paying by bank transfer is never surcharged. (The ₦50 government stamp duty on bank transfers of ₦10,000 or more is charged by the tenant's own bank by law. It is not ours. Say so on the receipt.)
- **The landlord pays the payment company's fee, at cost, on every plan.** The landlord sees *"₦100,000 paid · ₦322.50 bank fee · ₦1,000 RentPadi fee · ₦98,677.50 to your bank"* (Padi Free), or the same line without the RentPadi fee (paid plans).
- **RentPadi pays the payment company's fee on its own subscription payments.**
- **Later, and only if landlords ask:** a landlord may choose to pass the **card** fee to tenants who choose card instead of transfer, shown to the tenant before they pay. Bank transfer stays free for tenants. Off by default.
- **Considered and not adopted: a flat tenant convenience fee.** US apps charge tenants $2–2.50 a payment. Here it would surprise tenants at checkout and push them toward paying outside RentPadi, which earns nothing.

### The gap: cash and bank transfers outside RentPadi

The fee only applies to **online payments through RentPadi**. Rent paid in cash or by transfer straight to the landlord's own account, then recorded by hand, earns nothing.

**Plan:** on Padi Free, automatic receipts and reminders follow **online** payments. Manually recorded payments still go in the ledger, but the landlord sends the receipt themselves. This keeps online payment the easy path without blocking anyone. Make the tenant's bank-transfer account the most visible way to pay, because it's the cheapest for everyone. Track what share of Free-plan rent comes in online. If it's still low, consider limiting manual records on Free.

---

## 3. When subscribing beats Padi Free

| Landlord's rent | Padi Free costs them (RentPadi fee only) | Padi (₦2,400 / month or ₦24,000 / year) |
| --- | --- | --- |
| ₦100k monthly | ₦1,000 per tenant a month | **cheaper from 3 tenants** (₦3,000 vs ₦2,400) |
| ₦200k or more yearly | ₦2,000 per tenant a year | at Free's 5-unit limit: ₦10,000 vs ₦24,000. **Free is cheaper**; Padi is for the features |

- A small landlord on **monthly** rent saves money on Padi from the 3rd tenant. That is the easy first "yes" to paying.
- A small landlord on **yearly** rent pays at most ₦10,000 a year on Free (5 × ₦2,000). They move to Padi for WhatsApp reminders, branded receipts and room to grow past 5 units, not to save money. That's fine, and it's fair.
- The 6th unit means moving off Free. Padi covers 6–10 units for ₦24,000 a year.

**Trade-off:** Padi Free earns less per landlord than the old draft (₦2,000 cap instead of ₦7,500). We accept that because the old cap was 3.75 times the ₦2,000 figure landlords see at competitors, and because a small, fair Free plan brings more landlords in.

**Idea:** a "You'd have saved ₦X on Padi this year" card in Settings, shown from the 3rd monthly-rent tenant.

### Is it a burden?

All figures include the payment company's fee on bank transfers (₦322.50 per rent bill).

| Landlord | Rent income | Plan + bank fees a year | Share of rent |
| --- | --- | --- | --- |
| Padi Free, 4 tenants × ₦400k yearly | ₦1.6M a year | 4 × (₦2,000 + ₦322.50) = ₦9,290 | 0.58% |
| Padi Free, 4 tenants × ₦100k monthly | ₦400k a month | 4 × (₦1,000 + ₦322.50) = ₦5,290 a month | 1.3% (Padi: ₦3,690, 0.9%) |
| Padi, 7 units × ₦500k yearly | ₦3.5M a year | ₦24,000 + 7 × ₦322.50 = ₦26,258 | 0.75% |
| Padi Plus, 15 units × ₦1M yearly | ₦15M a year | ₦50,000 + 15 × ₦322.50 = ₦54,838 | 0.37% |
| Padi Pro, 35 units × ₦1.5M yearly | ₦52.5M a year | ₦100,000 + 35 × ₦322.50 = ₦111,288 | 0.21% |

For comparison, Lagos law lets agents take up to 10% agency plus 10% legal fees on a letting, and many take more. Use that comparison when selling the product.

### Against the competition

| Landlord size | RentPadi | Ledge | LandlordNG | Others |
| --- | --- | --- | --- | --- |
| 5 units | Padi Free: ₦0 + 1% (max ₦2,000) per rent bill | Free (5 units), card fee passed on | Free (3 units only) | Property360: first property free |
| 10 units | Padi: ₦24,000 / year | Starter: ₦60,000 / year (15 units) | Growth: ₦60,000 / year (30 units) | RentFlow Agent: ₦20,000 / year (10 properties, email alerts only) |
| 25 units | Padi Plus: ₦50,000 / year | Growth: ₦120,000 / year (50 units) | Growth: ₦60,000 / year (30 units) | Property360: ₦65,000–81,600 / year |
| 50 units | Padi Pro: ₦100,000 / year, 5 caretakers | Growth: ₦120,000 / year (single user) | Business: ₦150,000 / year (100 units) | — |

Ledge is giving everything away free until 2 Feb 2027. Lead with what they don't have: WhatsApp reminders and tenant chat, caretaker logins at ₦10k, and "tenants pay exactly the rent".

---

## 4. Costs and margins

### What grows with use: messages

| Item | Rate | In naira (₦1,500/$, + 7.5% VAT) |
| --- | --- | --- |
| WhatsApp utility template (Nigeria) | $0.0067 | **~₦11**, charged even inside the 24-hour window since 1 Oct 2026 |
| WhatsApp marketing template (Nigeria) | $0.0516 | ~₦83, **don't use** |
| WhatsApp service reply (tenant chat) | first **1,000 per number per month free**, then $0.0067 | ₦0, then ~₦11 |
| SMS (BulkSMSNigeria ₦6.49 + VAT; Africa's Talking ₦5.00–5.56) | — | **~₦7** |

Use Meta's Cloud API directly, not a reseller. Termii charges $50 a month per WhatsApp account and 360dialog €49 a month per number; direct costs ₦0 a month. Send SMS through a pay-as-you-go provider with a registered "RentPadi" sender ID on a transactional route, so messages reach MTN numbers on DND. Keep each SMS to one page (≤160 plain characters; writing "₦" cuts a page to 70).

**Per tenant, per rent bill:**

- **Paid plans:** 3 reminders + 1 receipt + 1 landlord alert = 5 × ₦11 = **₦55**. If chat replies go past the free 1,000, add about 5 replies × ₦11 = ₦55, so **₦110** at worst.
- **Padi Free:** 2 SMS reminders + 1 WhatsApp receipt + 1 landlord alert = 2 × ₦7 + 2 × ₦11 = **₦36**.

**Keep chat cheap:** send one message with balance, pay link and receipt link instead of several short ones. At 50 landlords on yearly rent, chat uses about 250 replies a month, well under the free 1,000.

### Margins

The cases below include Paystack's fee on the subscription payment itself (card rate + VAT, yearly billing): Padi ₦494.50 a year (₦41 a month), Padi Plus ₦913.75 (₦76 a month), Padi Pro ₦1,720 (₦143 a month).

| Case (yearly billing) | Revenue a month | Payment fee | Messages a month | Contribution | Margin |
| --- | --- | --- | --- | --- | --- |
| Padi Free, 4 units, yearly rent, 60% paid online | 4 × 0.6 × ₦2,000 ÷ 12 = ₦400 | ₦0 (landlord pays) | ~₦9 | ₦391 | ~98% |
| Padi, 7 units, yearly rent | ₦2,000 | ₦41 | 7 × ₦55 ÷ 12 = ₦32 | ₦1,927 | ~96% |
| Padi, 7 units, monthly rent, chat charged | ₦2,000 | ₦41 | 7 × ₦110 = ₦770 | ₦1,189 | ~59% |
| Padi Plus, 15 units, yearly rent | ₦4,167 | ₦76 | 15 × ₦55 ÷ 12 = ₦69 | ₦4,022 | ~97% |
| Padi Plus, 15 units, monthly rent, chat charged | ₦4,167 | ₦76 | 15 × ₦110 = ₦1,650 | ₦2,441 | ~59% |
| Padi Pro, 35 units, yearly rent | ₦8,333 | ₦143 | 35 × ₦55 ÷ 12 = ₦160 | ₦8,030 | ~96% |
| Padi Pro, 50 units, monthly rent, chat charged (worst case) | ₦8,333 | ₦143 | 50 × ₦110 = ₦5,500 | ₦2,690 | ~32% |

- Each extra Padi Pro unit (₦200 a month) costs at most ₦110 a month in messages.
- The only loss-making customer is a Padi Free landlord whose tenants never pay online: 5 tenants × ₦14 of SMS = ₦70 per rent bill with no income. Accept it as the cost of getting landlords in.

### Fixed costs

| Item | Cost | Notes |
| --- | --- | --- |
| Supabase | Free now; **Pro $25/month (~₦37,500)** | Upgrade when the first landlord pays. The free plan pauses after a week of inactivity and has no backups, and we hold people's rent records. Pro has daily backups for 7 days. |
| Hosting | **Cloudflare Pages: free** | Vercel's free (Hobby) plan does not allow commercial use. Netlify Free pauses every site when its credits run out. RentPadi is a static Vite site, so Cloudflare Pages hosts it free. |
| Domains | ~₦2,000/month | .com.ng ≈ ₦3,000/year; .com ≈ ₦15–20k/year at renewal. |
| WhatsApp / SMS platform fees | ₦0 | Direct Cloud API; pay-as-you-go SMS. |
| **Total** | **~₦39,500 a month** | At ₦1,600/$ it would be ~₦42,000. |

### One-off costs (within the ₦500k budget)

| Item | Cost |
| --- | --- |
| Private limited company at CAC (₦10,000 filing + ₦8,500 stamp duty + ₦1,000–5,000 name + ₦30,000–65,000 agent) | ~₦50,000–89,000 |
| 6 months of fixed costs (6 × ₦39,500) | ₦237,000 |
| SMS float | ₦20,000 |
| **Total** | **~₦307,000–346,000** |

### Break-even

Fixed costs ÷ contribution per landlord (yearly billing, yearly rent):

| Plan | Contribution a month | Break-even |
| --- | --- | --- |
| Padi | ₦1,927 | ₦39,500 ÷ ₦1,927 = 20.5 → **21 landlords** |
| Padi Plus | ₦4,022 | ₦39,500 ÷ ₦4,022 = 9.8 → **10 landlords** |
| Padi Pro | ₦8,030 | ₦39,500 ÷ ₦8,030 = 4.9 → **5 landlords** |
| Padi Free | ₦391 | ~101 landlords. Free is a way in, not a profit centre. |

### Example at 50 landlords

Yearly billing, yearly rent, 585 units in total:

| Plan | Landlords (avg units) | Revenue a month | Payment fees | Messages |
| --- | --- | --- | --- | --- |
| Padi Free | 15 (4) | 15 × ₦400 = ₦6,000 | ₦0 | ₦136 |
| Padi | 15 (7) | 15 × ₦2,000 = ₦30,000 | ₦618 | ₦481 |
| Padi Plus | 14 (15) | 14 × ₦4,167 = ₦58,333 | ₦1,066 | ₦963 |
| Padi Pro | 6 (35) | 6 × ₦8,333 = ₦50,000 | ₦860 | ₦963 |
| **Total** | **50** | **₦144,333** | **₦2,544** | **₦2,542** |

Profit = ₦144,333 − ₦2,544 − ₦2,542 − ₦39,500 = **~₦99,700 a month**.

- **If every subscriber paid monthly:** revenue ₦172,000, profit **~₦125,100**.
- **Stress case** (every tenant on monthly rent, every chat reply charged): messages rise to ~₦61,400 and profit falls to **~₦70,900**.

The old draft claimed ₦170k, but it assumed a Flutterwave fee capped at ₦2,000 that no longer exists. The new figure is lower and real.

### Tax

- **VAT:** RentPadi is under the small-business threshold, so it does not register for or charge VAT. The law conflicts on the threshold: the Tax Act says ₦50m turnover, the Administration Act says ₦100m. Use **₦50m** to be safe, and review when yearly turnover passes **₦40m**. If we ever register, keep the same prices for at least 12 months and absorb the VAT: on ₦24,000 we would keep ₦24,000 ÷ 1.075 = ₦22,326.
- **Rent is VAT-exempt and is not our turnover.** Contracts and invoices describe RentPadi as collection software. Only our fees and subscriptions count as RentPadi's income.
- **Company tax:** register as a **limited company**, not a business name. A small company pays 0% company income tax; a business name's profit is taxed as the founder's personal income. Get a TIN early: without one, withholding tax is doubled.

---

## 5. Billing the subscription

Nigerian specifics:

- **Recurring card charges are unreliable.** Cards expire, banks block debits, and many landlords prefer bank transfer. Offer:
  - **one-off payment for a period** (card, transfer or USSD through Paystack checkout), with renewal reminders 7 days and 1 day before expiry, by SMS and WhatsApp. **Build this first;**
  - card auto-renew through Paystack subscriptions afterwards.
- **Invoices and receipts** for subscription payments, using the same PDF writer as rent receipts, marked "VAT not charged: small business exemption".

---

## 6. Trials, lapses and switching

- **Trial:** new landlords get **30 days of Padi Plus** free, then choose a plan. Doing nothing means **Padi Free**. Before the switch, tell them what Free costs: "From [date], RentPadi will keep 1% (max ₦2,000) of rent paid online."
- **Founding landlords:** the first **30** pilot landlords get **Padi Plus free for 12 months, then half price for the next 12 months**, in exchange for feedback and referrals. Promised in writing. It rewards early trust without locking in a discount for ever.
- **When a subscription lapses:** a **7-day grace period**, with notices on day 0, 5 and 7, then automatic fallback to **Padi Free**. Never:
  - lock the landlord out of their ledger or history;
  - stop tenants from paying;
  - delete data or block the CSV export.

  Subscriber-only features pause; they don't disappear. For example, WhatsApp reminders stop, but the setting is remembered. The Padi Free fee only starts on payments made after the grace period ends.
- **Upgrading:** takes effect immediately. The RentPadi fee stops from the next checkout.
- **Downgrading:** takes effect at the end of the paid period.
- **Going over the unit limit:** warn, and let them keep working for 14 days, then ask them to upgrade. On Padi Pro, start charging ₦200 per extra unit a month instead. Never block recording or receiving a payment. A Padi Free landlord adding a 6th unit is offered Padi. A Padi landlord adding an 11th unit is offered Padi Plus.
- **Refunds:** if a rent payment is refunded, the RentPadi fee on it is refunded too.

---

## 7. Check before launch

- **Paystack (most important):**
  - Can a **dedicated virtual account** (1%, max ₦300) send each payment to the landlord's subaccount, with the landlord paying the fee? Test it in sandbox. If not, the money would land in RentPadi's account, which breaks the never-hold-rent rule. Then use Paystack checkout's bank-transfer option instead, at the normal rate, max ₦2,000.
  - Does Paystack add **VAT** on its Nigerian fees?
  - Which rate does **pay-with-transfer at checkout** use?
  - Does `bearer: "subaccount"` work with a flat `transaction_charge`?
  - Do refunds reverse the split?
  - Is the ₦50 stamp duty deducted from settlement, as Flutterwave does?
- **Flutterwave:** ask their sales team in writing whether any cap applies to Nigerian local payments on our account. Their pricing page shows 2% with no cap. Keep the Flutterwave code behind the gateway layer as a backup.
- **Meta pricing:** download Meta's official USD rate card for Nigeria. Third-party mirrors say utility $0.0067; one Nigerian outlet says $0.0101. At $0.0101 a message is ~₦16; yearly-rent margins barely move. Add a payment method in Meta Billing Hub; without one, service replies may stop.
- **Exchange rate:** costs use ₦1,500/$. Supabase and Meta bill in dollars, so a weaker naira raises costs. At ₦1,600/$ the 50-landlord profit drops by about ₦2,700 a month.
- **Tax:** ask an accountant which VAT threshold (₦50m or ₦100m) applies.
- **Legal:** ask a lawyer to confirm that a platform which only takes its own split through a licensed gateway needs no CBN licence of its own. Never add wallets, "rent savings" or escrow: those need an MMO or bank licence.
- **NYSC:** the bye-laws tell corps members not to "engage in private practice". Keep RentPadi work outside primary-assignment hours, and check before registering as a company director.
- **Lagos tenancy bill:** check whether it has passed. A cap of 1 year's advance rent would mean more frequent rent bills, which raises message costs and Padi Free income.

---

## 8. What it would take to build (sketch)

**Database:**

- `plans`: code (`padi_free | padi | padi_plus | padi_pro`), name, monthly and yearly price (kobo), unit limit, extra-unit price, platform fee % (100 basis points) and cap per rent bill (200,000 kobo), message allowances, and feature flags (jsonb).
- `landlord_subscriptions`: landlord, plan, status (`trialing | active | grace | lapsed | cancelled`), period start and end, billing method, provider reference, founding-landlord flag and discount end date.
- `subscription_payments`: the invoice and receipt ledger for what landlords pay RentPadi. Kept separate from rent payments.
- `payments.platform_fee_kobo` and `payments.gateway_fee_kobo`: the fees on each online rent payment, plus `payments.gateway` (`paystack | flutterwave`).
- `landlord_payout_accounts`: the landlord's Paystack subaccount code (and their Flutterwave one, kept as backup).
- `landlord_entitlements(landlord_id)`: one SQL function that returns the effective plan and features. It's the single source of truth for gating.
  - It handles trial, grace, lapse and founding discounts in one place.
  - RLS, `queue_reminders`, `pay-checkout` and the UI all ask it, so nothing reimplements the rules.

**Functions:**

- `pay-checkout`: gateway-neutral. Reads the landlord's entitlements and creates a Paystack transaction with the landlord's subaccount and `bearer: "subaccount"`. Sets `transaction_charge` to `min(1% × amount, ₦2,000 − fee already charged on this rent bill)` on Padi Free, and 0 on paid plans.
- `pay-webhook`: records rent payments and fees, and also handles subscription payments (extends or renews the period).
- A daily cron job: moves expired subscriptions through grace → lapsed, sends the day 0/5/7 notices, and queues renewal reminders.

**UI:**

- **Settings → Plan & billing:**
  - current plan, renewal date, and the "you'd save" card;
  - **Change plan**, with yearly shown first;
  - billing history with PDF receipts.
- **Upgrade prompts** at the point of need, e.g. turning on WhatsApp reminders on Padi Free shows "Available from Padi", and adding a caretaker shows "Available from Padi Plus".
- **Payment details** show the bank fee and the RentPadi fee on the landlord's side only. Tenants see only their rent.

**Admin (later):** a simple page for us to see subscribers, revenue, fees collected and message costs, and to grant founding-landlord pricing.

---

## 9. Open questions to answer with pilots

1. Does ₦2,400 a month feel fair to a 4–10 unit landlord in Ibadan, and ₦5,000 to a 10–25 unit landlord? Ask directly (interview question 5.3: "what would that be worth to you each month?"). If most name more, raise prices for new landlords. If most name less than ₦2,000, lower them instead of arguing with the market.
2. Do landlords prefer paying monthly, yearly, or "per rent cycle"? (Bumpa, Nigeria's best-known small-business app, has dropped monthly billing.)
3. How many Padi Free tenants actually pay online versus by transfer straight to the landlord? This decides how big the cash gap is (section 2).
4. Do tenants use the bank-transfer account, or do they prefer card? This decides whether the bank fee is ₦322.50 or ₦2,150.
5. Which features make a landlord upgrade: WhatsApp reminders, caretakers, documents, or reports?
6. Is 5 units the right limit for Padi Free?
7. Do landlords want the option to pass the card fee to tenants who choose card?
8. Is there demand from estate agents and property managers who handle several landlords? If so, consider an agent plan later (each landlord's units as a separate portfolio, with its own statements and payouts). Not in the first version.

## 10. Possible rollout order

1. **Move rent to Paystack and record fees:** create landlord subaccounts, run the section 7 sandbox tests, and add `platform_fee_kobo` and `gateway_fee_kobo` with the split at 0%. Show "RentPadi fee: ₦0 (pilot)" so landlords get used to seeing it.
2. **Plans and entitlements:** add the tables and `landlord_entitlements`, with everyone on a pilot plan. Gate one feature (WhatsApp reminders) to test the gating.
3. **Padi Free fee:** switch on the 1% split (max ₦2,000 per rent bill) for new landlords on Padi Free.
4. **Subscriptions:** one-off yearly payment first (simplest), for Padi, Padi Plus and Padi Pro. Add auto-renewing card plans afterwards.
5. **Polish:** the "you'd save" card, admin view, optional card-fee pass-through.

---

## Changes in this version

- **Moved rent payments from Flutterwave to Paystack, and made the landlord's subaccount pay the payment company's fee.** Flutterwave's official Nigeria page now shows 2% with no cap, plus 7.5% VAT: ₦64,500 on a ₦3M rent. Its split docs show that fee coming out of RentPadi's share, which would turn the old ₦7,500 Free fee into a ₦57,000 loss on that one payment. Paystack charges 1.5% + ₦100 capped at ₦2,000, or 1% capped at ₦300 on virtual accounts, and lets the subaccount bear the fee. The Flutterwave code stays as a backup, because a 2026 CBN circular may reshape payment companies in 2027.
- **Named the plans Padi Free, Padi, Padi Plus and Padi Pro** (codes `padi_free | padi | padi_plus | padi_pro`), replacing Free, Starter, Standard and Pro.
- **Cut the Free fee from 1.5% (max ₦7,500 per payment) to 1% (max ₦2,000 per rent bill).** The old cap was 3.75 times the ₦2,000 that Ledge passes on, and LandlordNG advertises 0% commission. The cap now applies per rent bill, so tenants who pay in instalments aren't charged several times.
- **Cut Free from 10 units to 5.** Competitors' free plans cover 3–5 units, and with the lower cap a Free unit earns less than a unit on Padi does.
- **Re-priced the paid plans:**
  - Padi: was Starter at ₦2,500 for 6 units; now ₦2,400 / ₦24,000 for 10 units, just under Paystack's ₦2,500 fixed-fee threshold.
  - Padi Plus: was Standard at ₦6,000 for 15 units; now ₦5,000 / ₦50,000 for 25 units.
  - Padi Pro: was ₦15,000 for 40 units + ₦300 per extra; now ₦10,000 / ₦100,000 for 50 units + ₦200 per extra.

  The old Standard and Pro cost more than Ledge (₦5k for 15 units, ₦10k for 50) and LandlordNG (₦60k a year for 30). Margins stay above 94% for yearly-rent landlords, so winning landlords matters more than price.
- **Dropped "prices include VAT".** RentPadi is under the small-company VAT threshold (₦50m in the Tax Act, ₦100m in the Administration Act; use ₦50m to be safe), so it must not charge VAT. Rent is VAT-exempt and is not RentPadi's turnover. Register as a limited company for 0% company tax.
- **Recomputed message costs** for Meta's 1 Oct 2026 changes: messages inside the 24-hour window are no longer free, and only the first 1,000 chat replies per number per month are free. SMS now costs ~₦7 (₦6.49 + VAT), not ₦5. Costs now use ₦1,500/$ instead of ₦1,600 (official rate ~₦1,357). Recommended the direct WhatsApp Cloud API and pay-as-you-go SMS, to avoid $50/month reseller fees.
- **Recomputed costs, margins, break-even and the 50-landlord example.**
  - Fixed costs: ~₦39,500 a month.
  - Break-even: 21 Padi, 10 Padi Plus or 5 Padi Pro landlords.
  - 50 landlords: ~₦99,700 a month profit (₦70,900 in the stress case).

  The old ₦170k figure assumed a capped Flutterwave fee that no longer exists.
- **Added a competitor table, a fairness table and the one-off budget.**
- **Added fairness rules:**
  - Tenants always pay exactly the rent, and bank transfer is never surcharged.
  - CSV export on every plan.
  - Fees are refunded with refunds.
  - Lapse notices before the Free fee starts.
  - An optional, later card-fee pass-through.
- **Capped founding-landlord pricing** at 30 landlords: Padi Plus free for 12 months, then half price for 12 months, instead of an open-ended "half price for life".
- **Expanded section 7** with the Paystack sandbox tests (especially whether virtual accounts can split to landlords, so RentPadi never holds rent), tax, legal and NYSC checks.
- **Kept:** four plans at most, yearly-first display, the 30-day trial, the 7-day grace period, never locking landlords out, the 14-day over-limit window, the single `landlord_entitlements` function and the rollout order. Step 1 of the rollout now includes the move to Paystack.

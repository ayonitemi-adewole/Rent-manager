import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/Logo'
import { formatDate } from '@/lib/rent'
import { SUPPORT_EMAIL, TERMS_VERSION } from '@/lib/legal'

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="motion-safe:animate-enter mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Link to="/" aria-label="RentPadi home">
        <Logo />
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">Last updated {formatDate(TERMS_VERSION)}</p>
      </header>
      <div className="space-y-6 text-sm leading-relaxed [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-2 [&_ul]:space-y-1">
        {children}
      </div>
      <p className="text-muted-foreground border-t pt-4 text-sm">
        Questions? Email{' '}
        <a className="text-primary underline underline-offset-2" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
        . See also the{' '}
        <Link className="text-primary underline underline-offset-2" to={title === 'Terms of use' ? '/privacy' : '/terms'}>
          {title === 'Terms of use' ? 'Privacy notice' : 'Terms of use'}
        </Link>
        .
      </p>
    </main>
  )
}

export function TermsPage() {
  return (
    <LegalPage title="Terms of use">
      <section>
        <h2>1. What RentPadi does</h2>
        <p>
          RentPadi helps landlords in Nigeria keep track of rent: who owes, what is due, reminders by SMS, online
          payment links and receipts. These terms apply to landlords who create an account. Tenants use their payment
          link without an account.
        </p>
      </section>
      <section>
        <h2>2. Your account</h2>
        <ul>
          <li>You sign in with your phone number and a one-time code. Keep your phone and SIM secure.</li>
          <li>Give accurate details about yourself, your properties, your tenants and the rent agreed.</li>
          <li>You are responsible for what is done from your account.</li>
        </ul>
      </section>
      <section>
        <h2>3. Your tenants’ information</h2>
        <p>
          When you add a tenant, you are the one deciding to collect and use their name and phone number. You confirm
          that you have a lawful reason to do so (your tenancy with them) and that you will let them know RentPadi
          sends rent reminders and receipts for you. RentPadi uses tenant information only to provide the service to
          you, as described in the <Link to="/privacy">Privacy notice</Link>.
        </p>
      </section>
      <section>
        <h2>4. Payments</h2>
        <ul>
          <li>
            Online payments are processed by Paystack and settle directly into the bank account you set up. RentPadi
            never holds your rent.
          </li>
          <li>Paystack’s own terms and fees apply to online payments. Its fee comes out of each payment before it reaches you.</li>
          <li>
            Payments you record yourself (cash or transfer) are your own record. Check them; receipts are issued from
            what you enter.
          </li>
          <li>Disagreements about rent are between you and your tenant.</li>
        </ul>
      </section>
      <section>
        <h2>5. Reminders</h2>
        <p>
          SMS reminders are sent on a schedule based on the rent dates you enter. Delivery depends on mobile networks
          and can be delayed or fail. A RentPadi reminder is not a legal notice (such as a notice to quit).
        </p>
      </section>
      <section>
        <h2>6. Fair use</h2>
        <p>
          Do not use RentPadi to harass anyone, to send messages unrelated to rent, or to add people who are not your
          tenants. We may suspend accounts that do.
        </p>
      </section>
      <section>
        <h2>7. Pilot service</h2>
        <p>
          RentPadi is in an early pilot. Features may change, and the service is provided “as is”. To the extent the
          law allows, RentPadi is not liable for indirect losses, such as rent not collected because a message was
          delayed.
        </p>
      </section>
      <section>
        <h2>8. Ending</h2>
        <p>
          You can stop using RentPadi at any time and ask us to delete your account. We will tell you before making
          changes to these terms that affect you, and ask you to accept them again.
        </p>
      </section>
      <section>
        <h2>9. Law</h2>
        <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>
      </section>
    </LegalPage>
  )
}

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice">
      <section>
        <h2>Who we are</h2>
        <p>
          RentPadi provides rent tracking, reminders and payment links to landlords. This notice explains what personal
          data we handle and your rights under the Nigeria Data Protection Act 2023 (NDPA).
        </p>
      </section>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Landlords:</strong> name, the name shown to tenants, phone number, email address, payout bank
            details, and the properties, units and rent you enter.
          </li>
          <li>
            <strong>Tenants</strong> (added by their landlord): name, phone number, unit, rent amount and dates, and
            payment records.
          </li>
          <li>
            <strong>Payments:</strong> amounts, dates and references. Card and bank login details are entered on
            Paystack’s page and never reach RentPadi.
          </li>
          <li>Basic technical data needed to keep the service secure, such as sign-in times.</li>
        </ul>
      </section>
      <section>
        <h2>Why we use it</h2>
        <ul>
          <li>To provide the service a landlord signed up for (contract).</li>
          <li>To send tenants the reminders and receipts their landlord set up (the landlord’s tenancy relationship).</li>
          <li>To keep payment records accurate and meet legal and tax obligations.</li>
          <li>To keep accounts secure and prevent misuse.</li>
        </ul>
        <p>We do not sell personal data or use it for advertising.</p>
      </section>
      <section>
        <h2>Landlords and tenants</h2>
        <p>
          For tenant information, the landlord decides what is collected and why; RentPadi processes it on the
          landlord’s behalf. Tenants can contact their landlord, or us, about their data.
        </p>
      </section>
      <section>
        <h2>Who we share it with</h2>
        <ul>
          <li>Supabase: secure hosting and database.</li>
          <li>Paystack: online payments and payouts to landlords.</li>
          <li>Termii: delivery of SMS codes, reminders and receipts.</li>
        </ul>
        <p>
          These providers may store data on servers outside Nigeria. We use providers that protect it with security
          measures and contractual safeguards as the NDPA requires.
        </p>
      </section>
      <section>
        <h2>How long we keep it</h2>
        <p>
          We keep data while the landlord’s account is active. Payment records may be kept for up to six years for
          accounting and tax purposes. Other data is deleted within 90 days of an account being closed.
        </p>
      </section>
      <section>
        <h2>Your rights</h2>
        <p>
          You can ask to see, correct, export or delete your data, object to how it is used, or withdraw consent. Email
          us and we will respond within 30 days. If you are not satisfied, you can complain to the Nigeria Data
          Protection Commission (NDPC).
        </p>
      </section>
      <section>
        <h2>Security</h2>
        <p>
          Data is encrypted in transit, each landlord can only see their own records, and tenant payment links are long
          random codes that a landlord can reset at any time.
        </p>
      </section>
    </LegalPage>
  )
}

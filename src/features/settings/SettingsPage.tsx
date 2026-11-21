import { ChevronRight, Compass, Landmark, LifeBuoy } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Avatar } from '@/components/Avatar'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useLandlord } from '@/features/landlord/api'
import { useTour } from '@/features/onboarding/tour-context'
import { formatNgPhone } from '@/lib/phone'
import { AppearanceCard } from './AppearanceCard'
import { ExportPaymentsCard } from './ExportPaymentsCard'
import { PlanCard } from './PlanCard'
import { WhatsappCard } from './WhatsappCard'

export function SettingsPage() {
  const { data: landlord } = useLandlord()
  const tour = useTour()
  const name = landlord?.display_name || landlord?.full_name || ''

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-7">
        {/* The profile has its own page; this row is the way there from Settings. */}
        {landlord && (
          <Link
            to="/profile"
            className="group bg-card shadow-card hover:border-primary/30 flex items-center gap-3.5 rounded-xl border border-border/80 p-4 transition-colors sm:px-5"
          >
            <Avatar name={name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{name}</span>
              <span className="text-muted-foreground block truncate text-sm">
                <span className="figure">{formatNgPhone(landlord.phone)}</span> · Your profile
              </span>
            </span>
            <ChevronRight className="text-muted-foreground size-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}

        <Group title="Payments">
          <CollapsibleCard
            id="payout"
            icon={<Landmark />}
            title="Payout account"
            description="The bank account tenants’ rent is paid into."
            status={
              landlord?.paystack_subaccount_code && landlord.account_number ? (
                `${landlord.bank_name} ••${landlord.account_number.slice(-4)}`
              ) : landlord?.account_number ? (
                <span className="text-foreground">Confirm account</span>
              ) : landlord ? (
                <span className="text-foreground">Not set up</span>
              ) : undefined
            }
            // Open while tenants can't pay online yet, and whenever the tour points here.
            defaultOpen={Boolean(landlord && !landlord.paystack_subaccount_code)}
            forceOpen={tour.active}
          >
            {landlord?.account_number ? (
              <div className="bg-muted/60 rounded-lg p-3 text-sm">
                <p className="font-semibold">{landlord.account_name}</p>
                <p className="text-muted-foreground">
                  {landlord.bank_name} · <span className="figure">••••{landlord.account_number.slice(-4)}</span>
                </p>
                {!landlord.paystack_subaccount_code && (
                  <p className="text-muted-foreground mt-2">
                    Online payments now go through Paystack. Confirm this account once so tenants can keep paying
                    online.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Not set up yet. Tenants can’t pay online until you add one.</p>
            )}
            <Button asChild variant={landlord?.paystack_subaccount_code ? 'outline' : 'default'} data-tour="payout-link">
              <Link to="/settings/payout">
                {landlord?.paystack_subaccount_code
                  ? 'Change account'
                  : landlord?.account_number
                    ? 'Confirm account'
                    : 'Set up payout account'}
              </Link>
            </Button>
          </CollapsibleCard>

          <PlanCard />
        </Group>

        <Group title="Messages and records">
          <WhatsappCard />
          <ExportPaymentsCard />
        </Group>

        <Group title="App">
          <AppearanceCard />

          <CollapsibleCard
            id="help"
            icon={<LifeBuoy />}
            title="Help"
            description="A guided tour of the app, and the terms and privacy notice."
          >
            <p className="text-muted-foreground text-sm">
              A step-by-step guide to adding properties, units, tenants and your payout account.
            </p>
            <Button variant="outline" onClick={() => tour.start()}>
              <Compass /> Show me around
            </Button>
            <p className="text-muted-foreground text-sm">
              <Link to="/terms" className="underline underline-offset-2">
                Terms
              </Link>{' '}
              ·{' '}
              <Link to="/privacy" className="underline underline-offset-2">
                Privacy
              </Link>
            </p>
          </CollapsibleCard>
        </Group>
      </div>
    </>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground px-1 text-xs font-bold tracking-wider uppercase">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

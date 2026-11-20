import { BadgeCheck, Check, Minus } from 'lucide-react'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import { QueryState } from '@/components/QueryState'
import { useEntitlements } from '@/features/plan/api'
import { planFeatures } from '@/features/plan/features'
import { cn } from '@/lib/utils'

/** The landlord's plan and what it includes. Changing plan comes with billing (PRICING.md step 4). */
export function PlanCard() {
  const { data: plan, isPending, error, refetch } = useEntitlements()

  return (
    <CollapsibleCard
      id="plan"
      icon={<BadgeCheck />}
      title="Plan"
      description="What your plan includes."
      status={plan?.plan_name}
    >
      <QueryState isPending={isPending} error={error} refetch={refetch} />
      {plan && (
        <>
          {plan.plan_code === 'pilot' ? (
            <p className="text-muted-foreground text-sm">
              You’re on the <span className="text-foreground font-semibold">pilot</span>: every feature is included,
              free, while we test RentPadi together.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              You’re on <span className="text-foreground font-semibold">{plan.plan_name}</span>.
            </p>
          )}
          <ul className="space-y-2 text-sm">
            {planFeatures(plan).map((f) => (
              <li key={f.label} className={cn('flex items-start gap-2.5', !f.included && 'text-muted-foreground')}>
                {f.included ? (
                  <Check className="text-success mt-0.5 size-4 shrink-0" />
                ) : (
                  <Minus className="mt-0.5 size-4 shrink-0" />
                )}
                <span>
                  {f.label}
                  {f.soon && <span className="text-muted-foreground"> (coming soon)</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </CollapsibleCard>
  )
}

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
                  <span className="bg-success/12 text-success mt-px grid size-4.5 shrink-0 place-items-center rounded-full">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="bg-muted mt-px grid size-4.5 shrink-0 place-items-center rounded-full">
                    <Minus className="size-3" strokeWidth={3} />
                  </span>
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

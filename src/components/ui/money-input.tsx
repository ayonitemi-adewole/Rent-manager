import * as React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** A naira amount: ₦ shown inside the field, equal-width digits. Works with register(). */
function MoneyInput({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base font-semibold"
      >
        ₦
      </span>
      <Input inputMode="decimal" className={cn('figure h-12 pl-8 text-base md:text-base', className)} {...props} />
    </div>
  )
}

export { MoneyInput }

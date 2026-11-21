import * as React from 'react'
import { cn } from '@/lib/utils'

/** A grey placeholder in the shape of what's loading. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('bg-muted rounded-md motion-safe:animate-pulse', className)}
      {...props}
    />
  )
}

export { Skeleton }

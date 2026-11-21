import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * An on/off switch built on a real checkbox, so it works with react-hook-form's register() and
 * plain onChange. The invisible checkbox covers the track and takes the taps.
 */
function Switch({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type' | 'role'>) {
  return (
    <span data-slot="switch" className={cn('relative inline-flex h-6 w-10 shrink-0', className)}>
      <input
        type="checkbox"
        role="switch"
        className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-full opacity-0 disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden="true"
        className="bg-input peer-checked:bg-primary peer-focus-visible:ring-ring/50 h-full w-full rounded-full transition-colors peer-focus-visible:ring-[3px] peer-disabled:opacity-50 motion-reduce:transition-none"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4 motion-reduce:transition-none"
      />
    </span>
  )
}

export { Switch }

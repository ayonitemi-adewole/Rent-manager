import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// Native <select>: best UX on phones (OS picker), zero JS.
// The open list is drawn by the browser/OS; we give it solid theme colours so it stays
// readable in dark mode (with `color-scheme` set in index.css).
function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          'border-input bg-background dark:bg-input/30 text-foreground h-12 w-full cursor-pointer appearance-none truncate rounded-md border px-3 pr-10 text-base shadow-xs transition-[color,box-shadow] outline-none',
          // The "Choose…" placeholder option (value="") looks like a placeholder, not a choice.
          'has-[option[value=""]:checked]:text-muted-foreground',
          // Options and group labels: solid colours, never inheriting the muted placeholder colour.
          '[&_option]:bg-popover [&_option]:text-popover-foreground [&_optgroup]:bg-popover [&_optgroup]:text-muted-foreground',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2" />
    </div>
  )
}

export { NativeSelect }

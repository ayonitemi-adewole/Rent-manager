import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const STORAGE_PREFIX = 'rentpadi-card-open:'

function readOpen(id: string): boolean | null {
  try {
    const v = localStorage.getItem(STORAGE_PREFIX + id)
    return v === null ? null : v === '1'
  } catch {
    return null
  }
}

function saveOpen(id: string, open: boolean) {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, open ? '1' : '0')
  } catch {
    // Not remembered next time; fine.
  }
}

type Props = {
  /** Remembers open/closed on this device under this name. */
  id: string
  title: ReactNode
  /** One line on what the card is for; shown under the title, open or closed. */
  description: ReactNode
  icon?: ReactNode
  /** Current state at a glance (e.g. "On", "GTBank ••1234"), shown on the right. */
  status?: ReactNode
  /** Open until the person opens or closes it themselves (e.g. something still needs doing). */
  defaultOpen?: boolean
  /** Open regardless of the person's choice (e.g. the guided tour points inside it). */
  forceOpen?: boolean
  children: ReactNode
}

/**
 * A card that folds down to its title, description and status. The content stays mounted when
 * closed (hidden), so half-filled forms keep what was typed.
 */
export function CollapsibleCard({
  id,
  title,
  description,
  icon,
  status,
  defaultOpen = false,
  forceOpen = false,
  children,
}: Props) {
  const [chosen, setChosen] = useState<boolean | null>(() => readOpen(id))
  const open = forceOpen || (chosen ?? defaultOpen)
  const regionId = useId()

  const toggle = () => {
    setChosen(!open)
    saveOpen(id, !open)
  }

  return (
    <Card className="gap-0 py-0">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={regionId}
          onClick={toggle}
          className="focus-visible:ring-ring/50 flex min-h-16 w-full items-center gap-3 rounded-xl px-5 py-4 text-left outline-none focus-visible:ring-[3px]"
        >
          {icon && <span className="text-muted-foreground shrink-0 [&_svg]:size-5">{icon}</span>}
          <span className="min-w-0 flex-1">
            <span className="block leading-tight font-semibold">{title}</span>
            <span className="text-muted-foreground mt-1 block text-sm leading-snug">{description}</span>
          </span>
          {status && !open && (
            <span className="text-muted-foreground max-w-[40%] shrink-0 truncate text-right text-xs font-medium">
              {status}
            </span>
          )}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'text-muted-foreground size-5 shrink-0 transition-transform motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
        </button>
      </h2>
      {/* Slides open/closed (grid rows 0fr ↔ 1fr animate to the content's real height). Closed content is
          inert: not focusable, not read out. */}
      <div
        id={regionId}
        role="region"
        aria-label={typeof title === 'string' ? title : undefined}
        inert={!open}
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {/* pt-1: room for focus rings at the top edge. */}
          <div
            className={cn(
              'space-y-3 px-5 pt-1 pb-5 transition-opacity duration-200 motion-reduce:transition-none',
              open ? 'opacity-100' : 'opacity-0',
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </Card>
  )
}

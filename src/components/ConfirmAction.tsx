import { TriangleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

type Props = {
  /** The button that starts the action, e.g. "Delete unit". */
  trigger: ReactNode
  /** Shown once the trigger is tapped. */
  question: string
  confirmLabel: string
  pending?: boolean
  onConfirm: () => void
  triggerVariant?: 'outline' | 'ghost' | 'secondary'
  triggerClassName?: string
}

/**
 * Two-step destructive action rendered inline. Replaces window.confirm(), which some
 * browsers and in-app webviews block (silently returning false).
 */
export function ConfirmAction({
  trigger,
  question,
  confirmLabel,
  pending,
  onConfirm,
  triggerVariant = 'outline',
  triggerClassName,
}: Props) {
  const [asking, setAsking] = useState(false)

  if (!asking) {
    return (
      <Button variant={triggerVariant} className={triggerClassName} onClick={() => setAsking(true)} disabled={pending}>
        {trigger}
      </Button>
    )
  }

  return (
    <div
      role="alertdialog"
      aria-label={question}
      className="border-destructive/20 bg-destructive/5 space-y-3 rounded-lg border p-3.5 motion-safe:animate-enter"
    >
      <p className="flex items-start gap-2.5 text-sm font-medium">
        <TriangleAlert className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {question}
      </p>
      <div className="flex gap-2 pl-6.5">
        <Button variant="destructive" size="sm" onClick={onConfirm} disabled={pending} autoFocus>
          {pending ? 'Working…' : confirmLabel}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setAsking(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

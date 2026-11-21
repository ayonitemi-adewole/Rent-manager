import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

type Props = {
  id: string
  label: string
  error?: string
  hint?: string
  children: ReactNode
}

export function Field({ id, label, error, hint, children }: Props) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-destructive flex items-start gap-1.5 text-sm">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
      )}
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="motion-safe:animate-enter border-destructive/25 bg-destructive/10 text-destructive flex items-start gap-2.5 rounded-lg border p-3 text-sm"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}

/** A group of fields on a card, with an optional heading: long forms read as a few short steps. */
export function FormSection({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return (
    // min-w-0: a fieldset otherwise grows to fit its widest content (long bank names) and overflows phones.
    <fieldset className="bg-card shadow-card min-w-0 space-y-4 rounded-xl border border-border/80 p-4 sm:p-5">
      {title && (
        <legend className="float-left mb-4 w-full">
          <span className="block font-bold">{title}</span>
          {description && <span className="text-muted-foreground mt-0.5 block text-sm">{description}</span>}
        </legend>
      )}
      {/* Clears the floated legend (floating it keeps it inside the card, unlike a default legend);
          the legend's bottom margin is the gap, as a cleared block's own top margin collapses away. */}
      <div className="clear-both mt-0! space-y-4">{children}</div>
    </fieldset>
  )
}

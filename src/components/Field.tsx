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
        <p className="text-destructive text-sm">{error}</p>
      ) : (
        hint && <p className="text-muted-foreground text-xs">{hint}</p>
      )}
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="motion-safe:animate-enter border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
      {message}
    </p>
  )
}

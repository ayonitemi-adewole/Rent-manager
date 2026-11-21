import type { ReactNode } from 'react'

/** The end of an edit page: actions that can't easily be undone (delete, move out), set apart. */
export function DangerZone({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return (
    <section className="mt-10 space-y-3 border-t border-dashed pt-6">
      {title && <h2 className="text-sm font-bold">{title}</h2>}
      {description && <p className="text-muted-foreground text-sm">{description}</p>}
      {children}
    </section>
  )
}

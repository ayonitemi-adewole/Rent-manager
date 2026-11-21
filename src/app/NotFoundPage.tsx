import { MapPinOff } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo className="mb-6" />
      <span className="bg-secondary text-primary grid size-14 -rotate-6 place-items-center rounded-2xl">
        <MapPinOff className="size-7 rotate-6" />
      </span>
      <h1 className="text-xl font-bold">Page not found</h1>
      <p className="text-muted-foreground text-sm">The link may be old, or mistyped.</p>
      <Button asChild variant="outline">
        <Link to="/">Go home</Link>
      </Button>
    </main>
  )
}

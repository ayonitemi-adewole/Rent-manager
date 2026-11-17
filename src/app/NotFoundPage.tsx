import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <h1 className="text-lg font-semibold">Page not found</h1>
      <Button asChild variant="outline">
        <Link to="/">Go home</Link>
      </Button>
    </main>
  )
}

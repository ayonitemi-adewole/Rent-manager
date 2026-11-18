import { useRouteError } from 'react-router'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'

/** A page's file failed to download: the connection dropped, or a new version replaced the old files. */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch/i.test(
    message,
  )
}

export function RouteError() {
  const error = useRouteError()
  const offline = isChunkLoadError(error)
  if (!offline) console.error(error)

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <h1 className="text-lg font-semibold">{offline ? 'This page did not load' : 'Something went wrong'}</h1>
      <p className="text-muted-foreground text-sm">
        {offline
          ? 'Check your internet connection, then try again.'
          : 'Please try again. If it keeps happening, contact RentPadi support.'}
      </p>
      <Button onClick={() => window.location.reload()}>Try again</Button>
    </main>
  )
}

import { Logo } from './Logo'

export function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <Logo />
      <div className="space-y-3 text-sm">
        <h1 className="text-lg font-semibold">Supabase is not configured yet</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env.local</code> and set{' '}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
        <p className="text-muted-foreground">
          Find both in your Supabase dashboard under Project Settings → API, then restart{' '}
          <code>npm run dev</code>. See the README for the full demo setup.
        </p>
      </div>
    </main>
  )
}

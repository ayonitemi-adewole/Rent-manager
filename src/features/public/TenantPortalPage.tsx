import { useParams } from 'react-router'
import { Logo } from '@/components/Logo'

// Phase 5: no-login tenant page. Loads data by token via a SECURITY DEFINER RPC,
// shows amount due, a Pay button (Flutterwave checkout) and past receipts.
export function TenantPortalPage() {
  const { token } = useParams()
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-4 py-10">
      <Logo />
      <p className="text-muted-foreground text-sm">
        Tenant page for link <code>{token}</code>. Coming soon.
      </p>
    </main>
  )
}

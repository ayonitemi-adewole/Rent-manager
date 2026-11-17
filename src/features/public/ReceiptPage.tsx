import { useParams } from 'react-router'
import { Logo } from '@/components/Logo'

// Week 5: printable receipt loaded by receipt token.
export function ReceiptPage() {
  const { token } = useParams()
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-4 py-10">
      <Logo />
      <p className="text-muted-foreground text-sm">
        Receipt <code>{token}</code>. Coming in Week 5.
      </p>
    </main>
  )
}

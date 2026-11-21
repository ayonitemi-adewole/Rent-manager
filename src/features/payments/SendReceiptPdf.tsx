import { useQueryClient } from '@tanstack/react-query'
import { FileDown, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { receiptFileName, receiptPdf, type Receipt } from '@/features/receipts/receipt'
import { formatKobo } from '@/lib/money'
import { NeedsAnotherTap, shareOrDownload } from '@/lib/share'
import { supabase } from '@/lib/supabase'

type State =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'ready'; file: File; text: string } // file built, waiting for a fresh tap
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string }

/**
 * Builds the receipt PDF and opens the phone's share sheet, so the landlord can pick WhatsApp
 * (or any app). Computers without file sharing download the PDF instead.
 */
export function SendReceiptPdf({ token }: { token: string }) {
  const qc = useQueryClient()
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function share(file: File, text: string) {
    try {
      const result = await shareOrDownload(file, text)
      setState(
        result === 'downloaded'
          ? { kind: 'done', message: 'PDF saved. Attach it in WhatsApp.' }
          : { kind: 'idle' },
      )
    } catch (err) {
      if (err instanceof NeedsAnotherTap) setState({ kind: 'ready', file, text })
      else setState({ kind: 'error', message: 'Could not share the PDF. Try again.' })
    }
  }

  async function prepareAndShare() {
    setState({ kind: 'working' })
    try {
      const r = await qc.fetchQuery({
        queryKey: ['receipt', token],
        queryFn: async () => {
          const { data, error } = await supabase.rpc('receipt', { p_token: token })
          if (error) throw error
          if (!data) throw new Error('Receipt not found')
          return data as unknown as Receipt
        },
      })
      const link = `${window.location.origin}/r/${token}`
      const file = new File([receiptPdf(r, link) as BlobPart], receiptFileName(r), { type: 'application/pdf' })
      const text = `Receipt ${r.receipt_number} for ${formatKobo(r.amount_kobo)}, ${r.unit_label}. From ${r.landlord_name}.`
      await share(file, text)
    } catch {
      setState({ kind: 'error', message: 'Could not make the PDF. Check your connection and try again.' })
    }
  }

  const button = 'text-primary inline-flex items-center gap-1 font-semibold hover:underline disabled:opacity-60'
  return (
    <>
      {state.kind === 'ready' ? (
        <button type="button" className={`${button} bg-secondary rounded-full px-2.5 py-1`} onClick={() => share(state.file, state.text)}>
          <FileDown className="size-3.5" /> Tap to send PDF
        </button>
      ) : (
        <button type="button" className={button} disabled={state.kind === 'working'} onClick={prepareAndShare}>
          {state.kind === 'working' ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
          Send PDF
        </button>
      )}
      {(state.kind === 'done' || state.kind === 'error') && (
        <span role="status" className={state.kind === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
          {state.message}
        </span>
      )}
    </>
  )
}

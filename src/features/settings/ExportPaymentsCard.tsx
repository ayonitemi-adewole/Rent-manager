import { useMutation } from '@tanstack/react-query'
import { Download, FileSpreadsheet } from 'lucide-react'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import { FormError } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { METHOD_LABEL } from '@/features/payments/api'
import { downloadCsv, nairaCell, toCsv } from '@/lib/csv'
import { feeBreakdown } from '@/lib/fees'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

/** Every payment across all properties as one CSV: for records, an accountant or tax. */
export function ExportPaymentsCard() {
  const exportAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('payment_overview').select('*').order('paid_at', { ascending: true })
      if (error) throw error
      const csv = toCsv(
        [
          'Date paid',
          'Receipt',
          'Tenant',
          'Unit',
          'Property',
          'Period start',
          'Period end',
          'Method',
          'Amount (NGN)',
          'Payment company fee (NGN)',
          'RentPadi fee (NGN)',
          'To your bank (NGN)',
          'Status',
          'Note',
        ],
        data.map((p) => {
          // Blank for cash, transfers and older payments whose fee was never reported.
          const fees = feeBreakdown(p)
          return [
            p.paid_at?.slice(0, 10),
            p.receipt_number,
            p.tenant_name,
            p.unit_label,
            p.property_name,
            p.period_start,
            p.period_end,
            METHOD_LABEL[p.method ?? ''] ?? p.method,
            nairaCell(p.amount_kobo ?? 0),
            fees && nairaCell(fees.gatewayFeeKobo),
            fees && nairaCell(fees.platformFeeKobo),
            fees && nairaCell(fees.toBankKobo),
            p.voided_at ? `Voided: ${p.void_reason ?? ''}` : 'Valid',
            p.note,
          ]
        }),
      )
      downloadCsv(`rentpadi-payments-${new Date().toISOString().slice(0, 10)}.csv`, csv)
    },
  })

  return (
    <CollapsibleCard
      id="export"
      icon={<FileSpreadsheet />}
      title="Export"
      description="Download every payment as a spreadsheet, for your records or accountant."
    >
      <p className="text-muted-foreground text-sm">
        All payments across your properties, as a CSV file that opens in Excel or Google Sheets.
      </p>
      <FormError message={exportAll.error ? friendlyError(exportAll.error) : null} />
      <Button variant="outline" onClick={() => exportAll.mutate()} disabled={exportAll.isPending}>
        <Download /> {exportAll.isPending ? 'Preparing…' : 'Download payments CSV'}
      </Button>
    </CollapsibleCard>
  )
}

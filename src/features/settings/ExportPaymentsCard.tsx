import { useMutation } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { FormError } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { METHOD_LABEL } from '@/features/payments/api'
import { downloadCsv, nairaCell, toCsv } from '@/lib/csv'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

/** Every payment across all properties as one CSV: for records, an accountant or tax. */
export function ExportPaymentsCard() {
  const exportAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('payment_overview')
        .select('*')
        .order('paid_at', { ascending: true })
      if (error) throw error
      const csv = toCsv(
        ['Date paid', 'Receipt', 'Tenant', 'Unit', 'Property', 'Period start', 'Period end', 'Method', 'Amount (NGN)', 'Status', 'Note'],
        data.map((p) => [
          p.paid_at?.slice(0, 10),
          p.receipt_number,
          p.tenant_name,
          p.unit_label,
          p.property_name,
          p.period_start,
          p.period_end,
          METHOD_LABEL[p.method ?? ''] ?? p.method,
          nairaCell(p.amount_kobo ?? 0),
          p.voided_at ? `Voided: ${p.void_reason ?? ''}` : 'Valid',
          p.note,
        ]),
      )
      downloadCsv(`rentpadi-payments-${new Date().toISOString().slice(0, 10)}.csv`, csv)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export</CardTitle>
        <CardDescription>All payments as a spreadsheet (CSV), for your records or accountant.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <FormError message={exportAll.error ? friendlyError(exportAll.error) : null} />
        <Button variant="outline" onClick={() => exportAll.mutate()} disabled={exportAll.isPending}>
          <Download /> {exportAll.isPending ? 'Preparing…' : 'Download payments CSV'}
        </Button>
      </CardContent>
    </Card>
  )
}

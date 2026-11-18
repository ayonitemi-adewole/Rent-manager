import { receiptRows as sharedRows, type Receipt } from '@shared/receipt-pdf.ts'
import { formatKobo } from '@/lib/money'

// The receipt layout lives in supabase/functions/_shared so WhatsApp sends the same PDF.
export { receiptFileName, receiptPdf, RECEIPT_METHOD, type Receipt } from '@shared/receipt-pdf.ts'

/** Rows for the web receipt, with ₦ amounts. */
export const receiptRows = (r: Receipt) => sharedRows(r, formatKobo)

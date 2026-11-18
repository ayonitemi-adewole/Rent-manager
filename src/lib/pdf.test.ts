import { describe, expect, it } from 'vitest'
import { receiptPdf, type Receipt } from '@/features/receipts/receipt'
import { PdfPage, pdfString, wrap } from './pdf'

const decode = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes)

describe('pdfString', () => {
  it('escapes PDF syntax characters', () => {
    expect(pdfString(String.raw`Flat (2) \ back`)).toBe(String.raw`Flat \(2\) \\ back`)
  })
  it('maps punctuation to the font encoding', () => {
    expect(pdfString('1 Dec – 30 Dec · Mama’s')).toBe(String.raw`1 Dec \226 30 Dec \267 Mama\222s`)
  })
  it('drops Yoruba accents to the base letter and replaces the rest', () => {
    expect(pdfString('Ọlá Ṣẹ́gun')).toBe(String.raw`Ol\341 Segun`)
    expect(pdfString('₦5 🏠')).toBe('N5 ?')
  })
})

describe('PdfPage', () => {
  it('writes a valid cross-reference table', () => {
    const page = new PdfPage(200, 100)
    page.text(10, 20, 'Hello')
    const pdf = decode(page.toBytes('Test'))
    expect(pdf.startsWith('%PDF-1.4')).toBe(true)
    const startxref = Number(/startxref\n(\d+)/.exec(pdf)![1])
    expect(pdf.slice(startxref, startxref + 4)).toBe('xref')
    const offsets = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]))
    expect(offsets).toHaveLength(7)
    offsets.forEach((o, i) => expect(pdf.slice(o).startsWith(`${i + 1} 0 obj\n`)).toBe(true))
    // Text is placed from the top: y = 100 - 20.
    expect(pdf).toContain('10 80 Td (Hello) Tj')
  })
})

describe('wrap', () => {
  it('breaks on words', () => {
    expect(wrap('12 Ring Road, Bodija, Ibadan, Oyo State', 16)).toEqual(['12 Ring Road,', 'Bodija, Ibadan,', 'Oyo State'])
  })
})

const receipt: Receipt = {
  receipt_number: 'RP-0007',
  amount_kobo: 40_000_00,
  method: 'link',
  paid_at: '2026-11-17T10:00:00Z',
  voided: false,
  tenant_name: 'Mama Buka',
  unit_label: 'Shop 1',
  property_name: 'Ring Road shops',
  property_address: null,
  landlord_name: 'Adewole Properties',
  period_start: '2026-11-17',
  period_end: '2026-12-16',
  charge_amount_kobo: 40_000_00,
  balance_after_kobo: 0,
}

describe('receiptPdf', () => {
  it('contains the receipt details, ASCII only', () => {
    const bytes = receiptPdf(receipt, 'https://rentpadi.app/r/abc')
    expect(bytes.every((b) => b < 128)).toBe(true)
    const pdf = decode(bytes)
    for (const text of [
      'Receipt RP-0007',
      'NGN 40,000',
      'Mama Buka',
      'Adewole Properties',
      'Fully paid',
      'https://rentpadi.app/r/abc',
    ]) {
      expect(pdf).toContain(text)
    }
    expect(pdf).not.toContain('VOID')
  })
  it('stamps voided receipts', () => {
    expect(decode(receiptPdf({ ...receipt, voided: true }, 'x'))).toContain('(VOID)')
  })
})

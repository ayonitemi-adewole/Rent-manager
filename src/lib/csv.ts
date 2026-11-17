type Cell = string | number | null | undefined

/** One CSV field: quoted when needed, and guarded against spreadsheet formula injection. */
function field(value: Cell): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  // A cell starting with = + - @ is run as a formula by Excel/Sheets. Numbers are left alone.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(field).join(',')).join('\r\n') + '\r\n'
}

/** Save a CSV file in the browser. The BOM makes Excel read ₦ and accents correctly. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Kobo as a plain naira number for spreadsheets: 35000050 → "350000.50". */
export const nairaCell = (kobo: number) => (kobo / 100).toFixed(2)

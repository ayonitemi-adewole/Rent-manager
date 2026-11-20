// All money is stored and computed as integer kobo (₦1 = 100 kobo).
// Only convert to naira at the edges: display and form input.

const formatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** 35000000 → "₦350,000" ; 35000050 → "₦350,000.5" */
export function formatKobo(kobo: number): string {
  return formatter.format(kobo / 100)
}

const exactFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** For fees, where kobo matter: 32250 → "₦322.50" ; 100000 → "₦1,000" (whole naira stay short). */
export function formatKoboExact(kobo: number): string {
  return kobo % 100 === 0 ? formatKobo(kobo) : exactFormatter.format(kobo / 100)
}

/** Parse what a user typed ("350,000", "₦350000.50", " 1500 ") into kobo. Returns null if invalid. */
export function parseNairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, '').replace(/^NGN/i, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const [whole, frac = ''] = cleaned.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}

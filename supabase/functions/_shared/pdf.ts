// A tiny single-page PDF writer for receipts: text, lines and rectangles in the built-in
// Helvetica fonts. No library: keeps the app small for slow connections.
// Shared by the web app and edge functions: plain TypeScript, no Deno or DOM APIs.
// Coordinates are in points (1/72 inch) measured from the TOP-left, unlike raw PDF.

export type Rgb = [number, number, number]
type TextOptions = { size?: number; bold?: boolean; color?: Rgb }

const BLACK: Rgb = [0, 0, 0]

// Characters the built-in fonts (WinAnsiEncoding) have outside plain ASCII.
const WIN_ANSI: Record<string, number> = {
  '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94,
  '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99,
}

/**
 * Text → PDF string literal body. Accents that the fonts lack (Yoruba ọ, ṣ, ẹ…) are dropped to the
 * base letter; ₦ becomes N; anything else unsupported becomes "?". Output is pure ASCII.
 */
export function pdfString(text: string): string {
  let out = ''
  for (const ch of text.replace(/₦/g, 'N').normalize('NFC')) {
    const code = ch.codePointAt(0)!
    if (code >= 0x300 && code <= 0x36f) continue // a loose accent mark (e.g. on ẹ́): drop it
    if (code >= 32 && code <= 126) {
      out += ch === '(' || ch === ')' || ch === '\\' ? `\\${ch}` : ch
    } else if (WIN_ANSI[ch] !== undefined) {
      out += `\\${WIN_ANSI[ch].toString(8)}`
    } else if (code >= 160 && code <= 255) {
      out += `\\${code.toString(8)}` // Latin-1 matches WinAnsi here (é, ü, ·, ©…)
    } else {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
      out += base && base !== ch && /^[ -~]+$/.test(base) ? base : '?'
    }
  }
  return out
}

const num = (v: number) => (Math.round(v * 100) / 100).toString()
const rgb = ([r, g, b]: Rgb) => `${num(r)} ${num(g)} ${num(b)}`

/** "#1f8a55" → [0.12, 0.54, 0.33] */
export const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb

export class PdfPage {
  private ops: string[] = []
  readonly width: number
  readonly height: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }

  text(x: number, top: number, text: string, { size = 10, bold = false, color = BLACK }: TextOptions = {}) {
    // `top` is the text baseline measured from the top of the page.
    this.ops.push(
      `BT /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${rgb(color)} rg ${num(x)} ${num(this.height - top)} Td (${pdfString(text)}) Tj ET`,
    )
  }

  rect(x: number, top: number, w: number, h: number, opts: { fill?: Rgb; stroke?: Rgb; lineWidth?: number }) {
    const y = this.height - top - h
    if (opts.fill) this.ops.push(`${rgb(opts.fill)} rg ${num(x)} ${num(y)} ${num(w)} ${num(h)} re f`)
    if (opts.stroke) {
      this.ops.push(`${num(opts.lineWidth ?? 1)} w ${rgb(opts.stroke)} RG ${num(x)} ${num(y)} ${num(w)} ${num(h)} re S`)
    }
  }

  line(x1: number, top1: number, x2: number, top2: number, color: Rgb, width = 0.5) {
    this.ops.push(
      `${num(width)} w ${rgb(color)} RG ${num(x1)} ${num(this.height - top1)} m ${num(x2)} ${num(this.height - top2)} l S`,
    )
  }

  /** Serialise to a complete PDF file. */
  toBytes(title: string): Uint8Array {
    const content = this.ops.join('\n')
    const font = (name: string) => `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(this.width)} ${num(this.height)}] ` +
        '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      font('Helvetica'),
      font('Helvetica-Bold'),
      `<< /Title (${pdfString(title)}) /Producer (RentPadi) >>`,
    ]

    let out = '%PDF-1.4\n'
    const offsets: number[] = []
    objects.forEach((body, i) => {
      offsets.push(out.length) // everything is ASCII, so characters = bytes
      out += `${i + 1} 0 obj\n${body}\nendobj\n`
    })
    const xref = out.length
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`
    return new TextEncoder().encode(out)
  }
}

/** Split text into lines of at most `maxChars` (Helvetica averages ~0.55 × font size per character). */
export function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + ' ' + word).length > maxChars) {
      lines.push(line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

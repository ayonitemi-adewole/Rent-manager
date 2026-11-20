// Builds RentPadi's marketing website: plain HTML pages + one stylesheet + one small script.
//
//   node website/build.ts            → website/dist/
//   node website/build.ts --serve    → build, then preview on http://localhost:4321
//
// No dependencies. Pages live in website/src/pages/*.html and start with a meta comment:
//   <!--meta {"title": "…", "description": "…", "nav": "pricing"} -->
// They are wrapped in website/src/layout.html. Tokens like {{APP_URL}} are filled in below;
// a token left unfilled fails the build, so typos never ship.
//
// Settings (environment variables, all optional):
//   SITE_URL         where this website lives        (default https://rentpadi.app)
//   APP_URL          where the landlord app lives     (default https://rent-padi.vercel.app)
//   WHATSAPP_NUMBER  RentPadi's WhatsApp, E.164       (default none: WhatsApp links are left out)

import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, resolve } from 'node:path'
import { BRAND, MARK, markSvg, ON_GREEN, ON_LIGHT } from '../src/components/brand-mark.ts'

const here = import.meta.dirname
const repo = resolve(here, '..')
const src = join(here, 'src')
const dist = join(here, 'dist')

const SITE_URL = (process.env.SITE_URL ?? 'https://rentpadi.app').replace(/\/+$/, '')
const APP_URL = (process.env.APP_URL ?? 'https://rent-padi.vercel.app').replace(/\/+$/, '')
const SUPPORT_EMAIL = 'support@rentpadi.app'
const WHATSAPP_DIGITS = (process.env.WHATSAPP_NUMBER ?? '').replace(/\D/g, '')

type PageMeta = {
  title: string
  description: string
  /** Which header link is the current page. */
  nav?: string
  /** Extra markup for <head>, e.g. JSON-LD. */
  head?: string
  /** Leave out of sitemap.xml (404). */
  noindex?: boolean
}

const read = (path: string) => readFileSync(path, 'utf8')
const escapeAttr = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const hash = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 8)

/** The mark, cropped to its bounds, at a given CSS size. */
function mark(size: number, colors: typeof ON_LIGHT, detail: 'full' | 'medium' = 'medium') {
  const h = Math.round((size * 160) / 172)
  return `<svg class="mark" width="${size}" height="${h}" viewBox="${MARK.cropViewBox}" aria-hidden="true">${markSvg(detail, colors)}</svg>`
}

function build() {
  rmSync(dist, { recursive: true, force: true })
  mkdirSync(dist, { recursive: true })

  // Assets, with a content hash on the URL so browsers never keep a stale stylesheet.
  cpSync(join(src, 'assets'), join(dist, 'assets'), { recursive: true })
  const cssVersion = hash(read(join(src, 'assets', 'site.css')))
  const jsVersion = hash(read(join(src, 'assets', 'site.js')))

  // Icons and the link-preview image come from the app's public/ folder (one source of truth).
  for (const file of ['favicon.svg', 'apple-touch-icon.png', 'og-image.png', 'icon-192.png', 'icon-512.png']) {
    cpSync(join(repo, 'public', file), join(dist, file))
  }

  const layout = read(join(src, 'layout.html'))
  const partials: Record<string, string> = {}
  for (const file of readdirSync(join(src, 'partials'))) {
    partials[file.replace(/\.html$/, '')] = read(join(src, 'partials', file))
  }

  const tokens: Record<string, string> = {
    SITE_URL,
    APP_URL,
    SIGNUP_URL: `${APP_URL}/login`,
    LOGIN_URL: `${APP_URL}/login`,
    TERMS_URL: `${APP_URL}/terms`,
    PRIVACY_URL: `${APP_URL}/privacy`,
    SUPPORT_EMAIL,
    WHATSAPP_URL: WHATSAPP_DIGITS ? `https://wa.me/${WHATSAPP_DIGITS}` : '',
    YEAR: String(new Date().getFullYear()),
    CSS_VERSION: cssVersion,
    JS_VERSION: jsVersion,
    BRAND_GREEN: BRAND.green,
    MARK: mark(30, ON_LIGHT),
    MARK_ON_GREEN: mark(30, ON_GREEN),
    MARK_LARGE: mark(120, ON_LIGHT, 'full'),
    MARK_ON_GREEN_LARGE: mark(150, ON_GREEN, 'full'),
  }

  const sitemap: string[] = []
  const pages = readdirSync(join(src, 'pages')).filter((f) => f.endsWith('.html'))

  for (const file of pages) {
    const name = file.replace(/\.html$/, '')
    const raw = read(join(src, 'pages', file))
    const metaMatch = raw.match(/^<!--meta\s+([\s\S]*?)-->\s*/)
    if (!metaMatch) throw new Error(`${file}: missing <!--meta {...} --> at the top`)
    const meta = JSON.parse(metaMatch[1]) as PageMeta
    const body = raw.slice(metaMatch[0].length)

    // index → /, 404 → /404.html, everything else → /name/ (clean URLs on any static host).
    const path = name === 'index' ? '/' : name === '404' ? '/404.html' : `/${name}/`
    const outFile = name === 'index' || name === '404' ? join(dist, `${name}.html`) : join(dist, name, 'index.html')

    // Replacements use functions so a "$" in page text is never read as a replacement pattern.
    const pageTokens: Record<string, string> = {
      title: escapeAttr(meta.title),
      description: escapeAttr(meta.description),
      canonical: SITE_URL + (name === '404' ? '/' : path),
      head: meta.head ?? '',
      robots: meta.noindex ? 'noindex' : 'index, follow',
    }
    let html = layout
      .replace('{{content}}', () => body)
      .replace(/\{\{include:(\w+)\}\}/g, (_, p: string) => {
        if (!(p in partials)) throw new Error(`${file}: unknown partial "${p}"`)
        return partials[p]
      })
      .replace(/\{\{(title|description|canonical|head|robots)\}\}/g, (_, key: string) => pageTokens[key])

    // <!--if:WHATSAPP--> … <!--endif--> only appears when a WhatsApp number is set.
    html = html.replace(/<!--if:WHATSAPP-->([\s\S]*?)<!--endif-->/g, (_, inner: string) => (WHATSAPP_DIGITS ? inner : ''))

    html = html.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key: string) => (key in tokens ? tokens[key] : whole))

    if (meta.nav) {
      html = html.replaceAll(`data-nav="${meta.nav}"`, `data-nav="${meta.nav}" aria-current="page"`)
    }

    const leftover = html.match(/\{\{[^}]+\}\}/)
    if (leftover) throw new Error(`${file}: unfilled token ${leftover[0]}`)

    mkdirSync(dirname(outFile), { recursive: true })
    writeFileSync(outFile, html)
    if (!meta.noindex) sitemap.push(SITE_URL + path)
  }

  writeFileSync(
    join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      sitemap.map((loc) => `  <url><loc>${loc}</loc></url>`).join('\n') +
      `\n</urlset>\n`,
  )
  writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`)

  console.log(`Built ${pages.length} pages → ${dist}`)
  if (!WHATSAPP_DIGITS) console.log('  (no WHATSAPP_NUMBER set: WhatsApp contact links left out)')
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
}

/** A tiny preview server that behaves like Cloudflare Pages / Vercel: /pricing/ → pricing/index.html. */
function serve(port = 4321) {
  createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0])
    let file = join(dist, url)
    if (!file.startsWith(dist)) {
      res.writeHead(403).end()
      return
    }
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!url.endsWith('/')) {
        res.writeHead(301, { Location: url + '/' }).end()
        return
      }
      file = join(file, 'index.html')
    }
    const found = existsSync(file)
    const body = readFileSync(found ? file : join(dist, '404.html'))
    res.writeHead(found ? 200 : 404, { 'Content-Type': TYPES[extname(found ? file : '.html')] ?? 'application/octet-stream' })
    res.end(body)
  }).listen(port, () => console.log(`Preview: http://localhost:${port}`))
}

build()
if (process.argv.includes('--serve')) serve()

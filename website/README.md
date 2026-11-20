# RentPadi website

The public marketing site (rentpadi.app). It's separate from the landlord app in `src/`: plain HTML pages, one stylesheet and one small script, with no dependencies and no framework. It stays fast on slow connections and works without JavaScript.

```sh
npm run site:dev     # build, then preview on http://localhost:4321
npm run site:build   # build to website/dist/
```

Re-run `site:dev` after editing; it rebuilds once on start.

## Pages

| Page | File | URL |
| --- | --- | --- |
| Home | `src/pages/index.html` | `/` |
| Features | `src/pages/features.html` | `/features/` |
| Pricing (plans, cost calculator, comparison) | `src/pages/pricing.html` | `/pricing/` |
| For tenants (paying, WhatsApp, scam check) | `src/pages/tenants.html` | `/tenants/` |
| Security and trust | `src/pages/security.html` | `/security/` |
| FAQ | `src/pages/faq.html` | `/faq/` |
| About | `src/pages/about.html` | `/about/` |
| Contact and founding landlords | `src/pages/contact.html` | `/contact/` |
| Not found | `src/pages/404.html` | `/404.html` |

Terms and Privacy link to the app's own `/terms` and `/privacy` pages, so there is one copy of each.

## How it's built

`build.ts` wraps each page in `src/layout.html` with the header, footer and icon sprite from `src/partials/`, fills in `{{TOKENS}}`, and writes `dist/<page>/index.html`. It also writes `sitemap.xml` and `robots.txt`. Each page starts with its title and description:

```html
<!--meta {"title": "…", "description": "…", "nav": "pricing"} -->
```

- **The logo** comes from `src/components/brand-mark.ts`, the same source as the app. Icons and the link-preview image are copied from `public/`.
- **A token left unfilled fails the build**, so a typo never ships.
- **Wrap WhatsApp-only markup in `<!--if:WHATSAPP-->…<!--endif-->`.** It appears only when `WHATSAPP_NUMBER` is set.
- **Prices live in the HTML** (`pricing.html`, and the teaser on `index.html`) **and in the calculator in `src/assets/site.js`.** Change all three together, and keep them in line with `docs/PRICING.md`.

## Settings

| Variable | Default | What it's for |
| --- | --- | --- |
| `SITE_URL` | `https://rentpadi-web.pages.dev` | Canonical URLs, sitemap, link previews. Set to the custom domain once there is one |
| `APP_URL` | `https://rent-padi.vercel.app` | "Start free" and "Log in" buttons, Terms and Privacy links |
| `SUPPORT_EMAIL` | `rentpadiii@gmail.com` | Contact links, the contact form and the founding-landlord button. The build fails if it isn't an email address. Keep it the same as the app's `VITE_SUPPORT_EMAIL` |
| `WHATSAPP_NUMBER` | none | RentPadi's WhatsApp (E.164). Turns on the WhatsApp contact links |

Changing a setting in Cloudflare only takes effect on the next build: redeploy after changing it.

## Deploying (Cloudflare Pages, free)

Create a Pages project from this repo with:

- **Build command:** `node website/build.ts`
- **Build output directory:** `website/dist`
- **Environment variables:** the settings above, as needed. Use Node 24 or newer (`NODE_VERSION=24`), since the build script is TypeScript run directly by Node.

Clean URLs (`/pricing/`) and `404.html` work on Cloudflare Pages, Netlify and Vercel with no extra config.

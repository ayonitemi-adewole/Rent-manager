# RentPadi brand

The mark is **an open palm receiving a naira coin**: rent arriving, in the landlord's hand. The name is set as **Rent Padi** (two words in the logo; one word, *RentPadi*, in running text).

![RentPadi logo](brand/logo.png)

## Colours

| Name | Hex | Used for |
| --- | --- | --- |
| **Padi Green** | `#0F5132` | The brand colour: the hand, the name, buttons, the app icon tile |
| **Naira Gold** | `#F4B23E` | The coin (ring `#D8901C`) |
| **Deep Green** | `#0A3A24` | The cuff on light backgrounds; text on cream |
| **Mint** | `#8CC5A5` | The cuff on green or dark backgrounds |
| **Cream** | `#F6F4EE` | Light backgrounds: the app's page colour (cards sit on it in white), link previews, the install splash |

In the app these are CSS variables in `src/index.css` (`--primary` is Padi Green in light mode; `--gold` is Naira Gold, used for the call to action on green surfaces; `--sidebar` is the green navigation rail; `--logo-*` switch the logo for dark mode) and constants in `src/components/brand-mark.ts`.

Status colours stay separate from the brand: green = paid, amber = due, red = overdue.

## Type

- **Logo:** Plus Jakarta Sans. *Rent* in Medium (500), *Padi* in ExtraBold (800), tracking −2.5%. The app loads only the letters of "RentPadi" from Google Fonts (`&text=RentPadi`), a few kilobytes.
- **Everything else:** Inter.
- **Amounts:** the `Money` component (`src/components/Money.tsx`) sets the ₦ a little smaller than the figure, so the number reads first.

## The mark at different sizes

The mark drops detail as it shrinks, so it stays readable:

| Size | What's drawn |
| --- | --- |
| 64 px and up | Everything: cuff, hand, coin with inner ring, ₦, three "falling" lines |
| 32–63 px | No falling lines or ring; thicker ₦ |
| Under 32 px | Hand and cuff as one shape, a bigger plain coin (favicon) |

Colour versions: on light (green hand, deep green cuff), on green or dark (white hand, mint cuff), and one colour (everything in one colour with the ₦ knocked out).

## In the code

```tsx
import { AppIcon, Logo, LogoMark, Wordmark } from '@/components/Logo'

<Logo />                // mark + name, follows light/dark mode (sizes: sm, md, lg)
<Logo tone="onBrand" /> // on a Padi Green background
<LogoMark size={24} />  // the mark alone; detail picked from the size
<AppIcon size={48} />   // the mark on the green tile
```

## Files

Generated from the shapes in `src/components/brand-mark.ts` by:

```sh
node scripts/generate-brand-assets.ts
```

(The PNGs need Edge or Chrome; set `BROWSER` to its path if it isn't found.)

| File | For |
| --- | --- |
| `public/favicon.svg` | Browser tab |
| `public/icon.svg` | Loading screen |
| `public/apple-touch-icon.png` | iPhone home screen (180×180) |
| `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png` | Android home screen / install (`public/site.webmanifest`) |
| `public/og-image.png` | Link previews when RentPadi links are shared on WhatsApp (1200×630). Needs `VITE_APP_URL` set at build time for an absolute URL. |
| `docs/brand/whatsapp-profile.png` | WhatsApp Business profile photo (640×640; the mark stays inside WhatsApp's circle crop) |
| `docs/brand/logo.png`, `docs/brand/logo-on-green.png` | Documents, slides, partners |
| `docs/brand/mark.svg`, `docs/brand/app-icon.svg` | Print and design tools |

## Don't

- Recolour the coin or put the mark on busy photos.
- Stretch, rotate or outline it.
- Set the name in another font, or as "RENTPADI" / "Rentpadi".

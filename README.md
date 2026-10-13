# ringback
Website and client portal for Ringback, an AI phone receptionist for home-service trades in Gauteng.
Plain HTML, one shared stylesheet and vanilla JavaScript. There is no build step and no npm dependency:
what is in this folder is exactly what gets served.

## Running locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000/. Any static server works. `404.html` uses `<base href="/ringback/">` so that
GitHub Pages can serve it at any missing path; to try it locally, serve the parent folder and open
http://localhost:8000/ringback/404.html.

Files at a glance:

| File | What it is |
| --- | --- |
| `site.css` | Tokens, media tiers, components, nav, footer and the inner pages. Every page loads it. |
| `home.css` | Home-only styles (hero console, ledger, bento, trade tiles, live demo). `index.html` only. |
| `app.css` | Login, portal, admin and invoice styles. Loaded after `site.css` on `body[data-app]` pages only. |
| `config.js` | Public settings: contact details, Supabase and Vapi public keys, audio, founder card. |
| `site.js` | The shared script: header, menu, action bar, footer, icons, trade data and the `RB.*` API below. |
| `home.js`, `pricing.js`, `faq.js`, `forward.js`, `trades.js`, `contact.js` | Page scripts. |
| `auth.js`, `portal.js`, `admin.js`, `invoice.js` | Login and the client portal (they need supabase-js). |
| `fonts/` | Self-hosted latin subsets: Bricolage Grotesque (opsz 48, wdth 75-100), Geist, Geist Mono. |

## Page head template

Every page follows the same head and script order. Marketing pages:

```html
<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Page Name · Ringback</title>
<meta name="description" content="…">
<meta property="og:title" content="Page Name · Ringback">
<meta property="og:description" content="…">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Ringback">
<link rel="canonical" href="https://aerhq3e4r5h.github.io/ringback/page.html">
<meta property="og:url" content="https://aerhq3e4r5h.github.io/ringback/page.html">
<meta property="og:image" content="https://aerhq3e4r5h.github.io/ringback/og/home.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="…">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#07100F">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preload" href="fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/bricolage.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="site.css">
</head>
<body data-page="page">
<a class="skip" href="#main">Skip to content</a>
<header id="site-header"></header>
<main id="main">
  …
</main>
<footer id="site-footer"></footer>
<script src="config.js" defer></script>
<script src="site.js" defer></script>
<script src="page.js" defer></script>
</body>
</html>
```

- Fonts: no Google Fonts. Only Geist and Bricolage are preloaded; Geist Mono loads when first used.
- Scripts: all `defer`, always in this order: `config.js`, `site.js`, then supabase-js
  (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js`, only where needed), `auth.js`,
  then the page script. `product.html` and `dashboard.html` load `forward.js` before their page script.
- The skip link is the first element in `<body>`, and every page's `<main>` has `id="main"`.
- og:image is `og/home.png` for index, about, faq, contact, privacy and terms; `og/pricing.png`, `og/product.png` and
  `og/trades.png` for those pages.
- App pages (login, dashboard, admin, invoice) add `<link rel="stylesheet" href="app.css">` after `site.css` and put
  `data-app` on `<body>`. They get a slim header and a bottom-bar footer, and no action bar.
- JS-driven forms carry `onsubmit="return false"`, so a tap before the scripts arrive never puts fields in the URL.
- Inline `style` attributes are only used for CSS custom properties (`style="--h:50%"`).
- Inner-page heroes: `<section class="phero">` (left), `phero--center`, `phero--split` (with an empty
  `<div class="phero-art" aria-hidden="true"></div>` beside `.phero-copy`) or `phero--doc` (legal, with a `.phero-meta` line).

Design rules live in the header comment of `site.css`: when ember may be used, the COMPACT / SHORT / RICH media queries
(copy them verbatim; `RB.mq.compact` and `RB.mq.rich` in JS), and the motion tiers.

## Shared JS API and data contracts

`site.js` is loaded on every page and exposes `window.RB`. Other scripts build only on these names (the same list is
at the top of `site.js`).

**Tiers**
- `RB.mq.compact`, `RB.mq.rich`: MediaQueryLists for the COMPACT and RICH queries. `RB.rich`, `RB.reduced`: read at load.
- `RB.lite`: `saveData` or a slow-2g/2g/3g connection. No autoplay, static marquee, no preloading, audio `preload=none`.

**Loading**
- `RB.loadScript(src)` → Promise, cached per src, rejects on a load error (a later call retries).
- `RB.loadAI()` → Promise of the `<vapi-widget>`: resolves when the launcher renders, rejects on error or after 12 s.
- `RB.openAI(btn?)`: opens the assistant, loading it first ("Connecting to the assistant…"); if it can't, a sheet
  offers WhatsApp and Call. Never preloaded on phones.
- Click hooks: `[data-open-ai]` → `RB.openAI(el)`. `[data-setup-call]` (with `data-source`) → loads `setupcall.js` and
  calls `RB.openSetupCall({source, trade})`, else follows its `href` (`contact.html#message`). `[data-search]`,
  Ctrl/Cmd+K and `/` (fine pointers only, not in fields, not on faq.html) → `search.js` and `RB.openSearch()`, else faq.html.

**UI**
- `RB.sheet({label, html, size:'sm'|'md'|'full', onClose})` → `{el, body, close}`: a `.rb-sheet` dialog, centred
  (440/640/900 px) on desktop and a bottom sheet under COMPACT (`full` = 100dvh). Focus trap, Esc, backdrop, focus
  restore, inert page.
- `RB.spy(nav, {offset, axis:'x'|'y'})` → `{refresh}`: scrollspy over the nav's `#anchor` links; sets
  `aria-current="true"` and `.is-active`, and `--ind-x/--ind-w` (x) or `--ind-y/--ind-h` (y) on the nav.
- `RB.seg(el)`: syncs a `.seg` thumb (`--n`, `--i`, `data-i`) from `aria-pressed`, `aria-selected` or `checked`.
- `RB.toast(msg, 'ok'|'err'|'warn')`, `RB.icon(id)`, `RB.splitWords(h)`, `RB.copy(text, btn?)`, `RB.esc(s)`,
  `RB.wa(text, toAnyone?)`, `RB.rand(n)`, `RB.money(cents)`, `RB.loggedIn()`.

**Data**
- `RB.TRADES`, `RB.tradeByKey(k)`, `RB.tradesInOrder()`, `RB.getTrade()`, `RB.setTrade(k|null)` (fires `rb:trade`),
  `RB.applyTrade()`, `RB.tradeSelect(id, cls)`.
- `RB.PLANS` (cents, excl. VAT) and `RB.EXTRA_MIN_CENTS` (500, one extra minute).
- `RB.callAudio(trade, {mount, lines, onPlay, onEnd})` → `{audio, destroy}`: only for keys listed in `config.audio`.
- `RB.lead(row)` → `Promise<boolean>`, never throws. Inserts into the Supabase `leads` table through supabase-js
  (`RB.sb`, or its own client), with an 8 s timeout. Columns: name, business, trade, area, phone, email, message,
  source, trimmed and capped at 120/120/60/120/30/200/2000 characters; ` · Ref: CODE` is appended to message when a
  referral code is stored. Sources: `contact`, `signup_fallback`, `setup_call`.
- `RB.getRef()` → code or null: the first `?ref=` seen (8 characters, 0-9 a-f), kept 30 days.
- `RB.getDraft()` → draft or null (under 30 days old), `RB.clearDraft()`. The builder draft, written by build.js:
  `{v:1, savedAt:ISO, fields:{business_name, owner_name, trade (an RB.TRADES label), service_areas (comma text),
  callout_weekday, callout_after, after_hours:'yes'|'no', callback_promise:'10'|'15'|'20'|'30'|'60',
  booking:'calendar'|'callback'}}`.
- `pricing.js` sets `RB.foundingLeft` and fires `rb:founding` only when real founding_spots data arrives, and writes
  `rb_calc`. `forward.js`: `RB.FORWARD`, `RB.forwardGuide(el, {number, lock})`. `auth.js`: `RB.sb`, `RB.requireUser`,
  `RB.signOut` (and `RB.authError`).

**Markup hooks**
- `#site-header`, `#site-footer`; `body[data-page]`, `[data-app]` (slim header, short footer), `[data-no-float]`
  (no action bar), `[data-no-ai]`.
- `[data-draft-pill]`: "Your draft: {business_name} · Continue" → build.html when a draft exists, else hidden.
- `[data-founder="card"|"compact"]`: the founder card from `config.founder`, only when name, photo and note are all set.
  Placed on about (after "Why we started"), contact (above the form) and pricing (beside the founding offer).
- `[data-wa]`, `[data-tel]`, `[data-phone]`, `[data-email]`, `[data-trade-select|text|sms|log]`, `[data-count]`,
  `[data-forward-guide]`, `[data-hear]`.

## Storage keys

Everything is wrapped in try/catch, so a browser that blocks storage still works. Nothing here leaves the device.

| Key | Where | Holds | Written by |
| --- | --- | --- | --- |
| `rb_trade` | local | The visitor's chosen trade key | site.js (`RB.setTrade`) |
| `rb_draft` | local | The assistant-preview draft (contract above), 30 days | build.js |
| `rb_ref` | local | `{code, at}`: first referral code seen, 30 days | site.js |
| `rb_calc` | session | Calculator values `{missed, real, win, value}` | pricing.js |
| `rb_plan` | session | Plan chosen from a `?plan=` link | auth.js |
| `rb_start` | session | Preferred start date from a `?start=YYYY-MM-DD` link | auth.js |
| `rb_otp` | session | `{email, mode, next, sentAt, resendAt}`: restores the code step after app switching | auth.js |
| `rb_next` | local | `{next, at}`: where to go after "tap to finish logging in", 15 minutes | auth.js |
| `rb_last_email` | local | The last email a code was sent to, to prefill next time | auth.js |
| `rb_setup_draft_<uid>` | local | `{savedAt, values}`: unsaved portal setup changes | portal.js |
| `rb_calls_seen_<uid>` | local | When this device last viewed the calls list | portal.js |
| `rb_install_dismissed` | local | The "add to home screen" card was dismissed | portal.js |
| `rb_intro_seen` | session | The home hero entrance already ran this session | index.html / site.js |

Supabase keeps its own session under `sb-<project>-auth-token` (local).

## Make login emails work

<!-- @@track:auth-otp -->

## Things to supply

- **Sample call audio.** Put one recording per trade in `audio/`, named by trade key:
  `plumbing.mp3`, `electrical.mp3`, `gates.mp3`, `solar.mp3`, `pest.mp3`, `aircon.mp3`, `locksmith.mp3`.
  Then list the keys you added in `config.audio`, e.g. `audio: ['plumbing','electrical']`. Only listed keys are
  requested, so with an empty list the site makes no audio requests at all. A player appears on the home page and the
  trades page for each listed trade. Each recording should follow that trade's example transcript in `site.js`
  (`RB.TRADES`). For exact highlighting, add `cues:[0, 4.5, 9, 15.2]` to the trade: the second each line starts.
- **Call-forwarding codes.** `RB.FORWARD` in `forward.js` holds the standard GSM codes. Check each network
  and set `verified:'YYYY-MM-DD'`. Put any network-specific differences in `overrides`.
- **Founder details (optional).** Fill `config.founder` with your real name, role, a square photo of 40 KB or less
  (a path in this site, e.g. `img/founder.jpg`) and a 2-3 sentence note in your own words. Until name, photo and note
  are all set, the "who you'll deal with" card stays hidden on about, contact and pricing.
- **Contact email.** `config.email` is empty, so email links stay hidden. Set it to a mailbox you read.

## SQL files to run

Run these once in the Supabase SQL editor (read the comments at the top of each first):

- `supabase/founding_spots.sql`: the founding places counter on the pricing page. Until it runs, the counter stays
  hidden.
- The `leads` table must accept anonymous inserts with the publishable key: the contact form, the sign-up fallback
  and setup-call requests all insert there.

<!-- @@track:portal -->

<!-- @@track:features -->

<!-- @@track:pages -->

## Pages

**Illustrations.** `art.svg` is a `<symbol>` sprite of line drawings (seven trades, plus `art-callpath`,
`art-phone-rings`, `art-calendar`, `art-sms`, `art-shield`, `art-gauteng` and `art-voicemail`). Use it as
`<svg class="art" viewBox="…" aria-hidden="true"><use href="art.svg#art-plumbing"/></svg>` when decorative, or with
`role="img" aria-label="…"` when it carries meaning. Colours come from `--art-line`, `--surface-3` and the status
tokens, so they can be changed per use. Keep it under 40 KB, with no filters, masks or animation.

**FAQ ids.** Every question in `faq.html` has an id, so `faq.html#id` opens and highlights it and
`faq.html?q=term` filters. Other pages link to these, so **never rename them**:
`q-ai`, `q-prices`, `q-languages`, `q-safety`, `q-emergency-wrong`, `q-busy`, `q-trial`, `q-forwarding-cost`, `q-popia`, `q-code`, `q-minutes`, `q-contract`.
The rest are `q-` plus the first five words of the question:
`q-what-is-ringback`, `q-which-trades-do-you-work`, `q-how-long-does-setup-take`, `q-do-i-need-a-new`, `q-can-i-listen-to-the`, `q-how-much-does-it-cost`, `q-how-do-i-pay`, `q-who-can-see-my-customers`, `q-can-i-delete-my-account`, `q-how-do-i-log-in`, `q-can-i-change-my-business`, `q-where-do-i-find-my`.
Add new questions with a new id in the same style, and update the count in the hero ("Showing N questions") and the
category counts in the index.

**Legal pages.** `legal.js` shows the reading time (words in the article ÷ 220, rounded up), the Print button and the
contents scrollspy. Update the "Last updated" date by hand when the text changes. The privacy policy's
"Browser storage" section lists every key the site keeps on the device: update it when a feature adds one.

**Link previews (`og/*.png`).** `og/og.html?v=home|pricing|trades|product` renders each 1200×630 frame with the
self-hosted fonts. To regenerate after changing it, serve the repo so it is reachable at `/ringback/`, then screenshot
each frame with headless Chromium (Playwright is a dev-only tool and is not committed):

```sh
mkdir -p /tmp/og && ln -sfn "$PWD" /tmp/og/ringback && python3 -m http.server 8814 --directory /tmp/og &
node -e "
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  for (const v of ['home', 'pricing', 'trades', 'product']) {
    await p.goto('http://localhost:8814/ringback/og/og.html?v=' + v);
    await p.waitForSelector('body[data-ready]');
    await p.locator('#frame').screenshot({ path: 'og/' + v + '.png' });
  }
  await b.close();
})();"
```

Each PNG must stay at 300 KB or less. Only real claims and prices go on them: no ratings, counts or "trusted by".
WhatsApp caches previews, so a changed image may take a while to show on links that were already shared.

## Performance budget

A first visit to the home page on a phone should transfer **200 KB or less, excluding images**:

| Part | Budget | Measured 10 Oct 2026 (gzip -9) |
| --- | --- | --- |
| HTML (`index.html`) | ≤ 8 KB | 6.9 KB |
| `site.css` | ≤ 22 KB gz | 17.9 KB (plus `home.css` 8.9 KB on the home page only) |
| First-party JS (`config.js`, `site.js`, `home.js`) | ≤ 25 KB gz | 28.6 KB: over, see below |
| Fonts, 2 preloaded | ≤ 135 KB | 133.0 KB (Bricolage 80.4, Geist 29.4, Geist Mono 23.1) |
| Third-party requests before interaction | 0 | 0 (Vapi and supabase-js load on demand) |
| Total | ≤ 200 KB | about 195 KB |

- Lighthouse mobile (Slow 4G, 4× CPU): LCP ≤ 2.5 s and CLS ≤ 0.05. Measured 11 Oct 2026 on a gzip server:
  home LCP 2.1 s, pricing 2.3 s, product 2.0 s; CLS 0 on all three; Performance 99 and Accessibility 100.
- No long task over 200 ms while scrolling.
- Before the redesign a first home visit was about 360 KB, including 184 KB of the Vapi widget loaded up front.
- `site.js` is the one file over budget (22.3 KB gz). The next saving would be moving `RB.TRADES` (2.7 KB gz) and the
  icon map (2.7 KB gz) out of the first load.

To measure: `for f in index.html site.css home.css config.js site.js home.js; do echo "$f $(gzip -9c $f | wc -c)"; done`.

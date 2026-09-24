# OmniPrompt Marketing — Website & Pitch Deck

Complete marketing site and pitch deck for **OmniPrompt Marketing**, the AI marketing automation agency described in `../ai_marketing_automation_business_plan.md`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Full marketing website (hero, problem, services, content-engine architecture, ROI calculator, pricing with builds/retainers toggle, process, results, FAQ, lead form) |
| `pitch.html` | 12-slide animated pitch deck with speaker notes and a comparison matrix |
| `assets/css/site.css` | Master site styles — warm palette in `:root` |
| `assets/css/pitch.css` | Deck engine styles (slides, charts, timeline, matrix, notes) |
| `assets/js/site.js` | Nav, scroll reveals, counters, calculators, pricing toggle, forms, toasts |
| `assets/js/pitch.js` | Deck navigation, notes, help overlay, progress, hash routing, swipe |

## How to open

No build step, no dependencies. Just open the files in a browser:

```bash
xdg-open index.html      # website
xdg-open pitch.html      # pitch deck
```

Or serve locally: `python3 -m http.server 8080` and visit `http://localhost:8080`.

## Pitch deck controls

- `→` / `Space` / `PageDown` — next slide
- `←` / `PageUp` — previous slide
- `Home` / `End` — first / last slide
- `N` — speaker notes · `F` — fullscreen present mode · `?` — shortcuts · `Esc` — close overlays
- Dots at the bottom jump to any slide; swipe works on touch devices
- `Cmd/Ctrl + P` exports every slide to PDF (print styles included)

## Pricing implemented

**One-off builds**

- SEO Content Engine — **$4,000**
- Full-Stack Content Engine — **$8,000** (most popular)
- White-Label Partner — **Custom**

**Monthly retainers**

- Launch — **$2,000/mo** (1 pipeline · 30 assets)
- Scale — **$3,500/mo** (3 pipelines · 120 assets · most popular)
- Dominate — **$5,000/mo** (300+ assets · multi-modal)

Every build includes a free 1-week pilot. API usage ≈ $6/asset pass-through.

## Rebranding

All palette, typography and radius tokens are CSS variables at the top of `assets/css/site.css`. Change `--c1`, `--c2`, `--c3` and `--bg` to reskin both the site and the deck.

> ℹ️ Company name is a placeholder from the business plan. Replace `hello@omniprompt.ai`, the logo glyph and the social links before publishing.
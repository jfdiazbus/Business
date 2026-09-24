# PromptOps AI — Website & Pitch Deck

Complete marketing site and investor/client pitch deck for **PromptOps AI**, the AI prompt implementation & automation agency described in `../ai_business_plan.md`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Full marketing website (hero, problem, services, architecture, pricing, ROI calculator, process, results, FAQ, lead form) |
| `pitch.html` | 12-slide animated pitch deck with speaker notes |
| `assets/css/site.css` | Master site styles — all colors live in `:root` |
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

- Automation Sprint — **$3,000** one-time
- AI Ops Build — **$7,500** one-time (most popular; includes 1 month PaaS)
- Enterprise Agent Platform — **from $10,000**
- Prompt-as-a-Service retainer — **$500/month** per production workflow
- Agent packs — Lead Qualifier $1,900 · Invoice Extraction $2,400 · Support Deflection $2,900 · SOP Knowledge Bot $3,200

## Rebranding

All palette, typography and radius tokens are CSS variables at the top of `assets/css/site.css`. Change `--c1`, `--c2`, `--c3`, `--bg` and the deck/site follow automatically.

> ℹ️ Company name is a placeholder from the business plan. Replace `hello@promptops.ai`, the logo glyph and the social links before publishing.
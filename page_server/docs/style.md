# The look, and how to change it

The site is dark, flat and led by type. This is the one file that says why, where
every value lives, and what to do when you need a new one.

It describes the site after the paper was removed. If you are reading this
because something looks wrong, the section you want is probably
[Checking your work](#checking-your-work).

## The short version

- One typeface for the interface, **Geist**, and a monospace for data, **Geist
  Mono**. There are no other fonts.
- Flat surfaces, hairlines instead of boxes, no shadows, no background
  gradients, no ASCII decoration.
- One accent, red. It marks links, the page you are on, and the focus ring.
- One action per page. The bar carries a single button. Each price carries a
  single buy link.
- Every value comes from a token. Nothing below the token block invents a size, a
  colour or a space.

## Where the values live

`page_server/style.css` opens with the tokens, in four groups:

| Group          | Tokens                                                                             |
| -------------- | ---------------------------------------------------------------------------------- |
| Surfaces       | `--bg`, `--surface`, `--surface-2`, `--line`, `--line-strong`                        |
| Text           | `--ink`, `--ink-soft`, `--ink-faint`                                                 |
| Accent         | `--accent`, `--accent-deep`                                                          |
| Type scale     | `--fs-xs` … `--fs-6xl` — 12, 14, 16, 18, 20, 24, 30, 36, 48, 60px                    |
| Space scale    | `--sp-25` … `--sp-900` — 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96px               |
| Radii, motion  | `--r-sm`, `--r-md`, `--r-lg`, `--r-full`, `--ease`, `--slow`                         |
| Layout         | `--measure`, `--page-max`, `--page-pad`, `--bar-h`                                   |

`page_server/world/kit.mjs` holds the matching palette for the film, in `P`. The
two are deliberately separate files, because the film is drawn offline and
baked, and the site is CSS: change one, re-render, and check the seam.

Three tests in `test/style.test.js` keep this honest: every `var(--x)` used is
defined, the type scale is the list above and nothing else, and the text colours
clear the contrast floor below.

## Colour, and the contrast floor

Against `--bg` (`#0a0a0a`):

| Token         | Value                  | Ratio  | Used for                                  |
| ------------- | ---------------------- | ------ | ----------------------------------------- |
| `--ink`       | `#ffffff`              | 19.7:1 | body text, headings, the primary button   |
| `--ink-soft`  | `#a3a3a3`              | 7.8:1  | secondary text, labels, the colophon      |
| `--accent`    | `#ff6b5a`              | 7.0:1  | links, the current page mark, focus       |
| `--ink-faint` | `#737373`              | 4.1:1  | marks only: the list dots, never sentences |

Two rules follow from this, and both were learned the hard way:

1. **Text never goes below full opacity.** Anything dimmer than the tokens is by
   definition below the floor. The reveal animation moves, it does not fade, for
   exactly this reason. A test asserts the keyframe never touches `opacity`.
2. **A bare link needs to be styled.** A link inside a paragraph that is not part
   of a styled row falls back to the browser's own link colour, which is
   unreadable on near black. The top of the stylesheet styles `a` for that case.

## Type

Geist for everything the reader reads, Geist Mono for anything that is data:
prices, the slide counter, email addresses, years. Mono is a signal, so it is
worth being sparing with.

The type scale is the only place a size may come from, and both `clamp()` calls
interpolate **between** two scale steps rather than inventing one.

Copy rules, enforced on the pages by tests:

- No hyphens inside sentences. "five working days", not "five-day turnaround".
- Sentence case headings.
- No clichés: elevate, seamless, unleash, next gen, game changer, delve.
- Second person, active voice, one idea per paragraph.

## The bar

`header.topbar`, one per page, `position: fixed`, `--bar-h` tall (72px, 60px on a
phone). It has three states:

| State                     | What it looks like                                     |
| ------------------------- | ------------------------------------------------------ |
| clear (top of the page)   | transparent, no border                                 |
| `topbar--solid` (scrolled) | `color-mix` of the background, blurred, hairline below |
| `topbar--open` (phone)    | the nav becomes a full panel under the bar             |

`bar.js` sets those classes. It is the only script the document pages load, and
it does two things:

- **The solid state** comes from a one pixel sentinel at the top of the document
  and an `IntersectionObserver`, never from a `scroll` listener, which would fire
  on every frame and force layout while the reader scrolls.
- **The menu** is an enhancement. The button is hidden by CSS until the script
  adds `topbar--enhanced`, so without the script the nav stays the scrollable row
  of links it already was: nothing is ever locked behind a button that cannot
  open. Focus moves into the panel and back, Escape closes it, and the page
  behind is prevented from scrolling.

To add a bar item, add it to the `nav` on **every** page (the nav is a site nav,
not a per page one) and mark the current page with `aria-current="page"`.
`test/bar.test.js` covers the states; `test/page.test.js` checks the links point
at routes the site serves.

## Motion

- The house curve is `--ease: cubic-bezier(0.32, 0.72, 0, 1)`, and `--slow` is
  500ms. Nothing animates on a default ease.
- **Every animation sits inside the `prefers-reduced-motion: no-preference`
  guard, and every scroll timeline inside an `@supports (animation-timeline:
  view())` guard.** Two tests fail the build otherwise.
- Scroll reveals use CSS scroll timelines (`animation-timeline: view()`), so
  there is no JavaScript involved and no `window.addEventListener("scroll")`
  anywhere.
- A reveal moves content into place. It does not fade it in.

## The deck

`/home` is five screens that snap. The rules, and the reasons:

- `scroll-snap-type: y mandatory` plus `scroll-snap-stop: always`, so one gesture
  is one slide and a flick cannot skip past one. Proximity was tried and felt
  broken: the reader nudged at the next slide and nothing moved.
- A keypress turns the page in `TURN` (300ms) on an ease out, computed in
  `slides.js` rather than left to the browser, which takes its own time for a
  full screen of travel.
- A keypress and a flick land in **the same place**: both use the slide's
  `scroll-margin-top`, so neither leaves a heading under the bar.
- A slide taller than the window is revealed by repeated presses, and once only
  `REVEAL` (96px) is left below the fold, the next press moves on. Without that
  the deck stalled: every later press aimed at a reveal the snapping would not
  allow.
- The slide counter (`2 / 5`) is plain text in the slide, so the nav does not
  have to double as a position indicator.

## Adding a page

1. Copy a document page (`terms.html` is the newest and simplest).
2. The head: `color-scheme: dark`, `theme-color: #0a0a0a`, the dark favicon, the
   Geist font link, `style.css`.
3. The bar: brand, the site nav, one `.btn`, the menu button. Mark the current
   page.
4. One `h1` with `class="page-title"`. The rest of the headings are `h2`, and
   they never skip a level.
5. The footer: `.eof`, `.colophon`, and the `.links` row, which is where the
   terms link lives.
6. `index.js`: add the pretty route to `REWRITES`.
7. `scripts/build.mjs`: add the file to `PAGE_FILES` and to the `checkLinks`
   list, or its links are never checked.
8. `README.md`: a row in "What's in here".
9. A test. `test/terms.test.js` is the model: it checks the page names the
   seller, answers what a buyer needs, keeps one `h1`, uses each id once, loads
   only `bar.js`, and obeys the copy rules.

## What was removed, and why

The site used to be a printed page: cream paper, one monospace throughout,
tractor feed strips down the edges, an ASCII ruler between sections, dot leaders
on the rows, and a figlet banner on the title page. It read as a template of that
idea rather than as a site, so it was replaced:

| Removed                        | Replaced by                                            |
| ------------------------------ | ------------------------------------------------------ |
| Sprocket strips, paper feed     | a flat background and a fixed bar                      |
| `====` ASCII ruler              | a one pixel hairline                                   |
| Dot leaders                     | a hairline that fills the row                          |
| `>` sigils before headings      | sentence case headings                                 |
| Figlet banner, `pnpm banner`    | a real `h1`, which is also what a search engine reads  |
| Bracketed link labels `[ ]`     | plain labels; the shape of the button carries the meaning |
| Monospace for everything        | Geist for prose, Geist Mono for data                   |
| Green bar cards                 | flat cards with a hairline border and a large price    |

Two things were kept on purpose: the `:-)` in the favicon and the footer, which
is a signature rather than decoration, and the film's print shop, which is the
one place a printer still belongs.

## The film

The front page is a baked film: five scenes, four connectors, five posters, in
`page_server/world/out/` — 13MB, and it is the heaviest thing in the repository.

```bash
node world/render.mjs   # scenes -> transparent PNGs, via headless Chrome
node world/motion.mjs   # PNGs -> dives, wipes, posters, previews
```

Everything visual comes from `world/kit.mjs`. In the dark version the value ramp
runs from the page background up to the lit faces, `ink` is the light that draws
the edges, the old green bar surfaces went neutral, and the red is the one accent.
`render.mjs` embeds the same font family the site uses, so the scenography and
the pages agree.

Two details worth knowing before you touch the encoder in `world/motion.mjs`:

- **The keyframes have to stay close together.** The engine scrubs the clips by
  setting `currentTime` while the video is paused, so frames must be seekable.
  That is the only reason for `-g 16`, and it costs size.
- **Dark gradients compress badly.** The first dark render was 38MB. CRF 23 with
  a keyframe every half second brought it to 13MB, measured against the heavier
  encode at SSIM 0.9918 and PSNR 50dB, which is not visible on a background.

After a re-render, check the sizes against Cloudflare's per file limit, and look
at a seam: the posters have to sit on the page background without a visible edge.
`test/world.test.js` checks the config, the copy and the file sizes.

## Checking your work

```bash
pnpm test          # 184 tests, 13 suites
pnpm format:check  # prettier
pnpm build         # dist/, and it fails on a broken link
```

| Suite      | What it protects                                                          |
| ---------- | ------------------------------------------------------------------------- |
| `style`    | tokens, contrast, flat backgrounds, upright type, the motion guards        |
| `bar`      | the solid state, the menu, and that nothing listens to scroll              |
| `slides`   | what a keypress does, and how long a page turn takes                       |
| `page`     | the deck's words, headings, links and shell                                |
| `services` | prices, one action per offer, heading order, routes, the copy rules         |
| `terms`    | the seller, the buyer's questions, the cancellation right, the data note    |
| `stripe`   | the payment links against the live Stripe account, and price drift          |
| `world`    | the world's config, its copy, and the film's sizes                         |
| `build`    | what ships, that nothing leaks a local path, and that no link is broken     |
| `deploy`   | credentials stay out of git and out of the image                           |
| `school`, `project`, `server` | the coursework page, the project's own promises, the local server |

Accessibility is checked by hand with Lighthouse, at 390px wide. The expectation
is **100 for accessibility on every page**, and the only audit allowed to fail is
`is-crawlable` on `/thanks`, which is `noindex` on purpose.

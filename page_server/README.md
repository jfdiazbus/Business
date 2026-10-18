# page_server — my portfolio

A portfolio in plain HTML and CSS: a written page for each part of the work, a
scroll driven film, and a prices page that takes payments. No framework, no
runtime dependency, no build step beyond copying files. A tiny Node server for
local work, and a static build that ships to Cloudflare or to a Docker container.

It is live at **<https://portfolio.jfdiazbus.workers.dev>**.

If you are here to change how it looks, read **[`docs/style.md`](docs/style.md)**
first: it explains where every value lives and what not to break. This file is
about running, testing and shipping it.

### The pages

| Route       | Page                      |
| ----------- | ------------------------- |
| `/`         | the film: a scroll tour   |
| `/home`     | the portfolio             |
| `/school`   | the coursework            |
| `/services` | the prices, and checkout  |
| `/thanks`   | where Stripe sends buyers |
| `/terms`    | terms and privacy         |

Pretty URLs are the host's job — Cloudflare `html_handling`, nginx `try_files`,
and a rewrite table in the local server — so nothing ships an `_redirects` file.

## Everyday commands

| Command           | What it does                                                      |
| ----------------- | ----------------------------------------------------------------- |
| `pnpm install`    | Install the dev tools (only needed once, and after a fresh clone) |
| `pnpm start`      | Open it at <http://localhost:3000>                                |
| `pnpm dev`        | The same, but reloads when you edit a file                        |
| `pnpm test`       | Run the tests                                                     |
| `pnpm build`      | Write the deployable site to `dist/`                              |
| `pnpm format`     | Tidy the code with Prettier                                       |
| `pnpm run deploy` | Build and ship `dist/` to Cloudflare                              |

`node_modules/` and `dist/` are not committed — they are built from
`package.json` and the source files.

## What's in here

| Path                              | What it does                                                               |
| --------------------------------- | -------------------------------------------------------------------------- |
| `home.html`                       | The portfolio, served at `/home`: experience, education, projects, contact |
| `school.html`                     | The Epitech coursework, served at `/school`                                |
| `services.html`, `thanks.html`    | The prices, and where Stripe sends buyers (`/services`, `/thanks`)         |
| `terms.html`                      | Terms and privacy, served at `/terms`                                      |
| `style.css`                       | The look: the tokens, the type scale, the spacing scale, then the rules    |
| `docs/style.md`                   | Why the site looks the way it does, and how to change it                   |
| `index.js`                        | The local server. No dependencies, only Node's own modules                 |
| `scripts/build.mjs`               | Assembles `dist/` for Docker and Cloudflare                                |
| `scripts/deploy.mjs`              | Builds and uploads, reading credentials from `.secrets`                    |
| `bar.js`                          | Turns the bar solid once the page scrolls                                  |
| `world.html`, `world.js`          | The front page: the scroll world, and its config                           |
| `world/`                          | The film: scene sources, the render + motion steps, and `out/`             |
| `docs/style.md`                   | Why the site looks the way it does, and how to change it                   |
| `test/`                           | Tests for the server, the pages, the styles, the build and the pipelines   |
| `Dockerfile`, `docker/nginx.conf` | The container that serves `dist/`                                          |
| `.secrets`                        | Your Cloudflare credentials. Gitignored — never committed                  |
| `.node-version`                   | Pins the Node version Cloudflare's builder uses                            |
| `wrangler.toml`                   | Cloudflare configuration                                                   |

## Editing the text

Everything you might want to change is in `home.html` (the portfolio) or
`world.js` (the world's copy):

- **Contact details** — search for `juan-felipe.diaz-bustamante` and replace
  the email, and update the GitHub link if you like.
- **Project descriptions** — each project is an `<article class="project">`
  block: a title, one sentence saying what it is, and a `.detail` paragraph
  saying how it works. The coursework behind them is in `~/Epitech`; the tests
  check that there are four, each with a title and a description, but they do not
  pin the names.
- **Sections** — the portfolio is one `<section class="block" id="...">` per part:
  experience, education, projects and contact. Adding or renaming one means
  changing the bar's nav and the world's sections as well, so all three stay in
  step.
- **Where I have worked** — the rows live under `<ul class="werk">`, one
  `.werk-row` each, with the years in the left column. They mirror the
  Experience section of the LinkedIn profile.
- **School work** — the coursework is in `school.html`, served at `/school`.

## The style

One typeface for the interface (Geist) and a monospace for prices and data
(Geist Mono), flat surfaces, hairlines instead of boxes, and one red accent.
Every colour pair is checked against WCAG AA on the background: body text is
19.7:1, soft text 7.8:1, the accent 7.0:1. `--ink-faint` is 4.1:1, so it is only
used for non-text marks.

The tokens live at the top of `style.css`, in three blocks: colours, then the
type scale, then the spacing scale. Nothing below them invents a size or a
spacing value of its own. The colour values are also the only place the palette
is written down, and `world/kit.mjs` holds the matching set the film is drawn
with.

## How it moves

There is no deck any more. `/home` is a written page: experience, education,
projects, contact, read by scrolling like any other.

- The bar stays pinned to the top, so any page can reach any other. It starts
  clear over the top of the page and turns solid once you scroll, and on a phone
  the nav collapses behind a menu button.
- Sections, cards and hairlines arrive as they come into view.
- A reveal moves content into place. It never fades it, because text dimmer than
  the tokens is text below the contrast floor.

The arrivals are CSS alone (`animation-timeline: view()`), and every animation
sits inside a reduced motion guard. `bar.js` is the only script the written pages
load: it turns the bar solid when the page moves, watching a one pixel sentinel
rather than listening to every scroll event, and it runs the phone menu. Without
it the bar stays clear, the menu button stays hidden and the nav remains the
scrollable row it already was, so nothing is locked behind a script that did not
load. Printing gives white pages, with the bar at the top of the sheet.

## The scroll world

The front page (`/`) is a scroll driven flight through a print shop, five
scenes long, with each scene's copy pinned over it. One scene per part of the
site, and the film says so on the scene itself, as that scene's title:
**Presentation, Education, Experience, Projects, Contact**. The portfolio lives at `/home` (a rewrite to
`home.html`), the coursework at `/school`, and the world links back to both.

The film is **made by hand rather than by a video model**. The scenes are drawn
as cardstock in `world/kit.mjs` and `world/scenes.mjs`, rendered to transparent
PNGs with headless Chrome, and animated with ffmpeg — so it costs nothing to
regenerate, and every seam is exact because both sides of it are mine.

| Command                            | What it does                                            |
| ---------------------------------- | ------------------------------------------------------- |
| `node world/render.mjs`            | redraw all layers to `world/build/{svg,png}`            |
| `node world/render.mjs print-room` | just one scene, while tuning the art                    |
| `node world/motion.mjs`            | dives, wipes and posters into `world/out`               |
| `node world/motion.mjs preview`    | write frames from every clip into `world/build/preview` |

**One gesture, one scene.** A wheel notch, an arrow key, PageUp/PageDown, space,
Home or End moves the film a whole scene at a time (the route dots on the right
do the same), and the whole film is about six screens of scroll, so a scene never
takes a long scroll to reach. Touch devices keep their native scrolling.

**How the camera works.** It is locked isometric, so nothing rotates or tilts:
each layer simply glides down at its own speed — 0.45 for the wall, 1 for the
hero, 1.25 for the paper sweeping past the lens — and the depth comes from the
difference. Everything travels vertically, in both directions: the camera moves
down inside a scene, and one scene gives way to the next from below, which is
why the join is a vertical wipe led by a full width sheet edge rather than a
sideways sweep. Because the camera only ever travels one way, the velocity matches
at every seam, and each wipe begins and ends on the _actual_ frames of the
dives beside it (the `world.test.js` film checks and the preview frames keep
that honest; measured seam difference is 1.4/255, which is encode noise).

`world/engine.js` is the scrub engine from the scroll-world skill, copied
unchanged so it can be pulled from upstream later; `world.js` holds only the
config (sections, copy, accents) and the page's colour tokens. `world/build` is
scratch and is not committed; `world/out` is the film the site ships.

## Taking payments

`/services` sells five fixed services across two branches: software and implementations. The buy buttons are Stripe **Payment
Links**, so there is no secret key in the repository and no Stripe JavaScript on
the page.

### What is already built

The Stripe account holds the whole catalogue (live). Test mode uses the `portfolio sandbox` with the same products.

| offer   | product               | price                           | payment link                     |
| ------- | --------------------- | ------------------------------- | -------------------------------- |
| website | `prod_VS81qc5gCuzX3n` | €100, `tax_behavior: exclusive` | `plink_1URy88FtV5oJWaqwrCBDt5WY` |
| api     | `prod_VS82wT5zix7Ps6` | €200, `tax_behavior: exclusive` | `plink_1URy89FtV5oJWaqweoW8UIZB` |
| full    | `prod_VS8246T28j4pCS` | €500, `tax_behavior: exclusive` | `plink_1URy8AFtV5oJWaqwN6lfYAmh` |
| stripe  | `prod_VSvcXm1WxpEYoU` | €20, `tax_behavior: exclusive`  | `plink_1URzlKFtV5oJWaqwZ94VubMW` |
| ai      | `prod_VSvcwfh1n8nskr` | €300, `tax_behavior: exclusive` | `plink_1URzlSFtV5oJWaqwZuo6BMOa` |

Each link carries automatic tax, promotion codes, a VAT ID field for EU
businesses, a "What do you need?" brief field, an invoice created automatically
for the buyer, and a redirect to `/thanks`. Payment methods are left to Stripe
(dynamic payment methods), which is why its checkout offers card, Klarna,
Bancontact and Amazon Pay rather than card alone.

Those links sit directly in the three buy buttons in `services.html`, so the page
sells without any JavaScript. They are **test links**, so the buttons lead to
the Stripe sandbox: a visitor can only pay with Stripe's test cards, no money
moves, and Stripe labels the page as a sandbox. Swap in live links before you
send anyone to `/services`.

### Going live

1. Activate the Stripe account: business details, bank account, identity. This
   is the slow part and the only part that cannot be automated.
2. Set a head office address under **Tax > Settings**, then add a registration
   for each place you are registered to collect tax. Until both exist,
   `automatic_tax` silently collects **zero**: the checkout shows a tax line of
   €0.00 and raises no error. Settle that with your accountant, not with me.
3. Recreate the three Payment Links in **live mode** with the same settings as
   the table above, and swap their URLs into the three buy buttons in
   `services.html`.
4. Buy one with a card from Stripe's test list in the sandbox, then make one real
   live purchase and refund it.

Two things to remember: the amount charged lives in Stripe, so the page and the
dashboard can drift apart — check both when a price changes. And selling to
consumers inside the EU means VAT in the buyer's country (the OSS scheme):
Stripe Tax calculates it, but you have to be enrolled.

Nothing on the site needs a Stripe API key: Payment Links are public URLs and the
page loads no Stripe JavaScript. The one thing that wants a key is the `stripe`
suite, which reads it from `STRIPE_SECRET_KEY` in the environment or from the
gitignored `.secrets`. That suite is what turns the table above into a test: for
each button it fetches the Payment Link, its price and its product, and fails
when a price, the tax behaviour, the redirect or the invoice setting has drifted
since. The deploy script passes only the `CLOUDFLARE_*` values from `.secrets`
to wrangler, so nothing else in that file can reach a deploy.

## Tests

`pnpm test` runs twelve suites:

- **server** — routing, content types, redirects, the friendly 404, request
  methods, and that a URL can never climb out of the folders it serves.
- **page** — the portfolio's four sections, its heading order, every link
  readable, and that the deck does not grow back: no slides, no counter, no
  snapping.
- **style** — every token used is defined, the text clears WCAG AA on the
  background, backgrounds are flat, type is upright, sizes come from the scale,
  and no animation can run without scroll-timeline support or a visitor who is
  happy with motion.
- **bar** — the solid state, the phone menu, and that nothing listens to scroll.
- **build** — `dist/` contains both client sites and the plans, leaks no local
  paths, is repeatable, and has no broken links.
- **deploy** — credentials stay out of git and out of the image, and an
  unfilled `.secrets` template can never look like a real token.
- **world** — the scroll world's config points at assets that exist, the film
  fits Cloudflare's per file limit, the copy keeps to the house rules (no
  hyphens, no cliches, one action), and the vendored engine is intact.
- **school** — the coursework page describes rather than links the private
  repositories, and keeps the copy on the same house rules.
- **services** — the prices and the questions, one checkout per offer, heading
  levels that never skip, every id used once, and every link pointed at a page
  this site really serves.
- **stripe** — the buttons sell with real Payment Links that carry the settings
  the page promises and charge the price the page shows. It reads
  `STRIPE_SECRET_KEY` from the environment or from `.secrets`; without a key the
  five account checks skip rather than fail, so a fresh clone and CI stay green.
- **terms** — the page names the seller, answers what a buyer needs before
  paying (prices, delivery, refunds, the 14 day right to cancel, data), and is
  reachable from every footer.
- **project** — the promises this project makes about itself: no runtime
  dependencies, the pipeline files exist, git stays clean.

## Conventions

Worth knowing before you change anything, because the tests enforce most of it:

- **Copy rules.** No hyphens inside sentences, sentence case headings, no
  clichés (elevate, seamless, unleash, next gen, game changer, delve), second
  person, active voice. Four suites check the text they cover.
- **No runtime dependencies.** `index.js` and the browser code use nothing but
  the platform. Adding a dependency needs a reason and a note here.
- **Secrets never enter the repository.** `.secrets` is gitignored and excluded
  from the Docker image; only `CLOUDFLARE_*` values from it reach wrangler.
- **Commit messages** start with a bracketed verb: `[ADD]`, `[CHANGE]`, `[FIX]`,
  then a plain sentence, then why.
- **Every page is checked twice.** Once by a test that loads it, once by hand
  with Lighthouse at 390px wide; the expectation is 100 for accessibility, and
  the only audit allowed to fail is `is-crawlable` on `/thanks`, which is
  `noindex` on purpose.

## Still to do

- **Stripe is in sandbox mode.** The buy buttons work, but they take Stripe's
  test cards until an account is activated and three live links are pasted in.
  See "Going live" above, and the tax registration in particular: without one,
  Stripe collects zero tax and says nothing at all.
- **The layout and copy have not been checked by a designer**, and the terms
  have not been read by a lawyer.
- **Privacy is a section of the terms, not its own page.** If analytics or any
  third party is ever added, it needs one.
- **The film is the heaviest thing here**, at about 13MB. Dark gradients are
  expensive to compress, and the clips have to keep their keyframes close
  together because the engine scrubs them.
- **Cloudflare's Workers Builds check** was failing on a dashboard setting
  (branch previews), which is why deploys have been made by hand.

## Deploying to Cloudflare

Cloudflare builds the site from this repository: on every push to `main` it
runs the build and uploads `dist/` as a Worker that serves static files.
`.github/workflows/ci.yml` only runs the tests and the build, so nothing can
deploy twice.

### The settings Cloudflare needs

Connect the repository (Workers & Pages → **Create application** → GitHub →
`jfdiazbus/Business`) with these values:

| Field           | Value                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Worker name     | `portfolio` — must match `name` in `wrangler.toml`, or the build fails                                                            |
| Git branch      | `main`                                                                                                                            |
| Root directory  | `page_server` — if you leave it unset, the repository root has its own `package.json` and `wrangler.toml` that run the same build |
| Build command   | `pnpm build`                                                                                                                      |
| Deploy command  | `npx wrangler deploy`                                                                                                             |
| Preview command | leave the default                                                                                                                 |
| API token       | leave empty — Cloudflare generates one and reuses it                                                                              |
| Build variables | none needed; `.node-version` pins Node 22 for the builder                                                                         |

The root directory is where the commands run. The whole repository is still
checked out, which is what lets `scripts/build.mjs` copy the two client sites
and the business plans into `dist/`.

Two things in `wrangler.toml` are load bearing for the builder:

- **`name`** has to be the Worker the repository is connected to (`portfolio`).
  If it differs, Cloudflare builds a _different_ Worker and fails the check —
  that is where the stray `jfdiazbus-portfolio` Worker came from.
- **`[previews]`** has to be present, even empty. Branch builds run
  `wrangler preview`, and without that block it refuses to run, so every pull
  request check fails with "missing a `previews` block". Branch builds land on
  `<branch>-portfolio.<your-subdomain>.workers.dev`.

### Deploying by hand

`pnpm run deploy` builds `dist/` and uploads it from your machine — handy to
check something before pushing, or to ship without waiting for a build.

```bash
cd page_server
pnpm run deploy              # builds dist/, then uploads it
pnpm run deploy -- --dry-run # builds and reports, without uploading
```

> `pnpm run deploy`, not `pnpm deploy`: pnpm has its own `deploy` command for
> workspaces, so the short form silently runs the wrong thing.

It authenticates whichever way you prefer:

**Log in once** — no keys to handle:

```bash
pnpm exec wrangler login
pnpm run deploy
```

**With an API token** — put the two values in `page_server/.secrets`, which is
gitignored and read automatically:

```
CLOUDFLARE_API_TOKEN=your-token-here
CLOUDFLARE_ACCOUNT_ID=your-account-id-here
```

### Getting an API token

You only need one to deploy by hand — Cloudflare's own builder makes and
reuses a token for itself.

1. Sign in to the [Cloudflare dashboard](https://dash.cloudflare.com) and open
   **My Profile → API Tokens**.
2. Select **Create Token**.
3. Under templates, choose **Edit Cloudflare Workers**.
4. Point **Account Resources** at your own account. Add a **Zone** resource
   too if the site will live on a domain you already have in Cloudflare.
5. Select **Continue to summary** — check it reads _Workers Scripts: Edit_ —
   then select **Create Token**.
6. Copy it now: Cloudflare shows it **once**, and it starts with `cfut_`.

### Getting the account ID

**Workers & Pages** lists the **Account ID** in the right-hand column, or ask
wrangler:

```bash
pnpm exec wrangler whoami
```

### Keeping the token safe

- Never paste it into `wrangler.toml`, either page, an issue or a chat: it is
  the key to your account. `.secrets` is gitignored and excluded from the
  Docker image for that reason.
- It is shown only once. If it leaks, delete it in **My Profile → API Tokens**
  and create a new one — a token can be revoked at any moment.
- Tokens start with `cfut_`, which lets secret scanners spot them in a
  repository.
- Set an expiry date if you would rather rotate it yearly.

## Running it in Docker

The container needs the client sites that sit beside this folder, so build
from the repository root:

```bash
docker build -f page_server/Dockerfile -t portfolio .
docker run --rm -p 8080:80 portfolio
```

Then open <http://localhost:8080>. The image is nginx plus the built folder,
so it needs no `node_modules` and no Node at runtime.

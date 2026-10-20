# page_server — my portfolio

A portfolio in plain HTML and CSS: a written page for each part of the work, a
scroll driven film, and a prices page that takes payments. No framework, no
runtime dependency, no build step beyond copying files. A tiny Node server for
local work, and a static build that ships to Cloudflare or to a Docker container.

It is live at **<https://portfolio.jfdiazbus.workers.dev>**.

If you are here to change how it looks, read **[`docs/style.md`](docs/style.md)**
first: it explains where every value lives and what not to break. This file is
about running, testing and shipping it.

## The pages

| Route         | Page                      |
| ------------- | ------------------------- |
| `/`           | the film: a scroll tour   |
| `/home`       | the portfolio             |
| `/school`     | the coursework            |
| `/services`   | the prices, and checkout  |
| `/thanks`     | where Stripe sends buyers |
| `/terms`      | terms and privacy         |
| `/blog`       | published posts           |
| `/blog/write` | private writing desk      |

Pretty URLs are the host's job — Cloudflare `html_handling`, nginx `try_files`,
and a rewrite table in the local server — so nothing ships an `_redirects` file.

## Everyday commands

| Command           | What it does                                                       |
| ----------------- | ------------------------------------------------------------------ |
| `pnpm install`    | Install the dev tools (only needed once, and after a fresh clone)  |
| `pnpm start`      | Open it at <http://localhost:3000>                                 |
| `pnpm dev`        | The static site at `http://localhost:3000`                         |
| `pnpm dev:worker` | Build, then run the Worker with local D1 and R2 at port 8787       |
| `pnpm test`       | Run the unit, build and Worker tests                               |
| `pnpm e2e`        | Open every page in a browser: axe, the skip link, the film         |
| `pnpm lighthouse` | Score every page and hold accessibility at 100                     |
| `pnpm lint`       | JavaScript, CSS, HTML, Markdown and the spelling in all of them    |
| `pnpm types`      | Type check the server and the pipeline scripts, with no build      |
| `pnpm knip`       | Find code, exports and dependencies nothing uses                   |
| `pnpm size`       | Check the stylesheet, the scripts, the engine and the film budgets |
| `pnpm coverage`   | The unit tests again, with a coverage report                       |
| `pnpm build`      | Write the deployable site to `dist/`                               |
| `pnpm format`     | Tidy the code with Prettier                                        |
| `pnpm run deploy` | Build and ship `dist/` to Cloudflare                               |

`node_modules/` and `dist/` are not committed — they are built from
`package.json` and the source files.

The site's own code still runs on the platform and the Stripe SDK. Everything
in the table above is a dev dependency, and the project suite fails if
`dependencies` grows past `stripe`.

## Dev tools

| Package                                                     | What it is for                                                                            |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `vitest`, `jsdom`                                           | The test runner, and the real HTML it parses without a browser.                           |
| `@vitest/coverage-v8`                                       | Coverage for the server, the Worker, the build and the page scripts.                      |
| `prettier`                                                  | One formatting, enforced in CI.                                                           |
| `eslint`, `@eslint/js`, `globals`, `eslint-config-prettier` | JavaScript errors, with browser, Worker and Node globals kept apart.                      |
| `stylelint`, `stylelint-config-recommended`                 | CSS errors. The descending specificity rule is off: the stylesheet is ordered by section. |
| `html-validate`                                             | HTML5 validation, which jsdom would otherwise repair silently.                            |
| `markdownlint-cli2`, `cspell`                               | The prose in this file, and the spelling in the copy and the code.                        |
| `knip`                                                      | Unused files, exports and dependencies.                                                   |
| `size-limit`, `@size-limit/file`                            | Budgets on the stylesheet, the page scripts, the engine and the film.                     |
| `typescript`, `@types/node`                                 | `checkJs` over the server and the scripts, with `noEmit`.                                 |
| `@playwright/test`, `@axe-core/playwright`                  | A real browser: axe on every page, the skip link, and the scroll film.                    |
| `@lhci/cli`                                                 | Lighthouse, with accessibility asserted at 100.                                           |
| `wrangler`                                                  | The Worker, local D1 and R2, and deploying.                                               |

## What's in here

| Path                              | What it does                                                               |
| --------------------------------- | -------------------------------------------------------------------------- |
| `home.html`                       | The portfolio, served at `/home`: experience, education, projects, contact |
| `school.html`                     | The Epitech coursework, served at `/school`                                |
| `services.html`, `thanks.html`    | The prices, and where Stripe sends buyers (`/services`, `/thanks`)         |
| `terms.html`                      | Terms and privacy, served at `/terms`                                      |
| `blog.html`, `blog-write.html`    | The public blog and private writing desk                                   |
| `style.css`                       | The look: the tokens, the type scale, the spacing scale, then the rules    |
| `index.js`                        | The local server. No dependencies, only Node's own modules                 |
| `worker.js`                       | Blog API, admin login, D1 posts, R2 media and static asset fallback        |
| `migrations/`                     | Versioned D1 schema changes                                                |
| `scripts/build.mjs`               | Assembles `dist/` for Docker and Cloudflare                                |
| `scripts/deploy.mjs`              | Builds and uploads, reading credentials from `.secrets`                    |
| `bar.js`                          | Turns the bar solid once the page scrolls                                  |
| `blog.js`, `blog-write.js`        | Safe public rendering and the block based editor                           |
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

## Writing the blog

The blog uses **Cloudflare D1** for posts and **Cloudflare R2** for images and
videos. D1 is a SQL database rather than MongoDB, and it is built into Cloudflare,
so the Worker can query it directly without a Mongo connection string or an extra
network service.

- `/blog` lists published posts. `/blog/<address>` shows one post.
- `/blog/write` is the writing desk. Save a draft, publish it, or load an earlier
  post to edit it.
- Start from an article, project story, or photo story template. Add paragraphs,
  headings, images, video, and two or three column sections. The project story
  starts with a challenge and approach pair.
- Posts are validated content blocks, never raw HTML. The public page uses DOM
  text nodes, so a title or paragraph cannot run as a script.
- Images may be JPEG, PNG, WebP or GIF up to 12 MB. Videos may be MP4 or WebM up
  to 32 MB. They are served by the Worker from generated R2 keys.
- Readers with an account can comment on published posts. Comments are plain
  text, render with `textContent`, and are limited to five per reader in ten
  minutes. The blog writing desk keeps its own password and is separate from
  reader accounts.

### Local blog development

Use Wrangler for the blog. The zero dependency Node server serves static files,
but it does not emulate D1 or R2.

```bash
cp .dev.vars.example .dev.vars
# Replace both example values with private values. Keep .dev.vars untracked.
pnpm exec wrangler d1 migrations apply portfolio-blog --local
pnpm dev:worker
```

Open <http://localhost:8787/blog>. Wrangler keeps local D1 and R2 data on your
machine. Do not use `--remote` while writing test posts.

### Cloudflare blog resources

The production D1 database (`portfolio-blog`) and its separate preview database
are bound in both Wrangler configs, and their initial migrations are applied.
The account currently **does not have R2 enabled**. Until R2 is enabled in the
Cloudflare Dashboard, live media uploads return an explanatory error; local R2
emulation works.

After enabling R2, create the two buckets named in the configs:

```bash
pnpm exec wrangler r2 bucket create portfolio-blog-media
pnpm exec wrangler r2 bucket create portfolio-blog-media-preview
```

Set two different secrets on the Worker. Wrangler prompts for each value:

```bash
pnpm exec wrangler secret put BLOG_ADMIN_PASSWORD
pnpm exec wrangler secret put BLOG_SESSION_SECRET
```

Use a password of at least 20 characters and a separate random session secret
of at least 32 characters. Never put either in `wrangler.toml` or in the repo.
The login allows eight guesses per network address in fifteen minutes and stores
only a one way address hash for throttling. The session cookie is secure,
HTTP only, same site, and expires after eight hours. All write requests check the
session and the request origin.

For future schema changes, create a new SQL file in `migrations/` and apply it
deliberately to local, preview, and production:

```bash
pnpm exec wrangler d1 migrations apply portfolio-blog --local
pnpm exec wrangler d1 migrations apply portfolio-blog --remote --preview
pnpm exec wrangler d1 migrations apply portfolio-blog --remote
```

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

## Accounts, orders and comments

Readers can create an account with an email and password. It keeps their orders
in one place and lets them comment on published posts. The blog writing desk is
not part of this: it keeps its own admin password and cannot be reached with a
reader account.

- `/register`, `/login` and `/account` are the pages. The nav link says `Log in`
  until the Worker session says otherwise, then `Account`.
- The API lives under `/api/account`: `session`, `register`, `login`, `logout`,
  `orders`, `orders/reconcile`, `password`, and `DELETE /api/account`.
- Passwords are hashed with PBKDF2 SHA-256, 100,000 iterations (the highest
  Workers accepts), a random salt per account, and a constant time comparison.
  Only the hash is stored.
- Sessions are random 32 byte tokens. The database stores a SHA-256 hash of the
  token, not the token itself, and the cookie is `HttpOnly`, `Secure`,
  `SameSite=Lax`, and lasts thirty days.
- Limits: five registrations per network address per hour, ten failed sign ins
  per address per fifteen minutes, and five comments per reader per ten
  minutes. Addresses are stored only as one way hashes.
- No account email is sent yet, so there is no address confirmation and no
  automatic password reset. The terms say so, and the account page can change or
  delete the account.
- Deleting an account removes its comments and sessions. Orders stay in the
  accounting records with no account attached, as the ten year invoice duty
  requires.
- Comments publish immediately. There is no moderation screen yet: list them
  with `wrangler d1 execute portfolio-blog --remote --command "SELECT id, post_slug, user_id, body, created_at FROM blog_comments ORDER BY created_at DESC"`,
  then delete one by id. A comment is also removed when its author deletes it,
  when the account is deleted, or when the post is deleted.

The schema is in `migrations/0003_accounts.sql`:

```bash
pnpm exec wrangler d1 migrations apply portfolio-blog --local
pnpm exec wrangler d1 migrations apply portfolio-blog --remote
pnpm exec wrangler d1 migrations apply portfolio-blog --remote --preview
```

### Orders from Stripe

When a signed in reader starts a checkout, the Worker adds their account id as
`client_reference_id` and `metadata.user_id`, so the payment can be attributed
without trusting anything the browser sent. Two paths record the order:

1. `POST /api/stripe/webhook` verifies the Stripe signature with
   `STRIPE_WEBHOOK_SECRET` and stores `checkout.session.completed` (and
   `checkout.session.async_payment_succeeded`) events.
2. When Stripe redirects back to `/thanks?session_id=...`, `account.js` asks the
   Worker to retrieve the session and store it if the signed in reader owns it.
   This covers the case where the webhook is delayed.

Create the webhook endpoint in Stripe for the production URL and those two
events, then store its signing secret:

```bash
pnpm exec wrangler secret put STRIPE_WEBHOOK_SECRET
```

A checkout started with JavaScript turned off goes through the Payment Link
fallback and is not attached to an account. The order is still in Stripe and in
the receipt email.

## Tests

`pnpm test` runs fourteen suites:

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
- **blog** — the public blog and writer shells, block types, templates and routes.
- **worker** — drafts stay private, writes require a signed session and same origin,
  login guesses are throttled, posts publish safely, and video media supports byte
  ranges so browser players can seek.
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
- **project** — the promises this project makes about itself: the only runtime
  dependency is Stripe, the pipeline files exist, git stays clean, and
  node_modules never comes back into the index.

`pnpm e2e` runs the browser checks jsdom cannot: axe over every page, the skip
link by keyboard, and the scroll film mounting and moving. `pnpm lighthouse`
asserts accessibility at 100 on the same pages, with reduced motion forced so
the scroll reveals cannot be measured half faded; performance is a warning,
because the film is the point of the front page.

The CI in `.github/workflows/ci.yml` runs format, lint, dead code, size, types,
tests and build in one job, then the browser checks and Lighthouse in two more.

## Auditing the pages

`graph_page_server.py` walks the pages and reports status and bytes.
`graph_page_audit.py` is the same graph with a worker that reads what it
fetches: title and description lengths, headings in order, duplicate ids,
images without alt, links without words or pointing at `#`, dead internal
links, Open Graph tags, inline script and style weight, and the bytes of CSS
and JS each page asks the browser to download.

```bash
pnpm start                       # in one terminal
python3 -m venv .venv
./.venv/bin/pip install langgraph
./.venv/bin/python graph_page_audit.py http://localhost:3000
./.venv/bin/python graph_page_audit.py http://localhost:3000 -v   # notes too
```

It prints a count per level, then every error and warning. Errors are things a
page should not ship; warnings are judgement calls; notes are facts worth
knowing, such as a third party preconnect or a page kept out of search on
purpose. The run on `main` found two level one headings on the front page, a
services description too long for a search result, and missing preview tags on
the private pages. Those are fixed.

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

- **Stripe is live.** The five links charge real cards. Test with a small real
  payment after any change, and keep the live keys out of the repository.
- **Accounts have no email confirmation or automatic password reset.** Adding
  an email provider is the next step before registration is advertised widely.
  Until then the terms explain the manual route, and comments are published
  without moderation.
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

```dotenv
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

# page_server — my portfolio

A five-slide portfolio deck printed on tractor-feed green-bar paper: plain HTML
and CSS, a tiny zero-dependency Node server for local work, and a static build
that ships to Cloudflare or to a Docker container.

## Everyday commands

| Command           | What it does                                                      |
| ----------------- | ----------------------------------------------------------------- |
| `pnpm install`    | Install the dev tools (only needed once, and after a fresh clone) |
| `pnpm start`      | Open it at <http://localhost:3000>                                |
| `pnpm dev`        | The same, but reloads when you edit a file                        |
| `pnpm test`       | Run the tests                                                     |
| `pnpm build`      | Write the deployable site to `dist/`                              |
| `pnpm banner`     | Redraw the HELLO banner                                           |
| `pnpm format`     | Tidy the code with Prettier                                       |
| `pnpm run deploy` | Build and ship `dist/` to Cloudflare                              |

`node_modules/` and `dist/` are not committed — they are built from
`package.json` and the source files.

## What's in here

| Path                              | What it does                                                            |
| --------------------------------- | ----------------------------------------------------------------------- |
| `home.html`                       | The five slide deck, served at `/home` — the words live here            |
| `school.html`                     | The Epitech coursework, served at `/school`                             |
| `style.css`                       | The look: paper, green bars, red accents, the slides                    |
| `index.js`                        | The local server. No dependencies, only Node's own modules              |
| `scripts/build.mjs`               | Assembles `dist/` for Docker and Cloudflare                             |
| `scripts/banner.mjs`              | Draws the banner with figlet                                            |
| `scripts/deploy.mjs`              | Builds and uploads, reading credentials from `.secrets`                 |
| `slides.js`                       | One keypress per slide, and marks the slide you are on                  |
| `world.html`, `world.js`          | The front page: the scroll world, and its config                        |
| `world/`                          | The film: scene sources, the render + motion steps, and `out/`          |
| `test/`                           | Tests for the server, the page, the styles, the build and the pipelines |
| `Dockerfile`, `docker/nginx.conf` | The container that serves `dist/`                                       |
| `.secrets`                        | Your Cloudflare credentials. Gitignored — never committed               |
| `.node-version`                   | Pins the Node version Cloudflare's builder uses                         |
| `wrangler.toml`                   | Cloudflare configuration                                                |

## Editing the text

Everything you might want to change is in `home.html` (the deck) or `world.js`
(the world's copy):

- **Contact details** — search for `juan-felipe.diaz-bustamante` and replace
  the email, and update the GitHub link if you like.
- **Project descriptions** — each project is an `<article class="project">`
  block. Change the text; the links point at the two client sites that live
  next to this folder.
- **Slides** — each slide is a `<section class="slide">`; the number in its
  heading row (`3 / 5`) is plain text, so update it if you add or remove a slide.
- **Where I have worked** — the rows live under `<ul class="werk">`, one
  `.werk-row` each, with the years in the left column.
- **School work** — the coursework is in `school.html`, served at `/school`.

## The banner

The banner is ASCII art drawn with [figlet](https://figlet.org). Instead of
editing it by hand, change the word and run:

```bash
pnpm banner
```

That rewrites the `<pre class="banner">` block in `home.html`. A test checks
the banner still matches a real figlet rendering, so it can never drift.

## How it moves

The page is a five-slide deck printed on one continuous sheet of paper: the
title page, the work, about, and contact. Every slide fills the screen and
snaps into place as you scroll.

- The name and nav bar stay pinned to the top, so any slide can reach any
  other, and each slide prints its own rule as it arrives.
- Slides are numbered in their heading row (`2 / 4`, `3 / 4`), the way a
  printed deck would be.
- The tractor-feed holes advance as you scroll, and a small red print head
  rides down the strip so you can see how far you are.
- Project cards and dot leaders print in as they come into view — the green
  bar sweeps across, then the words settle.
- The "keep scrolling" cue on the title page leaves as soon as you start.

The snapping, the printing and the paper feed are CSS alone
(`animation-timeline` and `scroll-snap-type`). The one script on the page is
`slides.js` — a hundred lines with no imports. It gives the deck one keypress
per slide (arrows, page keys, space, home, end) and marks the slide you are on
in the nav, because CSS snapping on its own would pull a keyboard nudge back
where it started. On a screen too short for a slide, a keypress reveals the
rest of it instead of skipping past the content.

Without that script the page still reads fine — it just scrolls like a long
page. Where scroll timelines or snapping are not supported, or for anyone who
asked their system for reduced motion, the slides stop snapping and everything
appears complete. Printing gives one page per slide, with all of it visible.

## The scroll world

The front page (`/`) is a scroll driven flight through a paper print shop, five
scenes long, with each scene's copy pinned over it. The five slide deck lives at
`/home` (a rewrite to `home.html`), the coursework at `/school`, and the world
links back to both.

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
each layer simply slides at its own speed — 0.45 for the wall, 1 for the hero,
1.25 for the paper sweeping past the lens — and the depth comes from the
difference. Because the camera only ever travels one way, the velocity matches
at every seam, and each wipe begins and ends on the _actual_ frames of the
dives beside it (the `world.test.js` film checks and the preview frames keep
that honest; measured seam difference is 1.4/255, which is encode noise).

`world/engine.js` is the scrub engine from the scroll-world skill, copied
unchanged so it can be pulled from upstream later; `world.js` holds only the
config (sections, copy, accents) and the deck's paper tokens. `world/build` is
scratch and is not committed; `world/out` is the film the site ships.

## Tests

`pnpm test` runs eight suites:

- **server** — routing, content types, redirects, the friendly 404, request
  methods, and that a URL can never climb out of the folders it serves.
- **page** — the words on the page stay human: no terminal jargon, headings in
  order, every link readable, four numbered slides, the banner still genuine
  ASCII art.
- **style** — the paper spans the page, every slide owns a screen, the header
  stays reachable, and no animation can run without either scroll-timeline
  support or a visitor who is happy with motion.
- **build** — `dist/` contains both client sites and the plans, leaks no local
  paths, is repeatable, and has no broken links.
- **deploy** — credentials stay out of git and out of the image, and an
  unfilled `.secrets` template can never look like a real token.
- **slides** — what each keypress does, including the case of a slide taller than the screen, and which slide the nav should mark.
- **world** — the scroll world's config points at assets that exist, the film
  fits Cloudflare's per file limit, the copy keeps to the house rules (no
  hyphens, no cliches, one action), and the vendored engine is intact.
- **project** — the promises this project makes about itself: no runtime
  dependencies, the pipeline files exist, git stays clean.

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

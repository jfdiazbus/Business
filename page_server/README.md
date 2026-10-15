# page_server — my portfolio

A one-page portfolio printed on green-bar paper: plain HTML and CSS, a tiny
zero-dependency Node server for local work, and a static build that ships to
Cloudflare or to a Docker container.

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

| Path                              | What it does                                                |
| --------------------------------- | ----------------------------------------------------------- |
| `page.html`                       | The portfolio itself — all the words live here              |
| `style.css`                       | The look: paper, green bars, red accents                    |
| `index.js`                        | The local server. No dependencies, only Node's own modules  |
| `scripts/build.mjs`               | Assembles `dist/` for Docker and Cloudflare                 |
| `scripts/banner.mjs`              | Draws the banner with figlet                                |
| `test/`                           | Tests for the server, the page, the build and the pipelines |
| `Dockerfile`, `docker/nginx.conf` | The container that serves `dist/`                           |
| `.secrets`                        | Your Cloudflare credentials. Gitignored — never committed   |
| `wrangler.toml`                   | Cloudflare configuration                                    |

## Editing the text

Everything you might want to change is in `page.html`:

- **Contact details** — search for `juan-felipe.diaz-bustamante` and replace
  the email, and update the GitHub link if you like.
- **Project descriptions** — each project is an `<article class="project">`
  block. Change the text; the links point at the two client sites that live
  next to this folder.
- **Skills** — the rows under "What I'm good at".

## The banner

The banner is ASCII art drawn with [figlet](https://figlet.org). Instead of
editing it by hand, change the word and run:

```bash
pnpm banner
```

That rewrites the `<pre class="banner">` block in `page.html`. A test checks
the banner still matches a real figlet rendering, so it can never drift.

## How it moves

The whole page is one sheet of paper, and it behaves like paper going through
a printer:

- The tractor-feed holes on both edges advance as you scroll, and a small red
  print head rides down the strip so you can see how far you are.
- Rules, headings, project cards and dot leaders print in as they come into
  view — the green bar sweeps across, then the words settle.
- The "keep scrolling" cue in the hero leaves as soon as you start.

It is all CSS (`animation-timeline`), so the page still ships no JavaScript.
Where scroll timelines are not supported — or for anyone who asked their
system for reduced motion — the page simply appears complete, and printing it
to PDF always shows everything.

## Tests

`pnpm test` runs five suites:

- **server** — routing, content types, redirects, the friendly 404, request
  methods, and that a URL can never climb out of the folders it serves.
- **page** — the words on the page stay human: no terminal jargon, headings in
  order, every link readable, the banner still genuine ASCII art.
- **style** — the paper really does span the page, the hero owns the first
  screen, and no animation can run without either scroll-timeline support or a
  visitor who is happy with motion.
- **build** — `dist/` contains both client sites and the plans, leaks no local
  paths, is repeatable, and has no broken links.
- **project** — the promises this project makes about itself: no runtime
  dependencies, the pipeline files exist, git stays clean.

## Deploying to Cloudflare

The worker has no code of its own — it only serves `dist/`.

```bash
cd page_server
pnpm run deploy              # builds dist/, then uploads it
pnpm run deploy -- --dry-run # builds and reports, without uploading
```

> `pnpm run deploy`, not `pnpm deploy`: pnpm has its own `deploy` command for
> workspaces, so the short form silently runs the wrong thing.

### Signing in

Pick whichever suits you:

**On your own machine — log in once.** No keys to handle:

```bash
pnpm exec wrangler login
pnpm run deploy
```

**With an API token — for scripts, containers, CI.** Put the two values in
`page_server/.secrets` (it is gitignored, and `pnpm run deploy` reads it for
you):

```
CLOUDFLARE_API_TOKEN=your-token-here
CLOUDFLARE_ACCOUNT_ID=your-account-id-here
```

### Getting the API token

1. Sign in to the [Cloudflare dashboard](https://dash.cloudflare.com) and open
   **My Profile → API Tokens**.
2. Select **Create Token**.
3. Under templates, choose **Edit Cloudflare Workers**. (It grants the token
   permission to publish workers, and nothing else.)
4. Leave the token name as the template filled it in — something like
   _Edit Cloudflare Workers_ — and set **Account Resources** to your own
   account. Add a **Zone** resource too if the site will live on a domain you
   already have in Cloudflare.
5. Select **Continue to summary**, check it reads _Workers Scripts: Edit_, then
   select **Create Token**.
6. Copy the token now: Cloudflare shows it **once**. It looks like
   `cfut_...`. Paste it into the `CLOUDFLARE_API_TOKEN=` line of `.secrets`.

### Getting the account ID

In the same dashboard, go to **Workers & Pages**: the **Account ID** is listed
in the right-hand column (it is also the long hash in the dashboard URL). Paste
it into the `CLOUDFLARE_ACCOUNT_ID=` line of `.secrets`.

Or, after logging in, ask wrangler:

```bash
pnpm exec wrangler whoami      # prints the account ID and the token's status
```

### Every push to `main`

`.github/workflows/deploy.yml` runs the tests, builds the site and deploys it.
It needs the same two values as repository secrets — **Settings → Secrets and
variables → Actions → New repository secret**:

| Secret                  | Value                     |
| ----------------------- | ------------------------- |
| `CLOUDFLARE_API_TOKEN`  | the token from above      |
| `CLOUDFLARE_ACCOUNT_ID` | the account ID from above |

`.github/workflows/ci.yml` runs the tests, the formatting check and the build
on every push and pull request, so nothing reaches Cloudflare untested.

### Keeping the token safe

- Never paste it into `wrangler.toml`, `page.html`, an issue or a chat: it is
  the key to your account. `.secrets` is gitignored and excluded from the
  Docker image for that reason.
- It is shown only once. If it leaks, delete it in **My Profile → API Tokens**
  and create a new one — a token can be revoked at any moment.
- Tokens start with `cfut_`, which lets secret scanners spot them in a
  repository.
- Set an expiry date on the token if you would rather rotate it yearly.

Change `name` in `wrangler.toml` if you want a different worker name.

## Running it in Docker

The container needs the client sites that sit beside this folder, so build
from the repository root:

```bash
docker build -f page_server/Dockerfile -t portfolio .
docker run --rm -p 8080:80 portfolio
```

Then open <http://localhost:8080>. The image is nginx plus the built folder,
so it needs no `node_modules` and no Node at runtime.

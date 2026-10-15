# page_server — my portfolio

A one-page portfolio printed on green-bar paper: plain HTML and CSS, a tiny
zero-dependency Node server for local work, and a static build that ships to
Cloudflare or to a Docker container.

## Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install the dev tools (only needed once, and after a fresh clone) |
| `pnpm start` | Open it at <http://localhost:3000> |
| `pnpm dev` | The same, but reloads when you edit a file |
| `pnpm test` | Run the tests |
| `pnpm build` | Write the deployable site to `dist/` |
| `pnpm banner` | Redraw the HELLO banner |
| `pnpm format` | Tidy the code with Prettier |
| `pnpm deploy` | Ship `dist/` to Cloudflare |

`node_modules/` and `dist/` are not committed — they are built from
`package.json` and the source files.

## What's in here

| Path | What it does |
| --- | --- |
| `page.html` | The portfolio itself — all the words live here |
| `style.css` | The look: paper, green bars, red accents |
| `index.js` | The local server. No dependencies, only Node's own modules |
| `scripts/build.mjs` | Assembles `dist/` for Docker and Cloudflare |
| `scripts/banner.mjs` | Draws the banner with figlet |
| `test/` | Tests for the server, the page, the build and the pipelines |
| `Dockerfile`, `docker/nginx.conf` | The container that serves `dist/` |
| `wrangler.toml` | Cloudflare configuration |

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

## Tests

`pnpm test` runs four suites:

- **server** — routing, content types, redirects, the friendly 404, request
  methods, and that a URL can never climb out of the folders it serves.
- **page** — the words on the page stay human: no terminal jargon, headings in
  order, every link readable, the banner still genuine ASCII art.
- **build** — `dist/` contains both client sites and the plans, leaks no local
  paths, is repeatable, and has no broken links.
- **project** — the promises this project makes about itself: no runtime
  dependencies, the pipeline files exist, git stays clean.

## Deploying to Cloudflare

The worker has no code of its own — it only serves `dist/`.

```bash
pnpm build
pnpm deploy          # runs: wrangler deploy
```

The first time, run `npx wrangler login`, or set `CLOUDFLARE_API_TOKEN` in the
environment. Change `name` in `wrangler.toml` if you want a different worker
name.

Every push to `main` also deploys, through `.github/workflows/deploy.yml`.
That workflow needs two repository secrets:

| Secret | Where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → *Edit Cloudflare Workers* template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → right-hand sidebar |

`.github/workflows/ci.yml` runs the tests, the formatting check and the build
on every push and pull request.

## Running it in Docker

The container needs the client sites that sit beside this folder, so build
from the repository root:

```bash
docker build -f page_server/Dockerfile -t portfolio .
docker run --rm -p 8080:80 portfolio
```

Then open <http://localhost:8080>. The image is nginx plus the built folder,
so it needs no `node_modules` and no Node at runtime.

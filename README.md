# Business

The repository behind <https://portfolio.jfdiazbus.workers.dev>: a portfolio, the
client work and plans it shows, and the machinery that ships them.

Everything here is plain HTML, CSS and JavaScript. No framework, no runtime
dependency, no build step beyond copying files.

## What is in here

| Path                                       | What it is                                                                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `page_server/`                             | **The site.** The portfolio, the school page, the prices with Stripe, the terms, and the scroll film on the front page      |
| `promptops-ai/`                            | A client site: the website and the pitch                                          |
| `omniprompt-marketing/`                    | A client site: the website and the pitch                                          |
| `ai_business_plan.md`                      | The business plan behind the AI automation agency                                    |
| `ai_marketing_automation_business_plan.md` | The business plan behind the AI marketing automation agency                           |
| `package.json`, `wrangler.toml`             | A fallback so Cloudflare can build from the repository root as well as from `page_server/` |

The two client sites and the two plans are copied into the built site by
`page_server/scripts/build.mjs`, which is why they sit beside `page_server/`
rather than inside it.

## Working on the site

Start with **[`page_server/README.md`](page_server/README.md)**: running it
locally, the tests, taking payments, and deploying to Cloudflare. The design
decisions, and the rules a change has to keep, are in
**[`page_server/docs/style.md`](page_server/docs/style.md)**.

```bash
cd page_server
pnpm install     # once
pnpm dev         # http://localhost:3000
pnpm test        # 161 tests, twelve suites
pnpm build       # writes dist/
pnpm run deploy  # builds, then ships to Cloudflare
```

From the repository root, `pnpm build` runs the same build (it forwards to
`page_server/scripts/build.mjs`). That is what Cloudflare runs when its root
directory is left unset.

## How the site is put together

- **Static, and it stays static.** One stylesheet, one small script for the bar,
  one for the film's gestures. Nothing else runs in the browser.
- **`/` is a film.** Five scenes drawn by hand, rendered to transparent PNGs with
  headless Chrome, animated with ffmpeg, and scrubbed by scroll position. The
  pipeline is in `page_server/world/`, and `node world/render.mjs` followed by
  `node world/motion.mjs` rebuilds it.
- **`/services` takes payment** through Stripe Payment Links, so no secret key
  exists anywhere in this repository. It is in sandbox mode until the account is
  activated: the README explains what that means and what going live requires.
- **The build copies everything into `page_server/dist/`**, and a Cloudflare
  Worker serves that folder.

## Branches and pull requests

Work happens on a branch, and every pull request carries the reason for the
change in its commits rather than only in the description. The commit messages
start with `[ADD]`, `[CHANGE]` or `[FIX]`.

`main` is what Cloudflare deploys, so it is kept working: the CI workflow runs
the tests and the build on every pull request.

## Copy and artwork

The code is mine. The client work and the business plans in here were made for,
or about, specific companies: ask before reusing the copy or the artwork.

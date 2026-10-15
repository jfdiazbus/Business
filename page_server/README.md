# page_server — my portfolio

A one-page portfolio printed on green-bar paper. Plain HTML + CSS + a tiny
Node server, no frameworks.

## How to open it

```bash
npm start        # or: pnpm start
```

Then open <http://localhost:3000> in your browser.

## What's in here

| File | What it does |
| --- | --- |
| `page.html` | The portfolio itself — all the text lives here |
| `style.css` | The look: paper, green bars, red accents |
| `index.js` | Serves the page, plus the two client sites and the business plans |
| `assets/figlet/` | The fonts used to draw the HELLO banner |

## Editing the text

Everything you might want to change is in `page.html`:

- **Contact details** — search for `juan-felipe.diaz-bustamante` and replace
  with your email, and update the GitHub link if needed.
- **Project descriptions** — each project is an `<article class="project">`
  block. Change the text between the tags; the links point at the two client
  sites that live next to this folder.
- **Skills** — the rows under "What I'm good at".

## Changing the HELLO banner

The banner is text drawn with [figlet](https://figlet.org). The fonts are
saved in `assets/figlet/`, so you can make a new one:

```bash
figlet -f assets/figlet/big.flf HELLO
```

Paste the output into the `<pre class="banner">` block in `page.html`, one
line per `<span class="line">`. The banner automatically sizes itself to the
screen, but keep it about the same number of characters wide (35 works well).

// The scroll world: five printed scenes, one continuous glide, scrubbed by
// scroll position. This file is only configuration and the gesture layer — the
// engine beside it (world/engine.js) is the vendored scrub engine from the
// scroll-world skill, kept byte for byte so it can be updated from upstream.
//
// The scenes are hand drawn in world/scenes.mjs and rendered by
// world/render.mjs + world/motion.mjs. Copy follows the same voice as the deck:
// plain language, benefit first, one action.

export const world = {
  brand: { name: "Juan Felipe", href: "/home" },
  hint: "scroll to walk through the print shop",
  // short enough that one gesture carries you to the next scene
  diveScroll: 0.7,
  connScroll: 0.4,
  crossfade: 0.14,

  sections: [
    {
      id: "presentation",
      label: "Presentation",
      // the version is bumped when the film's bytes change, so a browser that
      // already cached the old clips fetches the new ones
      still: "/world/still-1.webp?v=3",
      clip: "/world/dive-1.mp4?v=3",
      accent: "#ff6b5a",
      scroll: 1.1,
      linger: 0.35,
      eyebrow: "Hello",
      title: "Presentation",
      body: "Websites, presentations and small tools, mostly for companies that work with AI. Plain HTML and CSS, so pages load fast on any phone and stay easy to edit.",
      tags: ["Websites", "Presentations", "Small tools"],
    },
    {
      id: "education",
      label: "Education",
      still: "/world/still-2.webp?v=3",
      clip: "/world/dive-2.mp4?v=3",
      accent: "#ff6b5a",
      eyebrow: "Epitech, since 2025",
      title: "Education",
      body: "A software engineering degree built on projects: a task manager with real accounts and sessions, a shell written in C, and a dashboard built from a dataset, plus a lot of smaller C projects along the way.",
      tags: ["Epitech", "C", "Python"],
    },
    {
      id: "experience",
      label: "Experience",
      still: "/world/still-3.webp?v=3",
      clip: "/world/dive-3.mp4?v=3",
      accent: "#ff6b5a",
      eyebrow: "Barcelona",
      title: "Experience",
      body: "At MigaLabs I build the front end of the lab's own site: the design system, the dashboards, the list and detail pages, and the animated Ethereum Academy lessons. Before that I was an IT intern at Alvatroz Partners.",
      tags: ["MigaLabs", "Alvatroz Partners", "Barcelona"],
    },
    {
      id: "projects",
      label: "Projects",
      still: "/world/still-4.webp?v=3",
      clip: "/world/dive-4.mp4?v=3",
      accent: "#ff6b5a",
      eyebrow: "Built end to end",
      title: "Projects",
      body: "EpyTodo, a task manager with proper accounts; Tardis, a dashboard built from a dataset with a model behind it; minishell, a shell written in C; and this site, hand coded with HTML and CSS.",
      tags: ["EpyTodo", "Tardis", "minishell"],
    },
    {
      id: "contact",
      label: "Contact",
      still: "/world/still-5.webp?v=3",
      clip: "/world/dive-5.mp4?v=3",
      accent: "#ff6b5a",
      scroll: 1.1,
      linger: 0.35,
      eyebrow: "Get in touch",
      title: "Contact",
      body: "One short email about what you need and when. I answer within a day, with a price and a first sketch.",
      tags: [],
      cta: {
        primary: {
          label: "Email me",
          href: "https://mail.google.com/mail/?view=cm&fs=1&to=jfdiazbus%40gmail.com",
        },
        secondary: { label: "See services", href: "/services" },
      },
    },
  ],

  connectors: [
    "/world/wipe-1.mp4?v=3",
    "/world/wipe-2.mp4?v=3",
    "/world/wipe-3.mp4?v=3",
    "/world/wipe-4.mp4?v=3",
  ],
};

const GESTURE = { ArrowDown: 1, PageDown: 1, " ": 1, ArrowUp: -1, PageUp: -1 };

/**
 * Which scene a gesture asks for, or null to leave it to the browser.
 *
 * One wheel notch or one keypress is one scene: the film is a deck of five
 * scenes and scrolling through a whole clip frame by frame makes it feel like
 * a long page instead.
 */
export function sceneStep({ key = null, delta = 0, index, count }) {
  if (key === "Home") return 0;
  if (key === "End") return count - 1;

  const direction = key ? GESTURE[key] : Math.sign(delta);
  if (!direction) return null;

  const to = Math.min(count - 1, Math.max(0, index + direction));
  return to === index ? null : to;
}

if (typeof document !== "undefined" && typeof mountScrollWorld === "function") {
  mountScrollWorld(document.getElementById("world"), world);

  // The engine already renders a route dot per scene and its own jumpTo(), so
  // the gesture layer just presses the right dot: one source of layout maths.
  const dots = () => [...document.querySelectorAll(".sw-route__dot")];
  const currentScene = (list) =>
    Math.max(
      0,
      list.findIndex((dot) => dot.classList.contains("is-active")),
    );
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The engine draws one dot per scene but gives them no accessible name, and
  // the engine is vendored, so they are named here instead.
  const nameDots = (list) => {
    list.forEach((dot, index) => {
      const section = world.sections[index];
      if (section && !dot.getAttribute("aria-label")) {
        dot.setAttribute("aria-label", `Go to ${section.label.toLowerCase()}`);
      }
      dot.setAttribute("aria-current", dot.classList.contains("is-active") ? "true" : "false");
    });
  };

  const seen = dots();
  nameDots(seen);

  // scrolling moves the active dot, so keep the announcement in step
  if (typeof MutationObserver === "function") {
    const observer = new MutationObserver(() => nameDots(dots()));
    for (const dot of seen) observer.observe(dot, { attributes: true, attributeFilter: ["class"] });
  }

  let lockedUntil = 0;
  const LOCK = 700; // ms; a smooth jump takes about this long

  const moveTo = (index) => {
    const list = dots();
    if (!list.length || !list[index]) return false;

    list[index].click();
    lockedUntil = Date.now() + LOCK;
    return true;
  };

  const handle = (event, key, delta) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest("input, textarea, select, a"))
      return;

    const list = dots();
    const move = sceneStep({ key, delta, index: currentScene(list), count: list.length });
    if (move === null) return;

    event.preventDefault();
    if (Date.now() < lockedUntil) return; // swallow the rest of the same gesture
    moveTo(move);
  };

  if (!calm()) {
    // wheel is only ever a desktop gesture; touch keeps its native scrolling
    addEventListener("wheel", (event) => handle(event, null, event.deltaY), { passive: false });
  }

  addEventListener("keydown", (event) => handle(event, event.key, 0));
}

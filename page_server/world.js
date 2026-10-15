// The scroll world: five printed scenes, one continuous glide, scrubbed by
// scroll position. This file is only configuration — the engine beside it
// (world/engine.js) is the vendored scrub engine from the scroll-world skill,
// kept byte for byte so it can be updated from upstream.
//
// The scenes are hand drawn in world/scenes.mjs and rendered by
// world/render.mjs + world/motion.mjs. Copy follows the same voice as the deck:
// plain language, benefit first, one action.

export const world = {
  brand: { name: "Juan Felipe", href: "/" },
  hint: "scroll to walk through the print shop",
  diveScroll: 1.25,
  connScroll: 0.8,
  crossfade: 0.14,

  sections: [
    {
      id: "print-room",
      label: "The print room",
      still: "/world/still-1.webp",
      clip: "/world/dive-1.mp4",
      accent: "#b03024",
      scroll: 1.5,
      linger: 0.35,
      eyebrow: "Hello",
      title: "Websites, presentations and small tools.",
      body: "Mostly for companies that work with AI. Plain HTML and CSS, so pages load fast on any phone and stay easy to edit.",
      tags: ["Websites", "Presentations", "Small tools"],
    },
    {
      id: "workbench",
      label: "The workbench",
      still: "/world/still-2.webp",
      clip: "/world/dive-2.mp4",
      accent: "#6f8f5f",
      eyebrow: "Selected work",
      title: "Two sites, taken end to end.",
      body: "Two client sites with calculators, clear prices and lead forms, plus a 12 slide deck for each.",
      tags: ["OmniPrompt Marketing", "PromptOps AI"],
    },
    {
      id: "type-tray",
      label: "The type tray",
      still: "/world/still-3.webp",
      clip: "/world/dive-3.mp4",
      accent: "#5f5c52",
      eyebrow: "How I work",
      title: "No frameworks, nothing to maintain.",
      body: "If it opens in a browser it works, which keeps hosting cheap and the code easy to hand over.",
      tags: ["HTML", "CSS", "JavaScript"],
    },
    {
      id: "archive-shelf",
      label: "The archive shelf",
      still: "/world/still-4.webp",
      clip: "/world/dive-4.mp4",
      accent: "#8a6a3f",
      eyebrow: "Beyond the code",
      title: "I write the plans and the prices.",
      body: "Positioning, packaging and pricing, so the site says something a customer wants to read.",
      tags: ["Plans", "Pricing", "Copy"],
    },
    {
      id: "mail-slot",
      label: "The mail slot",
      still: "/world/still-5.webp",
      clip: "/world/dive-5.mp4",
      accent: "#b03024",
      scroll: 1.5,
      linger: 0.35,
      eyebrow: "Get in touch",
      title: "Tell me what you want to build.",
      body: "One short email about what you need and when. I answer within a day, with a price and a first sketch.",
      tags: [],
      cta: {
        primary: { label: "Email me", href: "mailto:juan-felipe.diaz-bustamante@epitech.eu" },
        secondary: { label: "Read the four slide version", href: "/" },
      },
    },
  ],

  connectors: ["/world/wipe-1.mp4", "/world/wipe-2.mp4", "/world/wipe-3.mp4", "/world/wipe-4.mp4"],
};

if (typeof document !== "undefined" && typeof mountScrollWorld === "function") {
  mountScrollWorld(document.getElementById("world"), world);
}

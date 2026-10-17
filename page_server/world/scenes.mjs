// The five scenes of the print shop, drawn as layered cardstock.
//
// Each scene returns four layers, back to front. The motion step slides each
// layer at a different rate, which is what gives a locked isometric camera its
// depth: the further back a layer is, the slower it drifts — and because the
// camera only ever travels one way, everything stays inside the stage.
//
// Composition recipe, so five hand-made scenes read as one world:
//   - horizon at HORIZON, wall above, green-bar floor below
//   - the hero stands on the floor, centred on HERO_X, and stays in frame for
//     the whole glide (see CAM in motion.mjs)
//   - wall items stand on small shelf boards (nothing floats)
//   - one big sheet sweeps past the lens on the foreground layer

import {
  P,
  box,
  floorSheet,
  grainOverlay,
  labelText,
  layerSvg,
  paperStack,
  pencil,
  poly,
  printedLines,
  printer,
  projector,
  shadow,
  sheet,
  shelfBoard,
  shelfSheet,
  spool,
  sprocketEdge,
} from "./kit.mjs";

export const LAYER_W = 4600;
export const LAYER_H = 2160;
export const HORIZON = 1180;
export const HERO_X = 2260;
export const HERO_Y = 1230;

/** The paper world: a wall of cardstock, a floor of green-bar sheet. */
function backdrop() {
  const bands = [];
  for (let y = HORIZON + 70; y < LAYER_H; y += 148) {
    bands.push(
      `<rect x="0" y="${y}" width="${LAYER_W}" height="72" fill="${P.bar}" opacity="0.85"/>`,
    );
  }
  const holes = [];
  for (let x = 30; x < LAYER_W; x += 88) {
    holes.push(
      `<circle cx="${x}" cy="${HORIZON + 26}" r="8" fill="${P.paperDeep}" opacity="0.6"/>`,
    );
  }
  return [
    `<rect x="0" y="0" width="${LAYER_W}" height="${LAYER_H}" fill="${P.wall}"/>`,
    `<rect x="0" y="${HORIZON - 120}" width="${LAYER_W}" height="120" fill="${P.wallDeep}" opacity="0.45"/>`,
    `<rect x="0" y="${HORIZON - 14}" width="${LAYER_W}" height="14" fill="${P.paperDeep}" opacity="0.55"/>`,
    `<rect x="0" y="${HORIZON}" width="${LAYER_W}" height="${LAYER_H - HORIZON}" fill="${P.paperLight}"/>`,
    bands.join(""),
    holes.join(""),
  ].join("");
}

/** A shelf board on the wall, with sheets standing on it. */
function board(atX, atY, { dx = 3.4, items = [] }) {
  const p = projector(atX, atY);
  const parts = [shelfBoard(p, { x: 0, y: 0, z: 0, dx, dy: 0.9 })];
  let cursor = 0.28;

  for (const item of items) {
    const w = item.w ?? 1.5;
    parts.push(
      shelfSheet(p, {
        x: cursor,
        y: 0.16,
        z: 0.18,
        w,
        h: item.h ?? 1.15,
        marks: item.marks ?? 3,
        accent: item.accent,
        label: item.label,
      }),
    );
    cursor += w + 0.34;
  }

  return parts.join("");
}

// ---------------------------------------------------------------- scene 1 ---
// The print room: a tractor-feed printer laying down the banner.

function printRoom() {
  const hero = [
    printer(projector(HERO_X, HERO_Y), {
      x: 0,
      y: 0,
      w: 6.8,
      d: 4.4,
      h: 2.1,
      banner: "PRESENTATION",
      marks: 2,
    }),
    paperStack(projector(HERO_X - 820, HERO_Y + 150), { x: 0, y: 0, w: 2.6, d: 2, sheets: 6 }),
    spool(projector(HERO_X + 760, HERO_Y + 210), { x: 0, y: 0, r: 0.95, h: 0.8 }),
  ].join("");

  const mid = [
    board(1460, 1006, {
      dx: 3.6,
      items: [
        { w: 1.5, h: 1.15, accent: P.barMid },
        { w: 1.4, h: 1.3, marks: 4 },
      ],
    }),
    board(2760, 1020, { dx: 3.2, items: [{ w: 1.6, h: 1.25, accent: P.ribbon, label: "PRINT" }] }),
    paperStack(projector(3300, 1290), { x: 0, y: 0, w: 2.4, d: 1.8, sheets: 5 }),
  ].join("");

  const fore = [
    floorSheet(projector(2180, 1600), { x: 0, y: 0, dx: 7, dy: 4.2, marks: 3 }),
    pencil(projector(HERO_X + 640, HERO_Y + 300), { x: 0, y: 0, z: 0.02, length: 3.4 }),
  ].join("");

  return { back: backdrop(), mid, subject: hero, fore };
}

// ---------------------------------------------------------------- scene 2 ---
// The workbench: the two client sites, as standing sheets on the bench.

function workbench() {
  const p = projector(HERO_X - 120, HERO_Y);
  const legs = [
    [0.6, 0.5],
    [8.3, 0.5],
    [0.6, 2.1],
    [8.3, 2.1],
  ].map(([gx, gy]) =>
    box(p, {
      x: gx,
      y: gy,
      z: 0,
      dx: 0.55,
      dy: 0.55,
      dz: 1.7,
      top: P.paperMid,
      right: P.paperDark,
      left: P.paperDeep,
    }),
  );

  const site = (gx, gy, tone) => [
    box(p, {
      x: gx + 0.2,
      y: gy + 0.1,
      z: 1.92,
      dx: 0.4,
      dy: 0.4,
      dz: 0.4,
      top: P.paperMid,
      right: P.paperDark,
      left: P.paperDeep,
      sw: 1.6,
    }),
    sheet(p, { x: gx, y: gy, z: 2.3, w: 3, h: 2.1, fill: P.paper }),
    poly(
      [
        p(gx, gy - 0.02, 4.0),
        p(gx + 3, gy - 0.02, 4.0),
        p(gx + 3, gy - 0.02, 4.34),
        p(gx, gy - 0.02, 4.34),
      ],
      `fill="${tone}"`,
    ),
    printedLines(p, {
      x: gx + 0.28,
      y: gy - 0.03,
      z: 2.75,
      w: 2.44,
      rows: 3,
      lead: 0.34,
      inset: 0.22,
      size: 0.12,
    }),
    poly(
      [
        p(gx + 0.3, gy - 0.03, 2.42),
        p(gx + 1.5, gy - 0.03, 2.42),
        p(gx + 1.5, gy - 0.03, 2.62),
        p(gx + 0.3, gy - 0.03, 2.62),
      ],
      `fill="${P.ribbon}" opacity="0.85"`,
    ),
    labelText(
      p(gx + 0.05, gy - 0.04, 4.62)[0],
      p(gx + 0.05, gy - 0.04, 4.62)[1],
      tone === P.barMid ? "EPITECH" : "2025",
      { size: 24, fill: P.inkSoft, weight: 600 },
    ),
  ];

  const hero = [
    shadow(p, { x: -0.6, y: -0.6, dx: 9.6, dy: 3.4, spread: 0.5, opacity: 0.28 }),
    box(p, {
      x: 0,
      y: 0,
      z: 0,
      dx: 9.4,
      dy: 2.8,
      dz: 1.2,
      top: P.paperMid,
      right: P.paperMid,
      left: P.paperDark,
      sw: 2.2,
    }),
    box(p, {
      x: 0,
      y: 0,
      z: 1.7,
      dx: 9.4,
      dy: 2.8,
      dz: 0.36,
      top: P.paperLight,
      right: P.paperMid,
      left: P.paperDark,
    }),
    legs.join(""),
    ...site(0.9, 0.9, P.barMid),
    ...site(5.4, 1.1, P.barDeep),
    box(p, {
      x: 1.2,
      y: 2.5,
      z: 2.06,
      dx: 1.8,
      dy: 0.26,
      dz: 0.26,
      top: P.ribbon,
      right: P.ribbonDeep,
      left: P.ribbonDeep,
      sw: 1.8,
    }),
  ].join("");

  const mid = [
    board(1560, 1010, {
      dx: 3.4,
      items: [
        { w: 1.5, h: 1.2, marks: 4 },
        { w: 1.3, h: 1.1, accent: P.barMid },
      ],
    }),
    board(2860, 1030, {
      dx: 2.8,
      items: [{ w: 1.5, h: 1.2, accent: P.ribbon, label: "EDUCATION" }],
    }),
    box(projector(3360, 1300), {
      x: 0,
      y: 0,
      z: 0,
      dx: 2.2,
      dy: 1.8,
      dz: 1.5,
      top: P.paperLight,
      right: P.paperMid,
      left: P.paperDark,
    }),
  ].join("");

  const fore = [
    floorSheet(projector(2240, 1620), { x: 0, y: 0, dx: 6.6, dy: 4, marks: 2 }),
    spool(projector(HERO_X + 1080, HERO_Y + 320), { x: 0, y: 0, r: 1, h: 0.75 }),
  ].join("");

  return { back: backdrop(), mid, subject: hero, fore };
}

// ---------------------------------------------------------------- scene 3 ---
// The type tray: paper, one printer, nothing heavy.

function typeTray() {
  const p = projector(HERO_X - 200, HERO_Y);
  const strips = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const x = 0.9 + col * 0.86;
      const y = 0.9 + row * 0.92;
      strips.push(
        box(p, {
          x,
          y,
          z: 1.06,
          dx: 0.68,
          dy: 0.66,
          dz: 0.1,
          top: P.paper,
          right: P.paperMid,
          left: P.paperDark,
          sw: 1.4,
        }),
        poly(
          [
            p(x + 0.1, y + 0.08, 1.16),
            p(x + 0.54, y + 0.08, 1.16),
            p(x + 0.54, y + 0.08, 1.28),
            p(x + 0.1, y + 0.08, 1.28),
          ],
          `fill="${row === 1 && col === 3 ? P.ribbon : P.inkFaint}" opacity="0.7"`,
        ),
      );
    }
  }

  const hero = [
    shadow(p, { x: -0.6, y: -0.6, dx: 7.4, dy: 4.8, spread: 0.55, opacity: 0.3 }),
    box(p, {
      x: 0,
      y: 0,
      z: 0,
      dx: 6.8,
      dy: 4.3,
      dz: 0.75,
      top: P.paperMid,
      right: P.paperDark,
      left: P.paperDeep,
    }),
    box(p, {
      x: 0.55,
      y: 0.55,
      z: 0.75,
      dx: 5.7,
      dy: 3.2,
      dz: 0.3,
      top: P.paperDeep,
      right: P.paperDeep,
      left: P.paperDeep,
      sw: 2,
    }),
    strips.join(""),
    sheet(p, { x: 6.2, y: 3.4, z: 0.75, w: 2.6, h: 2.4, fill: P.paperLight }),
    printedLines(p, {
      x: 6.45,
      y: 3.48,
      z: 1.55,
      w: 2.1,
      rows: 3,
      lead: 0.36,
      inset: 0.24,
      size: 0.13,
    }),
    poly(
      [p(6.45, 3.47, 3.15), p(8.2, 3.47, 3.15), p(8.2, 3.47, 3.4), p(6.45, 3.47, 3.4)],
      `fill="${P.ribbon}" opacity="0.9"`,
    ),
    spool(p, { x: 6.5, y: 0.7, z: 1.0, r: 0.8, h: 0.6 }),
  ].join("");

  const mid = [
    board(1700, 1010, {
      dx: 3.2,
      items: [{ w: 1.6, h: 1.2, accent: P.barMid, label: "EXPERIENCE" }],
    }),
    board(2960, 1030, { dx: 3, items: [{ w: 1.4, h: 1.15, marks: 3, label: "MIGALABS" }] }),
    box(projector(3300, 1280), {
      x: 0,
      y: 0,
      z: 0,
      dx: 2.6,
      dy: 0.5,
      dz: 0.32,
      top: P.paperLight,
      right: P.paperMid,
      left: P.paperDark,
      sw: 2,
    }),
    box(projector(3300, 1206), {
      x: 0,
      y: 0,
      z: 0,
      dx: 2.6,
      dy: 0.5,
      dz: 0.32,
      top: P.paperLight,
      right: P.paperMid,
      left: P.paperDark,
      sw: 2,
    }),
  ].join("");

  const fore = [
    floorSheet(projector(2300, 1610), { x: 0, y: 0, dx: 6.4, dy: 3.8, marks: 3 }),
    pencil(projector(HERO_X + 700, HERO_Y + 320), { x: 0, y: 0, z: 0.02, length: 3.2 }),
  ].join("");

  return { back: backdrop(), mid, subject: hero, fore };
}

// ---------------------------------------------------------------- scene 4 ---
// The archive shelf: bound plans and pricing notes.

function archiveShelf() {
  const p = projector(HERO_X - 300, HERO_Y - 60);
  const tones = [P.paper, P.bar, P.paperLight, P.paper, P.barMid, P.paper, P.paperLight];
  const sleeves = [];
  for (let i = 0; i < 7; i += 1) {
    const x = 0.85 + i * 0.78;
    sleeves.push(
      box(p, {
        x,
        y: 0.5,
        z: 2.55,
        dx: 0.62,
        dy: 2.2,
        dz: 1.95,
        top: tones[i % tones.length],
        right: P.paperMid,
        left: P.paperDark,
        sw: 1.8,
      }),
      poly(
        [
          p(x + 0.1, 0.48, 3.6),
          p(x + 0.52, 0.48, 3.6),
          p(x + 0.52, 0.48, 3.95),
          p(x + 0.1, 0.48, 3.95),
        ],
        `fill="${i === 2 ? P.ribbon : P.paperDeep}" opacity="0.92"`,
      ),
    );
  }

  const hero = [
    shadow(p, { x: -0.7, y: -0.5, dx: 6.6, dy: 3.4, spread: 0.5, opacity: 0.3 }),
    box(p, {
      x: 0,
      y: 0,
      z: 0,
      dx: 0.55,
      dy: 2.5,
      dz: 5,
      top: P.paperMid,
      right: P.paperDark,
      left: P.paperDeep,
    }),
    box(p, {
      x: 6.05,
      y: 0,
      z: 0,
      dx: 0.55,
      dy: 2.5,
      dz: 5,
      top: P.paperMid,
      right: P.paperDark,
      left: P.paperDeep,
    }),
    box(p, {
      x: 0.55,
      y: 0,
      z: 2.4,
      dx: 5.5,
      dy: 2.5,
      dz: 0.22,
      top: P.paperLight,
      right: P.paperMid,
      left: P.paperDark,
      sw: 2,
    }),
    box(p, {
      x: 0.55,
      y: 0,
      z: 4.75,
      dx: 5.5,
      dy: 2.5,
      dz: 0.22,
      top: P.paperLight,
      right: P.paperMid,
      left: P.paperDark,
      sw: 2,
    }),
    sleeves.join(""),
    box(p, {
      x: 1.2,
      y: 3.1,
      z: 1.5,
      dx: 3,
      dy: 1.6,
      dz: 0.28,
      top: P.paperLight,
      right: P.paperMid,
      left: P.paperDark,
    }),
    box(p, {
      x: 1.6,
      y: 3.5,
      z: 0,
      dx: 0.45,
      dy: 0.45,
      dz: 1.5,
      top: P.paperMid,
      right: P.paperDark,
      left: P.paperDeep,
    }),
    sheet(p, { x: 1.4, y: 3.0, z: 1.78, w: 2.6, h: 1.5, fill: P.paper }),
    printedLines(p, {
      x: 1.62,
      y: 2.99,
      z: 2.15,
      w: 2.1,
      rows: 3,
      lead: 0.26,
      inset: 0.2,
      size: 0.1,
    }),
    labelText(p(1.66, 2.98, 2.9)[0], p(1.66, 2.98, 2.9)[1], "PROJECTS", {
      size: 22,
      fill: P.ribbon,
      weight: 700,
    }),
  ].join("");

  const mid = [
    board(1500, 1010, {
      dx: 3.2,
      items: [
        { w: 1.5, h: 1.2, marks: 3 },
        { w: 1.2, h: 1.05, accent: P.ribbon },
      ],
    }),
    board(2900, 1030, { dx: 3, items: [{ w: 1.6, h: 1.25, marks: 4 }] }),
    box(projector(3420, 1300), {
      x: 0,
      y: 0,
      z: 0,
      dx: 2,
      dy: 1.8,
      dz: 1.6,
      top: P.paperLight,
      right: P.paperMid,
      left: P.paperDark,
    }),
  ].join("");

  const fore = [
    floorSheet(projector(2260, 1620), { x: 0, y: 0, dx: 6.8, dy: 4.2, marks: 2 }),
    spool(projector(HERO_X + 1020, HERO_Y + 330), { x: 0, y: 0, r: 0.95, h: 0.7 }),
  ].join("");

  return { back: backdrop(), mid, subject: hero, fore };
}

// ---------------------------------------------------------------- scene 5 ---
// The mail slot: letters on their way out.

function mailSlot() {
  const p = projector(HERO_X - 160, HERO_Y - 40);

  // letters standing in the tray, one already lifted clear of it
  const letter = (gx, gy, { w = 1.9, h = 1.2, lift = 0, tilt = 0, seal = false } = {}) => {
    const q = projector(HERO_X - 160, HERO_Y - 40);
    const at = (dx, dz) => q(gx + dx, gy + tilt * dx, 1.5 + lift + dz);
    return [
      poly(
        [at(0, 0), at(0, h), at(w, h), at(w, 0)],
        `fill="${seal ? P.paperLight : P.paper}" stroke="${P.cut}" stroke-width="2.4"`,
      ),
      // the flap, drawn as a folded triangle in ribbon
      poly(
        [at(0.04, h - 0.04), at(w * 0.5, h * 0.52), at(w - 0.04, h - 0.04)],
        `fill="${seal ? P.ribbon : P.paperMid}" opacity="${seal ? 0.85 : 1}"`,
      ),
      poly(
        [at(0.3, 0.28), at(0.3, 0.4), at(w * 0.62, 0.4), at(w * 0.62, 0.28)],
        `fill="${P.inkFaint}" opacity="0.7"`,
      ),
    ].join("");
  };

  const hero = [
    shadow(p, { x: -0.6, y: -0.5, dx: 7.4, dy: 3.6, spread: 0.5, opacity: 0.3 }),
    // the desk
    box(p, {
      x: 0,
      y: 0,
      z: 1.5,
      dx: 6.9,
      dy: 3.4,
      dz: 0.36,
      top: P.paperLight,
      right: P.paperMid,
      left: P.paperDark,
    }),
    box(p, {
      x: 0,
      y: 0,
      z: 0,
      dx: 6.9,
      dy: 3.4,
      dz: 1.5,
      top: P.paperMid,
      right: P.paperMid,
      left: P.paperDark,
      sw: 2.2,
    }),
    box(p, {
      x: 1.4,
      y: 0,
      z: 0,
      dx: 1.3,
      dy: 0.3,
      dz: 1.5,
      top: P.paperDark,
      right: P.paperDark,
      left: P.paperDeep,
      sw: 2,
    }),
    box(p, {
      x: 4.4,
      y: 0,
      z: 0,
      dx: 1.3,
      dy: 0.3,
      dz: 1.5,
      top: P.paperDark,
      right: P.paperDark,
      left: P.paperDeep,
      sw: 2,
    }),
    // the tray
    box(p, {
      x: 0.7,
      y: 0.7,
      z: 1.86,
      dx: 3.4,
      dy: 2.2,
      dz: 0.42,
      top: P.paperMid,
      right: P.paperDark,
      left: P.paperDeep,
    }),
    box(p, {
      x: 0.95,
      y: 0.95,
      z: 2.02,
      dx: 2.9,
      dy: 1.7,
      dz: 0.22,
      top: P.paperDeep,
      right: P.paperDeep,
      left: P.paperDeep,
      sw: 2,
    }),
    letter(1.1, 1.05, { w: 1.9, h: 1.15, tilt: 0.02 }),
    letter(1.5, 2.1, { w: 1.85, h: 1.1, seal: true, tilt: -0.02 }),
    // the one on its way out, lifted and leaning toward the lens
    letter(4.4, 1.3, { w: 2.1, h: 1.3, lift: 0.4, tilt: -0.16, seal: true }),
    // a pen resting on the desk
    box(p, {
      x: 3.05,
      y: 2.9,
      z: 1.9,
      dx: 1.7,
      dy: 0.22,
      dz: 0.22,
      top: P.paperTop,
      right: P.paperMid,
      left: P.paperDark,
      sw: 1.6,
    }),
    labelText(p(0.8, 0.7, 2.7)[0] - 2, p(0.8, 0.7, 2.7)[1], "CONTACT", {
      size: 22,
      fill: P.inkSoft,
      weight: 600,
    }),
  ].join("");

  const mid = [
    board(1520, 1010, { dx: 3.2, items: [{ w: 1.5, h: 1.2, marks: 4 }] }),
    board(2980, 1030, { dx: 2.8, items: [{ w: 1.4, h: 1.15, accent: P.barMid }] }),
    paperStack(projector(3420, 1300), { x: 0, y: 0, w: 2.4, d: 1.8, sheets: 5 }),
  ].join("");

  const fore = [
    floorSheet(projector(2200, 1630), { x: 0, y: 0, dx: 7.2, dy: 4.4, marks: 3 }),
    pencil(projector(HERO_X + 960, HERO_Y + 340), { x: 0, y: 0, z: 0.02, length: 3.4 }),
  ].join("");

  return { back: backdrop(), mid, subject: hero, fore };
}

/** How fast each layer drifts: far layers crawl, near layers slide past. */
// How fast each layer drifts past the camera. The backdrop is the slowest, which
// is what caps how far the camera can travel before its bottom edge comes into
// frame; world/motion.mjs and the world tests both read this.
export const SPEEDS = { back: 0.45, mid: 0.7, subject: 1, fore: 1.25 };

const BUILDERS = [
  { id: "print-room", title: "The print room", build: printRoom },
  { id: "workbench", title: "The workbench", build: workbench },
  { id: "type-tray", title: "The type tray", build: typeTray },
  { id: "archive-shelf", title: "The archive shelf", build: archiveShelf },
  { id: "mail-slot", title: "The mail slot", build: mailSlot },
];

/** Every scene, back layer first. */
export const SCENES = BUILDERS.map(({ id, title, build }) => {
  const drawn = build();
  return {
    id,
    title,
    layers: ["back", "mid", "subject", "fore"].map((name) => [name, drawn[name], SPEEDS[name]]),
  };
});

/** The SVG for one layer of one scene, and the speed it should drift at. */
export function layerSvgFor(scene, index) {
  const [name, content, speed] = scene.layers[index];
  const withGrain = index === 0 ? content + grainOverlay({ w: LAYER_W, h: LAYER_H }) : content;
  return { name, speed, svg: layerSvg(withGrain, { w: LAYER_W, h: LAYER_H }) };
}

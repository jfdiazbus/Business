// A tiny isometric papercraft kit: everything in the scroll world is built from
// flat cardstock boxes, sheets of paper, spools and labels, drawn on one shared
// grid with one light direction, so five hand-made scenes read as one world.

export const P = {
  // The world is dark now, so the value ramp runs from the page background up
  // to the lit faces, and "ink" is the light that draws the edges. The names
  // are the ones the scenes were drawn against: paper* is the surface stack,
  // bar* used to be the green bar paper and is now a neutral, ribbon is the one
  // accent that survives.
  paper: "#0a0a0a", // the page background, so posters seam invisibly
  paperLight: "#313131", // brightest lit face
  paperTop: "#272727",
  paperMid: "#1f1f1f",
  paperDark: "#181818",
  paperDeep: "#121212",
  wall: "#1f1f1f",
  wallDeep: "#181818",
  bar: "#272727",
  barMid: "#1f1f1f",
  barDeep: "#181818",
  ink: "#f5f5f5",
  inkSoft: "#a3a3a3",
  inkFaint: "#6b6b6b",
  ribbon: "#ff5c4d",
  ribbonDeep: "#b03024",
  cut: "rgba(255,255,255,0.10)",
  shadow: "rgba(0,0,0,0.55)",
};

/** One isometric unit in pixels. The world is drawn in grid units. */
export const U = 60;

/** grid -> screen, from a layer origin in canvas pixels. */
export function projector(cx, cy, u = U) {
  const p = (gx, gy, gz = 0) => [cx + (gx - gy) * u, cy + (gx + gy) * (u / 2) - gz * u];
  p.px = (gx, gy, gz = 0) => p(gx, gy, gz).map((n) => Math.round(n * 100) / 100);
  return p;
}

const n = (v) => Math.round(v * 100) / 100;
const points = (list) => list.map(([x, y]) => `${n(x)},${n(y)}`).join(" ");

export function poly(vertices, attrs) {
  return `<polygon points="${points(vertices)}" ${attrs}/>`;
}

/** A flat cardstock box: top face lightest, right face mid, left face shaded. */
export function box(
  p,
  {
    x,
    y,
    z = 0,
    dx,
    dy,
    dz,
    top = P.paperLight,
    right = P.paperMid,
    left = P.paperDark,
    stroke = P.cut,
    sw = 2.4,
  },
) {
  const at = (gx, gy, gz) => p(gx, gy, gz);
  const faces = [
    // left face (+y side), then right face (+x side), then the top
    poly(
      [at(x, y + dy, z), at(x + dx, y + dy, z), at(x + dx, y + dy, z + dz), at(x, y + dy, z + dz)],
      `fill="${left}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"`,
    ),
    poly(
      [at(x + dx, y, z), at(x + dx, y + dy, z), at(x + dx, y + dy, z + dz), at(x + dx, y, z + dz)],
      `fill="${right}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"`,
    ),
    poly(
      [at(x, y, z + dz), at(x + dx, y, z + dz), at(x + dx, y + dy, z + dz), at(x, y + dy, z + dz)],
      `fill="${top}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"`,
    ),
  ];
  return faces.join("");
}

/** A soft shadow on the floor. The light is top left, so it falls down right. */
export function shadow(p, { x, y, dx, dy, z = 0, spread = 0.3, opacity = 0.42, lift = 0 }) {
  const at = (gx, gy, gz) => p(gx, gy, gz);
  const o = spread;
  const verts = [
    at(x - o + 0.55 + lift, y - o + 0.35 + lift, z),
    at(x + dx + o + 0.55 + lift, y - o + 0.35 + lift, z),
    at(x + dx + o + 0.55 + lift, y + dy + o + 0.35 + lift, z),
    at(x - o + 0.55 + lift, y + dy + o + 0.35 + lift, z),
  ];
  return `<g opacity="${opacity}">${poly(verts, `fill="${P.shadow}" filter="url(#soft)"`)}</g>`;
}

/** A standing sheet of paper: thin in y, tall in z, with room for printed marks. */
export function sheet(
  p,
  { x, y, z = 0, w, h, fill = P.paperLight, stroke = P.cut, thickness = 0.12 },
) {
  return box(p, {
    x,
    y,
    z,
    dx: w,
    dy: thickness,
    dz: h,
    top: fill,
    right: P.paperMid,
    left: P.paperMid,
    stroke,
    sw: 2,
  });
}

/** Abstract printed lines on a standing sheet, in the sheet's own plane. */
export function printedLines(
  p,
  {
    x,
    y,
    z,
    w,
    rows = 4,
    lead = 0.42,
    inset = 0.45,
    size = 0.16,
    fill = P.inkFaint,
    bg = null,
    pad = 0.3,
  },
) {
  const out = [];
  if (bg)
    out.push(
      poly(
        [
          p(x, y, z),
          p(x + w, y, z),
          p(x + w, y, z + rows * lead + pad * 2),
          p(x, y, z + rows * lead + pad * 2),
        ],
        `fill="${bg}"`,
      ),
    );
  for (let i = 0; i < rows; i += 1) {
    const zz = z + pad + lead * 0.5 + i * lead;
    const wide = w - inset * 2 - (i % 3 === 2 ? w * 0.28 : 0);
    out.push(
      poly(
        [
          p(x + inset, y, zz),
          p(x + inset + wide, y, zz),
          p(x + inset + wide, y, zz + size),
          p(x + inset, y, zz + size),
        ],
        `fill="${fill}"`,
      ),
    );
  }
  return out.join("");
}

/** A mono label laid flat on a surface, drawn in the isometric plane. */
export function labelText(
  x,
  y,
  text,
  { size = 30, fill = P.ink, weight = 600, anchor = "start", opacity = 1 },
) {
  return `<text x="${n(x)}" y="${n(y)}" font-family="IBM Plex Mono, monospace" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}">${escapeText(text)}</text>`;
}

export function escapeText(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

/** A spool of ribbon: two discs and a winding. */
export function spool(p, { x, y, z = 0, r = 0.9, h = 0.7, disc = P.paperMid, wound = P.ribbon }) {
  const top = p(x, y, z + h);
  const near = p(x + r, y + r, z);
  return [
    `<ellipse cx="${n(near[0])}" cy="${n(near[1])}" rx="${n(r * U * 1.02)}" ry="${n(r * U * 0.52)}" fill="${disc}" stroke="${P.cut}" stroke-width="2"/>`,
    poly(
      [
        [near[0] - r * U, near[1]],
        [near[0] + r * U, near[1]],
        [near[0] + r * U, near[1] - h * U],
        [near[0] - r * U, near[1] - h * U],
      ],
      `fill="${wound}" stroke="${P.cut}" stroke-width="2"`,
    ),
    `<ellipse cx="${n(top[0])}" cy="${n(top[1])}" rx="${n(r * U * 1.02)}" ry="${n(r * U * 0.52)}" fill="${disc}" stroke="${P.cut}" stroke-width="2"/>`,
    `<ellipse cx="${n(top[0])}" cy="${n(top[1])}" rx="${n(r * U * 0.34)}" ry="${n(r * U * 0.18)}" fill="${P.paperDeep}" stroke="${P.cut}" stroke-width="1.6"/>`,
  ].join("");
}

/** A printer: plinth, body, hood, a tractor-feed sheet standing in it, platen,
 *  control keys and the sheet it has just laid down in front. */
export function printer(
  p,
  { x = 0, y = 0, z = 0, w = 6.6, d = 4.2, h = 2.1, banner = "HELLO", marks = 2 } = {},
) {
  const parts = [];
  const at = (gx, gy, gz) => p(gx, gy, gz);
  const bodyTop = z + 0.7 + h;

  parts.push(
    shadow(p, { x: x - 0.5, y: y - 0.5, dx: w + 1, dy: d + 1, spread: 0.45, opacity: 0.34 }),
  );
  parts.push(
    box(p, {
      x,
      y,
      z,
      dx: w,
      dy: d,
      dz: 0.7,
      top: P.paperTop,
      right: P.paperMid,
      left: P.paperDark,
    }),
  );
  parts.push(
    box(p, {
      x: x + 0.3,
      y: y + 0.3,
      z: z + 0.7,
      dx: w - 0.6,
      dy: d - 0.6,
      dz: h,
      top: P.paperLight,
      right: P.paperMid,
      left: P.paperDark,
    }),
  );
  parts.push(
    box(p, {
      x: x + 0.55,
      y: y + 0.45,
      z: bodyTop,
      dx: w - 1.1,
      dy: 1.15,
      dz: 0.85,
      top: P.paperTop,
      right: P.paperMid,
      left: P.paperDark,
    }),
  );

  // the sheet the printer is working on, standing in the hood
  const feedZ = bodyTop + 0.85;
  parts.push(
    sheet(p, { x: x + 0.95, y: y + 1.45, z: feedZ, w: w - 1.9, h: 3.3, fill: P.paperLight }),
  );
  parts.push(
    sprocketEdge(p, {
      x: x + 1.18,
      y: y + 1.53,
      z: feedZ + 3.0,
      length: w - 2.36,
      count: 8,
      r: 0.075,
    }),
  );
  parts.push(
    printedLines(p, {
      x: x + 1.65,
      y: y + 1.51,
      z: feedZ + 1.35,
      w: w - 3.3,
      rows: marks,
      lead: 0.38,
      inset: 0.28,
      size: 0.15,
    }),
  );
  if (banner) {
    const spot = at(x + 1.75, y + 1.51, feedZ + 2.8);
    parts.push(labelText(spot[0], spot[1] + 26, banner, { size: 50, fill: P.ribbon, weight: 700 }));
  }

  // platen roller along the front edge, sitting in a flat slot on the body top
  const roller = y + d - 0.15;
  const a = at(x + 0.7, roller, bodyTop);
  const b = at(x + w - 0.7, roller, bodyTop);
  parts.push(
    poly(
      [
        at(x + 0.9, roller - 0.16, bodyTop + 0.01),
        at(x + w - 0.9, roller - 0.16, bodyTop + 0.01),
        at(x + w - 0.9, roller + 0.2, bodyTop + 0.01),
        at(x + 0.9, roller + 0.2, bodyTop + 0.01),
      ],
      `fill="${P.inkFaint}" opacity="0.85"`,
    ),
  );
  parts.push(
    `<path d="M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}" stroke="${P.paperDeep}" stroke-width="26" stroke-linecap="round"/>`,
  );
  parts.push(
    `<path d="M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}" stroke="${P.paperMid}" stroke-width="15" stroke-linecap="round"/>`,
  );

  // the control keys, and the little red light that says it is working
  parts.push(
    box(p, {
      x: x + w - 2.1,
      y: y + 0.15,
      z: z + 0.7 + h * 0.3,
      dx: 1.45,
      dy: 0.22,
      dz: 0.95,
      top: P.paperTop,
      right: P.paperMid,
      left: P.paperDark,
    }),
  );
  for (let i = 0; i < 3; i += 1) {
    parts.push(
      box(p, {
        x: x + w - 1.95 + i * 0.42,
        y: y + 0.02,
        z: z + 0.7 + h * 0.3 + 0.95,
        dx: 0.28,
        dy: 0.16,
        dz: 0.12,
        top: P.paperMid,
        right: P.paperDark,
        left: P.paperDeep,
        sw: 1.4,
      }),
    );
  }
  const led = at(x + w - 0.55, y + 0.16, z + 0.7 + h * 0.62);
  parts.push(`<ellipse cx="${led[0]}" cy="${led[1]}" rx="12" ry="12" fill="${P.ribbon}"/>`);

  // the sheet it has just laid down in front of itself
  const outY = y + d + 0.35;
  parts.push(
    poly(
      [
        at(x + 1.1, outY, 0.02),
        at(x + 1.1 + 2.1, outY, 0.02),
        at(x + 1.1 + 2.1, outY + 1.7, 0.02),
        at(x + 1.1, outY + 1.7, 0.02),
      ],
      `fill="${P.paper}" stroke="${P.cut}" stroke-width="2.2"`,
    ),
  );
  for (let i = 0; i < 3; i += 1) {
    const z0 = 0.03;
    parts.push(
      poly(
        [
          at(x + 1.45, outY + 0.35 + i * 0.36, z0),
          at(x + 1.45 + (i === 2 ? 1.1 : 1.6), outY + 0.35 + i * 0.36, z0),
          at(x + 1.45 + (i === 2 ? 1.1 : 1.6), outY + 0.45 + i * 0.36, z0),
          at(x + 1.45, outY + 0.45 + i * 0.36, z0),
        ],
        `fill="${P.inkFaint}" opacity="0.75"`,
      ),
    );
  }

  return parts.join("");
}

/** A small cantilevered shelf board, for mounting things on the wall. */
export function shelfBoard(p, { x, y, z, dx = 3.2, dy = 0.85, dz = 0.18, bracket = true }) {
  const parts = [
    box(p, { x, y, z, dx, dy, dz, top: P.paperTop, right: P.paperMid, left: P.paperDark, sw: 2 }),
  ];
  if (bracket) {
    parts.push(
      poly(
        [
          p(x + 0.3, y + dy, z),
          p(x + 0.3, y + dy, z - 0.75),
          p(x + 0.38, y + dy, z),
          p(x + 0.38, y + dy, z - 0.1),
        ],
        `fill="${P.paperDark}" opacity="0.9"`,
      ),
      poly(
        [
          p(x + dx - 0.38, y + dy, z),
          p(x + dx - 0.38, y + dy, z - 0.75),
          p(x + dx - 0.3, y + dy, z),
          p(x + dx - 0.3, y + dy, z - 0.1),
        ],
        `fill="${P.paperDark}" opacity="0.9"`,
      ),
    );
  }
  return parts.join("");
}

/** A sheet standing on a shelf, with a pin and a few printed lines. */
export function shelfSheet(
  p,
  { x, y, z, w = 2.6, h = 1.8, marks = 3, accent = null, label = null },
) {
  const parts = [
    shadow(p, { x: x - 0.15, y: y - 0.1, dx: w + 0.3, dy: 0.4, z, spread: 0.22, opacity: 0.18 }),
    box(p, {
      x: x + 0.1,
      y: y + 0.15,
      z,
      dx: 0.3,
      dy: 0.3,
      dz: 0.28,
      top: P.paperMid,
      right: P.paperDark,
      left: P.paperDeep,
      sw: 1.4,
    }),
    sheet(p, { x, y, z: z + 0.28, w, h, fill: P.paperLight }),
  ];
  const spot = p(x + w / 2, y, z + 0.28 + h);
  parts.push(`<circle cx="${spot[0]}" cy="${spot[1] - 4}" r="9" fill="${accent ?? P.ribbon}"/>`);
  if (accent) {
    parts.push(
      poly(
        [
          p(x + 0.2, y - 0.01, z + 0.28 + h - 0.5),
          p(x + 0.2 + w * 0.42, y - 0.01, z + 0.28 + h - 0.5),
          p(x + 0.2 + w * 0.42, y - 0.01, z + 0.28 + h - 0.26),
          p(x + 0.2, y - 0.01, z + 0.28 + h - 0.26),
        ],
        `fill="${accent}" opacity="0.6"`,
      ),
    );
  }
  parts.push(
    printedLines(p, {
      x: x + 0.28,
      y: y - 0.02,
      z: z + 0.28 + h - 1.15,
      w: w - 0.56,
      rows: marks,
      lead: 0.3,
      inset: 0.06,
      size: 0.11,
    }),
  );
  if (label) {
    const at = p(x + 0.28, y - 0.02, z + 0.28 + h - 1.5);
    parts.push(labelText(at[0], at[1], label, { size: 22, fill: P.inkSoft, weight: 600 }));
  }
  return parts.join("");
}

/** A big sheet lying flat on the floor, for framing the shot from a corner. */
export function floorSheet(p, { x, y, z = 0.02, dx = 7, dy = 4, marks = 3 }) {
  const at = (gx, gy) => p(gx, gy, z);
  const parts = [
    poly(
      [at(x, y), at(x + dx, y), at(x + dx, y + dy), at(x, y + dy)],
      `fill="${P.paper}" stroke="${P.cut}" stroke-width="2.6"`,
    ),
  ];
  for (let i = 0; i < marks; i += 1) {
    const gy = y + 0.7 + i * 0.55;
    const wide = i === marks - 1 ? dx * 0.42 : dx * 0.7;
    parts.push(
      poly(
        [
          at(x + 0.7, gy),
          at(x + 0.7 + wide, gy),
          at(x + 0.7 + wide, gy + 0.16),
          at(x + 0.7, gy + 0.16),
        ],
        `fill="${P.inkFaint}" opacity="0.6"`,
      ),
    );
  }
  return parts.join("");
}

/** A pencil lying on the floor: cardstock body, inked tip. */
export function pencil(p, { x = 0, y = 0, z = 0, length = 3.2, thickness = 0.22 }) {
  const t = thickness;
  const parts = [
    box(p, {
      x,
      y,
      z,
      dx: length,
      dy: t,
      dz: t,
      top: P.paperTop,
      right: P.paperMid,
      left: P.paperDark,
      sw: 1.6,
    }),
    // the inked tip
    poly(
      [
        p(x + length, y, z + t),
        p(x + length, y + t, z + t),
        p(x + length + t * 1.6, y + t / 2, z + t / 2),
        p(x + length + t * 1.6, y + t / 2, z + t / 2),
      ],
      `fill="${P.ribbon}"`,
    ),
    poly(
      [
        p(x + length + t * 1.6, y + t / 2, z + t / 2),
        p(x + length, y + t, z + t),
        p(x + length, y + t, z),
        p(x + length + t * 1.6, y + t / 2, z + t / 2),
      ],
      `fill="${P.ribbonDeep}"`,
    ),
    poly(
      [
        p(x + length + t * 1.6, y + t / 2, z + t / 2),
        p(x + length, y, z),
        p(x + length, y, z + t),
        p(x + length + t * 1.6, y + t / 2, z + t / 2),
      ],
      `fill="${P.ribbon}"`,
    ),
    // the ferrule at the other end
    box(p, {
      x: x - 0.24,
      y,
      z,
      dx: 0.24,
      dy: t,
      dz: t,
      top: P.paperDeep,
      right: P.paperDeep,
      left: P.paperDeep,
      sw: 1.4,
    }),
  ];
  return parts.join("");
}
export function paperStack(p, { x, y, z = 0, w = 2.2, d = 1.6, sheets = 5, fill = P.paperLight }) {
  const out = [];
  for (let i = 0; i < sheets; i += 1) {
    const zz = z + i * 0.12;
    const jx = (i % 2 ? 1 : -1) * 0.045 * i;
    out.push(
      box(p, {
        x: x + jx,
        y,
        z: zz,
        dx: w,
        dy: d,
        dz: 0.12,
        top: fill,
        right: P.paperMid,
        left: P.paperDark,
        sw: 1.8,
      }),
    );
  }
  return out.join("");
}

/** Sprocket holes along a running edge — the paper's tractor feed. */
export function sprocketEdge(p, { x, y, z = 0, length, count = 14, r = 0.1, fill = P.inkFaint }) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const gx = x + (length * i) / (count - 1);
    const at = p(gx, y, z);
    out.push(`<circle cx="${n(at[0])}" cy="${n(at[1])}" r="${n(r * U)}" fill="${fill}"/>`);
  }
  return out.join("");
}

/** Shared defs: paper grain, soft shadows, a faint vignette. */
export function defs() {
  return `<defs>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
    <filter id="softer" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="52"/>
    </filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0" result="flat"/>
      <feComponentTransfer in="flat" result="faint">
        <feFuncA type="table" tableValues="0 0.055"/>
      </feComponentTransfer>
    </filter>
    <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${P.paperDeep}" stop-opacity="0.16"/>
      <stop offset="0.42" stop-color="${P.paperDeep}" stop-opacity="0"/>
      <stop offset="1" stop-color="${P.paperDeep}" stop-opacity="0.22"/>
    </linearGradient>
  </defs>`;
}

/** Wraps layer content in an SVG of the given canvas size. */
export function layerSvg(content, { w, h }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs()}${content}</svg>`;
}

/** The paper grain and vignette, applied over a finished layer. */
export function grainOverlay({ w, h, vignette = true }) {
  const parts = [`<rect x="0" y="0" width="${w}" height="${h}" filter="url(#grain)"/>`];
  if (vignette) parts.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="url(#vignette)"/>`);
  return parts.join("");
}

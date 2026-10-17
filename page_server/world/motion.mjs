// Turns the rendered layers into the scroll film.
//
// The camera is locked isometric: it never rotates or tilts, the world simply
// slides past. Depth comes from each layer sliding at its own speed, so the
// whole move is one linear offset per layer — which also means every dive has
// the same velocity, so nothing stutters at a seam.
//
//   node motion.mjs            all scenes: dives, wipes, posters
//   node motion.mjs preview    a few stills per scene, for looking at

import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG_DIR, SVG_DIR, shoot } from "./render.mjs";
import { LAYER_H, LAYER_W, SCENES } from "./scenes.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const OUT_DIR = path.join(HERE, "out");
export const FRAME_DIR = path.join(HERE, "build", "frames");
export const PREVIEW_DIR = path.join(HERE, "build", "preview");

/** The camera: a 1080p window gliding across the stage, hero centred throughout. */
// The camera is a 1080p window gliding down a 2160 tall stage, and how far it can
// glide is set by the backdrop rather than by the window. The backdrop is the only
// layer that covers the whole stage, and it travels the slowest of them (0.45, so
// 1.45 times the master travel), which means the window's bottom edge catches up
// with the backdrop's bottom edge first. 700 + travel * 1.45 has to stay under
// 1080, so the travel is capped at about 262: go past that and the transparent
// base shows through as a black band across the bottom of the frame.
export const CAM = { w: 1920, h: 1080, x0: 1110, y0: 700, travel: 250, fps: 30, seconds: 8 };

/** The wipe between scenes: a sheet feeding across the platen. */
export const WIPE = { seconds: 1.8, cross: 1.2, hold: 0.3 };

function run(args) {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", args, (error, _stdout, stderr) => {
      if (error)
        reject(
          new Error(`ffmpeg failed: ${stderr?.split("\n").slice(-6).join("\n") || error.message}`),
        );
      else resolve(true);
    });
  });
}

const D = (t) => `${CAM.travel}*t/${CAM.seconds}`;

/**
 * The filter graph for one dive: build a transparent frame, then slide each
 * layer across it at its own speed. `x` for a layer is -(camera + speed·Δ).
 */
function diveGraph(layers) {
  const parts = [
    `color=c=black@0:s=${CAM.w}x${CAM.h}:r=${CAM.fps}:d=${CAM.seconds},format=rgba[base]`,
  ];
  const inputs = [];

  layers.forEach((layer, index) => {
    parts.push(`[${index}:v]format=rgba[l${index}]`);
    inputs.push(layer);
  });

  let previous = "base";

  layers.forEach((layer, index) => {
    const driftFactor = (1 + layer.speed).toFixed(4);
    const label = index === layers.length - 1 ? "film" : `o${index}`;
    parts.push(
      `[${previous}][l${index}]overlay=x=${-CAM.x0}:y='-(${CAM.y0}+${D("t")}*${driftFactor})':format=rgb:eval=frame[${label}]`,
    );
    if (label !== "film") parts.push(`[${label}]format=rgba[o${index}r]`);
    previous = label === "film" ? "film" : `o${index}r`;
  });

  parts.push(`[film]format=yuv420p[out]`);
  return parts.join(";");
}

// The engine scrubs these clips: it sets currentTime while the video is paused,
// so frames have to be seekable and keyframes cannot be far apart. That is the
// only reason the GOP is short, and it costs size: dark gradients compress
// badly. CRF 23 with a keyframe every half second is the balance struck here.
function encodeArgs(output, { crf = 23, gop = 16 } = {}) {
  return [
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    String(crf),
    "-pix_fmt",
    "yuv420p",
    "-g",
    String(gop),
    "-keyint_min",
    String(gop),
    "-sc_threshold",
    "0",
    "-movflags",
    "+faststart",
    "-an",
    output,
  ];
}

/** One dive clip per scene. */
export async function dives({ only = null, log = () => {} } = {}) {
  await mkdir(OUT_DIR, { recursive: true });
  const made = [];

  for (const [index, scene] of SCENES.entries()) {
    if (only && !only.includes(scene.id)) continue;

    const layers = scene.layers.map(([name, , speed], layerIndex) => ({
      name,
      speed,
      png: path.join(PNG_DIR, `${scene.id}-${layerIndex}-${name}.png`),
    }));

    const inputs = layers.flatMap((layer) => [
      "-loop",
      "1",
      "-framerate",
      String(CAM.fps),
      "-t",
      String(CAM.seconds),
      "-i",
      layer.png,
    ]);
    const output = path.join(OUT_DIR, `dive-${index + 1}.mp4`);

    await run([
      "-y",
      ...inputs,
      "-filter_complex",
      diveGraph(layers),
      "-map",
      "[out]",
      ...encodeArgs(output),
    ]);

    const { size } = await statSize(output);
    log(`  dive-${index + 1}.mp4 (${scene.id}) — ${(size / 1024 / 1024).toFixed(2)} MB`);
    made.push({ index, scene: scene.id, output, size });
  }

  return made;
}

/** The first and last frame of every dive: the exact pixels a wipe must join. */
export async function boundaryFrames() {
  await mkdir(FRAME_DIR, { recursive: true });
  const lastFrame = CAM.fps * CAM.seconds - 1;

  for (const [index, scene] of SCENES.entries()) {
    const dive = path.join(OUT_DIR, `dive-${index + 1}.mp4`);
    await run([
      "-y",
      "-i",
      dive,
      "-frames:v",
      "1",
      "-update",
      "1",
      path.join(FRAME_DIR, `${scene.id}-first.png`),
    ]);
    // the true last frame, not "about a frame before the end": a glide moves
    // ~4px per frame, so picking the wrong one shows as a pop at the seam
    await run([
      "-y",
      "-i",
      dive,
      "-vf",
      `select=eq(n\\,${lastFrame})`,
      "-vsync",
      "0",
      "-frames:v",
      "1",
      path.join(FRAME_DIR, `${scene.id}-last.png`),
    ]);
  }
}

/** The sheet edge that leads a wipe up the screen. */
async function renderSheetEdge() {
  const h = 150;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CAM.w}" height="${h}" viewBox="0 0 ${CAM.w} ${h}">
    <rect x="0" y="0" width="${CAM.w}" height="${h}" fill="#141414"/>
    <rect x="0" y="0" width="${CAM.w}" height="${h}" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="3"/>
    <rect x="0" y="${h - 5}" width="${CAM.w}" height="5" fill="rgba(0,0,0,0.45)"/>
  </svg>`;

  const page = path.join(SVG_DIR, "sheet-edge.html");
  const png = path.join(OUT_DIR, "sheet-edge.png");
  await writeFile(
    page,
    `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`,
    "utf8",
  );
  await shoot(page, png, CAM.w, h);
  return png;
}

/** The wipes that join the dives, each starting and ending on real frames. */
export async function connectors({ log = () => {} } = {}) {
  await mkdir(OUT_DIR, { recursive: true });
  await boundaryFrames();
  const edge = await renderSheetEdge();
  const made = [];

  for (let i = 0; i < SCENES.length - 1; i += 1) {
    const from = path.join(FRAME_DIR, `${SCENES[i].id}-last.png`);
    const to = path.join(FRAME_DIR, `${SCENES[i + 1].id}-first.png`);
    const output = path.join(OUT_DIR, `wipe-${i + 1}.mp4`);
    const total = WIPE.hold + WIPE.cross + WIPE.hold;

    // A holds, the sheet feeds up pushing B in, B holds.
    const graph = [
      `[0:v]format=rgba,loop=loop=-1:size=1:start=0,trim=duration=${total},fps=${CAM.fps}[a]`,
      `[1:v]format=rgba,loop=loop=-1:size=1:start=0,trim=duration=${total},fps=${CAM.fps}[b]`,
      `[a][b]xfade=transition=wipeup:duration=${WIPE.cross}:offset=${WIPE.hold}[x]`,
      // the leading edge of the sheet rides up at the same rate
      `[2:v]format=rgba[e]`,
      `[x][e]overlay=x=0:y='${CAM.h}-(${CAM.h}+150)*(t-${WIPE.hold})/${WIPE.cross}':format=rgb:eval=frame[film]`,
      `[film]format=yuv420p[out]`,
    ].join(";");

    await run([
      "-y",
      "-loop",
      "1",
      "-framerate",
      String(CAM.fps),
      "-t",
      String(total),
      "-i",
      from,
      "-loop",
      "1",
      "-framerate",
      String(CAM.fps),
      "-t",
      String(total),
      "-i",
      to,
      "-loop",
      "1",
      "-framerate",
      String(CAM.fps),
      "-t",
      String(total),
      "-i",
      edge,
      "-filter_complex",
      graph,
      "-map",
      "[out]",
      ...encodeArgs(output),
    ]);

    const { size } = await statSize(output);
    log(`  wipe-${i + 1}.mp4 — ${(size / 1024 / 1024).toFixed(2)} MB`);
    made.push({ index: i, output, size });
  }

  return made;
}

/** Posters: the first frame of each dive, downscaled, as webp. */
export async function posters({ log = () => {} } = {}) {
  await mkdir(OUT_DIR, { recursive: true });
  await boundaryFrames();

  for (const [index, scene] of SCENES.entries()) {
    const source = path.join(FRAME_DIR, `${scene.id}-first.png`);
    const output = path.join(OUT_DIR, `still-${index + 1}.webp`);
    await run(["-y", "-i", source, "-vf", "scale=1600:-2", "-q:v", "82", output]);
    const { size } = await statSize(output);
    log(`  still-${index + 1}.webp (${scene.id}) — ${(size / 1024).toFixed(0)} KB`);
  }
}

/** Frames from across each clip, for looking at the composition and the seams. */
export async function previews({ log = () => {} } = {}) {
  await mkdir(PREVIEW_DIR, { recursive: true });

  for (const [index, scene] of SCENES.entries()) {
    const dive = path.join(OUT_DIR, `dive-${index + 1}.mp4`);
    for (const second of [0, 4, 7.9]) {
      await run([
        "-y",
        "-ss",
        String(second),
        "-i",
        dive,
        "-frames:v",
        "1",
        path.join(PREVIEW_DIR, `${index + 1}-${scene.id}-${second}s.png`),
      ]);
    }
  }

  const wipes = await import("node:fs/promises").then((fs) =>
    fs.readdir(OUT_DIR).then((names) => names.filter((n) => n.startsWith("wipe-"))),
  );

  for (const name of wipes) {
    for (const second of [0, WIPE.hold + WIPE.cross / 2, WIPE.hold + WIPE.cross + 0.3]) {
      await run([
        "-y",
        "-ss",
        second.toFixed(2),
        "-i",
        path.join(OUT_DIR, name),
        "-frames:v",
        "1",
        path.join(PREVIEW_DIR, `${name.replace(".mp4", "")}-${second.toFixed(2)}s.png`),
      ]);
    }
  }

  log(`  previews in ${path.relative(process.cwd(), PREVIEW_DIR)}`);
}

async function statSize(file) {
  const { stat } = await import("node:fs/promises");
  return stat(file);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const mode = process.argv[2] ?? "all";
  const log = (line) => console.log(line);

  if (mode === "preview") {
    await previews({ log });
  } else if (mode === "dives") {
    await dives({ log });
  } else if (mode === "wipes") {
    await connectors({ log });
  } else if (mode === "posters") {
    await posters({ log });
  } else {
    console.log("dives:");
    await dives({ log });
    console.log("wipes:");
    await connectors({ log });
    console.log("posters:");
    await posters({ log });
    console.log("previews:");
    await previews({ log });
  }
}

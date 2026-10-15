// Renders every scene layer to a transparent PNG with headless Chrome.
//
// The SVGs are written out beside the PNGs, so a layer can be opened in a
// browser and inspected by hand while tuning the art.

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LAYER_H, LAYER_W, SCENES, layerSvgFor } from "./scenes.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const BUILD_DIR = path.join(HERE, "build");
export const SVG_DIR = path.join(BUILD_DIR, "svg");
export const PNG_DIR = path.join(BUILD_DIR, "png");

const CHROME = "/usr/bin/google-chrome";
const FONT = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap";

function wrapper(svg) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link href="${FONT}" rel="stylesheet">
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}svg{display:block}</style>
</head><body>${svg}</body></html>`;
}

/** Rasterises one HTML page to a PNG. Exported so the motion step can render its own bits. */
export function shoot(page, out, w, h, budget = 9000) {
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--virtual-time-budget=${budget}`,
    `--window-size=${w},${h}`,
    "--default-background-color=00000000",
    `--screenshot=${out}`,
    `file://${page}`,
  ];

  return new Promise((resolve, reject) => {
    execFile(CHROME, args, (error, _stdout, stderr) => {
      if (error)
        reject(new Error(`chrome failed for ${path.basename(out)}: ${stderr || error.message}`));
      else resolve(out);
    });
  });
}

/** Renders the layers of every scene (or just `only`, a list of scene ids). */
export async function renderLayers({ only = null, scenes = SCENES, log = () => {} } = {}) {
  await mkdir(SVG_DIR, { recursive: true });
  await mkdir(PNG_DIR, { recursive: true });
  const rendered = [];

  for (const scene of scenes) {
    if (only && !only.includes(scene.id)) continue;

    for (let index = 0; index < scene.layers.length; index += 1) {
      const { name, svg } = layerSvgFor(scene, index);
      const stem = `${scene.id}-${index}-${name}`;
      const svgPath = path.join(SVG_DIR, `${stem}.svg`);
      const pagePath = path.join(SVG_DIR, `${stem}.html`);
      const pngPath = path.join(PNG_DIR, `${stem}.png`);

      await writeFile(svgPath, svg, "utf8");
      await writeFile(pagePath, wrapper(svg), "utf8");
      await shoot(pagePath, pngPath, LAYER_W, LAYER_H);
      log(`  rendered ${stem}`);
      rendered.push({
        scene: scene.id,
        name,
        speed: layerSvgFor(scene, index).speed,
        png: pngPath,
      });
    }
  }

  return rendered;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const rendered = await renderLayers({
    only: only.length ? only : null,
    log: (line) => console.log(line),
  });
  console.log(`rendered ${rendered.length} layers at ${LAYER_W}x${LAYER_H}`);
}

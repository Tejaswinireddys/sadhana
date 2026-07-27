/**
 * Encode the recorded walkthrough into the shipped product-overview assets.
 *
 * Reads raw.webm + scenes.json from the recorder, applies a modest speed-up,
 * lower-third captions, and fades, then writes:
 *   client/public/videos/product-overview.mp4
 *   client/public/videos/product-overview.webm
 *   client/public/images/product-overview-poster.png
 *   client/public/captions/product-overview.vtt
 *
 * Usage:
 *   node script/encode-product-demo.mjs --in /tmp/demo [--speed 1.3] [--poster 52]
 *
 * Requires ffmpeg on PATH.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const IN = argOf("--in", "/tmp/demo");
const SPEED = Number(argOf("--speed", "1.3"));
/** Timestamp (in final, sped-up seconds) used for the poster still. */
const POSTER_AT = Number(argOf("--poster", "43"));

const FONT_SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf";

const raw = path.join(IN, "raw.webm");
const scenes = JSON.parse(readFileSync(path.join(IN, "scenes.json"), "utf8"));

const VIDEO_DIR = path.join(ROOT, "client/public/videos");
const IMAGE_DIR = path.join(ROOT, "client/public/images");
const CAPTION_DIR = path.join(ROOT, "client/public/captions");
for (const dir of [VIDEO_DIR, IMAGE_DIR, CAPTION_DIR]) mkdirSync(dir, { recursive: true });

const mp4 = path.join(VIDEO_DIR, "product-overview.mp4");
const webm = path.join(VIDEO_DIR, "product-overview.webm");
const poster = path.join(IMAGE_DIR, "product-overview-poster.png");
const vtt = path.join(CAPTION_DIR, "product-overview.vtt");

const scaled = scenes.map((s) => ({
  caption: s.caption,
  start: s.start / SPEED,
  end: s.end / SPEED,
}));
const total = scaled[scaled.length - 1].end;

const esc = (text) =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\u2019")
    .replace(/%/g, "\\%");

// Caption card: dark scrim + serif label, held for most of each scene and
// cross-faded so it never pops.
const FADE = 0.4;
const filter = [
  `setpts=PTS/${SPEED}`,
  "fps=30",
  "format=yuv420p",
  ...scaled.map((s) => {
    const showFrom = s.start + 0.35;
    const showTo = Math.max(showFrom + 1.4, s.end - 0.45);
    const alpha = `if(lt(t,${showFrom}),0,if(lt(t,${showFrom + FADE}),(t-${showFrom})/${FADE},if(lt(t,${showTo - FADE}),1,if(lt(t,${showTo}),(${showTo}-t)/${FADE},0))))`;
    // Sits inside the content column so it never covers the app sidebar.
    return `drawtext=fontfile=${FONT_SERIF}:text='${esc(s.caption)}':fontcolor=white:fontsize=30:box=1:boxcolor=0x14231f@0.78:boxborderw=24:x=252:y=h-118:alpha='${alpha}'`;
  }),
  `fade=t=in:st=0:d=0.6`,
  `fade=t=out:st=${(total - 0.7).toFixed(2)}:d=0.7`,
].join(",");

const run = (bin, argv) => {
  console.log(`$ ${bin} ${argv.slice(0, 6).join(" ")} …`);
  execFileSync(bin, argv, { stdio: ["ignore", "inherit", "inherit"] });
};

console.log(`encoding ${total.toFixed(1)}s at ${SPEED}× …`);

run("ffmpeg", [
  "-y", "-v", "error", "-stats",
  "-i", raw,
  "-t", String(total),
  "-vf", filter,
  "-an",
  "-c:v", "libx264",
  "-profile:v", "high",
  "-crf", "23",
  "-preset", "slow",
  "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
  mp4,
]);

run("ffmpeg", [
  "-y", "-v", "error", "-stats",
  "-i", raw,
  "-t", String(total),
  "-vf", filter,
  "-an",
  "-c:v", "libvpx-vp9",
  "-crf", "36",
  "-b:v", "0",
  "-row-mt", "1",
  "-deadline", "good",
  "-cpu-used", "2",
  webm,
]);

// Poster comes from the raw capture so it carries no caption or fade, and is
// palette-quantized to keep the landing hero still light.
run("ffmpeg", [
  "-y", "-v", "error",
  "-ss", String(POSTER_AT * SPEED),
  "-i", raw,
  "-frames:v", "1",
  "-vf", "split[a][b];[a]palettegen=max_colors=250:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a",
  poster,
]);

const stamp = (sec) => {
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = (sec % 60).toFixed(3).padStart(6, "0");
  return `${h}:${m}:${s}`;
};

const cues = scaled
  .map((s, i) => `${i + 1}\n${stamp(s.start)} --> ${stamp(s.end)}\n${s.caption}`)
  .join("\n\n");
writeFileSync(vtt, `WEBVTT\n\n${cues}\n`);

console.log("\nwrote:");
for (const f of [mp4, webm, poster, vtt]) console.log(` · ${path.relative(ROOT, f)}`);

/**
 * Generate short looping demo videos from pose illustrations.
 *
 * Builds a **step journey** (entry → mid → peak) with crossfades — not a Ken
 * Burns zoom on a single still. For each asana:
 *   client/public/videos/poses/{slug}.webm
 *   client/public/videos/poses/{slug}.mp4
 *
 * Then regenerates `client/src/data/poseVideosReady.generated.ts`.
 *
 * Usage:
 *   npx tsx script/gen-pose-videos.ts
 *   npx tsx script/gen-pose-videos.ts --force
 *   npx tsx script/gen-pose-videos.ts --only vrksasana
 *   npx tsx script/gen-pose-videos.ts --concurrency 4
 */
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ASANAS, type Asana } from "../client/src/data/content.ts";
import { humanStepSlug } from "../client/src/data/poseKeyImages.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const POSES_DIR = path.join(ROOT, "client/public/poses");
const OUT_DIR = path.join(ROOT, "client/public/videos/poses");
const READY_FILE = path.join(ROOT, "client/src/data/poseVideosReady.generated.ts");

const FPS = 24;
const WIDTH = 600;
const HEIGHT = 1200;
/** Seconds each shape is held before/after crossfade. */
const HOLD = 1.35;
/** Crossfade length between shapes. */
const FADE = 0.55;

type Args = {
  force: boolean;
  only: string | null;
  concurrency: number;
  skipMp4: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { force: false, only: null, concurrency: 3, skipMp4: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") args.force = true;
    else if (a === "--skip-mp4") args.skipMp4 = true;
    else if (a === "--only") args.only = argv[++i] ?? null;
    else if (a === "--concurrency") {
      const n = Number(argv[++i]);
      if (Number.isFinite(n) && n >= 1) args.concurrency = Math.floor(n);
    } else if (a === "--help" || a === "-h") {
      console.log(
        `Usage: npx tsx script/gen-pose-videos.ts [--force] [--only slug] [--concurrency N] [--skip-mp4]`,
      );
      process.exit(0);
    }
  }
  return args;
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr?.on("data", (d) => {
      err += String(d);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}\n${err.slice(-1000)}`));
    });
  });
}

async function ensureFfmpeg(): Promise<void> {
  try {
    await run("ffmpeg", ["-version"]);
  } catch {
    throw new Error("ffmpeg not found on PATH. Install with: brew install ffmpeg");
  }
}

async function fileNonEmpty(p: string): Promise<boolean> {
  try {
    const st = await fs.stat(p);
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

/** Sensible entry shape when narration never leaves the peak illustration. */
function defaultEntrySlug(asana: Asana): string | null {
  const cat = asana.category as string;
  const map: Record<string, string> = {
    Standing: "tadasana",
    "Hip Openers": "anjaneyasana",
    Seated: "sukhasana",
    "Forward Bends": "tadasana",
    Backbends: "bhujangasana",
    Inversions: "adho-mukha-svanasana",
    Restorative: "sukhasana",
  };
  const entry = map[cat] ?? "tadasana";
  return entry === asana.slug ? null : entry;
}

/**
 * Ordered unique illustration slugs that tell the pose's shape journey.
 * Always ends on this asana's own PNG.
 */
export function journeySlugsFor(asana: Asana): string[] {
  const seq: string[] = [];
  for (const step of asana.steps) {
    const s = humanStepSlug(asana.slug, asana.pose, step.pose);
    if (seq[seq.length - 1] !== s) seq.push(s);
  }
  if (seq[seq.length - 1] !== asana.slug) seq.push(asana.slug);
  if (seq.length === 1) {
    const entry = defaultEntrySlug(asana);
    if (entry) seq.unshift(entry);
  }
  // Cap length so encodes stay short (~8s).
  if (seq.length > 5) {
    return [seq[0]!, seq[Math.floor(seq.length / 2)]!, seq[seq.length - 1]!];
  }
  return seq;
}

function padFilter(): string {
  return `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS},format=yuv420p`;
}

async function encodeJourney(pngs: string[], webm: string, mp4: string | null): Promise<void> {
  if (pngs.length === 0) throw new Error("no frames");

  // Single frame: honest hold — no fake zoom drift.
  if (pngs.length === 1) {
    const common = [
      "-y",
      "-loop", "1",
      "-i", pngs[0]!,
      "-vf", padFilter(),
      "-t", "4",
      "-an",
    ];
    await run("ffmpeg", [
      ...common,
      "-c:v", "libvpx-vp9", "-b:v", "280k", "-crf", "34",
      "-row-mt", "1", "-deadline", "good", "-cpu-used", "4",
      webm,
    ]);
    if (mp4) {
      await run("ffmpeg", [
        ...common,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "baseline",
        "-level", "3.1", "-crf", "26", "-preset", "veryfast",
        "-movflags", "+faststart",
        mp4,
      ]);
    }
    return;
  }

  // Multi-frame: hold each shape, crossfade into the next.
  const inputs: string[] = [];
  for (const png of pngs) {
    inputs.push("-loop", "1", "-t", String(HOLD), "-i", png);
  }

  const parts: string[] = [];
  for (let i = 0; i < pngs.length; i++) {
    parts.push(`[${i}:v]${padFilter()}[v${i}]`);
  }

  let last = `v0`;
  for (let i = 1; i < pngs.length; i++) {
    const offset = (HOLD - FADE) * i;
    const out = i === pngs.length - 1 ? "outv" : `vx${i}`;
    parts.push(`[${last}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}[${out}]`);
    last = out;
  }

  const filter = parts.join(";");
  const encode = async (outPath: string, codec: string[]) => {
    await run("ffmpeg", [
      "-y",
      ...inputs,
      "-filter_complex", filter,
      "-map", "[outv]",
      "-an",
      ...codec,
      outPath,
    ]);
  };

  await encode(webm, [
    "-c:v", "libvpx-vp9", "-b:v", "320k", "-crf", "34",
    "-row-mt", "1", "-deadline", "good", "-cpu-used", "4",
  ]);
  if (mp4) {
    await encode(mp4, [
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "baseline",
      "-level", "3.1", "-crf", "26", "-preset", "veryfast",
      "-movflags", "+faststart",
    ]);
  }
}

async function writeReadyList(slugs: string[]): Promise<void> {
  const body = `/**
 * AUTO-GENERATED by script/gen-pose-videos.ts — do not edit by hand.
 * Re-run: npx tsx script/gen-pose-videos.ts
 */
export const POSE_VIDEOS_READY_LIST = ${JSON.stringify(slugs, null, 2)} as const;
`;
  await fs.writeFile(READY_FILE, body, "utf8");
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<{ ok: number; failed: { item: T; error: string }[] }> {
  let ok = 0;
  const failed: { item: T; error: string }[] = [];
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      const item = items[i]!;
      try {
        await fn(item, i);
        ok++;
      } catch (e) {
        failed.push({ item, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return { ok, failed };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensureFfmpeg();
  await fs.mkdir(OUT_DIR, { recursive: true });

  let asanas = [...ASANAS];
  if (args.only) {
    asanas = asanas.filter((a) => a.slug === args.only);
    if (!asanas.length) throw new Error(`Unknown asana slug: ${args.only}`);
  }

  console.log(
    `Generating step-journey pose videos for ${asanas.length} pose(s) ` +
      `(concurrency=${args.concurrency}, force=${args.force}, mp4=${!args.skipMp4})…`,
  );

  const started = Date.now();
  let skipped = 0;

  const { ok, failed } = await mapPool(asanas, args.concurrency, async (asana, index) => {
    const webm = path.join(OUT_DIR, `${asana.slug}.webm`);
    const mp4 = path.join(OUT_DIR, `${asana.slug}.mp4`);
    const need = args.force || !(await fileNonEmpty(webm)) || (!args.skipMp4 && !(await fileNonEmpty(mp4)));
    if (!need) {
      skipped++;
      return;
    }

    const journey = journeySlugsFor(asana);
    const pngs: string[] = [];
    for (const slug of journey) {
      const p = path.join(POSES_DIR, `${slug}.png`);
      if (await fileNonEmpty(p)) pngs.push(p);
    }
    if (!pngs.length) {
      const self = path.join(POSES_DIR, `${asana.slug}.png`);
      if (!(await fileNonEmpty(self))) throw new Error(`missing PNG for ${asana.slug}`);
      pngs.push(self);
    }

    await encodeJourney(pngs, webm, args.skipMp4 ? null : mp4);

    if ((index + 1) % 10 === 0 || index === 0 || index === asanas.length - 1) {
      console.log(`  [${index + 1}/${asanas.length}] ${asana.slug} (${pngs.length} frames)`);
    }
  });

  const ready: string[] = [];
  for (const a of ASANAS) {
    if (await fileNonEmpty(path.join(OUT_DIR, `${a.slug}.webm`))) ready.push(a.slug);
  }
  await writeReadyList(ready);

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\nDone in ${secs}s — encoded/updated ${ok}, skipped existing ${skipped}, failed ${failed.length}.`,
  );
  console.log(`Registered ${ready.length} slugs in ${path.relative(ROOT, READY_FILE)}`);
  if (failed.length) {
    console.error("Failures:");
    for (const f of failed) console.error(`  - ${(f.item as Asana).slug}: ${f.error.split("\n")[0]}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

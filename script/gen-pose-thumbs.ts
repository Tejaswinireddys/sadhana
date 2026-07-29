/**
 * gen-pose-thumbs — pre-scaled row thumbnails for the pose catalog.
 *
 * Why: every list in the app (Home, Search, Trainer results, Warm-up) renders a
 * 600x1200 source into a ~64px box. That ships ~200KB per row to draw a few
 * thousand pixels, and a pale full-body watercolour shrunk that far is close to
 * invisible. This produces a tight crop around the figure at 2x display size.
 *
 * The app treats these as OPTIONAL: `PoseImage thumb` requests
 * /poses/thumbs/<slug>.png and silently falls back to the full asset if it 404s.
 * So you can ship without running this; you just don't get the win.
 *
 * Usage:
 *   npm i -D sharp
 *   npx tsx script/gen-pose-thumbs.ts
 */
import { readdir, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const SRC_DIR = path.resolve("client/public/poses");
const OUT_DIR = path.join(SRC_DIR, "thumbs");
/** 2x the largest thumbnail box in the UI (80px), for crisp HiDPI rendering. */
const SIZE = 160;
/** Trim threshold — how far from the corner pixel colour still counts as background. */
const TRIM_THRESHOLD = 12;

async function main() {
  let sharp: typeof import("sharp");
  try {
    sharp = (await import("sharp")).default as unknown as typeof import("sharp");
  } catch {
    console.error("sharp is not installed. Run: npm i -D sharp");
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const files = (await readdir(SRC_DIR)).filter(
    (f) => f.endsWith(".png") && !f.startsWith("_"),
  );

  let written = 0;
  let skipped = 0;
  for (const file of files) {
    const src = path.join(SRC_DIR, file);
    const out = path.join(OUT_DIR, file);

    // Idempotent: skip when the thumb is newer than its source.
    try {
      const [s, o] = await Promise.all([stat(src), stat(out)]);
      if (o.mtimeMs >= s.mtimeMs) {
        skipped++;
        continue;
      }
    } catch {
      /* no thumb yet — generate it */
    }

    await sharp(src)
      // Crop the empty margin so the figure fills the box instead of floating
      // in whitespace. This is what makes a 64px thumbnail readable.
      .trim({ threshold: TRIM_THRESHOLD })
      .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, palette: true })
      .toFile(out);
    written++;
  }

  console.log(`pose thumbs: ${written} written, ${skipped} up to date, into ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

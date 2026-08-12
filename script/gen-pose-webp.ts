/**
 * gen-pose-webp — WebP (+ optional AVIF) siblings for pose PNGs.
 *
 *   npx tsx script/gen-pose-webp.ts
 *   npx tsx script/gen-pose-webp.ts --avif
 *   npx tsx script/gen-pose-webp.ts --only tadasana
 */
import { readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, basename } from "node:path";

async function main() {
  const args = process.argv.slice(2);
  const withAvif = args.includes("--avif");
  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

  let sharp: typeof import("sharp");
  try {
    sharp = (await import("sharp")).default as unknown as typeof import("sharp");
  } catch {
    console.error("sharp is not installed. Run: npm i -D sharp");
    process.exit(1);
  }

  const poseDir = resolve("client/public/poses");
  const thumbDir = join(poseDir, "thumbs");
  const files = (await readdir(poseDir)).filter((f) => f.endsWith(".png"));
  let done = 0;

  for (const file of files) {
    const slug = basename(file, ".png");
    if (only && slug !== only) continue;
    const src = join(poseDir, file);
    const webp = join(poseDir, `${slug}.webp`);
    if (!existsSync(webp)) {
      await sharp(src).webp({ quality: 78 }).toFile(webp);
      done++;
    }
    if (withAvif) {
      const avif = join(poseDir, `${slug}.avif`);
      if (!existsSync(avif)) {
        await sharp(src).avif({ quality: 55 }).toFile(avif);
        done++;
      }
    }
  }

  if (existsSync(thumbDir)) {
    const thumbs = (await readdir(thumbDir)).filter((f) => f.endsWith(".png"));
    for (const file of thumbs) {
      const slug = basename(file, ".png");
      if (only && slug !== only) continue;
      const src = join(thumbDir, file);
      const webp = join(thumbDir, `${slug}.webp`);
      if (!existsSync(webp)) {
        await sharp(src).webp({ quality: 72 }).toFile(webp);
        done++;
      }
    }
  } else {
    await mkdir(thumbDir, { recursive: true });
  }

  console.log(`Wrote/ensured WebP variants (${done} new files).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Build client/public/favicon.ico from client/public/favicon.svg.
 *
 * Browsers, crawlers and RSS readers still request /favicon.ico directly,
 * ignoring <link rel="icon">; without the file that request was a 404. The
 * .ico holds the same lotus mark as the SVG at 16, 32 and 48 px, rendered by
 * headless Chromium (so it matches the SVG exactly) and stored as PNG entries,
 * which every current browser reads.
 *
 *   npx tsx script/gen-favicon-ico.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

export const FAVICON_SIZES = [16, 32, 48] as const;

/** An ICO container holding PNG images (ICONDIR + ICONDIRENTRY per image). */
export function packIco(images: ReadonlyArray<{ size: number; png: Buffer }>): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const entries: Buffer[] = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 means 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette colours
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

async function main() {
  const root = path.resolve(import.meta.dirname, "..");
  const svg = fs.readFileSync(path.join(root, "client/public/favicon.svg"), "utf8");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const images = [];
    for (const size of FAVICON_SIZES) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(
        `<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`,
      );
      images.push({ size, png: await page.locator("svg").screenshot({ omitBackground: true }) });
    }
    const out = path.join(root, "client/public/favicon.ico");
    fs.writeFileSync(out, packIco(images));
    console.log(`wrote ${path.relative(root, out)} (${FAVICON_SIZES.join(", ")} px)`);
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

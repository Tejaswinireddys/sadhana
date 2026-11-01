/**
 * Upload a video to Mux and publish it as a class in one command. See
 * server/classUpload.ts for the steps and docs/classes.md for chapters.json.
 *
 *   npm run class:upload -- --file ./video.mp4 --title "Slow flow" --slug slow-flow \
 *     --level beginner --tier plus --focus "flexibility" --chapters ./chapters.json
 */
import "dotenv/config";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { ASANAS } from "../client/src/data/content";
import { muxApi } from "../server/classAdd";
import { CLASS_UPLOAD_USAGE, parseClassUploadArgs, prepareClassUpload, runClassUpload } from "../server/classUpload";
import { uploadToMux } from "../server/muxUpload";
import { muxSigningConfigured } from "../server/muxPlayback";
import { initStorage, pool, storage } from "../server/storage";

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("--help")) { console.log(CLASS_UPLOAD_USAGE); return; }
  const options = parseClassUploadArgs(args);
  const knownPose = (slug: string) => ASANAS.some((asana) => asana.slug === slug);
  const prepared = await prepareClassUpload(options, { stat, readFile: (path) => readFile(path, "utf8") }, knownPose);

  if (options.dryRun) {
    console.log(`Dry run OK: ${options.file} (${prepared.size} bytes), ${prepared.chapters.length} chapters, captions: ${
      prepared.captions.kind === "url" ? "from URL" : "auto-generated English"}, tier ${options.tier}. Nothing uploaded or saved.`);
    return;
  }

  const tokenId = process.env.MUX_TOKEN_ID?.trim();
  const tokenSecret = process.env.MUX_TOKEN_SECRET?.trim();
  if (!tokenId || !tokenSecret) throw new Error("MUX_TOKEN_ID and MUX_TOKEN_SECRET are required");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required (or pass --dry-run)");
  if (options.tier === "plus" && !muxSigningConfigured()) {
    console.warn("Warning: MUX_SIGNING_KEY_ID / MUX_SIGNING_KEY_PRIVATE are not set here; the server needs them or this class stays unplayable.");
  }

  initStorage();
  try {
    // Same idempotent DDL the server applies on boot (adds chapters / thumbnail_time_sec).
    if (pool) await pool.query(await readFile(new URL("../drizzle/schema.sql", import.meta.url), "utf8"));
    await runClassUpload(options, prepared, {
      upload: ({ isPlus, videoQuality }) => uploadToMux({
        isPlus, videoQuality, tokenId, tokenSecret,
        body: Readable.toWeb(createReadStream(options.file)) as BodyInit, size: prepared.size,
        onCreated: async (uploadId) => { console.log(`Created Mux upload ${uploadId}; streaming the file and waiting for processing.`); },
      }),
      api: muxApi(tokenId, tokenSecret),
      save: (row) => storage.upsertClassBySlug(row),
      log: (message) => console.log(message),
    });
  } finally { await pool?.end(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "class:upload failed"); process.exitCode = 1; });

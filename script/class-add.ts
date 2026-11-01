/**
 * Add (or update, by slug) a class from a ready Mux asset. Plus classes get a
 * signed playback id; see server/classAdd.ts for the rules.
 *
 *   DATABASE_URL=… MUX_TOKEN_ID=… MUX_TOKEN_SECRET=… npm run class:add -- \
 *     --asset <id> --title "Slow flow" --slug slow-flow --level beginner \
 *     --tier plus --focus "flexibility,stress"
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { initStorage, storage, pool } from "../server/storage";
import { CLASS_ADD_USAGE, buildClassRow, muxApi, parseClassAddArgs, resolveClassPlayback } from "../server/classAdd";
import { muxSigningConfigured } from "../server/muxPlayback";

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("--help")) { console.log(CLASS_ADD_USAGE); return; }
  const options = parseClassAddArgs(args);
  const tokenId = process.env.MUX_TOKEN_ID?.trim();
  const tokenSecret = process.env.MUX_TOKEN_SECRET?.trim();
  if (!tokenId || !tokenSecret) throw new Error("MUX_TOKEN_ID and MUX_TOKEN_SECRET are required");
  if (!options.dryRun && !process.env.DATABASE_URL) throw new Error("DATABASE_URL is required (or pass --dry-run)");

  const playback = await resolveClassPlayback(muxApi(tokenId, tokenSecret), options);
  const row = buildClassRow(options, playback);
  if (playback.created) console.log(`Created a ${playback.playbackPolicy} playback id on asset ${options.asset}`);
  for (const id of playback.removedPublicIds) console.log(`Removed public playback id ${id} from the Plus asset`);
  if (playback.publicIdsOnPlus.length) {
    console.warn(`Warning: this Plus asset still has ${playback.publicIdsOnPlus.length} public playback id(s). Sadhana never serves them, but anyone who has one can stream the video. Re-run with --remove-public to delete them.`);
  }
  if (row.playbackPolicy === "signed" && !muxSigningConfigured()) {
    console.warn("Warning: MUX_SIGNING_KEY_ID / MUX_SIGNING_KEY_PRIVATE are not set here; the server needs them or this class stays unplayable.");
  }
  if (options.dryRun) { console.log(JSON.stringify(row, null, 2)); return; }

  initStorage();
  try {
    if (pool) await pool.query(await readFile(new URL("../drizzle/schema.sql", import.meta.url), "utf8"));
    const saved = await storage.upsertClassBySlug(row);
    console.log(`Saved class "${saved.title}" (/classes/${saved.slug}, ${saved.tier}, ${saved.playbackPolicy}${saved.published ? "" : ", draft"})`);
  } finally { await pool?.end(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "class:add failed"); process.exitCode = 1; });

/**
 * Delete one class by slug. See server/classRemove.ts for the plan and the
 * order of deletes, and docs/classes.md for usage.
 *
 *   npm run class:remove -- --slug slow-flow [--delete-mux-asset] [--yes] [--dry-run]
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { CLASS_REMOVE_USAGE, isConfirmation, muxAssetRemoval, parseClassRemoveArgs, runClassRemove } from "../server/classRemove";
import { initStorage, pool, storage } from "../server/storage";

async function confirm(question: string): Promise<boolean> {
  // No terminal to answer (CI, a pipe): refuse rather than hang or assume yes.
  if (!process.stdin.isTTY) throw new Error("No terminal to confirm in; pass --yes to delete without a prompt.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return isConfirmation(await rl.question(question)); } finally { rl.close(); }
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("--help")) { console.log(CLASS_REMOVE_USAGE); return; }
  const options = parseClassRemoveArgs(args);
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const tokenId = process.env.MUX_TOKEN_ID?.trim();
  const tokenSecret = process.env.MUX_TOKEN_SECRET?.trim();
  const mux = tokenId && tokenSecret ? muxAssetRemoval(tokenId, tokenSecret) : null;

  initStorage();
  try {
    // Same idempotent DDL the server applies on boot, so the columns read here exist.
    if (pool) await pool.query(await readFile(new URL("../drizzle/schema.sql", import.meta.url), "utf8"));
    await runClassRemove(options, {
      store: storage,
      lookupAsset: mux?.lookupAsset ?? null,
      deleteAsset: mux?.deleteAsset ?? null,
      confirm,
      log: (message) => console.log(message),
    });
  } finally { await pool?.end(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "class:remove failed"); process.exitCode = 1; });

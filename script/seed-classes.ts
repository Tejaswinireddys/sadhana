/**
 * Seed the six placeholder classes (3 free, 3 Plus) into Postgres so /classes
 * works before real videos exist. Idempotent: rows are upserted by slug.
 *
 *   DATABASE_URL=… npm run seed:classes
 *
 * The in-memory dev store seeds itself on boot; this is for Postgres.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { initStorage, storage, pool } from "../server/storage";
import { seedPlaceholderClasses } from "../server/classSeed";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required (the in-memory dev store seeds itself on boot)");
  initStorage();
  try {
    // Same idempotent DDL the server applies on boot, so a fresh database works.
    if (pool) await pool.query(await readFile(new URL("../drizzle/schema.sql", import.meta.url), "utf8"));
    console.log(`Seeded ${await seedPlaceholderClasses(storage)} placeholder classes`);
  } finally { await pool?.end(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Class seeding failed"); process.exitCode = 1; });

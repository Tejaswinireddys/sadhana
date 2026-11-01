import "dotenv/config";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { initStorage, storage, pool } from "../server/storage";
import { importLegacyBillingData } from "../server/billingMigration";

async function main() {
  const { values } = parseArgs({ options: { directory: { type: "string" }, "dry-run": { type: "boolean", default: false } } });
  const dryRun = values["dry-run"];
  if (!dryRun && !process.env.DATABASE_URL) throw new Error("DATABASE_URL is required; use --dry-run to validate without importing");
  initStorage();
  try {
    if (!dryRun && pool) await pool.query(await readFile(new URL("../drizzle/schema.sql", import.meta.url), "utf8"));
    const counts = await importLegacyBillingData(storage, { directory: values.directory, dryRun });
    console.log(`${dryRun ? "Validated legacy records (no writes)" : "Imported new records"}: ${JSON.stringify(counts)}`);
  } finally { await pool?.end(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Billing migration failed"); process.exitCode = 1; });

/**
 * Soft performance budgets for route chunks (raw bytes before gzip).
 * Enforced in CI after `npm run build` when DIST_PUBLIC is present; skipped
 * locally if dist is missing so unit tests stay fast.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = join(process.cwd(), "dist", "public", "assets");

/** Individual hashed chunks should stay under these ceilings (bytes). */
const CHUNK_BUDGETS: Record<string, number> = {
  // Catalog is large by nature; keep an eye on regressions past ~700KB.
  catalog: 750_000,
  charts: 600_000,
  three: 600_000,
  index: 400_000,
};

describe("performance budgets", () => {
  it("keeps known heavy chunks under soft budgets when dist exists", () => {
    if (!existsSync(DIST)) {
      // Build is optional for unit CI; budgets apply when dist/public is present.
      return;
    }
    const files = readdirSync(DIST).filter((f) => f.endsWith(".js"));
    for (const [needle, max] of Object.entries(CHUNK_BUDGETS)) {
      const match = files.find((f) => f.includes(needle));
      if (!match) continue;
      const size = statSync(join(DIST, match)).size;
      assert.ok(
        size <= max,
        `${match} is ${size} bytes — over budget ${max}. Split or lazy-load further.`,
      );
    }
  });
});

/**
 * Soft performance budgets for route chunks (raw bytes before gzip).
 * Enforced in CI after `npm run build` when DIST_PUBLIC is present; skipped
 * locally if dist is missing so unit tests stay fast.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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

/** App-*.js loads on every in-app route, so it stays under Vite's chunk warning. */
const APP_CHUNK_BUDGET = 700_000;

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
    const appChunk = files.find((f) => /^App-.*\.js$/.test(f));
    assert.ok(appChunk, "App-*.js is missing from dist/public/assets");
    const appBytes = statSync(join(DIST, appChunk)).size;
    assert.ok(
      appBytes <= APP_CHUNK_BUDGET,
      `${appChunk} is ${appBytes} bytes — over the ${APP_CHUNK_BUDGET} byte App budget. Split or lazy-load further.`,
    );
  });
});

/**
 * Heavy libraries that must only ever be reached through a dynamic import, and
 * the one module allowed to import each for real. A single static import of
 * hls.js (in lib/hlsAttach.ts) once put 590 kB on the pose library, search,
 * the Trainer and four other pages that never played a stream.
 */
const LAZY_ONLY: Record<string, string[]> = {
  "hls.js": [],
  "@mux/mux-player-react": ["client/src/components/ClassMuxPlayer.tsx"],
  recharts: ["client/src/components/MobilityTrendChart.tsx", "client/src/pages/FunnelDashboard.tsx", "client/src/components/ui/chart.tsx"],
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("code splitting", () => {
  it("imports hls.js, Mux Player and recharts statically only where a lazy chunk already isolates them", () => {
    const root = process.cwd();
    const offenders: string[] = [];
    for (const file of sourceFiles(join(root, "client", "src"))) {
      const relative = file.slice(root.length + 1).split("\\").join("/");
      const source = readFileSync(file, "utf8");
      for (const [library, allowed] of Object.entries(LAZY_ONLY)) {
        const escaped = library.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
        // A value import or re-export: `import X from`, `import { a } from`, `export { default } from`. `import type` is erased and fine.
        const staticImport = new RegExp(`^(?:import|export)\\s+(?!type\\b)[^;]*?from\\s+["']${escaped}["']`, "m");
        if (staticImport.test(source) && !allowed.includes(relative)) offenders.push(`${relative} imports ${library}`);
      }
    }
    assert.deepEqual(offenders, [], "use a dynamic import() or React.lazy for these");
  });

  it("keeps those libraries out of every page's initial download when dist exists", () => {
    const manifestPath = join(process.cwd(), "dist", "public", ".vite", "manifest.json");
    if (!existsSync(manifestPath)) return;
    type Entry = { file: string; imports?: string[] };
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, Entry>;
    const heavyKeys = Object.keys(manifest).filter((key) => /node_modules\/(hls\.js|recharts|@mux|media-chrome)\//.test(key) || /^_(hls|LineChart)-/.test(key));
    assert.ok(heavyKeys.length > 0, "expected to find the hls / chart chunks in the manifest");
    const heavyFiles = new Set(heavyKeys.map((key) => manifest[key].file));
    const staticClosure = (key: string, seen = new Set<string>()) => {
      if (seen.has(key)) return seen;
      seen.add(key);
      for (const next of manifest[key].imports ?? []) staticClosure(next, seen);
      return seen;
    };
    // Every page except the dev-only funnel dashboard, which is charts by definition.
    const pages = Object.keys(manifest).filter((key) => /^(index|welcome)\.html$|^_App-|^src\/pages\//.test(key) && !key.endsWith("FunnelDashboard.tsx"));
    assert.ok(pages.length > 20);
    for (const page of pages) {
      const pulled = [...staticClosure(page)].map((key) => manifest[key].file).filter((file) => heavyFiles.has(file));
      assert.deepEqual(pulled, [], `${page} statically pulls ${pulled.join(", ")}`);
    }
  });
});

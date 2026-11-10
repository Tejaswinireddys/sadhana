import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fetchPriority } from "./fetchPriority";

describe("fetchPriority", () => {
  it("emits the lowercase DOM attribute React 18 passes through", () => {
    assert.deepEqual(fetchPriority("high"), { fetchpriority: "high" });
    assert.deepEqual(fetchPriority("auto"), { fetchpriority: "auto" });
  });

  it("no component passes the camelCase prop React 18 warns about", () => {
    // Regression: `fetchPriority="high"` logged React's unknown-prop warning as
    // a console error on every Today render in development.
    const root = path.resolve(import.meta.dirname, "..");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx$/.test(entry.name) && /\bfetchPriority=/.test(fs.readFileSync(full, "utf8"))) offenders.push(path.relative(root, full));
      }
    };
    walk(root);
    assert.deepEqual(offenders, [], "use {...fetchPriority(...)} from @/lib/fetchPriority");
  });
});

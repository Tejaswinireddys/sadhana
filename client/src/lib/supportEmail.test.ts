/**
 * Support contact comes from SUPPORT_EMAIL (server/publicConfig.ts →
 * SupportContact), never a hard-coded mailbox on a domain the deploy may not
 * own. Private account questions sent to a placeholder address go nowhere —
 * or to whoever does own it.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|html)$/.test(name) && !name.endsWith(".test.ts") ? [full] : [];
  });
}

describe("support email", () => {
  it("no app or server code hard-codes an address on the sadhana.app domain", () => {
    const files = [
      ...sourceFiles(path.join(ROOT, "client/src")),
      ...sourceFiles(path.join(ROOT, "server")),
      path.join(ROOT, "client/index.html"),
      path.join(ROOT, "client/welcome.html"),
    ];
    const offenders = files.flatMap((file) =>
      readFileSync(file, "utf-8")
        .split("\n")
        .map((line, i) => ({ line, at: `${path.relative(ROOT, file)}:${i + 1}` }))
        .filter(({ line }) => /[a-z0-9._%+-]+@sadhana\.app\b/i.test(line))
        .map(({ at }) => at),
    );
    assert.deepEqual(offenders, []);
  });

  it("the support address is read from SUPPORT_EMAIL and dropped when it is not an address", async () => {
    const { publicConfig } = await import("../../../server/publicConfig.ts");
    const saved = process.env.SUPPORT_EMAIL;
    try {
      process.env.SUPPORT_EMAIL = "  help@yoga.example  ";
      assert.equal(publicConfig().supportEmail, "help@yoga.example");
      process.env.SUPPORT_EMAIL = "not-an-address";
      assert.equal(publicConfig().supportEmail, null);
      delete process.env.SUPPORT_EMAIL;
      assert.equal(publicConfig().supportEmail, null);
    } finally {
      if (saved === undefined) delete process.env.SUPPORT_EMAIL;
      else process.env.SUPPORT_EMAIL = saved;
    }
  });
});

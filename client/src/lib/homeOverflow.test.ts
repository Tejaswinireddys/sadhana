/**
 * Today/home must not create a page-level horizontal scrollbar on desktop.
 * Carousels scroll inside ScrollRow; the shell clips decorative bleed.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Today horizontal overflow guards", () => {
  it("clips the document and main shell, and contains ScrollRow", () => {
    const css = readFileSync(resolve("client/src/index.css"), "utf8");
    assert.match(css, /html\s*\{[\s\S]*?overflow-x:\s*clip/);
    assert.match(css, /body\s*\{[\s\S]*?overflow-x:\s*clip/);

    const layout = readFileSync(resolve("client/src/components/AppLayout.tsx"), "utf8");
    assert.match(layout, /overflow-x-clip/);
    assert.match(layout, /SidebarInset className="min-w-0 overflow-x-clip"/);

    const row = readFileSync(resolve("client/src/components/ScrollRow.tsx"), "utf8");
    assert.match(row, /max-w-full min-w-0/);
    assert.match(row, /overscroll-x-contain/);
    assert.match(row, /overflow-x-auto/);
  });
});

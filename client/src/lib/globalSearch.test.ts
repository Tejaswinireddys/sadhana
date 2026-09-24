import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BREATHING } from "@/data/content";
import {
  isBreathingCategoryQuery,
  isKidsCategoryQuery,
  matchBreathing,
  searchCatalog,
  searchSidebarSuggestions,
} from "./globalSearch";

describe("breathing category search", () => {
  it("treats breathing / breath / pranayama as category queries", () => {
    for (const q of ["breathing", "Breath", "pranayama", "pranayam"]) {
      assert.equal(isBreathingCategoryQuery(q), true, q);
    }
    assert.equal(isBreathingCategoryQuery("warrior"), false);
  });

  it("returns every technique for a bare breathing query", () => {
    const hits = matchBreathing("breathing");
    assert.equal(hits.length, BREATHING.length);
    assert.ok(hits.some((b) => b.slug === "ujjayi"), "Ujjayi should appear for breathing");
    assert.ok(hits.some((b) => b.slug === "box-breathing"));
  });

  it("still matches a specific technique by name", () => {
    const hits = matchBreathing("box");
    assert.ok(hits.some((b) => b.slug === "box-breathing"));
  });
});

describe("kids category search", () => {
  it("expands kids / children into the kids catalogue", () => {
    assert.equal(isKidsCategoryQuery("kids"), true);
    const catalog = searchCatalog("kids");
    assert.ok(catalog.kids.length > 0);
  });
});

describe("sidebar suggestions", () => {
  it("surfaces Breathing before drowning in poses for breathing", () => {
    const { items, total } = searchSidebarSuggestions("breathing", 8);
    assert.ok(total >= BREATHING.length);
    assert.ok(items.some((s) => s.kind === "breathing"));
    assert.equal(items[0]?.kind, "breathing");
  });
});

describe("home discoverability", () => {
  it("keeps one-tap Home links for Breathing, Kids, Pathways, and Challenges", () => {
    const home = readFileSync(resolve("client/src/pages/Home.tsx"), "utf8");
    for (const href of ["/breathing", "/kids", "/pathways", "/challenges"]) {
      assert.match(home, new RegExp(`href: "${href}"`));
    }
    assert.match(home, /data-testid="home-discover"/);
    assert.match(home, /testId: "home-discover-breathing"/);
    assert.match(home, /testId: "home-discover-kids"/);
  });

  it("keeps primary nav to five items while Home names the secondary doors", () => {
    const layout = readFileSync(resolve("client/src/components/AppLayout.tsx"), "utf8");
    assert.match(layout, /searchSidebarSuggestions/);
    assert.match(layout, /Breathing/);
    assert.match(layout, /search-suggestion-breath-/);
  });
});

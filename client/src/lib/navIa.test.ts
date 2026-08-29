/**
 * Primary nav IA: five items, matching page titles, Teachers off the chrome.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const layout = readFileSync(resolve("client/src/components/AppLayout.tsx"), "utf8");
const app = readFileSync(resolve("client/src/App.tsx"), "utf8");

function labelsInPrimaryNav(src: string): string[] {
  const block = src.match(/const PRIMARY_NAV: NavItem\[] = \[([\s\S]*?)\];/);
  assert.ok(block, "PRIMARY_NAV missing");
  return [...block[1].matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
}

describe("primary navigation IA", () => {
  it("collapses the shell to Today · Practice · Poses · Progress · You", () => {
    assert.deepEqual(labelsInPrimaryNav(layout), [
      "Today",
      "Practice",
      "Poses",
      "Progress",
      "You",
    ]);
    assert.match(layout, /PRIMARY_NAV\.map/);
    assert.equal(/MOBILE_PRIMARY/.test(layout), false);
    assert.equal(/NAV_GROUPS/.test(layout), false);
  });

  it("keeps Teachers off sidebar and mobile nav until the product is real", () => {
    assert.equal(/Teachers/.test(layout), false);
    assert.equal(/\/instructors/.test(layout), false);
    assert.equal(/label: "Coach"/.test(layout), false);
    assert.equal(/label: "Programs"/.test(layout), false);
  });

  it("keeps the teachers waitlist page at /instructors and /teachers", () => {
    assert.match(app, /path="\/instructors"/);
    assert.match(app, /path="\/teachers"/);
  });
});

describe("nav labels match page titles", () => {
  it("Today, Practice, Poses, Progress, and You share the nav word", () => {
    const home = readFileSync(resolve("client/src/pages/Home.tsx"), "utf8");
    const guided = readFileSync(resolve("client/src/pages/GuidedSession.tsx"), "utf8");
    const asanas = readFileSync(resolve("client/src/pages/Asanas.tsx"), "utf8");
    const journal = readFileSync(resolve("client/src/pages/Journal.tsx"), "utf8");
    const settings = readFileSync(resolve("client/src/pages/Settings.tsx"), "utf8");

    assert.match(home, /useDocumentTitle\("Today · Sadhana"\)/);
    assert.match(guided, /useDocumentTitle\("Practice · Sadhana"\)/);
    assert.match(
      guided,
      /<h1 className="font-serif text-3xl font-semibold tracking-tight">Practice<\/h1>/,
    );
    assert.match(asanas, /useDocumentTitle\("Poses · Sadhana"\)/);
    assert.match(
      asanas,
      /<h1 className="font-serif text-3xl font-semibold tracking-tight">Poses<\/h1>/,
    );
    assert.match(journal, /useDocumentTitle\("Progress · Sadhana"\)/);
    assert.match(
      journal,
      /<h1 className="font-serif text-3xl font-semibold tracking-tight">Progress<\/h1>/,
    );
    assert.match(settings, /useDocumentTitle\("You · Sadhana"\)/);
    assert.match(
      settings,
      /<h1 className="font-serif text-3xl font-semibold tracking-tight">You<\/h1>/,
    );
  });
});

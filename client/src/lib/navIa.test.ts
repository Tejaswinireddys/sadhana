/**
 * Primary nav IA: five items, matching page titles, Teachers off the chrome.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

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

describe("pose self-check discoverability", () => {
  const home = readFileSync(resolve("client/src/pages/Home.tsx"), "utf8");
  const guided = readFileSync(resolve("client/src/pages/GuidedSession.tsx"), "utf8");

  it("is two taps from Home: Practice nav → Practice hub → /pose-coach", () => {
    assert.match(layout, /href: "\/guided",\s*\n\s*label: "Practice"/);
    assert.match(guided, /data-testid="practice-hub"/);
    assert.match(guided, /data-testid="button-hub-pose-coach"/);
    assert.match(guided, /href="\/pose-coach"/);
    assert.match(guided, /Pose self-check/);
  });

  it("lists Pose self-check in Home's Practice explore group", () => {
    assert.match(home, /href: "\/pose-coach"/);
    assert.match(home, /label: "Pose self-check"/);
  });

  it("keeps the live /pose-coach page instead of redirecting to /guided", () => {
    assert.match(app, /path="\/pose-coach" component=\{PoseCoach\}/);
    assert.equal(/Redirect.*pose-coach|pose-coach.*\/guided/.test(app), false);
  });
});

describe("no route is reachable only by typing the URL", () => {
  it("every declared App route has an in-app link or navigation", () => {
    function walk(dir: string): string[] {
      const out: string[] = [];
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...walk(p));
        else if (/\.(tsx?)$/.test(name)) out.push(p);
      }
      return out;
    }

    const files = walk(resolve("client/src")).filter(
      (p) => !p.endsWith("/App.tsx") && !p.endsWith("navIa.test.ts"),
    );
    const corpus = files.map((p) => readFileSync(p, "utf8")).join("\n");

    const linked = new Set<string>();
    const add = (raw: string) => {
      const path = raw.split("?")[0].replace(/\$\{[^}]+\}/g, ":param");
      if (path.startsWith("/")) linked.add(path);
    };
    for (const re of [
      /(?:href|to):\s*"(\/[^"]*)"/g,
      /(?:href|to)="(\/[^"]*)"/g,
      /(?:href|to)=\{`(\/[^`]*)`\}/g,
      /(?:navigate|setLocation)\(\s*[`'"](\/[^`'"]*)/g,
    ]) {
      for (const m of corpus.matchAll(re)) add(m[1]);
    }

    const routes = [...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(routes.length > 0, "no App routes found");

    const missing: string[] = [];
    for (const route of routes) {
      if (route.includes(":")) {
        const prefix = route.slice(0, route.indexOf(":"));
        const ok = [...linked].some(
          (href) => href === route || href.startsWith(prefix) || href.startsWith(prefix.replace(/\/$/, "")),
        );
        if (!ok) missing.push(route);
        continue;
      }
      if (!linked.has(route) && ![...linked].some((href) => href.split(":")[0] === route)) {
        missing.push(route);
      }
    }
    assert.deepEqual(missing, [], `URL-only routes: ${missing.join(", ")}`);
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

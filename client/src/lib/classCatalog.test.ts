import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PATHWAYS } from "../data/content.ts";
import {
  CLASS_FOCUSES,
  CLASS_LEVELS,
  CLASS_STYLES,
  classListings,
  describeClass,
  durationBucket,
  filterClasses,
  isPlusClass,
} from "./classCatalog.ts";

const listings = classListings();

describe("class catalog facets", () => {
  it("describes every pathway with one style, level, duration, and focus", () => {
    assert.equal(listings.length, PATHWAYS.length);
    for (const item of listings) {
      assert.ok(CLASS_STYLES.includes(item.style), item.pathway.slug);
      assert.ok(CLASS_LEVELS.includes(item.level), item.pathway.slug);
      assert.ok(CLASS_FOCUSES.includes(item.focus), `${item.pathway.slug} ${item.focus}`);
      assert.equal(item.duration, durationBucket(item.minutes));
      assert.ok(item.minutes >= 1, item.pathway.slug);
    }
  });

  it("reads style from section and kind", () => {
    const bySlug = new Map(listings.map((item) => [item.pathway.slug, item]));
    assert.equal(bySlug.get("morning-wake-up")?.style, "Flow");
    assert.equal(bySlug.get("surya-namaskar-a")?.style, "Salutation");
    assert.equal(bySlug.get("front-splits")?.style, "Program");
    assert.equal(bySlug.get("foundations-beginner")?.style, "Program");
  });

  it("uses explicit access flags and defaults existing content to free", () => {
    assert.deepEqual(PATHWAYS.filter(isPlusClass), []);
    const program = PATHWAYS[0];
    assert.equal(isPlusClass({ ...program, isPlus: true }), true);
    assert.equal(describeClass({ ...program, isPlus: true }).isPlus, true);
  });

  it("filters by search, style, level, duration, and focus", () => {
    const sleep = filterClasses(listings, { query: "sleep" });
    assert.equal(sleep[0]?.pathway.slug, "sleep-wind-down");
    assert.ok(
      sleep.every((item) =>
        /sleep/i.test(
          [item.pathway.name, item.pathway.tagline, item.pathway.summary, item.focus].join(" "),
        ),
      ),
    );

    const salutations = filterClasses(listings, { style: "Salutation" });
    assert.ok(salutations.length > 0);
    assert.ok(salutations.every((item) => item.pathway.section === "salutation-goddess"));

    const flows = filterClasses(listings, { style: "Flow" });
    assert.ok(flows.length > 0);
    assert.ok(flows.every((item) => item.style === "Flow"));

    const hips = filterClasses(listings, { focus: "Hips" });
    assert.ok(hips.length > 0);
    assert.ok(hips.every((item) => item.focus === "Hips"));

    const advanced = filterClasses(listings, { level: "Advanced" });
    assert.ok(advanced.every((item) => item.level === "Advanced"));

    assert.equal(filterClasses(listings, { query: "zzzz-not-a-class" }).length, 0);
  });
});

describe("home rows and the classes catalog", () => {
  it("keeps the four home rows on ScrollRow and the catalog filters in the page", () => {
    const home = readFileSync(resolve("client/src/pages/Home.tsx"), "utf8");
    for (const heading of ["Continue practice", "Recommended", "Short sessions", "Programs"]) {
      assert.match(home, new RegExp(heading));
    }
    assert.match(home, /ScrollRow/);
    assert.match(home, /catalogSessionMinutes/);
    assert.match(home, /PlusLock/);
    assert.equal(/timePerSession|minutesPerSession/.test(home), false);

    const page = readFileSync(resolve("client/src/pages/Pathways.tsx"), "utf8");
    assert.match(page, /classes-search/);
    assert.match(page, /classes-filter-style/);
    assert.match(page, /classes-filter-level/);
    assert.match(page, /classes-filter-duration/);
    assert.match(page, /classes-filter-focus/);
    assert.match(page, /flowSessionLabel/);
    assert.match(page, /pathwaySessionRangeLabel/);
    assert.match(page, /section-quick-flows/);
    assert.match(page, /PlusLock/);

    const badge = readFileSync(resolve("client/src/components/PlusLock.tsx"), "utf8");
    assert.match(badge, /Lock/);
    assert.equal(/stripe|entitlement|checkout/i.test(badge), false);
  });
});

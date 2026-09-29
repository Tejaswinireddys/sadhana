import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ASANAS, CATEGORIES } from "../data/content";
import {
  DEFAULT_AUDIENCE_FILTER,
  libraryCountForAudience,
  libraryCountForCategory,
  libraryFamilyChipCounts,
} from "./asanaLibraryFilters";

describe("asana library filters", () => {
  it("defaults the audience/path filter to All so the full catalog shows", () => {
    assert.equal(DEFAULT_AUDIENCE_FILTER, "All");
    assert.equal(libraryCountForAudience(DEFAULT_AUDIENCE_FILTER), ASANAS.length);
    assert.ok(ASANAS.length > 100, `expected a full catalog, got ${ASANAS.length}`);
    assert.ok(
      libraryCountForAudience("Men") < ASANAS.length * 0.25,
      "Men path must stay a subset — All is what opens the library",
    );
  });

  it("exposes family chip counts that sum sensibly", () => {
    assert.equal(libraryCountForCategory("All"), ASANAS.length);
    const chips = libraryFamilyChipCounts();
    assert.equal(chips[0]?.id, "All");
    assert.equal(chips.length, CATEGORIES.length + 1);
    for (const chip of chips.slice(1)) {
      assert.ok(chip.count > 0, `${chip.label} should have poses`);
      assert.ok(chip.count < ASANAS.length, `${chip.label} must be a subset`);
    }
  });

  it("shows family and level chips up front; keeps audience behind More filters", () => {
    const src = readFileSync(resolve("client/src/pages/Asanas.tsx"), "utf8");
    assert.match(src, /DEFAULT_AUDIENCE_FILTER/);
    assert.match(src, /useState<AudienceFilter>\(DEFAULT_AUDIENCE_FILTER\)/);
    assert.equal(/setAudience\(chip\)/.test(src), false);
    assert.equal(/audienceTouched/.test(src), false);
    assert.match(src, /const \[filtersOpen, setFiltersOpen\] = useState\(false\)/);
    assert.match(src, /data-testid="button-library-filter"/);
    assert.match(src, /CollapsibleContent/);
    assert.match(src, /group="audience"/);
    assert.match(src, /useDocumentTitle\("Poses · Sadhana"\)/);
    assert.match(src, />Poses</);
    // Visible family + level chips (not only behind the filter panel).
    assert.match(src, /data-testid="asana-library-quick-filters"/);
    assert.match(src, /chip-row-families/);
    assert.match(src, /libraryFamilyChipCounts/);
    assert.match(src, /chip-level-\$\{l\.toLowerCase\(\)\}/);
    assert.match(src, /More filters/);
    // Category/level no longer live only inside the collapsible panel.
    assert.equal(/group="category"/.test(src), false);
    assert.equal(/group="level"/.test(src), false);
  });
});

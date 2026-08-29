import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ASANAS } from "../data/content";
import {
  DEFAULT_AUDIENCE_FILTER,
  libraryCountForAudience,
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

  it("does not silently pre-apply the active path, and hides chips behind Filter", () => {
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
  });
});

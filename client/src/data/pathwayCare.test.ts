import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathwayBySlug } from "@/data/content";

const PROGRAMS = [
  "gentle-back-care",
  "stress-release-week",
  "chair-limited-mobility",
  "prenatal-gentle-week",
  "7-day-sleep-wind-down",
];

describe("therapeutic pathways", () => {
  it("gives each program a rest day, a who-should-avoid line, and a stop-if line", () => {
    for (const slug of PROGRAMS) {
      const pathway = pathwayBySlug(slug);
      assert.ok(pathway, slug);
      assert.equal(pathway.kind, "daily");
      assert.ok(pathway.dailyPlan?.some((day) => day.restDay), `${slug} rest day`);
      assert.ok((pathway.care?.avoid.length ?? 0) > 40, slug);
      assert.ok((pathway.care?.stopIf.length ?? 0) > 20, slug);
      const text = `${pathway.summary} ${pathway.goalDescription} ${pathway.care?.avoid} ${pathway.care?.stopIf}`;
      assert.doesNotMatch(text, /will (cure|heal|fix|treat)/i);
    }
  });

  it("tells a pregnant practitioner to check with their provider, by trimester", () => {
    const prenatal = pathwayBySlug("prenatal-gentle-week");
    assert.match(prenatal?.care?.providerNote ?? "", /provider/i);
    assert.match(prenatal?.goalDescription ?? "", /not prenatal care/i);
    assert.ok(prenatal?.care?.trimesters?.first);
    assert.ok(prenatal?.care?.trimesters?.second);
    assert.match(prenatal?.care?.trimesters?.third ?? "", /wall squat/i);
  });
});

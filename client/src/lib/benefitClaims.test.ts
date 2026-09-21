import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ASANAS } from "../data/content.ts";
import {
  BENEFIT_REVIEW_NOTE,
  benefitClaimSummary,
  benefitClaimsNeedingReview,
  classifyBenefit,
  poseHasUnreviewedClaims,
} from "./benefitClaims.ts";

describe("benefit claims are flagged, not invented", () => {
  it("separates a sensation from a claim about a condition", () => {
    assert.equal(classifyBenefit("Releases the back and hips").risk, "sensation");
    assert.equal(classifyBenefit("Opens the chest and shoulders").risk, "sensation");
    assert.equal(classifyBenefit("Eases mild anxiety and insomnia").risk, "needs_review");
    assert.equal(classifyBenefit("Calms the nervous system").risk, "needs_review");
    assert.equal(classifyBenefit("Aids digestion").risk, "needs_review");
    assert.equal(classifyBenefit("Soothes sciatica").risk, "needs_review");
  });

  it("names the vocabulary that flagged each line, for the reviewer", () => {
    const { matched } = classifyBenefit("Eases mild anxiety and insomnia");
    assert.deepEqual(matched.sort(), ["anxiety", "insomnia"]);
  });

  /**
   * A count, not a list, so editing the catalog is not blocked — but a new
   * clinical claim cannot land without someone updating this number and
   * therefore noticing they added one.
   */
  it("pins how many claims are outstanding", () => {
    const flagged = benefitClaimsNeedingReview();
    assert.equal(
      flagged.length,
      85,
      `benefit claims needing review changed to ${flagged.length}. If you added one, it belongs in docs/benefit-claim-review.md first.`,
    );
    assert.equal(new Set(flagged.map((c) => c.slug)).size, 72);
    assert.equal(benefitClaimSummary()[0]!.id, "therapeutic-verb");
  });

  it("does not claim evidence it does not have", () => {
    assert.match(BENEFIT_REVIEW_NOTE, /not been reviewed against clinical evidence/);
    assert.match(BENEFIT_REVIEW_NOTE, /not medical advice/);
    const src = readFileSync(resolve("client/src/lib/benefitClaims.ts"), "utf8");
    // No study citations, no "proven", no reviewer names in code.
    assert.equal(/doi\.org|pubmed|study|trial|proven/i.test(src.replace(/must never[^.]*\./g, "")), false);
  });

  it("attaches the caveat to the poses that carry a claim", () => {
    const viparita = ASANAS.find((a) => a.slug === "viparita-karani")!;
    assert.equal(poseHasUnreviewedClaims(viparita), true);
    const detail = readFileSync(resolve("client/src/pages/AsanaDetail.tsx"), "utf8");
    assert.match(detail, /poseHasUnreviewedClaims\(asana\)/);
    assert.match(detail, /data-testid="benefit-review-note"/);
  });
});

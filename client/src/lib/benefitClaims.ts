/**
 * Which "Benefits" lines are making a claim about health?
 *
 * The catalog says things like "Deeply calming for anxiety before bed" and
 * "Eases sciatic-friendly tension for many bodies". Some of that is a
 * description of how a shape feels; some of it names a clinical condition and
 * asserts an effect on it. Those are different kinds of sentence and only one
 * of them needs a reviewer.
 *
 * This module does not decide whether a claim is true, and it must never be
 * used to manufacture evidence for one. It sorts the catalog's own strings
 * into "reads as a sensation" and "names a condition or a mechanism", so an
 * editor has a finite list to take to someone qualified, and so a new claim
 * cannot be added to the catalog without the count moving.
 *
 * See `docs/benefit-claim-review.md`.
 */
import { ASANAS, type Asana } from "@/data/content";

export type ClaimRisk = "sensation" | "needs_review";

export type BenefitClaim = {
  slug: string;
  english: string;
  text: string;
  risk: ClaimRisk;
  /** The vocabulary that put it in this bucket — shown to the reviewer. */
  matched: string[];
};

/**
 * Words that turn a description into a health claim: a named condition, a
 * physiological mechanism, or a clinical verb applied to either.
 */
const CLINICAL_VOCABULARY: Array<{ id: string; pattern: RegExp }> = [
  { id: "anxiety", pattern: /\banxiet(y|ies)|\banxious\b/i },
  { id: "depression", pattern: /\bdepress(ion|ive|ed)\b/i },
  { id: "insomnia", pattern: /\binsomnia\b/i },
  { id: "sciatica", pattern: /\bsciatic(a|-friendly)?\b/i },
  { id: "blood-pressure", pattern: /\bblood pressure\b/i },
  { id: "circulation", pattern: /\bcirculation|lymphatic|venous\b/i },
  { id: "digestion", pattern: /\bdigest(ion|ive)|constipation|bloating\b/i },
  { id: "hormones", pattern: /\bhormon(e|al)|thyroid|adrenal|cortisol\b/i },
  { id: "menstrual", pattern: /\bmenstrual|period cramps|pms\b/i },
  { id: "pregnancy", pattern: /\bpregnan(t|cy)|prenatal|postnatal\b/i },
  { id: "nervous-system", pattern: /\bnervous system|vagus|parasympathetic\b/i },
  { id: "immunity", pattern: /\bimmun(e|ity)\b/i },
  { id: "metabolism", pattern: /\bmetabolism|metabolic\b/i },
  { id: "detox", pattern: /\bdetox(if(y|ies|ication))?|flush(es)? toxins\b/i },
  { id: "injury", pattern: /\b(injur(y|ies)|rehab(ilitation)?|herniat|arthrit)\w*/i },
  { id: "headache", pattern: /\bheadaches?|migraines?\b/i },
  { id: "fertility", pattern: /\bfertility\b/i },
  { id: "therapeutic-verb", pattern: /\b(treats?|cures?|heals?|prevents?|reverses?|relieves?)\b/i },
];

export function classifyBenefit(text: string): { risk: ClaimRisk; matched: string[] } {
  const matched = CLINICAL_VOCABULARY.filter((v) => v.pattern.test(text)).map((v) => v.id);
  return { risk: matched.length > 0 ? "needs_review" : "sensation", matched };
}

export function benefitClaimsFor(asana: Asana): BenefitClaim[] {
  return asana.benefits.map((text) => {
    const { risk, matched } = classifyBenefit(text);
    return { slug: asana.slug, english: asana.english, text, risk, matched };
  });
}

/** Every catalog benefit line that names a condition or a mechanism. */
export function benefitClaimsNeedingReview(): BenefitClaim[] {
  return ASANAS.flatMap(benefitClaimsFor).filter((c) => c.risk === "needs_review");
}

/** Counts per vocabulary term, so a reviewer can start with the biggest group. */
export function benefitClaimSummary(): Array<{ id: string; count: number }> {
  const counts = new Map<string, number>();
  for (const claim of benefitClaimsNeedingReview()) {
    for (const id of claim.matched) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

/**
 * Whether this pose's Benefits list contains anything a reviewer has not
 * cleared. Used to attach a standing caveat in the UI — the honest thing to
 * show while the review is outstanding.
 */
export function poseHasUnreviewedClaims(asana: Asana): boolean {
  return benefitClaimsFor(asana).some((c) => c.risk === "needs_review");
}

/** The caveat shown next to an unreviewed Benefits list. */
export const BENEFIT_REVIEW_NOTE =
  "These describe what the pose is traditionally practised for. They have not been reviewed against clinical evidence and are not medical advice.";

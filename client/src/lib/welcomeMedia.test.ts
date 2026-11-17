/**
 * Welcome / Classes media contracts for QA Priority 3:
 * marketing thumbs must resolve to real assets (or a contained withheld
 * placeholder), and class cards must not render blank grey poster tiles.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { poseImageWithheld } from "../data/poseImageAccuracy.ts";
import { resolvePoseImageSources } from "./poseImageSources.ts";
import { isPoseCatalogPoster } from "./classesApi.ts";

const ROOT = resolve(process.cwd());
const landing = JSON.parse(
  readFileSync(resolve("client/src/data/landing.generated.json"), "utf8"),
) as { sessions: Array<{ poses: Array<{ slug: string }> }> };

describe("welcome marketing pose thumbs", () => {
  it("MarketingPoseImage withholds mismatches via WithheldPoseImage, not raw text", () => {
    const src = readFileSync(resolve("client/src/components/MarketingPoseImage.tsx"), "utf8");
    assert.match(src, /WithheldPoseImage/);
    assert.match(src, /overflow-hidden/);
    assert.match(src, /resolvePoseImageSources/);
    assert.match(src, /import\.meta\.env\.BASE_URL/);
    // The old bug: dump `mismatch.instructed` as the visible child of a 40px box.
    assert.doesNotMatch(src, />\{mismatch\.instructed\}</);
    assert.doesNotMatch(src, />\{m\.instructed\}</);
  });

  it("WithheldPoseImage clamps copy and never overflows its frame", () => {
    const src = readFileSync(resolve("client/src/components/WithheldPoseImage.tsx"), "utf8");
    assert.match(src, /overflow-hidden/);
    assert.match(src, /line-clamp-3/);
    assert.match(src, /truncate/);
    assert.match(src, /No illustration yet/);
    assert.match(src, /compact/);
  });

  it("every featured welcome preview pose resolves to an on-disk asset or a withheld placeholder", () => {
    const sessions = landing.sessions;
    assert.ok(sessions.length >= 3);
    for (const session of sessions) {
      for (const pose of session.poses) {
        if (poseImageWithheld(pose.slug)) continue;
        const sources = resolvePoseImageSources(pose.slug, { thumb: true, baseUrl: "/" });
        assert.ok(
          existsSync(resolve(ROOT, `client/public${sources.src}`)),
          `missing ${sources.src}`,
        );
        assert.ok(
          existsSync(resolve(ROOT, `client/public${sources.webpSrc}`)),
          `missing ${sources.webpSrc}`,
        );
        if (sources.usesThumb) {
          assert.match(sources.src, /\/poses\/thumbs\//);
        } else {
          assert.match(sources.src, new RegExp(`/poses/${pose.slug}\\.png$`));
        }
      }
    }
    // The tired / before-bed queues still include the two reviewed mismatches.
    const allSlugs = sessions.flatMap((s) => s.poses.map((p) => p.slug));
    assert.ok(allSlugs.includes("salamba-balasana"));
    assert.ok(allSlugs.includes("chair-viparita-karani"));
    assert.equal(poseImageWithheld("salamba-balasana"), true);
    assert.equal(poseImageWithheld("chair-viparita-karani"), true);
  });
});

describe("class card poster tiles", () => {
  it("recognises catalog pose posters so ClassCard can avoid cover-crop grey boxes", () => {
    assert.equal(isPoseCatalogPoster("/poses/tadasana.webp"), true);
    assert.equal(isPoseCatalogPoster("/poses/thumbs/tadasana.png"), true);
    assert.equal(isPoseCatalogPoster("https://example.com/poses/balasana.webp"), true);
    assert.equal(isPoseCatalogPoster("https://image.mux.com/abc/thumbnail.webp"), false);
    assert.equal(isPoseCatalogPoster("/api/classes/x/thumbnail.webp"), false);
    assert.equal(isPoseCatalogPoster(null), false);
  });

  it("ClassCard uses contain for pose posters and a titled, clamped onError fallback", () => {
    const src = readFileSync(resolve("client/src/components/ClassCard.tsx"), "utf8");
    assert.match(src, /isPoseCatalogPoster/);
    assert.match(src, /object-contain/);
    assert.match(src, /poster-fallback/);
    assert.match(src, /line-clamp-2/);
    assert.match(src, /formatClassMinutes/);
    assert.match(src, /levelLabel/);
    assert.match(src, /naturalWidth === 0/);
    // Must not keep the prior blank icon-only muted tile as the only fallback.
    assert.doesNotMatch(
      src,
      /flex h-full w-full items-center justify-center text-muted-foreground">\s*<PlayCircle/,
    );
  });
});

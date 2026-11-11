import { test } from "node:test";
import assert from "node:assert/strict";
import { PROFILES } from "@/data/profiles";
import { poseImageWithheld } from "@/data/poseImageAccuracy";
import { profilePreviewSlugs } from "./profilePreview";

test("Better Sleep previews poses that have illustrations", () => {
  const sleep = PROFILES.find((p) => p.id === "better-sleep");
  assert.ok(sleep);
  const slugs = profilePreviewSlugs(sleep.recommendedAsanas, poseImageWithheld);
  assert.deepEqual(slugs, ["constructive-rest", "pawanmuktasana", "parsva-savasana"]);
  assert.equal(slugs.some(poseImageWithheld), false);
});

test("a path whose every pose is withheld still shows placeholders", () => {
  assert.deepEqual(profilePreviewSlugs(["a", "b"], () => true), ["a", "b"]);
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { welcomeRedirectTarget } from "./welcomeGate";

const firstVisit = { welcomeSeen: false, onboardingDone: false };

describe("welcomeRedirectTarget", () => {
  it("renders public deep links directly for a first-time visitor", () => {
    for (const path of [
      "/asanas/marjaryasana-bitilasana",
      "/asanas",
      "/pathways",
      "/pathways/sun-salutation-a",
      "/guided",
      "/breathing",
      "/search",
    ]) {
      assert.equal(welcomeRedirectTarget(path, "", firstVisit), null, path);
    }
  });

  it("keeps a deep link's query string by not redirecting at all", () => {
    assert.equal(welcomeRedirectTarget("/search", "?q=cat", firstVisit), null);
  });

  it("introduces the product only on the bare home page", () => {
    assert.equal(welcomeRedirectTarget("/", "", firstVisit), "/welcome");
  });

  it("carries the original query string to /welcome", () => {
    assert.equal(
      welcomeRedirectTarget("/", "?ref=program-splits", firstVisit),
      "/welcome?ref=program-splits",
    );
    assert.equal(welcomeRedirectTarget("/", "?", firstVisit), "/welcome");
  });

  it("never redirects someone who has seen the welcome or finished onboarding", () => {
    assert.equal(welcomeRedirectTarget("/", "", { welcomeSeen: true, onboardingDone: false }), null);
    assert.equal(welcomeRedirectTarget("/", "", { welcomeSeen: false, onboardingDone: true }), null);
  });
});

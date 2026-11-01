import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { welcomeRedirectTarget, legacyRouteTarget, welcomeEntryTarget } from "./welcomeGate";

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


describe("lightweight welcome entry recovery", () => {
  it("honors legacy bookmarks, including their query and fragment", () => {
    assert.equal(legacyRouteTarget("#/account?tab=signin"), "/account?tab=signin");
    assert.equal(welcomeEntryTarget({ pathname: "/", search: "", hash: "#/privacy" }, firstVisit), "/privacy");
    assert.equal(legacyRouteTarget("#waitlist"), null);
    assert.equal(legacyRouteTarget("#//external.example/path"), null);
    assert.equal(legacyRouteTarget("#/\\external.example/path"), null);
  });
  it("restores returning users without losing query or fragment", () => {
    assert.equal(welcomeEntryTarget({ pathname: "/", search: "?ref=program-x", hash: "#resume" }, { welcomeSeen: true, onboardingDone: false }), "/?ref=program-x#resume");
    assert.equal(welcomeEntryTarget({ pathname: "/", search: "", hash: "" }, { welcomeSeen: false, onboardingDone: true }), "/");
  });
  it("retains first-visit landing and explicit welcome URLs", () => {
    assert.equal(welcomeEntryTarget({ pathname: "/", search: "", hash: "" }, firstVisit), "/welcome");
    assert.equal(welcomeEntryTarget({ pathname: "/", search: "?ref=program-x", hash: "#preview" }, firstVisit), "/welcome?ref=program-x#preview");
    assert.equal(welcomeEntryTarget({ pathname: "/welcome", search: "", hash: "" }, { welcomeSeen: true, onboardingDone: true }), null);
  });
  it("hands client navigation from the lightweight landing to the workspace", () => {
    assert.equal(welcomeEntryTarget({ pathname: "/start", search: "?ref=program-x", hash: "" }, firstVisit), "/start?ref=program-x");
  });
});

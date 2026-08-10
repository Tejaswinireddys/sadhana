import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { welcomeHeaderTitle, isDisplayableName } from "./welcomeTitle";

describe("welcomeHeaderTitle", () => {
  it("invites a first-ever visitor to start (no completed sessions)", () => {
    // No "welcome back" for someone who has never practised — even if a name
    // happens to already be stored.
    assert.equal(
      welcomeHeaderTitle({ hasCompletedSessions: false, displayName: "Maya" }),
      "Start your practice",
    );
    assert.equal(
      welcomeHeaderTitle({ hasCompletedSessions: false, displayName: null }),
      "Start your practice",
    );
  });

  it("welcomes a returning visitor by name when we have one", () => {
    assert.equal(
      welcomeHeaderTitle({ hasCompletedSessions: true, displayName: "Maya" }),
      "Welcome back, Maya",
    );
  });

  it("welcomes a returning visitor without a name", () => {
    assert.equal(
      welcomeHeaderTitle({ hasCompletedSessions: true, displayName: null }),
      "Welcome back",
    );
    assert.equal(
      welcomeHeaderTitle({ hasCompletedSessions: true, displayName: "   " }),
      "Welcome back",
    );
  });

  it("never renders a number where a name belongs (the age bug)", () => {
    // A numeric value (e.g. an age that leaked into the name slot) must never
    // appear as the name — greet with no name instead.
    assert.equal(
      welcomeHeaderTitle({ hasCompletedSessions: true, displayName: "34" }),
      "Welcome back",
    );
    assert.equal(
      welcomeHeaderTitle({ hasCompletedSessions: true, displayName: " 7 " }),
      "Welcome back",
    );
  });
});

describe("isDisplayableName", () => {
  it("accepts a real name, rejects empty / numeric values", () => {
    assert.equal(isDisplayableName("Maya"), true);
    assert.equal(isDisplayableName("Maya 2"), true); // a name with a digit is fine
    assert.equal(isDisplayableName(null), false);
    assert.equal(isDisplayableName(undefined), false);
    assert.equal(isDisplayableName(""), false);
    assert.equal(isDisplayableName("   "), false);
    assert.equal(isDisplayableName("42"), false);
  });
});

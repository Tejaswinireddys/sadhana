import { test } from "node:test";
import assert from "node:assert/strict";
import { servesWelcomeHtml } from "./welcomeEntry";

test("only a brand-new guest gets the welcome page at /", () => {
  assert.equal(servesWelcomeHtml("/", undefined), true);
  assert.equal(servesWelcomeHtml("/", "sadhana_device=abc"), true);
  assert.equal(servesWelcomeHtml("/", "sadhana_welcome_seen=1"), false);
  assert.equal(servesWelcomeHtml("/", "sadhana_device=abc; sadhana_welcome_seen=1"), false);
});

test("an account session lands on Today even without the welcome-seen cookie", () => {
  assert.equal(servesWelcomeHtml("/", "sadhana_session=tok123"), false);
  assert.equal(servesWelcomeHtml("/", "sadhana_device=abc; sadhana_session=tok%2B123"), false);
  // A cleared session cookie (Max-Age=0 leaves an empty value) is not a session.
  assert.equal(servesWelcomeHtml("/", "sadhana_session="), true);
  // Look-alike names do not count.
  assert.equal(servesWelcomeHtml("/", "xsadhana_session=tok; sadhana_welcome_seen=0"), true);
});

test("/welcome is always the welcome page, and other paths never are", () => {
  assert.equal(servesWelcomeHtml("/welcome", "sadhana_session=tok"), true);
  assert.equal(servesWelcomeHtml("/classes", undefined), false);
});

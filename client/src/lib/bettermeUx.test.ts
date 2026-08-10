/**
 * Guards the BetterMe-inspired UX contract: quiz-first landing + /start funnel.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("BetterMe-inspired UX contract", () => {
  it("routes Get started CTAs to /start on the landing page", () => {
    const landing = readFileSync(resolve("client/src/pages/Landing.tsx"), "utf8");
    assert.match(landing, /data-testid="landing-cta-primary"/);
    assert.match(landing, /href="\/start"/);
    assert.match(landing, /Get started/);
    assert.match(landing, /data-testid="landing-cta-sticky"/);
    assert.match(landing, /PROGRAMS/);
  });

  it("ships a quiz → building → plan reveal funnel at StartQuiz", () => {
    const quiz = readFileSync(resolve("client/src/pages/StartQuiz.tsx"), "utf8");
    assert.match(quiz, /data-testid="start-quiz"/);
    assert.match(quiz, /building/);
    assert.match(quiz, /data-testid="plan-reveal"/);
    assert.match(quiz, /data-testid="start-first-session"/);
    assert.equal(/hard paywall|forced trial|countdown discount/i.test(quiz), false);
  });

  it("keeps /start chrome-free in the app shell", () => {
    const app = readFileSync(resolve("client/src/App.tsx"), "utf8");
    const layout = readFileSync(resolve("client/src/components/AppLayout.tsx"), "utf8");
    assert.match(app, /path="\/start"/);
    assert.match(layout, /location === "\/start"/);
  });
});

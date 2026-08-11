/**
 * Guards the quiz-first UX contract — BetterMe conversion clarity with a real
 * Sadhana practice payoff (session load, program refs, chrome-free /start).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Premium quiz-first UX contract", () => {
  it("routes Get started CTAs to /start on the landing page", () => {
    const landing = readFileSync(resolve("client/src/pages/Landing.tsx"), "utf8");
    assert.match(landing, /data-testid="landing-cta-primary"/);
    assert.match(landing, /href="\/start"/);
    assert.match(landing, /Get my plan/);
    assert.match(landing, /data-testid="landing-cta-sticky"/);
    assert.match(landing, /PROGRAMS/);
    assert.match(landing, /landing-brand-rise/);
    assert.match(landing, /landing-cta-glow/);
    assert.equal(/hard paywall|forced trial|countdown discount/i.test(landing), false);
  });

  it("ships a quiz → building → plan reveal funnel that loads a real session", () => {
    const quiz = readFileSync(resolve("client/src/pages/StartQuiz.tsx"), "utf8");
    assert.match(quiz, /data-testid="start-quiz"/);
    assert.match(quiz, /building/);
    assert.match(quiz, /data-testid="plan-reveal"/);
    assert.match(quiz, /data-testid="start-first-session"/);
    assert.match(quiz, /loadSession/);
    assert.match(quiz, /buildQuizPlan/);
    assert.match(quiz, /parseProgramRef/);
    assert.match(quiz, /plan-pose-preview/);
    assert.equal(/hard paywall|forced trial|countdown discount/i.test(quiz), false);
  });

  it("keeps /start chrome-free in the app shell", () => {
    const app = readFileSync(resolve("client/src/App.tsx"), "utf8");
    const layout = readFileSync(resolve("client/src/components/AppLayout.tsx"), "utf8");
    assert.match(app, /path="\/start"/);
    assert.match(layout, /location === "\/start"/);
  });

  it("defines funnel and landing motion helpers", () => {
    const css = readFileSync(resolve("client/src/index.css"), "utf8");
    assert.match(css, /\.funnel-shell/);
    assert.match(css, /\.landing-brand-rise/);
    assert.match(css, /\.landing-sticky-cta/);
  });
});

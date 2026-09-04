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
    assert.equal(/kind funnel|Conversion without dark patterns/i.test(landing), false);
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

  it("keeps implementation copy out of Settings and Plans", () => {
    const settings = readFileSync(resolve("client/src/pages/Settings.tsx"), "utf8");
    const plus = readFileSync(resolve("client/src/pages/Plus.tsx"), "utf8");
    const billing = readFileSync(resolve("server/billing.ts"), "utf8");
    assert.equal(/production service worker/.test(settings), false);
    assert.match(settings, /import\.meta\.env\.DEV/);
    assert.equal(/Stripe keys are set/.test(plus), false);
    assert.equal(/Stripe keys are set/.test(billing), false);
  });

  it("keeps /start chrome-free in the app shell", () => {
    const app = readFileSync(resolve("client/src/App.tsx"), "utf8");
    const layout = readFileSync(resolve("client/src/components/AppLayout.tsx"), "utf8");
    assert.match(app, /path="\/start"/);
    assert.match(layout, /location === "\/start"/);
  });

  it("treats quiz completion as Home onboarding, not a second newcomer quiz", () => {
    const home = readFileSync(resolve("client/src/pages/Home.tsx"), "utf8");
    assert.match(home, /readQuizPlan/);
    assert.match(home, /data-testid="card-quiz-plan"/);
    assert.match(home, /Retake quiz/);
    assert.match(home, /!quizDone/);
    assert.match(home, /showQuizPlanCta = !isLoading && !showResume && !!quizPlan/);
    assert.match(home, /Separate from your/);
    assert.equal(/Secondary destinations live here/.test(home), false);
  });

  it("keeps difficulty badges on the readable foreground token", () => {
    const asanas = readFileSync(resolve("client/src/pages/Asanas.tsx"), "utf8");
    const search = readFileSync(resolve("client/src/pages/Search.tsx"), "utf8");
    const detail = readFileSync(resolve("client/src/pages/AsanaDetail.tsx"), "utf8");
    const badge = readFileSync(resolve("client/src/lib/difficultyBadge.ts"), "utf8");
    assert.match(asanas, /difficultyBadgeClass/);
    assert.match(search, /difficultyBadgeClass/);
    assert.match(detail, /difficultyBadgeClass/);
    assert.match(badge, /text-foreground/);
    assert.equal(/text-secondary-foreground/.test(badge), false);
  });

  it("renders recent session poses as names, not a JSON array", () => {
    const settings = readFileSync(resolve("client/src/pages/Settings.tsx"), "utf8");
    assert.match(settings, /formatSessionPoseLine\(s\.asanas\)/);
  });

  it("defines funnel and landing motion helpers", () => {
    const css = readFileSync(resolve("client/src/index.css"), "utf8");
    assert.match(css, /\.funnel-shell/);
    assert.match(css, /\.landing-brand-rise/);
    assert.match(css, /\.landing-sticky-cta/);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  questionDropOff,
  quizCompletionByFlow,
  paywallConversion,
  retentionByAcquisitionWeek,
  sessionsBeforeCancel,
  cohortWeekStart,
} from "./dashboardMetrics";
import { buildDemoEvents } from "./demoEvents";
import { PRODUCT_EVENTS } from "./events";
import { resolveFlowId, QUIZ_FLOWS } from "./flows";
import { parseAttribution, trafficSource } from "./attribution";

describe("product event taxonomy", () => {
  it("includes every required funnel event name", () => {
    for (const name of [
      "quiz_started",
      "quiz_question_shown",
      "quiz_answered",
      "quiz_abandoned",
      "quiz_completed",
      "plan_revealed",
      "paywall_viewed",
      "checkout_started",
      "purchase_completed",
      "app_first_open",
      "session_started",
      "session_completed",
      "subscription_cancelled",
    ]) {
      assert.ok(PRODUCT_EVENTS.includes(name as (typeof PRODUCT_EVENTS)[number]), name);
    }
  });
});

describe("flows + attribution", () => {
  it("maps pose refs to pose_cta flow", () => {
    assert.equal(resolveFlowId(null, "pose-tadasana"), "pose_cta");
    assert.equal(resolveFlowId("onboarding_v1", null), "onboarding_v1");
    assert.ok(QUIZ_FLOWS.onboarding_v1.questions.length >= 3);
  });

  it("parses utm and ref", () => {
    const attr = parseAttribution({
      ref: "pose-warrior",
      utm_source: "google",
      utm_campaign: "seo",
    });
    assert.equal(attr.ref, "pose-warrior");
    assert.equal(attr.utm_source, "google");
    assert.equal(trafficSource(attr), "google");
  });
});

describe("dashboard metrics on demo stream", () => {
  const events = buildDemoEvents();

  it("computes per-question drop-off with declining reach", () => {
    const rows = questionDropOff(events, "onboarding_v1");
    assert.ok(rows.length >= 4);
    assert.ok(rows[0]!.reach_rate >= rows[rows.length - 1]!.reach_rate);
    assert.ok(rows[0]!.shown > rows[rows.length - 1]!.shown);
  });

  it("reports quiz completion by flow_id", () => {
    const rows = quizCompletionByFlow(events);
    const main = rows.find((r) => r.flow_id === "onboarding_v1");
    assert.ok(main);
    assert.ok(main!.started > 0);
    assert.ok(main!.completion_rate > 0 && main!.completion_rate <= 1);
  });

  it("breaks paywall conversion by flow and source", () => {
    const rows = paywallConversion(events);
    assert.ok(rows.some((r) => r.source === "instagram"));
    assert.ok(rows.some((r) => r.source === "google"));
    const ig = rows.find((r) => r.flow_id === "onboarding_v1" && r.source === "instagram");
    assert.ok(ig && ig.paywall_views > 0);
    assert.ok(ig!.view_to_purchase <= ig!.view_to_checkout);
  });

  it("cohorts D1/D7/D30 retention by acquisition week", () => {
    assert.equal(cohortWeekStart("2026-07-22T12:00:00.000Z"), "2026-07-20"); // Wed → Mon
    const rows = retentionByAcquisitionWeek(events);
    assert.ok(rows.length >= 1);
    const c = rows[0]!;
    assert.ok(c.size > 0);
    assert.ok(c.d1_rate <= c.d7_rate + 1e-9);
    assert.ok(c.d7_rate <= c.d30_rate + 1e-9);
  });

  it("summarizes sessions completed before cancellation", () => {
    const row = sessionsBeforeCancel(events);
    assert.equal(row.cancellations, 8);
    assert.ok(row.median_sessions_before_cancel >= 0);
    assert.ok(row.histogram.some((h) => h.count > 0));
  });
});

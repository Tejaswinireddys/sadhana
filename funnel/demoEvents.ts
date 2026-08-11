/**
 * Deterministic sample event stream so the dashboard is useful before PostHog
 * is wired to production traffic.
 */
import { makeLoggedEvent, type LoggedEvent } from "./eventLog";
import { DEFAULT_FLOW_ID } from "./flows";

export function buildDemoEvents(now = new Date("2026-08-10T12:00:00.000Z")): LoggedEvent[] {
  const events: LoggedEvent[] = [];
  const flow = DEFAULT_FLOW_ID;
  const questions = ["goal", "experience", "time", "focus"];

  // Cohort week A — strong completion
  for (let i = 0; i < 40; i++) {
    const id = `demo-a-${i}`;
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 21);
    start.setUTCHours(10, i % 60, 0, 0);
    events.push(
      makeLoggedEvent(
        "quiz_started",
        { flow_id: flow, ref: "landing", utm_source: "instagram" },
        id,
        start.toISOString(),
      ),
    );
    events.push(
      makeLoggedEvent("app_first_open", { source: "quiz" }, id, start.toISOString()),
    );
    let abandonAt = -1;
    if (i >= 32) abandonAt = 1; // drop after Q2
    else if (i >= 28) abandonAt = 2;
    for (let q = 0; q < questions.length; q++) {
      if (abandonAt >= 0 && q > abandonAt) break;
      const shownAt = new Date(start.getTime() + (q + 1) * 15_000);
      events.push(
        makeLoggedEvent(
          "quiz_question_shown",
          { flow_id: flow, question_id: questions[q]!, index: q },
          id,
          shownAt.toISOString(),
        ),
      );
      if (abandonAt === q) {
        events.push(
          makeLoggedEvent(
            "quiz_abandoned",
            { flow_id: flow, last_question_id: questions[q]! },
            id,
            new Date(shownAt.getTime() + 8_000).toISOString(),
          ),
        );
        break;
      }
      events.push(
        makeLoggedEvent(
          "quiz_answered",
          {
            flow_id: flow,
            question_id: questions[q]!,
            answer: "opt",
            ms_on_screen: 4000 + q * 500,
          },
          id,
          new Date(shownAt.getTime() + 5_000).toISOString(),
        ),
      );
    }
    if (i < 28) {
      const done = new Date(start.getTime() + 90_000);
      events.push(
        makeLoggedEvent(
          "quiz_completed",
          { flow_id: flow, duration_ms: 90_000 },
          id,
          done.toISOString(),
        ),
      );
      events.push(makeLoggedEvent("plan_revealed", { flow_id: flow }, id, done.toISOString()));
      events.push(
        makeLoggedEvent(
          "paywall_viewed",
          { flow_id: flow, price_shown: 9.99, currency: "USD", utm_source: "instagram" },
          id,
          new Date(done.getTime() + 2_000).toISOString(),
        ),
      );
      if (i < 12) {
        events.push(
          makeLoggedEvent(
            "checkout_started",
            { flow_id: flow, plan: "plus", utm_source: "instagram" },
            id,
            new Date(done.getTime() + 5_000).toISOString(),
          ),
        );
      }
      if (i < 8) {
        events.push(
          makeLoggedEvent(
            "purchase_completed",
            { flow_id: flow, plan: "plus", amount: 9.99, currency: "USD", utm_source: "instagram" },
            id,
            new Date(done.getTime() + 60_000).toISOString(),
          ),
        );
      }
      // Retention activity
      events.push(
        makeLoggedEvent(
          "session_started",
          { pathway: "foundations-beginner", planned_minutes: 20 },
          id,
          new Date(done.getTime() + 3_600_000).toISOString(),
        ),
      );
      events.push(
        makeLoggedEvent(
          "session_completed",
          { actual_minutes: 18, poses_completed: 8, poses_skipped: 1 },
          id,
          new Date(done.getTime() + 4_800_000).toISOString(),
        ),
      );
      if (i < 18) {
        const d1 = new Date(start);
        d1.setUTCDate(d1.getUTCDate() + 1);
        events.push(
          makeLoggedEvent(
            "session_started",
            { pathway: "foundations-beginner", planned_minutes: 15 },
            id,
            d1.toISOString(),
          ),
        );
      }
      if (i < 10) {
        const d7 = new Date(start);
        d7.setUTCDate(d7.getUTCDate() + 6);
        events.push(
          makeLoggedEvent(
            "session_completed",
            { actual_minutes: 12, poses_completed: 6, poses_skipped: 0 },
            id,
            d7.toISOString(),
          ),
        );
      }
      if (i < 4) {
        const d30 = new Date(start);
        d30.setUTCDate(d30.getUTCDate() + 20);
        events.push(
          makeLoggedEvent(
            "session_started",
            { pathway: "stress-release-week", planned_minutes: 20 },
            id,
            d30.toISOString(),
          ),
        );
      }
    }
  }

  // pose_cta + google source cohort
  for (let i = 0; i < 20; i++) {
    const id = `demo-b-${i}`;
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 10);
    events.push(
      makeLoggedEvent(
        "quiz_started",
        { flow_id: "pose_cta", ref: "pose-tadasana", utm_source: "google" },
        id,
        start.toISOString(),
      ),
    );
    for (let q = 0; q < 3; q++) {
      const qid = ["goal", "experience", "time"][q]!;
      events.push(
        makeLoggedEvent(
          "quiz_question_shown",
          { flow_id: "pose_cta", question_id: qid, index: q },
          id,
          new Date(start.getTime() + (q + 1) * 10_000).toISOString(),
        ),
      );
      if (i < 15 || q < 2) {
        events.push(
          makeLoggedEvent(
            "quiz_answered",
            { flow_id: "pose_cta", question_id: qid, answer: "x", ms_on_screen: 3000 },
            id,
            new Date(start.getTime() + (q + 1) * 10_000 + 4_000).toISOString(),
          ),
        );
      }
    }
    if (i < 15) {
      events.push(
        makeLoggedEvent(
          "quiz_completed",
          { flow_id: "pose_cta", duration_ms: 45_000 },
          id,
          new Date(start.getTime() + 50_000).toISOString(),
        ),
      );
      events.push(
        makeLoggedEvent(
          "paywall_viewed",
          { flow_id: "pose_cta", price_shown: 9.99, currency: "USD", utm_source: "google" },
          id,
          new Date(start.getTime() + 55_000).toISOString(),
        ),
      );
      if (i < 5) {
        events.push(
          makeLoggedEvent(
            "checkout_started",
            { flow_id: "pose_cta", plan: "plus", utm_source: "google" },
            id,
            new Date(start.getTime() + 70_000).toISOString(),
          ),
        );
        events.push(
          makeLoggedEvent(
            "purchase_completed",
            {
              flow_id: "pose_cta",
              plan: "plus",
              amount: 9.99,
              currency: "USD",
              utm_source: "google",
            },
            id,
            new Date(start.getTime() + 120_000).toISOString(),
          ),
        );
      }
    }
  }

  // Cancellations with varying prior session counts
  for (const [i, sessions] of [0, 1, 2, 3, 4, 8, 12, 15].entries()) {
    events.push(
      makeLoggedEvent(
        "subscription_cancelled",
        { days_active: 14 + i * 3, sessions_completed: sessions },
        `demo-cancel-${i}`,
        now.toISOString(),
      ),
    );
  }

  return events;
}

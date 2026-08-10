/**
 * Pure metric builders for the product analytics dashboard.
 * Work from a logged event stream (local buffer or PostHog export).
 */
import type { LoggedEvent } from "./eventLog";
import { trafficSource, type Attribution } from "./attribution";
import { getFlow } from "./flows";

export type QuestionDropOffRow = {
  flow_id: string;
  question_id: string;
  index: number;
  shown: number;
  answered: number;
  /** answered / shown for this step (0–1). */
  answer_rate: number;
  /** Fraction of quiz_started that reached this question. */
  reach_rate: number;
};

export type FlowCompletionRow = {
  flow_id: string;
  started: number;
  completed: number;
  completion_rate: number;
};

export type PaywallConversionRow = {
  flow_id: string;
  source: string;
  paywall_views: number;
  checkouts: number;
  purchases: number;
  view_to_checkout: number;
  view_to_purchase: number;
};

export type RetentionCohortRow = {
  /** ISO week start (Monday) of first app_first_open / quiz_started. */
  cohort_week: string;
  size: number;
  d1: number;
  d7: number;
  d30: number;
  d1_rate: number;
  d7_rate: number;
  d30_rate: number;
};

export type CancelSessionsRow = {
  cancellations: number;
  median_sessions_before_cancel: number;
  mean_sessions_before_cancel: number;
  histogram: { bucket: string; count: number }[];
};

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Monday (UTC) of the ISO week containing `iso`. */
export function cohortWeekStart(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + diff);
  return utc.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(dayKey(b)) - Date.parse(dayKey(a));
  return Math.round(ms / 86_400_000);
}

/** Per-question funnel drop-off — the most important chart. */
export function questionDropOff(events: LoggedEvent[], flowId?: string): QuestionDropOffRow[] {
  const startedByFlow = new Map<string, number>();
  const shown = new Map<string, number>(); // flow|qid|index
  const answered = new Map<string, number>();

  for (const e of events) {
    const flow = str(e.properties.flow_id) || "unknown";
    if (flowId && flow !== flowId) continue;
    if (e.event === "quiz_started") {
      startedByFlow.set(flow, (startedByFlow.get(flow) ?? 0) + 1);
    }
    if (e.event === "quiz_question_shown") {
      const qid = str(e.properties.question_id);
      const index = num(e.properties.index);
      const key = `${flow}|${qid}|${index}`;
      shown.set(key, (shown.get(key) ?? 0) + 1);
    }
    if (e.event === "quiz_answered") {
      const qid = str(e.properties.question_id);
      // index may be absent on answer — resolve from flow definition
      const flowDef = getFlow(flow);
      const index = flowDef.questions.findIndex((q) => q.id === qid);
      const key = `${flow}|${qid}|${index >= 0 ? index : 0}`;
      answered.set(key, (answered.get(key) ?? 0) + 1);
    }
  }

  const rows: QuestionDropOffRow[] = [];
  for (const [key, shownCount] of shown) {
    const [flow, qid, indexStr] = key.split("|");
    const index = Number(indexStr);
    const ans = answered.get(key) ?? 0;
    const started = startedByFlow.get(flow) ?? 0;
    rows.push({
      flow_id: flow,
      question_id: qid,
      index,
      shown: shownCount,
      answered: ans,
      answer_rate: shownCount ? ans / shownCount : 0,
      reach_rate: started ? shownCount / started : 0,
    });
  }
  rows.sort((a, b) => a.flow_id.localeCompare(b.flow_id) || a.index - b.index);
  return rows;
}

export function quizCompletionByFlow(events: LoggedEvent[]): FlowCompletionRow[] {
  const started = new Map<string, number>();
  const completed = new Map<string, number>();
  for (const e of events) {
    const flow = str(e.properties.flow_id) || "unknown";
    if (e.event === "quiz_started") started.set(flow, (started.get(flow) ?? 0) + 1);
    if (e.event === "quiz_completed") completed.set(flow, (completed.get(flow) ?? 0) + 1);
  }
  const flows = new Set([...started.keys(), ...completed.keys()]);
  return [...flows]
    .map((flow_id) => {
      const s = started.get(flow_id) ?? 0;
      const c = completed.get(flow_id) ?? 0;
      return {
        flow_id,
        started: s,
        completed: c,
        completion_rate: s ? c / s : 0,
      };
    })
    .sort((a, b) => a.flow_id.localeCompare(b.flow_id));
}

export function paywallConversion(events: LoggedEvent[]): PaywallConversionRow[] {
  type Acc = { views: number; checkouts: number; purchases: number };
  const map = new Map<string, Acc>();

  const bump = (flow: string, source: string, field: keyof Acc) => {
    const key = `${flow}|${source}`;
    const row = map.get(key) ?? { views: 0, checkouts: 0, purchases: 0 };
    row[field] += 1;
    map.set(key, row);
  };

  for (const e of events) {
    const flow = str(e.properties.flow_id) || "unknown";
    const attr: Attribution = {
      ref: str(e.properties.ref) || undefined,
      utm_source: str(e.properties.utm_source) || undefined,
    };
    const source = trafficSource(attr);
    if (e.event === "paywall_viewed") bump(flow, source, "views");
    if (e.event === "checkout_started") bump(flow, source, "checkouts");
    if (e.event === "purchase_completed") bump(flow, source, "purchases");
  }

  return [...map.entries()]
    .map(([key, acc]) => {
      const [flow_id, source] = key.split("|");
      return {
        flow_id,
        source,
        paywall_views: acc.views,
        checkouts: acc.checkouts,
        purchases: acc.purchases,
        view_to_checkout: acc.views ? acc.checkouts / acc.views : 0,
        view_to_purchase: acc.views ? acc.purchases / acc.views : 0,
      };
    })
    .sort((a, b) => a.flow_id.localeCompare(b.flow_id) || a.source.localeCompare(b.source));
}

/**
 * D1 / D7 / D30 retention, cohorted by acquisition week.
 * Acquisition = first quiz_started or app_first_open per distinct_id.
 * Retention day = any session_started or session_completed on that calendar day offset.
 */
export function retentionByAcquisitionWeek(events: LoggedEvent[]): RetentionCohortRow[] {
  const firstTouch = new Map<string, string>();
  const activityDays = new Map<string, Set<string>>();

  for (const e of events) {
    const id = e.distinct_id;
    if (!id) continue;
    if (e.event === "quiz_started" || e.event === "app_first_open") {
      const prev = firstTouch.get(id);
      if (!prev || e.ts < prev) firstTouch.set(id, e.ts);
    }
    if (e.event === "session_started" || e.event === "session_completed" || e.event === "app_first_open") {
      let set = activityDays.get(id);
      if (!set) {
        set = new Set();
        activityDays.set(id, set);
      }
      set.add(dayKey(e.ts));
    }
  }

  type Acc = { size: number; d1: number; d7: number; d30: number };
  const cohorts = new Map<string, Acc>();

  for (const [id, acquiredAt] of firstTouch) {
    const week = cohortWeekStart(acquiredAt);
    const acc = cohorts.get(week) ?? { size: 0, d1: 0, d7: 0, d30: 0 };
    acc.size += 1;
    const days = activityDays.get(id) ?? new Set();
    const acqDay = dayKey(acquiredAt);
    let hit1 = false;
    let hit7 = false;
    let hit30 = false;
    for (const d of days) {
      const delta = daysBetween(acqDay, d);
      if (delta === 1) hit1 = true;
      if (delta >= 1 && delta <= 7) hit7 = true;
      if (delta >= 1 && delta <= 30) hit30 = true;
    }
    if (hit1) acc.d1 += 1;
    if (hit7) acc.d7 += 1;
    if (hit30) acc.d30 += 1;
    cohorts.set(week, acc);
  }

  return [...cohorts.entries()]
    .map(([cohort_week, acc]) => ({
      cohort_week,
      size: acc.size,
      d1: acc.d1,
      d7: acc.d7,
      d30: acc.d30,
      d1_rate: acc.size ? acc.d1 / acc.size : 0,
      d7_rate: acc.size ? acc.d7 / acc.size : 0,
      d30_rate: acc.size ? acc.d30 / acc.size : 0,
    }))
    .sort((a, b) => a.cohort_week.localeCompare(b.cohort_week));
}

/** Sessions completed before first cancellation (from subscription_cancelled props). */
export function sessionsBeforeCancel(events: LoggedEvent[]): CancelSessionsRow {
  const counts: number[] = [];
  for (const e of events) {
    if (e.event !== "subscription_cancelled") continue;
    counts.push(Math.max(0, Math.floor(num(e.properties.sessions_completed))));
  }
  counts.sort((a, b) => a - b);
  const n = counts.length;
  const mean = n ? counts.reduce((s, x) => s + x, 0) / n : 0;
  const median = n ? (n % 2 ? counts[(n - 1) / 2]! : (counts[n / 2 - 1]! + counts[n / 2]!) / 2) : 0;

  const buckets = [
    { bucket: "0", min: 0, max: 0 },
    { bucket: "1–2", min: 1, max: 2 },
    { bucket: "3–5", min: 3, max: 5 },
    { bucket: "6–10", min: 6, max: 10 },
    { bucket: "11+", min: 11, max: Infinity },
  ];
  const histogram = buckets.map((b) => ({
    bucket: b.bucket,
    count: counts.filter((c) => c >= b.min && c <= b.max).length,
  }));

  return {
    cancellations: n,
    median_sessions_before_cancel: median,
    mean_sessions_before_cancel: mean,
    histogram,
  };
}

/**
 * Product analytics dashboard.
 * Production: this-device transparency only (no demo stream, env names, or SQL).
 * Development: operator tools (demo data, HogQL recipes).
 */
import { useMemo, useState } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  questionDropOff,
  quizCompletionByFlow,
  paywallConversion,
  retentionByAcquisitionWeek,
  sessionsBeforeCancel,
} from "../../../funnel/dashboardMetrics";
import { buildDemoEvents } from "../../../funnel/demoEvents";
import {
  appendProductEvents,
  clearProductEventBuffer,
  readProductEventBuffer,
} from "@/lib/productAnalytics";
import { posthogConfigured } from "@/lib/posthogClient";
import type { LoggedEvent } from "../../../funnel/eventLog";

function pct(n: number): string {
  return `${Math.round(n * 1000) / 10}%`;
}

const isOperator = import.meta.env.DEV;

export default function FunnelDashboard() {
  useDocumentTitle(isOperator ? "Funnel analytics · Sadhana" : "Practice metrics · Sadhana");
  const [tick, setTick] = useState(0);
  const [useDemo, setUseDemo] = useState(false);

  const events: LoggedEvent[] = useMemo(() => {
    void tick;
    const live = readProductEventBuffer();
    if (isOperator && (useDemo || live.length < 8)) return buildDemoEvents();
    return live;
  }, [tick, useDemo]);

  const dropOff = useMemo(() => questionDropOff(events), [events]);
  const completion = useMemo(() => quizCompletionByFlow(events), [events]);
  const paywall = useMemo(() => paywallConversion(events), [events]);
  const retention = useMemo(() => retentionByAcquisitionWeek(events), [events]);
  const cancelStats = useMemo(() => sessionsBeforeCancel(events), [events]);

  const dropOffChart = dropOff.map((r) => ({
    step: `${r.flow_id.slice(0, 8)}·Q${r.index + 1}:${r.question_id}`,
    shown: r.shown,
    answered: r.answered,
    reach_pct: Math.round(r.reach_rate * 1000) / 10,
    answer_pct: Math.round(r.answer_rate * 1000) / 10,
  }));

  const retentionChart = retention.map((r) => ({
    week: r.cohort_week,
    D1: Math.round(r.d1_rate * 1000) / 10,
    D7: Math.round(r.d7_rate * 1000) / 10,
    D30: Math.round(r.d30_rate * 1000) / 10,
    size: r.size,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-2" data-testid="funnel-dashboard">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            {isOperator ? "Funnel analytics" : "Practice metrics"}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {isOperator ? (
              <>
                Per-question drop-off, quiz completion, paywall conversion, retention, and
                sessions-before-cancel.{" "}
                {posthogConfigured()
                  ? "PostHog is configured — live capture is on for funnel events."
                  : "PostHog is not configured in this environment — showing the local buffer or demo metrics."}
              </>
            ) : (
              <>
                Metrics stored in this browser only. This is not a live, product-wide dashboard and
                does not include other people&apos;s data.
              </>
            )}
          </p>
        </div>
        {isOperator && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setUseDemo(false);
                setTick((t) => t + 1);
              }}
            >
              Refresh buffer
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                clearProductEventBuffer();
                appendProductEvents(buildDemoEvents());
                setUseDemo(false);
                setTick((t) => t + 1);
              }}
            >
              Load demo data
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                setUseDemo(true);
                setTick((t) => t + 1);
              }}
            >
              Use demo stream
            </Button>
          </div>
        )}
      </header>

      <Card data-testid="chart-dropoff">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Per-question drop-off</CardTitle>
          <CardDescription>
            Reach rate from quiz_started → each quiz_question_shown, plus answer rate on that step.
            This is the highest-leverage chart for quiz copy and ordering.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dropOffChart} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="step" tick={{ fontSize: 10 }} angle={-28} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="shown" name="Shown" fill="hsl(var(--primary))" opacity={0.85} />
              <Bar dataKey="answered" name="Answered" fill="hsl(var(--chart-2))" opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="chart-completion">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Quiz completion by flow</CardTitle>
            <CardDescription>quiz_completed ÷ quiz_started</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {completion.map((r) => (
                <li key={r.flow_id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{r.flow_id}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {r.completed}/{r.started} · {pct(r.completion_rate)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.min(100, r.completion_rate * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
              {completion.length === 0 && (
                <p className="text-sm text-muted-foreground">No quiz events yet.</p>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card data-testid="chart-paywall">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Paywall conversion</CardTitle>
            <CardDescription>By flow_id and traffic source (utm_source / ref)</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2">Flow</th>
                  <th className="py-1 pr-2">Source</th>
                  <th className="py-1 pr-2 tabular-nums">Views</th>
                  <th className="py-1 pr-2 tabular-nums">Checkout</th>
                  <th className="py-1 pr-2 tabular-nums">Purchase</th>
                  <th className="py-1 tabular-nums">CVR</th>
                </tr>
              </thead>
              <tbody>
                {paywall.map((r) => (
                  <tr key={`${r.flow_id}-${r.source}`} className="border-t border-border">
                    <td className="py-2 pr-2">{r.flow_id}</td>
                    <td className="py-2 pr-2">{r.source}</td>
                    <td className="py-2 pr-2 tabular-nums">{r.paywall_views}</td>
                    <td className="py-2 pr-2 tabular-nums">{r.checkouts}</td>
                    <td className="py-2 pr-2 tabular-nums">{r.purchases}</td>
                    <td className="py-2 tabular-nums">{pct(r.view_to_purchase)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="chart-retention">
        <CardHeader>
          <CardTitle className="font-serif text-xl">D1 / D7 / D30 retention</CardTitle>
          <CardDescription>Cohorted by acquisition week (first quiz_started / app_first_open)</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={retentionChart}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis unit="%" domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="D1" stroke="hsl(var(--primary))" strokeWidth={2} />
              <Line type="monotone" dataKey="D7" stroke="hsl(var(--chart-2))" strokeWidth={2} />
              <Line type="monotone" dataKey="D30" stroke="hsl(var(--chart-3))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card data-testid="chart-cancel-sessions">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Sessions before first cancellation</CardTitle>
          <CardDescription>
            From subscription_cancelled.sessions_completed — median{" "}
            {cancelStats.median_sessions_before_cancel} across {cancelStats.cancellations} cancels
            (mean {cancelStats.mean_sessions_before_cancel.toFixed(1)}).
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cancelStats.histogram}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="bucket" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Cancellations" fill="hsl(var(--destructive))" opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {isOperator && (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">PostHog HogQL recipes</CardTitle>
          <CardDescription>
            Mirror these insights in self-hosted or EU PostHog when remote capture is live.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <pre className="overflow-x-auto rounded-xl bg-muted p-3">{`-- Per-question drop-off
SELECT properties.flow_id, properties.question_id, properties.index,
       count() AS shown
FROM events
WHERE event = 'quiz_question_shown'
GROUP BY 1,2,3 ORDER BY 1,3`}</pre>
          <pre className="overflow-x-auto rounded-xl bg-muted p-3">{`-- Completion by flow
SELECT properties.flow_id,
  countIf(event='quiz_started') AS started,
  countIf(event='quiz_completed') AS completed
FROM events
WHERE event IN ('quiz_started','quiz_completed')
GROUP BY 1`}</pre>
        </CardContent>
      </Card>
      )}
    </div>
  );
}

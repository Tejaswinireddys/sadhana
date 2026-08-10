import type { AnalyticsProps, ProductEvent } from "./events";

/** One captured product event — local buffer + dashboard input. */
export type LoggedEvent = {
  event: ProductEvent;
  properties: AnalyticsProps;
  /** ISO timestamp */
  ts: string;
  /** Anonymous distinct id (device / PostHog distinct) */
  distinct_id: string;
};

export function makeLoggedEvent(
  event: ProductEvent,
  properties: AnalyticsProps,
  distinctId: string,
  ts: string = new Date().toISOString(),
): LoggedEvent {
  return { event, properties, ts, distinct_id: distinctId };
}

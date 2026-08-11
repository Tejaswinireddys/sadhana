/**
 * Product analytics event taxonomy (exact names + property shapes).
 * Shared by the acquisition funnel, client app, and PostHog server capture.
 */

export const PRODUCT_EVENTS = [
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
] as const;

export type ProductEvent = (typeof PRODUCT_EVENTS)[number];

/** UTM keys we always flatten onto acquisition events when present. */
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type UtmProps = Partial<Record<UtmKey, string>>;

export type QuizStartedProps = {
  flow_id: string;
  ref?: string;
} & UtmProps;

export type QuizQuestionShownProps = {
  flow_id: string;
  question_id: string;
  index: number;
};

export type QuizAnsweredProps = {
  flow_id: string;
  question_id: string;
  answer: string;
  ms_on_screen: number;
};

export type QuizAbandonedProps = {
  flow_id: string;
  last_question_id: string;
};

export type QuizCompletedProps = {
  flow_id: string;
  duration_ms: number;
};

export type PlanRevealedProps = {
  flow_id: string;
};

export type PaywallViewedProps = {
  flow_id: string;
  price_shown: number;
  currency: string;
};

export type CheckoutStartedProps = {
  flow_id: string;
  plan: string;
};

export type PurchaseCompletedProps = {
  flow_id: string;
  plan: string;
  amount: number;
  currency: string;
};

export type AppFirstOpenProps = {
  source: string;
};

export type SessionStartedProps = {
  pathway: string;
  planned_minutes: number;
};

export type SessionCompletedProps = {
  actual_minutes: number;
  poses_completed: number;
  poses_skipped: number;
};

export type SubscriptionCancelledProps = {
  days_active: number;
  sessions_completed: number;
};

export type ProductEventProps = {
  quiz_started: QuizStartedProps;
  quiz_question_shown: QuizQuestionShownProps;
  quiz_answered: QuizAnsweredProps;
  quiz_abandoned: QuizAbandonedProps;
  quiz_completed: QuizCompletedProps;
  plan_revealed: PlanRevealedProps;
  paywall_viewed: PaywallViewedProps;
  checkout_started: CheckoutStartedProps;
  purchase_completed: PurchaseCompletedProps;
  app_first_open: AppFirstOpenProps;
  session_started: SessionStartedProps;
  session_completed: SessionCompletedProps;
  subscription_cancelled: SubscriptionCancelledProps;
};

/** Flat property bag safe for PostHog / local buffers (no nested objects). */
export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

export function isProductEvent(name: string): name is ProductEvent {
  return (PRODUCT_EVENTS as readonly string[]).includes(name);
}

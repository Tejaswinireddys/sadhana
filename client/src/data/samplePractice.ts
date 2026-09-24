/**
 * The practice you can start from the landing page without answering anything.
 *
 * "Get my plan" is a good first step for someone who already wants a plan. For
 * someone deciding whether this app teaches in a way that suits them, a quiz is
 * a toll gate. This is a real, short, reviewed queue — the same guided player,
 * the same narration, the same illustrations — so the landing page can be
 * judged by the product rather than by its own copy.
 *
 * Deliberately three familiar shapes with no props: the point is to show the
 * teaching, not to be a complete practice.
 */
export const SAMPLE_PRACTICE: {
  id: string;
  title: string;
  poses: Array<{ slug: string; holdSeconds: number }>;
} = {
  id: "sample",
  title: "A first practice",
  poses: [
    { slug: "tadasana", holdSeconds: 30 },
    { slug: "uttanasana", holdSeconds: 40 },
    { slug: "savasana", holdSeconds: 90 },
  ],
};

/**
 * Sessions shown on the landing page as representative of what is inside.
 *
 * Each names a real catalog queue, so its duration, level, intensity and
 * equipment can be derived rather than written. Nothing here may be a session
 * that does not exist.
 */
export const REPRESENTATIVE_SESSIONS: Array<{
  id: string;
  title: string;
  blurb: string;
  quickSessionId?: string;
  poses?: Array<{ slug: string; holdSeconds: number }>;
}> = [
  {
    id: "tired",
    title: "I'm tired",
    blurb: "Supported shapes to rest in when there is nothing left in the tank.",
    quickSessionId: "tired",
  },
  {
    id: "before-bed",
    title: "Before bed",
    blurb: "A long wind-down, ending flat on the floor.",
    quickSessionId: "before-bed",
  },
  {
    id: "low-energy",
    title: "I'm low energy",
    blurb: "Standing shapes to wake the body up without a workout.",
    quickSessionId: "low-energy",
  },
];

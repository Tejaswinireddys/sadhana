/**
 * Public homepage (/welcome).
 *
 * Mobile-first, in this order: what it is, one way to try it now, what the
 * player actually looks like, three real sessions you can preview or start,
 * how answers change a session, who wrote the content, what is free, help,
 * FAQ, and the same two actions again.
 *
 * Every number on this page is derived from a real queue (`buildSessionPreflight`
 * / `buildQuizPlan`), and nothing here is social proof: there are no reviews
 * to show, so the page shows the product instead.
 */
import { Link, useLocation } from "wouter";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { LotusMark } from "@/components/Logo";
import { PoseImage } from "@/components/PoseImage";
import { SessionSpec } from "@/components/SessionSpec";
import { KEYS, writeString } from "@/lib/localPrefs";
import { FadeIn, Reveal } from "@/components/motion";
import {
  ArrowRight,
  Captions,
  ChevronDown,
  Image as ImageIcon,
  LifeBuoy,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Timer,
  Volume2,
} from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { ASANAS, asanaBySlug } from "@/data/content";
import { QUICK_SESSIONS } from "@/data/quickSessions";
import { REPRESENTATIVE_SESSIONS, SAMPLE_PRACTICE } from "@/data/samplePractice";
import { buildQuizPlan } from "@/data/quizPlan";
import { CONTENT_REVIEW } from "@/data/contentProvenance";
import { benefitClaimsNeedingReview } from "@/lib/benefitClaims";
import { buildSessionPreflight, type PreflightPose } from "@/lib/sessionPreflight";
import { formatDuration } from "@/lib/formatDuration";
import { usePractice } from "@/context/PracticeContext";

const ProductDemoVideo = lazy(() =>
  import("@/components/ProductDemoVideo").then((m) => ({ default: m.ProductDemoVideo })),
);

/** Where to report a problem. The repository is public and has issues enabled. */
export const ISSUE_TRACKER_URL = "https://github.com/Tejaswinireddys/sadhana/issues";
export const SUPPORT_EMAIL = "privacy@sadhana.app";

/** How the app teaches, stated plainly. Each line is checkable in the product. */
const FORMAT = [
  {
    icon: ImageIcon,
    title: "Illustrated poses",
    body: `All ${ASANAS.length} poses are drawn, with the body shape described in text for screen readers. There is no filmed teacher — each pose shows a still.`,
  },
  {
    icon: Volume2,
    title: "Voice guidance",
    body: "A recorded voice talks you into each pose. Choose Learn for full setup, Flow for short cues, or Timer only.",
  },
  {
    icon: Captions,
    title: "Captions, always",
    body: "Every spoken word is on screen, so a muted practice teaches the same thing.",
  },
  {
    icon: Timer,
    title: "Modifications and holds",
    body: "Every pose lists its own modifications and what to avoid, before you start. Pause, replay or skip any time.",
  },
];

const FAQ = [
  {
    q: "What will I see and hear during a practice?",
    a: "An illustration of the pose, a recorded voice talking you into it, the same words as captions, and a countdown for the hold. There is no video of a teacher.",
  },
  {
    q: "Do I need any equipment?",
    a: "Most sessions need nothing. Some restful ones ask for a chair, a bolster or pillows — every session lists its props before you start, and offers a prop-free swap where one keeps the same level.",
  },
  {
    q: "Can I practise offline?",
    a: "No. Narration and pose media load from the internet, so practise with a connection. Your history on this device is kept either way.",
  },
  {
    q: "Where is my progress stored?",
    a: "On this device until you create an account. An optional free account backs it up and syncs it; you can export or delete everything at any time.",
  },
  {
    q: "What if I have never done yoga?",
    a: "Say so in the quiz and advanced poses are left out, not just shortened. Each pose's modifications are shown before you start.",
  },
  {
    q: "Do I need an account?",
    a: "No. Start as a guest. Accounts exist only to back up and sync your practice.",
  },
];

/** Resolve a landing tile into the queue it will actually start. */
function tilePoses(tile: (typeof REPRESENTATIVE_SESSIONS)[number]) {
  const raw =
    tile.poses ??
    QUICK_SESSIONS.find((q) => q.id === tile.quickSessionId)?.poses ??
    [];
  return raw
    .map((p) => {
      const asana = asanaBySlug(p.slug);
      return asana ? ({ ...asana, holdSeconds: p.holdSeconds } as PreflightPose) : null;
    })
    .filter((x): x is PreflightPose => x != null);
}

/** Two sets of real quiz answers, to show what personalisation changes. */
export const PERSONALISATION_EXAMPLE = [
  {
    id: "new-10",
    who: "New to yoga · 10 minutes",
    answers: { goal: "calm", body: "full", experience: "new", time: "10" },
  },
  {
    id: "some-20",
    who: "Some experience · 20 minutes",
    answers: { goal: "calm", body: "full", experience: "some", time: "20" },
  },
] as const;

export default function Landing() {
  useDocumentTitle("Welcome · Sadhana");
  const [, navigate] = useLocation();
  const { loadSession } = usePractice();
  const [previewOpen, setPreviewOpen] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Sadhana — A daily yoga practice that fits your day";
  }, []);

  const enterApp = () => writeString(KEYS.welcomeSeen, "1");

  /** Duration, level, intensity and props, derived from each real queue. */
  const sessions = useMemo(
    () =>
      REPRESENTATIVE_SESSIONS.map((tile) => {
        const poses = tilePoses(tile);
        return { tile, poses, preflight: buildSessionPreflight({ poses }) };
      }).filter((s) => s.poses.length > 0),
    [],
  );

  const samplePoses = useMemo(
    () =>
      SAMPLE_PRACTICE.poses
        .map((p) => {
          const asana = asanaBySlug(p.slug);
          return asana ? { ...asana, holdSeconds: p.holdSeconds } : null;
        })
        .filter((x): x is PreflightPose => x != null),
    [],
  );
  const samplePreflight = useMemo(() => buildSessionPreflight({ poses: samplePoses }), [samplePoses]);
  const firstPose = samplePoses[0];

  const personalisation = useMemo(
    () =>
      PERSONALISATION_EXAMPLE.map((ex) => {
        const plan = buildQuizPlan({ ...ex.answers });
        const poses = plan.poses
          .map((p) => {
            const a = asanaBySlug(p.slug);
            return a ? ({ ...a, holdSeconds: p.holdSeconds, sides: p.sides } as PreflightPose) : null;
          })
          .filter((x): x is PreflightPose => x != null);
        return { ex, plan, preflight: buildSessionPreflight({ poses }) };
      }),
    [],
  );

  const flaggedBenefitLines = useMemo(() => benefitClaimsNeedingReview().length, []);

  /** Start a queue in the real player, via its preparation screen. */
  const startPoses = (poses: PreflightPose[], label: string, minutes: number) => {
    if (!poses.length) return;
    enterApp();
    loadSession(
      poses.map((p) => ({ asana: p, holdSeconds: p.holdSeconds, ...(p.sides ? { sides: p.sides } : {}) })),
      { label, introPoseSlug: poses[0]!.slug, plannedMinutes: minutes },
    );
    navigate("/guided");
  };
  const startSample = () => startPoses(samplePoses, SAMPLE_PRACTICE.title, samplePreflight.minutes);
  const trySampleLabel = `Try a ${samplePreflight.minutes}-minute practice`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#landing-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="border-b border-border/50 bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
          <Link
            href="/welcome"
            className="flex cursor-pointer items-center gap-2.5 text-foreground"
            aria-label="Sadhana home"
          >
            <LotusMark size={28} />
            <span className="landing-brand-rise font-serif text-xl font-semibold tracking-tight md:text-2xl">
              Sadhana
            </span>
          </Link>
          <nav aria-label="Welcome page" className="flex items-center gap-1 sm:gap-3">
            <Link
              href="/help"
              className="hidden min-h-11 items-center px-2 text-sm text-muted-foreground hover:text-foreground sm:inline-flex"
              data-testid="landing-help-header"
            >
              Help
            </Link>
            <Button variant="outline" className="min-h-11 cursor-pointer" asChild data-testid="landing-cta-header">
              <Link href="/start">Find my practice</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main id="landing-main">
        {/*
          Hero: copy on a plain background (high contrast at any width), the
          player preview beside it on desktop and directly under it on phones.
          No text sits over artwork.
        */}
        <section className="border-b border-border/40 bg-background" data-testid="landing-hero">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-[1.1fr_0.9fr] md:items-center md:px-8 md:py-16">
            <FadeIn className="space-y-5">
              <h1
                className="font-serif text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl"
                data-testid="landing-headline"
              >
                A daily yoga practice that fits your day.
              </h1>
              <p className="max-w-lg text-base leading-relaxed text-foreground/80 md:text-lg">
                Illustrated poses, a calm voice that talks you into each one, captions for every
                word, and modifications shown before you start. A few minutes or half an hour — no
                account needed.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  className="landing-cta-glow min-h-14 cursor-pointer px-8 text-base font-semibold"
                  onClick={startSample}
                  data-testid="landing-cta-primary"
                >
                  <Play className="mr-1.5 h-4 w-4" aria-hidden />
                  {trySampleLabel}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-14 cursor-pointer px-7 text-base font-semibold"
                  asChild
                  data-testid="landing-cta-secondary"
                >
                  <Link href="/start">
                    Find my practice <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              </div>
              <SessionSpec preflight={samplePreflight} testId="landing-sample-spec" className="text-sm" />
              <p className="text-sm text-muted-foreground">
                "Find my practice" is five short questions, then a session built from your answers.
              </p>
            </FadeIn>

            {firstPose && (
              <figure className="mx-auto w-full max-w-sm" data-testid="landing-player-preview">
                <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft-lg" aria-hidden>
                  <div className="flex items-center justify-between px-4 pt-3 text-xs text-muted-foreground">
                    <span>Pose 1 of {samplePoses.length}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">How to</span>
                  </div>
                  <div className="mx-auto w-40 py-2">
                    <PoseImage slug={firstPose.slug} breath={false} shadow={false} priority />
                  </div>
                  <div className="space-y-2 px-4 pb-4">
                    <p className="font-serif text-xl">{firstPose.english}</p>
                    <p className="rounded-xl bg-foreground/85 px-3 py-2 text-sm leading-snug text-background">
                      {firstPose.steps[0]?.text}
                    </p>
                    <div className="flex items-center justify-between pt-1 text-muted-foreground">
                      <span className="font-mono text-sm tabular-nums">
                        Hold {formatDuration(firstPose.holdSeconds)}
                      </span>
                      <span className="flex gap-3">
                        <RotateCcw className="h-5 w-5" />
                        <Pause className="h-5 w-5" />
                        <SkipForward className="h-5 w-5" />
                        <Captions className="h-5 w-5" />
                      </span>
                    </div>
                  </div>
                </div>
                <figcaption className="mt-2 text-center text-xs text-muted-foreground">
                  A preview of the player, using the first pose of the {samplePreflight.minutes}-minute
                  practice. Replay, pause, skip and captions are on every pose.
                </figcaption>
              </figure>
            )}
          </div>
        </section>

        {/* Format — one concise, honest description instead of repeated disclaimers. */}
        <section id="format" className="border-b border-border/40 bg-card/50">
          <div className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
            <Reveal className="mb-6 max-w-2xl space-y-2">
              <h2 className="font-serif text-3xl font-semibold tracking-tight">How it teaches</h2>
              <p className="text-muted-foreground" data-testid="landing-no-filmed-instruction">
                Illustrations and voice, not video. There is no filmed instruction yet — each pose
                shows a labelled still.
              </p>
            </Reveal>
            <div className="grid gap-3 sm:grid-cols-2">
              {FORMAT.map((f, i) => (
                <Reveal
                  key={f.title}
                  delay={i * 0.04}
                  className="flex gap-3 rounded-2xl border border-border/60 bg-background p-4"
                  data-testid={`landing-format-${i}`}
                >
                  <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <div className="space-y-1">
                    <h3 className="font-medium">{f.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Three real sessions, each with its own Preview and Start. */}
        <section id="sessions" className="border-b border-border/40 bg-background">
          <div className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
            <Reveal className="mb-6 max-w-2xl space-y-2">
              <h2 className="font-serif text-3xl font-semibold tracking-tight">Featured sessions</h2>
              <p className="text-muted-foreground">Lengths include the voice guidance and transitions.</p>
            </Reveal>
            <div className="grid gap-3 md:grid-cols-3">
              {sessions.map(({ tile, poses, preflight }) => {
                const open = previewOpen === tile.id;
                return (
                  <article
                    key={tile.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5"
                    data-testid={`landing-session-${tile.id}`}
                  >
                    <h3 className="font-serif text-xl font-semibold tracking-tight">{tile.title}</h3>
                    <p className="text-sm leading-relaxed">{tile.blurb}</p>
                    <SessionSpec preflight={preflight} />
                    <div className="mt-auto flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        className="min-h-11 flex-1 cursor-pointer"
                        aria-expanded={open}
                        aria-controls={`landing-preview-${tile.id}`}
                        onClick={() => setPreviewOpen(open ? null : tile.id)}
                        data-testid={`landing-session-preview-${tile.id}`}
                      >
                        Preview
                        <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                      </Button>
                      <Button
                        className="min-h-11 flex-1 cursor-pointer"
                        onClick={() => startPoses(poses, tile.title, preflight.minutes)}
                        aria-label={`Start ${tile.title}, ${preflight.timeLabel}`}
                        data-testid={`landing-session-start-${tile.id}`}
                      >
                        <Play className="mr-1.5 h-4 w-4" aria-hidden /> Start
                      </Button>
                    </div>
                    {open && (
                      <ol
                        id={`landing-preview-${tile.id}`}
                        className="space-y-2 border-t border-border/60 pt-3"
                        data-testid={`landing-session-poses-${tile.id}`}
                      >
                        {poses.map((p, i) => (
                          <li key={`${p.slug}-${i}`} className="flex items-center gap-3 text-sm">
                            <PoseImage
                              slug={p.slug}
                              thumb
                              breath={false}
                              shadow={false}
                              rounded="rounded-lg"
                              aspect="aspect-square"
                              className="h-10 w-10 shrink-0"
                              sizes="40px"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{p.english}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {p.modifications}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatDuration(p.holdSeconds)}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Personalisation, shown with two real plans rather than described. */}
        <section id="personalisation" className="border-b border-border/40 bg-card/50">
          <div className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
            <Reveal className="mb-6 max-w-2xl space-y-2">
              <h2 className="font-serif text-3xl font-semibold tracking-tight">What your answers change</h2>
              <p className="text-muted-foreground">
                Same goal — feeling calmer — answered two ways. These are the plans the quiz builds
                today.
              </p>
            </Reveal>
            <div className="grid gap-3 md:grid-cols-2" data-testid="landing-personalisation">
              {personalisation.map(({ ex, plan, preflight }) => (
                <div
                  key={ex.id}
                  className="space-y-3 rounded-2xl border border-border/60 bg-background p-5"
                  data-testid={`landing-personalisation-${ex.id}`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{ex.who}</p>
                  <SessionSpec preflight={preflight} />
                  <ol className="list-decimal space-y-0.5 pl-5 text-sm">
                    {plan.poses.map((p, i) => (
                      <li key={`${p.slug}-${i}`}>
                        {asanaBySlug(p.slug)?.english}{" "}
                        <span className="text-muted-foreground">· {formatDuration(p.holdSeconds)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
            <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
              A shorter answer buys fewer poses, not rushed ones. "New to yoga" leaves advanced
              shapes out entirely.
            </p>
          </div>
        </section>

        {/* Who wrote it, what is free, and where to get help — one section. */}
        <section id="about" className="border-b border-border/40 bg-background">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 md:grid-cols-3 md:px-8 md:py-16">
            <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-5" data-testid="landing-content-review">
              <h2 className="font-serif text-xl font-semibold">Who wrote the content</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Pose steps, modifications and cautions are written and edited by the Sadhana catalog
                editors, last checked {CONTENT_REVIEW.reviewedAt}. They are educational, not medical
                advice, and have not had clinical clearance. {flaggedBenefitLines} benefit statements
                are marked on their pose pages as awaiting a check by a qualified reviewer.
              </p>
            </div>
            <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-5" data-testid="landing-free-list">
              <h2 className="font-serif text-xl font-semibold">Free today</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Everything described here is free: all {ASANAS.length} illustrated poses, guided
                sessions, programs, breathing, the quiz, your history and journal. A paid plan is
                planned but not on sale — there is a waitlist and nothing can be charged.
              </p>
              <Link href="/plus" className="inline-flex min-h-11 items-center text-sm text-primary hover:underline">
                About the planned plan
              </Link>
            </div>
            <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-5" data-testid="landing-help">
              <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
                <LifeBuoy className="h-5 w-5 text-primary" aria-hidden /> Help and issues
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Questions about your data or account: {SUPPORT_EMAIL}. Something wrong in a pose or a
                session? Report it publicly so it can be fixed.
              </p>
              <div className="flex flex-wrap gap-x-4">
                <Link href="/help" className="inline-flex min-h-11 items-center text-sm text-primary hover:underline" data-testid="landing-help-link">
                  Help centre
                </Link>
                <a
                  href={ISSUE_TRACKER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
                  data-testid="landing-report-issue"
                >
                  Report an issue
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="demo" className="border-b border-border/40 bg-card/50">
          <div className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
            <Reveal className="mb-6 max-w-2xl space-y-2">
              <h2 className="font-serif text-3xl font-semibold tracking-tight">A screen recording</h2>
              <p className="text-muted-foreground">
                The quiz, a guided practice and the pose library — captioned, sound off by default.
              </p>
            </Reveal>
            <Suspense
              fallback={<div className="aspect-video animate-pulse rounded-2xl bg-muted/40" aria-hidden />}
            >
              <ProductDemoVideo title="Screen recording of the Sadhana app" />
            </Suspense>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
          <h2 className="mb-6 font-serif text-3xl font-semibold tracking-tight">Questions</h2>
          <div className="divide-y divide-border/70">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-3 open:pb-4">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="border-t border-border/40 bg-primary px-4 py-16 text-primary-foreground md:px-8">
          <FadeIn className="mx-auto max-w-lg space-y-5 text-center">
            <h2 className="font-serif text-3xl font-semibold">Start with {samplePreflight.minutes} minutes</h2>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                className="min-h-14 cursor-pointer bg-primary-foreground px-8 text-base font-semibold text-foreground hover:bg-primary-foreground/92"
                onClick={startSample}
                data-testid="landing-cta-final"
              >
                <Play className="mr-1.5 h-4 w-4" aria-hidden /> {trySampleLabel}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-14 cursor-pointer border-primary-foreground/60 bg-transparent px-7 text-base font-semibold text-primary-foreground hover:bg-primary-foreground/10"
                asChild
                data-testid="landing-cta-final-secondary"
              >
                <Link href="/start">Find my practice</Link>
              </Button>
            </div>
          </FadeIn>
        </section>
      </main>

      <footer className="border-t border-border/50 py-10 pb-28 md:pb-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <p>Sadhana — a daily, dedicated practice. MIT open source.</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {[
              { href: "/help", label: "Help" },
              { href: "/account", label: "Account", enter: true },
              { href: "/", label: "App home", enter: true },
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
              { href: "/cancel", label: "Cancel" },
              { href: "/health-disclaimer", label: "Health disclaimer" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={l.enter ? enterApp : undefined}
                className="inline-flex min-h-11 items-center hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>

      <div className="landing-sticky-cta fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 p-3 backdrop-blur-md md:hidden">
        <Button
          size="lg"
          className="min-h-12 w-full cursor-pointer text-base font-semibold"
          onClick={startSample}
          data-testid="landing-cta-sticky"
        >
          <Play className="mr-1.5 h-4 w-4" aria-hidden /> {trySampleLabel}
        </Button>
      </div>
    </div>
  );
}

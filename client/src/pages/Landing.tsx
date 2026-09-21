/**
 * Quiz-first marketing landing — conversion clarity of modern wellness funnels,
 * with Sadhana’s sage/teal brand, privacy ethics, and a real practice payoff.
 */
import { Link, useLocation } from "wouter";
import { lazy, Suspense, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { LotusMark } from "@/components/Logo";
import { KEYS, writeString } from "@/lib/localPrefs";
import { FadeIn, Reveal } from "@/components/motion";
import {
  ArrowDown,
  ArrowRight,
  Captions,
  Check,
  Image as ImageIcon,
  Play,
  Shield,
  Sparkles,
  Timer,
  Volume2,
} from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { ASANAS, asanaBySlug } from "@/data/content";
import { QUICK_SESSIONS } from "@/data/quickSessions";
import { REPRESENTATIVE_SESSIONS, SAMPLE_PRACTICE } from "@/data/samplePractice";
import { buildSessionPreflight, type PreflightPose } from "@/lib/sessionPreflight";
import { usePractice } from "@/context/PracticeContext";

const ProductDemoVideo = lazy(() =>
  import("@/components/ProductDemoVideo").then((m) => ({ default: m.ProductDemoVideo })),
);

const HERO_SRC = `${import.meta.env.BASE_URL}poses/vrksasana.png`;

const PROGRAMS = [
  {
    title: "Morning wake-up",
    body: "Open the spine. Start clear.",
    img: `${import.meta.env.BASE_URL}poses/tadasana.png`,
    href: "/start?ref=program-morning",
    tone: "from-[hsl(165_35%_12%/0.75)]",
  },
  {
    title: "Desk reset",
    body: "Neck, shoulders, hips after sitting.",
    img: `${import.meta.env.BASE_URL}poses/balasana.png`,
    href: "/start?ref=program-desk",
    tone: "from-[hsl(175_30%_10%/0.78)]",
  },
  {
    title: "Better sleep",
    body: "Slow shapes and breath at night.",
    img: `${import.meta.env.BASE_URL}poses/supta-baddha-konasana.png`,
    href: "/start?ref=program-sleep",
    tone: "from-[hsl(200_28%_12%/0.78)]",
  },
  {
    title: "Beginner foundations",
    body: "Clear cues. No experience needed.",
    img: `${import.meta.env.BASE_URL}poses/adho-mukha-svanasana.png`,
    href: "/start?ref=program-beginner",
    tone: "from-[hsl(155_28%_12%/0.78)]",
  },
];

/**
 * Numbers, not adjectives — and each one checkable. The pose count is read from
 * the catalog rather than rounded up in copy, because "200+" was a claim
 * nothing verified.
 */
const PROOF = [
  { label: "Illustrated poses", value: String(ASANAS.length) },
  { label: "Filmed teachers", value: "None yet" },
  { label: "Account required", value: "Never" },
];

const FAQ = [
  {
    q: "What will I actually see and hear during a practice?",
    a: "An illustration of the pose you are in, a recorded voice talking you into it, the same words as captions on screen, and a countdown for the hold. There is no video of a teacher moving — see \u201cWhat a practice looks like\u201d above.",
  },
  {
    q: "Do I need any equipment?",
    a: "Most sessions need nothing. Some restorative ones ask for a chair, a bolster or a couple of pillows \u2014 every session lists what it needs on the screen before you start, and offers a prop-free alternative where one has been reviewed.",
  },
  {
    q: "Can I practise offline?",
    a: "Partly, and only after a first visit. The app shell and pose illustrations are cached by the browser, so a session you have opened before can usually be repeated without a connection. Narration audio is streamed and is not downloaded for offline use \u2014 without a connection you would practise with captions instead of voice.",
  },
  {
    q: "Where is my progress stored?",
    a: "On your device, under an id this browser holds, until you create an account. Clearing the browser's data erases it. An optional free account backs it up and syncs it between browsers; you can export or delete everything at any time.",
  },
  {
    q: "What if I have never done yoga?",
    a: "Say so in the quiz and the sequences stay on beginner shapes \u2014 advanced poses are filtered out rather than shortened. Every pose carries its own modifications and the things to avoid, and those are shown before you start, not mid-pose.",
  },
  {
    q: "How long is the quiz?",
    a: "About two minutes \u2014 five short questions, then a real guided session matched to your answers. You can also skip it and start the sample practice.",
  },
  {
    q: "Is Sadhana free, and what is not built yet?",
    a: "Everything described on this page is free and working today. Paid plans are on a waitlist and nothing can be charged. Filmed movement demonstrations, a virtual instructor beyond a five-pose pilot, and human teachers are not available \u2014 we say so in the app rather than in a roadmap.",
  },
  {
    q: "Do I need an account?",
    a: "No. Start as a guest. Accounts exist only to back up and sync your practice.",
  },
];

/** How the app teaches, stated plainly. Each line is checkable in the product. */
const FORMAT = [
  {
    icon: ImageIcon,
    title: "Watercolour illustrations",
    body: `Every one of the ${ASANAS.length} poses is drawn, with the body shape described in text for screen readers. Nothing is stock photography.`,
  },
  {
    icon: Volume2,
    title: "Recorded voice guidance",
    body: "A voice talks you into each pose before the hold begins. You can mute it, slow it down, or replay a cue.",
  },
  {
    icon: Timer,
    title: "Timed holds",
    body: "Each pose has a countdown, both sides where the pose has sides, and a chime between poses. You can add time or skip ahead.",
  },
  {
    icon: Captions,
    title: "Captions, always",
    body: "The spoken words appear on screen as they are said, so a muted practice teaches exactly the same thing.",
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

export default function Landing() {
  useDocumentTitle("Welcome · Sadhana");
  const [, navigate] = useLocation();
  const { loadSession } = usePractice();

  useEffect(() => {
    document.title = "Sadhana — Personalized yoga practice in minutes";
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
          return asana ? { asana, holdSeconds: p.holdSeconds } : null;
        })
        .filter(
          (x): x is { asana: NonNullable<ReturnType<typeof asanaBySlug>>; holdSeconds: number } =>
            x != null,
        ),
    [],
  );
  const samplePreflight = useMemo(
    () =>
      buildSessionPreflight({
        poses: samplePoses.map((p) => ({ ...p.asana, holdSeconds: p.holdSeconds })),
      }),
    [samplePoses],
  );

  /**
   * Start the sample without the quiz. "Get my plan" is the right first step
   * for someone who wants a plan; for someone deciding whether the teaching
   * suits them, a five-question form is a toll gate in front of the answer.
   */
  const startSample = () => {
    if (!samplePoses.length) return;
    enterApp();
    loadSession(samplePoses, {
      label: SAMPLE_PRACTICE.title,
      introPoseSlug: samplePoses[0]!.asana.slug,
      plannedMinutes: samplePreflight.minutes,
    });
    navigate("/guided");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#landing-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 pt-3 md:px-8">
          <Link
            href="/welcome"
            className="landing-nav-brand flex cursor-pointer items-center gap-2.5 text-primary-foreground"
            aria-label="Sadhana home"
          >
            <LotusMark size={28} />
            <span className="font-serif text-xl font-semibold tracking-tight drop-shadow-sm md:text-2xl">
              Sadhana
            </span>
          </Link>
          <Button
            className="min-h-11 cursor-pointer bg-primary-foreground text-foreground shadow-soft hover:bg-primary-foreground/92"
            asChild
            data-testid="landing-cta-header"
          >
            <Link href="/start">Get started</Link>
          </Button>
        </div>
      </header>

      <main id="landing-main">
        {/* Hero: one composition — brand, headline, support, CTA, full-bleed visual */}
        <section className="relative min-h-[100svh] overflow-hidden">
          <img
            src={HERO_SRC}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_26%] hero-photo-breath scale-[1.02]"
            width={1200}
            height={1600}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(165deg,hsl(165_32%_7%/0.55)_0%,hsl(165_28%_10%/0.18)_38%,hsl(160_30%_8%/0.88)_100%)]"
            aria-hidden
          />
          <div className="yoga-grain absolute inset-0 opacity-[0.07]" aria-hidden />

          <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-4 pb-32 pt-28 md:justify-center md:px-8 md:pb-28">
            <FadeIn className="max-w-xl space-y-6 text-primary-foreground">
              <p
                className="landing-brand-rise font-serif text-6xl font-semibold tracking-tight md:text-8xl"
                data-testid="landing-brand"
              >
                Sadhana
              </p>
              <h1 className="max-w-lg font-serif text-2xl font-semibold leading-[1.15] tracking-tight md:text-4xl">
                Yoga that meets you where you are — in minutes, not months.
              </h1>
              <p className="max-w-md text-base leading-relaxed text-primary-foreground/88 md:text-lg">
                A short quiz builds a gentle first session around how you feel today. No email wall.
                No streak shame.
              </p>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  className="landing-cta-glow min-h-14 cursor-pointer bg-primary-foreground px-9 text-base font-semibold text-foreground hover:bg-primary-foreground/92"
                  asChild
                  data-testid="landing-cta-primary"
                >
                  <Link href="/start">
                    Get my plan <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-14 cursor-pointer border-primary-foreground/50 bg-transparent px-7 text-base font-semibold text-primary-foreground hover:bg-primary-foreground/10"
                  onClick={startSample}
                  data-testid="landing-cta-sample"
                >
                  <Play className="mr-1.5 h-4 w-4" />
                  Try a {samplePreflight.timeLabel} practice
                </Button>
              </div>
              <p className="text-sm text-primary-foreground/75">
                The quiz takes about two minutes. The sample starts now, no questions, no account.
              </p>
            </FadeIn>

            <a
              href="#programs"
              className="landing-scroll-cue absolute bottom-8 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary-foreground/70 md:flex"
            >
              Explore paths
              <ArrowDown className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </section>

        <section className="relative border-b border-border/50 bg-card" data-testid="landing-proof">
          <div className="mx-auto grid max-w-6xl grid-cols-3 gap-2 px-4 py-9 text-center md:px-8">
            {PROOF.map((p) => (
              <div key={p.label} className="space-y-1">
                <p className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">{p.value}</p>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground md:text-xs">
                  {p.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* What the teaching actually is — before any path is chosen. */}
        <section id="format" className="border-b border-border/40 bg-background">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-20">
            <Reveal className="mb-8 max-w-2xl space-y-3">
              <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
                What a practice looks like
              </h2>
              <p className="text-base text-muted-foreground md:text-lg">
                Worth knowing before you start, because it is not what every yoga app means by
                "guided".
              </p>
            </Reveal>
            <div className="grid gap-3 sm:grid-cols-2">
              {FORMAT.map((f, i) => (
                <Reveal
                  key={f.title}
                  delay={i * 0.04}
                  className="flex gap-3 rounded-2xl border border-border/60 bg-card/70 p-4"
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
            {/*
              The thing a prospective practitioner most needs to know and is
              least likely to be told. Stated in the same type as everything
              else, not buried in a footnote.
            */}
            <Reveal
              delay={0.1}
              className="mt-6 rounded-2xl border border-border/60 bg-muted/40 p-4 text-sm leading-relaxed"
              data-testid="landing-no-filmed-instruction"
            >
              <strong className="font-semibold">There is no filmed instruction.</strong> Nobody
              demonstrates the movement on video. You get an accurate still of the pose you are in,
              labelled as a static reference, plus the voice and the captions. Filmed demonstrations
              are not shot yet, and the app says so wherever a still stands in for one.
            </Reveal>
          </div>
        </section>

        {/* Real sessions, with their real numbers. */}
        <section id="sessions" className="border-b border-border/40 bg-card/50">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-20">
            <Reveal className="mb-8 max-w-2xl space-y-3">
              <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
                Three sessions that exist right now
              </h2>
              <p className="text-base text-muted-foreground md:text-lg">
                Every figure below is computed from the session itself — the length counts the
                spoken instruction and the transitions, not just the holds.
              </p>
            </Reveal>
            <div className="grid gap-3 md:grid-cols-3">
              {sessions.map(({ tile, preflight }, i) => (
                <Reveal
                  key={tile.id}
                  delay={i * 0.05}
                  className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-background p-5"
                  data-testid={`landing-session-${tile.id}`}
                >
                  <h3 className="font-serif text-xl font-semibold tracking-tight">{tile.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {preflight.timeLabel} · {preflight.difficulty.level} ·{" "}
                    {preflight.intensity.level} · {preflight.poseCount} poses
                  </p>
                  <p className="text-sm leading-relaxed">{tile.blurb}</p>
                  <p className="text-xs text-muted-foreground">
                    {preflight.equipmentSentence
                      ? `Needs ${preflight.equipmentSentence}.`
                      : "No props needed."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {preflight.modeLabel} · illustrations and captions
                  </p>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.12} className="mt-6">
              <Button
                variant="outline"
                className="min-h-11 cursor-pointer"
                onClick={startSample}
                data-testid="landing-sessions-sample"
              >
                <Play className="mr-1.5 h-4 w-4" /> Start the {samplePreflight.timeLabel} sample
              </Button>
            </Reveal>
          </div>
        </section>

        <section id="programs" className="yoga-atmosphere relative">
          <div className="yoga-grain pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-20">
            <div className="mb-10 max-w-xl space-y-3 md:mb-14">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Paths
              </p>
              <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-5xl">
                Choose a mood — or let the quiz decide
              </h2>
              <p className="text-base text-muted-foreground md:text-lg">
                Every path opens a short quiz, then a session you can start today.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:gap-4">
              {PROGRAMS.map((p, i) => (
                <Reveal key={p.title} delay={i * 0.05}>
                  <Link
                    href={p.href}
                    onClick={enterApp}
                    className="group relative block min-h-[14rem] overflow-hidden rounded-[1.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-[16rem]"
                    data-testid={`program-card-${i}`}
                  >
                    <img width={600} height={1200}
                      src={p.img}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                      loading="lazy"
                      decoding="async"
                    />
                    <div
                      className={`absolute inset-0 bg-gradient-to-t ${p.tone} via-transparent to-transparent`}
                      aria-hidden
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-primary-foreground md:p-6">
                      <div className="space-y-1">
                        <h3 className="font-serif text-2xl font-semibold tracking-tight">{p.title}</h3>
                        <p className="max-w-xs text-sm text-primary-foreground/85">{p.body}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold">
                        Start
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="border-y border-border/40 bg-card/60">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-20">
            <h2 className="mb-12 font-serif text-3xl font-semibold tracking-tight md:text-4xl">
              Three steps. Real practice.
            </h2>
            <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
              {[
                {
                  n: "01",
                  t: "Answer five questions",
                  b: "Goal, body, experience, time, and what usually gets in the way.",
                },
                {
                  n: "02",
                  t: "See your session",
                  b: "Pose previews and a length matched to you — not a vague “plan PDF”.",
                },
                {
                  n: "03",
                  t: "Practice today",
                  b: "Guided holds with voice and safety notes. Miss a day? Soft reset.",
                },
              ].map((s, i) => (
                <Reveal key={s.n} delay={i * 0.06} className="space-y-3">
                  <span className="font-serif text-4xl text-primary/70 md:text-5xl">{s.n}</span>
                  <h3 className="font-serif text-xl font-semibold tracking-tight md:text-2xl">{s.t}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground md:text-base">{s.b}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section id="why" className="yoga-atmosphere relative">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
            <Reveal className="mb-10 max-w-xl space-y-2">
              <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
                Built to stay kind
              </h2>
              <p className="text-muted-foreground">
                No signup wall and no streak shame — a practice you can recommend.
              </p>
            </Reveal>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                "A personal session without a signup wall",
                "Illustrated poses with contraindications",
                "Compassionate recovery — no public body boards",
                "Cancel any upgrade in two taps",
              ].map((line, i) => (
                <Reveal
                  key={line}
                  delay={i * 0.04}
                  className="flex gap-3 border-b border-border/50 px-1 py-4 md:border-b-0 md:rounded-2xl md:border md:border-border/60 md:bg-card/70 md:px-4"
                >
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <p className="text-sm font-medium leading-relaxed md:text-base">{line}</p>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.12} className="mt-8 flex items-start gap-3 text-sm text-muted-foreground">
              <Shield className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                Privacy-first and open source — guest practice stays on this device until you choose
                an account.
              </p>
            </Reveal>
          </div>
        </section>

        <section id="demo" className="border-y border-border/40 bg-card/50">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
            <Reveal className="mb-8 max-w-2xl space-y-2">
              <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
                A recording of the app itself
              </h2>
              <p className="text-muted-foreground">
                A screen recording of the quiz, a guided practice and the pose library — the real
                interface, captioned, with sound off by default. It is not a class, and there are no
                people in it.
              </p>
            </Reveal>
            <Reveal delay={0.06}>
              <Suspense
                fallback={<div className="aspect-video animate-pulse rounded-2xl bg-muted/40" aria-hidden />}
              >
                <ProductDemoVideo title="Screen recording of the Sadhana app" />
              </Suspense>
            </Reveal>
          </div>
        </section>

        <section id="whats-free" className="border-y border-border/40 bg-background">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
            <Reveal className="mb-8 max-w-2xl space-y-3">
              <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
                What's free, and what isn't built
              </h2>
              <p className="text-base text-muted-foreground md:text-lg">
                Split out rather than implied, so nothing on this page reads as a promise.
              </p>
            </Reveal>
            <div className="grid gap-4 md:grid-cols-2">
              <div
                className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-5"
                data-testid="landing-free-list"
              >
                <h3 className="font-medium">Free and working today</h3>
                <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                  {[
                    `All ${ASANAS.length} illustrated poses, with modifications and what to avoid`,
                    "Guided sessions with recorded voice, captions and timed holds",
                    "The quiz, mood sessions, programs, breathing and the sequence builder",
                    "Practice history, journal and export — as a guest or with an account",
                  ].map((line) => (
                    <li key={line} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div
                className="space-y-3 rounded-2xl border border-border/60 bg-muted/40 p-5"
                data-testid="landing-not-built-list"
              >
                <h3 className="font-medium">Not available yet</h3>
                <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                  {[
                    "Filmed movement demonstrations — the app shows a labelled still instead",
                    "The virtual instructor beyond a five-pose pilot",
                    "Human teachers — there is a waitlist, and no teacher is bookable",
                    "Paid plans — priced on the Plus page, but on a waitlist and not chargeable",
                    "Fully offline practice — narration needs a connection",
                  ].map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-6xl px-4 py-16 md:px-8">
          <h2 className="mb-8 font-serif text-3xl font-semibold tracking-tight md:text-4xl">FAQ</h2>
          <div className="divide-y divide-border/70">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-4 open:pb-5">
                <summary className="cursor-pointer list-none font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  {item.q}
                </summary>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-border/40 bg-primary px-4 py-20 text-primary-foreground md:px-8">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_120%,hsl(0_0%_100%/0.12),transparent_55%)]"
            aria-hidden
          />
          <FadeIn className="relative mx-auto max-w-lg space-y-5 text-center">
            <p className="font-serif text-5xl font-semibold tracking-tight md:text-6xl">Sadhana</p>
            <h2 className="font-serif text-2xl font-semibold md:text-3xl">
              Your first session is one quiz away
            </h2>
            <Button
              size="lg"
              className="min-h-14 bg-primary-foreground px-9 text-base font-semibold text-foreground hover:bg-primary-foreground/92"
              asChild
              data-testid="landing-cta-final"
            >
              <Link href="/start">
                Get my plan <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </FadeIn>
        </section>
      </main>

      <footer className="border-t border-border/50 py-10 pb-28 md:pb-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <p>Sadhana — a daily, dedicated practice. MIT open source.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/start" className="hover:text-foreground">
              Get started
            </Link>
            <Link href="/account" className="hover:text-foreground" onClick={enterApp}>
              Account
            </Link>
            <Link href="/" className="hover:text-foreground" onClick={enterApp}>
              App home
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/cancel" className="cursor-pointer transition-colors duration-200 hover:text-foreground">
              Cancel
            </Link>
            <Link href="/health-disclaimer" className="cursor-pointer transition-colors duration-200 hover:text-foreground">
              Health disclaimer
            </Link>
          </div>
        </div>
      </footer>

      <div className="landing-sticky-cta fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/92 p-3 backdrop-blur-md md:hidden">
        <Button
          size="lg"
          className="min-h-12 w-full text-base font-semibold"
          asChild
          data-testid="landing-cta-sticky"
        >
          <Link href="/start">Get my plan</Link>
        </Button>
      </div>
    </div>
  );
}

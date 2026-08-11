/**
 * Quiz-first marketing landing — conversion clarity of modern wellness funnels,
 * with Sadhana’s sage/teal brand, privacy ethics, and a real practice payoff.
 */
import { Link } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LotusMark } from "@/components/Logo";
import { KEYS, writeString } from "@/lib/localPrefs";
import { FadeIn, Reveal } from "@/components/motion";
import { ArrowDown, ArrowRight, Check, Shield, Sparkles } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

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

const PROOF = [
  { label: "Illustrated poses", value: "200+" },
  { label: "Account required", value: "Never" },
  { label: "Streak shame", value: "Zero" },
];

const FAQ = [
  {
    q: "How is Sadhana different from other wellness apps?",
    a: "You still get a quiz-first personal plan — but practice starts free, without signup walls, fake reviews, or streak guilt. Privacy-first and open source.",
  },
  {
    q: "Do I need an account?",
    a: "No. Start as a guest. Optional accounts are only for sync across devices, with email verification when you choose one.",
  },
  {
    q: "How long is the quiz?",
    a: "About two minutes — five short questions, then a real guided session matched to your answers.",
  },
  {
    q: "Is Sadhana free?",
    a: "Core practice and the safety library stay free. Optional Plus/Coach is clearly priced with cancel in two taps.",
  },
];

export default function Landing() {
  useDocumentTitle("Welcome · Sadhana");

  useEffect(() => {
    document.title = "Sadhana — Personalized yoga practice in minutes";
  }, []);

  const enterApp = () => writeString(KEYS.welcomeSeen, "1");

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
                <p className="text-sm text-primary-foreground/75 sm:pl-1">~2 min · Free to start</p>
              </div>
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
                Every path opens the same kind funnel: five questions, then a session you can start
                today.
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
                    <img
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
                Conversion without dark patterns — the product you can recommend.
              </p>
            </Reveal>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                "Personal session without a signup wall",
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
            <Reveal className="mb-8 max-w-xl space-y-2">
              <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
                See a real session
              </h2>
              <p className="text-muted-foreground">
                Quiz → guided practice → pose library — no stock montage.
              </p>
            </Reveal>
            <Reveal delay={0.06}>
              <Suspense
                fallback={<div className="aspect-video animate-pulse rounded-2xl bg-muted/40" aria-hidden />}
              >
                <ProductDemoVideo title="A real walkthrough of the Sadhana app" />
              </Suspense>
            </Reveal>
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

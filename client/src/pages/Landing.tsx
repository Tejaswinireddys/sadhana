/**
 * BetterMe-inspired marketing landing: quiz-first CTA, program tiles, social proof,
 * sticky mobile Get started. Keeps Sadhana brand (Lora/Raleway, sage/teal) and ethics.
 */
import { Link } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LotusMark } from "@/components/Logo";
import { KEYS, writeString } from "@/lib/localPrefs";
import { FadeIn, Reveal } from "@/components/motion";
import { ArrowRight, Check, Shield } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const ProductDemoVideo = lazy(() =>
  import("@/components/ProductDemoVideo").then((m) => ({ default: m.ProductDemoVideo })),
);

const HERO_SRC = `${import.meta.env.BASE_URL}poses/vrksasana.png`;

const PROGRAMS = [
  {
    title: "Morning wake-up",
    body: "Low-impact flow to open the spine and start clear.",
    img: `${import.meta.env.BASE_URL}poses/tadasana.png`,
    href: "/start?ref=program-morning",
  },
  {
    title: "Desk reset",
    body: "Neck, shoulders, and hips after sitting too long.",
    img: `${import.meta.env.BASE_URL}poses/balasana.png`,
    href: "/start?ref=program-desk",
  },
  {
    title: "Better sleep",
    body: "Slow shapes and breath to wind down at night.",
    img: `${import.meta.env.BASE_URL}poses/supta-baddha-konasana.png`,
    href: "/start?ref=program-sleep",
  },
  {
    title: "Beginner foundations",
    body: "Simple poses with clear cues — no experience needed.",
    img: `${import.meta.env.BASE_URL}poses/adho-mukha-svanasana.png`,
    href: "/start?ref=program-beginner",
  },
];

const PROOF = [
  { label: "Pose library", value: "200+" },
  { label: "Account needed", value: "Never" },
  { label: "Streak shame", value: "Zero" },
];

const FAQ = [
  {
    q: "Is this like BetterMe?",
    a: "You get a quiz-first path to a personal plan — but Sadhana stays privacy-first, open source, and free to practice without a hard paywall trap.",
  },
  {
    q: "Do I need an account?",
    a: "No. Start as a guest. Optional accounts are only for sync across devices.",
  },
  {
    q: "How long is the quiz?",
    a: "About two minutes — five short questions, then your plan and a first session.",
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
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 pt-3 md:px-6">
          <Link
            href="/welcome"
            className="flex cursor-pointer items-center gap-2 text-primary-foreground drop-shadow-sm"
            aria-label="Sadhana home"
          >
            <LotusMark size={26} />
            <span className="font-serif text-xl font-semibold tracking-tight">Sadhana</span>
          </Link>
          <Button
            className="min-h-11 cursor-pointer bg-primary-foreground text-foreground hover:bg-primary-foreground/90"
            asChild
            data-testid="landing-cta-header"
          >
            <Link href="/start">Get started</Link>
          </Button>
        </div>
      </header>

      <main id="landing-main">
        {/* Hero: brand-first, one CTA — BetterMe conversion shape, Sadhana voice */}
        <section className="relative min-h-[100svh] overflow-hidden">
          <img
            src={HERO_SRC}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_28%] hero-photo-breath"
            width={1200}
            height={1600}
            decoding="async"
            fetchPriority="high"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(180deg,hsl(165_28%_8%/0.5)_0%,hsl(165_28%_8%/0.22)_40%,hsl(165_28%_8%/0.82)_100%)]"
            aria-hidden
          />

          <div className="relative mx-auto flex min-h-[100svh] max-w-5xl flex-col justify-end px-4 pb-28 pt-28 md:justify-center md:px-6 md:pb-24">
            <FadeIn className="max-w-xl space-y-5 text-primary-foreground">
              <p
                className="font-serif text-5xl font-semibold tracking-tight md:text-7xl"
                data-testid="landing-brand"
              >
                Sadhana
              </p>
              <h1 className="max-w-md font-serif text-2xl font-semibold leading-tight tracking-tight md:text-4xl">
                Fun and simple yoga — personalized to how you feel today.
              </h1>
              <p className="max-w-md text-base leading-relaxed text-primary-foreground/85 md:text-lg">
                Answer a few quick questions. Get a gentle plan. Practice in minutes — no email wall,
                no streak shame.
              </p>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  className="min-h-14 cursor-pointer bg-primary-foreground px-8 text-base font-semibold text-foreground hover:bg-primary-foreground/90"
                  asChild
                  data-testid="landing-cta-primary"
                >
                  <Link href="/start">
                    Get started <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <p className="text-xs text-primary-foreground/70">Takes about 2 minutes · Free to start</p>
            </FadeIn>
          </div>
        </section>

        {/* Social-proof strip — honest metrics, not fake reviews */}
        <section className="border-b border-border/60 bg-card" data-testid="landing-proof">
          <div className="mx-auto grid max-w-5xl grid-cols-3 gap-2 px-4 py-8 text-center md:px-6">
            {PROOF.map((p) => (
              <div key={p.label} className="space-y-1">
                <p className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">{p.value}</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:text-xs">
                  {p.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Program tiles — BetterMe “Wall Pilates / Calisthenics” pattern */}
        <section id="programs" className="yoga-atmosphere">
          <div className="relative mx-auto max-w-5xl px-4 py-16 md:px-6 md:py-20">
            <Reveal className="mb-10 max-w-xl space-y-2">
              <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
                Pick a path — or let the quiz choose
              </h2>
              <p className="text-muted-foreground">
                Theme-based on-ramps inspired by modern wellness funnels. Every path stays kind.
              </p>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2">
              {PROGRAMS.map((p, i) => (
                <Reveal key={p.title} delay={i * 0.04}>
                  <Link
                    href={p.href}
                    onClick={enterApp}
                    className="group relative block overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-soft"
                    data-testid={`program-card-${i}`}
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                      <img
                        src={p.img}
                        alt=""
                        className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                        loading="lazy"
                        decoding="async"
                      />
                      <div
                        className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/15 to-transparent"
                        aria-hidden
                      />
                      <div className="absolute inset-x-0 bottom-0 space-y-1 p-5 text-primary-foreground">
                        <h3 className="font-serif text-xl font-semibold">{p.title}</h3>
                        <p className="text-sm text-primary-foreground/85">{p.body}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3 text-sm font-semibold text-primary">
                      Get started
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="border-y border-border/50 bg-card/50">
          <div className="mx-auto max-w-5xl px-4 py-16 md:px-6">
            <h2 className="mb-10 font-serif text-3xl font-semibold tracking-tight">How it works</h2>
            <ol className="grid gap-8 md:grid-cols-3">
              {[
                { n: "1", t: "Take the quiz", b: "Five quick questions about goal, body, time, and habits." },
                { n: "2", t: "See your plan", b: "A personal session length and focus — no generic one-size list." },
                { n: "3", t: "Practice today", b: "Guided poses with voice and safety notes. Miss a day? Soft reset." },
              ].map((s, i) => (
                <Reveal key={s.n} delay={i * 0.05} className="space-y-2">
                  <span className="font-serif text-4xl text-primary/80">{s.n}</span>
                  <h3 className="font-serif text-xl font-semibold">{s.t}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.b}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section id="why" className="yoga-atmosphere">
          <div className="mx-auto max-w-5xl px-4 py-16 md:px-6">
            <Reveal className="mb-8 max-w-xl space-y-2">
              <h2 className="font-serif text-3xl font-semibold tracking-tight">Why people stay</h2>
            </Reveal>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                "Quiz-personal plan without a signup wall",
                "Illustrated poses with contraindications",
                "Compassionate recovery — no public body boards",
                "Cancel subscription in two taps if you ever upgrade",
              ].map((line, i) => (
                <Reveal key={line} delay={i * 0.04} className="flex gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-4">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <p className="text-sm font-medium leading-relaxed">{line}</p>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.1} className="mt-8 flex items-start gap-3 text-sm text-muted-foreground">
              <Shield className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                Privacy-first and open source — guest practice stays on this device until you choose an
                account.
              </p>
            </Reveal>
          </div>
        </section>

        <section id="demo" className="border-y border-border/50 bg-card/40">
          <div className="mx-auto max-w-5xl px-4 py-16 md:px-6">
            <Reveal className="mb-8 max-w-xl space-y-2">
              <h2 className="font-serif text-3xl font-semibold tracking-tight">See a real session</h2>
              <p className="text-muted-foreground">
                A short walkthrough of quiz → guided practice → pose library.
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

        <section id="faq" className="mx-auto max-w-5xl px-4 py-16 md:px-6">
          <h2 className="mb-8 font-serif text-3xl font-semibold tracking-tight">FAQ</h2>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-b border-border/70 py-3 open:pb-4">
                <summary className="cursor-pointer list-none font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  {item.q}
                </summary>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="border-t border-border/50 bg-primary px-4 py-16 text-primary-foreground md:px-6">
          <FadeIn className="mx-auto max-w-lg space-y-4 text-center">
            <p className="font-serif text-4xl font-semibold tracking-tight md:text-5xl">Sadhana</p>
            <h2 className="font-serif text-2xl font-semibold md:text-3xl">Your plan is one quiz away</h2>
            <Button
              size="lg"
              className="min-h-14 bg-primary-foreground px-8 text-base font-semibold text-foreground hover:bg-primary-foreground/90"
              asChild
              data-testid="landing-cta-final"
            >
              <Link href="/start">
                Get started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </FadeIn>
        </section>
      </main>

      <footer className="border-t border-border/60 py-10 pb-28 md:pb-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
          <p>Sadhana — a daily, dedicated practice. MIT open source.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/start" className="hover:text-foreground">
              Get started
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
            <Link href="/health-disclaimer" className="hover:text-foreground">
              Health
            </Link>
          </div>
        </div>
      </footer>

      {/* Sticky mobile CTA — BetterMe-style conversion chrome */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 p-3 backdrop-blur md:hidden">
        <Button size="lg" className="min-h-12 w-full text-base font-semibold" asChild data-testid="landing-cta-sticky">
          <Link href="/start">Get started</Link>
        </Button>
      </div>
    </div>
  );
}

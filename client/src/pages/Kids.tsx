import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ParentGate } from "@/components/ParentGate";
import { StickerDisplay } from "@/components/StickerDisplay";
import { useKidsGate } from "@/context/KidsGateContext";
import { KIDS_POSES, KIDS_BREATH } from "@/data/kids";
import { Play, Sparkles, Wind } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function Kids() {
  useDocumentTitle("Kids · Sadhana");
  const { unlocked, lock } = useKidsGate();

  return (
    <>
      <ParentGate />
      {/* Only render the playful content once the gate is unlocked */}
      {unlocked && (
        <div className="kids-zone animate-fade-in space-y-8 rounded-2xl border border-border/40 bg-card/30 p-5 shadow-soft sm:p-8" data-testid="kids-home">
          {/* Hero */}
          <div className="grid items-center gap-6 md:grid-cols-[1.1fr_1fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="kids-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
                  <Sparkles className="h-3.5 w-3.5" /> Kids Yoga
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full text-xs"
                  onClick={lock}
                  data-testid="button-lock-kids"
                >
                  Parent lock
                </Button>
              </div>
              <h1 className="kids-title text-4xl font-bold leading-tight sm:text-5xl" data-testid="text-kids-title">
                Let's go on a yoga adventure!
              </h1>
              <p className="text-lg text-foreground/80">
                Become a tall tree, a friendly dragon, a pink flamingo, and more. Each story has a calm voice
                to guide you. Ready to play?
              </p>
              <Button
                size="lg"
                className="kids-cta min-h-12 rounded-full text-base"
                asChild
                data-testid="button-start-adventure"
              >
                <Link href="/kids/tree">
                  <Play className="mr-2 h-5 w-5" /> Start a yoga adventure!
                </Link>
              </Button>
            </div>
            <img
              src={`${import.meta.env.BASE_URL}kids/_hero.png`}
              alt="A cheerful child practicing yoga"
              className="kids-bob mx-auto w-full max-w-sm rounded-2xl object-contain"
              draggable={false}
              data-testid="img-kids-hero"
            />
          </div>

          {/* Sticker collection */}
          <StickerDisplay />

          {/* Story poses */}
          <div className="space-y-4">
            <h2 className="kids-title text-2xl font-bold">Yoga stories</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {KIDS_POSES.map((p) => (
                <Card
                  key={p.slug}
                  className="kids-card cursor-pointer overflow-hidden border-border/70 bg-card/90 transition-transform duration-200 hover:-translate-y-1 focus-within:ring-2 focus-within:ring-ring"
                  data-testid={`card-kids-${p.slug}`}
                >
                  <div className="flex items-center justify-center bg-accent/50 p-4">
                    <img
                      src={`${import.meta.env.BASE_URL}kids/${p.image}.png`}
                      alt={p.poseName}
                      className="h-40 w-40 object-contain"
                      draggable={false}
                      loading="lazy"
                    />
                  </div>
                  <CardContent className="space-y-2 p-4 text-center">
                    <h3 className="kids-title text-xl font-bold leading-tight">{p.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{p.intro}</p>
                    <Button
                      className="kids-cta min-h-[44px] w-full cursor-pointer rounded-full transition-colors duration-200"
                      asChild
                      data-testid={`button-play-${p.slug}`}
                    >
                      <Link href={`/kids/${p.slug}`}>
                        <Play className="mr-1.5 h-4 w-4" /> Play story
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Breathing games */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="kids-title flex items-center gap-2 text-2xl font-bold">
                <Wind className="h-6 w-6 text-secondary" /> Breathing games
              </h2>
              <p className="text-sm text-muted-foreground">Fun ways to take a big, calm breath.</p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {KIDS_BREATH.map((b) => (
                <Card
                  key={b.slug}
                  className="kids-card overflow-hidden border-border/70 bg-card/90 transition-transform hover:-translate-y-1"
                  data-testid={`card-kids-breath-${b.slug}`}
                >
                  <div className="flex items-center justify-center bg-secondary/15 p-4">
                    <img
                      src={`${import.meta.env.BASE_URL}kids/${b.image}.png`}
                      alt={b.techniqueName}
                      className="h-32 w-32 object-contain"
                      draggable={false}
                    />
                  </div>
                  <CardContent className="space-y-2 p-4 text-center">
                    <h3 className="kids-title text-lg font-bold leading-tight">{b.techniqueName}</h3>
                    <p className="text-sm text-muted-foreground">{b.description}</p>
                    <Button
                      className="min-h-11 w-full cursor-pointer rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
                      asChild
                      data-testid={`button-play-breath-${b.slug}`}
                    >
                      <Link href={`/kids/breath/${b.slug}`}>
                        <Wind className="mr-1.5 h-4 w-4" /> Let's breathe
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

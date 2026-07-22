import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ParentGate } from "@/components/ParentGate";
import { StickerDisplay } from "@/components/StickerDisplay";
import { useKidsGate } from "@/context/KidsGateContext";
import { KIDS_POSES, KIDS_BREATH } from "@/data/kids";
import { Play, Sparkles, Wind } from "lucide-react";

export default function Kids() {
  const { unlocked, lock } = useKidsGate();

  return (
    <>
      <ParentGate />
      {/* Only render the playful content once the gate is unlocked */}
      {unlocked && (
        <div className="kids-zone animate-fade-in space-y-8 p-5 sm:p-8" data-testid="kids-home">
          {/* Hero */}
          <div className="grid items-center gap-6 md:grid-cols-[1.1fr_1fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(16_72%_58%)] px-3 py-1 text-xs font-semibold text-white">
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
                className="rounded-full bg-[hsl(16_72%_55%)] text-base hover:bg-[hsl(16_72%_48%)]"
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
                  className="kids-card overflow-hidden border-[hsl(38_60%_70%/0.6)] bg-white/70 shadow-soft transition-transform hover:-translate-y-1 dark:bg-white/5"
                  data-testid={`card-kids-${p.slug}`}
                >
                  <div className="flex items-center justify-center bg-[hsl(41_80%_88%)] p-4 dark:bg-white/5">
                    <img
                      src={`${import.meta.env.BASE_URL}kids/${p.image}.png`}
                      alt={p.poseName}
                      className="h-40 w-40 object-contain"
                      draggable={false}
                    />
                  </div>
                  <CardContent className="space-y-2 p-4 text-center">
                    <h3 className="kids-title text-xl font-bold leading-tight">{p.title}</h3>
                    <p className="text-sm text-foreground/70">{p.intro}</p>
                    <Button
                      className="w-full rounded-full bg-[hsl(92_35%_45%)] hover:bg-[hsl(92_35%_38%)]"
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
                <Wind className="h-6 w-6 text-[hsl(200_55%_50%)]" /> Breathing games
              </h2>
              <p className="text-sm text-foreground/70">Fun ways to take a big, calm breath.</p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {KIDS_BREATH.map((b) => (
                <Card
                  key={b.slug}
                  className="kids-card overflow-hidden border-[hsl(38_60%_70%/0.6)] bg-white/70 shadow-soft transition-transform hover:-translate-y-1 dark:bg-white/5"
                  data-testid={`card-kids-breath-${b.slug}`}
                >
                  <div className="flex items-center justify-center bg-[hsl(200_55%_90%)] p-4 dark:bg-white/5">
                    <img
                      src={`${import.meta.env.BASE_URL}kids/${b.image}.png`}
                      alt={b.techniqueName}
                      className="h-32 w-32 object-contain"
                      draggable={false}
                    />
                  </div>
                  <CardContent className="space-y-2 p-4 text-center">
                    <h3 className="kids-title text-lg font-bold leading-tight">{b.techniqueName}</h3>
                    <p className="text-sm text-foreground/70">{b.description}</p>
                    <Button
                      className="w-full rounded-full bg-[hsl(200_55%_45%)] hover:bg-[hsl(200_55%_38%)]"
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

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FadeIn, Pressable, Reveal, motionTokens } from "@/components/motion";
import { ProductDemoVideo } from "@/components/ProductDemoVideo";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { lazy, Suspense } from "react";

const HeroBreathScene = lazy(() => import("@/components/HeroBreathScene"));

export default function DesignSystem() {
  useDocumentTitle("Design system · Sadhana");

  return (
    <FadeIn className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Internal</p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Design system</h1>
        <p className="max-w-2xl text-muted-foreground">
          Live preview of Sadhana tokens, surfaces, controls, motion, and empty states. Prefer these
          primitives when building new UI.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Color & surfaces</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Primary", "bg-primary text-primary-foreground"],
            ["Secondary", "bg-secondary text-secondary-foreground"],
            ["Accent", "bg-accent text-accent-foreground"],
            ["Muted", "bg-muted text-muted-foreground"],
          ].map(([label, cls]) => (
            <div key={label} className={`rounded-2xl p-4 shadow-soft ${cls}`}>
              <p className="text-sm font-medium">{label}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="surface p-5">
            <p className="font-medium">surface</p>
            <p className="text-sm text-muted-foreground">Default raised card</p>
          </div>
          <div className="surface-banner p-5">
            <p className="font-medium">surface-banner</p>
            <p className="text-sm text-muted-foreground">Primary callout</p>
          </div>
          <div className="surface-inset p-5">
            <p className="font-medium">surface-inset</p>
            <p className="text-sm text-muted-foreground">Filters / nested panels</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Typography</h2>
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="font-serif text-3xl font-semibold tracking-tight">Fraunces display</p>
            <p className="text-base">Figtree body — readable UI copy at 16px+.</p>
            <p className="text-sm text-muted-foreground">Muted supporting text for captions and hints.</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Controls</h2>
        <div className="flex flex-wrap gap-3">
          <Button className="min-h-11 cursor-pointer">Primary</Button>
          <Button variant="secondary" className="min-h-11 cursor-pointer">
            Secondary
          </Button>
          <Button variant="outline" className="min-h-11 cursor-pointer">
            Outline
          </Button>
          <Button variant="ghost" className="min-h-11 cursor-pointer">
            Ghost
          </Button>
          <Badge>Badge</Badge>
          <Badge variant="secondary">Secondary badge</Badge>
        </div>
        <div className="grid max-w-md gap-2">
          <Label htmlFor="ds-input">Input</Label>
          <Input id="ds-input" placeholder="Search poses…" className="min-h-11" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Alerts & loading</h2>
        <div className="grid gap-3">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Info</AlertTitle>
            <AlertDescription>Neutral guidance for the next step.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Something failed — offer retry nearby.</AlertDescription>
          </Alert>
          <div className="flex items-center gap-2 rounded-2xl border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-secondary" />
            Success confirmation pattern
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Empty states</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <EmptyState
            variant="favorites"
            title="No favorites yet"
            description="Heart a pose in the library to build a personal shortlist."
          >
            <Button asChild variant="outline" className="min-h-11 cursor-pointer">
              <Link href="/asanas">Browse poses</Link>
            </Button>
          </EmptyState>
          <EmptyState
            variant="profile"
            title="No path selected"
            description="Activate a profile to tailor Home and today’s session."
          >
            <Button asChild className="min-h-11 cursor-pointer">
              <Link href="/profiles">Choose a path</Link>
            </Button>
          </EmptyState>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Motion</h2>
        <p className="text-sm text-muted-foreground">
          Tokens: fast {motionTokens.duration.fast}s · base {motionTokens.duration.base}s · slow{" "}
          {motionTokens.duration.slow}s. Disabled when reduced-motion or Motion toggle is off.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Reveal className="surface p-5">
            <p className="font-medium">Reveal</p>
            <p className="text-sm text-muted-foreground">Animates once when scrolled into view.</p>
          </Reveal>
          <Pressable className="surface p-5">
            <p className="font-medium">Pressable</p>
            <p className="text-sm text-muted-foreground">Hover lift + press scale feedback.</p>
          </Pressable>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Hero breath scene (CSS/SVG 3D)</h2>
        <p className="text-sm text-muted-foreground">
          Decorative landing hero — pauses offscreen, falls back to a static pose on mobile and reduced-motion.
          See docs/hero-3d.md.
        </p>
        <Suspense fallback={<Skeleton className="aspect-[3/4] w-full max-w-sm rounded-2xl" />}>
          <div className="max-w-sm">
            <HeroBreathScene />
          </div>
        </Suspense>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Product demo video</h2>
        <ProductDemoVideo title="Sadhana product overview" />
      </section>

      <CardHeader className="px-0">
        <CardTitle className="font-serif text-lg">Related</CardTitle>
      </CardHeader>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline" className="min-h-11 cursor-pointer">
          <Link href="/welcome">Landing</Link>
          {" · "}
          <Link href="/register">Register</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 cursor-pointer">
          <Link href="/settings">Settings</Link>
        </Button>
      </div>
    </FadeIn>
  );
}

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FadeIn, Pressable, Reveal, motionTokens } from "@/components/motion";
import { ProductDemoVideo } from "@/components/ProductDemoVideo";
import { BottomNav } from "@/components/ds/BottomNav";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/ds/Modal";
import { Tag } from "@/components/ds/Tag";
import {
  Tabs as ThemeTabs,
  TabsContent as ThemeTabsContent,
  TabsList as ThemeTabsList,
  TabsTrigger as ThemeTabsTrigger,
} from "@/components/ds/Tabs";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { AlertCircle, CheckCircle2, Home, Info, LayoutGrid, NotebookPen, Timer, UserRound } from "lucide-react";
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
            <p className="font-serif text-3xl font-semibold tracking-tight">Lora display</p>
            <p className="text-base">Raleway body — readable UI copy at 16px+.</p>
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

      <section className="space-y-4" data-testid="theme-primitives">
        <h2 className="font-serif text-xl">Theme primitives</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Button, Card, Tag, Tabs, Modal, and BottomNav read the scale in theme.css.
          Product screens keep their current layout.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Tag data-testid="theme-tag-neutral">Restorative</Tag>
          <Tag tone="sage">Sage</Tag>
          <Tag tone="leaf">Leaf</Tag>
          <Tag tone="outline">Outline</Tag>
        </div>
        <ThemeTabs defaultValue="arrive">
          <ThemeTabsList data-testid="theme-tabs">
            <ThemeTabsTrigger value="arrive" className="min-h-11">
              Arrive
            </ThemeTabsTrigger>
            <ThemeTabsTrigger value="hold" className="min-h-11">
              Hold
            </ThemeTabsTrigger>
            <ThemeTabsTrigger value="close" className="min-h-11">
              Close
            </ThemeTabsTrigger>
          </ThemeTabsList>
          <ThemeTabsContent value="arrive">Settle the breath before the first shape.</ThemeTabsContent>
          <ThemeTabsContent value="hold">Stay with the pose for the counted hold.</ThemeTabsContent>
          <ThemeTabsContent value="close">Finish lying down, then sit up slowly.</ThemeTabsContent>
        </ThemeTabs>
        <Modal>
          <ModalTrigger asChild>
            <Button variant="outline" className="min-h-11 cursor-pointer" data-testid="theme-modal-open">
              Open modal
            </Button>
          </ModalTrigger>
          <ModalContent data-testid="theme-modal">
            <ModalHeader>
              <ModalTitle>A quiet check-in</ModalTitle>
              <ModalDescription>
                The panel uses the sand surface, the sage focus ring, and the raised shadow.
              </ModalDescription>
            </ModalHeader>
          </ModalContent>
        </Modal>
        <BottomNav
          inline
          label="Theme preview"
          testId="theme-bottom-nav"
          items={[
            { href: "/", label: "Today", icon: Home, active: true, testId: "theme-nav-today" },
            { href: "/guided", label: "Practice", icon: Timer, testId: "theme-nav-practice" },
            { href: "/asanas", label: "Poses", icon: LayoutGrid, testId: "theme-nav-poses" },
            { href: "/journal", label: "Progress", icon: NotebookPen, testId: "theme-nav-progress" },
            { href: "/settings", label: "You", icon: UserRound, testId: "theme-nav-you" },
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Tabs</h2>
        <Tabs defaultValue="form">
          <TabsList className="flex h-auto w-full flex-wrap gap-1" data-testid="ds-tabs">
            <TabsTrigger value="form" className="min-h-11 flex-1" data-testid="ds-tab-form">
              Form
            </TabsTrigger>
            <TabsTrigger value="breath" className="min-h-11 flex-1" data-testid="ds-tab-breath">
              Breath
            </TabsTrigger>
            <TabsTrigger value="align" className="min-h-11 flex-1" data-testid="ds-tab-align">
              Align
            </TabsTrigger>
          </TabsList>
          <TabsContent value="form" className="mt-3 text-sm text-muted-foreground">
            Same Radix tabs pattern used on Asana Detail and Affirmations.
          </TabsContent>
          <TabsContent value="breath" className="mt-3 text-sm text-muted-foreground">
            Pair each trigger with a matching TabsContent value.
          </TabsContent>
          <TabsContent value="align" className="mt-3 text-sm text-muted-foreground">
            Keep triggers min-h-11 for touch targets.
          </TabsContent>
        </Tabs>
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
          Decorative landing hero — pose photo stays visible with soft depth when motion is on.
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
        </Button>
        <Button asChild variant="outline" className="min-h-11 cursor-pointer">
          <Link href="/register">Register</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 cursor-pointer">
          <Link href="/settings">Settings</Link>
        </Button>
      </div>
    </FadeIn>
  );
}

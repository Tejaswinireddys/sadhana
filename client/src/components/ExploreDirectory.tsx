/**
 * The full directory of destinations.
 *
 * This used to sit at the bottom of Today, under the heading "More from
 * Practice, Progress, and You" — twenty equally-weighted links below a page
 * that was already a list of things to choose between. Comprehensive discovery
 * belongs on Practice, which is a catalogue on purpose; Today is meant to end
 * in a decision.
 */
import { Link } from "wouter";
import { ASANAS } from "@/data/content";
import {
  ArrowRight,
  Compass,
  LayoutGrid,
  NotebookPen,
  PlusCircle,
  Route as RouteIcon,
  ScanLine,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Smile,
  Sparkles,
  Timer,
  UserRound,
  Users,
  Wind,
} from "lucide-react";

const GROUPS = [
  {
    heading: "Practice",
    items: [
      { href: "/guided", label: "Practice", hint: "Start a guided session", icon: Timer },
      { href: "/trainer", label: "Yoga Trainer", hint: "A practice for today", icon: UserRound },
      { href: "/adaptive", label: "Adaptive plan", hint: "Safe practice for how you feel", icon: Sparkles },
      { href: "/instructor", label: "Virtual instructor", hint: "Learn or Flow · 5-pose pilot", icon: ScanLine },
      { href: "/pose-coach", label: "Pose self-check", hint: "Cue checklist and private camera mirror", icon: ScanLine },
      { href: "/pathways", label: "Pathways", hint: "Quick flows and programs", icon: RouteIcon },
      { href: "/builder", label: "Builder", hint: "Craft your own sequence", icon: PlusCircle },
      { href: "/breathing", label: "Breathing", hint: "Guided pranayama", icon: Wind },
      { href: "/kids", label: "Kids", hint: "Stories and breath games", icon: Smile },
      { href: "/affirmations", label: "Affirmations", hint: "65 daily intentions", icon: Sparkles },
    ],
  },
  {
    heading: "Poses",
    items: [
      { href: "/asanas", label: "Poses", hint: `${ASANAS.length} illustrated poses`, icon: LayoutGrid },
      { href: "/search", label: "Search", hint: "Find any pose or flow", icon: SearchIcon },
    ],
  },
  {
    heading: "Progress",
    items: [
      { href: "/journal", label: "Journal", hint: "Reflect after practice", icon: NotebookPen },
      { href: "/profiles", label: "My path", hint: "Switch your focus", icon: Compass },
      { href: "/challenges", label: "Challenges", hint: "Private check-ins, no leaderboards", icon: Sparkles },
    ],
  },
  {
    heading: "You",
    items: [
      { href: "/settings", label: "Settings", hint: "Reminders, backup, data", icon: SettingsIcon },
      { href: "/account", label: "Account", hint: "Sync across devices", icon: UserRound },
      { href: "/household", label: "Household", hint: "Shared device, separate roles", icon: Users },
    ],
  },
] as const;

export function ExploreDirectory({ headingId = "explore-more-heading" }: { headingId?: string }) {
  return (
    <section className="space-y-3" aria-labelledby={headingId} data-testid="home-explore-more">
      <h2 id={headingId} className="font-serif text-xl font-semibold tracking-tight">
        Everything else
      </h2>
      <p className="text-sm text-muted-foreground">
        Trainer, pathways, breathing, kids, journal, settings and account.
      </p>
      {GROUPS.map((group) => (
        <div key={group.heading} className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.heading}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.items.map(({ href, label, hint, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-border/70 bg-card/60 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid={`home-explore-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

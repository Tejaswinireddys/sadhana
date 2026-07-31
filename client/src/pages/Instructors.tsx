import { FadeIn } from "@/components/motion";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { INSTRUCTORS, upcomingLive } from "@/data/instructors";
import { Link } from "wouter";

export default function Instructors() {
  useDocumentTitle("Instructors · Sadhana");
  const live = upcomingLive();

  return (
    <FadeIn className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Instructors & live</h1>
        <p className="max-w-2xl text-muted-foreground">
          Verified teachers and a small live-class pilot. Join opens a real session link. Full
          marketplace payouts stay gated behind credential checks.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-serif text-xl">Upcoming live</h2>
        {live.length === 0 && (
          <p className="text-sm text-muted-foreground">No live classes scheduled in this demo.</p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {live.map((c) => (
            <Card key={c.id} className="shadow-soft" data-testid={`live-${c.id}`}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{c.title}</p>
                  <Badge variant="outline">{c.level}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {c.instructorName} · {c.minutes} min · {c.seats} seats
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(c.startsAt).toLocaleString()}
                </p>
                {c.pilotNote && (
                  <p className="text-xs text-muted-foreground">{c.pilotNote}</p>
                )}
                <Button className="min-h-11" asChild data-testid={`live-join-${c.id}`}>
                  <a href={c.joinUrl} target="_blank" rel="noreferrer">
                    Join live session
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl">Teachers</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {INSTRUCTORS.map((i) => (
            <Card key={i.id} className="shadow-soft" data-testid={`instructor-${i.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="font-serif text-xl">{i.name}</CardTitle>
                  {i.verified && <Badge>Verified</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{i.bio}</p>
                <p>
                  {i.styles.join(" · ")} · {i.languages.join(", ")}
                </p>
                <p className="text-xs">Pilot roster — ratings publish after real student reviews.</p>
                <ul className="list-disc pl-5">
                  {i.credentials.map((c) => (
                    <li key={c.title}>
                      {c.title} — {c.issuer}
                      {c.year ? ` (${c.year})` : ""}
                    </li>
                  ))}
                </ul>
                <p className="text-xs">Accessibility: {i.accessibility.join("; ")}</p>
                <Button variant="outline" className="min-h-11" asChild>
                  <Link href="/pathways">Prep with adaptive practice</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </FadeIn>
  );
}

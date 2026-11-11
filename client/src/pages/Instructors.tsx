import { useState, type FormEvent } from "react";
import { FadeIn } from "@/components/motion";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INSTRUCTORS, upcomingLive } from "@/data/instructors";
import { KEYS, readString, writeString } from "@/lib/localPrefs";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

/**
 * The sample teacher profiles carry illustrative, unverified credentials
 * (see `@/data/instructors`). Real visitors must never read them as real
 * teachers, so they render only when this build flag is set — an internal
 * preview switch, off in production and by default everywhere.
 */
const SHOW_SAMPLE_TEACHERS = import.meta.env.VITE_SHOW_SAMPLE_TEACHERS === "true";

export default function Instructors() {
  useDocumentTitle("Instructors · Sadhana");
  const live = upcomingLive();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(() => !!readString(KEYS.teachersWaitlist));
  const [busy, setBusy] = useState(false);

  const joinWaitlist = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/teachers-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast({ title: "Could not join", description: data.error, variant: "destructive" });
        return;
      }
      writeString(KEYS.teachersWaitlist, value);
      setJoined(true);
      toast({
        title: "You're on the list",
        description: "We'll email you when verified teachers and live classes open.",
      });
    } catch {
      writeString(KEYS.teachersWaitlist, value);
      setJoined(true);
      toast({
        title: "You're on the list",
        description: "Saved on this device. We'll email you when teachers open.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FadeIn className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Teachers waitlist</h1>
        <p className="max-w-2xl text-muted-foreground">
          Live, teacher-led classes aren&apos;t available yet — no teachers are listed and nothing
          is bookable. This page is also at{" "}
          <Link href="/teachers" className="underline underline-offset-2">
            /teachers
          </Link>
          . Join the waitlist and we will email you when verified teachers and bookable classes
          open.
        </p>
      </header>

      <Card className="shadow-soft" data-testid="teachers-waitlist-card">
        <CardContent className="space-y-3 p-5">
          {joined ? (
            <p className="text-sm" data-testid="teachers-waitlist-success">
              You're on the teachers waitlist. We'll email you when classes open.
            </p>
          ) : (
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={joinWaitlist}>
              <Input
                type="email"
                required
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11"
                aria-label="Email for the teachers waitlist"
                data-testid="teachers-waitlist-email"
              />
              <Button
                type="submit"
                className="min-h-11"
                disabled={busy}
                data-testid="teachers-waitlist-join"
              >
                {busy ? "Joining…" : "Join waitlist"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {live.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-xl">Upcoming live</h2>
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
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3" data-testid="teachers-practice-today">
        <h2 className="font-serif text-xl">Practice today</h2>
        <p className="text-sm text-muted-foreground">
          While live classes are in the works, the adaptive plan and guided sessions are ready now.
        </p>
        <Button variant="outline" className="min-h-11" asChild>
          <Link href="/adaptive">Prep with adaptive practice</Link>
        </Button>
      </section>

      {SHOW_SAMPLE_TEACHERS && (
      <section className="space-y-3" data-testid="teachers-sample-profiles">
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-xl">Sample teacher profiles</h2>
          <Badge variant="outline">Internal preview</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Visible only with VITE_SHOW_SAMPLE_TEACHERS — illustrative profiles for layout review,
          never shown to practitioners.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {INSTRUCTORS.map((i) => (
            <Card key={i.id} className="shadow-soft" data-testid={`instructor-${i.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="font-serif text-xl">{i.name}</CardTitle>
                  <Badge variant="outline">Sample profile</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{i.bio}</p>
                <p>
                  {i.styles.join(" · ")} · {i.languages.join(", ")}
                </p>
                <p className="text-xs">
                  Illustrative profile — credentials below are examples and are not yet independently
                  verified.
                </p>
                <ul className="list-disc pl-5">
                  {i.credentials.map((c) => (
                    <li key={c.title}>
                      {c.title} — {c.issuer}
                      {c.year ? ` (${c.year})` : ""}
                    </li>
                  ))}
                </ul>
                <p className="text-xs">Accessibility: {i.accessibility.join("; ")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      )}
    </FadeIn>
  );
}

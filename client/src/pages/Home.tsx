import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Heatmap } from "@/components/Heatmap";
import { PoseSvg } from "@/components/PoseSvg";
import { EmptyState } from "@/components/EmptyState";
import { usePractice } from "@/context/PracticeContext";
import { dailyAffirmation } from "@/data/content";
import { formatDate, todayISO, type Stats } from "@/lib/sadhana";
import { Flame, Trophy, CalendarCheck, Clock, Play, Volume2, X } from "lucide-react";

function StatCard({
  icon: Icon,
  label,
  value,
  testId,
}: {
  icon: any;
  label: string;
  value: string | number;
  testId: string;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-serif text-2xl leading-none" data-testid={testId}>
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const { todays, remove } = usePractice();
  const { data: stats, isLoading } = useQuery<Stats>({ queryKey: ["/api/sessions/stats"] });
  const affirmation = dailyAffirmation();

  const readAloud = () => {
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(affirmation);
      u.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  };

  const hasPracticed = stats && stats.totalSessions > 0;

  return (
    <div className="animate-fade-in space-y-8">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground" data-testid="text-today-date">
          {formatDate(todayISO())}
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Welcome to your practice</h1>
      </header>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={Flame} label="Current streak (days)" value={stats?.currentStreak ?? 0} testId="stat-current-streak" />
          <StatCard icon={Trophy} label="Longest streak (days)" value={stats?.longestStreak ?? 0} testId="stat-longest-streak" />
          <StatCard icon={CalendarCheck} label="Total sessions" value={stats?.totalSessions ?? 0} testId="stat-total-sessions" />
          <StatCard icon={Clock} label="Minutes practiced" value={stats?.totalMinutes ?? 0} testId="stat-total-minutes" />
        </div>
      )}

      {!isLoading && !hasPracticed && (
        <Card className="border-primary/30 bg-accent/40 shadow-soft">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <PoseSvg pose="seated" size={84} className="text-primary" />
            <h2 className="font-serif text-xl">Begin your practice</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Your journey starts with a single breath. Add a few asanas and start your first session.
            </p>
            <Button asChild data-testid="button-browse-asanas">
              <Link href="/asanas">Browse the Asana Library</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily affirmation */}
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's affirmation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-serif text-xl leading-snug" data-testid="text-daily-affirmation">
              "{affirmation}"
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={readAloud} data-testid="button-read-affirmation">
                <Volume2 className="mr-1.5 h-4 w-4" /> Read aloud
              </Button>
              <Button variant="ghost" size="sm" asChild data-testid="link-more-affirmations">
                <Link href="/affirmations">More affirmations</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Today's practice / quick start */}
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's practice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todays.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No asanas selected yet. Add poses from the library to build today's session.
              </p>
            ) : (
              <ul className="space-y-2" data-testid="list-todays-practice">
                {todays.map((a) => (
                  <li
                    key={a.slug}
                    className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
                    data-testid={`todays-item-${a.slug}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-primary">
                        <PoseSvg pose={a.pose} size={28} />
                      </span>
                      {a.english}
                    </span>
                    <button
                      onClick={() => remove(a.slug)}
                      className="text-muted-foreground hover:text-destructive"
                      data-testid={`button-remove-${a.slug}`}
                      aria-label={`Remove ${a.english}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              className="w-full"
              disabled={todays.length === 0}
              onClick={() => navigate("/practice")}
              data-testid="button-start-practice"
            >
              <Play className="mr-1.5 h-4 w-4" /> Start practice
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Practice consistency — last 12 weeks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Heatmap data={stats?.heatmap ?? []} />
          {!hasPracticed && (
            <p className="mt-3 text-xs text-muted-foreground">
              Complete a session to start filling in your practice map.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

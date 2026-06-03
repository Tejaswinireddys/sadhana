import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PoseSvg } from "@/components/PoseSvg";
import { ASANAS, CATEGORIES, type Category } from "@/data/content";

const diffColor: Record<string, string> = {
  Beginner: "bg-secondary/20 text-secondary-foreground border-secondary/30",
  Intermediate: "bg-primary/15 text-primary border-primary/30",
  Advanced: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function Asanas() {
  const [filter, setFilter] = useState<Category | "All">("All");
  const list = filter === "All" ? ASANAS : ASANAS.filter((a) => a.category === filter);

  return (
    <div className="animate-fade-in space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Asana Library</h1>
        <p className="text-muted-foreground">
          {ASANAS.length} poses across seven families. Tap any card to explore the full guide.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(["All", ...CATEGORIES] as const).map((c) => (
          <Button
            key={c}
            size="sm"
            variant={filter === c ? "default" : "outline"}
            onClick={() => setFilter(c)}
            data-testid={`filter-${c.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {c}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <Link key={a.slug} href={`/asanas/${a.slug}`}>
            <Card
              className="group h-full cursor-pointer overflow-hidden shadow-soft transition-shadow hover:shadow-soft-lg hover-elevate"
              data-testid={`card-asana-${a.slug}`}
            >
              <div className="flex items-center justify-center bg-accent/40 py-6 text-foreground/80 transition-transform group-hover:scale-105">
                <PoseSvg pose={a.pose} size={96} />
              </div>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-lg leading-tight">{a.sanskrit}</h3>
                    <p className="text-sm text-muted-foreground">{a.english}</p>
                  </div>
                  <Badge variant="outline" className={`shrink-0 ${diffColor[a.difficulty]}`}>
                    {a.difficulty}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{a.category}</span>
                  <span>{a.hold}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

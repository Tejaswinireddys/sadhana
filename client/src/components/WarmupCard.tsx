import { Card, CardContent } from "@/components/ui/card";
import { PoseSvg } from "@/components/PoseSvg";
import { WARMUP } from "@/data/content";
import { Flame } from "lucide-react";

export function WarmupCard() {
  return (
    <Card className="border-primary/30 bg-accent/40 shadow-soft" data-testid="card-warmup">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-primary" />
          <h3 className="font-serif text-lg">{WARMUP.title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{WARMUP.description}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {WARMUP.steps.map((s) => (
            <div key={s.name} className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
              <span className="shrink-0 text-foreground/70">
                <PoseSvg pose={s.pose} size={40} />
              </span>
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

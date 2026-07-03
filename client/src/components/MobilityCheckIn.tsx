import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Ruler, TrendingDown } from "lucide-react";
import type { MobilityCheckIn as CheckIn } from "@shared/schema";

const CHECKIN_DAYS = [1, 15, 30, 45, 60];

async function fetchCheckIns(pathwaySlug: string): Promise<CheckIn[]> {
  const res = await apiRequest("GET", `/api/mobility?pathwaySlug=${encodeURIComponent(pathwaySlug)}`);
  return res.json();
}

export function MobilityCheckInCard({
  pathwaySlug,
  currentDay,
}: {
  pathwaySlug: string;
  currentDay: number;
}) {
  const { toast } = useToast();
  const { data: checkIns = [], isLoading } = useQuery<CheckIn[]>({
    queryKey: ["/api/mobility", pathwaySlug],
    queryFn: () => fetchCheckIns(pathwaySlug),
  });

  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [notes, setNotes] = useState("");

  const day = currentDay > 0 ? currentDay : 1;

  const log = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/mobility", {
        pathwaySlug,
        day,
        frontSplitInches: Number(front),
        backSplitInches: back.trim() === "" ? null : Number(back),
        notes: notes.trim() === "" ? null : notes.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobility", pathwaySlug] });
      toast({ title: "Check-in logged", description: "Beautiful — your progress is recorded." });
      setFront("");
      setBack("");
      setNotes("");
    },
    onError: (e) => {
      toast({ title: "Could not log", description: (e as Error).message, variant: "destructive" });
    },
  });

  const sorted = [...checkIns].sort((a, b) => a.day - b.day);
  const chartData = sorted.map((c) => ({ day: c.day, inches: c.frontSplitInches }));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const delta = first && last ? last.frontSplitInches - first.frontSplitInches : 0;
  const isDay1 = day <= 1 && checkIns.length === 0;

  return (
    <Card className="shadow-soft" data-testid="card-mobility-checkin">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-serif text-lg">
          <Ruler className="h-5 w-5 text-primary" /> Mobility check-in
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground" data-testid="text-mobility-prompt">
          {isDay1
            ? "Record your starting measurement — the distance in inches between your front hip and the floor in your deepest half-split. This is your baseline; not a judgment."
            : "Log the distance in inches between your front hip and the floor in your deepest half-split. Optional: your backbend depth."}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="mob-front">Front split (inches to floor)</Label>
            <Input
              id="mob-front"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="e.g. 8"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              data-testid="input-front-split"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mob-back">Backbend depth (optional)</Label>
            <Input
              id="mob-back"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="optional"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              data-testid="input-back-split"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mob-notes">Notes</Label>
          <Textarea
            id="mob-notes"
            placeholder="How did today's practice feel?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            data-testid="input-mobility-notes"
          />
        </div>
        <Button
          onClick={() => log.mutate()}
          disabled={front.trim() === "" || log.isPending}
          data-testid="button-log-checkin"
        >
          Log check-in
        </Button>

        <p className="text-xs text-muted-foreground">
          Recommended check-ins on days {CHECKIN_DAYS.join(", ")}.
        </p>

        {/* Progress chart */}
        {!isLoading && chartData.length > 0 && (
          <div className="space-y-3 border-t border-border pt-4">
            <div
              className="flex items-center gap-2 text-sm font-medium"
              data-testid="text-mobility-progress"
            >
              <TrendingDown className="h-4 w-4 text-primary" />
              {chartData.length > 1
                ? `Progress: ${delta <= 0 ? "" : "+"}${delta} inches since Day ${first.day}`
                : "Your baseline is recorded — log again to see progress."}
            </div>
            <div className="h-52 w-full" data-testid="chart-mobility">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="day"
                    type="number"
                    domain={[1, 60]}
                    ticks={CHECKIN_DAYS}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    label={{ value: "Day", position: "insideBottom", offset: -4, fontSize: 11 }}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    allowDecimals={false}
                    label={{ value: "inches", angle: -90, position: "insideLeft", fontSize: 11 }}
                  />
                  <RTooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${v} in`, "Front split gap"]}
                    labelFormatter={(d) => `Day ${d}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="inches"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

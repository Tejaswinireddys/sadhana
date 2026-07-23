import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Cell = { date: string; minutes: number };

function intensityClass(minutes: number): string {
  if (minutes <= 0) return "bg-muted";
  if (minutes < 10) return "bg-secondary/30";
  if (minutes < 25) return "bg-secondary/55";
  if (minutes < 45) return "bg-secondary/80";
  return "bg-secondary";
}

export function Heatmap({ data }: { data: Cell[] }) {
  // data is 84 cells oldest->newest; render as 12 columns (weeks) x 7 rows (days)
  const cells = data && data.length ? data : Array.from({ length: 84 }, () => ({ date: "", minutes: 0 }));
  const weeks: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div data-testid="heatmap" className="flex flex-col gap-2" role="img" aria-label="Practice consistency over the last 12 weeks">
      <div className="flex gap-[3px] overflow-x-auto pb-1" aria-hidden={!cells.some((c) => c.date)}>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((cell, di) => {
              const label = cell.date
                ? cell.minutes > 0
                  ? `${cell.minutes} minutes on ${cell.date}`
                  : `No practice on ${cell.date}`
                : undefined;
              return (
                <Tooltip key={di}>
                  <TooltipTrigger asChild>
                    <div
                      className={`h-3.5 w-3.5 rounded-[3px] ${intensityClass(cell.minutes)}`}
                      data-testid={`heatmap-cell-${cell.date}`}
                      title={label}
                      aria-label={label}
                    />
                  </TooltipTrigger>
                  {cell.date && (
                    <TooltipContent>
                      {cell.minutes > 0
                        ? `${cell.minutes} min on ${cell.date}`
                        : `No practice on ${cell.date}`}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-hidden>
        <span>Less</span>
        <div className="h-3 w-3 rounded-[3px] bg-muted" />
        <div className="h-3 w-3 rounded-[3px] bg-secondary/30" />
        <div className="h-3 w-3 rounded-[3px] bg-secondary/55" />
        <div className="h-3 w-3 rounded-[3px] bg-secondary/80" />
        <div className="h-3 w-3 rounded-[3px] bg-secondary" />
        <span>More</span>
      </div>
    </div>
  );
}

// StickerDisplay — shows the kid's earned star stickers. Reads from
// /api/kids/stickers. Displays a count ("You've earned N stars!") and a row of
// star icons, one per earned sticker.
import { useQuery } from "@tanstack/react-query";
import type { Sticker } from "@shared/schema";
import { Star } from "lucide-react";

export function StickerDisplay() {
  const { data: stickers } = useQuery<Sticker[]>({ queryKey: ["/api/kids/stickers"] });
  const count = stickers?.length ?? 0;

  return (
    <div
      className="kids-card flex flex-col items-center gap-3 border border-[hsl(38_60%_70%/0.6)] bg-white/60 p-5 dark:bg-white/5"
      data-testid="sticker-display"
    >
      <p className="kids-title text-xl font-semibold" data-testid="text-sticker-count">
        {count === 0
          ? "No stars yet — let's earn your first!"
          : `You've earned ${count} star${count === 1 ? "" : "s"}!`}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {count === 0 ? (
          <Star className="h-7 w-7 text-[hsl(38_40%_70%)]" />
        ) : (
          Array.from({ length: Math.min(count, 30) }).map((_, i) => (
            <Star
              key={i}
              className="h-7 w-7 fill-[hsl(38_92%_60%)] text-[hsl(38_92%_50%)]"
              data-testid={`star-${i}`}
            />
          ))
        )}
      </div>
    </div>
  );
}

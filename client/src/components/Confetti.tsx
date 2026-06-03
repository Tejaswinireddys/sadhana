// Confetti — a lightweight, dependency-free CSS confetti burst. Renders a set
// of falling colored pieces for ~2.4s. Respects motion-off / reduced-motion by
// rendering nothing when active is false. Used on the kids "I did it!" moment.
import { useMemo } from "react";

const COLORS = [
  "hsl(38 92% 60%)", // sun
  "hsl(16 72% 58%)", // terracotta
  "hsl(92 35% 50%)", // leaf
  "hsl(280 50% 65%)", // violet
  "hsl(200 70% 60%)", // sky
];

export function Confetti({ active }: { active: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        color: COLORS[i % COLORS.length],
        duration: 1.8 + Math.random() * 1.2,
        size: 8 + Math.random() * 8,
      })),
    [active],
  );

  if (!active) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" data-testid="confetti">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            width: `${p.size}px`,
            height: `${p.size}px`,
          }}
        />
      ))}
    </div>
  );
}

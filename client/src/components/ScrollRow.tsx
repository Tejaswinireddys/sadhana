import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontal scroll region with edge fades so overflow is discoverable,
 * keyboard-focusable, and labelled for assistive tech.
 */
export function ScrollRow({
  children,
  className,
  label,
  testId,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setCanLeft(el.scrollLeft > 4);
      setCanRight(max > 4 && el.scrollLeft < max - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [children]);

  return (
    <div className={cn("relative max-w-full min-w-0", className)}>
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        data-testid={testId}
        className={cn(
          "-mx-1 flex max-w-full gap-3 overflow-x-auto overscroll-x-contain px-1 pe-10 pb-1",
          "snap-x snap-mandatory scroll-smooth",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {children}
        {/* Keeps the last chip from sitting flush against the clip, so the next one can peek. */}
        <span className="w-6 shrink-0" aria-hidden />
      </div>
      <div
        aria-hidden
        data-testid={testId ? `${testId}-fade-left` : undefined}
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-background to-transparent transition-opacity",
          canLeft ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        data-testid={testId ? `${testId}-fade-right` : undefined}
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background from-30% to-transparent transition-opacity",
          canRight ? "opacity-100" : "opacity-0",
        )}
      />
      {canRight ? (
        <ChevronRight
          aria-hidden
          className="pointer-events-none absolute right-0.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
      ) : null}
    </div>
  );
}

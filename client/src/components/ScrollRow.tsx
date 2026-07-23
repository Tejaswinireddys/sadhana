import { useEffect, useRef, useState } from "react";
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
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        data-testid={testId}
        className={cn(
          "-mx-1 flex gap-3 overflow-x-auto px-1 pb-2",
          "snap-x snap-mandatory scroll-smooth",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "[scrollbar-width:thin]",
        )}
      >
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent transition-opacity",
          canLeft ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent transition-opacity",
          canRight ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

/**
 * On narrow viewports, long Home sections collapse behind a summary.
 * From `md` up, the section stays open and the summary reads as a heading.
 */
export function ResponsiveDetails({
  title,
  description,
  children,
  className,
  summaryId,
  testId,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  summaryId?: string;
  testId?: string;
}) {
    const [open, setOpen] = useState(() =>
      typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : true,
    );

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const sync = () => setOpen(mql.matches ? true : false);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return (
    <details
      className={cn("group space-y-4", className)}
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      data-testid={testId}
    >
      <summary
        id={summaryId}
        className={cn(
          "flex cursor-pointer list-none items-start justify-between gap-3 rounded-xl outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "md:pointer-events-none md:cursor-default",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <div className="space-y-1">
          <h2 className="font-serif text-xl">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          <p className="text-xs text-primary md:hidden">{open ? "Hide section" : "Show section"}</p>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform md:hidden",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </summary>
      <div className="space-y-4">{children}</div>
    </details>
  );
}

import { Lock } from "lucide-react";
import { Tag } from "@/components/ds";
import { cn } from "@/lib/utils";

/**
 * Presentational Plus mark. It does not check a plan or block the control it sits on.
 */
export function PlusLock({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  return (
    <Tag
      tone="outline"
      className={cn("gap-1", className)}
      data-testid={`plus-lock-${slug}`}
      title="Plus"
    >
      <Lock className="h-3 w-3" aria-hidden />
      Plus
    </Tag>
  );
}

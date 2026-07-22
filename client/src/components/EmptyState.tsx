import { LotusMark } from "./Logo";
import { cn } from "@/lib/utils";
import { Compass, Heart, Play, Search, Sparkles } from "lucide-react";

const VARIANT_ICON = {
  default: null,
  favorites: Heart,
  profile: Compass,
  firstSession: Play,
  search: Search,
  success: Sparkles,
} as const;

export type EmptyStateVariant = keyof typeof VARIANT_ICON;

export function EmptyState({
  title,
  description,
  children,
  testId,
  variant = "default",
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  testId?: string;
  variant?: EmptyStateVariant;
  className?: string;
}) {
  const Icon = VARIANT_ICON[variant];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center shadow-soft",
        className,
      )}
      data-testid={testId ?? "empty-state"}
      role="status"
    >
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/60 text-primary">
        {Icon ? <Icon className="h-6 w-6" aria-hidden /> : <LotusMark size={36} />}
      </span>
      <h3 className="font-serif text-lg text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {children && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

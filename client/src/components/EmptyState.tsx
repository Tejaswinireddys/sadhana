import { LotusMark } from "./Logo";

export function EmptyState({
  title,
  description,
  children,
  testId,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center"
      data-testid={testId ?? "empty-state"}
    >
      <span className="mb-4 text-muted-foreground/50">
        <LotusMark size={48} />
      </span>
      <h3 className="font-serif text-lg text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

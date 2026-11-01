import { useState } from "react";
import { Link } from "wouter";
import { Lock } from "lucide-react";
import {
  CLASS_DURATION_RANGES,
  CLASS_FOCUS_TAGS,
  CLASS_LEVELS,
  type ClassDurationRangeId,
  type ClassLevel,
  type ClassSummary,
} from "@shared/classLibrary";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion";
import { ClassCard } from "@/components/ClassCard";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { levelLabel, useClassList, useContinueWatching, type LibraryFilters } from "@/lib/classesApi";
import { countOf, plural } from "@/lib/plural";

/** Single-select chip; "All" clears its facet. Real buttons, so Tab/Enter/Space work. */
function FilterChip({ pressed, onClick, children, testId }: {
  pressed: boolean; onClick: () => void; children: string; testId: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={pressed ? "default" : "outline"}
      aria-pressed={pressed}
      onClick={onClick}
      data-testid={testId}
      className="min-h-11"
    >
      {children}
    </Button>
  );
}

function ChipGroup<T extends string>({ legend, value, options, onChange, testId, format = (v) => v }: {
  legend: string;
  value: T | undefined;
  options: readonly T[];
  onChange: (next: T | undefined) => void;
  testId: string;
  format?: (value: T) => string;
}) {
  return (
    <fieldset className="space-y-2" data-testid={testId}>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        <FilterChip pressed={value === undefined} onClick={() => onChange(undefined)} testId={`${testId}-all`}>All</FilterChip>
        {options.map((option) => (
          <FilterChip
            key={option}
            pressed={value === option}
            onClick={() => onChange(value === option ? undefined : option)}
            testId={`${testId}-${option.replace(/\s+/g, "-")}`}
          >
            {format(option)}
          </FilterChip>
        ))}
      </div>
    </fieldset>
  );
}

function ClassRow({ title, items, testId, empty, action }: {
  title: string; items: ClassSummary[]; testId: string; empty?: string; action?: React.ReactNode;
}) {
  const headingId = `${testId}-heading`;
  return (
    <section aria-labelledby={headingId} className="space-y-3" data-testid={testId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="font-serif text-xl font-semibold">{title}</h2>
        {action}
      </div>
      {items.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.slug}><ClassCard item={item} /></li>
          ))}
        </ul>
      ) : empty ? (
        <p className="text-sm text-muted-foreground" data-testid={`${testId}-empty`}>{empty}</p>
      ) : null}
    </section>
  );
}

const capitalise = (tag: string) => tag.charAt(0).toUpperCase() + tag.slice(1);

export default function Classes() {
  useDocumentTitle("Video classes · Sadhana");
  const [filters, setFilters] = useState<LibraryFilters>({});
  const list = useClassList(filters);
  const continuing = useContinueWatching();
  const items = list.data?.items ?? [];
  const free = items.filter((item) => item.tier === "free");
  const plus = items.filter((item) => item.tier === "plus");
  const viewerIsPlus = list.data?.viewerPlan === "plus";
  const active = !!(filters.level || filters.duration || filters.focus);
  const resumable = continuing.data?.items ?? [];
  const total = list.data?.total ?? 0;

  return (
    <FadeIn className="mx-auto max-w-5xl space-y-8 py-2">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Video classes</h1>
        <p className="text-muted-foreground">
          Follow-along classes you can pause and pick up later. Your progress is saved on this device, or to your account when you sign in.
        </p>
      </header>

      <div className="space-y-4" data-testid="class-library-filters">
        <ChipGroup<ClassLevel>
          legend="Level" value={filters.level} options={CLASS_LEVELS} format={levelLabel}
          onChange={(level) => setFilters((f) => ({ ...f, level }))} testId="class-library-level"
        />
        <ChipGroup<ClassDurationRangeId>
          legend="Duration" value={filters.duration} options={CLASS_DURATION_RANGES.map((r) => r.id)}
          format={(id) => CLASS_DURATION_RANGES.find((r) => r.id === id)!.label}
          onChange={(duration) => setFilters((f) => ({ ...f, duration }))} testId="class-library-duration"
        />
        <ChipGroup<string>
          legend="Focus" value={filters.focus} options={CLASS_FOCUS_TAGS} format={capitalise}
          onChange={(focus) => setFilters((f) => ({ ...f, focus }))} testId="class-library-focus"
        />
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite" data-testid="class-library-count">
          {list.isLoading ? "Loading classes…" : list.isError ? "" : `${countOf(total, "class", "classes")}${active ? ` ${plural(total, "matches", "match")} these filters` : ""}`}
          {active && (
            <button type="button" className="ml-2 min-h-11 cursor-pointer font-medium text-foreground underline underline-offset-2" onClick={() => setFilters({})} data-testid="class-library-clear">
              Clear filters
            </button>
          )}
        </p>
      </div>

      {list.isError && (
        <div className="space-y-2" role="alert" data-testid="class-library-error">
          <p className="text-sm">Classes couldn&apos;t load. Check your connection and try again.</p>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => void list.refetch()}>Try again</Button>
        </div>
      )}

      {resumable.length > 0 && (
        <ClassRow title="Continue watching" items={resumable} testId="class-library-continue" />
      )}

      {!list.isLoading && !list.isError && (
        <>
          <ClassRow
            title="Free classes" items={free} testId="class-library-free"
            empty={active ? "No free classes match these filters." : "No free classes yet."}
          />
          <ClassRow
            title="Sadhana Plus" items={plus} testId="class-library-plus"
            empty={active ? "No Plus classes match these filters." : "No Plus classes yet."}
            action={!viewerIsPlus && plus.length > 0 ? (
              <Link href="/plus" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium underline underline-offset-2" data-testid="class-library-plus-cta">
                <Lock className="h-4 w-4" aria-hidden /> Unlock with Plus
              </Link>
            ) : undefined}
          />
        </>
      )}
    </FadeIn>
  );
}

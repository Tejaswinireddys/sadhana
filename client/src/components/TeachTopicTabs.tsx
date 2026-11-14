/**
 * Form / Breath / Align tabs on the pose page and in the practice tips sheet.
 *
 * A horizontal scroller used to eat the first tap (the click never fired, so
 * Breath looked dead). Selection happens on pointerdown, and arrow keys follow
 * the tab pattern: one key moves and selects.
 */
import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { nextTeachTab } from "@/lib/teachTabs";

export type TeachTopic = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export function TeachTopicTabs({
  tabs,
  tab,
  onTab,
  idPrefix,
  tabTestIdPrefix,
  panelTestIdPrefix,
  label = "Teaching topics",
  listClassName,
  panelClassName,
  children,
}: {
  tabs: readonly TeachTopic[];
  tab: string;
  onTab: (id: string) => void;
  /** Stable prefix so tab and panel ids stay unique on a page with two lists. */
  idPrefix: string;
  /** e.g. `pose-teach-tab-` — existing tests and bookmarks depend on these. */
  tabTestIdPrefix: string;
  /** e.g. `pose-teach-panel-`. */
  panelTestIdPrefix: string;
  label?: string;
  listClassName?: string;
  panelClassName?: string;
  children: ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const ids = tabs.map((item) => item.id);
  const tabId = (id: string) => `${idPrefix}-tab-${id}`;
  const panelIdFor = (id: string) => `${idPrefix}-panel-${id}`;

  const select = (id: string) => {
    onTab(id);
    queueMicrotask(() => {
      listRef.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabId(id))}`)?.focus();
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = nextTeachTab(ids, tab, event.key);
    if (!next) return;
    event.preventDefault();
    select(next);
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0) return;
    // Select before the scroller can cancel the click. Keyboard still uses click.
    onTab(id);
  };

  return (
    <>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className={cn("flex gap-1 overflow-x-auto overscroll-x-contain pb-1", listClassName)}
      >
        {tabs.map(({ id, label: itemLabel, icon: Icon }) => {
          const selected = tab === id;
          return (
            <button
              key={id}
              id={tabId(id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelIdFor(id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onTab(id)}
              onPointerDown={(event) => onPointerDown(event, id)}
              className={cn(
                "inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-background/70 text-muted-foreground hover:text-foreground",
              )}
              data-testid={`${tabTestIdPrefix}${id}`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {itemLabel}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={panelIdFor(tab)}
        aria-labelledby={tabId(tab)}
        tabIndex={0}
        className={cn("focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", panelClassName)}
        data-testid={`${panelTestIdPrefix}${tab}`}
      >
        {children}
      </div>
    </>
  );
}

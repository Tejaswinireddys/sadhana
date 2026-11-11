import type { Asana, Pathway } from "@/data/content";

/**
 * The pose catalog is hundreds of kilobytes. The shell used to import it
 * statically, so every in-app route downloaded it inside App-*.js. Pages that
 * need poses import `@/data/content`, which registers itself here; the shell
 * reads this slot and only calls `loadCatalog()` for a route that restores a
 * queue or checks Plus.
 */
export type CatalogSlice = {
  ASANAS: Asana[];
  PATHWAYS: Pathway[];
  asanaBySlug: (slug: string) => Asana | undefined;
};

let current: CatalogSlice | null = null;
let pending: Promise<CatalogSlice> | null = null;
const listeners = new Set<() => void>();

export function registerCatalog(catalog: CatalogSlice): void {
  current = catalog;
  for (const listener of listeners) listener();
}

export function peekCatalog(): CatalogSlice | null {
  return current;
}

export function subscribeCatalog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Dynamic import of the catalog. Deduped so the shell and a page share one request. */
export function loadCatalog(): Promise<CatalogSlice> {
  if (current) return Promise.resolve(current);
  pending ??= import("@/data/content").then((mod) => {
    if (!current) {
      registerCatalog({
        ASANAS: mod.ASANAS,
        PATHWAYS: mod.PATHWAYS,
        asanaBySlug: mod.asanaBySlug,
      });
    }
    return current as CatalogSlice;
  });
  return pending;
}

/** Pathname without a query or trailing slash. `/` stays `/`. */
export function barePath(path: string): string {
  const bare = path.split("?")[0].replace(/\/+$/, "");
  return bare === "" ? "/" : bare;
}

/** Routes whose first screen reads the restored practice queue. */
export function routeReadsQueue(path: string): boolean {
  const bare = barePath(path);
  return (
    bare === "/" ||
    bare === "/practice" ||
    bare === "/guided" ||
    bare === "/instructor" ||
    bare === "/asanas" ||
    bare.startsWith("/asanas/")
  );
}

/**
 * Start the page chunk while the shell is still waiting on the catalog, so
 * the player is not stuck behind a second round trip after the catalog arrives.
 */
export function prefetchShellPage(path: string): void {
  const bare = barePath(path);
  if (bare === "/") void import("@/pages/Home");
  else if (bare === "/practice") void import("@/pages/Practice");
  else if (bare === "/guided") void import("@/pages/GuidedSession");
  else if (bare === "/instructor") void import("@/pages/InstructorSession");
  else if (bare === "/asanas") void import("@/pages/Asanas");
  else if (bare.startsWith("/asanas/")) void import("@/pages/AsanaDetail");
  else if (bare.startsWith("/pathways/")) void import("@/pages/PathwayDetail");
}

import type { Request, Response, NextFunction } from "express";

/** Consistent JSON 404 for API / media routes (never the SPA HTML shell). */
export function sendJson404(res: Response, message = "Not found") {
  if (res.headersSent) return;
  res.status(404).json({ error: message });
}

/**
 * Catch-all for prefixes that must never fall through to index.html —
 * even when the path has no file extension (e.g. `/audio/missing`).
 */
export function json404ForPrefixes(...prefixes: string[]) {
  return function json404Middleware(req: Request, res: Response, next: NextFunction) {
    const pathName = req.path || "";
    if (prefixes.some((p) => pathName === p.slice(0, -1) || pathName.startsWith(p))) {
      return sendJson404(res);
    }
    next();
  };
}

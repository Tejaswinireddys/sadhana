/**
 * Platform hardening: security headers, auth rate limits, and CSRF origin checks.
 * Implemented without extra dependencies so free-tier deploys stay lean.
 */
import type { Express, NextFunction, Request, Response } from "express";

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "token",
  "authorization",
  "email",
  "body",
  "notes",
  "displayname",
  "display_name",
]);

/** Strip or redact fields that must never appear in request logs. */
export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null) return value;
  if (Array.isArray(value)) {
    if (value.length > 20) return `[array:${value.length}]`;
    return value.slice(0, 5).map((v) => redactForLog(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = "[redacted]";
      } else if (typeof v === "string" && v.length > 200) {
        out[k] = `[string:${v.length}]`;
      } else {
        out[k] = redactForLog(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export function applySecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(), payment=(self), usb=()",
  );
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  // HSTS only when the request arrived over TLS (or via a terminating proxy).
  const proto = _req.get("x-forwarded-proto") ?? _req.protocol;
  if (proto === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
}

type Bucket = { count: number; resetAt: number };

/** Simple sliding fixed-window limiter keyed by IP + route group. */
export function createRateLimiter(opts: {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
}) {
  const buckets = new Map<string, Bucket>();
  const keyFn =
    opts.key ??
    ((req: Request) => {
      const forwarded = req.get("x-forwarded-for");
      const ip = forwarded?.split(",")[0]?.trim() || req.ip || "unknown";
      return ip;
    });

  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const key = `${keyFn(req)}:${req.path}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader("X-RateLimit-Limit", String(opts.max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, opts.max - bucket.count)));
    if (bucket.count > opts.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "Too many attempts. Please wait and try again." });
    }
    next();
  };
}

/**
 * Reject cross-site state-changing requests that carry cookies.
 * SameSite=Lax helps; Origin/Referer checks close the remaining gap.
 */
export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }
  // Platform API uses API keys rather than cookies — CSRF not applicable.
  if (req.path.startsWith("/v1") || req.originalUrl.startsWith("/api/v1")) {
    return next();
  }
  // Stripe webhooks are signed; Origin is absent by design.
  if (req.originalUrl.startsWith("/api/billing/webhook")) {
    return next();
  }
  if (req.get("x-api-key")) return next();

  const origin = req.get("origin");
  const referer = req.get("referer");
  const host = req.get("x-forwarded-host") || req.get("host");
  if (!host) return next();

  const allowed = new Set<string>();
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  allowed.add(`${proto}://${host}`);
  // Local Vite / Express variants.
  allowed.add(`http://${host}`);
  allowed.add(`https://${host}`);
  if (process.env.PUBLIC_APP_URL) {
    try {
      allowed.add(new URL(process.env.PUBLIC_APP_URL).origin);
    } catch {
      /* ignore malformed */
    }
  }

  const candidate = origin || (referer ? safeOrigin(referer) : null);
  // Same-origin fetch from older browsers may omit Origin on POST; allow when
  // neither Origin nor Referer is present (typical non-browser / same-site).
  if (!candidate) return next();

  if (![...allowed].some((a) => candidate === a || candidate.startsWith(a + "/"))) {
    return res.status(403).json({ error: "Cross-origin request blocked" });
  }
  next();
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Wire common middleware onto the Express app. */
export function mountSecurity(app: Express) {
  app.disable("x-powered-by");
  app.use(applySecurityHeaders);
  app.use("/api", requireSameOrigin);

  const authLimit = createRateLimiter({ windowMs: 15 * 60_000, max: 30 });
  const authStrict = createRateLimiter({ windowMs: 15 * 60_000, max: 10 });
  app.use("/api/auth/login", authStrict);
  app.use("/api/auth/signup", authStrict);
  app.use("/api/auth/forgot-password", authStrict);
  app.use("/api/auth/reset-password", authStrict);
  // Only throttle state-changing auth actions. Read-only session checks
  // (GET /api/auth/me) run on every page and must not exhaust the limiter,
  // which previously returned 429 on ordinary navigation.
  app.use("/api/auth", (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") return next();
    return authLimit(req, res, next);
  });

  const importLimit = createRateLimiter({ windowMs: 60 * 60_000, max: 10 });
  app.use("/api/account/import", importLimit);
}

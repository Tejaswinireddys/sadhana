/**
 * VAPID keys for Web Push: where they come from, and when push must stay off.
 *
 * A browser's push subscription is bound to the public key it subscribed with.
 * The server used to generate a fresh pair whenever the env vars were missing,
 * which in production meant every restart or deploy silently orphaned every
 * subscription: reminders stopped, nothing errored, and the only trace was one
 * "Generated ephemeral VAPID keys" line in the log. So:
 *
 * - keys set and well-formed      → push on, from the environment.
 * - keys missing, production      → push **off**, with a warning that says how
 *                                    to fix it. Never a temporary pair.
 * - keys missing, not production  → a temporary pair, so local dev and tests
 *                                    work with no setup.
 * - keys set but malformed        → push off everywhere. A typo must not be
 *                                    papered over by a pair nobody chose, and
 *                                    must not crash the server at import.
 *
 * Push is optional, so the answer to a bad config is "disabled", never a
 * process that refuses to boot.
 */
import webpush from "web-push";

export const VAPID_ENV_VARS = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"] as const;
export const DEFAULT_VAPID_SUBJECT = "mailto:hello@sadhana.local";
export const GENERATE_VAPID_COMMAND = "npm run gen:vapid-keys";

export type VapidKeys = { publicKey: string; privateKey: string };

export type VapidConfig =
  | (VapidKeys & { enabled: true; subject: string; source: "env" | "ephemeral" })
  | { enabled: false; reason: string };

type Env = Record<string, string | undefined>;

const decodedLength = (value: string) =>
  /^[A-Za-z0-9_-]+$/.test(value) ? Buffer.from(value, "base64url").length : -1;

/** An uncompressed P-256 point is 65 bytes; the private scalar is 32. Both URL-safe base64, unpadded. */
export function vapidKeyProblems(keys: VapidKeys): string[] {
  const problems: string[] = [];
  if (decodedLength(keys.publicKey) !== 65) problems.push("VAPID_PUBLIC_KEY is not a valid VAPID public key");
  if (decodedLength(keys.privateKey) !== 32) problems.push("VAPID_PRIVATE_KEY is not a valid VAPID private key");
  return problems;
}

/**
 * Decide the push configuration from the environment. Pure apart from
 * `generate`, which is only called for the non-production fallback.
 */
export function resolveVapidConfig(
  env: Env = process.env,
  generate: () => VapidKeys = () => webpush.generateVAPIDKeys(),
): VapidConfig {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = env.VAPID_SUBJECT?.trim() || DEFAULT_VAPID_SUBJECT;
  const production = env.NODE_ENV === "production";

  if (publicKey && privateKey) {
    const problems = vapidKeyProblems({ publicKey, privateKey });
    // web-push rejects anything else at send time, where it would only show up as silence.
    if (!/^(mailto:\S+@\S+|https:\/\/\S+)$/.test(subject)) problems.push("VAPID_SUBJECT must be a mailto: address or an https:// URL");
    if (problems.length) return { enabled: false, reason: `${problems.join("; ")}. Generate a pair with \`${GENERATE_VAPID_COMMAND}\`.` };
    return { enabled: true, source: "env", publicKey, privateKey, subject };
  }

  const missing = [!publicKey && "VAPID_PUBLIC_KEY", !privateKey && "VAPID_PRIVATE_KEY"].filter(Boolean).join(" and ");
  if (production) {
    return {
      enabled: false,
      reason: `${missing} ${publicKey || privateKey ? "is" : "are"} not set. Temporary keys are never generated in production, because every restart would orphan every browser subscription. Generate a pair once with \`${GENERATE_VAPID_COMMAND}\` and set both variables.`,
    };
  }
  if (publicKey || privateKey) {
    // Half a pair is a mistake, not a request for temporary keys.
    return { enabled: false, reason: `${missing} is not set but the other key is. Set both, or neither for temporary development keys.` };
  }
  return { enabled: true, source: "ephemeral", ...generate(), subject };
}

/** The one line the server logs about push at boot. Never includes a key. */
export function vapidStartupMessage(config: VapidConfig): string {
  if (!config.enabled) return `[push] Web Push is DISABLED: ${config.reason}`;
  return config.source === "env"
    ? "[push] Web Push enabled with the configured VAPID keys"
    : `[push] Web Push enabled with temporary development VAPID keys — subscriptions will not survive a restart (\`${GENERATE_VAPID_COMMAND}\` for a stable pair)`;
}

/**
 * What `npm run gen:vapid-keys` prints: the exact variables to set, and where.
 * The private key appears here and nowhere else — the script writes no file.
 */
export function vapidKeyInstructions(keys: VapidKeys): string {
  return [
    "New VAPID key pair for Web Push. Nothing was written to disk.",
    "",
    "Set these two environment variables on the server (Render: Dashboard → your",
    "service → Environment), or in your local, git-ignored .env:",
    "",
    `VAPID_PUBLIC_KEY=${keys.publicKey}`,
    `VAPID_PRIVATE_KEY=${keys.privateKey}`,
    "",
    "Optional — a contact address push services can reach you at:",
    "",
    "VAPID_SUBJECT=mailto:you@yourdomain.com",
    "",
    "Keep VAPID_PRIVATE_KEY secret: do not commit it, paste it into an issue, or",
    "put it in a VITE_* variable. Set the pair once and keep it — changing either",
    "key invalidates every existing browser subscription, so people would have to",
    "turn reminders on again.",
  ].join("\n");
}

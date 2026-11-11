/**
 * What the connectivity banner should say.
 *
 * `navigator.onLine` is a hint, not a measurement: some browsers report
 * offline while requests still succeed. The offline sentence appears only
 * after a reachability check has failed *and* the browser still says offline.
 * A successful response clears both, so a working connection never keeps the
 * "you're offline" banner up.
 */
export function connectivityView(opts: {
  browserOffline: boolean;
  apiDown: boolean;
}): "offline" | "api" | null {
  if (!opts.apiDown) return null;
  return opts.browserOffline ? "offline" : "api";
}

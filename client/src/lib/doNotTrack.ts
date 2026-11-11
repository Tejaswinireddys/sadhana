/**
 * Browser Do Not Track / Global Privacy Control. Pure so product analytics can
 * refuse remote capture without poking the network stack.
 *
 * `navigator.doNotTrack` is "1" when the user asked not to be tracked; GPC
 * (`navigator.globalPrivacyControl`) is the newer equivalent. Either one is
 * enough to keep PostHog dark.
 */
export function browserDoNotTrack(
  nav: { doNotTrack?: string | null; globalPrivacyControl?: boolean } | null | undefined = typeof navigator !== "undefined" ? navigator : undefined,
): boolean {
  if (!nav) return false;
  if (nav.globalPrivacyControl === true) return true;
  const dnt = nav.doNotTrack;
  return dnt === "1" || dnt === "yes";
}

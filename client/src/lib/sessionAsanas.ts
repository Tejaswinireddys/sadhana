/**
 * Session rows persist pose names as JSON (`["Mountain Pose"]`).
 * Settings and other lists should show a human sentence, including older
 * plain-text values that were never serialized.
 */
export function formatSessionPoseLine(raw: string | null | undefined): string {
  if (raw == null) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
        .join(", ");
    }
    if (typeof parsed === "string") return parsed.trim();
  } catch {
    /* already a human-readable list */
  }
  return trimmed;
}

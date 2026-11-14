/**
 * Keyboard movement for the pose teaching tabs (Form, Breath, Align, …).
 *
 * These are a manual tablist, not Radix, so arrow keys have to be implemented
 * here. Activation follows focus: one arrow key both moves and selects, which
 * is what a screen reader expects from `role="tab"`.
 */
export function nextTeachTab(ids: readonly string[], current: string, key: string): string | null {
  if (ids.length === 0) return null;
  const index = Math.max(0, ids.indexOf(current));
  if (key === "ArrowRight" || key === "ArrowDown") return ids[(index + 1) % ids.length] ?? null;
  if (key === "ArrowLeft" || key === "ArrowUp") return ids[(index - 1 + ids.length) % ids.length] ?? null;
  if (key === "Home") return ids[0] ?? null;
  if (key === "End") return ids[ids.length - 1] ?? null;
  return null;
}

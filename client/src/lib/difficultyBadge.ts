/**
 * Difficulty / status chips must stay readable in dark mode.
 * Tinted brand fills with a dark-on-dark foreground compositing over a dark
 * card landed at ~1.5:1. These classes use the page foreground on a light wash.
 */
export const DIFFICULTY_BADGE_CLASS: Record<string, string> = {
  Beginner: "bg-secondary/15 text-foreground border-secondary/40",
  Intermediate: "bg-primary/10 text-foreground border-primary/40",
  Advanced: "bg-destructive/10 text-foreground border-destructive/40",
};

export function difficultyBadgeClass(level: string): string {
  return DIFFICULTY_BADGE_CLASS[level] ?? "bg-muted text-foreground border-border";
}

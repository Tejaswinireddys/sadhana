import { ASANAS } from "../client/src/data/content";
const PAGES: Record<string, { title: string; description: string }> = {
  "/": { title: "Sadhana — Guided yoga practice", description: "Build a daily yoga practice with illustrated poses, voice guidance and captions." },
  "/welcome": { title: "Sadhana — A daily yoga practice that fits your day", description: "Try a guided practice without an account, or find a session for your experience and available time." },
  "/help": { title: "Help · Sadhana", description: "Help with yoga practice, accounts, recovery codes, accessibility and your data." },
  "/kids": { title: "Kids yoga · Sadhana", description: "Playful yoga poses and breathing activities for children with grown-up supervision." },
  "/asanas": { title: "Yoga pose library · Sadhana", description: "Explore pose instructions, breathing cues, modifications and practice notes." },
  "/pathways": { title: "Yoga pathways · Sadhana", description: "Explore structured yoga pathways and build a regular practice." },
  "/breathing": { title: "Breathing practices · Sadhana", description: "Explore guided breathing practices at your own pace." },
  "/privacy": { title: "Privacy · Sadhana", description: "How Sadhana stores practice data and how to export or delete it." },
  "/terms": { title: "Terms · Sadhana", description: "Terms for using Sadhana." },
  "/health-disclaimer": { title: "Health disclaimer · Sadhana", description: "Understand the limits of educational yoga guidance before practising." },
};
export function pageMetadata(pathname: string) {
  if (PAGES[pathname]) return PAGES[pathname];
  const slug = pathname.startsWith("/asanas/") ? pathname.slice(8) : "";
  const pose = ASANAS.find((p) => p.slug === slug);
  if (pose) return { title: `${pose.english} · Sadhana`, description: `${pose.english}: step-by-step instructions, breathing guidance, modifications and practice notes.` };
  return null;
}
export function publicSitemapPaths(): string[] {
  return [...Object.keys(PAGES), ...ASANAS.map((p) => `/asanas/${p.slug}`)];
}

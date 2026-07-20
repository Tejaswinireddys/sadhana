import { apiRequest } from "@/lib/queryClient";

export type SadhanaExport = {
  version: 1;
  exportedAt: string;
  sessions: unknown[];
  journal: unknown[];
  customFlows: unknown[];
  favorites: unknown[];
  favoriteAsanas: unknown[];
  enrollments: unknown[];
  preferences: unknown;
  milestones: unknown[];
  stickers: unknown[];
  poseNotes: Array<{ slug: string; body: string; updatedAt: string }>;
};

async function getJson(url: string) {
  const res = await apiRequest("GET", url);
  return res.json();
}

export async function buildExport(): Promise<SadhanaExport> {
  const [
    sessions,
    journal,
    customFlows,
    favorites,
    favoriteAsanas,
    enrollments,
    preferences,
    milestones,
    stickers,
  ] = await Promise.all([
    getJson("/api/sessions"),
    getJson("/api/journal"),
    getJson("/api/custom-flows"),
    getJson("/api/favorites"),
    getJson("/api/favorites/asanas"),
    getJson("/api/enrollments"),
    getJson("/api/preferences"),
    getJson("/api/milestones"),
    getJson("/api/kids/stickers"),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions,
    journal,
    customFlows,
    favorites,
    favoriteAsanas,
    enrollments,
    preferences,
    milestones,
    stickers,
    poseNotes: [],
  };
}

export function downloadExport(data: SadhanaExport) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sadhana-export-${data.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importExport(data: SadhanaExport) {
  const res = await apiRequest("POST", "/api/account/import", data);
  return res.json();
}

export async function clearAllData() {
  await apiRequest("DELETE", "/api/account/data");
}

/** Build a simple daily reminder ICS for the user's calendar. */
export function downloadReminderIcs(hour: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const start = new Date(now);
  start.setHours(hour, 0, 0, 0);
  if (start <= now) start.setDate(start.getDate() + 1);
  const end = new Date(start.getTime() + 15 * 60 * 1000);
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sadhana//Practice Reminder//EN",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    "RRULE:FREQ=DAILY",
    "SUMMARY:Sadhana practice",
    "DESCRIPTION:Five mindful minutes. Open https://sadhana-ou9m.onrender.com",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sadhana-daily-reminder.ics";
  a.click();
  URL.revokeObjectURL(url);
}

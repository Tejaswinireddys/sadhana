/**
 * Sample teacher profiles used to preview the (not-yet-operational) teachers
 * surface. These are illustrative only: no credential-verification pipeline and
 * no scheduled live classes exist yet, so `verified` is false and `live` is
 * empty. Do not present these as real, bookable, or credential-checked teachers.
 */
export type InstructorCredential = {
  title: string;
  issuer: string;
  year?: number;
};

export type LiveClass = {
  id: string;
  title: string;
  startsAt: string; // ISO
  minutes: number;
  level: "Beginner" | "All levels" | "Intermediate";
  seats: number;
  /**
   * Live pilot join link (Zoom / YouTube Live / Mux).
   * Opens in a new tab — no in-app streaming stack required.
   */
  joinUrl: string;
  /** Honest pilot label — not fabricated review counts. */
  pilotNote?: string;
};

export type Instructor = {
  id: string;
  name: string;
  styles: string[];
  languages: string[];
  accessibility: string[];
  bio: string;
  credentials: InstructorCredential[];
  live: LiveClass[];
  verified: boolean;
};

export const INSTRUCTORS: Instructor[] = [
  {
    id: "maya-r",
    name: "Maya Rao",
    styles: ["Hatha", "Restorative"],
    languages: ["English", "Hindi"],
    accessibility: ["Chair options", "Large-print cues"],
    bio: "Trauma-informed teaching with a focus on breath-led recovery.",
    credentials: [
      { title: "RYT-500", issuer: "Yoga Alliance", year: 2018 },
      { title: "Prenatal Yoga", issuer: "Birthlight", year: 2021 },
    ],
    verified: false,
    live: [],
  },
  {
    id: "jon-k",
    name: "Jon Kim",
    styles: ["Vinyasa", "Mobility"],
    languages: ["English", "Korean"],
    accessibility: ["Voice-first cues", "No floor required options"],
    bio: "Athletic mobility with conservative load progressions.",
    credentials: [{ title: "E-RYT-200", issuer: "Yoga Alliance", year: 2016 }],
    verified: false,
    live: [],
  },
  {
    id: "amira-s",
    name: "Amira Saleh",
    styles: ["Yin", "Meditation"],
    languages: ["English", "Arabic"],
    accessibility: ["Captions", "Reduced-motion friendly"],
    bio: "Long holds and nervous-system downshifts for stressed professionals.",
    credentials: [{ title: "Yin Yoga Teacher", issuer: "Paulie Zink lineage program", year: 2019 }],
    verified: false,
    live: [],
  },
];

export function upcomingLive(limit = 6): (LiveClass & { instructorName: string; instructorId: string })[] {
  const rows = INSTRUCTORS.flatMap((i) =>
    i.live.map((l) => ({ ...l, instructorName: i.name, instructorId: i.id })),
  );
  return rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, limit);
}

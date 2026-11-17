/**
 * The eight limbs, from Patañjali's Yoga Sūtra, as a short study.
 *
 * This is a classical list, not a belief to adopt and not a sect. Translations
 * of a few limbs differ; where they do, the card says so. Nothing here is a
 * recording of a teacher.
 */

export type EightLimb = {
  slug: string;
  order: number;
  name: string;
  iast: string;
  devanagari: string;
  /** A rough English guide for the computer voice. Not a phonetic authority. */
  say: string;
  summary: string;
  /** What the limb is, in a few sentences. */
  body: string;
  practiceHref: string;
  practiceLabel: string;
};

export const EIGHT_LIMBS: EightLimb[] = [
  {
    slug: "yama",
    order: 1,
    name: "Yama",
    iast: "yama",
    devanagari: "यम",
    say: "YUH-muh",
    summary: "How you treat other people and the world.",
    body: "The Yoga Sūtra lists five yamas: ahiṃsā (not harming), satya (truthfulness), asteya (not taking what is not given), brahmacarya, and aparigraha (not grasping). Translators disagree about brahmacarya. Some read it as celibacy, others as care in how energy, including sexual energy, is used. The limb is a set of restraints, not a creed.",
    practiceHref: "/journal",
    practiceLabel: "Write one line about how you want to act today",
  },
  {
    slug: "niyama",
    order: 2,
    name: "Niyama",
    iast: "niyama",
    devanagari: "नियम",
    say: "nee-YUH-muh",
    summary: "How you keep your own life in order.",
    body: "The five niyamas are śauca (cleanliness), santoṣa (contentment), tapas (the heat of steady effort), svādhyāya (study, of a text or of yourself), and īśvara-praṇidhāna. That last one is dedication to īśvara, a personal ideal in the sūtra. You can study the limb without sharing that theology. It is still about where you aim your effort.",
    practiceHref: "/journal",
    practiceLabel: "Note one thing you can keep simple today",
  },
  {
    slug: "asana",
    order: 3,
    name: "Asana",
    iast: "āsana",
    devanagari: "आसन",
    say: "AH-suh-nuh",
    summary: "A seat that is steady and comfortable.",
    body: "The sūtra defines āsana in one line: sthira-sukham āsanam, a posture that is steady and easeful. The many shapes in a modern class came later. This app's poses are that later tradition. The limb, in the text, is the ability to sit still without strain, not a performance.",
    practiceHref: "/asanas/sukhasana",
    practiceLabel: "Sit in Easy Pose for a few breaths",
  },
  {
    slug: "pranayama",
    order: 4,
    name: "Pranayama",
    iast: "prāṇāyāma",
    devanagari: "प्राणायाम",
    say: "prah-nah-YAH-muh",
    summary: "Regulating the breath.",
    body: "Prāṇāyāma is working with the breath: its length, its pause, and where you feel it. It is the fourth limb, after a steady seat, not a trick for health. Use a pattern you can finish without strain. Stop if you feel dizzy.",
    practiceHref: "/breathing",
    practiceLabel: "Open the breathing practices",
  },
  {
    slug: "pratyahara",
    order: 5,
    name: "Pratyahara",
    iast: "pratyāhāra",
    devanagari: "प्रत्याहार",
    say: "pruh-tyah-HAH-ruh",
    summary: "Letting the senses come back from what they chase.",
    body: "Pratyāhāra is often translated as withdrawal of the senses. It does not mean punishing the body or shutting out the world by force. It is the moment you notice a sound or a thought and do not follow it. A quiet room makes it easier. It is not a requirement to be undisturbed.",
    practiceHref: "/breathing?slug=bhramari",
    practiceLabel: "Try a few soft humming breaths",
  },
  {
    slug: "dharana",
    order: 6,
    name: "Dharana",
    iast: "dhāraṇā",
    devanagari: "धारणा",
    say: "dah-ruh-NAH",
    summary: "Holding attention in one place.",
    body: "Dhāraṇā is concentration: choosing one object — the breath, a word, a point in the body — and bringing attention back when it leaves. The leaving is part of it. The limb is the returning, not a perfectly still mind.",
    practiceHref: "/breathing?slug=ujjayi",
    practiceLabel: "Follow a quiet even breath",
  },
  {
    slug: "dhyana",
    order: 7,
    name: "Dhyana",
    iast: "dhyāna",
    devanagari: "ध्यान",
    say: "dhyah-nuh",
    summary: "Attention that stays, with less effort to put it back.",
    body: "Dhyāna is the word behind the English 'meditation' in this list. In the sūtra it is continuous attention, distinct from dhāraṇā, which is the effort of placing it. You cannot force the difference. A short, quiet sit is enough to study what the word points at. This app does not claim to produce it.",
    practiceHref: "/breathing?slug=box-breathing",
    practiceLabel: "Sit with a simple counted breath",
  },
  {
    slug: "samadhi",
    order: 8,
    name: "Samadhi",
    iast: "samādhi",
    devanagari: "समाधि",
    say: "suh-MAH-dee",
    summary: "Absorption, as the text describes it. Not a goal this app can award.",
    body: "Samādhi, in the Yoga Sūtra, is absorption: the sense of being the separate person who is concentrating thins out. Commentators describe several depths. None of them can be checked off in an app. Read the card, then rest. If the word is used to sell an experience, that is not what this page is doing.",
    practiceHref: "/asanas/savasana",
    practiceLabel: "Rest in Corpse Pose",
  },
];

const START_KEY = "sadhana.eightLimbs.start";

export function limbForDay(startIso: string, todayIso: string): EightLimb {
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const today = Date.parse(`${todayIso}T00:00:00Z`);
  const diff = Number.isFinite(start) && Number.isFinite(today) ? Math.floor((today - start) / 86400000) : 0;
  const index = ((diff % EIGHT_LIMBS.length) + EIGHT_LIMBS.length) % EIGHT_LIMBS.length;
  return EIGHT_LIMBS[index]!;
}

export function readEightLimbsStart(todayIso: string): string {
  try {
    const saved = localStorage.getItem(START_KEY);
    if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) return saved;
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(START_KEY, todayIso);
  } catch {
    /* ignore */
  }
  return todayIso;
}

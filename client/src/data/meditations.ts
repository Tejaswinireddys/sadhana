/**
 * Sits and yoga nidra.
 *
 * The words are an AI-written script, not a teacher recording and not a
 * published yoga-nidra text. Captions show every line. Spoken voice uses the
 * same optional computer voice as the rest of the app.
 */
import type { MeditationCue } from "@/lib/meditationClock";

export const AI_SCRIPT_NOTE =
  "This script is AI-written. It is not a recording of a teacher.";

export type MeditationPractice = {
  slug: string;
  name: string;
  minutes: number;
  summary: string;
  kind: "guided" | "nidra" | "timer";
  cues: MeditationCue[];
  /** 0 rings only at the start and the end. */
  bellEverySeconds: number;
  safety: string;
  script: "ai-written" | "none";
};

function at(pairs: [number, string][]): MeditationCue[] {
  return pairs.map(([t, text]) => ({ t, text }));
}

export const MEDITATIONS: MeditationPractice[] = [
  {
    slug: "body-scan",
    name: "Body scan",
    minutes: 10,
    kind: "guided",
    summary: "Move your attention through the body, one region at a time. Nothing has to feel a particular way.",
    bellEverySeconds: 0,
    script: "ai-written",
    safety:
      "Sit or lie down somewhere you will not need to drive or supervise anyone. If a region feels painful or overwhelming, skip it and come back to the breath, or stop and open your eyes.",
    cues: at([
      [0, "Settle in. You can sit or lie down. Let the eyes close, or leave them soft."],
      [45, "Feel the weight of the body on the chair or the floor. You do not have to change it."],
      [90, "Bring attention to the feet. Toes, soles, heels. If you feel little, that is fine."],
      [150, "Lower legs, knees, and thighs. Notice contact, temperature, or nothing in particular."],
      [210, "Hips and the seat of the body. Let the next exhale be a little longer, only if that is easy."],
      [270, "Belly and lower back. No need to breathe in any special way. Just notice."],
      [330, "Chest and upper back. If the mind has wandered, start again at the next place."],
      [390, "Hands, arms, and shoulders. You can unclench the jaw if you find it tight."],
      [450, "Face and the top of the head. Soften the tongue."],
      [510, "Feel the body as one shape for a few breaths."],
      [570, "Open the eyes when you are ready. The sit is ending."],
      [600, "Done. Sit still for a moment before you stand."],
    ]),
  },
  {
    slug: "breath-awareness",
    name: "Breath awareness",
    minutes: 8,
    kind: "guided",
    summary: "Watch the breath you already have. This does not ask you to hold it or lengthen it.",
    bellEverySeconds: 0,
    script: "ai-written",
    safety: "If watching the breath makes you anxious, open your eyes and look at something still, or stop. This is not a breathing exercise with a count.",
    cues: at([
      [0, "Sit in a way you can stay with for a few minutes. Eyes closed or lowered."],
      [40, "Notice the breath at the nostrils, or at the belly. Pick one place and stay there."],
      [100, "You do not need to deepen it. Follow the inhale, then the exhale."],
      [170, "When you notice you were thinking, that is the practice. Come back to the next breath."],
      [240, "Stay with one more minute of ordinary breathing. No count."],
      [320, "If the breath feels short, that is information, not a problem to fix."],
      [400, "Let the attention widen to the whole body sitting here."],
      [460, "Open the eyes when you like. The sit is ending."],
      [480, "Done."],
    ]),
  },
  {
    slug: "loving-kindness",
    name: "Loving-kindness",
    minutes: 10,
    kind: "guided",
    summary: "A few traditional phrases, offered quietly. Skip any line that does not feel true.",
    bellEverySeconds: 0,
    script: "ai-written",
    safety:
      "These phrases are a practice, not a mood you have to produce. If they feel painful, drop them and rest in silence, or stop. This is not a treatment.",
    cues: at([
      [0, "Sit comfortably. You will hear a few short phrases. You can repeat them silently, or just listen."],
      [40, "For yourself, if you want: may I be safe. May I be at ease."],
      [110, "Again, only if it is welcome: may I be kind to myself today."],
      [180, "Think of someone you care about. May you be safe. May you be at ease."],
      [260, "Stay with that person for a few breaths. There is nothing else to do."],
      [330, "If you want, a person you find difficult. If not, stay with the person you care about. May you be at ease."],
      [420, "Widen it, lightly: may people I meet today be at ease. You do not have to picture everyone."],
      [500, "Let the phrases go. Feel the body sitting."],
      [560, "Open the eyes when you are ready."],
      [600, "Done."],
    ]),
  },
  {
    slug: "nidra-short",
    name: "Yoga nidra, short",
    minutes: 15,
    kind: "nidra",
    summary: "A guided rest. You lie down and stay awake enough to hear the words. It is not sleep training.",
    bellEverySeconds: 0,
    script: "ai-written",
    safety:
      "Lie down somewhere safe. Do not do this while driving, in water, or where you must stay alert. If the body attention feels like too much, open your eyes and stop. This is not therapy and not a medical practice.",
    cues: at([
      [0, "Lie on your back if that is comfortable, or on your side. Cover yourself if you are cool."],
      [40, "You can move at any time. Hearing the words is enough. You do not have to stay perfectly still."],
      [90, "If you want a quiet intention for this rest, name it once, simply. If not, skip it."],
      [150, "Right hand. Right arm. Right shoulder."],
      [210, "Left hand. Left arm. Left shoulder."],
      [270, "The face. The mouth. The eyes, resting."],
      [340, "Chest. Belly. The back of the body on the floor."],
      [410, "Right hip, leg, and foot. Left hip, leg, and foot."],
      [490, "The whole body, heavy and supported."],
      [560, "Notice the breath moving without changing it."],
      [640, "Picture a place that feels ordinary and calm. Stay there, or leave it if an image does not come."],
      [730, "Come back to the room. Feel the floor. Hear a sound nearby."],
      [820, "Move the fingers and toes. Open the eyes when you are ready. Roll to one side before you sit up."],
      [900, "The rest is over. Take your time standing."],
    ]),
  },
  {
    slug: "nidra-long",
    name: "Yoga nidra, long",
    minutes: 30,
    kind: "nidra",
    summary: "A longer guided rest with the same shape: settle, an optional intention, a slow pass through the body, breath, an image, and a return.",
    bellEverySeconds: 0,
    script: "ai-written",
    safety:
      "Set aside the half hour. Lie somewhere safe, not in a bath and not where you might fall. Open your eyes and stop if you feel distressed. This script is a rest, not a treatment and not a promise of sleep.",
    cues: at([
      [0, "Lie down. Support the head or the knees if you like. Eyes closed if that feels all right."],
      [50, "You will be here for about half an hour. You can shift, or stop, whenever you want."],
      [110, "Notice the points where the body meets the floor."],
      [180, "An intention, once, in a few words — or none. Either is complete."],
      [250, "Right thumb, fingers, palm, wrist."],
      [320, "Right forearm, elbow, upper arm, shoulder."],
      [390, "Left thumb, fingers, palm, wrist, forearm, elbow, upper arm, shoulder."],
      [470, "The face: forehead, eyes, cheeks, jaw, mouth."],
      [540, "Throat, chest, and the shoulder blades."],
      [620, "Upper belly, navel, lower belly."],
      [700, "The whole back, from shoulders to hips."],
      [780, "Right hip, thigh, knee, shin, ankle, foot."],
      [860, "Left hip, thigh, knee, shin, ankle, foot."],
      [940, "Both legs together. Both arms. The whole body."],
      [1040, "Rest here. There is no next task inside this pause."],
      [1160, "Notice the breath in the nostrils. Do not count it."],
      [1280, "Count eight breaths if you want a thread to follow, then stop counting."],
      [1400, "A simple image: a still room, or a tree, or nothing. Leave it if it changes."],
      [1540, "Let the image go. Feel the body again, heavier or the same."],
      [1660, "Sounds in the room. The temperature of the air."],
      [1760, "Move the hands and feet. Bend the knees. Open the eyes. Come onto one side, then sit up slowly."],
      [1800, "The rest is over. Stay seated until you feel ready to stand."],
    ]),
  },
];

export function meditationBySlug(slug: string): MeditationPractice | undefined {
  return MEDITATIONS.find((m) => m.slug === slug);
}

export const TIMER_CHOICES = [5, 10, 15, 20, 30] as const;
export const BELL_CHOICES = [
  { seconds: 0, label: "Start and end only" },
  { seconds: 60, label: "Every minute" },
  { seconds: 300, label: "Every 5 minutes" },
] as const;

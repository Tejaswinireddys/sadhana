import type { PathwayCare } from "@/data/content";

/**
 * Notes for the programs that are easy to mistake for treatment.
 * Attached in content.ts. The words say what to skip and when to stop.
 * They do not say the week will fix anything.
 */
export const PATHWAY_CARE: Record<string, PathwayCare> = {
  "gentle-back-care": {
    avoid:
      "Skip this week if back pain is new, severe, or runs down a leg, or if you have been told not to move your spine. A chair is fine if the floor is not.",
    stopIf:
      "Stop if pain increases, if you feel numbness, or if a pose makes you hold your breath. A low bridge is optional. Leaving it out is a complete practice.",
  },
  "stress-release-week": {
    avoid:
      "This is a quiet week of shapes, not support for a mental health crisis. If you are in danger or cannot cope, contact local emergency or crisis services.",
    stopIf:
      "Stop if you feel dizzy, panicky, or more upset than when you started. Legs up the wall is optional. Rest on your side instead if it does not suit you.",
  },
  "chair-limited-mobility": {
    avoid:
      "Use a sturdy chair without wheels. This is ordinary movement while seated or standing at a wall. It is not a falls program, balance therapy, or care for aging.",
    stopIf:
      "Stop if you feel dizzy, chest pain, or unsteady on your feet. Stay seated. Skip any shape you cannot do without holding your breath.",
  },
  "prenatal-gentle-week": {
    avoid:
      "Do not start because an app suggested it. Bleeding, chest pain, headache, dizziness, contractions, or reduced fetal movement are reasons to stop and contact your provider, not to continue the week.",
    stopIf:
      "Stop the pose if you feel pressure, pain, shortness of breath, or you need to hold your breath. Side-lying rest can replace anything else that day.",
    providerNote:
      "Check with your prenatal care provider before you start, and again if anything about the pregnancy changes. This week is not prenatal care.",
    trimesters: {
      first:
        "Nausea and tiredness are common reasons to keep the day short or take the rest day early. Skip anything that makes you hold your breath.",
      second:
        "Avoid long holds lying flat on your back if that feels uncomfortable. Use the side-lying rest. Deep twists are not in this week; do not add them.",
      third:
        "Skip the wall squat, goddess, and any standing pose that feels like pressure in the pelvis. Side-lying rest is enough for that day.",
    },
  },
  "7-day-sleep-wind-down": {
    avoid:
      "An evening practice will not treat insomnia. If sleep is a medical problem, talk with a clinician. Do not practice in a way that leaves you groggy and then driving.",
    stopIf: "Stop if you feel dizzy sitting up. Roll to your side and wait. Getting into bed is a fine way to end the day early.",
  },
};

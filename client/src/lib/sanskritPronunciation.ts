/**
 * Sanskrit pronunciation helpers — transliteration hints for asana names.
 * Audio pronunciation can reuse pose narration where available; IPA is educational.
 */
export type SanskritPronunciation = {
  transliteration: string;
  approx: string;
  tip: string;
};

/** Lightweight map for common catalog poses; falls back to slug-based hint. */
const KNOWN: Record<string, SanskritPronunciation> = {
  tadasana: {
    transliteration: "tāḍāsana",
    approx: "tah-DAHS-uh-nuh",
    tip: "Long ā in tā; soft ḍ.",
  },
  balasana: {
    transliteration: "bālāsana",
    approx: "bah-LAHS-uh-nuh",
    tip: "Bā as in “bah”; stress on lā.",
  },
  "adho-mukha-svanasana": {
    transliteration: "adho mukha śvānāsana",
    approx: "AH-doh MOO-kuh shvah-NAHS-uh-nuh",
    tip: "Śvā sounds like “shvah”.",
  },
  savasana: {
    transliteration: "śavāsana",
    approx: "shuh-VAHS-uh-nuh",
    tip: "Also spelled shavasana; śa like “sha”.",
  },
  virabhadrasana: {
    transliteration: "vīrabhadrāsana",
    approx: "veer-uh-buh-DRAHS-uh-nuh",
    tip: "Long ī in vīra (hero).",
  },
  "virabhadrasana-i": {
    transliteration: "vīrabhadrāsana I",
    approx: "veer-uh-buh-DRAHS-uh-nuh",
    tip: "Warrior I — same root as Virabhadra.",
  },
  "virabhadrasana-ii": {
    transliteration: "vīrabhadrāsana II",
    approx: "veer-uh-buh-DRAHS-uh-nuh",
    tip: "Warrior II — hips open to the side.",
  },
  vrksasana: {
    transliteration: "vṛkṣāsana",
    approx: "vrik-SHAHS-uh-nuh",
    tip: "Vṛkṣa = tree; ṣ like “sh”.",
  },
  bhujangasana: {
    transliteration: "bhujaṅgāsana",
    approx: "boo-juhn-GAHS-uh-nuh",
    tip: "Cobra — soft “ng” in aṅga.",
  },
  sukhasana: {
    transliteration: "sukhāsana",
    approx: "soo-KHAHS-uh-nuh",
    tip: "Sukha = ease; aspirated kh.",
  },
};

export function pronunciationFor(slug: string, sanskrit?: string | null): SanskritPronunciation {
  if (KNOWN[slug]) return KNOWN[slug];
  const base = sanskrit?.trim() || slug.replace(/-/g, " ");
  return {
    transliteration: base,
    approx: base.toLowerCase(),
    tip: "Say each syllable evenly; long vowels (ā ī ū) are held slightly longer.",
  };
}

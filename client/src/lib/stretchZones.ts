/**
 * Body-region copy for "You'll feel this in…". Placeholder triplets
 * ("Primary tissues" / "Breath" / "Support") are replaced with pose-specific
 * regions derived from the catalog entry.
 */
import type { Category, StretchZone } from "@/data/content";

export const GENERIC_STRETCH_REGIONS = ["Primary tissues", "Breath", "Support"] as const;

export function isGenericStretchRegion(region: string): boolean {
  return GENERIC_STRETCH_REGIONS.some((g) => g.toLowerCase() === region.trim().toLowerCase());
}

export function isGenericStretchZones(zones: StretchZone[] | undefined): boolean {
  if (!zones || zones.length === 0) return true;
  return zones.every((z) => isGenericStretchRegion(z.region));
}

type StretchSource = {
  slug: string;
  english: string;
  category: Category;
  summary: string;
  benefits: string[];
};

const AUTHORED: Record<string, StretchZone[]> = {
  "supported-fish-block": [
    { region: "Chest & collarbones", sensation: "Soft opening over the block", intensity: "medium", primary: true },
    { region: "Upper back", sensation: "Supported arch without effort", intensity: "medium", primary: true },
    { region: "Throat & neck", sensation: "Long and easy — head stays supported", intensity: "low", primary: false },
  ],
  "prenatal-side-angle": [
    { region: "Front thigh", sensation: "Steady strength in the shorter stance", intensity: "medium", primary: true },
    { region: "Side waist", sensation: "Length without compressing the belly", intensity: "medium", primary: true },
    { region: "Shoulders & chest", sensation: "Top arm reaching, chest staying open", intensity: "low", primary: false },
  ],
  "prenatal-thread-needle": [
    { region: "Shoulders", sensation: "The threaded arm rests and releases", intensity: "medium", primary: true },
    { region: "Upper back", sensation: "Gentle twist without belly compression", intensity: "medium", primary: true },
    { region: "Hips & knees", sensation: "Wide tabletop base supporting the belly", intensity: "low", primary: false },
  ],
};

const CATEGORY_ZONES: Record<Category, StretchZone[]> = {
  Standing: [
    { region: "Legs", sensation: "Strength through the standing line", intensity: "medium", primary: true },
    { region: "Hips", sensation: "Stable and open without forcing", intensity: "medium", primary: true },
    { region: "Spine", sensation: "Length from the crown to the heels", intensity: "low", primary: false },
  ],
  Seated: [
    { region: "Hips", sensation: "Settling into the seat", intensity: "medium", primary: true },
    { region: "Spine", sensation: "Lengthening tall from the sit bones", intensity: "medium", primary: true },
    { region: "Shoulders", sensation: "Softening away from the ears", intensity: "low", primary: false },
  ],
  "Forward Bends": [
    { region: "Hamstrings", sensation: "Long pull down the back of the legs", intensity: "strong", primary: true },
    { region: "Low back", sensation: "Hinging from the hips, not rounding hard", intensity: "medium", primary: true },
    { region: "Calves", sensation: "Easing as the fold deepens", intensity: "low", primary: false },
  ],
  Backbends: [
    { region: "Chest", sensation: "Opening through the front body", intensity: "medium", primary: true },
    { region: "Hip flexors", sensation: "Length across the front of the hips", intensity: "medium", primary: true },
    { region: "Spine", sensation: "Even extension, no pinching", intensity: "medium", primary: false },
  ],
  "Hip Openers": [
    { region: "Hips", sensation: "Opening through the hip complex", intensity: "medium", primary: true },
    { region: "Inner thighs", sensation: "Space without forcing the knees", intensity: "medium", primary: true },
    { region: "Low back", sensation: "Staying easy as the hips settle", intensity: "low", primary: false },
  ],
  Core: [
    { region: "Core", sensation: "Low belly drawing in, ribs heavy", intensity: "strong", primary: true },
    { region: "Low back", sensation: "Supported, not arched or dumped", intensity: "medium", primary: true },
    { region: "Hip flexors", sensation: "Working without gripping", intensity: "low", primary: false },
  ],
  "Supine/Prone": [
    { region: "Spine", sensation: "Supported length on the floor", intensity: "medium", primary: true },
    { region: "Hips", sensation: "Heavy and unforced", intensity: "medium", primary: true },
    { region: "Shoulders", sensation: "Softening into the mat", intensity: "low", primary: false },
  ],
  Inversions: [
    { region: "Shoulders", sensation: "Foundation carrying the weight", intensity: "strong", primary: true },
    { region: "Core", sensation: "Lifting rather than dumping", intensity: "medium", primary: true },
    { region: "Wrists & hands", sensation: "Pressing the whole palm", intensity: "medium", primary: false },
  ],
  Restorative: [
    { region: "Nervous system", sensation: "Softening into the support", intensity: "low", primary: true },
    { region: "Hips", sensation: "Heavy and unforced", intensity: "low", primary: true },
    { region: "Jaw & face", sensation: "Nothing to hold", intensity: "low", primary: false },
  ],
};

type Rule = { test: RegExp; zones: StretchZone[] };

const RULES: Rule[] = [
  {
    test: /fish|chest opener|heart|anahata|melting heart/,
    zones: [
      { region: "Chest", sensation: "Opening across the collarbones", intensity: "medium", primary: true },
      { region: "Upper back", sensation: "Supported without straining the neck", intensity: "medium", primary: true },
      { region: "Shoulders", sensation: "Softening toward the floor", intensity: "low", primary: false },
    ],
  },
  {
    test: /thread|eagle arm|shoulder|strap-shoulder/,
    zones: [
      { region: "Shoulders", sensation: "Opening or wrapping without a shrug", intensity: "medium", primary: true },
      { region: "Upper back", sensation: "Space between the shoulder blades", intensity: "medium", primary: true },
      { region: "Neck", sensation: "Long and easy", intensity: "low", primary: false },
    ],
  },
  {
    test: /side angle|side-bend|side curl|side-lying/,
    zones: [
      { region: "Side waist", sensation: "Lengthening along the top ribs", intensity: "medium", primary: true },
      { region: "Legs", sensation: "Steady stance or support", intensity: "medium", primary: true },
      { region: "Shoulders", sensation: "Reaching without collapsing", intensity: "low", primary: false },
    ],
  },
  {
    test: /hamstring|forward|fold|rdl|hinge/,
    zones: [
      { region: "Hamstrings", sensation: "Honest length without bouncing", intensity: "strong", primary: true },
      { region: "Calves", sensation: "Easing as the hinge deepens", intensity: "medium", primary: true },
      { region: "Low back", sensation: "Protected by a long spine", intensity: "low", primary: false },
    ],
  },
  {
    test: /hip|pigeon|butterfly|goddess|malasana|squat|ninety|figure.four|adductor/,
    zones: [
      { region: "Hips", sensation: "Opening through the hip complex", intensity: "medium", primary: true },
      { region: "Inner thighs", sensation: "Space without forcing the knees", intensity: "medium", primary: true },
      { region: "Low back", sensation: "Staying easy as the hips settle", intensity: "low", primary: false },
    ],
  },
  {
    test: /calf|wall-calf/,
    zones: [
      { region: "Calves", sensation: "Steady stretch toward the wall", intensity: "medium", primary: true },
      { region: "Achilles", sensation: "Gentle length, heel easing down", intensity: "medium", primary: true },
      { region: "Ankles", sensation: "Grounding through the standing foot", intensity: "low", primary: false },
    ],
  },
  {
    test: /dead.bug|core|plank/,
    zones: [
      { region: "Core", sensation: "Low belly drawing in, ribs heavy", intensity: "strong", primary: true },
      { region: "Low back", sensation: "Glued to the mat, not arched", intensity: "medium", primary: true },
      { region: "Hip flexors", sensation: "Working without gripping", intensity: "low", primary: false },
    ],
  },
  {
    test: /wall.angel|wall/,
    zones: [
      { region: "Upper back", sensation: "Ribs staying on the wall", intensity: "medium", primary: true },
      { region: "Shoulders", sensation: "Arms seeking the wall without shrugging", intensity: "medium", primary: true },
      { region: "Neck", sensation: "Chin slightly tucked", intensity: "low", primary: false },
    ],
  },
  {
    test: /legs.up|elevated|bolster|viparita/,
    zones: [
      { region: "Legs", sensation: "Heavy and draining toward the hips", intensity: "low", primary: true },
      { region: "Low back", sensation: "Supported and quiet", intensity: "low", primary: true },
      { region: "Nervous system", sensation: "Softening into rest", intensity: "low", primary: false },
    ],
  },
  {
    test: /tree|balance/,
    zones: [
      { region: "Standing ankle", sensation: "Grounding through the foot", intensity: "medium", primary: true },
      { region: "Standing hip", sensation: "Level and steady", intensity: "medium", primary: true },
      { region: "Core", sensation: "Quiet engagement for balance", intensity: "low", primary: false },
    ],
  },
  {
    test: /twist/,
    zones: [
      { region: "Spine", sensation: "Open rotation, not a squeeze", intensity: "medium", primary: true },
      { region: "Shoulders", sensation: "The wrapping arm stays easy", intensity: "medium", primary: true },
      { region: "Belly", sensation: "Soft, especially in pregnancy variations", intensity: "low", primary: false },
    ],
  },
];

function haystack(asana: StretchSource): string {
  return `${asana.slug} ${asana.english} ${asana.summary} ${asana.benefits.join(" ")}`.toLowerCase();
}

export function deriveStretchZones(asana: StretchSource): StretchZone[] {
  const authored = AUTHORED[asana.slug];
  if (authored) return authored;
  const hay = haystack(asana);
  for (const rule of RULES) {
    if (rule.test.test(hay)) return rule.zones;
  }
  return CATEGORY_ZONES[asana.category] ?? CATEGORY_ZONES.Restorative;
}

export function resolveStretchZones(
  asana: StretchSource,
  authored: StretchZone[] | undefined,
): StretchZone[] {
  if (authored && !isGenericStretchZones(authored)) return authored;
  return deriveStretchZones(asana);
}

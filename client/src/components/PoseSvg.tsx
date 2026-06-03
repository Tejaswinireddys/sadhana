// Hand-authored stick-figure yoga pose illustrations.
// Each pose is a function returning JSX path/line elements drawn on a 100x100 viewBox.
// Single-color line art using currentColor. Ground line at y=88.

type PoseProps = {
  pose: string;
  className?: string;
  size?: number;
};

const G = 88; // ground line y

function Ground() {
  return <line x1="8" y1={G} x2="92" y2={G} strokeWidth={1.5} opacity={0.35} />;
}

// Each entry returns the figure (without ground).
const POSES: Record<string, () => JSX.Element> = {
  // Upright standing, arms at sides
  mountain: () => (
    <>
      <circle cx="50" cy="20" r="7" />
      <line x1="50" y1="27" x2="50" y2="60" />
      <path d="M50 32 L40 52 M50 32 L60 52" />
      <path d="M50 60 L43 88 M50 60 L57 88" />
    </>
  ),
  // Inverted V
  "down-dog": () => (
    <>
      <path d="M16 86 L50 34 L84 86" />
      <circle cx="48" cy="44" r="6" />
      <path d="M50 40 L50 34" />
    </>
  ),
  // One foot on opposite inner thigh, hands overhead
  tree: () => (
    <>
      <circle cx="50" cy="18" r="7" />
      <line x1="50" y1="25" x2="50" y2="58" />
      <path d="M50 30 L40 14 M50 30 L60 14" />
      <path d="M50 58 L50 88" />
      <path d="M50 58 L36 64 L46 72" />
    </>
  ),
  // Lunge, arms out (Warrior II)
  "warrior-2": () => (
    <>
      <circle cx="46" cy="24" r="6.5" />
      <line x1="46" y1="30" x2="48" y2="56" />
      <path d="M18 44 L48 38 L80 44" />
      <path d="M48 56 L22 88 M48 56 L74 88" />
    </>
  ),
  // Front knee bent, arms up (Warrior I)
  "warrior-1": () => (
    <>
      <circle cx="44" cy="22" r="6.5" />
      <line x1="44" y1="28" x2="48" y2="56" />
      <path d="M44 34 L36 12 M44 34 L52 12" />
      <path d="M48 56 L30 88 M48 56 L74 70 L74 88" />
    </>
  ),
  // Side bend, one arm down to shin one arm up (Triangle)
  triangle: () => (
    <>
      <circle cx="70" cy="26" r="6.5" />
      <path d="M70 32 L40 70" />
      <path d="M40 70 L36 88 M40 70 L72 88" />
      <path d="M55 51 L55 24 M55 51 L40 70" />
    </>
  ),
  // Forward fold, bent in half hands to floor
  "forward-fold": () => (
    <>
      <line x1="50" y1="88" x2="50" y2="44" />
      <circle cx="50" cy="80" r="6.5" />
      <path d="M50 44 L50 86" />
      <path d="M50 50 L40 84 M50 50 L60 84" />
    </>
  ),
  // Standing wide-leg pyramid (one leg forward, fold over front leg)
  pyramid: () => (
    <>
      <circle cx="64" cy="60" r="6" />
      <path d="M40 30 L40 88" />
      <path d="M40 30 L70 56" />
      <path d="M40 30 L70 88" />
      <path d="M40 34 L58 60 M40 34 L52 64" />
    </>
  ),
  // Standing splits: standing leg down, other leg up high
  "standing-split": () => (
    <>
      <circle cx="40" cy="64" r="6" />
      <path d="M40 70 L40 88" />
      <path d="M40 70 L72 22" />
      <path d="M40 62 L30 78 M40 62 L34 80" />
    </>
  ),
  // Chair pose: knees bent, arms up, sitting back
  chair: () => (
    <>
      <circle cx="48" cy="22" r="6.5" />
      <line x1="48" y1="28" x2="52" y2="52" />
      <path d="M48 32 L42 12 M48 32 L54 12" />
      <path d="M52 52 L40 66 L40 88" />
    </>
  ),
  // Seated, legs crossed (easy / lotus)
  seated: () => (
    <>
      <circle cx="50" cy="34" r="7" />
      <line x1="50" y1="41" x2="50" y2="64" />
      <path d="M50 46 L38 60 M50 46 L62 60" />
      <path d="M50 64 L30 80 L50 76 L70 80 Z" />
    </>
  ),
  // Seated forward bend, reaching over straight legs
  "seated-fold": () => (
    <>
      <line x1="20" y1={G} x2="78" y2={G} strokeWidth={0} />
      <path d="M24 84 L78 84" />
      <circle cx="50" cy="70" r="6" />
      <path d="M30 84 L50 70 L78 84" />
      <path d="M40 72 L78 84" />
    </>
  ),
  // Boat pose: V shape balancing on sit bones
  boat: () => (
    <>
      <circle cx="34" cy="46" r="6.5" />
      <path d="M34 52 L58 78" />
      <path d="M58 78 L82 40" />
      <path d="M40 54 L66 46" />
    </>
  ),
  // Butterfly: seated, soles together, knees out
  butterfly: () => (
    <>
      <circle cx="50" cy="38" r="7" />
      <line x1="50" y1="45" x2="50" y2="66" />
      <path d="M50 66 L26 80 L50 72 L74 80 Z" />
      <path d="M50 50 L34 70 M50 50 L66 70" />
    </>
  ),
  // Cobra: lying on belly, chest lifted back arch
  cobra: () => (
    <>
      <path d="M14 84 L48 80 L66 56" />
      <circle cx="70" cy="50" r="6" />
      <path d="M62 60 L66 84" />
    </>
  ),
  // Bridge: lying with hips up, knees bent
  bridge: () => (
    <>
      <path d="M16 80 L34 80" />
      <path d="M16 80 L16 56" />
      <path d="M34 80 L52 52 L70 52" />
      <path d="M70 52 L84 80" />
      <circle cx="16" cy="50" r="5.5" />
    </>
  ),
  // Wheel / full backbend: hands & feet down, belly arched up
  wheel: () => (
    <>
      <path d="M16 84 L24 84" />
      <path d="M84 84 L76 84" />
      <path d="M24 84 C24 44 76 44 76 84" />
      <path d="M24 84 L40 60 M76 84 L60 60" />
      <circle cx="24" cy="84" r="0.1" />
    </>
  ),
  // Camel: kneeling backbend
  camel: () => (
    <>
      <path d="M40 88 L40 64" />
      <path d="M40 64 C40 48 64 46 64 38" />
      <circle cx="66" cy="32" r="6" />
      <path d="M48 56 L62 70" />
    </>
  ),
  // Child's pose: curled forward kneeling
  child: () => (
    <>
      <path d="M20 84 L72 84" />
      <path d="M30 84 L52 70 L72 76" />
      <circle cx="28" cy="80" r="6" />
      <path d="M40 76 L66 84" />
    </>
  ),
  // Pigeon: front leg bent, back leg extended
  pigeon: () => (
    <>
      <circle cx="40" cy="48" r="6.5" />
      <line x1="40" y1="54" x2="44" y2="74" />
      <path d="M44 74 L22 82 L40 76" />
      <path d="M44 74 L80 86" />
      <path d="M40 58 L30 70 M40 58 L50 70" />
    </>
  ),
  // Low lunge: back knee down, front knee bent, arms up
  "low-lunge": () => (
    <>
      <circle cx="46" cy="24" r="6.5" />
      <line x1="46" y1="30" x2="50" y2="54" />
      <path d="M46 34 L40 14 M46 34 L52 14" />
      <path d="M50 54 L32 70 L32 86" />
      <path d="M50 54 L74 80 L86 84" />
    </>
  ),
  // Lizard: deep lunge, forearms down
  lizard: () => (
    <>
      <circle cx="34" cy="50" r="6" />
      <path d="M34 56 L52 66" />
      <path d="M52 66 L40 80 L40 86" />
      <path d="M52 66 L84 84" />
      <path d="M30 64 L48 70" />
    </>
  ),
  // Half split (Ardha Hanumanasana): one leg extended forward, sit back
  "half-split": () => (
    <>
      <circle cx="36" cy="42" r="6.5" />
      <line x1="36" y1="48" x2="42" y2="66" />
      <path d="M42 66 L26 82 L26 86" />
      <path d="M42 66 L84 84" />
      <path d="M40 56 L80 80" />
    </>
  ),
  // Full split (Hanumanasana): legs in a straight line
  "full-split": () => (
    <>
      <circle cx="50" cy="40" r="6.5" />
      <line x1="50" y1="46" x2="50" y2="68" />
      <path d="M16 84 L50 68 L84 84" />
      <path d="M50 50 L40 38 M50 50 L60 38" />
    </>
  ),
  // Couch stretch: kneeling, back foot up against wall, torso upright
  "couch-stretch": () => (
    <>
      <line x1="84" y1="20" x2="84" y2="86" strokeWidth={1.5} opacity={0.4} />
      <circle cx="40" cy="30" r="6.5" />
      <line x1="40" y1="36" x2="44" y2="58" />
      <path d="M44 58 L30 74 L30 86" />
      <path d="M44 58 L72 72 L84 56" />
      <path d="M40 42 L34 56 M40 42 L48 56" />
    </>
  ),
  // Cat: tabletop spine rounded up
  cat: () => (
    <>
      <path d="M24 86 L24 64" />
      <path d="M70 86 L70 64" />
      <path d="M24 64 C30 48 64 48 70 64" />
      <circle cx="22" cy="60" r="5" />
    </>
  ),
  // Cow: tabletop spine dipped down
  cow: () => (
    <>
      <path d="M24 86 L24 60" />
      <path d="M70 86 L70 60" />
      <path d="M24 60 C36 76 58 76 70 60" />
      <circle cx="20" cy="54" r="5" />
    </>
  ),
  // Plank
  plank: () => (
    <>
      <path d="M76 78 L24 60" />
      <circle cx="80" cy="56" r="6" />
      <path d="M30 62 L24 86 M70 75 L68 86" />
      <path d="M76 78 L80 62" />
    </>
  ),
  // Headstand / inversion (sirsasana)
  headstand: () => (
    <>
      <circle cx="50" cy="78" r="6.5" />
      <path d="M50 72 L50 30" />
      <path d="M50 70 L36 84 M50 70 L64 84" />
      <path d="M50 30 L44 12 M50 30 L56 12" />
    </>
  ),
  // Legs up the wall / restorative inversion
  "legs-up": () => (
    <>
      <path d="M16 80 L60 80" />
      <circle cx="22" cy="74" r="5.5" />
      <path d="M60 80 L62 24" />
      <path d="M60 80 L56 80" />
    </>
  ),
  // Corpse / savasana
  savasana: () => (
    <>
      <path d="M18 78 L82 78" />
      <circle cx="22" cy="72" r="5.5" />
      <path d="M30 78 L30 84 M40 78 L40 84" opacity={0.5} />
    </>
  ),
  // Reclined twist
  twist: () => (
    <>
      <path d="M20 80 L52 80" />
      <circle cx="24" cy="74" r="5.5" />
      <path d="M52 80 L74 64 L82 70" />
      <path d="M52 80 L50 64 L40 56" />
    </>
  ),
  // Half-moon balance
  "half-moon": () => (
    <>
      <circle cx="74" cy="30" r="6" />
      <path d="M74 36 L42 58" />
      <path d="M42 58 L24 78" />
      <path d="M42 58 L80 60" />
      <path d="M58 47 L58 22 M58 47 L42 58" />
    </>
  ),
};

export function PoseSvg({ pose, className, size = 120 }: PoseProps) {
  const draw = POSES[pose] || POSES.mountain;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {draw()}
      <Ground />
    </svg>
  );
}

export const POSE_KEYS = Object.keys(POSES);

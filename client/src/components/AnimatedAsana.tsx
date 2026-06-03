// AnimatedAsana — animated SVG yoga pose illustrations.
//
// Each pose is drawn on a 100x100 viewBox using single-color line art
// (currentColor). Animatable parts are wrapped in <g class="anim-*"> groups
// whose CSS keyframes live in index.css. Animations are calm, short, and
// loop infinitely. They are automatically disabled when the user prefers
// reduced motion or toggles motion off (html.motion-off) — see index.css.
//
// A `level` prop ("beginner" | "intermediate" | "advanced") swaps in modified
// line endpoints so the silhouette reflects a more supported (beginner) or
// deepest (advanced) expression of the pose.

import { asanaBySlug } from "@/data/content";

export type Level = "beginner" | "intermediate" | "advanced";

type Props = {
  slug: string;
  level?: Level;
  size?: number;
  className?: string;
};

const G = 88; // ground line y

function Ground() {
  return <line x1="8" y1={G} x2="92" y2={G} strokeWidth={1.5} opacity={0.35} />;
}

// A small support prop (block / wedge) drawn for beginner variations.
function Block({ x, y, w = 12, h = 7 }: { x: number; y: number; w?: number; h?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={1.5} strokeWidth={1.6} opacity={0.5} />;
}

// pose key -> function(level) => JSX
const POSES: Record<string, (level: Level) => JSX.Element> = {
  // Mountain — gentle breath rise of chest/arms
  mountain: () => (
    <>
      <g className="anim-breath">
        <circle cx="50" cy="20" r="7" />
        <line x1="50" y1="27" x2="50" y2="60" />
        <path d="M50 32 L40 52 M50 32 L60 52" />
      </g>
      <path d="M50 60 L43 88 M50 60 L57 88" />
    </>
  ),

  // Downward Dog — hips rock up & back
  "down-dog": () => (
    <g className="anim-rock">
      <path d="M16 86 L50 34 L84 86" />
      <circle cx="48" cy="44" r="6" />
      <path d="M50 40 L50 34" />
    </g>
  ),

  // Tree — small sway of the whole figure, balancing
  tree: () => (
    <g className="anim-sway">
      <circle cx="50" cy="18" r="7" />
      <line x1="50" y1="25" x2="50" y2="58" />
      <path d="M50 30 L40 14 M50 30 L60 14" />
      <path d="M50 58 L50 88" />
      <path d="M50 58 L36 64 L46 72" />
    </g>
  ),

  // Warrior II — arms slowly extending out then settling
  "warrior-2": () => (
    <>
      <circle cx="46" cy="24" r="6.5" />
      <line x1="46" y1="30" x2="48" y2="56" />
      <g className="anim-extend">
        <path d="M18 44 L48 38 L80 44" />
      </g>
      <path d="M48 56 L22 88 M48 56 L74 88" />
    </>
  ),

  // Warrior I — arms breathe upward
  "warrior-1": () => (
    <>
      <circle cx="44" cy="22" r="6.5" />
      <line x1="44" y1="28" x2="48" y2="56" />
      <g className="anim-rise">
        <path d="M44 34 L36 12 M44 34 L52 12" />
      </g>
      <path d="M48 56 L30 88 M48 56 L74 70 L74 88" />
    </>
  ),

  // Triangle — top arm gently lengthens; beginner rests hand on a block
  triangle: (level) => (
    <>
      <circle cx="70" cy="26" r="6.5" />
      <path d="M70 32 L40 70" />
      <path d="M40 70 L36 88 M40 70 L72 88" />
      <g className="anim-extend">
        <path d="M55 51 L55 24 M55 51 L40 70" />
      </g>
      {level === "beginner" && <Block x={32} y={76} />}
    </>
  ),

  // Standing Forward Fold — torso folds a few degrees; beginner has a wedge under heel
  "forward-fold": (level) => (
    <>
      <g className="anim-fold">
        <line x1="50" y1="44" x2="50" y2="86" />
        <circle cx="50" cy="80" r="6.5" />
        <path d="M50 50 L40 84 M50 50 L60 84" />
      </g>
      {level === "beginner" && <Block x={44} y={82} w={14} h={5} />}
    </>
  ),

  // Pyramid — fold over front leg; beginner blocks
  pyramid: (level) => (
    <>
      <circle cx="64" cy="60" r="6" />
      <path d="M40 30 L40 88" />
      <path d="M40 30 L70 56" />
      <path d="M40 30 L70 88" />
      <g className="anim-fold">
        <path d="M40 34 L58 60 M40 34 L52 64" />
      </g>
      {level === "beginner" && <Block x={58} y={66} />}
    </>
  ),

  "standing-split": () => (
    <g className="anim-sway">
      <circle cx="40" cy="64" r="6" />
      <path d="M40 70 L40 88" />
      <path d="M40 70 L72 22" />
      <path d="M40 62 L30 78 M40 62 L34 80" />
    </g>
  ),

  // Chair — sit deeper / arms breathe
  chair: () => (
    <>
      <circle cx="48" cy="22" r="6.5" />
      <line x1="48" y1="28" x2="52" y2="52" />
      <g className="anim-rise">
        <path d="M48 32 L42 12 M48 32 L54 12" />
      </g>
      <path d="M52 52 L40 66 L40 88" />
    </>
  ),

  // Seated — whole figure breathes
  seated: () => (
    <g className="anim-breath">
      <circle cx="50" cy="34" r="7" />
      <line x1="50" y1="41" x2="50" y2="64" />
      <path d="M50 46 L38 60 M50 46 L62 60" />
      <path d="M50 64 L30 80 L50 76 L70 80 Z" />
    </g>
  ),

  // Seated forward bend — torso folds; beginner uses a strap (line) to feet
  "seated-fold": (level) => (
    <>
      <path d="M24 84 L78 84" />
      <g className="anim-fold">
        <circle cx="50" cy="70" r="6" />
        <path d="M30 84 L50 70 L78 84" />
        <path d="M40 72 L78 84" />
      </g>
      {level === "beginner" && <path d="M46 70 L78 84" strokeDasharray="3 3" opacity={0.5} />}
    </>
  ),

  // Boat — balance, gentle sway
  boat: () => (
    <g className="anim-sway">
      <circle cx="34" cy="46" r="6.5" />
      <path d="M34 52 L58 78" />
      <path d="M58 78 L82 40" />
      <path d="M40 54 L66 46" />
    </g>
  ),

  // Butterfly — knees breathe open
  butterfly: () => (
    <>
      <circle cx="50" cy="38" r="7" />
      <line x1="50" y1="45" x2="50" y2="66" />
      <g className="anim-extend">
        <path d="M50 66 L26 80 L50 72 L74 80 Z" />
      </g>
      <path d="M50 50 L34 70 M50 50 L66 70" />
    </>
  ),

  // Cobra — chest rises on inhale, settles on exhale
  cobra: (level) => (
    <>
      <path d="M14 84 L48 80" />
      <g className="anim-rise">
        <path d="M48 80 L66 56" />
        <circle cx="70" cy="50" r="6" />
        <path d="M62 60 L66 84" />
      </g>
      {level === "beginner" && <path d="M48 80 L60 66" opacity={0.4} strokeDasharray="2 3" />}
    </>
  ),

  // Bridge — hips lift up then ease down
  bridge: () => (
    <g className="anim-lift">
      <path d="M16 80 L34 80" />
      <path d="M16 80 L16 56" />
      <path d="M34 80 L52 52 L70 52" />
      <path d="M70 52 L84 80" />
      <circle cx="16" cy="50" r="5.5" />
    </g>
  ),

  // Wheel — belly lifts
  wheel: () => (
    <g className="anim-lift">
      <path d="M16 84 L24 84" />
      <path d="M84 84 L76 84" />
      <path d="M24 84 C24 44 76 44 76 84" />
      <path d="M24 84 L40 60 M76 84 L60 60" />
    </g>
  ),

  // Camel — chest opens with breath
  camel: () => (
    <g className="anim-rise">
      <path d="M40 88 L40 64" />
      <path d="M40 64 C40 48 64 46 64 38" />
      <circle cx="66" cy="32" r="6" />
      <path d="M48 56 L62 70" />
    </g>
  ),

  // Child's pose — soft breath swell across the back
  child: () => (
    <g className="anim-breath">
      <path d="M20 84 L72 84" />
      <path d="M30 84 L52 70 L72 76" />
      <circle cx="28" cy="80" r="6" />
      <path d="M40 76 L66 84" />
    </g>
  ),

  // Pigeon — front hip settles; beginner has a block under hip
  pigeon: (level) => (
    <>
      <g className="anim-breath">
        <circle cx="40" cy="48" r="6.5" />
        <line x1="40" y1="54" x2="44" y2="74" />
        <path d="M40 58 L30 70 M40 58 L50 70" />
      </g>
      <path d="M44 74 L22 82 L40 76" />
      <path d="M44 74 L80 86" />
      {level === "beginner" && <Block x={36} y={78} w={10} h={6} />}
    </>
  ),

  // Low lunge — hips breathe forward
  "low-lunge": () => (
    <>
      <circle cx="46" cy="24" r="6.5" />
      <line x1="46" y1="30" x2="50" y2="54" />
      <g className="anim-rise">
        <path d="M46 34 L40 14 M46 34 L52 14" />
      </g>
      <path d="M50 54 L32 70 L32 86" />
      <path d="M50 54 L74 80 L86 84" />
    </>
  ),

  // Lizard — hips sink with breath
  lizard: (level) => (
    <>
      <circle cx="34" cy="50" r="6" />
      <g className="anim-lift">
        <path d="M34 56 L52 66" />
        <path d="M52 66 L40 80 L40 86" />
        <path d="M52 66 L84 84" />
      </g>
      {level === "beginner" && <Block x={44} y={70} w={12} h={6} />}
    </>
  ),

  // Half split — legs slowly widening into extension; beginner blocks
  "half-split": (level) => (
    <>
      <circle cx="36" cy="42" r="6.5" />
      <line x1="36" y1="48" x2="42" y2="66" />
      <path d="M42 66 L26 82 L26 86" />
      <g className="anim-widen">
        <path d="M42 66 L84 84" />
        <path d="M40 56 L80 80" />
      </g>
      {(level === "beginner" || level === "intermediate") && <Block x={20} y={80} />}
    </>
  ),

  // Full split (Hanumanasana) — legs slowly widening to final extension.
  // Beginner: blocks under hands AND under hip; intermediate: blocks under hands.
  "full-split": (level) => (
    <>
      <g className="anim-breath">
        <circle cx="50" cy="40" r="6.5" />
        <line x1="50" y1="46" x2="50" y2="68" />
        <path d="M50 50 L40 38 M50 50 L60 38" />
      </g>
      <g className="anim-widen">
        <path d="M16 84 L50 68 L84 84" />
      </g>
      {level === "beginner" && (
        <>
          <Block x={24} y={74} w={10} h={6} />
          <Block x={66} y={74} w={10} h={6} />
          <Block x={43} y={70} w={14} h={5} />
        </>
      )}
      {level === "intermediate" && (
        <>
          <Block x={24} y={74} w={10} h={6} />
          <Block x={66} y={74} w={10} h={6} />
        </>
      )}
      {level === "advanced" && (
        // optional backbend hint: arms reach up
        <path d="M50 50 L44 36 M50 50 L56 36" opacity={0.45} strokeDasharray="2 3" />
      )}
    </>
  ),

  "couch-stretch": () => (
    <>
      <line x1="84" y1="20" x2="84" y2="86" strokeWidth={1.5} opacity={0.4} />
      <g className="anim-rise">
        <circle cx="40" cy="30" r="6.5" />
        <line x1="40" y1="36" x2="44" y2="58" />
        <path d="M40 42 L34 56 M40 42 L48 56" />
      </g>
      <path d="M44 58 L30 74 L30 86" />
      <path d="M44 58 L72 72 L84 56" />
    </>
  ),

  // Cat — spine rounds with breath
  cat: () => (
    <g className="anim-breath">
      <path d="M24 86 L24 64" />
      <path d="M70 86 L70 64" />
      <path d="M24 64 C30 48 64 48 70 64" />
      <circle cx="22" cy="60" r="5" />
    </g>
  ),

  cow: () => (
    <g className="anim-breath">
      <path d="M24 86 L24 60" />
      <path d="M70 86 L70 60" />
      <path d="M24 60 C36 76 58 76 70 60" />
      <circle cx="20" cy="54" r="5" />
    </g>
  ),

  plank: () => (
    <g className="anim-breath">
      <path d="M76 78 L24 60" />
      <circle cx="80" cy="56" r="6" />
      <path d="M30 62 L24 86 M70 75 L68 86" />
      <path d="M76 78 L80 62" />
    </g>
  ),

  // Headstand — subtle sway as it balances; beginner near a wall line
  headstand: (level) => (
    <>
      {level === "beginner" && <line x1="86" y1="14" x2="86" y2="86" strokeWidth={1.5} opacity={0.4} />}
      <g className="anim-sway">
        <circle cx="50" cy="78" r="6.5" />
        <path d="M50 72 L50 30" />
        <path d="M50 70 L36 84 M50 70 L64 84" />
        <path d="M50 30 L44 12 M50 30 L56 12" />
      </g>
    </>
  ),

  // Legs up the wall — quiet breath
  "legs-up": () => (
    <g className="anim-breath">
      <path d="M16 80 L60 80" />
      <circle cx="22" cy="74" r="5.5" />
      <path d="M60 80 L62 24" />
      <path d="M60 80 L56 80" />
    </g>
  ),

  // Savasana — barely-there breath
  savasana: () => (
    <g className="anim-breath">
      <path d="M18 78 L82 78" />
      <circle cx="22" cy="72" r="5.5" />
      <path d="M30 78 L30 84 M40 78 L40 84" opacity={0.5} />
    </g>
  ),

  // Twist — gentle rotation
  twist: () => (
    <g className="anim-sway">
      <path d="M20 80 L52 80" />
      <circle cx="24" cy="74" r="5.5" />
      <path d="M52 80 L74 64 L82 70" />
      <path d="M52 80 L50 64 L40 56" />
    </g>
  ),

  // Half-moon — float & sway
  "half-moon": (level) => (
    <>
      <g className="anim-sway">
        <circle cx="74" cy="30" r="6" />
        <path d="M74 36 L42 58" />
        <path d="M42 58 L24 78" />
        <path d="M42 58 L80 60" />
        <path d="M58 47 L58 22 M58 47 L42 58" />
      </g>
      {level === "beginner" && <Block x={18} y={74} />}
    </>
  ),
};

export function AnimatedAsana({ slug, level = "intermediate", size = 120, className }: Props) {
  // resolve the pose key from the slug (fall back to slug itself / mountain)
  const asana = asanaBySlug(slug);
  const poseKey = asana?.pose ?? slug;
  const draw = POSES[poseKey] || POSES.mountain;
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
      className={`anim-svg ${className ?? ""}`}
      role="img"
      aria-label={asana ? `Animated guide for ${asana.english}` : "Animated yoga pose"}
    >
      {draw(level)}
      <Ground />
    </svg>
  );
}

// Variant that takes a raw pose key (used by the practice queue / warmup).
export function AnimatedPose({
  pose,
  level = "intermediate",
  size = 120,
  className,
}: {
  pose: string;
  level?: Level;
  size?: number;
  className?: string;
}) {
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
      className={`anim-svg ${className ?? ""}`}
      aria-hidden="true"
    >
      {draw(level)}
      <Ground />
    </svg>
  );
}

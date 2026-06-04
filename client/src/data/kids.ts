// Static content for the Kids yoga adventure. Each story pose maps to:
//   - slug used in routes and voice files (/voice/kids-<slug>.mp3)
//   - illustration in /kids/kids_<image>.png
//   - a playful, emoji-free story title and narrative text
export type KidsPose = {
  slug: string; // e.g. "tree" -> /kids/:slug, voice kids-tree.mp3
  image: string; // file base in /kids (kids_tree.png)
  title: string; // story title
  poseName: string; // friendly pose name
  sanskrit?: string; // Sanskrit name (shown as a soft subtitle)
  sticker?: string; // playful sticker label awarded on "I did it!"
  intro: string; // short intro line
  story: string[]; // narrative paragraphs (read by the voice clip too)
};

export const KIDS_POSES: KidsPose[] = [
  {
    slug: "tree",
    image: "kids_tree",
    title: "The Tall Oak Tree",
    poseName: "Tree Pose",
    intro: "Stand tall and grow your branches up to the sky.",
    story: [
      "Once there was a little seed who dreamed of becoming the tallest tree in the whole forest.",
      "Plant one foot like a strong root deep in the ground. Now lift your other foot and rest it on your leg.",
      "Reach your arms up high like branches reaching for the sun. Sway gently in the breeze... and breathe.",
      "You are steady. You are strong. You are a beautiful, growing tree.",
    ],
  },
  {
    slug: "cobra",
    image: "kids_cobra",
    title: "The Friendly Snake",
    poseName: "Cobra Pose",
    intro: "Lie down low, then lift up your head and say hello.",
    story: [
      "Deep in the warm sand lived a friendly snake who loved to say hello to everyone.",
      "Lie on your tummy with your hands under your shoulders. Press down gently and lift your chest up high.",
      "Look up to the sky and take a big breath in. Can you give a long, soft hiss as you breathe out? Ssssss!",
      "What a friendly, brave little snake you are.",
    ],
  },
  {
    slug: "downdog",
    image: "kids_downdog",
    title: "The Playful Puppy",
    poseName: "Downward Dog",
    intro: "Make a big mountain shape and wag your tail!",
    story: [
      "There was a playful puppy who loved to stretch every single morning.",
      "Put your hands and feet on the floor and lift your bottom up high to make a big upside-down V.",
      "Press your paws into the ground and stretch your back nice and long. Give a happy little wag!",
      "Now take three big puppy breaths. Good dog!",
    ],
  },
  {
    slug: "butterfly",
    image: "kids_butterfly",
    title: "The Fluttering Butterfly",
    poseName: "Butterfly Pose",
    intro: "Sit down and flutter your wings like a butterfly.",
    story: [
      "In a sunny meadow, a gentle butterfly woke up ready to flutter from flower to flower.",
      "Sit down tall and bring the bottoms of your feet together. Hold your toes like a little book.",
      "Let your knees flutter up and down like soft butterfly wings. Up and down, up and down.",
      "Take a slow breath and rest your wings. You are calm and free.",
    ],
  },
  {
    slug: "lion",
    image: "kids_lion",
    title: "The Brave Lion",
    poseName: "Lion Pose",
    intro: "Take a big breath and let out a mighty roar!",
    story: [
      "On the golden plains lived a brave lion with the biggest, bravest roar of all.",
      "Sit up tall on your knees and rest your hands on your legs.",
      "Take a great big breath in through your nose. Then open your mouth wide, stick out your tongue, and ROAR!",
      "Do it three times and feel how brave and strong you are.",
    ],
  },
  {
    slug: "mountain",
    image: "kids_mountain",
    title: "The Strong Calm Mountain",
    poseName: "Mountain Pose",
    sanskrit: "Tadasana",
    sticker: "Mighty Mountain",
    intro: "Stand still and tall like a big, calm mountain.",
    story: [
      "High above the clouds stood a mountain that was strong, quiet, and never, ever wobbled.",
      "Stand up nice and tall with your feet together. Press your toes into the ground like deep, strong rocks.",
      "Let your arms rest by your sides and lift the top of your head up to the sky.",
      "Take three slow breaths. You are steady. You are calm. You are a mighty mountain.",
    ],
  },
  {
    slug: "catcow",
    image: "kids_catcow",
    title: "The Kitty and the Cow",
    poseName: "Cat-Cow",
    sanskrit: "Marjaryasana-Bitilasana",
    sticker: "Curious Kitty",
    intro: "Be a stretchy kitty, then a happy cow.",
    story: [
      "In a cozy barn lived a curious kitty and a friendly cow who loved to stretch together every morning.",
      "Come onto your hands and knees like a table. Spread your fingers nice and wide.",
      "Breathe in and drop your tummy, lift your head — moo like a cow! Now breathe out, round your back tall — meow like a kitty!",
      "Moo and meow a few more times, slow and gentle. What a stretchy friend you are.",
    ],
  },
  {
    slug: "boat",
    image: "kids_boat",
    title: "Sail Across the Sea",
    poseName: "Boat Pose",
    sanskrit: "Navasana",
    sticker: "Brave Sailor",
    intro: "Make your body into a little boat and sail away.",
    story: [
      "A brave little sailor set off to sail across the big, blue, sparkly sea.",
      "Sit down and hug your knees. Lean back just a little and lift your feet off the floor.",
      "Reach your arms forward like two oars. Wobble, wobble — steady your boat!",
      "Take a big breath and sail across three gentle waves. You did it, brave sailor!",
    ],
  },
  {
    slug: "frog",
    image: "kids_frog",
    title: "The Leaping Frog",
    poseName: "Frog Pose",
    sanskrit: "Mandukasana",
    sticker: "Jumpy Frog",
    intro: "Squat down low, then leap up high!",
    story: [
      "By a lily pond lived a happy little frog who loved to hop from leaf to leaf.",
      "Squat down low with your hands on the ground between your feet, like a frog on a lily pad.",
      "Take a big breath in... and when you breathe out, jump up high and say 'Ribbit!'",
      "Hop three happy hops. What a jumpy, joyful frog you are!",
    ],
  },
  {
    slug: "star",
    image: "kids_star",
    title: "Shine Bright, Little Star",
    poseName: "Star Pose",
    sanskrit: "Tarasana",
    sticker: "Bright Star",
    intro: "Spread out wide and twinkle like a star.",
    story: [
      "Far up in the night sky, a little star was getting ready to shine its brightest light.",
      "Stand up and step your feet out wide. Reach your arms out wide too — you are a big, beautiful star!",
      "Stretch your fingers and toes out as far as they go and twinkle, twinkle.",
      "Take a deep breath and beam your light all around. Shine bright, little star!",
    ],
  },
];

// ---- Kids breathing games (separate from the adult /breathing page) ----
export type KidsBreath = {
  slug: string; // /kids/breath/:slug, voice kids-<slug>.mp3
  image: string; // file base in /kids
  techniqueName: string;
  visualizer: "balloon" | "bunny" | "bumblebee" | "pinwheel";
  description: string; // 1-line description
  why: string; // "Why we do this" — super short
  inSeconds: number; // inhale duration (s)
  outSeconds: number; // exhale duration (s)
};

export const KIDS_BREATH: KidsBreath[] = [
  {
    slug: "balloon",
    image: "kids_balloon",
    techniqueName: "Balloon Breath",
    visualizer: "balloon",
    description: "Belly breathing — calm and grounded.",
    why: "Big belly breaths help your body feel calm and safe.",
    inSeconds: 4,
    outSeconds: 4,
  },
  {
    slug: "bunny",
    image: "kids_bunny",
    techniqueName: "Bunny Sniffs",
    visualizer: "bunny",
    description: "Three quick sniffs in, one long breath out.",
    why: "Quick little sniffs wake you up, then a long breath lets the worry go.",
    inSeconds: 1.5,
    outSeconds: 3,
  },
  {
    slug: "bumblebee",
    image: "kids_bumblebee",
    techniqueName: "Bumble Bee Breath",
    visualizer: "bumblebee",
    description: "Hum like a bee on the exhale — calms a busy mind.",
    why: "The buzzy hum tickles your body and quiets a busy mind.",
    inSeconds: 4,
    outSeconds: 6,
  },
  {
    slug: "pinwheel",
    image: "kids_pinwheel",
    techniqueName: "Pinwheel Breath",
    visualizer: "pinwheel",
    description: "Blow out steadily to make the pinwheel spin.",
    why: "A long, steady breath out helps you slow down and focus.",
    inSeconds: 3,
    outSeconds: 5,
  },
];

export function kidsBreathBySlug(slug: string | undefined): KidsBreath | undefined {
  if (!slug) return undefined;
  return KIDS_BREATH.find((b) => b.slug === slug);
}

export function kidsPoseBySlug(slug: string | undefined): KidsPose | undefined {
  if (!slug) return undefined;
  return KIDS_POSES.find((p) => p.slug === slug);
}

// Static content for the Kids yoga adventure. Each story pose maps to:
//   - slug used in routes and voice files (/voice/kids-<slug>.mp3)
//   - illustration in /kids/kids_<image>.png
//   - a playful, emoji-free story title and narrative text
export type KidsPose = {
  slug: string; // e.g. "tree" -> /kids/:slug, voice kids-tree.mp3
  image: string; // file base in /kids (kids_tree.png)
  title: string; // story title
  poseName: string; // friendly pose name
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
];

export function kidsPoseBySlug(slug: string | undefined): KidsPose | undefined {
  if (!slug) return undefined;
  return KIDS_POSES.find((p) => p.slug === slug);
}

import { existsSync } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ASANAS } from "../client/src/data/content";
import { validatePoseExport, type PoseExport } from "../shared/poseExport";

const root = new URL("../", import.meta.url);
const output = new URL("data/poses.json", root);
const poses: PoseExport[] = ASANAS.map((asana) => {
  const others = ASANAS.filter((pose) => pose.slug !== asana.slug && pose.category === asana.category);
  return {
    id: asana.slug,
    isPlus: asana.isPlus,
    slug: asana.slug,
    sanskrit: asana.sanskrit,
    english: asana.english,
    level: asana.difficulty,
    duration: { label: asana.hold, seconds: asana.holdSeconds },
    focusAreas: [...new Set(asana.stretchZones.map((zone) => zone.region))],
    benefits: asana.benefits,
    steps: asana.steps.map((step) => step.text),
    cues: asana.variations[asana.difficulty.toLowerCase() as "beginner" | "intermediate" | "advanced"].cues,
    cautions: asana.avoidIf,
    contraindications: asana.contraindications,
    relatedPoses: [
      ...others.filter((pose) => pose.difficulty === asana.difficulty),
      ...others.filter((pose) => pose.difficulty !== asana.difficulty),
    ].slice(0, 8).map((pose) => pose.slug),
    imagePath: `/poses/${asana.slug}.png`,
    videoUrl: "",
  };
});

validatePoseExport(poses);
for (const pose of poses) {
  if (!existsSync(new URL(`client/public${pose.imagePath}`, root))) {
    throw new Error(`Missing image: ${pose.imagePath}`);
  }
}
const json = `${JSON.stringify(poses, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (await readFile(output, "utf8") !== json) {
    throw new Error("data/poses.json is stale; run npm run gen:poses");
  }
} else {
  await mkdir(new URL("data/", root), { recursive: true });
  await writeFile(output, json);
}
console.log(`Validated ${poses.length} poses: unique identities/names, complete fields, valid related poses, existing images. ${fileURLToPath(output)}`);

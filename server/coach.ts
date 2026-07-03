// AI Yoga Coach — session composer (v4).
// Calls Claude to compose a personalized session from the check-in, validates the
// result against the pose catalog, retries once with feedback, and falls back to a
// deterministic rule-based composer if the LLM is unavailable or keeps failing.
import Anthropic from "@anthropic-ai/sdk";
import { COACH_CATALOG, COACH_CATALOG_JSON, COACH_CATALOG_SLUGS, type CoachPose } from "./coach-catalog";

const MODEL = "claude_sonnet_4_6";

export type CheckIn = {
  body: string[];
  soreParts: string[];
  energy: string;
  timeMinutes: number;
  need: string;
  recentSessions?: Array<{ asanas?: string; date?: string; label?: string }>;
};

export type ComposedPose = {
  slug: string;
  holdSeconds: number;
  sides?: "once" | "each";
  why: string;
};

export type ComposedSession = {
  reasoning: string;
  poses: ComposedPose[];
  totalMinutes: number;
  source: "llm" | "fallback";
};

const CATALOG_BY_SLUG = new Map<string, CoachPose>(COACH_CATALOG.map((p) => [p.slug, p]));

// Map the wizard's "sore part" labels to catalog stretch-zone / contraindication
// keywords so the fallback filter can reason about them.
// Keep keywords specific — a bare "back" token matches too many poses (nearly
// every forward fold stretches the back) and would empty the fallback sequence.
const PART_KEYWORDS: Record<string, string[]> = {
  "Lower back": ["lower back", "lumbar"],
  "Upper back": ["upper back", "thoracic"],
  "Neck & shoulders": ["neck"],
  Hips: [],
  Hamstrings: ["hamstring"],
  Knees: [],
  Wrists: ["wrist", "carpal"],
};

function buildSystemPrompt(): string {
  return `You are Sadhana, a warm and knowledgeable yoga teacher composing a personalized session for one student.

Available poses (JSON catalog — you may ONLY use these slugs):
${COACH_CATALOG_JSON}

Compose a session with:
1. A gentle warm-up pose (~10-15% of the total time)
2. 3-6 main poses that address the student's need and avoid contraindicated areas
3. A closing rest pose (savasana or balasana / child's pose) (~15-20% of the total time)

STRICT rules:
- If lower back is sore, avoid deep backbends (urdhva-dhanurasana, ustrasana).
- If hamstrings are sore, avoid deep forward folds and hanumanasana.
- If hips are sore, avoid pigeon (eka-pada-rajakapotasana) and lizard (utthan-pristhasana).
- If knees are sore, avoid deep kneeling/lunges held long; prefer supported shapes.
- If wrists are sore, avoid long weight-bearing on the hands (adho-mukha-svanasana, urdhva-dhanurasana).
- If the student is injured, keep to restorative poses only (balasana, savasana, viparita-karani, supta/baddha-konasana, setu-bandhasana gentle).
- Match the need:
  - calm -> forward folds, seated, restorative
  - energy -> warriors, standing flow (tadasana, virabhadrasana, utkatasana, adho-mukha-svanasana)
  - flexibility -> gentle deepening (anjaneyasana, ardha-hanumanasana, paschimottanasana, baddha-konasana)
  - sleep -> viparita-karani, seated forward fold, baddha-konasana, savasana
  - focus -> balance poses (vrksasana), sukhasana, steady holds
- Do NOT repeat all the same poses from the student's last session — vary the sequence.
- Choose 4-10 poses total. Scale holdSeconds so the sum of (holdSeconds x sidesCount) is close to the requested time.

Return ONLY valid JSON (no markdown fences, no prose) in this exact shape:
{
  "reasoning": "1-3 sentence explanation in a warm second-person voice — why THIS composition for THIS student today",
  "poses": [
    {"slug": "tadasana", "holdSeconds": 30, "sides": "once", "why": "1-line rationale"}
  ],
  "totalMinutes": 10
}
"sides" is "each" for poses done on both sides (lunges, warriors, twists, pigeon), otherwise "once".`;
}

function buildUserPrompt(c: CheckIn): string {
  const recent = (c.recentSessions ?? [])
    .slice(0, 5)
    .map((s, i) => {
      let slugs = "";
      try {
        const parsed = JSON.parse(s.asanas ?? "[]");
        slugs = Array.isArray(parsed) ? parsed.join(", ") : "";
      } catch {
        slugs = s.asanas ?? "";
      }
      return `  ${i + 1}. ${s.label ?? s.date ?? ""} — ${slugs}`;
    })
    .join("\n");

  return `The student told you:
- Body: ${c.body.length ? c.body.join(", ") : "nothing specific"}
- Sore parts: ${c.soreParts.length ? c.soreParts.join(", ") : "none specified"}
- Energy: ${c.energy}
- Available time: ${c.timeMinutes} minutes
- Need: ${c.need}

Their recent practice (most recent first)${recent ? ":\n" + recent : ": (no history yet)"}

Compose today's session now. Return ONLY the JSON.`;
}

// ---- Validation ----
export type ValidationResult =
  | { ok: true; session: Omit<ComposedSession, "source"> }
  | { ok: false; feedback: string };

function estimatedMinutes(poses: ComposedPose[]): number {
  let seconds = 0;
  for (const p of poses) {
    const factor = p.sides === "each" ? 2 : 1;
    seconds += (p.holdSeconds || 0) * factor;
  }
  return seconds / 60;
}

function validate(raw: any, requestedMinutes: number): ValidationResult {
  if (!raw || typeof raw !== "object") return { ok: false, feedback: "Output was not a JSON object." };
  if (typeof raw.reasoning !== "string" || !raw.reasoning.trim())
    return { ok: false, feedback: "Missing 'reasoning' string." };
  if (!Array.isArray(raw.poses) || raw.poses.length < 4 || raw.poses.length > 10)
    return { ok: false, feedback: "'poses' must be an array of 4-10 items." };

  const poses: ComposedPose[] = [];
  for (const p of raw.poses) {
    if (!p || typeof p.slug !== "string" || !COACH_CATALOG_SLUGS.has(p.slug))
      return { ok: false, feedback: `Unknown slug "${p?.slug}". Only use slugs from the catalog.` };
    const holdSeconds = Number(p.holdSeconds);
    if (!Number.isFinite(holdSeconds) || holdSeconds < 10 || holdSeconds > 600)
      return { ok: false, feedback: `holdSeconds for ${p.slug} must be 10-600.` };
    poses.push({
      slug: p.slug,
      holdSeconds: Math.round(holdSeconds),
      sides: p.sides === "each" ? "each" : "once",
      why: typeof p.why === "string" ? p.why : "",
    });
  }

  const est = estimatedMinutes(poses);
  const lo = requestedMinutes * 0.8;
  const hi = requestedMinutes * 1.2;
  if (est < lo || est > hi)
    return {
      ok: false,
      feedback: `Total practice time is ~${est.toFixed(1)} min but must be within ${lo.toFixed(1)}-${hi.toFixed(
        1,
      )} min (target ${requestedMinutes}). Adjust holdSeconds or pose count.`,
    };

  return {
    ok: true,
    session: { reasoning: raw.reasoning.trim(), poses, totalMinutes: Math.round(est) },
  };
}

function extractJson(text: string): any {
  // Strip markdown fences if present, then grab the first {...} block.
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ---- Fallback rule-based composer ----
const FALLBACK_SEQUENCES: Record<string, string[]> = {
  calm: ["balasana", "paschimottanasana", "viparita-karani", "savasana"],
  energy: ["tadasana", "virabhadrasana-i", "virabhadrasana-ii", "utkatasana", "savasana"],
  flexibility: ["anjaneyasana", "ardha-hanumanasana", "paschimottanasana", "balasana"],
  sleep: ["viparita-karani", "baddha-konasana", "paschimottanasana", "savasana"],
  focus: ["sukhasana", "vrksasana", "balasana", "savasana"],
  movement: ["tadasana", "adho-mukha-svanasana", "anjaneyasana", "balasana", "savasana"],
};

const EACH_SIDE = new Set([
  "virabhadrasana-i",
  "virabhadrasana-ii",
  "anjaneyasana",
  "ardha-hanumanasana",
  "eka-pada-rajakapotasana",
  "utthan-pristhasana",
  "marichyasana-twist",
  "parsvottanasana",
  "trikonasana",
  "ardha-chandrasana",
]);

function soreKeywords(soreParts: string[]): string[] {
  const kw: string[] = [];
  for (const part of soreParts) for (const k of PART_KEYWORDS[part] ?? []) kw.push(k);
  return kw;
}

function isContraindicated(pose: CoachPose, soreParts: string[], injured: boolean): boolean {
  if (injured && pose.category !== "Restorative") {
    // Allow a small set of gentle restorative-ish shapes even if not tagged Restorative.
    const gentle = new Set(["balasana", "savasana", "viparita-karani", "baddha-konasana", "setu-bandhasana", "sukhasana"]);
    if (!gentle.has(pose.slug)) return true;
  }
  // Hard rules by sore body part.
  const parts = new Set(soreParts);
  if (parts.has("Lower back") && ["urdhva-dhanurasana", "ustrasana"].includes(pose.slug)) return true;
  if (parts.has("Upper back") && ["urdhva-dhanurasana", "ustrasana"].includes(pose.slug)) return true;
  if (parts.has("Hamstrings") && ["hanumanasana", "paschimottanasana", "uttanasana", "ardha-hanumanasana"].includes(pose.slug))
    return true;
  if (parts.has("Hips") && ["eka-pada-rajakapotasana", "utthan-pristhasana"].includes(pose.slug)) return true;
  if (parts.has("Knees") && ["virabhadrasana-i", "anjaneyasana", "utthan-pristhasana", "utkatasana", "padmasana"].includes(pose.slug))
    return true;
  if (parts.has("Wrists") && ["adho-mukha-svanasana", "urdhva-dhanurasana", "bhujangasana", "sirsasana"].includes(pose.slug))
    return true;
  // Soft keyword match against the pose's own listed contraindications.
  const haystack = pose.contraindications.map((c) => c.toLowerCase()).join(" | ");
  const keywords = soreKeywords(soreParts);
  return keywords.some((k) => haystack.includes(k));
}

export function fallbackCompose(c: CheckIn): ComposedSession {
  const injured = c.body.map((b) => b.toLowerCase()).includes("injured");
  const need = (c.need || "movement").toLowerCase();
  const key = FALLBACK_SEQUENCES[need] ? need : "movement";
  let slugs = injured ? ["balasana", "viparita-karani", "baddha-konasana", "savasana"] : [...FALLBACK_SEQUENCES[key]];

  // Filter contraindicated poses, then backfill with safe restorative shapes.
  slugs = slugs.filter((s) => {
    const pose = CATALOG_BY_SLUG.get(s);
    return pose ? !isContraindicated(pose, c.soreParts, injured) : false;
  });
  const safeBackfill = ["sukhasana", "balasana", "viparita-karani", "baddha-konasana", "setu-bandhasana", "savasana"];
  for (const s of safeBackfill) {
    if (slugs.length >= 4) break;
    if (!slugs.includes(s)) {
      const pose = CATALOG_BY_SLUG.get(s);
      if (pose && !isContraindicated(pose, c.soreParts, injured)) slugs.push(s);
    }
  }
  // Ensure savasana closes the session.
  if (!slugs.includes("savasana")) slugs.push("savasana");
  slugs = Array.from(new Set(slugs)).slice(0, 8);

  // Scale holds to hit the time budget.
  const targetSeconds = c.timeMinutes * 60;
  const weights = slugs.map((s) => (s === "savasana" ? 1.6 : s === "viparita-karani" ? 1.4 : 1));
  const sidesCount = slugs.map((s) => (EACH_SIDE.has(s) ? 2 : 1));
  const weightedUnits = weights.reduce((a, w, i) => a + w * sidesCount[i], 0);
  const perUnit = targetSeconds / weightedUnits;

  const poses: ComposedPose[] = slugs.map((s, i) => {
    const pose = CATALOG_BY_SLUG.get(s)!;
    const raw = Math.round((perUnit * weights[i]) / 5) * 5;
    const holdSeconds = Math.max(20, Math.min(300, raw));
    return {
      slug: s,
      holdSeconds,
      sides: EACH_SIDE.has(s) ? "each" : "once",
      why:
        pose.benefits[0] ??
        (s === "savasana" ? "Rest and integrate." : "A steady, supportive shape for today."),
    };
  });

  const soreLine = c.soreParts.length ? `Because your ${c.soreParts.join(" and ").toLowerCase()} ${c.soreParts.length > 1 ? "are" : "is"} asking for care, ` : "";
  const reasoning = `${soreLine}and you have ${c.timeMinutes} minutes for ${need}, I've laid out a gentle, safe sequence that opens softly and closes in rest.`;

  return {
    reasoning,
    poses,
    totalMinutes: Math.round(estimatedMinutes(poses)),
    source: "fallback",
  };
}

// ---- Main compose (LLM with retry, then fallback) ----
export async function compose(c: CheckIn): Promise<ComposedSession> {
  let client: Anthropic;
  try {
    client = new Anthropic();
  } catch {
    return fallbackCompose(c);
  }

  const system = buildSystemPrompt();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: buildUserPrompt(c) }];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 1400,
        system,
        messages,
      });
      const text = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      const parsed = extractJson(text);
      const result = validate(parsed, c.timeMinutes);
      if (result.ok) return { ...result.session, source: "llm" };

      // Retry once with feedback.
      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content: `That response was not valid: ${result.feedback}\nPlease fix and return ONLY the corrected JSON.`,
      });
    } catch (err) {
      // Network / auth / API error — stop retrying and fall back.
      break;
    }
  }

  return fallbackCompose(c);
}

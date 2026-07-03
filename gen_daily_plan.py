#!/usr/bin/env python3
"""Generate the 60-day full splits daily plan as a TypeScript array literal.

Rules per task spec. Each day must include: >=1 warmup, >=3 stretching poses, savasana.
totalMinutes = round(sum(holdSeconds * (2 if each else 1)) / 60).
"""

import json

REST_DAYS = {7, 14, 21, 28, 35, 42, 49, 56}

# Poetic themes for milestone days; others get a phase-flavored theme.
SPECIAL_THEMES = {
    1: "Meet your mat",
    7: "Rest and receive",
    14: "Rest and receive",
    21: "Rest and receive",
    28: "Rest and receive",
    30: "Halfway home",
    35: "Rest and receive",
    42: "Rest and receive",
    45: "Three quarters — you feel different",
    49: "Rest and receive",
    56: "Rest and receive",
    60: "Full expression",
}

# Rotating theme fragments per phase to keep things fresh
FOUNDATION_THEMES = [
    "Foundation: wake the hips",
    "Foundation: soften the hamstrings",
    "Foundation: open the inner thighs",
    "Foundation: lengthen the front body",
    "Foundation: breath and hips",
    "Foundation: steady standing base",
    "Foundation: gentle depth",
    "Foundation: patient hips",
    "Foundation: hamstrings awaken",
    "Foundation: find your baseline",
    "Foundation: quiet strength",
    "Foundation: settle and open",
]
DEEPENING_THEMES = [
    "Deepening: pigeon opens the glutes",
    "Deepening: lizard finds the edge",
    "Deepening: pyramid lengthens",
    "Deepening: hips go deeper",
    "Deepening: hold and breathe",
    "Deepening: active flexibility",
    "Deepening: patient descent",
    "Deepening: build the range",
    "Deepening: hamstrings and hips",
    "Deepening: steady progress",
    "Deepening: open a little more",
    "Deepening: trust the stretch",
    "Deepening: length over force",
    "Deepening: consistent depth",
]
APPROACHING_THEMES = [
    "Approaching: half-split on blocks",
    "Approaching: backbend prep begins",
    "Approaching: bridge opens the front",
    "Approaching: cobra wakes the spine",
    "Approaching: deeper pigeon",
    "Approaching: length and lift",
    "Approaching: the split feels near",
    "Approaching: front and back open",
    "Approaching: props and patience",
    "Approaching: steady descent",
    "Approaching: build the base",
    "Approaching: breath into depth",
    "Approaching: almost there",
]
EXPRESSION_THEMES = [
    "Full expression: the split, with props",
    "Full expression: descend and breathe",
    "Full expression: camel opens the heart",
    "Full expression: front split deepens",
    "Full expression: hold with ease",
    "Full expression: front and back",
    "Full expression: trust your range",
    "Full expression: patient depth",
    "Full expression: the full shape",
    "Full expression: props then less",
    "Full expression: steady and open",
    "Full expression: your practice blooms",
    "Full expression: nearly free",
]


def pose(slug, hold, sides=None, note=None):
    p = {"asanaSlug": slug, "holdSeconds": hold}
    if sides:
        p["sides"] = sides
    if note:
        p["note"] = note
    return p


def total_minutes(poses):
    total = 0
    for p in poses:
        mult = 2 if p.get("sides") == "each" else 1
        total += p["holdSeconds"] * mult
    return round(total / 60)


def build_day(day):
    rest = day in REST_DAYS

    if rest:
        theme = SPECIAL_THEMES.get(day, "Rest and receive")
        poses = [
            pose("balasana", 120, "once", "gentle recovery"),
            pose("savasana", 180, "once"),
        ]
        return {
            "day": day,
            "theme": theme,
            "poses": poses,
            "totalMinutes": total_minutes(poses),
            "restDay": True,
            "focus": "front-splits",
        }

    # Determine phase
    if day <= 14:
        phase = "foundation"
        themes = FOUNDATION_THEMES
        idx = (day - 1) % len(themes)
    elif day <= 30:
        phase = "deepening"
        themes = DEEPENING_THEMES
        idx = (day - 15) % len(themes)
    elif day <= 45:
        phase = "approaching"
        themes = APPROACHING_THEMES
        idx = (day - 31) % len(themes)
    else:
        phase = "expression"
        themes = EXPRESSION_THEMES
        idx = (day - 46) % len(themes)

    theme = SPECIAL_THEMES.get(day, themes[idx])

    poses = []
    focus = "front-splits"

    if phase == "foundation":
        # 15 min. warmup + hip flexors, hamstrings, adductors + savasana
        # warmup: tadasana; mid-week add virabhadrasana-i and uttanasana
        poses.append(pose("tadasana", 30, "once", "warm-up"))
        # rotate standing warm-up mid-week
        if day % 3 == 0:
            poses.append(pose("virabhadrasana-i", 45, "each", "standing warm-up"))
        if day % 4 == 0:
            poses.append(pose("uttanasana", 45, "once", "standing warm-up"))
        # core foundation stretches, vary the combo
        combos = [
            [("anjaneyasana", 60, "each"), ("baddha-konasana", 90, "once"), ("paschimottanasana", 60, "once")],
            [("anjaneyasana", 60, "each"), ("paschimottanasana", 60, "once"), ("baddha-konasana", 90, "once")],
            [("baddha-konasana", 90, "once"), ("anjaneyasana", 60, "each"), ("paschimottanasana", 75, "once")],
            [("anjaneyasana", 75, "each"), ("baddha-konasana", 90, "once"), ("paschimottanasana", 60, "once")],
        ]
        combo = combos[(day - 1) % len(combos)]
        for slug, hold, sides in combo:
            poses.append(pose(slug, hold, sides))
        poses.append(pose("balasana", 90, "once", "rest"))
        poses.append(pose("savasana", 180, "once"))

    elif phase == "deepening":
        # 20 min. add pigeon, lizard, pyramid; push holds longer
        poses.append(pose("tadasana", 30, "once", "warm-up"))
        poses.append(pose("virabhadrasana-i", 45, "each", "standing warm-up"))
        poses.append(pose("anjaneyasana", 75, "each"))
        rot = [
            [("eka-pada-rajakapotasana", 60, "each"), ("utthan-pristhasana", 60, "each")],
            [("utthan-pristhasana", 60, "each"), ("parsvottanasana", 60, "each")],
            [("parsvottanasana", 60, "each"), ("eka-pada-rajakapotasana", 75, "each")],
            [("eka-pada-rajakapotasana", 75, "each"), ("utthan-pristhasana", 60, "each")],
        ]
        combo = rot[(day - 15) % len(rot)]
        for slug, hold, sides in combo:
            poses.append(pose(slug, hold, sides))
        poses.append(pose("baddha-konasana", 120, "once"))
        poses.append(pose("balasana", 60, "once", "rest"))
        poses.append(pose("savasana", 180, "once"))

    elif phase == "approaching":
        # 25 min. add ardha-hanumanasana on blocks, deeper pigeon; backbend prep setu-bandhasana + bhujangasana
        focus = "both"
        poses.append(pose("tadasana", 30, "once", "warm-up"))
        poses.append(pose("anjaneyasana", 75, "each"))
        poses.append(pose("ardha-hanumanasana", 70, "each", "hands on blocks"))
        poses.append(pose("eka-pada-rajakapotasana", 75, "each", "deeper pigeon"))
        # backbend prep
        poses.append(pose("parsvottanasana", 60, "each"))
        poses.append(pose("setu-bandhasana", 60, "once", "backbend prep"))
        poses.append(pose("bhujangasana", 45, "once", "backbend prep"))
        poses.append(pose("savasana", 180, "once"))

    else:  # expression
        # 25-30 min. ardha-hanumanasana -> hanumanasana with props; add ustrasana; day 60 celebration
        focus = "both"
        poses.append(pose("tadasana", 30, "once", "warm-up"))
        poses.append(pose("anjaneyasana", 75, "each"))
        poses.append(pose("ardha-hanumanasana", 75, "each"))
        if day == 60:
            poses.append(pose("hanumanasana", 60, "each", "maximum props — full pose attempt"))
            poses.append(pose("ustrasana", 45, "once", "backbend"))
            poses.append(pose("setu-bandhasana", 60, "once"))
            poses.append(pose("savasana", 180, "once", "celebration rest"))
        else:
            poses.append(pose("hanumanasana", 55, "each", "with props"))
            poses.append(pose("ustrasana", 45, "once", "backbend"))
            poses.append(pose("eka-pada-rajakapotasana", 75, "each"))
            poses.append(pose("balasana", 60, "once", "counter-stretch"))
            poses.append(pose("savasana", 180, "once"))

    return {
        "day": day,
        "theme": theme,
        "poses": poses,
        "totalMinutes": total_minutes(poses),
        "focus": focus,
    }


days = [build_day(d) for d in range(1, 61)]

# Validation: every non-rest day must have >=1 warmup, >=3 stretching, savasana
WARMUP_SLUGS = {"tadasana", "virabhadrasana-i", "uttanasana"}
STRETCH_SLUGS = {
    "anjaneyasana", "baddha-konasana", "paschimottanasana", "eka-pada-rajakapotasana",
    "utthan-pristhasana", "parsvottanasana", "ardha-hanumanasana", "hanumanasana",
    "setu-bandhasana", "bhujangasana", "ustrasana", "balasana",
}
for d in days:
    slugs = [p["asanaSlug"] for p in d["poses"]]
    assert "savasana" in slugs, f"day {d['day']} missing savasana"
    if not d.get("restDay"):
        assert any(s in WARMUP_SLUGS for s in slugs), f"day {d['day']} no warmup"
        stretch_count = sum(1 for s in slugs if s in STRETCH_SLUGS)
        assert stretch_count >= 3, f"day {d['day']} only {stretch_count} stretches"

# Emit TS
def ts_pose(p):
    parts = [f'asanaSlug: "{p["asanaSlug"]}"', f'holdSeconds: {p["holdSeconds"]}']
    if "sides" in p:
        parts.append(f'sides: "{p["sides"]}"')
    if "note" in p:
        note = p["note"].replace('"', '\\"')
        parts.append(f'note: "{note}"')
    return "{ " + ", ".join(parts) + " }"

lines = ["    dailyPlan: ["]
for d in days:
    theme = d["theme"].replace('"', '\\"')
    lines.append("      {")
    lines.append(f'        day: {d["day"]},')
    lines.append(f'        theme: "{theme}",')
    lines.append(f'        focus: "{d["focus"]}",')
    if d.get("restDay"):
        lines.append("        restDay: true,")
    lines.append(f'        totalMinutes: {d["totalMinutes"]},')
    lines.append("        poses: [")
    for p in d["poses"]:
        lines.append(f"          {ts_pose(p)},")
    lines.append("        ],")
    lines.append("      },")
lines.append("    ],")

ts = "\n".join(lines)
with open("daily_plan.ts.txt", "w") as f:
    f.write(ts)

print(f"Generated {len(days)} days")
print("Sample minutes:", [(d["day"], d["totalMinutes"], d.get("restDay", False)) for d in days[:16]])
print("Rest days:", sorted(REST_DAYS))

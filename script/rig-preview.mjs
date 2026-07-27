/**
 * rig-preview — render every authored rig keyframe to a contact-sheet PNG.
 *
 * Keyframes in client/src/data/poseKeyframes.ts are joint angles, which are
 * impossible to review by reading. This runs the same forward kinematics the
 * WebGL stage runs (three.js Euler order XYZ, identical bone table), projects
 * the result through a perspective camera, and writes one tile per
 * (pose, narration step, view) so a human can see whether Warrior II actually
 * looks like Warrior II.
 *
 *   node script/rig-preview.mjs                        # every pilot pose
 *   node script/rig-preview.mjs --slug tadasana
 *   node script/rig-preview.mjs --tween                # include mid-transition
 *   node script/rig-preview.mjs --out /tmp/sheet.png
 *
 * Zero dependencies beyond Node — no browser, no GPU, no image library, so it
 * runs anywhere including CI. It reviews the pose DATA, which is where the
 * risk lives; the WebGL shading is verified by looking at the running app.
 */
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Loaded through tsx (see the npm script), so the TS sources import directly.
const { SKELETON, normalizePose, lerpPose, easeInOut } = await import(
  pathToFileURL(path.join(ROOT, "client/src/lib/poseRig.ts")).href
);
const { POSE_KEYFRAMES } = await import(
  pathToFileURL(path.join(ROOT, "client/src/data/poseKeyframes.ts")).href
);

const args = process.argv.slice(2);
const argOf = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const onlySlug = argOf("--slug");
const withTween = args.includes("--tween");
const outPath = argOf("--out") ?? path.join(ROOT, "rig-preview.png");

const DEG = Math.PI / 180;
const TILE = 300;
const LABEL = 24;
const COLS = 4;

/* ---------------- linear algebra (column-major 4x4, like three.js) --------- */

const mul = (a, b) => {
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c += 1)
    for (let r = 0; r < 4; r += 1)
      o[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
  return o;
};

const translate = ([x, y, z]) =>
  Float64Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);

/** three.js Euler order 'XYZ' → R = Rx · Ry · Rz. */
const eulerXYZ = ([xd, yd, zd]) => {
  const x = xd * DEG, y = yd * DEG, z = zd * DEG;
  const a = Math.cos(x), b = Math.sin(x);
  const c = Math.cos(y), d = Math.sin(y);
  const e = Math.cos(z), f = Math.sin(z);
  const ae = a * e, af = a * f, be = b * e, bf = b * f;
  const m = new Float64Array(16);
  m[0] = c * e;            m[4] = -c * f;           m[8] = d;
  m[1] = af + be * d;      m[5] = ae - bf * d;      m[9] = -b * c;
  m[2] = bf - ae * d;      m[6] = be + af * d;      m[10] = a * c;
  m[15] = 1;
  return m;
};

const applyPoint = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

/* ---------------- forward kinematics --------------------------------------- */

function solve(pose) {
  const world = new Map();
  const rootM = mul(translate(pose.root.position), eulerXYZ(pose.root.rotation));
  const segments = [];

  // Local axis directions, needed to project an elliptical cross-section.
  const axisX = (m) => [m[0], m[1], m[2]];
  const axisZ = (m) => [m[8], m[9], m[10]];

  for (const bone of SKELETON) {
    const parentM = bone.parent ? world.get(bone.parent) : rootM;
    const local = mul(translate(bone.offset), eulerXYZ(pose.joints[bone.name] ?? [0, 0, 0]));
    const m = mul(parentM, local);
    world.set(bone.name, m);
    const dir = bone.axis === "up" ? 1 : -1;
    segments.push({
      name: bone.name,
      a: applyPoint(m, [0, 0, 0]),
      b: applyPoint(m, [0, dir * bone.length, 0]),
      r0: bone.r0,
      r1: bone.r1,
      sx: bone.sx ?? 1,
      sz: bone.sz ?? 1,
      shape: bone.shape ?? "limb",
      ex: axisX(m),
      ez: axisZ(m),
    });
  }

  return segments;
}

/* ---------------- camera ---------------------------------------------------- */

function makeCamera(angle, dist, targetY) {
  const eye = [Math.sin(angle) * dist, 1.15, Math.cos(angle) * dist];
  const target = [0, targetY, 0];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = (v) => {
    const l = Math.hypot(...v) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const zAx = norm(sub(eye, target));
  const xAx = norm(cross([0, 1, 0], zAx));
  const yAx = cross(zAx, xAx);

  const fov = 34 * DEG;
  const focal = 1 / Math.tan(fov / 2);

  return (p) => {
    const d = sub(p, eye);
    const cx = d[0] * xAx[0] + d[1] * xAx[1] + d[2] * xAx[2];
    const cy = d[0] * yAx[0] + d[1] * yAx[1] + d[2] * yAx[2];
    const cz = d[0] * zAx[0] + d[1] * zAx[1] + d[2] * zAx[2];
    const depth = -cz; // distance in front of the camera
    if (depth <= 0.01) return null;
    return {
      x: (cx / depth) * focal * (TILE / 2) + TILE / 2,
      y: -(cy / depth) * focal * (TILE / 2) + TILE / 2,
      depth,
      scale: (focal * (TILE / 2)) / depth,
    };
  };
}

/* ---------------- raster ---------------------------------------------------- */

function makeTile(bg) {
  const px = new Uint8Array(TILE * TILE * 3);
  for (let i = 0; i < TILE * TILE; i += 1) {
    px[i * 3] = bg[0];
    px[i * 3 + 1] = bg[1];
    px[i * 3 + 2] = bg[2];
  }
  return px;
}

/**
 * Draw one cross-section of a bone.
 *
 * Shading uses only the component ACROSS the bone (`n`), never along it — a
 * limb is a cylinder, not a stack of spheres. Shading each section as a
 * hemisphere is what made short, wide segments (the chest, the pelvis) dome
 * into balls stacked on top of each other.
 */
function crossSection(px, cx, cy, w, n, d, color, light = 1) {
  if (!(w > 0.4)) return;
  const x0 = Math.max(0, Math.floor(cx - w - 1));
  const x1 = Math.min(TILE - 1, Math.ceil(cx + w + 1));
  const y0 = Math.max(0, Math.floor(cy - w - 1));
  const y1 = Math.min(TILE - 1, Math.ceil(cy + w + 1));

  for (let y = y0; y <= y1; y += 1)
    for (let x = x0; x <= x1; x += 1) {
      const px0 = x + 0.5 - cx;
      const py0 = y + 0.5 - cy;
      const across = (px0 * n[0] + py0 * n[1]) / w;
      const along = (px0 * d[0] + py0 * d[1]) / w;
      if (across * across + along * along > 1) continue;
      const nz = Math.sqrt(Math.max(0, 1 - across * across));
      // Key light up and to the left, in screen space.
      const lambert = Math.max(0, -across * (n[0] * 0.5 + n[1] * 0.45) + nz * 0.84);
      const rim = Math.pow(1 - nz, 4) * 0.34;
      const shade = Math.min(1.24, 0.34 + 0.8 * lambert + rim) * light;
      const edge = Math.min(1, (1 - Math.abs(across)) * w * 1.9);
      const i = (y * TILE + x) * 3;
      for (let c = 0; c < 3; c += 1) {
        const val = Math.min(255, color[c] * shade + 38 * rim);
        px[i + c] = px[i + c] * (1 - edge) + val * edge;
      }
    }
}

/**
 * On-screen half-width of an elliptical cross-section, measured perpendicular
 * to the bone. `ax`/`az` are the projected semi-axis vectors; the extent of an
 * ellipse along a unit direction n is hypot(ax·n, az·n).
 */
function halfWidth(ax, az, n) {
  return Math.hypot(ax[0] * n[0] + ax[1] * n[1], az[0] * n[0] + az[1] * n[1]);
}

/**
 * Sweep a bone. `profile(t)` scales the radius along the bone, which is what
 * turns a cylinder into a tapered limb or an ovoid skull.
 */
function sweep(px, seg, project, color, profile, light = 1) {
  const pa = project(seg.a);
  const pb = project(seg.b);
  if (!pa || !pb) return;
  const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
  const dirLen = len || 1;
  // Perpendicular to the bone in screen space.
  const d2 = [(pb.x - pa.x) / dirLen, (pb.y - pa.y) / dirLen];
  const n = [-d2[1], d2[0]];
  const steps = Math.max(4, Math.ceil(len * 1.2));

  for (let s = 0; s <= steps; s += 1) {
    const t = s / steps;
    const p = [
      seg.a[0] + (seg.b[0] - seg.a[0]) * t,
      seg.a[1] + (seg.b[1] - seg.a[1]) * t,
      seg.a[2] + (seg.b[2] - seg.a[2]) * t,
    ];
    const c = project(p);
    if (!c) continue;
    const r = (seg.r0 + (seg.r1 - seg.r0) * t) * profile(t);
    if (r <= 0) continue;
    const px1 = project([
      p[0] + seg.ex[0] * r * seg.sx,
      p[1] + seg.ex[1] * r * seg.sx,
      p[2] + seg.ex[2] * r * seg.sx,
    ]);
    const pz1 = project([
      p[0] + seg.ez[0] * r * seg.sz,
      p[1] + seg.ez[1] * r * seg.sz,
      p[2] + seg.ez[2] * r * seg.sz,
    ]);
    if (!px1 || !pz1) continue;
    const w = halfWidth([px1.x - c.x, px1.y - c.y], [pz1.x - c.x, pz1.y - c.y], n);
    crossSection(px, c.x, c.y, w, n, d2, color, light);
  }
}

/** Rounded ends so consecutive bones blend at the joint. */
const roundedEnds = (t) => {
  const cap = 0.14;
  if (t < cap) return Math.sqrt(Math.max(0.04, 1 - Math.pow(1 - t / cap, 2)));
  if (t > 1 - cap) return Math.sqrt(Math.max(0.04, 1 - Math.pow((t - (1 - cap)) / cap, 2)));
  return 1;
};
const flat = () => 1;
/** Ovoid skull: a sphere profile centred just above the neck. */
const skull = (t) => {
  const u = (t - 0.44) / 0.5;
  return Math.sqrt(Math.max(0, 1 - u * u));
};

function drawSegment(px, seg, project) {
  if (seg.shape === "head") {
    sweep(px, seg, project, HEAD, skull);
    // Nose — small, but it makes the facing direction unmistakable.
    const noseAt = 0.46;
    const base = [
      seg.a[0] + (seg.b[0] - seg.a[0]) * noseAt,
      seg.a[1] + (seg.b[1] - seg.a[1]) * noseAt,
      seg.a[2] + (seg.b[2] - seg.a[2]) * noseAt,
    ];
    const tip = [
      base[0] + seg.ez[0] * seg.r0 * 1.05,
      base[1] + seg.ez[1] * seg.r0 * 1.05,
      base[2] + seg.ez[2] * seg.r0 * 1.05,
    ];
    sweep(
      px,
      { ...seg, a: base, b: tip, r0: seg.r0 * 0.28, r1: seg.r0 * 0.16, sx: 0.8, sz: 0.8 },
      project,
      HEAD,
      flat,
      1.06,
    );
    return;
  }
  sweep(px, seg, project, BODY, seg.shape === "torso" || seg.shape === "slab" ? flat : roundedEnds);
}

function floorGrid(px, project) {
  const grey = [205, 196, 222];
  for (let i = -6; i <= 6; i += 1) {
    const u = i * 0.25;
    for (const line of [
      [[u, 0, -1.5], [u, 0, 1.5]],
      [[-1.5, 0, u], [1.5, 0, u]],
    ]) {
      const a = project(line[0]);
      const b = project(line[1]);
      if (!a || !b) continue;
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        const x = Math.round(a.x + (b.x - a.x) * t);
        const y = Math.round(a.y + (b.y - a.y) * t);
        if (x < 0 || y < 0 || x >= TILE || y >= TILE) continue;
        const idx = (y * TILE + x) * 3;
        px[idx] = grey[0];
        px[idx + 1] = grey[1];
        px[idx + 2] = grey[2];
      }
    }
  }
}

const BODY = [123, 98, 201];
const HEAD = [96, 72, 175];

function renderPose(pose, view) {
  const px = makeTile([244, 240, 250]);
  const angle = view === "side" ? Math.PI / 2 : 0.5;
  const project = makeCamera(angle, 3.3, 0.8);
  floorGrid(px, project);

  const segs = solve(pose)
    .map((s) => ({ ...s, pa: project(s.a), pb: project(s.b) }))
    .filter((s) => s.pa && s.pb)
    // Painter's algorithm — far bones first, so limbs occlude correctly.
    .sort((m, n) => (n.pa.depth + n.pb.depth) - (m.pa.depth + m.pb.depth));

  for (const s of segs) drawSegment(px, s, project);
  return px;
}

/* ---------------- 5x7 bitmap text ------------------------------------------ */

const FONT = {
  A: ["01110","10001","10001","11111","10001","10001","10001"],
  B: ["11110","10001","11110","10001","10001","10001","11110"],
  C: ["01111","10000","10000","10000","10000","10000","01111"],
  D: ["11110","10001","10001","10001","10001","10001","11110"],
  E: ["11111","10000","11110","10000","10000","10000","11111"],
  F: ["11111","10000","11110","10000","10000","10000","10000"],
  G: ["01111","10000","10000","10111","10001","10001","01111"],
  H: ["10001","10001","11111","10001","10001","10001","10001"],
  I: ["11111","00100","00100","00100","00100","00100","11111"],
  J: ["00111","00010","00010","00010","10010","10010","01100"],
  K: ["10001","10010","10100","11000","10100","10010","10001"],
  L: ["10000","10000","10000","10000","10000","10000","11111"],
  M: ["10001","11011","10101","10101","10001","10001","10001"],
  N: ["10001","11001","10101","10011","10001","10001","10001"],
  O: ["01110","10001","10001","10001","10001","10001","01110"],
  P: ["11110","10001","10001","11110","10000","10000","10000"],
  Q: ["01110","10001","10001","10001","10101","10010","01101"],
  R: ["11110","10001","10001","11110","10100","10010","10001"],
  S: ["01111","10000","10000","01110","00001","00001","11110"],
  T: ["11111","00100","00100","00100","00100","00100","00100"],
  U: ["10001","10001","10001","10001","10001","10001","01110"],
  V: ["10001","10001","10001","10001","10001","01010","00100"],
  W: ["10001","10001","10001","10101","10101","11011","10001"],
  X: ["10001","01010","00100","00100","00100","01010","10001"],
  Y: ["10001","01010","00100","00100","00100","00100","00100"],
  Z: ["11111","00010","00100","01000","10000","10000","11111"],
  0: ["01110","10001","10011","10101","11001","10001","01110"],
  1: ["00100","01100","00100","00100","00100","00100","01110"],
  2: ["01110","10001","00001","00110","01000","10000","11111"],
  3: ["11111","00010","00100","00010","00001","10001","01110"],
  4: ["00010","00110","01010","10010","11111","00010","00010"],
  5: ["11111","10000","11110","00001","00001","10001","01110"],
  6: ["00110","01000","10000","11110","10001","10001","01110"],
  7: ["11111","00001","00010","00100","01000","01000","01000"],
  8: ["01110","10001","10001","01110","10001","10001","01110"],
  9: ["01110","10001","10001","01111","00001","00010","01100"],
  "-": ["00000","00000","00000","11111","00000","00000","00000"],
  ".": ["00000","00000","00000","00000","00000","01100","01100"],
  " ": ["00000","00000","00000","00000","00000","00000","00000"],
  "(": ["00010","00100","01000","01000","01000","00100","00010"],
  ")": ["01000","00100","00010","00010","00010","00100","01000"],
};

function drawText(buf, W, x0, y0, text, color, scale = 2) {
  let cx = x0;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch] ?? FONT[" "];
    for (let r = 0; r < 7; r += 1)
      for (let c = 0; c < 5; c += 1) {
        if (glyph[r][c] !== "1") continue;
        for (let dy = 0; dy < scale; dy += 1)
          for (let dx = 0; dx < scale; dx += 1) {
            const x = cx + c * scale + dx;
            const y = y0 + r * scale + dy;
            if (x < 0 || y < 0 || x >= W) continue;
            const i = (y * W + x) * 3;
            buf[i] = color[0];
            buf[i + 1] = color[1];
            buf[i + 2] = color[2];
          }
      }
    cx += 6 * scale;
  }
}

/* ---------------- PNG encode ------------------------------------------------ */

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(rgb, W, H) {
  const raw = Buffer.alloc(H * (W * 3 + 1));
  for (let y = 0; y < H; y += 1) {
    raw[y * (W * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------------- compose --------------------------------------------------- */

const slugs = Object.keys(POSE_KEYFRAMES).filter((s) => !onlySlug || s === onlySlug);
if (slugs.length === 0) {
  console.error(`No rig sequence for "${onlySlug}". Known: ${Object.keys(POSE_KEYFRAMES).join(", ")}`);
  process.exit(1);
}

const tiles = [];
for (const slug of slugs) {
  const seq = POSE_KEYFRAMES[slug];
  for (let i = 0; i < seq.frames.length; i += 1) {
    const prev = seq.frames[Math.max(0, i - 1)];
    const cur = seq.frames[i];
    const shots = withTween ? [0.45, 1] : [1];
    for (const t of shots)
      for (const view of ["front", "side"]) {
        const pose = normalizePose(lerpPose(prev, cur, easeInOut(t)));
        tiles.push({
          label: `${slug} S${i}${t < 1 ? ` T${Math.round(t * 100)}` : ""} ${view}`,
          px: renderPose(pose, view),
        });
      }
  }
}

const rows = Math.ceil(tiles.length / COLS);
const W = COLS * TILE;
const H = rows * (TILE + LABEL);
const sheet = new Uint8Array(W * H * 3).fill(255);

tiles.forEach((tile, i) => {
  const ox = (i % COLS) * TILE;
  const oy = Math.floor(i / COLS) * (TILE + LABEL);
  drawText(sheet, W, ox + 6, oy + 6, tile.label, [42, 31, 69], 2);
  for (let y = 0; y < TILE; y += 1) {
    const dst = ((oy + LABEL + y) * W + ox) * 3;
    sheet.set(tile.px.subarray(y * TILE * 3, (y + 1) * TILE * 3), dst);
  }
});

fs.writeFileSync(outPath, encodePNG(sheet, W, H));
console.log(`${tiles.length} tiles (${slugs.length} poses) → ${outPath}`);

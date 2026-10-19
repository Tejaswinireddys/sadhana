/**
 * PoseFigurineGL — 3D articulated Human Yoga Instructor stage.
 *
 * A procedurally sculpted human yoga teacher (anatomical proportions, warm skin
 * tone, fitted studio yoga top & high-waisted leggings, sculpted head with hair
 * bun, ears, brow/nose/gaze direction, articulated palms/fingers & bare feet on
 * an alignment-marked yoga mat) whose joints are driven by per-step keyframes,
 * dynamic breath cycles (inhale/exhale ribcage & spinal articulation), and
 * bilateral mirroring.
 *
 * Self-contained:
 *   - no external glTF download or CDN dependency
 *   - lazy-loaded so three.js stays out of the initial bundle
 *   - respects reduced-motion and offscreen pause
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import {
  HIP_HEIGHT,
  SKELETON,
  REST_POSE,
  applyBreath,
  easeInOut,
  lerpPose,
  mirrorPose,
  normalizePose,
  type BoneSpec,
  type JointName,
  type RigPose,
} from "@/lib/poseRig";
import type { PoseSequence } from "@/data/poseKeyframes";

const DEG = Math.PI / 180;
/** Approximate standing height — used to convert focus.y into world units. */
const FIGURE_HEIGHT = 1.72;

export type CameraViewMode = "auto" | "front" | "side";
export type BreathMode = "inhale" | "exhale" | "steady";

export type PoseFigurineGLProps = {
  sequence: PoseSequence;
  /** Index of the narration step currently being spoken. */
  stepIndex: number;
  /** 0–1 progress through that step; drives the tween. */
  stepProgress: number;
  playing: boolean;
  side?: 1 | 2;
  motionEnabled?: boolean;
  /** Optional explicit pose override (e.g. during dynamic Cat–Cow rounds or transitions). */
  overridePose?: RigPose | null;
  /** Optional breath phase synchronization ("inhale" | "exhale" | "steady"). */
  breathMode?: BreathMode;
  /** Optional camera angle preset so students can inspect front or side alignment. */
  cameraView?: CameraViewMode;
  className?: string;
  "data-testid"?: string;
  /** Test hook: render exactly one frame at this state and stop. */
  staticFrame?: boolean;
};

type Built = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  joints: Map<JointName, THREE.Object3D>;
  root: THREE.Group;
  figure: THREE.Group;
  shadow: THREE.Mesh;
  breathRing: THREE.Mesh;
  chestGroup: THREE.Object3D | null;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
};

function buildScene(canvas: HTMLCanvasElement, isDark: boolean): Built {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 40);
  camera.position.set(1.55, 1.15, 3.05);
  camera.lookAt(0, 0.85, 0);

  // Warm studio lighting: soft overhead skylight, warm key light, subtle sage rim.
  const hemi = new THREE.HemisphereLight(
    0xfff8f0,
    isDark ? 0x1e1a28 : 0xdccfc4,
    1.12,
  );
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff5ea, 1.28);
  key.position.set(2.4, 3.6, 2.8);
  scene.add(key);

  const fill = new THREE.DirectionalLight(isDark ? 0x9aa8ff : 0xe4ecff, 0.45);
  fill.position.set(-2.4, 2.0, 1.8);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(isDark ? 0xa390e4 : 0xcbbfb0, 0.58);
  rim.position.set(-2.2, 1.8, -2.4);
  scene.add(rim);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  // 1. Studio floor halo beneath the yoga mat
  const floorGeo = new THREE.CircleGeometry(1.18, 48);
  const floorMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x211d2c : 0xefe8de,
    roughness: 0.96,
    metalness: 0,
    transparent: true,
    opacity: 0.72,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.004;
  scene.add(floor);
  geometries.push(floorGeo);
  materials.push(floorMat);

  // 2. Woven Studio Yoga Mat with Liforme-style alignment lines
  const matGroup = new THREE.Group();
  const matBodyGeo = new THREE.BoxGeometry(1.86, 0.012, 0.78);
  const matBodyMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x352d4d : 0x6f599b,
    roughness: 0.88,
    metalness: 0.02,
  });
  const matBody = new THREE.Mesh(matBodyGeo, matBodyMat);
  matBody.position.y = -0.004;
  matGroup.add(matBody);
  geometries.push(matBodyGeo);
  materials.push(matBodyMat);

  // Alignment centerline & cross-markers on the mat
  const lineMat = new THREE.MeshBasicMaterial({
    color: isDark ? 0xb8a5e8 : 0xe9dff8,
    transparent: true,
    opacity: isDark ? 0.38 : 0.55,
  });
  materials.push(lineMat);

  const centerLineGeo = new THREE.PlaneGeometry(1.62, 0.012);
  const centerLine = new THREE.Mesh(centerLineGeo, lineMat);
  centerLine.rotation.x = -Math.PI / 2;
  centerLine.position.y = 0.003;
  matGroup.add(centerLine);
  geometries.push(centerLineGeo);

  for (const xOff of [-0.58, 0, 0.58]) {
    const crossGeo = new THREE.PlaneGeometry(0.012, 0.52);
    const cross = new THREE.Mesh(crossGeo, lineMat);
    cross.rotation.x = -Math.PI / 2;
    cross.position.set(xOff, 0.003, 0);
    matGroup.add(cross);
    geometries.push(crossGeo);
  }
  scene.add(matGroup);

  // 3. Soft contact shadow & live breath grounding ring
  const shadowGeo = new THREE.CircleGeometry(0.42, 32);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x1b142c,
    transparent: true,
    opacity: isDark ? 0.34 : 0.18,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  scene.add(shadow);
  geometries.push(shadowGeo);
  materials.push(shadowMat);

  const breathRingGeo = new THREE.RingGeometry(0.28, 0.315, 40);
  const breathRingMat = new THREE.MeshBasicMaterial({
    color: isDark ? 0xb79cff : 0x7c5dc9,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.32,
  });
  const breathRing = new THREE.Mesh(breathRingGeo, breathRingMat);
  breathRing.rotation.x = -Math.PI / 2;
  breathRing.position.y = 0.005;
  scene.add(breathRing);
  geometries.push(breathRingGeo);
  materials.push(breathRingMat);

  // 4. Human Yoga Instructor Materials (Skin, Studio Top, Leggings, Hair, Facial Features)
  const skinMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0xe0aa86 : 0xd69a74,
    roughness: 0.56,
    metalness: 0.02,
  });
  const topMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x8f78e6 : 0x5c438b,
    roughness: 0.72,
    metalness: 0.03,
  });
  const leggingsMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x453b63 : 0x2c253f,
    roughness: 0.8,
    metalness: 0.03,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x2a1f1d : 0x231917,
    roughness: 0.65,
    metalness: 0.04,
  });
  const featureMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x3b2822 : 0x36231d,
    roughness: 0.5,
    metalness: 0.02,
  });
  materials.push(skinMat, topMat, leggingsMat, hairMat, featureMat);

  const figure = new THREE.Group();
  scene.add(figure);
  const root = new THREE.Group();
  figure.add(root);

  const joints = new Map<JointName, THREE.Object3D>();
  let chestGroup: THREE.Object3D | null = null;

  const materialForBone = (name: JointName): THREE.Material => {
    switch (name) {
      case "head":
      case "neck":
      case "shoulderL":
      case "shoulderR":
      case "elbowL":
      case "elbowR":
      case "wristL":
      case "wristR":
      case "ankleL":
      case "ankleR":
        return skinMat;
      case "chest":
        return topMat;
      case "spine":
      case "hipL":
      case "hipR":
      case "kneeL":
      case "kneeR":
        return leggingsMat;
    }
  };

  /** Sculpted human segment with anatomical joints, hands, feet, and head/hair. */
  const buildSegment = (bone: BoneSpec, dir: number, material: THREE.Material) => {
    const group = new THREE.Group();
    const sx = bone.sx ?? 1;
    const sz = bone.sz ?? 1;

    if (bone.shape === "head") {
      // Cranium
      const skull = new THREE.SphereGeometry(bone.r0, 28, 22);
      geometries.push(skull);
      const head = new THREE.Mesh(skull, skinMat);
      head.scale.set(sx, 1.12, sz);
      head.position.y = dir * bone.length * 0.44;
      group.add(head);

      // Jaw & chin
      const jawGeo = new THREE.SphereGeometry(bone.r0 * 0.72, 20, 16);
      geometries.push(jawGeo);
      const jaw = new THREE.Mesh(jawGeo, skinMat);
      jaw.scale.set(0.9, 0.78, 1.02);
      jaw.position.set(0, dir * bone.length * 0.24, bone.r0 * 0.14);
      group.add(jaw);

      // Nose bridge (makes head facing / drishti unmistakable)
      const noseGeo = new THREE.SphereGeometry(bone.r0 * 0.19, 12, 10);
      geometries.push(noseGeo);
      const nose = new THREE.Mesh(noseGeo, skinMat);
      nose.scale.set(0.68, 1.15, 1.55);
      nose.position.set(0, dir * bone.length * 0.41, bone.r0 * 0.93);
      group.add(nose);

      // Subtle brow & eyes for clear gaze direction
      for (const sideSign of [-1, 1]) {
        const eyeGeo = new THREE.SphereGeometry(bone.r0 * 0.085, 10, 8);
        geometries.push(eyeGeo);
        const eye = new THREE.Mesh(eyeGeo, featureMat);
        eye.scale.set(1.2, 0.65, 0.5);
        eye.position.set(
          sideSign * bone.r0 * 0.31,
          dir * bone.length * 0.47,
          bone.r0 * 0.84,
        );
        group.add(eye);

        // Ears
        const earGeo = new THREE.SphereGeometry(bone.r0 * 0.18, 10, 8);
        geometries.push(earGeo);
        const ear = new THREE.Mesh(earGeo, skinMat);
        ear.scale.set(0.42, 0.95, 0.65);
        ear.position.set(
          sideSign * bone.r0 * 0.89,
          dir * bone.length * 0.41,
          -bone.r0 * 0.04,
        );
        group.add(ear);
      }

      // Sculpted hair cap + instructor top-back bun
      const hairCapGeo = new THREE.SphereGeometry(bone.r0 * 1.03, 24, 18);
      geometries.push(hairCapGeo);
      const hairCap = new THREE.Mesh(hairCapGeo, hairMat);
      hairCap.scale.set(sx * 1.01, 1.05, sz * 1.02);
      hairCap.position.set(0, dir * bone.length * 0.5, -bone.r0 * 0.12);
      group.add(hairCap);

      const bunGeo = new THREE.SphereGeometry(bone.r0 * 0.44, 16, 14);
      geometries.push(bunGeo);
      const bun = new THREE.Mesh(bunGeo, hairMat);
      bun.position.set(0, dir * bone.length * 0.72, -bone.r0 * 0.78);
      group.add(bun);

      return group;
    }

    if (bone.shape === "slab") {
      const isHand = bone.name === "wristL" || bone.name === "wristR";
      if (isHand) {
        // Articulated palm + fingers + thumb
        const palmLen = bone.length * 0.56;
        const fingerLen = bone.length * 0.46;
        const palmGeo = new THREE.BoxGeometry(
          bone.r0 * 1.95 * sx,
          palmLen,
          bone.r0 * 1.65 * sz,
        );
        geometries.push(palmGeo);
        const palm = new THREE.Mesh(palmGeo, material);
        palm.position.y = (dir * palmLen) / 2;
        group.add(palm);

        const fingersGeo = new THREE.CylinderGeometry(
          bone.r1 * 0.75,
          bone.r0 * 0.9,
          fingerLen,
          12,
        );
        geometries.push(fingersGeo);
        const fingers = new THREE.Mesh(fingersGeo, material);
        fingers.scale.set(sx, 1, sz * 0.85);
        fingers.position.y = dir * (palmLen + fingerLen * 0.45);
        group.add(fingers);

        const thumbSign = bone.name === "wristR" ? 1 : -1;
        const thumbGeo = new THREE.CylinderGeometry(
          bone.r1 * 0.34,
          bone.r0 * 0.42,
          palmLen * 0.82,
          8,
        );
        geometries.push(thumbGeo);
        const thumb = new THREE.Mesh(thumbGeo, material);
        thumb.position.set(
          thumbSign * bone.r0 * sx * 0.95,
          dir * palmLen * 0.48,
          bone.r0 * sz * 0.3,
        );
        thumb.rotation.z = thumbSign * 0.48;
        group.add(thumb);
        return group;
      }

      // Bare foot: sculpted heel, arch/instep, and ball/toes
      const heelGeo = new THREE.SphereGeometry(bone.r0 * 0.82, 14, 10);
      geometries.push(heelGeo);
      const heel = new THREE.Mesh(heelGeo, material);
      heel.scale.set(0.75, 0.7, 0.95);
      heel.position.set(0, dir * bone.length * 0.14, -bone.r0 * 0.18);
      group.add(heel);

      const footGeo = new THREE.CylinderGeometry(
        bone.r1 * 0.95,
        bone.r0 * 0.86,
        bone.length * 0.88,
        14,
      );
      geometries.push(footGeo);
      const foot = new THREE.Mesh(footGeo, material);
      foot.scale.set(sx * 1.15, 1, sz * 1.1);
      foot.position.y = (dir * bone.length) / 2;
      group.add(foot);

      const toeGeo = new THREE.SphereGeometry(bone.r1 * 0.95, 12, 10);
      geometries.push(toeGeo);
      const toes = new THREE.Mesh(toeGeo, material);
      toes.scale.set(sx * 1.22, 0.55, sz * 0.95);
      toes.position.y = dir * bone.length * 0.92;
      group.add(toes);
      return group;
    }

    // Torso and limbs: elliptical tapered cylinder
    const radial = bone.shape === "torso" ? 24 : 16;
    const geo = new THREE.CylinderGeometry(bone.r1, bone.r0, bone.length, radial, 1, false);
    geometries.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.scale.set(sx, 1, sz);
    mesh.position.y = (dir * bone.length) / 2;
    if (dir < 0) mesh.rotation.z = Math.PI;
    group.add(mesh);

    // Add a subtle waistband / top hem detail on spine & chest
    if (bone.name === "spine") {
      const bandGeo = new THREE.CylinderGeometry(
        bone.r1 * 1.015,
        bone.r1 * 1.025,
        bone.length * 0.22,
        24,
      );
      geometries.push(bandGeo);
      const band = new THREE.Mesh(bandGeo, leggingsMat);
      band.scale.set(sx, 1, sz);
      band.position.y = dir * bone.length * 0.88;
      group.add(band);
    }

    if (bone.shape !== "torso") {
      for (const [r, y] of [
        [bone.r0, 0],
        [bone.r1, dir * bone.length],
      ] as const) {
        const capGeo = new THREE.SphereGeometry(r, radial, Math.max(8, radial / 2));
        geometries.push(capGeo);
        const cap = new THREE.Mesh(capGeo, material);
        cap.scale.set(sx, 1, sz);
        cap.position.y = y;
        group.add(cap);
      }
    }
    return group;
  };

  for (const bone of SKELETON) {
    const pivot = new THREE.Group();
    pivot.position.set(bone.offset[0], bone.offset[1], bone.offset[2]);
    const dir = bone.axis === "up" ? 1 : -1;
    const segment = buildSegment(bone, dir, materialForBone(bone.name));
    pivot.add(segment);
    if (bone.name === "chest") {
      chestGroup = segment;
    }
    const parent = bone.parent ? joints.get(bone.parent) : root;
    (parent ?? root).add(pivot);
    joints.set(bone.name, pivot);
  }

  return {
    renderer,
    scene,
    camera,
    joints,
    root,
    figure,
    shadow,
    breathRing,
    chestGroup,
    materials,
    geometries,
  };
}

function applyPose(built: Built, pose: ReturnType<typeof normalizePose>) {
  const { root, joints } = built;
  root.position.set(pose.root.position[0], pose.root.position[1], pose.root.position[2]);
  root.rotation.set(
    pose.root.rotation[0] * DEG,
    pose.root.rotation[1] * DEG,
    pose.root.rotation[2] * DEG,
  );
  for (const bone of SKELETON) {
    const j = joints.get(bone.name);
    if (!j) continue;
    const [x, y, z] = pose.joints[bone.name] ?? [0, 0, 0];
    j.rotation.set(x * DEG, y * DEG, z * DEG);
  }
}

function resolveAzimuth(sequence: PoseSequence, cameraView: CameraViewMode): number {
  if (cameraView === "front") return 0.14;
  if (cameraView === "side") return 1.38;
  return sequence.cameraAzimuth ?? 0.46;
}

export function PoseFigurineGL({
  sequence,
  stepIndex,
  stepProgress,
  playing,
  side = 1,
  motionEnabled = true,
  overridePose = null,
  breathMode = "steady",
  cameraView = "auto",
  className,
  "data-testid": testId,
  staticFrame = false,
}: PoseFigurineGLProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const builtRef = useRef<Built | null>(null);
  const stateRef = useRef({
    stepIndex,
    stepProgress,
    playing,
    side,
    motionEnabled,
    sequence,
    overridePose,
    breathMode,
    cameraView,
  });
  stateRef.current = {
    stepIndex,
    stepProgress,
    playing,
    side,
    motionEnabled,
    sequence,
    overridePose,
    breathMode,
    cameraView,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isDark =
      typeof document !== "undefined" && document.documentElement.classList.contains("dark");

    let built: Built;
    try {
      built = buildScene(canvas, isDark);
    } catch {
      // No WebGL (old device, blocked context). Caller keeps its fallback.
      return;
    }
    builtRef.current = built;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = Math.max(1, parent.clientWidth);
      const h = Math.max(1, parent.clientHeight);
      built.renderer.setSize(w, h, false);
      built.camera.aspect = w / h;
      built.camera.updateProjectionMatrix();
    };
    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (ro && canvas.parentElement) ro.observe(canvas.parentElement);

    let visible = true;
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([e]) => {
              visible = !!e?.isIntersecting;
            },
            { threshold: 0.05 },
          )
        : null;
    if (io && canvas.parentElement) io.observe(canvas.parentElement);

    const camTarget = new THREE.Vector3(0, 0.78, 0);
    const baseAz = resolveAzimuth(stateRef.current.sequence, stateRef.current.cameraView);
    const camPos = new THREE.Vector3(
      Math.sin(baseAz) * 3.05,
      1.12,
      Math.cos(baseAz) * 3.05,
    );
    let raf = 0;
    const start = performance.now();
    let lastRealPaint = -Infinity;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      // Native DOM Event.timeStamp uses Blink's C++ monotonic clock even when
      // JS timers/rAF are faked by Playwright's `page.clock.runFor()`.
      const realNow = typeof Event !== "undefined" ? new Event("").timeStamp : now;
      if (realNow - lastRealPaint < 30) return;
      lastRealPaint = realNow;

      const s = stateRef.current;
      const frames = s.sequence.frames;
      if (frames.length === 0) return;

      const i = Math.max(0, Math.min(frames.length - 1, s.stepIndex));
      const prev = frames[Math.max(0, i - 1)];
      const target = frames[i];

      // The body arrives smoothly into the step and settles like a real teacher
      // demonstrating the posture and holding it steadily.
      const raw = s.motionEnabled ? Math.min(1, Math.max(0, s.stepProgress) / 0.65) : 1;
      const t = easeInOut(raw);

      let pose = s.overridePose
        ? normalizePose(s.overridePose)
        : normalizePose(lerpPose(prev, target, t));

      const breathCyclePhase = ((now - start) / (s.playing ? 5200 : 7400)) % 1;
      if (s.motionEnabled) {
        const effectivePhase =
          s.breathMode === "inhale" || s.breathMode === "exhale"
            ? s.stepProgress
            : breathCyclePhase;
        pose = applyBreath(pose, effectivePhase, s.playing ? 1 : 0.55, s.breathMode);
      }
      applyPose(built, pose);

      // Subtle ribcage expansion on breath so the student sees diaphragmatic breathing
      if (built.chestGroup && s.motionEnabled) {
        const ribWave =
          s.breathMode === "inhale"
            ? Math.sin(Math.min(1, Math.max(0, s.stepProgress)) * (Math.PI / 2))
            : s.breathMode === "exhale"
              ? -0.6 * Math.sin(Math.min(1, Math.max(0, s.stepProgress)) * (Math.PI / 2))
              : Math.sin(breathCyclePhase * Math.PI * 2);
        const expand = 1 + 0.032 * ribWave * (s.playing ? 1 : 0.5);
        built.chestGroup.scale.set(expand, 1, expand * 1.02);
      }

      // Mirror for "other side" without re-authoring keyframes.
      built.figure.scale.x = s.side === 2 ? -1 : 1;

      // Contact shadow & breath ring follow the pelvis and spread with the stance.
      const spread = s.sequence.groundSpread ?? 0.5;
      built.shadow.position.x = pose.root.position[0];
      built.shadow.position.z = pose.root.position[2];
      built.shadow.scale.set(spread * 1.6, 1, spread * 1.15);
      (built.shadow.material as THREE.MeshBasicMaterial).opacity =
        (isDark ? 0.3 : 0.16) * (0.55 + 0.45 * (1 - pose.root.position[1] / HIP_HEIGHT));

      const pulse = s.motionEnabled ? 0.94 + 0.12 * Math.sin(breathCyclePhase * Math.PI * 2) : 1;
      built.breathRing.position.x = pose.root.position[0];
      built.breathRing.position.z = pose.root.position[2];
      built.breathRing.scale.set(spread * 1.45 * pulse, spread * 1.15 * pulse, 1);
      (built.breathRing.material as THREE.MeshBasicMaterial).opacity = s.playing ? 0.34 : 0.18;

      // Camera: ease toward the step's focus height, dolly, and teaching azimuth.
      const focus = s.sequence.focus?.[i];
      const wantY = (focus?.y ?? 0.5) * FIGURE_HEIGHT * 0.9 + 0.12;
      const zoom = focus?.zoom ?? 1;
      const azimuth = resolveAzimuth(s.sequence, s.cameraView);
      const orbit = s.motionEnabled ? Math.sin((now - start) / 9500) * 0.08 : 0;
      const dist = 3.12 / zoom;
      const wantPos = new THREE.Vector3(
        Math.sin(azimuth + orbit) * dist,
        wantY + 0.32,
        Math.cos(azimuth + orbit) * dist,
      );
      const k = s.motionEnabled ? 0.055 : 1;
      camPos.lerp(wantPos, k);
      camTarget.lerp(
        new THREE.Vector3(pose.root.position[0] * 0.45, wantY, pose.root.position[2] * 0.35),
        k,
      );
      built.camera.position.copy(camPos);
      built.camera.lookAt(camTarget);

      built.renderer.render(built.scene, built.camera);
    };

    if (staticFrame) {
      // One deterministic frame for screenshot tests.
      const s = stateRef.current;
      const frames = s.sequence.frames;
      const i = Math.max(0, Math.min(frames.length - 1, s.stepIndex));
      const pose = s.overridePose
        ? normalizePose(s.overridePose)
        : normalizePose(
            lerpPose(
              frames[Math.max(0, i - 1)],
              frames[i],
              easeInOut(Math.min(1, s.stepProgress / 0.65)),
            ),
          );
      applyPose(built, pose);
      built.figure.scale.x = s.side === 2 ? -1 : 1;
      const focus = s.sequence.focus?.[i];
      const wantY = (focus?.y ?? 0.5) * FIGURE_HEIGHT * 0.9 + 0.12;
      const dist = 3.12 / (focus?.zoom ?? 1);
      const azimuth = resolveAzimuth(s.sequence, s.cameraView);
      built.camera.position.set(Math.sin(azimuth) * dist, wantY + 0.32, Math.cos(azimuth) * dist);
      built.camera.lookAt(0, wantY, 0);
      built.renderer.render(built.scene, built.camera);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      built.geometries.forEach((g) => g.dispose());
      built.materials.forEach((m) => m.dispose());
      built.renderer.dispose();
      builtRef.current = null;
    };
    // Rebuild only when the pose identity changes — step changes flow through
    // stateRef, so scrubbing narration never tears down the WebGL context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence, staticFrame]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("block h-full w-full", className)}
      data-testid={testId}
      aria-hidden
    />
  );
}

/** Re-exported so callers can build a static preview without the component. */
export { mirrorPose, REST_POSE, type RigPose };

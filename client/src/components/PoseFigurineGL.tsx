/**
 * PoseFigurineGL — the real 3D teaching stage.
 *
 * A procedurally-built humanoid (three.js Groups + capsule meshes, no external
 * glTF asset) whose joints are driven by per-narration-step keyframes. As the
 * voice speaks a step, the limbs tween from the previous keyframe into that
 * step's shape and settle as the sentence ends — so the figure demonstrates the
 * instruction instead of illustrating it.
 *
 * Deliberately self-contained:
 *   - no model download, no CDN, no draco/ktx pipeline
 *   - lazy-loaded by PoseDemoStage so three.js never lands in the main bundle
 *   - renders on demand (paused when offscreen, when not playing, or when the
 *     user prefers reduced motion) rather than running a permanent rAF loop
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

export type PoseFigurineGLProps = {
  sequence: PoseSequence;
  /** Index of the narration step currently being spoken. */
  stepIndex: number;
  /** 0–1 progress through that step; drives the tween. */
  stepProgress: number;
  playing: boolean;
  side?: 1 | 2;
  motionEnabled?: boolean;
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
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  camera.position.set(1.55, 1.15, 3.05);
  camera.lookAt(0, 0.85, 0);

  // Lighting: one key, one cool fill, one rim. Enough to read the form.
  const hemi = new THREE.HemisphereLight(0xffffff, isDark ? 0x1a1725 : 0xd8cfe6, 1.05);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(2.4, 3.4, 2.6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(isDark ? 0x8f7fd8 : 0xb9a8ff, 0.7);
  rim.position.set(-2.6, 1.6, -2.2);
  scene.add(rim);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  // Mat — gives the figure a floor to stand on so depth reads.
  const matGeo = new THREE.CircleGeometry(0.95, 48);
  const matMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x2c2740 : 0xe8e0f5,
    roughness: 0.95,
    metalness: 0,
    transparent: true,
    opacity: 0.85,
  });
  const mat = new THREE.Mesh(matGeo, matMat);
  mat.rotation.x = -Math.PI / 2;
  mat.position.y = -0.001;
  scene.add(mat);
  geometries.push(matGeo);
  materials.push(matMat);

  // Cheap contact shadow — a dark ellipse, scaled per pose.
  const shadowGeo = new THREE.CircleGeometry(0.4, 32);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x2a1f45,
    transparent: true,
    opacity: isDark ? 0.32 : 0.17,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  scene.add(shadow);
  geometries.push(shadowGeo);
  materials.push(shadowMat);

  // Figure
  const figure = new THREE.Group();
  scene.add(figure);
  const root = new THREE.Group();
  figure.add(root);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0xc9bcf5 : 0x7b62c9,
    roughness: 0.52,
    metalness: 0.04,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0xe0d6ff : 0x6b52ba,
    roughness: 0.45,
    metalness: 0.04,
  });
  materials.push(bodyMat, headMat);

  const joints = new Map<JointName, THREE.Object3D>();

  /** A tapered, elliptical limb segment plus a sphere at each end to blend it. */
  const buildSegment = (bone: BoneSpec, dir: number, material: THREE.Material) => {
    const group = new THREE.Group();
    const sx = bone.sx ?? 1;
    const sz = bone.sz ?? 1;

    if (bone.shape === "head") {
      // Slightly ovoid skull + a nose so the facing direction is unmistakable.
      const skull = new THREE.SphereGeometry(bone.r0, 28, 22);
      geometries.push(skull);
      const head = new THREE.Mesh(skull, material);
      head.scale.set(sx, 1.12, sz);
      head.position.y = dir * bone.length * 0.44;
      group.add(head);

      const jawGeo = new THREE.SphereGeometry(bone.r0 * 0.72, 20, 16);
      geometries.push(jawGeo);
      const jaw = new THREE.Mesh(jawGeo, material);
      jaw.scale.set(0.92, 0.78, 1.02);
      jaw.position.set(0, dir * bone.length * 0.24, bone.r0 * 0.14);
      group.add(jaw);

      const noseGeo = new THREE.SphereGeometry(bone.r0 * 0.2, 12, 10);
      geometries.push(noseGeo);
      const nose = new THREE.Mesh(noseGeo, material);
      nose.scale.set(0.7, 1.1, 1.5);
      nose.position.set(0, dir * bone.length * 0.4, bone.r0 * 0.92);
      group.add(nose);
      return group;
    }

    if (bone.shape === "slab") {
      // Hands and feet: flattened boxes with rounded ends read far better than
      // another capsule, and they tell you where the weight is going.
      const geo = new THREE.BoxGeometry(bone.r0 * 2 * sx, bone.length, bone.r0 * 2 * sz);
      geometries.push(geo);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.y = (dir * bone.length) / 2;
      group.add(mesh);
      return group;
    }

    // Torso and limbs: a cone frustum, squashed into an ellipse.
    const radial = bone.shape === "torso" ? 24 : 16;
    const geo = new THREE.CylinderGeometry(bone.r1, bone.r0, bone.length, radial, 1, false);
    geometries.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.scale.set(sx, 1, sz);
    mesh.position.y = (dir * bone.length) / 2;
    if (dir < 0) mesh.rotation.z = Math.PI; // keep r0 at the joint end
    group.add(mesh);

    // End caps blend consecutive limb bones at the joint. The torso is authored
    // as one continuous taper (spine r1 === chest r0), so capping it would just
    // add the bulges we removed.
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
    pivot.add(buildSegment(bone, dir, bone.shape === "head" ? headMat : bodyMat));
    const parent = bone.parent ? joints.get(bone.parent) : root;
    (parent ?? root).add(pivot);
    joints.set(bone.name, pivot);
  }

  return { renderer, scene, camera, joints, root, figure, shadow, materials, geometries };
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

export function PoseFigurineGL({
  sequence,
  stepIndex,
  stepProgress,
  playing,
  side = 1,
  motionEnabled = true,
  className,
  "data-testid": testId,
  staticFrame = false,
}: PoseFigurineGLProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const builtRef = useRef<Built | null>(null);
  const stateRef = useRef({ stepIndex, stepProgress, playing, side, motionEnabled, sequence });
  stateRef.current = { stepIndex, stepProgress, playing, side, motionEnabled, sequence };

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
        ? new IntersectionObserver(([e]) => {
            visible = !!e?.isIntersecting;
          }, { threshold: 0.05 })
        : null;
    if (io && canvas.parentElement) io.observe(canvas.parentElement);

    const camTarget = new THREE.Vector3(0, 0.85, 0);
    const camPos = new THREE.Vector3(1.55, 1.15, 3.05);
    let raf = 0;
    const start = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;

      const s = stateRef.current;
      const frames = s.sequence.frames;
      if (frames.length === 0) return;

      const i = Math.max(0, Math.min(frames.length - 1, s.stepIndex));
      const prev = frames[Math.max(0, i - 1)];
      const target = frames[i];

      // The body should arrive before the sentence ends — a teacher demonstrates
      // early and holds. Compress the tween into the first 65% of the step.
      const raw = s.motionEnabled ? Math.min(1, Math.max(0, s.stepProgress) / 0.65) : 1;
      const t = easeInOut(raw);

      let pose = normalizePose(lerpPose(prev, target, t));
      if (s.motionEnabled) {
        const breathPhase = ((now - start) / (s.playing ? 5200 : 7400)) % 1;
        pose = applyBreath(pose, breathPhase, s.playing ? 1 : 0.55);
      }
      applyPose(built, pose);

      // Mirror for "other side" without re-authoring keyframes.
      built.figure.scale.x = s.side === 2 ? -1 : 1;

      // Contact shadow follows the pelvis and spreads with the stance.
      const spread = s.sequence.groundSpread ?? 0.5;
      built.shadow.position.x = pose.root.position[0];
      built.shadow.position.z = pose.root.position[2];
      built.shadow.scale.set(spread * 1.6, 1, spread * 1.15);
      (built.shadow.material as THREE.MeshBasicMaterial).opacity =
        (isDark ? 0.3 : 0.16) * (0.55 + 0.45 * (1 - pose.root.position[1] / HIP_HEIGHT));

      // Camera: ease toward the step's focus height and dolly.
      const focus = s.sequence.focus?.[i];
      const wantY = (focus?.y ?? 0.5) * FIGURE_HEIGHT * 0.92 + 0.1;
      const zoom = focus?.zoom ?? 1;
      const orbit = s.motionEnabled ? Math.sin((now - start) / 9000) * 0.16 : 0;
      const dist = 3.15 / zoom;
      const wantPos = new THREE.Vector3(
        Math.sin(0.46 + orbit) * dist,
        wantY + 0.34,
        Math.cos(0.46 + orbit) * dist,
      );
      const k = s.motionEnabled ? 0.045 : 1;
      camPos.lerp(wantPos, k);
      camTarget.lerp(new THREE.Vector3(pose.root.position[0] * 0.5, wantY, 0), k);
      built.camera.position.copy(camPos);
      built.camera.lookAt(camTarget);

      built.renderer.render(built.scene, built.camera);
    };

    if (staticFrame) {
      // One deterministic frame for screenshot tests.
      const s = stateRef.current;
      const frames = s.sequence.frames;
      const i = Math.max(0, Math.min(frames.length - 1, s.stepIndex));
      const pose = normalizePose(
        lerpPose(frames[Math.max(0, i - 1)], frames[i], easeInOut(Math.min(1, s.stepProgress / 0.65))),
      );
      applyPose(built, pose);
      built.figure.scale.x = s.side === 2 ? -1 : 1;
      const focus = s.sequence.focus?.[i];
      const wantY = (focus?.y ?? 0.5) * FIGURE_HEIGHT * 0.92 + 0.1;
      const dist = 3.15 / (focus?.zoom ?? 1);
      built.camera.position.set(Math.sin(0.46) * dist, wantY + 0.34, Math.cos(0.46) * dist);
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

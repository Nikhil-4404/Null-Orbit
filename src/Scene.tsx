import {
  Component,
  memo,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { DEFAULT_DESIGN, type SceneDesign, type SceneExporter } from "./design";
import { applyStudioAppearance } from "./studio-appearance";
import { prepareCaptureFrame } from "./capture-renderer";
import {
  assertAnimationSupported,
  recordAnimation,
  validateAnimationOptions,
} from "./animation";

export type RealityMode = "solid" | "liquid" | "signal";

type SceneProps = {
  mode: RealityMode;
  reducedMotion: boolean;
  progress: RefObject<number>;
  burst: number;
  onReady: () => void;
  onUnavailable: () => void;
  studio?: boolean;
  design?: SceneDesign;
  exporterRef?: RefObject<SceneExporter | null>;
  onPoseChange?: (
    pose: Pick<SceneDesign, "rotationX" | "rotationY" | "rotationZ">,
  ) => void;
};

const TAU = Math.PI * 2;
const ORANGE = "#ff4b24";

function random(seed: number) {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/** A solid, gently twisted strip, with deliberately blunt machined edges. */
function ribbon(
  radius: number,
  width: number,
  thickness: number,
  start: number,
  length: number,
  phase = 0,
) {
  const steps = Math.ceil(length * 32);
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = start + (i / steps) * length;
    const twist = Math.sin(angle * 2 + phase) * 0.38;
    const wobble = Math.sin(angle * 3 + phase) * 0.035;
    for (const [r, d] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      const radial =
        radius +
        r * width * 0.5 * Math.cos(twist) +
        d * thickness * 0.5 * Math.sin(twist);
      positions.push(
        Math.cos(angle) * radial,
        Math.sin(angle) * radial,
        wobble +
          d * thickness * 0.5 * Math.cos(twist) -
          r * width * 0.5 * Math.sin(twist),
      );
    }
    if (i < steps) {
      const k = i * 4;
      for (let side = 0; side < 4; side++) {
        const next = (side + 1) % 4;
        indices.push(
          k + side,
          k + next,
          k + side + 4,
          k + next,
          k + next + 4,
          k + side + 4,
        );
      }
    }
  }
  const end = steps * 4;
  indices.push(0, 2, 1, 0, 3, 2, end, end + 1, end + 2, end, end + 2, end + 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function combinedRibbons(
  radius: number,
  width: number,
  count: number,
  gap: number,
  phase = 0,
) {
  const geometries = Array.from({ length: count }, (_, index) =>
    ribbon(
      radius,
      width,
      0.065,
      phase + (index * TAU) / count,
      TAU / count - gap,
      index * 0.41,
    ),
  );
  const geometry = mergeGeometries(geometries)!;
  geometries.forEach((part) => part.dispose());
  return geometry;
}

const coreVertex = `
  uniform float uTime;
  uniform float uLiquid;
  uniform float uBurst;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorld;
  void main() {
    vec3 p = position;
    float wave = sin(p.x * 9.0 + uTime * 1.4) * sin(p.y * 10.0 - uTime) * sin(p.z * 9.0 + uTime * 0.7);
    p += normal * (wave * (0.025 + uLiquid * 0.065) + uBurst * 0.04);
    vPosition = p;
    vNormal = normalize(normalMatrix * normal);
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    vWorld = -view.xyz;
    gl_Position = projectionMatrix * view;
  }
`;

const coreFragment = `
  uniform float uTime;
  uniform float uSignal;
  uniform float uBurst;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorld;
  void main() {
    vec3 n = normalize(vNormal);
    float facing = max(dot(n, normalize(vWorld)), 0.0);
    float fresnel = pow(1.0 - facing, 2.2);
    float filaments = pow(0.5 + 0.5 * sin(vPosition.y * 41.0 + sin(vPosition.x * 13.0 + uTime) * 2.5 + uTime * 0.8), 13.0);
    float pulse = 0.5 + 0.5 * sin(vPosition.x * 25.0 + vPosition.z * 19.0 - uTime);
    vec3 lava = mix(vec3(0.25, 0.016, 0.002), vec3(1.0, 0.12, 0.025), fresnel + filaments * 0.8);
    lava += vec3(1.0, 0.66, 0.29) * pow(filaments, 2.0) * 0.65;
    vec3 signal = vec3(0.56, 0.72, 0.51) * (fresnel * 0.9 + filaments * 0.6 + pulse * 0.06);
    vec3 color = mix(lava, signal, uSignal) * (1.0 + uBurst * 0.7);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const glowVertex = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const glowFragment = `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    float d = distance(vUv, vec2(0.5)) * 2.0;
    float glow = pow(max(0.0, 1.0 - d), 3.2);
    gl_FragColor = vec4(uColor, glow * uOpacity);
  }
`;

function Studio({
  accent = "#ff542c",
  lighting = 1,
}: { accent?: string; lighting?: number } = {}) {
  return (
    <Environment resolution={128} frames={1}>
      <Lightformer
        intensity={5 * lighting}
        position={[-4, 4, 3]}
        rotation={[0, Math.PI / 4, 0]}
        scale={[3, 6, 1]}
        color="#e8edff"
      />
      <Lightformer
        intensity={3.5 * lighting}
        position={[4, 2, 1]}
        rotation={[0, -Math.PI / 3, 0]}
        scale={[2, 7, 1]}
        color="#ffffff"
      />
      <Lightformer
        intensity={2.5 * lighting}
        position={[0, 5, -2]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[7, 2, 1]}
        color="#ffffff"
      />
      <Lightformer
        intensity={4 * lighting}
        position={[-2, -3, 1]}
        rotation={[0, Math.PI / 5, 0]}
        scale={[3, 1, 1]}
        color={accent}
      />
      <Lightformer
        intensity={3 * lighting}
        position={[1, 0, -5]}
        scale={[2, 5, 1]}
        color="#a4acb5"
      />
    </Environment>
  );
}

function Machine({
  mode,
  reducedMotion,
  progress,
  burst,
  onReady,
  onUnavailable,
}: SceneProps) {
  const root = useRef<THREE.Group>(null);
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const heart = useRef<THREE.Group>(null);
  const fins = useRef<THREE.InstancedMesh>(null);
  const satellite = useRef<THREE.Mesh>(null);
  const tracer = useRef<THREE.Mesh>(null);
  const { gl, size, invalidate } = useThree();
  const gesture = useRef({
    x: 0,
    y: 0,
    rx: 0,
    ry: 0,
    down: false,
    lastX: 0,
    lastY: 0,
  });
  const triggered = useRef(0);
  const rendered = useRef(false);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLiquid: { value: 0 },
      uSignal: { value: 0 },
      uBurst: { value: 0 },
    }),
    [],
  );
  const geometries = useMemo(
    () => ({
      outer: combinedRibbons(1.72, 0.31, 7, 0.105, 0.08),
      inner: combinedRibbons(1.28, 0.23, 3, 0.16, 0.37),
      middle: ribbon(1.52, 0.12, 0.075, -0.25, 4.7, 1),
      rim: ribbon(1.94, 0.028, 0.025, 0.25, 4.4),
      coreShell: new THREE.SphereGeometry(
        0.79,
        40,
        24,
        0.1,
        Math.PI * 1.45,
        0.22,
        Math.PI * 0.86,
      ),
      signal: new THREE.BufferGeometry(),
      dust: new THREE.BufferGeometry(),
    }),
    [],
  );

  const metal = useMemo(() => {
    const material = new THREE.MeshPhysicalMaterial({
      color: "#b9bec6",
      metalness: 1,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.25,
      side: THREE.DoubleSide,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uLiquid = uniforms.uLiquid;
      shader.uniforms.uBurst = uniforms.uBurst;
      shader.vertexShader = `uniform float uTime; uniform float uLiquid; uniform float uBurst;\n${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
        #include <begin_vertex>
        float wave = sin(position.x * 3.5 + uTime * 0.8) * sin(position.y * 4.0 - uTime * 0.6);
        transformed += normal * wave * uLiquid * 0.13;
        transformed *= 1.0 + uBurst * 0.025;
      `,
      );
    };
    material.customProgramCacheKey = () => "null-orbit-liquid-v1";
    return material;
  }, [uniforms]);
  const darkMetal = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#33363a",
        metalness: 1,
        roughness: 0.31,
      }),
    [],
  );
  const red = useMemo(
    () => new THREE.MeshBasicMaterial({ color: ORANGE, toneMapped: false }),
    [],
  );
  const core = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: coreVertex,
        fragmentShader: coreFragment,
      }),
    [uniforms],
  );
  const haze = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color("#ef3818") },
          uOpacity: { value: 0.22 },
        },
        vertexShader: glowVertex,
        fragmentShader: glowFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const signalMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: "#d4ebbb",
        size: 0.012,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.05,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const dustMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: "#c1c3c5",
        size: 0.008,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    const vector = new THREE.Object3D();
    let instance = 0;
    for (let i = 0; i < 96; i++) {
      const theta = (i / 96) * TAU;
      // Missing teeth line up with the breaks in the outer forged ribbon.
      if ((theta - 0.08 + TAU) % (TAU / 7) > TAU / 7 - 0.115) continue;
      const radius = 1.74 + random(i) * 0.055;
      vector.position.set(
        Math.cos(theta) * radius,
        Math.sin(theta) * radius,
        0.095 + Math.sin(theta * 3) * 0.035,
      );
      vector.rotation.set(0, 0, theta - Math.PI / 2);
      vector.scale.set(1, 0.65 + random(i + 9) * 0.7, 1);
      vector.updateMatrix();
      fins.current?.setMatrixAt(instance++, vector.matrix);
    }
    if (fins.current) {
      fins.current.count = instance;
      fins.current.instanceMatrix.needsUpdate = true;
    }

    const particles: number[] = [];
    for (let i = 0; i < 620; i++) {
      const angle = random(i + 50) * TAU;
      const elevation = Math.acos(2 * random(i + 700) - 1);
      const r = 0.85 + random(i + 1200) * 1.15;
      particles.push(
        r * Math.sin(elevation) * Math.cos(angle),
        r * Math.cos(elevation),
        r * Math.sin(elevation) * Math.sin(angle),
      );
    }
    geometries.signal.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(particles, 3),
    );
    const stars: number[] = [];
    for (let i = 0; i < 190; i++)
      stars.push(
        (random(i + 2000) - 0.5) * 20,
        (random(i + 4000) - 0.5) * 12,
        -3 - random(i + 6000) * 8,
      );
    geometries.dust.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(stars, 3),
    );
    invalidate();
  }, [geometries, invalidate]);

  useEffect(() => {
    const signal = mode === "signal";
    metal.color.set(
      signal ? "#d6e0bd" : mode === "liquid" ? "#a7a3a0" : "#b9bec6",
    );
    metal.wireframe = signal;
    metal.roughness = mode === "liquid" ? 0.095 : 0.22;
    metal.envMapIntensity = signal ? 0.8 : 1.25;
    metal.emissive.set(signal ? "#667555" : "#000000");
    metal.emissiveIntensity = signal ? 0.5 : 0;
    darkMetal.wireframe = signal;
    darkMetal.color.set(signal ? "#7d8b64" : "#33363a");
    red.color.set(signal ? "#cfe6b1" : ORANGE);
    haze.uniforms.uColor.value.set(signal ? "#8aaf68" : "#ef3818");
    uniforms.uSignal.value = signal ? 1 : 0;
    signalMaterial.opacity = signal ? 0.72 : mode === "liquid" ? 0.18 : 0.045;
    invalidate();
  }, [mode, metal, darkMetal, red, haze, uniforms, signalMaterial, invalidate]);

  useEffect(() => {
    if (burst > 0) triggered.current = 1;
    invalidate();
  }, [burst, invalidate]);

  useEffect(() => {
    const canvas = gl.domElement;
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      gesture.current.down = true;
      gesture.current.lastX = event.clientX;
      gesture.current.lastY = event.clientY;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(event.pointerId);
      invalidate();
    };
    const pointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const state = gesture.current;
      state.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      state.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      if (state.down) {
        state.ry += (event.clientX - state.lastX) * 0.007;
        state.rx = THREE.MathUtils.clamp(
          state.rx + (event.clientY - state.lastY) * 0.005,
          -0.8,
          0.8,
        );
        state.lastX = event.clientX;
        state.lastY = event.clientY;
      }
      invalidate();
    };
    const pointerUp = () => {
      gesture.current.down = false;
      canvas.style.cursor = "grab";
      invalidate();
    };
    const pointerLeave = () => {
      if (!gesture.current.down) {
        gesture.current.x = 0;
        gesture.current.y = 0;
        invalidate();
      }
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      onUnavailable();
    };
    const scroll = () => invalidate();
    canvas.style.cursor = "grab";
    // A vertical touch remains available for normal page scrolling.
    canvas.style.touchAction = "pan-y";
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("pointerleave", pointerLeave);
    canvas.addEventListener("webglcontextlost", contextLost);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("pointerleave", pointerLeave);
      canvas.removeEventListener("webglcontextlost", contextLost);
      window.removeEventListener("scroll", scroll);
    };
  }, [gl, invalidate, onUnavailable]);

  useEffect(
    () => () => {
      Object.values(geometries).forEach((geometry) => geometry.dispose());
      [metal, darkMetal, red, core, haze, signalMaterial, dustMaterial].forEach(
        (material) => material.dispose(),
      );
    },
    [
      geometries,
      metal,
      darkMetal,
      red,
      core,
      haze,
      signalMaterial,
      dustMaterial,
    ],
  );

  useFrame(({ clock }, frameDelta) => {
    if (!root.current || !outer.current || !inner.current || !heart.current)
      return;
    const delta = Math.min(frameDelta, 0.05);
    const time = reducedMotion ? 0 : clock.elapsedTime;
    const scroll = THREE.MathUtils.clamp(progress.current || 0, 0, 1);
    const mobile = size.width < 760;
    // Mobile artwork belongs below the hero copy in page space. A fixed world
    // offset would put it over the title on short, wide browser viewports.
    const unitsPerPixel =
      (2 * Math.tan(THREE.MathUtils.degToRad(20)) * 8.6) / size.height;
    const mobileTitleSize =
      size.width <= 380
        ? size.width * 0.238
        : THREE.MathUtils.clamp(size.width * 0.238, 82, 152);
    const mobileTop = Math.max(550, 270 + mobileTitleSize * 2.4);
    const mobileBottom = size.width <= 380 ? 850 : 900;
    const mobileRadius = Math.min(
      size.width * 0.435,
      170,
      (mobileBottom - mobileTop) / 2,
    );
    const mobileCenter = mobileTop + mobileRadius - window.scrollY;
    const desiredScale = mobile
      ? (mobileRadius * unitsPerPixel) / 2.32
      : (size.width < 1100 ? 0.93 : 1.07) * (1 - scroll * 0.08);
    const pulse = triggered.current;
    triggered.current = THREE.MathUtils.damp(triggered.current, 0, 3.5, delta);
    uniforms.uBurst.value = pulse;
    uniforms.uTime.value = time;
    uniforms.uLiquid.value = THREE.MathUtils.damp(
      uniforms.uLiquid.value,
      mode === "liquid" ? 1 : 0,
      3.5,
      delta,
    );

    const scale = desiredScale * (1 + pulse * (reducedMotion ? 0.012 : 0.085));
    root.current.scale.setScalar(scale);
    root.current.position.set(
      mobile ? 0 : 1.7 - scroll * 0.35,
      mobile
        ? (size.height / 2 - mobileCenter) * unitsPerPixel
        : 0.04 + scroll * 0.12,
      0,
    );
    const pitch =
      0.28 + gesture.current.rx + gesture.current.y * 0.065 + scroll * 0.1;
    const yaw =
      -0.32 + gesture.current.ry + gesture.current.x * 0.13 + scroll * 0.45;
    root.current.rotation.x = THREE.MathUtils.damp(
      root.current.rotation.x,
      pitch,
      4,
      delta,
    );
    root.current.rotation.y = THREE.MathUtils.damp(
      root.current.rotation.y,
      yaw,
      4,
      delta,
    );
    root.current.rotation.z =
      -0.32 + (reducedMotion ? 0 : Math.sin(time * 0.14) * 0.035);
    outer.current.rotation.z = time * 0.033;
    inner.current.rotation.set(
      0.78 + Math.sin(time * 0.12) * 0.05,
      -0.52,
      -0.55 - time * 0.055,
    );
    heart.current.rotation.set(0.32, time * 0.095 + 0.4, -0.25);
    if (satellite.current) {
      const a = time * 0.21 + 0.6;
      satellite.current.position.set(Math.cos(a) * 2.16, Math.sin(a) * 2.16, 0);
    }
    if (tracer.current) {
      const a = -time * 0.16 + 3.4;
      tracer.current.position.set(Math.cos(a) * 2.32, Math.sin(a) * 2.32, 0);
    }
    haze.uniforms.uOpacity.value =
      (mode === "signal" ? 0.08 : 0.19) + pulse * 0.18;

    if (!rendered.current) {
      rendered.current = true;
      requestAnimationFrame(onReady);
    }
    if (
      reducedMotion &&
      (Math.abs(root.current.rotation.x - pitch) > 0.0005 ||
        Math.abs(root.current.rotation.y - yaw) > 0.0005 ||
        Math.abs(uniforms.uLiquid.value - (mode === "liquid" ? 1 : 0)) >
          0.001 ||
        triggered.current > 0.001)
    )
      invalidate();
  });

  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight
        position={[0, 0, 4]}
        color="#f4f3f2"
        intensity={9}
        distance={12}
      />
      <pointLight
        position={[1.7, -0.2, 0.8]}
        color={mode === "signal" ? "#abc78a" : ORANGE}
        intensity={4.5}
        distance={5}
      />
      <Suspense fallback={null}>
        <Studio />
      </Suspense>
      <points geometry={geometries.dust} material={dustMaterial} />
      <group ref={root} position={[1.7, 0, 0]} rotation={[0.28, -0.32, -0.32]}>
        <mesh position={[0, 0, -0.9]} material={haze}>
          <planeGeometry args={[5.2, 5.2]} />
        </mesh>
        <group ref={outer}>
          <mesh geometry={geometries.outer} material={metal} />
          <mesh
            geometry={geometries.rim}
            material={metal}
            position={[0, 0, -0.055]}
          />
          <instancedMesh ref={fins} args={[undefined, metal, 96]}>
            <boxGeometry args={[0.047, 0.23, 0.075]} />
          </instancedMesh>
          <mesh
            rotation={[0, 0, -0.15]}
            position={[0, 0, -0.115]}
            material={darkMetal}
          >
            <torusGeometry args={[1.73, 0.045, 8, 140, 5.5]} />
          </mesh>
          <mesh rotation={[0, 0, 0.35]} position={[0, 0, 0.085]} material={red}>
            <torusGeometry args={[1.545, 0.006, 5, 120, 4.65]} />
          </mesh>
        </group>
        <group ref={inner} rotation={[0.78, -0.52, -0.55]}>
          <mesh geometry={geometries.inner} material={metal} />
          <mesh material={darkMetal} rotation={[0, 0, 0.16]}>
            <torusGeometry args={[1.125, 0.022, 8, 120, 5.55]} />
          </mesh>
          <mesh material={red} rotation={[0, 0, 0.7]} position={[0, 0, 0.045]}>
            <torusGeometry args={[1.29, 0.007, 6, 100, 4.9]} />
          </mesh>
        </group>
        <group rotation={[1.05, 0.75, -0.8]}>
          <mesh geometry={geometries.middle} material={metal} />
          <mesh material={darkMetal}>
            <torusGeometry args={[1.48, 0.018, 6, 100, 4.9]} />
          </mesh>
        </group>
        <group ref={heart}>
          <mesh geometry={geometries.coreShell} material={metal} />
          <mesh material={core}>
            <sphereGeometry args={[0.635, 48, 40]} />
          </mesh>
          <mesh rotation={[0.55, 0.6, 0.3]} material={red}>
            <torusGeometry args={[0.91, 0.009, 6, 100, 4.4]} />
          </mesh>
        </group>
        <points geometry={geometries.signal} material={signalMaterial} />
        <group rotation={[0.52, -0.35, 0.12]}>
          <mesh material={red} rotation={[0, 0, 0.5]}>
            <torusGeometry args={[2.16, 0.004, 5, 160, 4.8]} />
          </mesh>
          <mesh ref={satellite} material={red}>
            <sphereGeometry args={[0.035, 10, 8]} />
          </mesh>
        </group>
        <group rotation={[-0.75, 0.15, -0.42]}>
          <mesh material={darkMetal} rotation={[0, 0, -0.4]}>
            <torusGeometry args={[2.32, 0.006, 5, 160, 5.3]} />
          </mesh>
          <mesh ref={tracer} material={metal}>
            <sphereGeometry args={[0.045, 10, 8]} />
          </mesh>
        </group>
      </group>
    </>
  );
}

/** Independent studio renderer: the landing-page choreography above stays intact. */
function helixGeometry(radius: number, tube: number, phase = 0) {
  const points = Array.from({ length: 181 }, (_, index) => {
    const progress = index / 180;
    const angle = progress * TAU * 1.7 + phase;
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      (progress - 0.5) * 4.25,
      Math.sin(angle) * radius,
    );
  });
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points),
    220,
    tube,
    12,
    false,
  );
}

const studioCoreFragment = coreFragment
  .replace(
    "uniform float uTime;",
    "uniform float uTime;\n  uniform vec3 uAccent;",
  )
  .replace(
    "vec3 lava = mix(vec3(0.25, 0.016, 0.002), vec3(1.0, 0.12, 0.025), fresnel + filaments * 0.8);",
    "vec3 lava = mix(uAccent * 0.12, uAccent * 1.8, fresnel + filaments * 0.8);",
  )
  .replace("vec3(1.0, 0.66, 0.29)", "mix(uAccent, vec3(1.0), 0.45)")
  .replace("vec3(0.56, 0.72, 0.51)", "mix(uAccent, vec3(0.85), 0.22)");

// Export progress must not recapture six reflection faces for every video frame.
const StudioReflection = memo(Studio);

function WallpaperMachine({
  design = DEFAULT_DESIGN,
  reducedMotion,
  exporterRef,
  onReady,
  onUnavailable,
  onPoseChange,
}: SceneProps) {
  const { gl, scene, camera, size, invalidate, get } = useThree();
  const root = useRef<THREE.Group>(null);
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const heart = useRef<THREE.Group>(null);
  const currentDesign = useRef(design);
  const callbacks = useRef({ onReady, onUnavailable, onPoseChange });
  currentDesign.current = design;
  callbacks.current = { onReady, onUnavailable, onPoseChange };
  const busy = useRef(false);
  const ready = useRef(false);
  const elapsed = useRef(0);
  const frameCount = useRef(0);
  const readyRequest = useRef(0);
  const drag = useRef({ down: false, x: 0, y: 0, rx: 0, ry: 0, pointerId: -1 });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLiquid: { value: 0 },
      uSignal: { value: 0 },
      uBurst: { value: 0 },
      uAccent: { value: new THREE.Color(DEFAULT_DESIGN.accent) },
    }),
    [],
  );
  const geometries = useMemo(
    () => ({
      outer: combinedRibbons(1.72, 0.31, 7, 0.105, 0.08),
      inner: combinedRibbons(1.28, 0.23, 3, 0.16, 0.37),
      middle: ribbon(1.52, 0.12, 0.075, -0.25, 4.7, 1),
      rim: ribbon(1.94, 0.028, 0.025, 0.25, 4.4),
      shell: new THREE.SphereGeometry(
        0.79,
        40,
        24,
        0.1,
        Math.PI * 1.45,
        0.22,
        Math.PI * 0.86,
      ),
      core: new THREE.SphereGeometry(0.635, 48, 40),
      disc: new THREE.TorusGeometry(1.76, 0.16, 12, 160),
      eclipse: combinedRibbons(2.03, 0.24, 2, 0.18, 0.4),
      helix: helixGeometry(1.18, 0.125),
      helixSecond: helixGeometry(1.18, 0.125, Math.PI),
      helixTrace: helixGeometry(1.35, 0.012, 0.3),
      signal: new THREE.BufferGeometry(),
      dust: new THREE.BufferGeometry(),
    }),
    [],
  );
  const metal = useMemo(() => {
    const material = new THREE.MeshPhysicalMaterial({
      color: "#b9bec6",
      metalness: 1,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.25,
      side: THREE.DoubleSide,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uLiquid = uniforms.uLiquid;
      shader.vertexShader = `uniform float uTime; uniform float uLiquid;\n${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
        #include <begin_vertex>
        float wave = sin(position.x * 3.5 + uTime * 0.8) * sin(position.y * 4.0 - uTime * 0.6);
        transformed += normal * wave * uLiquid * 0.13;
      `,
      );
    };
    material.customProgramCacheKey = () => "null-orbit-studio-liquid-v1";
    return material;
  }, [uniforms]);
  const darkMetal = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#30343b",
        metalness: 1,
        roughness: 0.31,
      }),
    [],
  );
  const accentMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ toneMapped: false }),
    [],
  );
  const core = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: coreVertex,
        fragmentShader: studioCoreFragment,
      }),
    [uniforms],
  );
  const haze = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color() },
          uOpacity: { value: 0.16 },
        },
        vertexShader: glowVertex,
        fragmentShader: glowFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const signalMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.016,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const dustMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: "#c1c3c5",
        size: 0.014,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    [],
  );

  useLayoutEffect(() => {
    elapsed.current = 0;
    const particles: number[] = [];
    const stars: number[] = [];
    for (let index = 0; index < 880; index++) {
      const angle = random(index + design.seed) * TAU;
      const elevation = Math.acos(2 * random(index + design.seed + 700) - 1);
      const radius = 0.85 + random(index + design.seed + 1200) * 1.6;
      particles.push(
        radius * Math.sin(elevation) * Math.cos(angle),
        radius * Math.cos(elevation),
        radius * Math.sin(elevation) * Math.sin(angle),
      );
    }
    for (let index = 0; index < 380; index++) {
      stars.push(
        (random(index + design.seed + 2000) - 0.5) * 22,
        (random(index + design.seed + 4000) - 0.5) * 16,
        -3 - random(index + design.seed + 6000) * 8,
      );
    }
    geometries.signal.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(particles, 3),
    );
    geometries.dust.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(stars, 3),
    );
    invalidate();
  }, [design.seed, geometries, invalidate]);

  const appearance = useMemo(
    () => ({
      metal,
      darkMetal,
      accentMaterial,
      haze,
      uniforms,
      signalMaterial,
      dustMaterial,
      signalGeometry: geometries.signal,
      dustGeometry: geometries.dust,
    }),
    [
      metal,
      darkMetal,
      accentMaterial,
      haze,
      uniforms,
      signalMaterial,
      dustMaterial,
      geometries,
    ],
  );

  useLayoutEffect(() => {
    // Update before the next painted frame; export also reapplies this same
    // complete appearance synchronously, independent of effect timing.
    applyStudioAppearance(design, appearance);
    invalidate();
  }, [design, appearance, invalidate]);

  useEffect(() => {
    drag.current.rx = 0;
    drag.current.ry = 0;
    invalidate();
  }, [design.rotationX, design.rotationY, design.rotationZ, invalidate]);

  useEffect(() => {
    // Zoom, pause, and background must also redraw in reduced-motion mode.
    invalidate();
  }, [design, invalidate]);

  useEffect(() => {
    const canvas = gl.domElement;
    const normalize = (radians: number) =>
      ((((THREE.MathUtils.radToDeg(radians) + 180) % 360) + 360) % 360) - 180;
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || busy.current) return;
      drag.current.down = true;
      drag.current.x = event.clientX;
      drag.current.y = event.clientY;
      drag.current.pointerId = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const pointerMove = (event: PointerEvent) => {
      const state = drag.current;
      if (!state.down) return;
      state.ry += (event.clientX - state.x) * 0.007;
      state.rx += (event.clientY - state.y) * 0.007;
      state.x = event.clientX;
      state.y = event.clientY;
      invalidate();
    };
    const pointerUp = () => {
      if (!drag.current.down) return;
      drag.current.down = false;
      canvas.style.cursor = "grab";
      const value = currentDesign.current;
      callbacks.current.onPoseChange?.({
        rotationX: normalize(
          THREE.MathUtils.degToRad(value.rotationX) + drag.current.rx,
        ),
        rotationY: normalize(
          THREE.MathUtils.degToRad(value.rotationY) + drag.current.ry,
        ),
        rotationZ: value.rotationZ,
      });
      if (canvas.hasPointerCapture(drag.current.pointerId))
        canvas.releasePointerCapture(drag.current.pointerId);
      invalidate();
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      ready.current = false;
      if (exporterRef) exporterRef.current = null;
      callbacks.current.onUnavailable();
    };
    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("webglcontextlost", contextLost);
    return () => {
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("webglcontextlost", contextLost);
    };
  }, [gl, exporterRef, invalidate]);

  useEffect(() => {
    let mounted = true;
    const recordingController = new AbortController();
    const exporter: SceneExporter = {
      async exportAnimation(options) {
        validateAnimationOptions(options);
        await assertAnimationSupported(options);
        if (
          !mounted ||
          !ready.current ||
          !root.current ||
          !outer.current ||
          !inner.current ||
          !heart.current ||
          gl.getContext().isContextLost()
        )
          throw new Error(
            "The 3D preview is not ready. Please wait for it to load.",
          );
        if (busy.current)
          throw new Error("A wallpaper is already being rendered.");
        if (!(camera instanceof THREE.PerspectiveCamera))
          throw new Error("The preview camera is unavailable.");
        if (
          options.width > gl.capabilities.maxTextureSize ||
          options.height > gl.capabilities.maxTextureSize
        )
          throw new Error("This device needs a smaller animation resolution.");
        const exportDesign = { ...currentDesign.current };
        applyStudioAppearance(exportDesign, appearance);
        busy.current = true;
        const oldSize = gl.getSize(new THREE.Vector2());
        const oldRatio = gl.getPixelRatio();
        const oldTarget = gl.getRenderTarget();
        const oldViewport = gl.getViewport(new THREE.Vector4());
        const oldScissor = gl.getScissor(new THREE.Vector4());
        const oldScissorTest = gl.getScissorTest();
        const oldXr = gl.xr.enabled;
        const oldAutoClear = gl.autoClear;
        const objects = [
          root.current,
          outer.current,
          inner.current,
          heart.current,
        ];
        const transforms = objects.map((object) => ({
          position: object.position.clone(),
          rotation: object.rotation.clone(),
          scale: object.scale.clone(),
        }));
        const oldTime = uniforms.uTime.value;
        const controller = new AbortController();
        const abort = () => controller.abort();
        recordingController.signal.addEventListener("abort", abort, {
          once: true,
        });
        options.signal?.addEventListener("abort", abort, { once: true });
        if (options.signal?.aborted || recordingController.signal.aborted)
          controller.abort();
        try {
          const exportCamera = camera.clone();
          exportCamera.aspect = options.width / options.height;
          exportCamera.updateProjectionMatrix();
          prepareCaptureFrame(gl, options.width, options.height);
          root.current.scale.setScalar(
            Math.min(1, exportCamera.aspect) * 0.97 * exportDesign.zoom,
          );
          return await recordAnimation({
            canvas: gl.domElement,
            options: { ...options, signal: controller.signal },
            renderFrame(seconds) {
              if (!mounted || gl.getContext().isContextLost())
                throw new Error("The 3D renderer was interrupted.");
              // A periodic excursion preserves the chosen pose and joins the
              // first/last loop smoothly, including non-periodic shader noise.
              const phase = (seconds / options.duration) * TAU;
              const motion = Math.sin(phase) * exportDesign.speed;
              const lift = (1 - Math.cos(phase)) * exportDesign.speed;
              uniforms.uTime.value = oldTime + motion * 1.8;
              outer.current!.rotation.y =
                transforms[1].rotation.y + motion * 0.22;
              outer.current!.rotation.z =
                transforms[1].rotation.z + lift * 0.08;
              inner.current!.rotation.z =
                transforms[2].rotation.z - motion * 0.18;
              heart.current!.rotation.y =
                transforms[3].rotation.y + motion * 0.4;
              root.current!.updateMatrixWorld(true);
              // React/ResizeObserver can resize the live canvas during an
              // encoder await. Reclaim the exact capture buffer for each frame.
              prepareCaptureFrame(gl, options.width, options.height);
              gl.render(scene, exportCamera);
            },
          });
        } finally {
          recordingController.signal.removeEventListener("abort", abort);
          options.signal?.removeEventListener("abort", abort);
          objects.forEach((object, index) => {
            object.position.copy(transforms[index].position);
            object.rotation.copy(transforms[index].rotation);
            object.scale.copy(transforms[index].scale);
          });
          uniforms.uTime.value = oldTime;
          try {
            if (mounted && !gl.getContext().isContextLost()) {
              const liveSize = get().size;
              const resized =
                liveSize.width !== oldSize.x || liveSize.height !== oldSize.y;
              gl.setDrawingBufferSize(liveSize.width, liveSize.height, oldRatio);
              gl.setRenderTarget(oldTarget);
              if (resized) gl.setViewport(0, 0, liveSize.width, liveSize.height);
              else gl.setViewport(oldViewport);
              gl.setScissor(oldScissor);
              gl.setScissorTest(oldScissorTest);
              gl.xr.enabled = oldXr;
              if (oldTarget === null) gl.render(scene, camera);
            }
          } finally {
            gl.autoClear = oldAutoClear;
            busy.current = false;
            invalidate();
          }
        }
      },
      async exportPng({ width, height }) {
        if (
          !mounted ||
          !ready.current ||
          !root.current ||
          gl.getContext().isContextLost()
        ) {
          throw new Error(
            "The 3D preview is not ready. Please wait for it to load.",
          );
        }
        if (busy.current)
          throw new Error("A wallpaper is already being rendered.");
        if (
          !Number.isInteger(width) ||
          !Number.isInteger(height) ||
          width < 1 ||
          height < 1 ||
          width > 3840 ||
          height > 3840 ||
          width * height > 8_300_000
        ) {
          throw new Error(
            "Choose a wallpaper up to 3840 pixels per side and 8.3 megapixels.",
          );
        }
        if (
          width > gl.capabilities.maxTextureSize ||
          height > gl.capabilities.maxTextureSize
        ) {
          throw new Error(
            "This device cannot render that size. Please choose a smaller wallpaper.",
          );
        }
        if (!(camera instanceof THREE.PerspectiveCamera))
          throw new Error("The preview camera is unavailable.");
        const exportDesign = { ...currentDesign.current };
        applyStudioAppearance(exportDesign, appearance);
        busy.current = true;
        const oldTarget = gl.getRenderTarget();
        const oldViewport = gl.getViewport(new THREE.Vector4());
        const oldScissor = gl.getScissor(new THREE.Vector4());
        const oldScissorTest = gl.getScissorTest();
        const oldXr = gl.xr.enabled;
        const oldAutoClear = gl.autoClear;
        const oldScale = root.current.scale.clone();
        const oldSize = gl.getSize(new THREE.Vector2());
        const oldPixelRatio = gl.getPixelRatio();
        let exportCanvas: HTMLCanvasElement;
        try {
          // Clone the camera so neither a failed export nor a different aspect
          // ratio can move the user's live preview.
          const exportCamera = camera.clone();
          exportCamera.aspect = width / height;
          exportCamera.updateProjectionMatrix();
          root.current.scale.setScalar(
            Math.min(1, exportCamera.aspect) * 0.97 * exportDesign.zoom,
          );
          root.current.updateMatrixWorld(true);
          gl.xr.enabled = false;
          gl.autoClear = true;
          // Use the normal display pipeline: intermediate render targets skip
          // Three's per-material tone mapping. Resize, capture, restore, and
          // repaint synchronously so the browser never paints the export size.
          // setDrawingBufferSize preserves the canvas's CSS dimensions.
          gl.setDrawingBufferSize(width, height, 1);
          if (
            gl.getContext().drawingBufferWidth !== width ||
            gl.getContext().drawingBufferHeight !== height
          ) {
            throw new Error(
              "This device cannot allocate that image size. Please choose a smaller wallpaper.",
            );
          }
          gl.setRenderTarget(null);
          gl.setViewport(0, 0, width, height);
          gl.setScissorTest(false);
          gl.clear(true, true, true);
          gl.render(scene, exportCamera);
          if (gl.getContext().isContextLost()) {
            throw new Error(
              "This device could not finish that render. Please try a smaller wallpaper.",
            );
          }
          exportCanvas = document.createElement("canvas");
          exportCanvas.width = width;
          exportCanvas.height = height;
          const context = exportCanvas.getContext("2d");
          if (!context)
            throw new Error("Your browser could not create a wallpaper image.");
          // Immediate copying works without preserveDrawingBuffer and captures
          // only the actual WebGL artwork, never the DOM or editor controls.
          context.drawImage(gl.domElement, 0, 0);
          if (context.getImageData(0, 0, 1, 1).data[3] === 0) {
            throw new Error(
              "This device could not capture that render. Please try a smaller wallpaper.",
            );
          }
        } finally {
          // Restore every changed renderer/object setting before asynchronous
          // PNG encoding lets the next React Three Fiber frame run.
          try {
            root.current?.scale.copy(oldScale);
            root.current?.updateMatrixWorld(true);
            gl.setDrawingBufferSize(oldSize.x, oldSize.y, oldPixelRatio);
            gl.setRenderTarget(oldTarget);
            gl.setViewport(oldViewport);
            gl.setScissor(oldScissor);
            gl.setScissorTest(oldScissorTest);
            gl.xr.enabled = oldXr;
            // A buffer resize clears the live canvas. Repaint before yielding,
            // with the original camera (whose pose was never changed).
            if (oldTarget === null && !gl.getContext().isContextLost())
              gl.render(scene, camera);
          } finally {
            gl.autoClear = oldAutoClear;
            busy.current = false;
            invalidate();
          }
        }
        return new Promise<Blob>((resolve, reject) => {
          exportCanvas.toBlob((blob) => {
            exportCanvas.width = 0;
            exportCanvas.height = 0;
            if (blob) resolve(blob);
            else
              reject(
                new Error(
                  "The browser could not encode this PNG. Please try a smaller size.",
                ),
              );
          }, "image/png");
        });
      },
    };
    // Installed after the first real rendered frame below, never on mount.
    const install = () => {
      if (mounted && ready.current && exporterRef)
        exporterRef.current = exporter;
    };
    if (ready.current) install();
    const onRendered = () => install();
    gl.domElement.addEventListener("null-orbit-ready", onRendered);
    return () => {
      mounted = false;
      recordingController.abort();
      cancelAnimationFrame(readyRequest.current);
      readyRequest.current = 0;
      gl.domElement.removeEventListener("null-orbit-ready", onRendered);
      if (exporterRef?.current === exporter) exporterRef.current = null;
    };
  }, [gl, scene, camera, exporterRef, invalidate, appearance, get]);

  useEffect(
    () => () => {
      Object.values(geometries).forEach((geometry) => geometry.dispose());
      [
        metal,
        darkMetal,
        accentMaterial,
        core,
        haze,
        signalMaterial,
        dustMaterial,
      ].forEach((material) => material.dispose());
    },
    [
      geometries,
      metal,
      darkMetal,
      accentMaterial,
      core,
      haze,
      signalMaterial,
      dustMaterial,
    ],
  );

  useFrame((_, frameDelta) => {
    if (
      busy.current ||
      !root.current ||
      !outer.current ||
      !inner.current ||
      !heart.current
    )
      return;
    const value = currentDesign.current;
    if (!reducedMotion && value.speed > 0 && frameCount.current >= 2) {
      elapsed.current += Math.min(frameDelta, 0.05) * value.speed;
    }
    const time = reducedMotion || value.speed === 0 ? 0 : elapsed.current;
    const phase = random(value.seed + 14) * TAU;
    uniforms.uTime.value = time + phase;
    root.current.position.set(0, 0, 0);
    root.current.scale.setScalar(
      Math.min(1, size.width / size.height) * 0.97 * value.zoom,
    );
    root.current.rotation.set(
      THREE.MathUtils.degToRad(value.rotationX) + drag.current.rx,
      THREE.MathUtils.degToRad(value.rotationY) + drag.current.ry,
      THREE.MathUtils.degToRad(value.rotationZ),
    );
    outer.current.rotation.set(0, 0, time * 0.033 + phase * 0.08);
    if (value.shape === "eclipse") {
      inner.current.rotation.set(0.1, 0.15, -0.3 - time * 0.045);
    } else if (value.shape === "helix") {
      outer.current.rotation.set(0, time * 0.12 + phase * 0.1, 0);
      inner.current.rotation.set(0, -time * 0.06, 0);
    } else {
      inner.current.rotation.set(
        0.78 + Math.sin(time * 0.12) * 0.05,
        -0.52,
        -0.55 - time * 0.055,
      );
    }
    heart.current.rotation.set(0.32, time * 0.095 + 0.4 + phase * 0.1, -0.25);
    // Environment's frames={1} is generated synchronously in its layout effect.
    // Waiting for two frames and the following RAF guarantees a painted scene.
    frameCount.current++;
    if (
      !ready.current &&
      !readyRequest.current &&
      frameCount.current >= 2 &&
      scene.environment
    ) {
      readyRequest.current = requestAnimationFrame(() => {
        readyRequest.current = 0;
        ready.current = true;
        gl.domElement.dispatchEvent(new Event("null-orbit-ready"));
        callbacks.current.onReady();
      });
    }
    if (!ready.current) invalidate();
  });

  return (
    <>
      <color attach="background" args={[design.background]} />
      <ambientLight intensity={0.3 * design.lighting} />
      <pointLight
        position={[-2, 3, 5]}
        color="#f4f3ff"
        intensity={12 * design.lighting}
        distance={18}
      />
      <pointLight
        position={[2, -1, 2]}
        color={design.accent}
        intensity={6 * design.lighting}
        distance={8}
      />
      <Suspense fallback={null}>
        <StudioReflection
          key={`${design.accent}:${design.lighting}`}
          accent={design.accent}
          lighting={design.lighting}
        />
      </Suspense>
      <points geometry={geometries.dust} material={dustMaterial} />
      <group ref={root}>
        <mesh position={[0, 0, -1.1]} material={haze}>
          <planeGeometry args={[6.2, 6.2]} />
        </mesh>
        <group ref={outer}>
          {design.shape === "helix" ? (
            <>
              <mesh geometry={geometries.helix} material={metal} />
              <mesh geometry={geometries.helixSecond} material={metal} />
              <mesh
                geometry={geometries.helixTrace}
                material={accentMaterial}
              />
              {[-1.65, 0, 1.65].map((y) => (
                <mesh
                  key={y}
                  position={[0, y, 0]}
                  rotation={[Math.PI / 2, 0, 0]}
                  material={darkMetal}
                >
                  <torusGeometry args={[1.18, 0.035, 8, 90]} />
                </mesh>
              ))}
            </>
          ) : design.shape === "eclipse" ? (
            <>
              <mesh
                geometry={geometries.disc}
                material={metal}
                scale={[1.12, 0.88, 1]}
              />
              <mesh
                geometry={geometries.eclipse}
                material={metal}
                position={[0.16, 0, -0.1]}
              />
              <mesh material={accentMaterial} scale={[1.12, 0.88, 1]}>
                <torusGeometry args={[1.76, 0.016, 6, 160]} />
              </mesh>
              <mesh
                geometry={geometries.disc}
                material={darkMetal}
                scale={[0.8, 0.8, 0.4]}
                position={[-0.18, 0, 0.03]}
              />
            </>
          ) : (
            <>
              <mesh geometry={geometries.outer} material={metal} />
              <mesh
                geometry={geometries.rim}
                material={metal}
                position={[0, 0, -0.055]}
              />
              <mesh material={darkMetal} position={[0, 0, -0.115]}>
                <torusGeometry args={[1.73, 0.045, 8, 140, 5.5]} />
              </mesh>
              <mesh
                material={accentMaterial}
                rotation={[0, 0, 0.35]}
                position={[0, 0, 0.085]}
              >
                <torusGeometry args={[1.545, 0.009, 5, 120, 4.65]} />
              </mesh>
            </>
          )}
        </group>
        <group ref={inner}>
          {design.shape !== "helix" && (
            <mesh
              geometry={geometries.inner}
              material={metal}
              scale={design.shape === "eclipse" ? 0.86 : 1}
            />
          )}
          <mesh
            material={accentMaterial}
            rotation={
              design.shape === "helix" ? [Math.PI / 2, 0, 0] : [0, 0, 0.7]
            }
          >
            <torusGeometry
              args={[
                design.shape === "helix" ? 1.55 : 1.29,
                0.012,
                6,
                130,
                5.5,
              ]}
            />
          </mesh>
        </group>
        {design.shape === "orbit" && (
          <group rotation={[1.05, 0.75, -0.8]}>
            <mesh geometry={geometries.middle} material={metal} />
          </group>
        )}
        <group
          ref={heart}
          scale={
            design.shape === "eclipse"
              ? 1.3
              : design.shape === "helix"
                ? 0.9
                : 1
          }
        >
          <mesh geometry={geometries.shell} material={metal} />
          <mesh geometry={geometries.core} material={core} />
          <mesh rotation={[0.55, 0.6, 0.3]} material={accentMaterial}>
            <torusGeometry args={[0.91, 0.011, 6, 100, 4.4]} />
          </mesh>
        </group>
        <points geometry={geometries.signal} material={signalMaterial} />
        {design.shape !== "helix" && (
          <group rotation={[0.52, -0.35, 0.12]}>
            <mesh material={accentMaterial}>
              <torusGeometry args={[2.32, 0.006, 5, 160, 4.8]} />
            </mesh>
          </group>
        )}
      </group>
    </>
  );
}

class SceneBoundary extends Component<
  { children: ReactNode; onUnavailable: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onUnavailable();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function Scene(props: SceneProps) {
  const mobile = typeof window !== "undefined" && window.innerWidth < 760;
  const [running, setRunning] = useState(
    () => typeof document === "undefined" || !document.hidden,
  );

  useEffect(() => {
    const update = () => {
      const heroBottom = document
        .querySelector(".hero")
        ?.getBoundingClientRect().bottom;
      setRunning(
        !document.hidden &&
          (props.studio || heroBottom === undefined || heroBottom > 0),
      );
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [props.studio]);

  return (
    <SceneBoundary onUnavailable={props.onUnavailable}>
      <Canvas
        camera={{ position: [0, 0, 8.6], fov: 40, near: 0.1, far: 50 }}
        dpr={[1, mobile ? 1.25 : 1.5]}
        frameloop={
          props.reducedMotion ||
          !running ||
          (props.studio && props.design?.speed === 0)
            ? "demand"
            : "always"
        }
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
        }}
        fallback={
          <span>
            {props.studio
              ? "Procedural sculpture preview. Use the design controls to customize your wallpaper."
              : "Procedural chrome sculpture preview."}
          </span>
        }
        onCreated={({ gl }) => {
          gl.setClearColor("#090909", 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
        }}
        aria-hidden={!props.studio}
        aria-label={
          props.studio
            ? "Interactive 3D wallpaper preview. Drag to rotate the sculpture."
            : undefined
        }
      >
        {props.studio ? (
          <WallpaperMachine {...props} />
        ) : (
          <Machine {...props} />
        )}
      </Canvas>
    </SceneBoundary>
  );
}

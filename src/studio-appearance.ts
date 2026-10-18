import * as THREE from "three";
import type { SceneDesign } from "./design";

export type StudioAppearance = {
  metal: THREE.MeshPhysicalMaterial;
  darkMetal: THREE.MeshStandardMaterial;
  accentMaterial: THREE.MeshBasicMaterial;
  haze: THREE.ShaderMaterial;
  uniforms: {
    uAccent: { value: THREE.Color };
    uSignal: { value: number };
    uLiquid: { value: number };
  };
  signalMaterial: THREE.PointsMaterial;
  dustMaterial: THREE.PointsMaterial;
  signalGeometry: THREE.BufferGeometry;
  dustGeometry: THREE.BufferGeometry;
};

/** Apply the same appearance before preview drawing and every export. */
export function applyStudioAppearance(
  design: SceneDesign,
  appearance: StudioAppearance,
) {
  const {
    metal,
    darkMetal,
    accentMaterial,
    haze,
    uniforms,
    signalMaterial,
    dustMaterial,
    signalGeometry,
    dustGeometry,
  } = appearance;
  const signal = design.mode === "signal";
  const glass = design.material === "glass";
  const matte = design.material === "matte";
  const previousTransmission = metal.transmission;
  const previousClearcoat = metal.clearcoat;
  const previousWireframe = metal.wireframe;
  const previousDarkWireframe = darkMetal.wireframe;
  metal.color.set(matte ? "#bbc0cb" : glass ? "#dce7ef" : "#b9bec6");
  metal.metalness = glass ? 0.04 : matte ? 0.08 : 1;
  metal.roughness = glass
    ? 0.055
    : matte
      ? 0.87
      : design.mode === "liquid"
        ? 0.095
        : 0.22;
  metal.transmission = glass ? 0.88 : 0;
  metal.thickness = glass ? 0.65 : 0;
  metal.ior = 1.45;
  metal.clearcoat = matte ? 0 : 1;
  metal.envMapIntensity = (glass ? 1.9 : matte ? 0.6 : 1.25) * design.lighting;
  metal.wireframe = signal;
  metal.emissive.set(design.accent);
  metal.emissiveIntensity = signal ? 0.24 : 0;
  // These switches change shader features. Uniform-only edits need no compile.
  if (
    previousTransmission !== metal.transmission ||
    previousClearcoat !== metal.clearcoat ||
    previousWireframe !== metal.wireframe
  )
    metal.needsUpdate = true;
  darkMetal.wireframe = signal;
  darkMetal.color.set(matte ? "#535961" : "#30343b");
  darkMetal.metalness = matte ? 0.05 : 0.9;
  darkMetal.roughness = matte ? 0.9 : 0.31;
  darkMetal.envMapIntensity = design.lighting;
  if (previousDarkWireframe !== darkMetal.wireframe)
    darkMetal.needsUpdate = true;
  accentMaterial.color.set(design.accent);
  haze.uniforms.uColor.value.set(design.accent);
  uniforms.uAccent.value.set(design.accent);
  uniforms.uSignal.value = signal ? 1 : 0;
  uniforms.uLiquid.value = design.mode === "liquid" ? 1 : 0;
  signalMaterial.color.set(design.accent);
  signalMaterial.opacity = (signal ? 0.85 : 0.46) * design.particles;
  dustMaterial.opacity = 0.6 * design.particles;
  const signalCount = signalGeometry.getAttribute("position")?.count ?? 0;
  const dustCount = dustGeometry.getAttribute("position")?.count ?? 0;
  signalGeometry.setDrawRange(0, Math.round(signalCount * design.particles));
  dustGeometry.setDrawRange(0, Math.round(dustCount * design.particles));
}

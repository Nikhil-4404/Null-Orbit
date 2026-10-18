import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { DEFAULT_DESIGN } from "./design.ts";
import {
  applyStudioAppearance,
  type StudioAppearance,
} from "./studio-appearance.ts";

function makeAppearance(): StudioAppearance {
  const geometry = (count: number) =>
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3),
    );
  return {
    metal: new THREE.MeshPhysicalMaterial(),
    darkMetal: new THREE.MeshStandardMaterial(),
    accentMaterial: new THREE.MeshBasicMaterial(),
    haze: new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() } },
    }),
    uniforms: {
      uAccent: { value: new THREE.Color() },
      uSignal: { value: 0 },
      uLiquid: { value: 0 },
    },
    signalMaterial: new THREE.PointsMaterial(),
    dustMaterial: new THREE.PointsMaterial(),
    signalGeometry: geometry(880),
    dustGeometry: geometry(380),
  };
}

test("current density replaces earlier particle counts and opacity on the same scene", () => {
  const appearance = makeAppearance();
  applyStudioAppearance({ ...DEFAULT_DESIGN, particles: 0 }, appearance);
  assert.equal(appearance.signalGeometry.drawRange.count, 0);
  assert.equal(appearance.dustGeometry.drawRange.count, 0);
  assert.equal(appearance.signalMaterial.opacity, 0);
  applyStudioAppearance(
    { ...DEFAULT_DESIGN, mode: "signal", particles: 1 },
    appearance,
  );
  assert.equal(appearance.signalGeometry.drawRange.count, 880);
  assert.equal(appearance.dustGeometry.drawRange.count, 380);
  assert.equal(appearance.signalMaterial.opacity, 0.85);
  assert.equal(appearance.dustMaterial.opacity, 0.6);
  applyStudioAppearance({ ...DEFAULT_DESIGN, particles: 0.5 }, appearance);
  assert.equal(appearance.signalGeometry.drawRange.count, 440);
  assert.equal(appearance.dustGeometry.drawRange.count, 190);
  assert.equal(appearance.signalMaterial.opacity, 0.23);
});

test("capture appearance uses latest lighting, accent, and mode without recreating materials", () => {
  const appearance = makeAppearance();
  const material = appearance.metal;
  applyStudioAppearance(
    { ...DEFAULT_DESIGN, material: "matte", lighting: 0.3 },
    appearance,
  );
  assert.equal(material.envMapIntensity, 0.18);
  applyStudioAppearance(
    {
      ...DEFAULT_DESIGN,
      material: "matte",
      mode: "signal",
      lighting: 2,
      accent: "#40aaff",
    },
    appearance,
  );
  assert.equal(appearance.metal, material);
  assert.equal(material.envMapIntensity, 1.2);
  assert.equal(appearance.darkMetal.envMapIntensity, 2);
  assert.equal(appearance.uniforms.uSignal.value, 1);
  assert.equal(appearance.uniforms.uLiquid.value, 0);
  for (const color of [
    appearance.accentMaterial.color,
    appearance.signalMaterial.color,
    appearance.uniforms.uAccent.value,
    appearance.haze.uniforms.uColor.value,
  ])
    assert.equal(color.getHexString(), "40aaff");
});

test("material switches invalidate both wireframe shaders and clear glass transmission", () => {
  const appearance = makeAppearance();
  applyStudioAppearance(
    { ...DEFAULT_DESIGN, mode: "signal", material: "glass" },
    appearance,
  );
  const metalVersion = appearance.metal.version;
  const darkVersion = appearance.darkMetal.version;
  assert.equal(appearance.metal.transmission, 0.88);
  applyStudioAppearance(
    { ...DEFAULT_DESIGN, mode: "liquid", material: "matte" },
    appearance,
  );
  assert.equal(appearance.metal.transmission, 0);
  assert.equal(appearance.metal.clearcoat, 0);
  assert.equal(appearance.metal.wireframe, false);
  assert.equal(appearance.darkMetal.wireframe, false);
  assert.ok(appearance.metal.version > metalVersion);
  assert.ok(appearance.darkMetal.version > darkVersion);
  assert.equal(appearance.uniforms.uLiquid.value, 1);
});

import test from "node:test";
import assert from "node:assert/strict";
import type * as THREE from "three";
import { prepareCaptureFrame } from "./capture-renderer.ts";

function fakeRenderer() {
  const context = {
    drawingBufferWidth: 640,
    drawingBufferHeight: 360,
    isContextLost: () => false,
  };
  const state = { ratio: 1.5, allocations: 0, viewport: [] as number[] };
  const renderer = {
    xr: { enabled: true },
    autoClear: false,
    getContext: () => context,
    getPixelRatio: () => state.ratio,
    setDrawingBufferSize(width: number, height: number, ratio: number) {
      context.drawingBufferWidth = width;
      context.drawingBufferHeight = height;
      state.ratio = ratio;
      state.allocations++;
    },
    setRenderTarget: (_target: null) => {},
    setScissorTest: (_enabled: boolean) => {},
    setViewport: (...viewport: number[]) => {
      state.viewport = viewport;
    },
    clear: () => {},
  };
  return {
    renderer: renderer as unknown as THREE.WebGLRenderer,
    context,
    state,
  };
}

test("capture restores exact dimensions after a simulated live canvas resize", () => {
  const { renderer, context, state } = fakeRenderer();
  prepareCaptureFrame(renderer, 1920, 1080);
  assert.deepEqual(state.viewport, [0, 0, 1920, 1080]);
  assert.equal(state.allocations, 1);
  prepareCaptureFrame(renderer, 1920, 1080);
  assert.equal(state.allocations, 1, "unchanged buffers are not reallocated");
  // Model R3F's ResizeObserver subscription running between encoder awaits.
  context.drawingBufferWidth = 800;
  context.drawingBufferHeight = 450;
  state.ratio = 1.5;
  prepareCaptureFrame(renderer, 1920, 1080);
  assert.equal(state.allocations, 2);
  assert.equal(context.drawingBufferWidth, 1920);
  assert.equal(context.drawingBufferHeight, 1080);
  assert.equal(state.ratio, 1);
  assert.equal(renderer.xr.enabled, false);
  assert.equal(renderer.autoClear, true);
});

test("capture resets pixel ratio even when physical dimensions already match", () => {
  const { renderer, context, state } = fakeRenderer();
  context.drawingBufferWidth = 1920;
  context.drawingBufferHeight = 1080;
  prepareCaptureFrame(renderer, 1920, 1080);
  assert.equal(state.allocations, 1);
  assert.equal(
    state.ratio,
    1,
    "viewport coordinates must remain physical pixels",
  );
});

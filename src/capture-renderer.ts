import type * as THREE from "three";

/** Reassert capture state after encoder awaits or a React canvas resize. */
export function prepareCaptureFrame(
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number,
) {
  const context = renderer.getContext();
  if (context.isContextLost())
    throw new Error("The 3D renderer was interrupted.");
  if (
    renderer.getPixelRatio() !== 1 ||
    context.drawingBufferWidth !== width ||
    context.drawingBufferHeight !== height
  )
    renderer.setDrawingBufferSize(width, height, 1);
  if (
    context.drawingBufferWidth !== width ||
    context.drawingBufferHeight !== height
  )
    throw new Error(
      "This device cannot allocate that animation size. Try a lower resolution.",
    );
  renderer.xr.enabled = false;
  renderer.autoClear = true;
  renderer.setRenderTarget(null);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, width, height);
  renderer.clear(true, true, true);
}

import test from "node:test";
import assert from "node:assert/strict";
import {
  ANIMATION_FRAME_RATES,
  ANIMATION_RESOLUTIONS,
  getAnimationBitrate,
  getAnimationSize,
  getAnimationSupport,
  validateAnimationOptions,
} from "./animation.ts";

test("animation size choices preserve all supported wallpaper formats", () => {
  const formats = [
    { width: 1920, height: 1080 },
    { width: 1080, height: 1920 },
    { width: 1080, height: 1080 },
    { width: 2560, height: 1080 },
  ];
  const expected = [
    [
      [1280, 720],
      [720, 1280],
      [720, 720],
      [1280, 540],
    ],
    [
      [1920, 1080],
      [1080, 1920],
      [1080, 1080],
      [1920, 810],
    ],
    [
      [2560, 1440],
      [1440, 2560],
      [1440, 1440],
      [2560, 1080],
    ],
    [
      [3840, 2160],
      [2160, 3840],
      [2160, 2160],
      [3840, 1620],
    ],
  ];
  ANIMATION_RESOLUTIONS.forEach((resolution, index) => {
    formats.forEach((format, formatIndex) => {
      const size = getAnimationSize(format, resolution.id);
      assert.deepEqual([size.width, size.height], expected[index][formatIndex]);
      for (const fps of ANIMATION_FRAME_RATES)
        for (const duration of [6, 10] as const)
          assert.doesNotThrow(() =>
            validateAnimationOptions({ ...size, fps, duration }),
          );
    });
  });
});

test("animation bitrate scales with image detail and frame rate within bounds", () => {
  assert.equal(
    getAnimationBitrate({ width: 1280, height: 720, fps: 24 }),
    4_500_000,
  );
  const fullHd30 = getAnimationBitrate({ width: 1920, height: 1080, fps: 30 });
  assert.ok(fullHd30 > 4_500_000);
  assert.equal(
    getAnimationBitrate({ width: 1920, height: 1080, fps: 60 }),
    fullHd30 * 2,
  );
  assert.ok(
    getAnimationBitrate({ width: 3840, height: 2160, fps: 60 }) <= 80_000_000,
  );
  assert.equal(
    getAnimationBitrate({ width: 3840, height: 2160, fps: 240 }),
    80_000_000,
  );
});

test("unsupported or excessive animation targets fail before GPU allocation", () => {
  for (const update of [
    { width: 3842 },
    { height: Infinity },
    { width: 3840, height: 3840 },
    { duration: 60 },
    { fps: 241 },
    { fps: 480 },
    { fps: 29.97 },
    { width: 1919 },
    { width: 0 },
    { height: 1.5 },
  ]) {
    assert.throws(() =>
      validateAnimationOptions({
        width: 1280,
        height: 720,
        duration: 6,
        fps: 24,
        ...update,
      } as Parameters<typeof validateAnimationOptions>[0]),
    );
  }
});

test("non-browser runtime reports animation unsupported without throwing", () => {
  assert.deepEqual(getAnimationSupport(), {
    supported: false,
    mimeType: null,
    frameAccurate: false,
  });
});

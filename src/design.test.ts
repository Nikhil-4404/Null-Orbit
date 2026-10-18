import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DESIGN,
  PRESETS,
  FORMATS,
  sanitizeDesign,
  encodeDesign,
  decodeDesign,
  makeShareUrl,
  loadFavorites,
  saveFavorites,
  randomDesign,
  type SavedDesign,
} from "./design.ts";

const storageKey = "null-orbit:designs:v1";
const rawShare = (value: unknown) =>
  btoa(JSON.stringify(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const favorite = (id = "one", name = "My orbit"): SavedDesign => ({
  id,
  name,
  savedAt: "2026-10-16T12:30:00.000Z",
  design: { ...DEFAULT_DESIGN },
});

function withWindow(value: unknown, run: () => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value });
  try {
    run();
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

function memoryStorage(initial: string | null = null) {
  const data = new Map<string, string>(
    initial === null ? [] : [[storageKey, initial]],
  );
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

test("shared presets recreate the complete design and exports use usable sizes", () => {
  for (const preset of PRESETS) {
    const encoded = encodeDesign(preset.design);
    assert.match(encoded, /^[A-Za-z0-9_-]+$/);
    assert.deepEqual(decodeDesign(encoded), {
      design: preset.design,
      error: null,
    });
  }
  assert.equal(PRESETS.length, 6);
  assert.equal(
    new Set(PRESETS.map(({ design }) => JSON.stringify(design))).size,
    6,
  );
  assert.equal(new Set(PRESETS.map(({ design }) => design.shape)).size, 3);
  assert.equal(new Set(PRESETS.map(({ design }) => design.material)).size, 3);
  assert.deepEqual(
    FORMATS.map(({ width, height }) => [width, height]),
    [
      [1920, 1080],
      [1080, 1920],
      [1080, 1080],
      [2560, 1080],
    ],
  );
});

test("missing share uses an independent default, while malformed links explain the failure", () => {
  const empty = decodeDesign(null);
  assert.deepEqual(empty, { design: DEFAULT_DESIGN, error: null });
  assert.notEqual(empty.design, DEFAULT_DESIGN);
  for (const malformed of [
    "",
    "not a design",
    "💥",
    "e30",
    rawShare(null),
    rawShare([]),
    rawShare({ v: 1 }),
    "A".repeat(4097),
  ]) {
    const result = decodeDesign(malformed);
    assert.deepEqual(result.design, DEFAULT_DESIGN);
    assert.ok(result.error, malformed);
  }
});

test("future share versions are rejected without interpreting their settings", () => {
  const result = decodeDesign(
    rawShare({ ...DEFAULT_DESIGN, v: 2, accent: "#123456" }),
  );
  assert.deepEqual(result.design, DEFAULT_DESIGN);
  assert.match(result.error ?? "", /newer version/i);
});

test("negative zero is canonicalized before save or share", () => {
  const design = sanitizeDesign({ ...DEFAULT_DESIGN, rotationY: -0 });
  assert.equal(Object.is(design.rotationY, -0), false);
  assert.deepEqual(decodeDesign(encodeDesign(design)), { design, error: null });
});

test("untrusted shared scenes cannot apply invalid colors, modes or unsafe numeric state", () => {
  for (const patch of [
    { accent: "#fff" },
    { background: "url(https://example.invalid)" },
    { material: "script" },
    { mode: "unknown" },
    { shape: "unknown" },
    { speed: "1" },
    { speed: 1e200 },
    { zoom: 10000 },
    { particles: -100 },
    { seed: 1.5 },
  ]) {
    const result = decodeDesign(rawShare({ ...DEFAULT_DESIGN, ...patch }));
    assert.deepEqual(result.design, DEFAULT_DESIGN);
    assert.ok(result.error);
  }
  // JSON accepts this exponent even though JavaScript evaluates it as Infinity.
  const infinite = btoa(
    JSON.stringify(DEFAULT_DESIGN).replace('"speed":0.45', '"speed":1e400'),
  ).replace(/=+$/, "");
  assert.ok(decodeDesign(infinite).error);
});

test("control normalization clamps finite numbers and replaces nonfinite or invalid values", () => {
  const design = sanitizeDesign({
    ...DEFAULT_DESIGN,
    v: 42,
    mode: "missing",
    shape: null,
    material: [],
    accent: "#AABBCC",
    background: "#123",
    speed: -20,
    lighting: 100,
    particles: Infinity,
    zoom: NaN,
    rotationX: -100000,
    rotationY: 100000,
    rotationZ: "30",
    seed: -5,
  });
  assert.equal(design.v, 1);
  assert.equal(design.mode, DEFAULT_DESIGN.mode);
  assert.equal(design.shape, DEFAULT_DESIGN.shape);
  assert.equal(design.material, DEFAULT_DESIGN.material);
  assert.equal(design.accent, "#aabbcc");
  assert.equal(design.background, DEFAULT_DESIGN.background);
  assert.equal(design.speed, 0);
  assert.equal(design.lighting, 2);
  assert.equal(design.particles, DEFAULT_DESIGN.particles);
  assert.equal(design.zoom, DEFAULT_DESIGN.zoom);
  assert.equal(design.rotationX, -180);
  assert.equal(design.rotationY, 180);
  assert.equal(design.rotationZ, DEFAULT_DESIGN.rotationZ);
  assert.equal(design.seed, 1);
  assert.deepEqual(sanitizeDesign(undefined), DEFAULT_DESIGN);
});

test("share links keep the deployment path, replace obsolete query state and target the studio", () => {
  withWindow(
    {
      location: {
        href: "https://example.test/portfolio/orbit/?old=1#philosophy",
      },
    },
    () => {
      const url = new URL(makeShareUrl(PRESETS[4].design));
      assert.equal(url.origin, "https://example.test");
      assert.equal(url.pathname, "/portfolio/orbit/");
      assert.equal(url.hash, "#studio");
      assert.equal(url.searchParams.has("old"), false);
      assert.deepEqual(decodeDesign(url.searchParams.get("design")), {
        design: PRESETS[4].design,
        error: null,
      });
    },
  );
});

test("browser favorites survive a save/load and names are bounded plain text", () => {
  withWindow({ localStorage: memoryStorage() }, () => {
    assert.deepEqual(loadFavorites(), { items: [], error: null });
    assert.deepEqual(
      saveFavorites([favorite("one", `  \u0000${"a".repeat(60)}\n  `)]),
      { error: null },
    );
    const result = loadFavorites();
    assert.equal(result.error, null);
    assert.equal(result.items[0].name, "a".repeat(40));
    assert.equal(result.items[0].savedAt, "2026-10-16T12:30:00.000Z");
    assert.deepEqual(result.items[0].design, DEFAULT_DESIGN);
  });
});

test("favorite limits and duplicate IDs cannot produce unbounded or ambiguous collections", () => {
  withWindow({ localStorage: memoryStorage() }, () => {
    const result = saveFavorites(
      Array.from({ length: 24 }, (_, index) => favorite(`id-${index}`)),
    );
    assert.match(result.error ?? "", /20-design limit/);
    assert.equal(loadFavorites().items.length, 20);
    assert.ok(saveFavorites([favorite(), favorite()]).error);
    assert.equal(loadFavorites().items.length, 1);
  });
});

test("damaged storage, unsupported documents and invalid favorite records are reported", () => {
  for (const stored of [
    "invalid json",
    "{}",
    "null",
    JSON.stringify([null, {}, { ...favorite(), savedAt: "not-a-date" }]),
  ]) {
    withWindow({ localStorage: memoryStorage(stored) }, () => {
      const result = loadFavorites();
      assert.deepEqual(result.items, []);
      assert.ok(result.error);
    });
  }
  const invalid = [
    favorite("ok"),
    { ...favorite("bad-date"), savedAt: "2026-10-16" },
    { ...favorite("future"), design: { ...DEFAULT_DESIGN, v: 2 } },
    { ...favorite("bad-color"), design: { ...DEFAULT_DESIGN, accent: "red" } },
    favorite("bad/id"),
    favorite("empty-name", "\n  "),
  ];
  withWindow({ localStorage: memoryStorage(JSON.stringify(invalid)) }, () => {
    const result = loadFavorites();
    assert.deepEqual(
      result.items.map(({ id }) => id),
      ["ok"],
    );
    assert.ok(result.error);
  });
});

test("blocked and full browser storage return visible errors instead of throwing", () => {
  const blockedWindow = {};
  Object.defineProperty(blockedWindow, "localStorage", {
    get: () => {
      throw new DOMException("Blocked", "SecurityError");
    },
  });
  withWindow(blockedWindow, () => {
    assert.match(loadFavorites().error ?? "", /unavailable/i);
    assert.match(saveFavorites([favorite()]).error ?? "", /could not save/i);
  });
  withWindow(
    {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException("Full", "QuotaExceededError");
        },
      },
    },
    () => {
      assert.match(saveFavorites([favorite()]).error ?? "", /full or blocked/i);
    },
  );
});

test("random scenes remain accepted by the same shared-document boundary", () => {
  for (let i = 0; i < 30; i++) {
    const design = randomDesign();
    assert.deepEqual(decodeDesign(encodeDesign(design)), {
      design,
      error: null,
    });
  }
});

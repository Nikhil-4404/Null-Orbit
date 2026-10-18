import type { RealityMode } from "./Scene";
import type { AnimationOptions } from "./animation";

export type Shape = "orbit" | "eclipse" | "helix";
export type Material = "chrome" | "matte" | "glass";
export type SceneDesign = {
  v: 1;
  mode: RealityMode;
  shape: Shape;
  material: Material;
  accent: string;
  background: string;
  speed: number;
  lighting: number;
  particles: number;
  zoom: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  seed: number;
};
export type SceneExporter = {
  exportPng: (size: { width: number; height: number }) => Promise<Blob>;
  exportAnimation?: (options: AnimationOptions) => Promise<Blob>;
};
export type Preset = {
  id: string;
  name: string;
  description: string;
  design: SceneDesign;
};
export type SavedDesign = {
  id: string;
  name: string;
  savedAt: string;
  design: SceneDesign;
};

export const DEFAULT_DESIGN: SceneDesign = {
  v: 1,
  mode: "solid",
  shape: "orbit",
  material: "chrome",
  accent: "#f25336",
  background: "#090b0d",
  speed: 0.45,
  lighting: 1,
  particles: 0.35,
  zoom: 1,
  rotationX: 16,
  rotationY: -18,
  rotationZ: -18,
  seed: 4173,
};

export type ExportFormat = {
  id: string;
  name: string;
  width: number;
  height: number;
};

export const FORMATS: ExportFormat[] = [
  { id: "desktop", name: "Desktop", width: 1920, height: 1080 },
  { id: "phone", name: "Phone", width: 1080, height: 1920 },
  { id: "square", name: "Square", width: 1080, height: 1080 },
  { id: "ultrawide", name: "Ultrawide", width: 2560, height: 1080 },
];

export const PRESETS: Preset[] = [
  {
    id: "chrome-eclipse",
    name: "Chrome Eclipse",
    description: "Sculpted chrome around a hot vermilion core.",
    design: {
      ...DEFAULT_DESIGN,
      shape: "eclipse",
      accent: "#ff5b35",
      lighting: 1.3,
      rotationX: 24,
      rotationY: -24,
      rotationZ: -16,
      seed: 4173,
    },
  },
  {
    id: "solar-core",
    name: "Solar Core",
    description: "Amber glass suspended in a warm solar haze.",
    design: {
      ...DEFAULT_DESIGN,
      mode: "liquid",
      shape: "orbit",
      material: "glass",
      accent: "#ffbe45",
      background: "#1a100b",
      lighting: 1.7,
      particles: 0.65,
      speed: 0.65,
      zoom: 1.1,
      rotationX: -12,
      rotationY: 32,
      rotationZ: 14,
      seed: 8124,
    },
  },
  {
    id: "signal-storm",
    name: "Signal Storm",
    description: "An electric cyan helix traced through the dark.",
    design: {
      ...DEFAULT_DESIGN,
      mode: "signal",
      shape: "helix",
      material: "chrome",
      accent: "#61e3ff",
      background: "#060e18",
      lighting: 1.5,
      particles: 0.85,
      speed: 1.1,
      zoom: 0.9,
      rotationX: 12,
      rotationY: 20,
      rotationZ: 32,
      seed: 77121,
    },
  },
  {
    id: "porcelain-orbit",
    name: "Porcelain Orbit",
    description: "A quiet matte object on a soft mineral canvas.",
    design: {
      ...DEFAULT_DESIGN,
      mode: "solid",
      shape: "orbit",
      material: "matte",
      accent: "#db9381",
      background: "#b9b1a7",
      lighting: 0.9,
      particles: 0.05,
      speed: 0.15,
      zoom: 0.95,
      rotationX: 38,
      rotationY: -42,
      rotationZ: 8,
      seed: 2291,
    },
  },
  {
    id: "deep-space",
    name: "Deep Space",
    description: "Violet glass and distant particles in an endless void.",
    design: {
      ...DEFAULT_DESIGN,
      mode: "liquid",
      shape: "eclipse",
      material: "glass",
      accent: "#ac86ff",
      background: "#070511",
      lighting: 0.65,
      particles: 1,
      speed: 0.25,
      zoom: 0.8,
      rotationX: -28,
      rotationY: 44,
      rotationZ: -38,
      seed: 9941,
    },
  },
  {
    id: "liquid-ember",
    name: "Liquid Ember",
    description: "A molten helix with a slow, crimson pulse.",
    design: {
      ...DEFAULT_DESIGN,
      mode: "liquid",
      shape: "helix",
      material: "matte",
      accent: "#ff335b",
      background: "#1a070c",
      lighting: 1.4,
      particles: 0.4,
      speed: 0.7,
      zoom: 1.05,
      rotationX: -18,
      rotationY: -15,
      rotationZ: -32,
      seed: 61287,
    },
  },
];

const STORAGE_KEY = "null-orbit:designs:v1";
const MAX_FAVORITES = 20;
const MAX_SHARE_LENGTH = 4096;
const modes: SceneDesign["mode"][] = ["solid", "liquid", "signal"];
const shapes: Shape[] = ["orbit", "eclipse", "helix"];
const materials: Material[] = ["chrome", "matte", "glass"];
const colorPattern = /^#[0-9a-fA-F]{6}$/;
const numericBounds = {
  speed: [0, 2],
  lighting: [0.3, 2],
  particles: [0, 1],
  zoom: [0.65, 1.4],
  rotationX: [-180, 180],
  rotationY: [-180, 180],
  rotationZ: [-180, 180],
  seed: [1, 999999],
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberInRange(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  const bounded =
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : fallback;
  return bounded === 0 ? 0 : bounded;
}

/** Controls, imported URLs and saved data all cross this single normalization boundary. */
export function sanitizeDesign(value: unknown): SceneDesign {
  const source = isRecord(value) ? value : {};
  const color = (key: "accent" | "background") =>
    typeof source[key] === "string" && colorPattern.test(source[key])
      ? source[key].toLowerCase()
      : DEFAULT_DESIGN[key];
  return {
    v: 1,
    mode: modes.includes(source.mode as SceneDesign["mode"])
      ? (source.mode as SceneDesign["mode"])
      : DEFAULT_DESIGN.mode,
    shape: shapes.includes(source.shape as Shape)
      ? (source.shape as Shape)
      : DEFAULT_DESIGN.shape,
    material: materials.includes(source.material as Material)
      ? (source.material as Material)
      : DEFAULT_DESIGN.material,
    accent: color("accent"),
    background: color("background"),
    speed: numberInRange(
      source.speed,
      ...numericBounds.speed,
      DEFAULT_DESIGN.speed,
    ),
    lighting: numberInRange(
      source.lighting,
      ...numericBounds.lighting,
      DEFAULT_DESIGN.lighting,
    ),
    particles: numberInRange(
      source.particles,
      ...numericBounds.particles,
      DEFAULT_DESIGN.particles,
    ),
    zoom: numberInRange(
      source.zoom,
      ...numericBounds.zoom,
      DEFAULT_DESIGN.zoom,
    ),
    rotationX: numberInRange(
      source.rotationX,
      ...numericBounds.rotationX,
      DEFAULT_DESIGN.rotationX,
    ),
    rotationY: numberInRange(
      source.rotationY,
      ...numericBounds.rotationY,
      DEFAULT_DESIGN.rotationY,
    ),
    rotationZ: numberInRange(
      source.rotationZ,
      ...numericBounds.rotationZ,
      DEFAULT_DESIGN.rotationZ,
    ),
    seed: Math.round(
      numberInRange(source.seed, ...numericBounds.seed, DEFAULT_DESIGN.seed),
    ),
  };
}

/** Shares require a complete supported schema. Invalid documents never partially apply. */
function isValidDocument(value: unknown): value is SceneDesign {
  if (!isRecord(value) || value.v !== 1) return false;
  if (
    !modes.includes(value.mode as SceneDesign["mode"]) ||
    !shapes.includes(value.shape as Shape) ||
    !materials.includes(value.material as Material)
  )
    return false;
  if (
    typeof value.accent !== "string" ||
    !colorPattern.test(value.accent) ||
    typeof value.background !== "string" ||
    !colorPattern.test(value.background)
  )
    return false;
  for (const key of Object.keys(
    numericBounds,
  ) as (keyof typeof numericBounds)[]) {
    const number = value[key];
    const [min, max] = numericBounds[key];
    if (
      typeof number !== "number" ||
      !Number.isFinite(number) ||
      number < min ||
      number > max
    )
      return false;
  }
  return Number.isInteger(value.seed);
}

export function encodeDesign(design: SceneDesign): string {
  return btoa(JSON.stringify(sanitizeDesign(design)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeDesign(value: string | null): {
  design: SceneDesign;
  error: string | null;
} {
  const fallback = () => ({ ...DEFAULT_DESIGN });
  if (value === null) return { design: fallback(), error: null };
  if (value.length > MAX_SHARE_LENGTH)
    return {
      design: fallback(),
      error: "This design link is too large. The default design was opened.",
    };
  try {
    if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid");
    const document: unknown = JSON.parse(
      atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (
      isRecord(document) &&
      typeof document.v === "number" &&
      document.v > 1
    ) {
      return {
        design: fallback(),
        error:
          "This design was made with a newer version of the studio. The default design was opened.",
      };
    }
    if (!isValidDocument(document)) throw new Error("invalid");
    return { design: sanitizeDesign(document), error: null };
  } catch {
    return {
      design: fallback(),
      error:
        "This design link is invalid or incomplete. The default design was opened.",
    };
  }
}

export function makeShareUrl(design: SceneDesign): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("design", encodeDesign(design));
  url.hash = "studio";
  return url.toString();
}

function normalizeFavorites(value: unknown): {
  items: SavedDesign[];
  error: string | null;
} {
  if (!Array.isArray(value))
    return {
      items: [],
      error: "Saved designs could not be read because their format is invalid.",
    };
  const items: SavedDesign[] = [];
  const ids = new Set<string>();
  let rejected = false;
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(entry.id) ||
      typeof entry.name !== "string" ||
      typeof entry.savedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T/.test(entry.savedAt) ||
      !Number.isFinite(Date.parse(entry.savedAt)) ||
      !isValidDocument(entry.design)
    ) {
      rejected = true;
      continue;
    }
    const name = entry.name
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 40);
    if (!name || ids.has(entry.id)) {
      rejected = true;
      continue;
    }
    ids.add(entry.id);
    if (items.length < MAX_FAVORITES)
      items.push({
        id: entry.id,
        name,
        savedAt: new Date(entry.savedAt).toISOString(),
        design: sanitizeDesign(entry.design),
      });
    else rejected = true;
  }
  return {
    items,
    error: rejected
      ? "Some saved designs were invalid or exceeded the 20-design limit and were skipped."
      : null,
  };
}

export function loadFavorites(): {
  items: SavedDesign[];
  error: string | null;
} {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null
      ? { items: [], error: null }
      : normalizeFavorites(JSON.parse(stored));
  } catch (error) {
    return {
      items: [],
      error:
        error instanceof SyntaxError
          ? "Saved designs could not be read because their data is damaged."
          : "Browser storage is unavailable. Saved designs cannot be loaded in this browser.",
    };
  }
}

export function saveFavorites(items: SavedDesign[]): { error: string | null } {
  const result = normalizeFavorites(items);
  if (!Array.isArray(items)) return { error: result.error };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(result.items));
    return { error: result.error };
  } catch {
    return {
      error:
        "The browser could not save your design. Storage may be full or blocked; try downloading it instead.",
    };
  }
}

export function randomDesign(): SceneDesign {
  const preset = PRESETS[Math.floor(Math.random() * PRESETS.length)].design;
  return sanitizeDesign({
    ...preset,
    shape: shapes[Math.floor(Math.random() * shapes.length)],
    material: materials[Math.floor(Math.random() * materials.length)],
    rotationX: Math.round(Math.random() * 120 - 60),
    rotationY: Math.round(Math.random() * 120 - 60),
    rotationZ: Math.round(Math.random() * 120 - 60),
    seed: Math.ceil(Math.random() * 999999) || 1,
  });
}

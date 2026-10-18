import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
  type SceneDesign,
  type SceneExporter,
  type SavedDesign,
  type ExportFormat,
} from "./design";
import "./studio.css";
import {
  ANIMATION_RESOLUTIONS,
  ANIMATION_FRAME_RATES,
  getAnimationSize,
  getAnimationSupport,
  type AnimationResolution,
  type AnimationFps,
} from "./animation";

const Scene = lazy(() => import("./Scene"));
type Notice = { text: string; kind: "success" | "error" | "info" } | null;

function Icon({
  name,
  className = "",
}: {
  name:
    | "orbit"
    | "arrow"
    | "download"
    | "save"
    | "share"
    | "shuffle"
    | "close"
    | "reset";
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "orbit" && (
        <>
          <ellipse
            cx="12"
            cy="12"
            rx="11"
            ry="4.5"
            transform="rotate(-42 12 12)"
          />
          <ellipse
            cx="12"
            cy="12"
            rx="11"
            ry="4.5"
            transform="rotate(42 12 12)"
          />
          <circle cx="12" cy="12" r="1.5" />
        </>
      )}
      {name === "arrow" && <path d="M19 12H5m6-6-6 6 6 6" />}
      {name === "download" && (
        <>
          <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
        </>
      )}
      {name === "save" && (
        <>
          <path d="M5 3h12l3 3v15H4V3h1ZM8 3v6h8V3M8 21v-8h8v8" />
        </>
      )}
      {name === "share" && (
        <>
          <circle cx="18" cy="4" r="3" />
          <circle cx="5" cy="12" r="3" />
          <circle cx="18" cy="20" r="3" />
          <path d="m7.5 10.5 8-5m-8 8 8 5" />
        </>
      )}
      {name === "shuffle" && (
        <>
          <path d="M3 6h3c4 0 7 12 11 12h4m-4-4 4 4-4 4M3 18h3c2 0 3-3 4-5m4-4c1-2 2-3 4-3h3m-4-4 4 4-4 4" />
        </>
      )}
      {name === "close" && <path d="m6 6 12 12M18 6 6 18" />}
      {name === "reset" && (
        <>
          <path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" />
        </>
      )}
    </svg>
  );
}

function Miniature({ design }: { design: SceneDesign }) {
  return (
    <span
      className={`studio-miniature mini-${design.shape} mini-${design.material} mini-${design.mode}`}
      style={
        {
          "--mini-accent": design.accent,
          "--mini-bg": design.background,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <span className="mini-glow" />
      <span className="mini-core" />
      <span className="mini-ring ring-a" />
      <span className="mini-ring ring-b" />
      <span className="mini-ring ring-c" />
      <span className="mini-speck speck-a" />
      <span className="mini-speck speck-b" />
    </span>
  );
}

function Choice<T extends string>({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: T;
  values: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="studio-control-group">
      <legend>{label}</legend>
      <div className="studio-choice">
        {values.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={item === value}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  disabled = false,
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  suffix?: string;
}) {
  const id = useId();
  return (
    <div className="studio-range">
      <div className="studio-range-label">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>
          {value.toFixed(2)}
          {suffix}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
        style={
          {
            "--range-fill": `${((value - min) / (max - min)) * 100}%`,
          } as CSSProperties
        }
      />
    </div>
  );
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDraft(value);
    setInvalid(false);
  }, [value]);
  return (
    <div className="studio-color-control">
      <label htmlFor={`${id}-hex`}>{label}</label>
      <div className="studio-color-field">
        <input
          type="color"
          aria-label={`${label} color picker`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          id={`${id}-hex`}
          aria-label={`${label} hex color`}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          type="text"
          spellCheck={false}
          maxLength={7}
          value={draft}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            setInvalid(false);
            if (/^#[\da-f]{6}$/i.test(next)) onChange(next.toLowerCase());
          }}
          onBlur={() => {
            if (!/^#[\da-f]{6}$/i.test(draft)) setInvalid(true);
          }}
        />
      </div>
      {invalid && (
        <small id={`${id}-error`} className="studio-field-error">
          Use six hex digits, e.g. #f25336.
        </small>
      )}
    </div>
  );
}

export default function Studio({
  onExit,
  reducedMotion,
  onToggleMotion,
}: {
  onExit: () => void;
  reducedMotion: boolean;
  onToggleMotion: () => void;
}) {
  const [initial] = useState(() =>
    decodeDesign(new URLSearchParams(window.location.search).get("design")),
  );
  const [design, setDesign] = useState<SceneDesign>(initial.design);
  const [storage] = useState(loadFavorites);
  const [favorites, setFavorites] = useState<SavedDesign[]>(storage.items);
  const [notice, setNotice] = useState<Notice>(() =>
    initial.error
      ? { kind: "error", text: initial.error }
      : storage.error
        ? { kind: "error", text: storage.error }
        : null,
  );
  const [tab, setTab] = useState<"presets" | "saved">("presets");
  const [name, setName] = useState("Untitled orbit");
  const [formatId, setFormatId] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get("format");
    return FORMATS.find((item) => item.id === requested)?.id ?? FORMATS[0].id;
  });
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [animationProgress, setAnimationProgress] = useState<number | null>(
    null,
  );
  const [duration, setDuration] = useState<6 | 10>(6);
  const [animationSupport] = useState(getAnimationSupport);
  const [animationResolution, setAnimationResolution] =
    useState<AnimationResolution>(
      animationSupport.frameAccurate ? "1080p" : "720p",
    );
  const [animationFps, setAnimationFps] = useState<AnimationFps>(
    animationSupport.frameAccurate ? 60 : 24,
  );
  const animationAbort = useRef<AbortController | null>(null);
  const animationPanel = useRef<HTMLDetailsElement>(null);
  const animationSummary = useRef<HTMLElement>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [shareFallback, setShareFallback] = useState(false);
  const [frameSpace, setFrameSpace] = useState({ width: 720, height: 480 });
  const frameArea = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const shareInput = useRef<HTMLInputElement>(null);
  const exporter = useRef<SceneExporter | null>(null);
  const progress = useRef(0);
  const previousSpeed = useRef(DEFAULT_DESIGN.speed);
  const format: ExportFormat =
    FORMATS.find((item) => item.id === formatId) ?? FORMATS[0];
  const designCode = useMemo(() => encodeDesign(design), [design]);
  const aspect = format.width / format.height;
  const frameWidth = Math.max(
    1,
    Math.min(frameSpace.width, frameSpace.height * aspect),
  );
  const { width: videoWidth, height: videoHeight } = getAnimationSize(
    format,
    animationResolution,
  );

  useEffect(() => () => animationAbort.current?.abort(), []);

  useEffect(() => {
    const node = frameArea.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setFrameSpace({
        width: Math.max(1, width - 48),
        height: Math.max(1, height - 48),
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key !== null && event.key !== "null-orbit:designs:v1") return;
      const latest = loadFavorites();
      setFavorites(latest.items);
      if (latest.error) setNotice({ kind: "error", text: latest.error });
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const patch = useCallback((update: Partial<SceneDesign>) => {
    setDesign((current) => sanitizeDesign({ ...current, ...update }));
    setShareUrl("");
  }, []);
  const onReady = useCallback(() => {
    setReady(true);
    setUnavailable(false);
  }, []);
  const onUnavailable = useCallback(() => {
    setUnavailable(true);
    setReady(false);
    exporter.current = null;
  }, []);
  const onPoseChange = useCallback(
    (pose: Pick<SceneDesign, "rotationX" | "rotationY" | "rotationZ">) =>
      patch(pose),
    [patch],
  );

  function selectDesign(next: SceneDesign, nextName: string) {
    setDesign(sanitizeDesign(next));
    setName(nextName);
    setShareUrl("");
    setNotice(null);
  }

  function saveDesign() {
    const cleanName = name.trim();
    if (!cleanName) {
      setNotice({
        kind: "error",
        text: "Give your design a name before saving.",
      });
      nameInput.current?.focus();
      return;
    }
    if (favorites.length >= 20) {
      setNotice({
        kind: "error",
        text: "Your collection holds 20 designs. Delete one in My designs to make room.",
      });
      setTab("saved");
      return;
    }
    const item: SavedDesign = {
      id:
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: cleanName.slice(0, 40),
      savedAt: new Date().toISOString(),
      design: sanitizeDesign(design),
    };
    const next = [item, ...favorites];
    const result = saveFavorites(next);
    if (result.error) {
      setNotice({ kind: "error", text: result.error });
      return;
    }
    setFavorites(next);
    setName(cleanName);
    setTab("saved");
    setNotice({
      kind: "success",
      text: `“${cleanName}” saved in this browser.`,
    });
  }

  function deleteDesign(id: string) {
    const next = favorites.filter((item) => item.id !== id);
    const result = saveFavorites(next);
    if (result.error) {
      setNotice({ kind: "error", text: result.error });
      return;
    }
    setFavorites(next);
    setNotice({
      kind: "info",
      text: "Design removed from this browser’s collection.",
    });
  }

  async function shareDesign() {
    const destination = new URL(makeShareUrl(design));
    destination.searchParams.set("format", format.id);
    const url = destination.toString();
    setShareUrl(url);
    setShareFallback(false);
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setNotice({
        kind: "success",
        text: "Design link copied. Anyone with the link can open and customize it.",
      });
    } catch {
      setShareFallback(true);
      setNotice({
        kind: "info",
        text: "Clipboard access is unavailable. Select the design link below and copy it manually.",
      });
      window.setTimeout(() => shareInput.current?.select(), 0);
    }
  }

  async function downloadPng() {
    if (exporting || !ready || unavailable || !exporter.current) return;
    setExporting(true);
    setNotice(null);
    let url: string | null = null;
    try {
      const blob = await exporter.current.exportPng({
        width: format.width,
        height: format.height,
      });
      if (!blob.size || blob.type !== "image/png")
        throw new Error("The renderer could not produce a PNG. Try again.");
      url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const slug =
        (name.trim() || "untitled-orbit")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 48) || "wallpaper";
      anchor.href = url;
      anchor.download = `null-orbit-${slug}-${format.width}x${format.height}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setNotice({
        kind: "success",
        text: `PNG ready — ${format.width} × ${format.height} download started.`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "PNG export failed. Please try again.",
      });
    } finally {
      if (url) {
        const objectUrl = url;
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      }
      setExporting(false);
    }
  }

  function togglePause() {
    if (design.speed > 0) {
      previousSpeed.current = design.speed;
      patch({ speed: 0 });
    } else patch({ speed: previousSpeed.current || DEFAULT_DESIGN.speed });
  }

  async function downloadAnimation() {
    if (
      exporting ||
      !ready ||
      unavailable ||
      !exporter.current?.exportAnimation ||
      reducedMotion ||
      design.speed === 0
    )
      return;
    const controller = new AbortController();
    animationAbort.current = controller;
    setExporting(true);
    setAnimationProgress(0);
    setNotice(null);
    try {
      const blob = await exporter.current.exportAnimation({
        width: videoWidth,
        height: videoHeight,
        duration,
        fps: animationFps,
        signal: controller.signal,
        onProgress: setAnimationProgress,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const slug =
        (name.trim() || "orbit")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 48) || "orbit";
      anchor.href = url;
      anchor.download = `null-orbit-${slug}-${videoWidth}x${videoHeight}-${animationFps}fps-${duration}s.webm`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setNotice({
        kind: "success",
        text: `Animation ready — ${videoWidth} × ${videoHeight}, ${animationFps} fps, ${duration}s WebM download started. Import it into a compatible wallpaper app.`,
      });
    } catch (error) {
      setNotice({
        kind: controller.signal.aborted ? "info" : "error",
        text: controller.signal.aborted
          ? "Animation export cancelled. Your design is unchanged."
          : error instanceof Error
            ? error.message
            : "Animation export failed. Please try again.",
      });
    } finally {
      animationAbort.current = null;
      setAnimationProgress(null);
      setExporting(false);
    }
  }

  return (
    <main className="studio" aria-label="NULL ORBIT wallpaper studio">
      <header className="studio-header">
        <div className="studio-brand">
          <Icon name="orbit" />
          <div>
            <strong>
              NULL ORBIT<span>°</span>
            </strong>
            <p>PERSONAL REALITY GENERATOR</p>
          </div>
        </div>
        <button
          className="studio-back"
          onClick={onExit}
          disabled={exporting}
          type="button"
        >
          <Icon name="arrow" />
          <span>Back to experience</span>
        </button>
        <div className="studio-header-actions studio-object-actions">
          <button
            className="studio-action"
            onClick={saveDesign}
            disabled={exporting}
            type="button"
          >
            <Icon name="save" />
            <span>Save design</span>
          </button>
          <button
            className="studio-action"
            onClick={() => {
              void shareDesign();
            }}
            type="button"
          >
            <Icon name="share" />
            <span>Share</span>
          </button>
          <button
            className="studio-download"
            onClick={() => {
              void downloadPng();
            }}
            disabled={!ready || unavailable || exporting}
            type="button"
          >
            <Icon name="download" />
            <span>
              {exporting && animationProgress === null
                ? "Rendering PNG…"
                : "Download PNG"}
            </span>
          </button>
          <button
            className="studio-action studio-live-download"
            onClick={() => {
              const panel = animationPanel.current;
              if (!panel) return;
              panel.open = true;
              panel.scrollIntoView({
                behavior: reducedMotion ? "auto" : "smooth",
                block: "center",
              });
              animationSummary.current?.focus({ preventScroll: true });
            }}
            disabled={exporting}
            aria-controls="studio-live-wallpaper"
            type="button"
          >
            <Icon name="orbit" />
            <span>Live wallpaper</span>
          </button>
        </div>
      </header>
      {notice && (
        <div
          className={`studio-notice notice-${notice.kind}`}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          <span className="studio-notice-mark">
            {notice.kind === "error" ? "!" : "+"}
          </span>
          <p>{notice.text}</p>
          <button
            aria-label="Dismiss message"
            onClick={() => setNotice(null)}
            type="button"
          >
            <Icon name="close" />
          </button>
        </div>
      )}

      {shareUrl && (
        <div className="studio-share-panel">
          <label htmlFor="studio-share-link">YOUR DESIGN LINK</label>
          <input
            id="studio-share-link"
            ref={shareInput}
            value={shareUrl}
            readOnly
            onFocus={(event) => event.target.select()}
            aria-label="Shareable design link"
          />
          <button
            onClick={() => {
              shareInput.current?.focus();
              shareInput.current?.select();
              if (!shareFallback) void shareDesign();
            }}
            type="button"
          >
            {shareFallback ? "Select link" : "Copy link"}
          </button>
          <button
            className="studio-share-close"
            aria-label="Close design link"
            onClick={() => setShareUrl("")}
            type="button"
          >
            <Icon name="close" />
          </button>
        </div>
      )}

      <div className="studio-layout">
        <aside className="studio-library" aria-label="Design library">
          <div className="studio-panel-intro">
            <span className="studio-eyebrow">01 / START SOMEWHERE</span>
            <h1>
              Make space <br />
              for your imagination.
            </h1>
            <p>A little chaos. Entirely yours.</p>
          </div>
          <div
            className="studio-library-tabs"
            role="tablist"
            aria-label="Design collections"
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? "presets"
                  : event.key === "End"
                    ? "saved"
                    : tab === "presets"
                      ? "saved"
                      : "presets";
              setTab(next);
              document
                .getElementById(
                  next === "presets"
                    ? "studio-presets-tab"
                    : "studio-saved-tab",
                )
                ?.focus();
            }}
          >
            <button
              id="studio-presets-tab"
              role="tab"
              aria-selected={tab === "presets"}
              tabIndex={tab === "presets" ? 0 : -1}
              aria-controls="studio-library-content"
              onClick={() => setTab("presets")}
              type="button"
            >
              Presets <span>06</span>
            </button>
            <button
              id="studio-saved-tab"
              role="tab"
              aria-selected={tab === "saved"}
              tabIndex={tab === "saved" ? 0 : -1}
              aria-controls="studio-library-content"
              onClick={() => setTab("saved")}
              type="button"
            >
              My designs{" "}
              <span>{String(favorites.length).padStart(2, "0")}</span>
            </button>
          </div>
          <div
            className="studio-library-content"
            id="studio-library-content"
            role="tabpanel"
            aria-labelledby={
              tab === "presets" ? "studio-presets-tab" : "studio-saved-tab"
            }
          >
            {tab === "presets" ? (
              <div className="studio-preset-grid">
                {PRESETS.map((preset, index) => (
                  <button
                    className="studio-preset-card"
                    aria-pressed={designCode === encodeDesign(preset.design)}
                    onClick={() => selectDesign(preset.design, preset.name)}
                    key={preset.id}
                    title={preset.description}
                    disabled={exporting}
                    type="button"
                  >
                    <Miniature design={preset.design} />
                    <span className="studio-card-name">{preset.name}</span>
                    <span className="studio-card-meta">
                      {String(index + 1).padStart(2, "0")} /{" "}
                      {preset.design.material}
                    </span>
                  </button>
                ))}
              </div>
            ) : favorites.length ? (
              <div className="studio-saved-list">
                {favorites.map((item) => (
                  <div className="studio-saved-card" key={item.id}>
                    <button
                      className="studio-saved-select"
                      type="button"
                      onClick={() => selectDesign(item.design, item.name)}
                      disabled={exporting}
                      aria-label={`Load ${item.name}`}
                    >
                      <Miniature design={item.design} />
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.design.shape} / {item.design.material}
                        </small>
                      </span>
                    </button>
                    <button
                      className="studio-delete"
                      type="button"
                      aria-label={`Delete ${item.name}`}
                      title={`Delete ${item.name}`}
                      onClick={() => deleteDesign(item.id)}
                      disabled={exporting}
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="studio-empty">
                <Icon name="orbit" />
                <h2>Your own little universe.</h2>
                <p>
                  Name your creation below and hit Save design. Your collection
                  stays in this browser.
                </p>
                <button onClick={() => setTab("presets")} type="button">
                  Explore the presets ↗
                </button>
              </div>
            )}
          </div>
          <div className="studio-collection-footer">
            <label htmlFor="studio-design-name">
              NAME YOUR DESIGN <span>{name.length}/40</span>
            </label>
            <input
              id="studio-design-name"
              ref={nameInput}
              type="text"
              value={name}
              maxLength={40}
              placeholder="Something out of this world"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveDesign();
              }}
            />
            <p>
              Saved locally · no account needed
              <br />
              Clearing browser data removes saved designs.
            </p>
          </div>
        </aside>

        <section className="studio-workspace" aria-label="Wallpaper preview">
          <div className="studio-workspace-top">
            <div>
              <span className="studio-eyebrow">LIVE CANVAS</span>
              <span className="studio-live-label">
                <i className={ready ? "is-ready" : ""} />
                {unavailable
                  ? "Renderer unavailable"
                  : ready
                    ? "Ready to create"
                    : "Preparing 3D scene"}
              </span>
            </div>
            <button
              className="studio-randomize"
              type="button"
              onClick={() => selectDesign(randomDesign(), "New dimension")}
              disabled={exporting}
            >
              <Icon name="shuffle" />
              Surprise me
            </button>
          </div>
          <div className="studio-format-toolbar">
            <label htmlFor="studio-format">CANVAS</label>
            <select
              id="studio-format"
              aria-label="Canvas format"
              value={formatId}
              onChange={(event) => {
                setFormatId(event.target.value);
                setShareUrl("");
              }}
              disabled={exporting}
            >
              {FORMATS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <span>
              {format.width} × {format.height}
            </span>
          </div>
          <div className="studio-frame-area" ref={frameArea}>
            <div
              className="studio-canvas-frame"
              style={{
                width: frameWidth,
                height: frameWidth / aspect,
                background: design.background,
              }}
            >
              <i className="frame-corner corner-tl" />
              <i className="frame-corner corner-tr" />
              <i className="frame-corner corner-bl" />
              <i className="frame-corner corner-br" />
              {!unavailable && (
                <Suspense fallback={null}>
                  <Scene
                    key={generation}
                    mode={design.mode}
                    reducedMotion={reducedMotion}
                    progress={progress}
                    burst={0}
                    onReady={onReady}
                    onUnavailable={onUnavailable}
                    studio
                    design={design}
                    exporterRef={exporter}
                    onPoseChange={onPoseChange}
                  />
                </Suspense>
              )}
              {!ready && !unavailable && (
                <div className="studio-canvas-loading" role="status">
                  <Icon name="orbit" />
                  <strong>Assembling your universe.</strong>
                  <span>Preparing materials and lighting…</span>
                </div>
              )}
              {unavailable && (
                <div className="studio-renderer-fallback" role="status">
                  <Icon name="orbit" />
                  <h2>The 3D canvas couldn’t start.</h2>
                  <p>
                    This browser could not initialize WebGL. Try enabling
                    hardware acceleration or opening another browser. You can
                    still customize, save, and share your design.
                  </p>
                  <button
                    onClick={() => {
                      setUnavailable(false);
                      setReady(false);
                      setGeneration((current) => current + 1);
                    }}
                    type="button"
                  >
                    Retry 3D canvas
                  </button>
                  <small>PNG export needs a working 3D renderer.</small>
                </div>
              )}
            </div>
          </div>
          <div className="studio-preview-actions">
            <span>
              <span className="studio-cross">+</span>{" "}
              {unavailable
                ? "YOUR SETTINGS ARE STILL AVAILABLE"
                : "DRAG THE SCULPTURE TO FIND YOUR ANGLE"}
            </span>
            <button
              onClick={() =>
                patch({
                  rotationX: DEFAULT_DESIGN.rotationX,
                  rotationY: DEFAULT_DESIGN.rotationY,
                  rotationZ: DEFAULT_DESIGN.rotationZ,
                  zoom: DEFAULT_DESIGN.zoom,
                })
              }
              disabled={exporting}
              type="button"
            >
              <Icon name="reset" />
              Reset view
            </button>
          </div>
          <details
            className="studio-animation"
            id="studio-live-wallpaper"
            ref={animationPanel}
          >
            <summary ref={animationSummary}>
              Download live wallpaper <span>WEBM VIDEO ↗</span>
            </summary>
            <p>
              Download a silent video of your design. High-quality rendering can
              take longer than the video itself. Keep this tab visible until it
              finishes.
            </p>
            <div className="studio-animation-controls">
              <label>
                Loop length{" "}
                <select
                  value={duration}
                  onChange={(event) =>
                    setDuration(Number(event.target.value) as 6 | 10)
                  }
                  disabled={exporting}
                >
                  <option value={6}>6 seconds</option>
                  <option value={10}>10 seconds</option>
                </select>
              </label>
              <label>
                Resolution{" "}
                <select
                  value={animationResolution}
                  onChange={(event) =>
                    setAnimationResolution(
                      event.target.value as AnimationResolution,
                    )
                  }
                  disabled={exporting}
                >
                  {ANIMATION_RESOLUTIONS.map((resolution) => (
                    <option
                      key={resolution.id}
                      value={resolution.id}
                      disabled={
                        !animationSupport.frameAccurate &&
                        resolution.id !== "720p"
                      }
                    >
                      {resolution.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Frame rate{" "}
                <select
                  value={animationFps}
                  onChange={(event) =>
                    setAnimationFps(Number(event.target.value) as AnimationFps)
                  }
                  disabled={exporting}
                >
                  {ANIMATION_FRAME_RATES.map((fps) => (
                    <option
                      key={fps}
                      value={fps}
                      disabled={!animationSupport.frameAccurate && fps !== 24}
                    >
                      {fps} fps
                    </option>
                  ))}
                </select>
              </label>
              <span>
                {videoWidth} × {videoHeight} · {animationFps} fps · WebM
              </span>
              <button
                type="button"
                onClick={() => void downloadAnimation()}
                disabled={
                  !ready ||
                  unavailable ||
                  exporting ||
                  !animationSupport.supported ||
                  reducedMotion ||
                  design.speed === 0
                }
              >
                Download live wallpaper
              </button>
            </div>
            {animationSupport.supported && !animationSupport.frameAccurate && (
              <p role="status">
                This browser offers basic 720p / 24 fps recording. Higher
                resolutions and frame rates need a compatible browser encoder.
              </p>
            )}
            {animationProgress !== null && (
              <div className="studio-animation-progress" role="status">
                <progress
                  max={1}
                  value={animationProgress}
                  aria-label="Animation export progress"
                />
                <span>{Math.round(animationProgress * 100)}%</span>
                <button
                  type="button"
                  onClick={() => {
                    setNotice({
                      kind: "info",
                      text: "Cancelling export and releasing the encoder…",
                    });
                    animationAbort.current?.abort();
                  }}
                >
                  Cancel export
                </button>
              </div>
            )}
            {!animationSupport.supported && (
              <p role="status">
                This browser cannot export WebM. PNG downloads remain available.
              </p>
            )}
            {(reducedMotion || design.speed === 0) && (
              <p>
                Enable motion and resume the preview to export an animation.
              </p>
            )}
            <p>
              On Windows, import the video into a compatible wallpaper app such
              as{" "}
              <a
                href="https://github.com/rocksdanister/lively/wiki/Video-Guide"
                target="_blank"
                rel="noopener noreferrer"
              >
                Lively Wallpaper ↗
              </a>
              . Downloading does not install it. iPhone Live Photo export is not
              included.
            </p>
          </details>
          <div className="studio-output-info">
            <div>
              <span className="studio-eyebrow">MADE TO LEAVE THE BROWSER</span>
              <p>Your screen. Your signal.</p>
            </div>
            <span>
              PNG · {format.width} × {format.height}
              <br />
              <small>Artwork only. No watermark.</small>
            </span>
          </div>
        </section>

        <aside className="studio-inspector" aria-label="Design controls">
          <div className="studio-inspector-heading">
            <span className="studio-eyebrow">02 / MAKE IT YOURS</span>
            <h2>
              Reality controls<span>↙</span>
            </h2>
          </div>
          <fieldset className="studio-settings" disabled={exporting}>
            <legend className="studio-sr-only">Customize your wallpaper</legend>
            <Choice
              label="Reality"
              value={design.mode}
              values={["solid", "liquid", "signal"]}
              onChange={(mode) => patch({ mode })}
            />
            <Choice
              label="Sculpture"
              value={design.shape}
              values={["orbit", "eclipse", "helix"]}
              onChange={(shape) => patch({ shape })}
            />
            <Choice
              label="Surface"
              value={design.material}
              values={["chrome", "matte", "glass"]}
              onChange={(material) => patch({ material })}
            />
            <div className="studio-colors">
              <ColorControl
                label="Accent"
                value={design.accent}
                onChange={(accent) => patch({ accent })}
              />
              <ColorControl
                label="Background"
                value={design.background}
                onChange={(background) => patch({ background })}
              />
            </div>
            <div className="studio-sliders">
              <RangeControl
                label="Lighting"
                value={design.lighting}
                min={0.3}
                max={2}
                onChange={(lighting) => patch({ lighting })}
              />
              <RangeControl
                label="Particle density"
                value={design.particles}
                min={0}
                max={1}
                onChange={(particles) => patch({ particles })}
              />
              <RangeControl
                label="Zoom"
                value={design.zoom}
                min={0.65}
                max={1.4}
                onChange={(zoom) => patch({ zoom })}
              />
            </div>
            <div className="studio-motion-section">
              <div className="studio-motion-heading">
                <span>MOTION</span>
                <button
                  type="button"
                  aria-pressed={design.speed === 0}
                  onClick={togglePause}
                  disabled={reducedMotion}
                >
                  {design.speed === 0 ? "▶ Resume" : "Ⅱ Pause"}
                </button>
              </div>
              <RangeControl
                label="Orbit speed"
                value={design.speed}
                min={0}
                max={2}
                onChange={(speed) => patch({ speed })}
                disabled={reducedMotion}
              />
              <button
                className="studio-motion-toggle"
                type="button"
                role="switch"
                aria-checked={reducedMotion}
                onClick={onToggleMotion}
              >
                <span
                  className={`studio-switch ${reducedMotion ? "switch-on" : ""}`}
                />
                <span>Reduce motion</span>
              </button>
              <p>
                {reducedMotion
                  ? "Animation is paused for comfortable viewing. Drag to set your angle."
                  : "Set speed to zero for a still sculpture. Drag to set your angle."}
              </p>
            </div>
          </fieldset>
          <div className="studio-inspector-note">
            <span>∞</span>
            <p>
              There is no right way
              <br />
              to make something unreal.
            </p>
          </div>
        </aside>
      </div>
      <footer className="studio-footer">
        <span>
          <i />
          WALLPAPER STUDIO / V.01
        </span>
        <span>CREATE SOMETHING THAT FEELS LIKE YOU.</span>
        <span>PRIVATE BY DESIGN · SAVED IN YOUR BROWSER</span>
      </footer>
    </main>
  );
}

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { RealityMode } from "./Scene";
import { resolveAppLocation } from "./navigation";

gsap.registerPlugin(ScrollTrigger);
const Scene = lazy(() => import("./Scene"));
const CreatorStudio = lazy(() => import("./Studio"));

function isStudioLocation() {
  const resolved = resolveAppLocation(window.location.href);
  if (resolved.href !== window.location.href)
    window.history.replaceState(null, "", resolved.href);
  return resolved.studioOpen;
}

const realities: {
  id: RealityMode;
  index: string;
  name: string;
  material: string;
  description: string;
  character: string;
}[] = [
  {
    id: "solid",
    index: "01",
    name: "Solid",
    material: "CHROME / STRUCTURE",
    description:
      "Precision, pulled apart. A constellation of metallic fragments held together by a force you can almost feel.",
    character: "Order is an illusion.",
  },
  {
    id: "liquid",
    index: "02",
    name: "Liquid",
    material: "AMBER / FLUIDITY",
    description:
      "Let the edges dissolve. The machine softens into a restless, molten form. Nothing stays where you left it.",
    character: "Give form to the formless.",
  },
  {
    id: "signal",
    index: "03",
    name: "Signal",
    material: "LIGHT / FREQUENCY",
    description:
      "Strip away the surface. What remains is a network of light, a little interference, and the architecture underneath.",
    character: "Everything is connected.",
  },
];

function Arrow({
  diagonal = false,
  className = "",
}: {
  diagonal?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={diagonal ? "M5 19 19 5M5 5h14v14" : "M4 12h16m-6-6 6 6-6 6"}
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function OrbitMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <ellipse
        cx="24"
        cy="24"
        rx="21"
        ry="9"
        transform="rotate(-43 24 24)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <ellipse
        cx="24"
        cy="24"
        rx="21"
        ry="9"
        transform="rotate(43 24 24)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M24 17v14m-7-7h14" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function SoundIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3 8h3l4-4v12l-4-4H3V8Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      {active ? (
        <>
          <path
            d="M13 7a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </>
      ) : (
        <path d="m13 7 5 6m0-6-5 6" stroke="currentColor" strokeWidth="1.2" />
      )}
    </svg>
  );
}

function useAmbientAudio() {
  const context = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      void context.current?.close().catch(() => {});
    },
    [],
  );
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (context.current) {
        await context.current.close();
        context.current = null;
        setEnabled(false);
      } else {
        const ctx = new AudioContext();
        context.current = ctx;
        await ctx.resume();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 220;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 1.8);
        filter.connect(gain);
        gain.connect(ctx.destination);
        for (const frequency of [55, 82.41, 110.12]) {
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.value = frequency;
          osc.connect(filter);
          osc.start();
        }
        setEnabled(true);
      }
    } catch {
      void context.current?.close().catch(() => {});
      context.current = null;
      setEnabled(false);
      setError("Sound is unavailable in this browser.");
    } finally {
      setBusy(false);
    }
  };
  return { enabled, busy, error, toggle };
}

function FallbackObject({ mode }: { mode: RealityMode }) {
  const core =
    mode === "signal" ? "#b6dac4" : mode === "liquid" ? "#ffb452" : "#ff5e32";
  return (
    <div className="fallback-object" aria-hidden="true">
      <svg viewBox="0 0 600 600">
        <defs>
          <radialGradient id="fallback-core">
            <stop stopColor="#ffe3a2" />
            <stop offset=".14" stopColor={core} />
            <stop offset=".45" stopColor={core} stopOpacity=".18" />
            <stop offset="1" stopColor="#090909" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="fallback-chrome" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#d2d1ca" />
            <stop offset=".2" stopColor="#2d2e2c" />
            <stop offset=".5" stopColor="#f4f0e5" />
            <stop offset=".65" stopColor="#373936" />
            <stop offset="1" stopColor="#9d9f9a" />
          </linearGradient>
        </defs>
        <circle cx="300" cy="300" r="205" fill="url(#fallback-core)" />
        {Array.from({ length: 7 }, (_, i) => (
          <ellipse
            key={i}
            cx="300"
            cy="300"
            rx={220 - i * 12}
            ry={80 + i * 9}
            fill="none"
            stroke={mode === "signal" ? core : "url(#fallback-chrome)"}
            strokeWidth={mode === "signal" ? 1 : i === 3 ? 17 : 6}
            strokeDasharray={`${70 + i * 15} ${13 + i * 7}`}
            transform={`rotate(${i * 24 - 50} 300 300)`}
          />
        ))}
        <circle cx="300" cy="300" r="25" fill={core} />
        <ellipse
          cx="300"
          cy="300"
          rx="270"
          ry="60"
          transform="rotate(-35 300 300)"
          fill="none"
          stroke={core}
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

function ModeDiagram({ mode }: { mode: RealityMode }) {
  return (
    <svg
      viewBox="0 0 160 100"
      fill="none"
      aria-hidden="true"
      className={`mode-diagram mode-diagram--${mode}`}
    >
      {mode === "solid" && (
        <g stroke="currentColor" strokeWidth=".8">
          {Array.from({ length: 7 }, (_, i) => (
            <ellipse
              key={i}
              cx="80"
              cy="50"
              rx={49 - i * 4}
              ry={19 + i * 2}
              transform={`rotate(${i * 20 - 60} 80 50)`}
            />
          ))}
          <circle cx="80" cy="50" r="4" fill="currentColor" />
        </g>
      )}
      {mode === "liquid" && (
        <g stroke="currentColor" strokeWidth=".8">
          {Array.from({ length: 6 }, (_, i) => (
            <path
              key={i}
              d={`M${25 + i * 3} 50 C${10 + i * 10} ${-10 + i * 7},${143 - i * 8} ${5 + i * 2},${133 - i * 3} 50 S${31 + i * 2} ${117 - i * 5},${25 + i * 3} 50Z`}
              transform={`rotate(${i * 13} 80 50)`}
            />
          ))}
        </g>
      )}
      {mode === "signal" && (
        <g stroke="currentColor" strokeWidth=".8">
          {Array.from({ length: 10 }, (_, i) => (
            <path
              key={i}
              d={`M${20 + i * 12} 18v64M20 ${20 + i * 7}h120`}
              opacity={0.3 + i * 0.06}
            />
          ))}
          <path
            d="M20 50h20l9-21 12 45 12-40 10 30 11-21 11 7h35"
            strokeWidth="1.5"
          />
        </g>
      )}
    </svg>
  );
}

function SequenceDialog({
  open,
  reducedMotion,
  onClose,
  onComplete,
}: {
  open: boolean;
  reducedMotion: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!open) return;
    setStep(0);
    const element = dialog.current;
    element?.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timeouts = [
      setTimeout(() => setStep(1), 1400),
      setTimeout(() => setStep(2), 2800),
      setTimeout(onComplete, reducedMotion ? 3600 : 4400),
    ];
    return () => {
      timeouts.forEach(clearTimeout);
      element?.close();
      document.body.style.overflow = oldOverflow;
    };
  }, [open, onComplete, reducedMotion]);
  return (
    <dialog
      ref={dialog}
      className="sequence-dialog"
      aria-labelledby="sequence-title"
      aria-describedby="sequence-description"
      onCancel={onClose}
    >
      <div className="sequence-frame">
        <div className="sequence-top">
          <span className="mono">NULL ORBIT / REALITY SHIFT</span>
          <button
            className="text-button close-sequence"
            onClick={onClose}
            autoFocus
          >
            Cancel <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="sequence-center">
          <OrbitMark className="sequence-orbit" />
          <p className="eyebrow">
            PROCEDURAL ART SEQUENCE / {String(step + 1).padStart(2, "0")}
          </p>
          <h2 id="sequence-title">
            {
              [
                "Mapping\nthe unknown.",
                "Releasing\ngravity.",
                "Reality,\nrewritten.",
              ][step]
            }
          </h2>
          <p id="sequence-description">
            A brief journey to the next state of matter.
          </p>
          <div
            className="sequence-progress"
            key={`${open}-${reducedMotion}`}
            style={
              {
                "--duration": reducedMotion ? "3.6s" : "4.4s",
              } as React.CSSProperties
            }
          >
            <span />
          </div>
          <p className="mono sequence-step" role="status">
            {
              [
                "ASSEMBLING THE FIELD",
                "DISSOLVING THE BOUNDARIES",
                "SHIFTING YOUR PERSPECTIVE",
              ][step]
            }
          </p>
        </div>
        <span className="mono sequence-bottom">
          YOU ARE EXACTLY WHERE YOU SHOULD BE.
        </span>
      </div>
    </dialog>
  );
}

export default function App() {
  const root = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [mode, setMode] = useState<RealityMode>("solid");
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [sceneReady, setSceneReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [staticView, setStaticView] = useState(false);
  const [sequence, setSequence] = useState(false);
  const [burst, setBurst] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [studioOpen, setStudioOpen] = useState(isStudioLocation);
  const audio = useAmbientAudio();
  useEffect(() => {
    if (studioOpen && audio.enabled && !audio.busy) void audio.toggle();
  }, [studioOpen, audio.enabled, audio.busy]);
  const current = realities.find((reality) => reality.id === mode)!;
  const ready = useCallback(() => setSceneReady(true), []);
  const fallback = useCallback(() => {
    setUnavailable(true);
    setSceneReady(true);
  }, []);
  const closeSequence = useCallback(() => {
    setSequence(false);
    setAnnouncement("Sequence cancelled. Your reality is unchanged.");
  }, []);
  const completeSequence = useCallback(() => {
    setMode(
      (previous) =>
        realities[
          (realities.findIndex((reality) => reality.id === previous) + 1) %
            realities.length
        ].id,
    );
    setBurst((previous) => previous + 1);
    setSequence(false);
    setAnnouncement("Sequence complete. The next reality is now active.");
  }, []);
  const chooseMode = (next: RealityMode) => {
    setMode(next);
    setBurst((previous) => previous + 1);
    setAnnouncement(
      `${realities.find((reality) => reality.id === next)!.name} reality activated.`,
    );
  };

  useEffect(() => {
    const navigate = () => {
      const open = isStudioLocation();
      setStudioOpen(open);
      setSequence(false);
      if (open) window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", navigate);
    window.addEventListener("popstate", navigate);
    return () => {
      window.removeEventListener("hashchange", navigate);
      window.removeEventListener("popstate", navigate);
    };
  }, []);

  useEffect(() => {
    document.title = studioOpen
      ? "NULL ORBIT Studio — Create your own reality"
      : "NULL ORBIT — Beyond the ordinary";
  }, [studioOpen]);

  const exitStudio = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("design");
    url.searchParams.delete("world");
    url.searchParams.delete("scene");
    url.searchParams.delete("scenery");
    url.hash = "top";
    window.history.pushState(null, "", url);
    setStudioOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    const update = () => {
      root.current?.style.setProperty("--scroll-offset", `${window.scrollY}px`);
      progress.current =
        window.scrollY /
        Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = reducedMotion
      ? "auto"
      : "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = previous;
    };
  }, [reducedMotion]);

  useLayoutEffect(() => {
    if (reducedMotion || studioOpen) return;
    const context = gsap.context(() => {
      gsap.from(".hero-title .word", {
        yPercent: 110,
        rotate: 3,
        duration: 1.15,
        stagger: 0.09,
        ease: "power4.out",
        delay: 0.1,
      });
      gsap.from(".hero-intro, .hero-description, .hero-bottom, .hero-aside", {
        opacity: 0,
        y: 18,
        duration: 0.9,
        stagger: 0.08,
        delay: 0.65,
        ease: "power2.out",
      });
      gsap.utils.toArray<HTMLElement>(".reveal").forEach((element) =>
        gsap.from(element, {
          opacity: 0,
          y: 38,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: { trigger: element, start: "top 92%", once: true },
        }),
      );
    }, root);
    return () => context.revert();
  }, [reducedMotion, studioOpen]);

  if (studioOpen) {
    return (
      <Suspense
        fallback={
          <div className="studio-loading">
            <OrbitMark />
            <p>Opening your creative space…</p>
          </div>
        }
      >
        <CreatorStudio
          onExit={exitStudio}
          reducedMotion={reducedMotion}
          onToggleMotion={() => setReducedMotion((value) => !value)}
        />
      </Suspense>
    );
  }

  return (
    <div
      ref={root}
      className={`site mode-${mode}${reducedMotion ? " reduced-motion" : ""}`}
    >
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div
        className={`scene-layer${sceneReady ? " is-ready" : ""}${unavailable || staticView ? " is-unavailable" : ""}`}
      >
        {(!sceneReady || unavailable || staticView) && (
          <FallbackObject mode={mode} />
        )}
        {!unavailable && !staticView && (
          <Suspense fallback={null}>
            <Scene
              mode={mode}
              reducedMotion={reducedMotion}
              progress={progress}
              burst={burst}
              onReady={ready}
              onUnavailable={fallback}
            />
          </Suspense>
        )}
      </div>
      <div className="grain" aria-hidden="true" />
      <header className="site-header">
        <a className="brand" href="#top" aria-label="NULL ORBIT, back to top">
          <OrbitMark />
          <span>
            NULL
            <br />
            ORBIT<span className="brand-dot">°</span>
          </span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a className="nav-studio" href="#studio">
            Create a wallpaper <span>↗</span>
          </a>
          <a href="#experiment">
            The experiment <span>01</span>
          </a>
          <a href="#philosophy">
            Field notes <span>02</span>
          </a>
        </nav>
        <div className="header-tools">
          <button
            className="sound-button"
            aria-pressed={audio.enabled}
            aria-label={
              audio.enabled ? "Mute ambient sound" : "Enable ambient sound"
            }
            onClick={() => void audio.toggle()}
            disabled={audio.busy}
          >
            <SoundIcon active={audio.enabled} />
            <span>Sound {audio.enabled ? "on" : "off"}</span>
          </button>
          <span className="header-divider" />
          <button
            className="motion-button"
            onClick={() => setReducedMotion((value) => !value)}
            aria-pressed={reducedMotion}
            aria-label={reducedMotion ? "Enable full motion" : "Reduce motion"}
          >
            <span
              className={`motion-indicator${reducedMotion ? " is-paused" : ""}`}
              aria-hidden="true"
            />
            <span>{reducedMotion ? "Motion off" : "Motion on"}</span>
          </button>
        </div>
      </header>

      <main id="main">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-intro">
            <span className="status-dot" />
            <p className="mono">AN EXPERIMENT IN DIGITAL GRAVITY</p>
            <span className="edition mono">EST. 2026 / VOL. 001</span>
          </div>
          <div className="hero-copy">
            <h1 className="hero-title" id="hero-title">
              <span className="word-clip">
                <span className="word">BEYOND</span>
              </span>
              <span className="word-clip">
                <span className="word word-middle">
                  THE{" "}
                  <span className="title-orbit" aria-hidden="true">
                    ✳
                  </span>
                </span>
              </span>
              <span className="word-clip">
                <span className="word word-outline">ORDINARY.</span>
              </span>
            </h1>
            <div className="hero-description">
              <span className="small-cross" aria-hidden="true">
                +
              </span>
              <div>
                <p>
                  An impossible wallpaper. Made by you.
                  <br />
                  Shape it. Make it yours. Take it with you.
                </p>
                <div className="hero-entry-links">
                  <a href="#studio" className="studio-entry">
                    Create your wallpaper <Arrow diagonal />
                  </a>
                  <a href="#experiment" className="explore-link">
                    Explore the experiment <span aria-hidden="true">↓</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
          <aside className="hero-aside">
            <span className="target-mark" aria-hidden="true" />
            <p className="mono">
              OBJECT N° 001
              <br />
              <span>ORBITAL ANOMALY</span>
            </p>
            <span className="aside-line" />
            <p className="mono aside-state">{current.material}</p>
          </aside>
          <div className="object-instruction mono">
            <span className="drag-icon" aria-hidden="true">
              {staticView || unavailable ? "+" : "↔"}
            </span>
            {unavailable
              ? "STATIC STUDY / 3D UNAVAILABLE"
              : staticView
                ? "STATIC STUDY / SAME CURIOSITY"
                : sceneReady
                  ? "DRAG THE OBJECT TO REORIENT"
                  : "CONSTRUCTING THE ANOMALY…"}
          </div>
          <button
            className="render-toggle mono"
            onClick={() => {
              if (staticView || unavailable) {
                setSceneReady(false);
                setUnavailable(false);
                setStaticView(false);
              } else setStaticView(true);
            }}
          >
            {unavailable
              ? "Retry 3D ↗"
              : staticView
                ? "Explore in 3D ↗"
                : "Static view ↗"}
          </button>
          <div className="hero-bottom">
            <div className="reality-controls">
              <span className="mono reality-label">
                CHANGE REALITY <span>↘</span>
              </span>
              <div
                className="reality-switch"
                role="group"
                aria-label="Reality state"
              >
                {realities.map((reality) => (
                  <button
                    key={reality.id}
                    onClick={() => chooseMode(reality.id)}
                    aria-pressed={mode === reality.id}
                  >
                    <span className="mode-number">{reality.index}</span>
                    {reality.name}
                    <span className="mode-active" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
            <div className="hero-bottom-note mono">
              <span className="status-dot" />
              {unavailable || staticView
                ? "STATIC EXPLORATION"
                : "REAL-TIME / BROWSER-GENERATED"}
              <span className="down-arrow" aria-hidden="true">
                ↓
              </span>
            </div>
          </div>
        </section>

        <div className="chapter-divider">
          <span className="mono">NO MAP. NO LIMITS. JUST POSSIBILITY.</span>
          <span className="divider-star" aria-hidden="true">
            ✳
          </span>
          <span className="mono">
            SCROLL A LITTLE FURTHER <span aria-hidden="true">↘</span>
          </span>
        </div>

        <section
          className="experiment section-shell"
          id="experiment"
          aria-labelledby="experiment-title"
        >
          <div className="section-heading reveal">
            <p className="eyebrow">
              <span className="mini-plus" aria-hidden="true">
                +
              </span>{" "}
              01 / THE REALITY ENGINE
            </p>
            <span className="mono section-coordinate">
              [ INTERACTIVE STUDY ]
            </span>
          </div>
          <div className="experiment-intro">
            <h2 className="display-heading reveal" id="experiment-title">
              THREE STATES.
              <br />
              <span className="muted-heading">ZERO RULES.</span>
            </h2>
            <div className="section-intro-copy reveal">
              <p>
                Reality is a matter of perspective.
                <br />
                Go ahead. Change yours.
              </p>
              <span className="mono">
                SELECT A STATE TO RESHAPE THE OBJECT ↓
              </span>
            </div>
          </div>
          <div
            className="state-grid reveal"
            role="group"
            aria-label="Explore three states of matter"
          >
            {realities.map((reality) => (
              <button
                className={`state-card${mode === reality.id ? " selected" : ""}`}
                key={reality.id}
                aria-pressed={mode === reality.id}
                onClick={() => chooseMode(reality.id)}
              >
                <div className="state-card-top">
                  <span className="mono">
                    {reality.index} / {reality.material.split(" / ")[0]}
                  </span>
                  <span className="state-select-icon" aria-hidden="true">
                    {mode === reality.id ? "−" : "+"}
                  </span>
                </div>
                <ModeDiagram mode={reality.id} />
                <div className="state-card-title">
                  <h3>{reality.name}</h3>
                  <Arrow diagonal />
                </div>
                <p>{reality.character}</p>
                <div className="state-card-bottom mono">
                  <span>
                    {mode === reality.id
                      ? "CURRENT REALITY"
                      : "ENTER THIS STATE"}
                  </span>
                  <span className="state-dot" />
                </div>
              </button>
            ))}
          </div>
          <div className="state-description reveal" aria-live="polite">
            <span className="mono">CURRENT STATE / {current.index}</span>
            <p>{current.description}</p>
            <span className="mono simulation-label">
              SIMULATION
              <br />
              NOT SENSOR DATA
            </span>
          </div>
        </section>

        <section
          className="philosophy section-shell"
          id="philosophy"
          aria-labelledby="philosophy-title"
        >
          <div className="section-heading reveal">
            <p className="eyebrow">
              <span className="mini-plus" aria-hidden="true">
                +
              </span>{" "}
              02 / NOTES FROM THE EDGE
            </p>
            <span className="mono section-coordinate">
              [ THE THINKING BEHIND THE FEELING ]
            </span>
          </div>
          <div className="philosophy-grid">
            <div className="philosophy-title-block reveal">
              <h2 id="philosophy-title">
                The internet
                <br />
                could use a little
                <br />
                <em>more strange.</em>
              </h2>
              <div className="orbital-sketch" aria-hidden="true">
                <OrbitMark />
                <span className="mono">IDEA ↔ INTERACTION ↔ EMOTION</span>
              </div>
            </div>
            <div className="field-notes">
              <p className="philosophy-lead reveal">
                Somewhere between a sculpture and a small act of rebellion.
              </p>
              <p className="philosophy-body reveal">
                NULL ORBIT is a browser-generated art experiment. A place to get
                lost for a minute, touch the impossible, and remember that a
                screen can still surprise you.
              </p>
              <div className="note reveal">
                <span className="mono">001</span>
                <div>
                  <h3>Space is the interface.</h3>
                  <p>
                    Depth, light, and movement become things you can explore.
                    Move your pointer. Drag the form. Follow your curiosity.
                  </p>
                </div>
              </div>
              <div className="note reveal">
                <span className="mono">002</span>
                <div>
                  <h3>Nothing is pre-rendered.</h3>
                  <p>
                    Every fragment lives in your browser. The sculpture is drawn
                    in real time, and your gestures become part of it.
                  </p>
                </div>
              </div>
              <div className="note reveal">
                <span className="mono">003</span>
                <div>
                  <h3>Take it at your own pace.</h3>
                  <p>
                    Sound is yours to switch on. Motion is yours to turn down.
                    There is no wrong way to be here.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="finale section-shell"
          aria-labelledby="finale-title"
        >
          <div className="finale-top reveal">
            <p className="eyebrow">
              <span className="status-dot" /> THE NEXT DIMENSION IS A CLICK
              AWAY.
            </p>
            <span className="mono">[ EXPERIMENT CONTINUES ]</span>
          </div>
          <div className="finale-main">
            <h2 className="reveal" id="finale-title">
              STAY
              <br />
              <span>CURIOUS.</span>
            </h2>
            <button
              className="sequence-launch reveal"
              onClick={() => setSequence(true)}
              aria-haspopup="dialog"
            >
              <Arrow diagonal />
              <span>
                Initiate
                <br />
                sequence
              </span>
              <span className="mono">A SHIFT IN PERSPECTIVE</span>
            </button>
          </div>
          <div className="finale-bottom">
            <p>
              Step outside the expected.
              <br />
              See what happens next.
            </p>
            <OrbitMark />
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <a href="#top" className="footer-brand">
          NULL ORBIT<span>© 2026</span>
        </a>
        <p className="mono">
          AN INDEPENDENT EXPERIMENT. MADE OF CURIOSITY & CODE.
        </p>
        <a href="#top" className="back-top">
          Back to the surface <span aria-hidden="true">↑</span>
        </a>
      </footer>
      <SequenceDialog
        open={sequence}
        reducedMotion={reducedMotion}
        onClose={closeSequence}
        onComplete={completeSequence}
      />
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
        {audio.error && ` ${audio.error}`}
      </div>
    </div>
  );
}

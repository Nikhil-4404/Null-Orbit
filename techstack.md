# Technology and environment

Current scope: 18 October 2026. Manifests and lockfile remain the canonical dependency inventory; retiring creators does not change dependencies.

## Architecture

A static frontend in `D:\Gpt projs\null-orbit` with an exhibition and browser-local Object Studio. React/TypeScript own UI and design state. Three.js through React Three Fiber renders procedural geometry and GLSL, with Drei helpers. GSAP drives exhibition entrances/reveals; the scene loop handles sculpture animation. Custom CSS supplies responsive layouts. No backend or remote renderer is required.

| Layer | Selection / responsibility |
|---|---|
| UI | React 19.3.1, TypeScript 7.0.2 |
| Development/build | Vite 8.3.4; tested Node.js 22.21.1 and npm 10.9.4 on Windows |
| 3D | Three.js 0.186.1, React Three Fiber 9.8.2, Drei 10.7.9 |
| Animation | GSAP 3.15.0 and the scene loop |
| Styling/surfaces | Custom CSS, procedural geometry, GLSL |
| Sound | Browser Web Audio API, opt-in synthesized audio |
| Active storage | Object v1 localStorage collection with strict validation |
| Sharing/export | Base64url JSON, WebGL drawing-buffer capture, Canvas PNG encoding; WebCodecs and Mediabunny 1.61.5 for timestamped WebM; captureStream/MediaRecorder fallback |
| Tests | Node built-in `node:test`, strict assertions and TypeScript stripping |
| Backend/accounts | None |

Use a Node release compatible with locked Vite and the test command's TypeScript stripping; other runtime versions require their own checks. Fonts are bundled. No new asset-preparation dependency, provider credential or environment variable is required by the active application.

## Reproducible commands

```powershell
cd 'D:\Gpt projs\null-orbit'
npm install
npm run dev
npm test
npm run typecheck
npm run build
npm run preview
```

Development and preview bind to `127.0.0.1`; Vite prints the selected port. `dist/` is generated static output. Building/previewing does not publish it. A future host must serve same-origin assets and preserve query strings/hash navigation; deployment is outside this increment.

## State, routing and rendering boundaries

`src/design.ts` owns object v1 enums, strict hex colors, finite bounded numbers, complete share validation, presets and browser favorites. `?design=…&format=…#studio` restores the design and whitelisted format. Favorites use `null-orbit:designs:v1` and are not synchronized. [requirements.md](requirements.md) owns detailed bounds and failure contracts.

App navigation exposes exhibition and Object Studio. Old `#worlds` and standalone `world`, `scene` or `scenery` queries recover to Object Studio after those parameters are stripped. They do not invoke removed schemas or migrate old payloads. Prior world/cinematic/scenery storage is left untouched and is not an active collection.

Retired source, assets and specifications are retained in `work/removed-world-studios-2026-10-18/`, outside active `src/` and `public/`. They must not be imported by the active app or included in generated public assets. The archived specifications preserve earlier implementation decisions without advertising those editors as current capabilities.

`Scene.tsx` owns rendering and the `SceneExporter` interface. `studio-appearance.ts` applies material, particle and lighting state consistently to preview/capture. The exhibition's static mode releases its canvas. Continuous rendering pauses offscreen/when hidden; pause/reduced motion still permits interactive updates. Only the active experience mounts its canvas.

PNG export validates application/GPU limits, resizes the physical WebGL drawing buffer, renders through normal tone mapping/color output, copies actual pixels into a 2D canvas and restores/repaints the preview before asynchronous encoding. Browser/GPU capability or memory may still reject a valid format. `capture-renderer.ts` reasserts physical dimensions, DPR, render target and viewport for manually rendered animation frames after asynchronous encoder work.

## Animation encoder

`src/animation.ts` owns capability checks, target validation and two encoding paths. Frame-by-frame WebM uses browser WebCodecs and dynamically imported Mediabunny 1.61.5. Every real artwork frame has an explicit timestamp; awaiting encoding backpressure preserves the chosen timeline instead of skipping frames for wall-clock speed. Probe the requested codec/dimensions/frame rate before allocation. API availability is not proof every listed target works.

Select 6/10 seconds, 720p–4K and 24/30/60/120/144/240 fps subject to support. Maximum dimensions, pixel/output caps and resolution mapping remain canonical in [requirements.md](requirements.md). High FPS means actual timestamped rendering, not duplicated lower-FPS frames or metadata changes. The 80 Mbps ceiling and 128 MiB cap constrain quality at the largest targets.

Without frame-by-frame APIs or a usable basic HD/24 frame encoder, manually controlled artwork frames feed a dedicated recording canvas and MediaRecorder for the limited 720p/24 real-time fallback. Its timing depends on device load. Neither path requests microphone, camera or screen permission.

Exports snapshot design/renderer state. Progress, cancellation, hidden-tab/unmount/context-loss abort, bounded output and cleanup are explicit; success/error/cancel restores preview. Keep the tab visible; export may take longer than the clip. If cancellation arrives during final muxing/encoder flush, discard the result and remain busy until finalization settles. Mediabunny cannot forcibly interrupt finalization; a permanently stalled codec flush may require reload. Worker isolation remains deferred. WebM is the output container; no hosted render service, MP4 conversion or OS installer is included.

## Verification boundaries

`npm test` runs active `src/*.test.ts` with Node's built-in runner. Storage/location doubles do not exercise real browser storage, clipboard, GPU rendering, encoders or downloads. Node-only test sources are excluded from the application build. Archived tests are historical and are outside the active test glob.

Type checking, build, local startup and real browser workflows provide separate evidence. [status.md](status.md) owns current results, bundle measurements and limitations; do not carry historical passes forward after behavior changes. Cross-browser/physical-device coverage, screen readers, audio output, GPU/context recovery, cold-load/frame-rate benchmarks and production readiness need explicit evidence.

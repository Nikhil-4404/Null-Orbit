# NULL ORBIT

A browser-generated 3D exhibition and Object Studio. Explore the procedural sculpture, then customize an abstract wallpaper, download a PNG or silent WebM, save browser favorites, or share its complete settings. Procedural readings are art/simulation, not sensor data. No AI generation is used.

Project location: `D:\Gpt projs\null-orbit`. Current scope: 18 October 2026.

## Run locally

Tested Windows toolchain: Node.js 22.21.1 and npm 10.9.4. The application uses React, TypeScript, Vite, Three.js, React Three Fiber, Drei, GSAP, CSS and GLSL. `package.json` and `package-lock.json` own exact dependencies.

```powershell
cd 'D:\Gpt projs\null-orbit'
npm install
npm run dev
```

Open Vite's printed address, normally [http://127.0.0.1:5173](http://127.0.0.1:5173). Servers bind to `127.0.0.1`.

## Create a wallpaper

1. Select Create your wallpaper or open `/#studio`.
2. Choose Chrome Eclipse, Solar Core, Signal Storm, Porcelain Orbit, Deep Space or Liquid Ember.
3. Adjust mode, shape, material, colors, lighting, speed, particles, zoom and orientation. Pause/reduced motion retains editing.
4. Choose Desktop (1920×1080), Phone (1080×1920), Square (1080×1080) or Ultrawide (2560×1080), then Download PNG.
5. Use Live wallpaper for silent WebM: 6/10 seconds, 720p–4K and up to 240 fps with a supported frame-by-frame browser encoder. Each chosen timestamp is rendered; export can take longer than playback. Keep the tab visible. Unsupported devices retain the described HD/24 real-time fallback. Quality support depends on browser, GPU and encoder.
6. Save a named favorite or copy a share link. Favorites stay on this browser/origin, up to 20 names of 40 characters. Clearing site data removes them; there is no cloud backup.

Share links use `?design=…&format=…#studio`. They restore validated v1 design settings, pose and aspect ratio. Invalid, oversized or unsupported links recover to a default with an explanation. Storage, clipboard and rendering failures remain visible. Real PNG/video export requires a ready GPU scene; fallback artwork is never substituted as a successful download.

A downloaded WebM needs a compatible wallpaper player to become an OS live wallpaper. The website does not install it. MP4, iPhone Live Photo conversion and interactive wallpaper packages are outside scope.

Back to experience returns to the exhibition. Select Solid, Liquid or Signal, drag the sculpture, explore the narrative, or initiate the sequence. Sound starts silent and is opt-in. Reduced motion initially follows the OS. Static View releases the canvas; Explore in 3D restores it and Retry 3D supports recovery.

## Retired creators

World Studio, its cinematic/legacy variants and Scenery Studio have been removed from the active application at the user's request. Old `#worlds` or standalone `world`, `scene` and `scenery` query links recover to Object Studio with retired parameters removed. Their data is never interpreted as an object design.

Existing browser storage is left untouched. Historical source, assets and specifications are retained locally under `work/removed-world-studios-2026-10-18/`, outside application source/public output. The removed creators are not active features or navigation options.

## Check and build

```powershell
npm test
npm run typecheck
npm run build
npm run preview
```

Tests use Node's built-in runner; explicit storage/location doubles do not prove browser behavior. `dist/` is generated static output. Preview normally serves [http://127.0.0.1:4173](http://127.0.0.1:4173); these commands do not publish it. [status.md](status.md) records current evidence, limitations and unexecuted checks. Historical passes do not establish correctness after changes.

## Project map

- `src/App.tsx` — exhibition, navigation, sound/motion and initiation.
- `src/Studio.tsx`, `src/studio.css` — Object Studio, presets, favorites, share and export actions.
- `src/Scene.tsx`, `src/studio-appearance.ts` — procedural rendering and shared preview/export appearance.
- `src/design.ts` — object v1 schema, presets, formats, validation, storage and URLs.
- `src/animation.ts`, `src/capture-renderer.ts` — browser-local encoder capability, timestamped capture, cancellation and target limits.
- `src/styles.css` — exhibition styling and responsive layout.
- `src/*.test.ts` — Node boundary and capture tests; excluded from the browser build.
- `work/` — local archives and verification material; ignored by Git and not included in a fresh clone.
- [prd.md](prd.md), [requirements.md](requirements.md), [techstack.md](techstack.md), [flow.md](flow.md), [frontend.md](frontend.md) — current contracts.
- [status.md](status.md) — implementation and verification status.

No account, backend, required secret, remote API, cloud storage, AI generation or deployment is included. Production readiness and cross-device performance require separate evidence.

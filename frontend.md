# Frontend contract

Current scope reviewed 18 October 2026. [requirements.md](requirements.md) owns acceptance criteria/data limits; [status.md](status.md) owns verification evidence.

## Screens and navigation

The static React application contains the observatory exhibition and Object Studio (`#studio`). The exhibition retains the near-black, ivory, chrome and vermilion design, interactive sculpture, editorial hierarchy, controls and narrative. Landing/workspace navigation exposes Object Studio; Back to experience returns to the exhibition. Only the active experience mounts its GPU canvas.

World Studio, cinematic/legacy world editors and Scenery Studio are retired from active imports, source/public content and navigation. Old `#worlds` and standalone `world`, `scene` or `scenery` query links recover to Object Studio after removing retired parameters. Removed payloads never become object designs. `?design=…&format=…#studio` retains its v1 meaning; a whitelisted format restores aspect ratio, otherwise Desktop. Historical source/assets/specifications remain outside the app under `work/removed-world-studios-2026-10-18/`. Retirement performs no localStorage migration or deletion.

Object Studio retains its preview, six complete presets, real 3D controls, four formats, favorites, sharing, PNG and WebM. The create → preview → export hierarchy remains reachable on desktop and phone. There are no account, payment, cloud-library or removed-editor screens.

## State ownership

- `App.tsx`: exhibition reality, optional sound, motion preference, initiation and route state. Return to the exhibition removes `design`, `world`, `scene` and `scenery` parameters; `format` can remain in the address.
- `Studio.tsx`: complete `SceneDesign`, format, favorites, preview pause, render readiness, async feedback and errors. Preset/favorite replaces the complete design.
- `design.ts`: v1 schema, numeric/color normalization, strict share decoding, URL generation, preset/format definitions and validated storage boundary. Unknown data never becomes markup or code.
- `Scene.tsx`: GPU resources, procedural geometry/materials, animation, pointer interaction and `SceneExporter`. Serializable pose belongs to the design; runtime animation phase/renderer state does not.
- `studio-appearance.ts`: shared application of mutable material, particle and lighting settings before preview/capture.
- `animation.ts` and `capture-renderer.ts`: capability probes, target limits, timestamped frame encoding, physical-buffer guards and cleanup.

Sound follows explicit activation/cleanup and is muted on studio entry. Motion preference is session state. Favorites alone persist; unsaved document state belongs to the mounted studio. Save/share before leaving or reloading. Retired world/cinematic/scenery collections are left untouched and have no active editor.

## Controls and rendering

Presets are Chrome Eclipse, Solar Core, Signal Storm, Porcelain Orbit, Deep Space and Liquid Ember. Mode, shape, material, accent/background, lighting, speed, particles, zoom and orientation affect the actual renderer. Keyboard controls provide access to settings; pointer/touch dragging changes object orientation. Preview uses the chosen Desktop/Phone/Square/Ultrawide aspect ratio. Pause/reduced motion suppresses continuous animation while retaining edits and ready stills.

The exhibition's pointer-transparent narrative layout must be scoped to exhibition content. Object Studio controls receive pointer input; global layout rules must not disable its sliders or buttons.

## Export

`SceneExporter.exportPng({ width, height }): Promise<Blob>` renders exact-size real artwork after a ready frame. Snapshot complete design, apply current appearance and pose, size the physical drawing buffer, render through the normal tone-mapped/color-output path, copy pixels into a dedicated 2D canvas, then restore/repaint preview before PNG encoding. Downloads omit interface and watermarks. Failure restores usable state with an error; static fallback or UI screenshots cannot substitute for real capture.

`SceneExporter.exportAnimation` supplies silent WebM. Live wallpaper beside Download PNG opens, scrolls to and focuses the animation panel; its primary action is Download live wallpaper. Keep that shortcut readable when motion is paused/unsupported so users can discover the reason. During export disable editing/quality changes and expose progress/cancel.

Offer 6/10 seconds, 720p/1080p/1440p/4K and 24/30/60/120/144/240 fps with frame-by-frame APIs. Initial 1080p/60 fps is an API-based default, not device certification. Probe the actual requested codec/dimensions/FPS before capture. Unsupported choices retain the request and show recovery; never silently lower quality.

Each frame renders from the full design snapshot at an explicit timeline timestamp, with encoding backpressure rather than wall-clock frame skipping. Reassert physical buffer dimensions, DPR, target and viewport after asynchronous work. Before download validate encoded packet count against duration × FPS. The limited 720p/24 real-time fallback explains device-dependent timing. Keep the tab visible; encoding may take longer than playback.

Particle count/opacity/color, material, mode, background, pose, zoom, lighting and reflections must match the current design in PNG/video. Shader-feature changes invalidate the material program and lighting/accent changes refresh reflection capture. State tests alone do not prove visible export parity; actual decoded output is separate evidence.

Cancel, hidden tab, unmount, context loss or encoding failure discards partial output, stops resources and restores preview/control state. Cancellation during final encoder flush waits for finalization before retry; a stalled flush may require reload. Browser/GPU/codec/memory failures remain readable. Application dimensions/output caps are canonical in [requirements.md](requirements.md).

Guidance separates download from installing an OS wallpaper with a compatible player. No native installer, MP4, iPhone Live Photo conversion or hosted rendering is provided.

## Persistence and feedback

Favorites use `null-orbit:designs:v1`, at most 20 records with plain-text names up to 40 characters. Invalid records, blocked/full storage and failed writes show errors; a failed write never reports saved. Text names render as escaped React content. Shared URLs carry validated design settings rather than a cloud image/record; malformed/future shares recover to a default with explanation. Clipboard rejection leaves a manually usable link.

Async actions expose pending/success/error states. Failure cannot leave controls indefinitely busy or erase the current design. Retirement must not clear, reinterpret or overwrite existing collections.

## Responsive and accessible behavior

Target 1440×900 desktop and 390×844 mobile with controls, preview, export and favorites reachable and no horizontal page overflow. Use semantic headings/buttons/links, labeled controls, selected/disabled states, visible focus and understandable status/error announcements. The four Object Studio header actions use two columns on small screens; animation download actions retain contrast despite shared button reset styles.

Honor OS reduced motion and the visible session override. Sound starts silent. Selection/failure is communicated beyond color. The native initiation dialog supports Cancel/Escape, clears timers, restores scrolling and returns focus to its launcher.

## Loading and recovery

The semantic exhibition does not depend on 3D success. A mode-aware SVG study remains during loading/static/error states. Static View releases the canvas, Explore in 3D remounts it, Retry 3D recovers failure, and hidden/offscreen scenes stop continuous rendering. Procedural telemetry stays labeled simulation/art.

Studio readiness/errors distinguish a real rendered wallpaper from unavailable GPU output. Browser usability, route recovery, actual storage/clipboard/downloads and model tests are separate evidence in [status.md](status.md); source contracts alone do not establish passes.

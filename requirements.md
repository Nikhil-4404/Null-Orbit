# Requirements and acceptance

Current scope reviewed 18 October 2026: exhibition and Object Studio. These are intended outcomes; passing evidence belongs in [status.md](status.md). World and scenery creator requirements are retired as described below.

## Exhibition

| ID | Requirement | Acceptance criterion |
|---|---|---|
| REQ-01 / AC-01 | A distinctive observatory landing page | Initial desktop view shows NULL ORBIT identity, a visible sculpture or graceful fallback, legible editorial text, and entry/navigation controls. |
| REQ-02 / AC-02 | Three reality modes | Selecting Solid, Liquid, or Signal changes the active control, explanatory copy, and scene appearance. Repeated selection remains usable. |
| REQ-03 / AC-03 | Direct scene interaction | Dragging rotates the sculpture with pointer feedback; releasing ends the drag. Essential content and mode controls remain usable without dragging. |
| REQ-04 / AC-04 | Scroll narrative | Enter the Anomaly moves into the narrative. Scrolling advances the page and scene/camera composition without trapping navigation. |
| REQ-05 / AC-05 | Initiation sequence | Initiate Sequence opens a deterministic modal and completes after 4.4 seconds, or 3.6 with reduced motion, cycling to the next reality. Cancel/Escape preserves the mode. Closing restores focus, scrolling, timers, and idle state. |
| REQ-06 / AC-06 | Optional sound | Initial load is silent. An explicit action starts synthesized audio when supported; mute stops output and cleanup releases resources. Audio denial leaves the page usable. |
| REQ-07 / AC-07 | Motion preference | Initial state respects the OS preference; a visible control changes continuous motion and long transitions with an understandable active state. |
| REQ-08 / AC-08 | Responsive and accessible exhibition | At 390px and 1440px widths, key content/controls have no horizontal page overflow. Primary controls are semantic, keyboard reachable, visibly focused, and legible. |
| REQ-09 / AC-09 | Honest simulation and fallback | Procedural readings are labeled simulated. Static View unmounts the canvas and shows a mode-aware SVG; Explore in 3D restores it. Unavailable WebGL2 retains readable content and exposes Retry 3D. |
| REQ-10 / AC-10 | Reproducible local frontend | `npm install`, `npm test`, `npm run typecheck`, and `npm run build` succeed on the documented toolchain. Development and production-preview commands serve locally. |

## Object Studio

| ID | Requirement | Acceptance criterion |
|---|---|---|
| REQ-11 / AC-11 | Enter and exit the studio | Desktop/mobile landing exposes Create your wallpaper. `#studio` opens the workspace; Back to experience restores the exhibition. Direct shared URLs open the editor. |
| REQ-12 / AC-12 | Real visual customization | Mode, accent/background, material, shape, lighting, speed, particle density, zoom, and orientation alter the actual preview. Pause/reduced motion retain editing. Bounds apply to controls and untrusted state. |
| REQ-13 / AC-13 | Curated starting points | Six named presets restore complete configurations with different compositions. A preset can be reapplied after editing. |
| REQ-14 / AC-14 | Download a real wallpaper | Four previews match their selected aspect ratio. PNG export renders the actual 3D scene, excludes interface/watermarks, and has the exact requested dimensions. Repeated exports restore the live preview. Unavailable GPU/export errors retain controls and show a readable error. |
| REQ-15 / AC-15 | Browser-local collection | A named design survives reload on the same browser/origin, can be restored and removed, and is capped at 20 favorites. Storage denial/corruption/quota errors are visible; editing remains usable. |
| REQ-16 / AC-16 | Share a reproducible design | Share produces a versioned URL that restores settings and user orientation. Malformed, oversized, incomplete, and unsupported-version links show an explanation and open the default. Clipboard rejection offers a usable link without claiming success. |
| REQ-17 / AC-17 | Studio usability and recovery | At 1440×900 and 390×844, preview, controls, and export remain accessible without horizontal overflow. Controls have labels, keyboard focus, status/error feedback, and motion support. The original exhibition still renders and navigates. |

### Design and share boundary

`src/design.ts` is the canonical typed schema and normalizer. A share is base64url-encoded JSON in `?design=…#studio`; it contains settings, not an image, executable content, or a server record. The studio adds a `format` query with one of the four format IDs; unknown/absent format IDs use Desktop. Maximum encoded design length is 4096 characters. A valid shared document supplies every field below; additional properties are discarded. Missing/invalid fields, nonfinite numbers, or an unsupported version reject the entire shared document and use the default with a readable error. A missing design query uses the default without an error.

| Field | Valid v1 value |
|---|---|
| `v` | `1` |
| `mode` | `solid`, `liquid`, `signal` |
| `shape` | `orbit`, `eclipse`, `helix` |
| `material` | `chrome`, `matte`, `glass` |
| `accent`, `background` | Strict six-digit `#rrggbb` hex; normalized to lowercase |
| `speed` | Finite number, 0–2 |
| `lighting` | Finite number, 0.3–2 |
| `particles` | Finite number, 0–1 |
| `zoom` | Finite number, 0.65–1.4 |
| `rotationX`, `rotationY`, `rotationZ` | Finite degrees, −180–180 |
| `seed` | Integer, 1–999999 |

Local control normalization clamps finite numbers, canonicalizes negative zero, and substitutes default values for nonfinite/invalid types or enums. Encoding normalizes before serializing. A share restores settings and the canonical user pose, not an elapsed animation frame or the recipient's rendering hardware.

### Favorites and privacy

Favorites are stored under `null-orbit:designs:v1` in localStorage, scoped to the current browser/origin. Each has an ID, a plain-text name of at most 40 characters, a valid saved timestamp, and a complete v1 design. Control characters are removed from names; invalid records and duplicate IDs are skipped with a readable error. Collections are capped at 20. Damaged data, blocked storage, and quota failures return visible errors; failed writes must not be presented as saved. Clearing site data removes favorites. There is no account, server save, upload, or cross-device synchronization. Shared settings leave the browser only when the user distributes the generated URL.

### Export sizes and capability limits

| Format | PNG dimensions |
|---|---|
| Desktop | 1920×1080 |
| Phone | 1080×1920 |
| Square | 1080×1080 |
| Ultrawide | 2560×1080 |

Exports require a ready GPU scene. The renderer limits dimensions to positive integers, no more than 3840 pixels on either edge and 8,300,000 pixels total, and checks the GPU texture limit. These are application limits, not a guarantee every device can allocate them. Drawing-buffer allocation/capture and PNG encoding can fail because of browser/GPU memory or context loss. Show that failure and offer recovery; never substitute a synthetic image or claim a successful download. Animation export has a separate contract below; audio-reactive exports remain outside scope.

## Object Studio animation

| ID | Requirement | Acceptance criterion |
|---|---|---|
| REQ-24 / AC-24 | Download a live wallpaper | Object Studio exposes actual silent WebM downloads with 6/10-second durations, 720p/1080p/1440p/4K choices and 24/30/60/120/144/240 fps choices when frame-by-frame encoding is available. Render and encode every selected timestamp without dropping frames for wall-clock speed. Default to 1080p/60 fps when the required APIs exist, then probe the actual codec/configuration before export. Unsupported settings show a readable error and smaller-quality suggestion without silently lowering quality. Without frame-by-frame APIs, explain the limited 720p/24 fps real-time fallback. Show progress and cancellation, disable editing during export, abort on hidden tab/unmount/context loss, and restore preview on success/error/cancel. Motion-off/paused designs explain the disabled action. Real files must establish dimensions, timing, playback and recovery; API detection alone does not prove device support. |

Live wallpaper opens and focuses the export panel. Downloading a video does not install it as an OS wallpaper; guidance explains importing WebM into a compatible wallpaper player. MP4 conversion, iPhone Live Photo conversion, interactive wallpaper packages and native installation remain outside scope. Exports use only the artwork canvas and request no microphone, camera or screen permission.

### Animation quality and resource limits


| Resolution | Desktop | Phone | Square | Ultrawide |
|---|---|---|---|---|
| 720p | 1280×720 | 720×1280 | 720×720 | 1280×540 |
| 1080p | 1920×1080 | 1080×1920 | 1080×1080 | 1920×810 |
| 1440p | 2560×1440 | 1440×2560 | 1440×1440 | 2560×1080 |
| 4K | 3840×2160 | 2160×3840 | 2160×2160 | 3840×1620 |

These labels select output size while retaining the chosen format's aspect ratio; Square and Ultrawide are not 16:9 outputs. Frame-by-frame export accepts 24, 30, 60, 120, 144 or 240 fps and renders exactly duration × fps frames: 1,440 frames for six seconds at 240 fps and 2,400 for ten seconds. Encoding waits for backpressure rather than dropping frames; a ten-second video may take longer than ten seconds to export. Keep the tab visible until completion. Frame accuracy describes the encoded timeline, not live preview performance or guaranteed encoder support. High frame-rate choices still require an encoder supporting the selected dimensions and frame rate; no automatic lowering or repeated-frame substitution is permitted.

Object Studio video/PNG exports must apply the complete current design, including particle count/opacity/color, lighting/reflections, material, mode, background, pose and zoom before capture. Acceptance of lighting/particle export parity requires decoded frames from real six- and ten-second downloads, not only control values or serialized settings; current evidence belongs in status.md.

Frame-by-frame animated exports are bounded to 3840 pixels on either edge, 8,300,000 pixels total and 128 MiB compressed output. Encoding uses a resolution/frame-rate-based bitrate between 4.5 and 80 Mbps. GPU limits, codec support, memory, device speed and browser behavior can reject a configuration below these application bounds. Do not silently substitute a lower selected resolution/frame rate or claim a download when encoding fails. Real-time fallback remains 720p at a 24 fps target with its existing 32 MB captured-data limit; its frame timing can vary with device load.

## Object-only product scope

| ID | Requirement | Acceptance criterion |
|---|---|---|
| REQ-42 / AC-42 | Retire world and scenery creators while retaining Object Studio | Exhibition and Object Studio remain the only active experiences. Remove World Studio, cinematic/legacy world editors, Scenery Studio, their entry links and their modules/assets from active application source/public output. Old `#worlds` and standalone `?world=`, `?scene=` or `?scenery=` URLs recover to `#studio`, removing retired parameters without interpreting their payloads as object designs. Existing `#studio` and validated `?design=…&format=…#studio` links retain their meaning. Keep all six object presets, controls, favorites, share, exact PNG export and WebM quality choices through 240 fps. Do not clear, migrate, rewrite or overwrite existing browser collections as part of retirement. Historical source/assets/specifications remain in the local work archive outside the active app. |

REQ-18–23 and REQ-25–41 are historical, superseded by REQ-42 on 18 October 2026. Their original contracts are preserved locally in `work/removed-world-studios-2026-10-18/docs/requirements.md` (Git-ignored and absent from fresh clones); their numbers are not reused. REQ-24 remains active only for Object Studio. Historical world/cinematic/scenery collections may remain in browser storage but have no active editor or migration in this version.

## Constraints and quality targets

- Static frontend: no authentication, backend, required remote API, publication or secrets.
- Target modern WebGL2 browsers; actual browser/OS/device coverage is recorded separately.
- Only the active experience mounts its canvas. Pause continuous rendering offscreen/when hidden, release the canvas in exhibition static view, and dispose GPU/audio/listener resources. Studio pause/reduced motion still permits editing.
- Procedural geometry and bundled fonts supply the active visual experience; no AI generation or external asset service.
- Smooth interaction and 60 fps are design targets until measured; physical-phone performance, accessibility and cold-load time need separate evidence.
- Tests may use explicit in-memory storage/location doubles. Browser checks separately establish real storage, clipboard, rendering, downloads and route recovery.
- No analytics, real sensor data, user audio uploads, cloud collection or OS-setting changes are part of this version.

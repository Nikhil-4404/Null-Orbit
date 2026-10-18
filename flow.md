# User flows and lifecycle

Current scope: exhibition and Object Studio, 18 October 2026. Observable acceptance is in [requirements.md](requirements.md); actual verification is in [status.md](status.md).

## Exhibition and navigation

1. Open the landing page. Read the observatory narrative while a procedural sculpture or composed fallback is shown.
2. Select Solid, Liquid or Signal; drag the sculpture, explore the scroll narrative, or initiate the sequence. Motion controls and optional sound remain available.
3. Select Create your wallpaper to enter `#studio`. Returning with Back to experience restores the exhibition and removes the `design`, `world`, `scene` and `scenery` parameters; `format` can remain in the address.
4. Only the active experience mounts its canvas. No world/scenery creator navigation is exposed.

## Retired-link recovery

Old `#worlds` URLs and standalone `?world=`, `?scene=` or `?scenery=` links open Object Studio at `#studio` with the retired parameters removed. Their payloads are not decoded as object designs. A present object `design` query continues through normal v1 validation rather than accepting a retired schema. Recovery does not delete, migrate or overwrite any browser collection. Retired editors and data schemas remain historical in `work/removed-world-studios-2026-10-18/`, not active routes.

## Object Studio: create → export → share

1. Enter `#studio` or open `?design=…&format=…#studio`. A complete valid shared design loads; absent state uses the default. Invalid, oversized, incomplete or unsupported-version state opens the default with a readable explanation. Missing/invalid format uses Desktop.
2. Choose one of six presets or customize mode, shape, material, colors, lighting, speed, particles, zoom and pose. Each preset/favorite replaces the complete design; changes affect real 3D. Pause/reduced motion retains editing.
3. Choose Desktop, Phone, Square or Ultrawide; preview follows the selected aspect ratio.
4. Download PNG: await a real ready renderer → snapshot design → render target dimensions → encode actual pixels → offer browser download. Interface/watermarks are excluded. Failure shows an error and preserves editing; preview state and temporary resources are restored/released.
5. Share: normalize the complete design → encode v1 JSON in the current origin/path URL with format and `#studio` → attempt clipboard copy after the action. Rejection exposes a usable link. The recipient restores settings, pose and aspect ratio, not an elapsed animation frame or rendering hardware.
6. Live wallpaper opens, scrolls to and focuses the animation panel. Choose duration/resolution/FPS, then Download live wallpaper. Quality choices do not change the saved design schema.

## Animation export lifecycle

1. Detect general animation support separately from frame-by-frame encoding. A paused/motion-off design explains why animation download is disabled.
2. With frame-by-frame APIs, offer 720p/1080p/1440p/4K, 24/30/60/120/144/240 fps and 6/10 seconds, initially 1080p/60 fps. Otherwise explain the limited 720p/24 real-time fallback. Output retains the selected format's aspect ratio.
3. Start → validate size/output limits and actual codec target → snapshot complete design/renderer → disable editing/export settings. Unsupported targets retain the selected settings and show a smaller-quality suggestion for a deliberate retry.
4. Render every timestamp and await encoding backpressure; progress reflects completed frames. Export can exceed playback duration. Keep the tab visible and expose Cancel. The fallback records in real time with device-dependent timing.
5. Success → finalize bounded WebM → restore preview/resources → download the real file. Cancel, hidden tab, unmount, context loss or encoder error → stop capture/encoding → discard partial output → restore usable controls/preview and explain failure where applicable. A cancellation during final flush settles before retry is enabled.
6. Import the downloaded WebM into a compatible wallpaper player if desired. The website does not modify OS settings, convert to MP4/Live Photo or install an interactive wallpaper.

## Favorites lifecycle

`current design → name → accepted browser write → restore or delete`

On entry load `null-orbit:designs:v1`. No collection means an empty state. Invalid records are skipped with an explanation; damaged/blocked storage does not prevent editing. Save stores a complete design, ID, saved timestamp and name of up to 40 characters, capped at 20 records. Only a successful localStorage write is presented as saved. Quota/security errors remain visible. Restore replaces the design; Delete updates that collection.

Favorites persist only on this browser/origin until removed or site data is cleared. There is no account, server save, upload, background job or cloud sync. World/cinematic/scenery collection keys are not cleared or migrated by retirement.

## Initiation and preferences

Initiate Sequence opens a native dialog with mapping, releasing gravity and shifting reality stages. It completes after 4.4 seconds, or 3.6 with reduced motion, then cycles Solid → Liquid → Signal → Solid. Cancel/Escape preserves the mode. Closing clears timers, restores scrolling/focus and permits a new launch. This is generated art, not a remote experiment.

Sound starts off. Explicit activation creates/resumes synthesized browser audio; mute/unmount stops and releases it. Studio entry mutes exhibition sound; returning stays muted until another explicit activation. Audio denial leaves the page usable.

Reduced motion follows the OS initially with a visible session override. It suppresses continuous animation/long transitions without losing editable design state. During exhibition initialization, static view or failure, the mode-aware SVG remains readable. Static View unmounts 3D, Explore in 3D remounts it, and Retry 3D supports recovery. Offscreen/hidden scenes stop continuous rendering. Fallback artwork is never exported as a successful GPU wallpaper.

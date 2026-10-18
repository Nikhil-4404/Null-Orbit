# Project status

Updated: 18 October 2026. Active project: D:/Gpt projs/null-orbit. Current scope is the exhibition and Object Studio. This is a locally built frontend; no public deployment or production-readiness claim.

## Object-only scope — current increment

The user requested removal of World Studio and Scenery Studio while keeping Object Studio. All original, cinematic and scenery editors are retired from the active application. Their source, tests, artwork, preparation script and prior specifications are recoverable in the local archive `work/removed-world-studios-2026-10-18/`, outside the application build. Historical evidence is in its `docs/status.md`. These archives and command logs are Git-ignored and are not available in fresh clones.

| Marker | Scope / acceptance | Evidence and limits |
|---|---|---|
| [x] Verified Complete | AC-42 active product scope | Removed world/scenery entry links, workspace switch, lazy imports, modules, styles, tests and public artwork. Source audit and final production output contain no retired feature modules or assets. Exhibition and Object Studio each open in the real browser. No dependency needed by the retained renderer or export path was removed. |
| [x] Verified Complete | AC-42 retired-link recovery | Pure location tests cover old #worlds and standalone world/scene/scenery queries, idempotence, exhibition anchors and mixed valid Object share/crop parameters. Real browser navigation from ?scenery=retired&format=phone#worlds became ?format=phone#studio, showing the Object preview with Phone format. Old scene payloads are discarded from the URL rather than decoded as object designs. |
| [x] Verified Complete | Retained object interaction | All six presets, Reality/Sculpture/Surface controls, palette, lighting, particles, zoom, motion, Save, Share and both download entry points remain. Selecting Chrome Eclipse updated the design name, sculpture, accent and lighting. Keyboard input changed Orbit speed .45 to .46. Only one artwork canvas was present. |
| [x] Verified Complete | Actual retained downloads | Real Chrome Eclipse PNG downloaded at 1920×1080 and was visually inspected. Actual VP9 WebM downloaded at 1280×720, 24 fps, six seconds: 1,996,476 bytes, 144 packets, six-second duration, strictly increasing timestamps and a constant 24 fps timeline. Editing controls re-enabled after export. Quality menus still expose 720p/1080p/1440p/4K and 24/30/60/120/144/240 fps. This increment did not repeat every high-quality export combination. |
| [x] Verified Complete | Existing collection boundary | Object model, collection key, validation and persistence implementation are unchanged. No storage clearing or migration was added, and QA did not save, delete or overwrite favorites. Retired collections remain dormant in browser storage. Current preview origin showed My designs 00; an actual pre-existing favorite was therefore not available for restoration testing this increment. |
| [x] Verified Complete | Narrow layout and navigation smoke | Object Studio and exhibition had no horizontal page overflow in the narrow viewport check; observed innerWidth 434 and document scrollWidth 417. Removed studio names/links were absent from rendered DOM and accessibility state. Desktop navigation was also inspected. The browser viewport override was reset before handoff. |
| [x] Verified Complete | Automated verification and build | 24 retained/routing tests pass, zero failures. Final TypeScript/Vite production build passes. Existing Three.js vendor chunk warning remains (~982 kB minified). Logs: work/object-only-tests.log and work/object-only-build.log. Final browser error log was empty. |

Evidence is under C:/Users/HP/Documents/Codex/2026-10-16/d-gpt-projs/outputs/object-only/: final studio screenshot, actual PNG and WebM, PNG metadata, video inspection and verification notes. The actual browser tab is left in Object Studio on the local preview at http://127.0.0.1:4173/. The preview process remains running.

## Limits and remaining checks

- This retirement increment verified a real 720p/24 six-second file and a 1080p PNG. Earlier Object-specific 1080p/240, ten-second lighting/particle comparison, playback and cancellation evidence remains in the archived status; it was not rerun here. Encoded frame rate does not guarantee monitor refresh or real-time preview speed.
- No new end-to-end save/share persistence test was performed because that implementation was not changed. Collection behavior remains covered by retained explicit storage-double tests and earlier browser evidence. No cross-device or cloud synchronization exists.
- Viewport testing used Windows embedded Chromium, not a physical phone. Overridden-size screenshots failed in the browser tool; the final screenshot succeeded after resetting the override. No claim of exact 390×844 screenshot coverage, a screen-reader audit, Safari/Firefox support, measured sustained performance, or universal 4K/240 encoding support.
- Existing GPU, codec and device limits apply. No native wallpaper installation, MP4/Live Photo conversion, account/backend, AI generator, arbitrary uploads, public hosting or production monitoring is added.

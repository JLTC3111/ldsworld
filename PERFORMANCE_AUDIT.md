# Performance audit — 2 November 2026

The audit focused on the costs that matter on smaller CPUs, integrated GPUs,
high-DPI phones, and devices under sustained thermal load. Changes are local;
they have not been deployed.

## Findings and changes

| Priority | Bottleneck | Change |
| --- | --- | --- |
| High | `world.js` rendered and updated the island at display refresh while dialogs paused gameplay. | One queued render loop, capped at 60fps or 30fps on constrained devices. Paused worlds render only when invalidated; hidden tabs cancel their pending frame. Resume resets elapsed time. Weather, lights, language, camera changes and resize still invalidate the paused view. |
| High | Pixel workload scaled with viewport area and DPR, without an area budget; desktop sun shadows used 2048² texels. | `render-budget.js` caps world pixels at 2.4 million, 1.5 million on coarse pointers, or 900,000 on constrained hardware. Shadows use 1024² or 512² texels; constrained devices disable MSAA. Sustained slow frames reduce resolution in two bounded steps. |
| High | All three supplied cars downloaded and parsed before world creation. | Startup loads only the selected model. Other models load on selection, with per-model request sharing, retry after failure, a procedural fallback and a selection race guard. |
| High | Sleeping props rebuilt collision grids and allocated body copies on every physics substep. | Skip body-pair work when everything sleeps, index original bodies, share car bounds/trigonometry per update, and reject distant contacts cheaply. Car contacts still wake sleeping props. |
| High | Stationary instanced props rewrote GPU matrices and recalculated batch bounds every frame. | Cache synchronized transforms and batch inverses. Upload matrices and recalculate bounds only on changes, including destruction, restoration and parent transforms. |
| Medium | Blast effects uploaded empty/expired buffers and rebuilt settled debris continuously. | Hide unused effect batches and stop uploading expired effects or settled fragment transforms/colors. Retain respawns and reuse the effect pool. |
| Medium | Panel showcases and contour effects consumed GPU time alongside video playback. | Showcase rendering is capped at 30fps/600,000 pixels; low-power and reduced-motion showcases sleep when settled. Offscreen setup is deferred; unused poster textures are skipped and contexts released on disposal. Topography is capped at 30fps/600,000 pixels, or 300,000 with static contours and no bloom/DOF on constrained hardware. Interaction remains available. |
| Medium | Decorative effects and backdrop blur add work without aiding navigation. | Low-power devices use a normal project CTA and omit overlay backdrop blur. Header text cancels frames while hidden/offscreen. |
| Medium | Background music created a media resource during startup before browser activation. | Create the resource when activation permits playback or an explicit control requests it. Disabled music allocates no media resource. |

Hardware hints are advisory: four or fewer reported logical cores, 4 GB or less
reported device memory, or Data Saver select the constrained budget. Missing
hints use a balanced budget; coarse pointers alone do not imply a slow CPU.
The world also adapts to sustained slow frames when hints are absent. Quality
only decreases during a world session to avoid repeated resolution changes.

## Evidence and validation

- Default car startup: **3,862,444 → 1,239,784 bytes**, a saving of
  **2,622,660 bytes (67.9%)** in car downloads and parsing. Assets remain available
  on demand; this is not a reduction in the complete site's stored size.
- The **4,164,589-byte** soundtrack is deferred until activation on browsers
  exposing the User Activation API.
- Synthetic physics comparison: 600 sleeping props, distant driver, 300 updates
  at 1/60 second: **202.1 ms → 5.45 ms** in one local run. This isolates idle
  physics CPU work; it is not an overall frame-rate benchmark.
- Regression checks exercise high-refresh frame caps, pause/visibility/resume,
  slow-frame adaptation, pixel budgets, sleeping contacts, dirty instance
  uploads, destroyed/restored props, blast expiry/reuse, real GLB loading and
  lazy audio. UI tests execute real model/contour logic with recording renderers.
- Production build passes (`npm run build`); all **276 tests pass** (`npm test`).
- The complete-world integration fixture contains **1,908 meshes**, including
  **148 instanced meshes**, and **1,520 shadow casters**. These are scene
  inventory counts; visibility, instancing and render passes determine actual
  draw calls. The fixture uses a procedural car fallback.

Native browser/GPU profiling and visual QA could not run here: the sandbox
rejected the local preview server's listening socket (`EPERM`), and no island
preview was already running. Automated renderer tests do not establish visual
quality, real GPU frame rate, battery savings, or responsiveness on physical
low-spec hardware. Lower resolution/shadow detail and less decorative motion
are intentional tradeoffs that still need that visual review.

The resolution and demand-rendering approach follows the official Three.js
[responsive rendering](https://threejs.org/manual/pages/responsive.html),
[rendering on demand](https://threejs.org/manual/pages/rendering-on-demand.html),
and [shadow](https://threejs.org/manual/pages/shadows.html) guidance.

## Remaining work, in priority order

1. Profile driving, night/rain/snow, explosions, and video panels on an actual
   low-end Android device and an integrated-GPU laptop. Capture p95 frame times,
   long tasks, renderer draw calls/triangles and GPU memory after warmup. Compare
   identical routes and weather against the previous revision.
2. Reduce scene draw submissions by batching repeated static scenery with
   compatible materials. Preserve breakable ownership, independent visibility,
   picking and shadow behavior when combining meshes; these constraints make
   blind geometry merging unsafe.
3. The initial app graph remains approximately **2.77 MB raw / 635 KB gzip**
   (source inventory estimate, not an HTTP transfer trace). `app.js` reaches
   Three.js through several static imports. Separate pure map/vehicle data from
   rendering imports before attempting a truly lightweight portfolio-first
   entry point.
4. Pointer hover still recursively raycasts detailed interactive meshes. Profile
   it during real pointer movement, then use lightweight picking proxies or a
   spatial filter if it is material.
5. `scripts/static-handler.mjs` reads a complete video for each local byte-range
   response. Streaming ranges would improve preview memory usage; production
   uses Vercel static hosting, so this is below the browser runtime work above.

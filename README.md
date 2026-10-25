# Long D. — Project Island

A personal portfolio you can drive through. Six original projects become miniature landmarks on a quiet, low-poly island, inspired by the exploratory idea of [Bruno Simon’s portfolio](https://bruno-simon.com/).

Snow is the default weather. Three snowmen appear only while it is snowing, and two vendors stand behind detailed market stalls. A small propeller plane periodically crosses the island. Clouds have been removed completely; rain keeps its slanted streaks, splashes, and overcast lighting. The main roads are about a third wider. Every bridge now has an 8.4 m deck, raised lantern gates, and clear approaches, with timber grain, metal fasteners, ropes, and glowing cage lanterns. About 75% of the original trees were removed, followed by another three quarters of the remaining pines. Broadleaf trees remain. The remaining trees keep layered leaves, branches, pine sprays, and frost, with larger clearances from roads and bridge approaches. The hero title and supporting text follow the map’s sunrise, sunset, and night lighting, while the panel theme remains independent.

The island is now five times wider and deeper, with the six project landmarks spread among separate districts on the outer roads. Four cottages are scattered between them, and the buildings and trees use a more consistent scale around the unchanged car. An outer road loop, four connecting roads, two additional river crossings, and sparse woodland leave large open areas for future additions. The camera keeps a close driving view; snow, rain, and local shadows follow the car across the expanded terrain.

A continuous striped curb and guardrail mark the drivable island perimeter, with reflectors and physical contacts matching the shoreline limit. The same perimeter is drawn on the map. Road arrows follow the shortest road routes toward the central town; four roadside signs switch between “TOWN” and “THỊ TRẤN” with the selected language.

The Hội An Ceremony remains one of the smaller landmarks. Model size, plot foundations, rotation, tree clearances, parking, map footprints, and collision bounds all follow the same layout data. Benches and planters retain their human scale when their buildings are enlarged.

The expanded world includes a winding shallow stream, five drivable arched bridges, paired portals, detailed cottages and trees, glowing lanterns, rocky banks, and pushable crates, barrels, stones, cones, and metal trash cans. Six trash-can fires light automatically at night and extinguish at first light, independently of the interface theme. Flames, warm flickering light, and metal cans move together when pushed. Only nearby fire lights are active. The water has a visible bed, animated surface normals, sky and sunlight reflections, bank foam, and car-generated wake ripples. The car uses bright coral paintwork, an ivory roof, dark trim, and a subtle night visibility lift, alloy wheels, shaped tires, panel seams, a visible interior, LED headlights, brake lamps, and an exposed hydraulic undercarriage. Four telescoping rams, coil springs, axles, and articulated links extend during takeoff and compress on landing. C changes the ride height.

The car cruises at 30 m/s and reaches 48 m/s with ground boost. Air controls use quaternion orientation and angular velocity, with independent momentum, directional dodge impulses, nose-directed rocket thrust, and landing recovery. A second Space press permits one flip or double jump per flight. The eastern clearing contains ten large bowling pins that topple, slide, and remain fallen. The western clearing contains five impact-triggered TNT crates with chain reactions, debris, a brief fireball, sound, and blast impulses for the car and props. Both clearings are marked on the map and have drive-to buttons. R restores everything.

The portfolio panels use a wide, two-column studio layout, drawing inspiration from [Julian Ozen’s narrative and 3D project displays](https://www.julianozen.com/). Each project pairs an interactive physical display with its real demo, a concise case study, three supported capabilities, two annotated demo stills, and related work. Hovering or focusing a project card updates the large display; selecting a gallery still jumps to that moment in the muted video. About adds capability groups and a linked project timeline, while Contact offers conversation prompts and example projects. Narrow screens use the full-width reader. Every new section is available in English and Vietnamese.

Click the computer’s screen to switch between Project and Stack, or use the two buttons below it. The physical monitor displays project notes or the complete technology stack. The Preview tab has been removed. Select a tool below the monitor to read its role. Turning the object does not activate the screen. Keyboard users can use the same display controls and tool buttons; their readable information remains available if WebGL cannot start.

“Follow your curiosity” is the bilingual header tagline. The name and tagline use tighter vertical spacing. The location/time badge is fixed to Hanoi and current Vietnam time (UTC+7), without IP lookup. It uses an opaque theme-aware surface, with readable text in both light and dark mode. The world clock is a separate simulated day/night cycle. The header uses its own neutral charcoal/ivory palette, so the monogram and tagline stay readable over either daylight or night scenery. The name uses [React Bits Tech Text](https://reactbits.dev/text-animations/tech-text): letters reveal dashed outlines and a selection frame on pointer hover or keyboard focus. Its published canvas engine is adapted to the existing static site; a static label remains for reduced motion or unavailable canvas. Upstream attribution and the MIT + Commons Clause license are retained in `src/vendor/REACT-BITS-LICENSE.txt`.

## Run

Requires Node.js 20 or newer. No dependency installation or network access is required.

```sh
npm run dev
```

Open the URL printed in the terminal (`http://127.0.0.1:4173`, or the next available port). For a production build:

```sh
npm test
npm run build
npm run preview
```

The `dist/` folder is a complete static site. Deploy it to any static host with `index.html` as the entry point. The preview server supports video range requests.

## Explore

- WASD / arrow keys: drive on land; pitch and yaw in the air. Q / E: air roll. Shift: rocket boost on land or in the air. B: brake. C: raise/lower the hydraulics.
- Click or tap the ground to drive there, with routes around buildings; click a project building to open its details. Floating project buttons and checkmark labels have been removed; buildings keep their clickable surfaces and hover cursor.
- Drag with a mouse or trackpad to orbit the camera. Right-drag or Shift-drag to pan. Scroll or pinch to zoom; Shift-scroll to pan.
- On a touchscreen, use two fingers to pan and pinch to zoom.
- Zoom stays within a shallow range, and the island remains viewport-sized. Camera tracking keeps the car clear of the header and controls.
- Space: hydraulic jump, with visible compression, piston extension, and landing rebound. Press again in the air for a directional flip (with WASD), or a neutral double jump. Only one airborne dodge is available per flight. The car recovers from awkward landings. H: honk (when sound is enabled). R: reset the car, fallen pins, TNT crates, and other props.
- While the car moves or jumps, all page overlays disappear. Stop, click the car, or press Escape to restore the controls. Projects and map shortcuts remain available; opening a panel pauses driving. Touch users can tap the car to stop.
- M: map. P: projects. Escape: close a panel.
- Touch controls appear after entering the world on small screens.
- “Take a tour” drives between project stops; each detail panel leads to the next stop.
- Select EN or VI in the header or panel toolbar. Vietnamese covers the interface, project content, accessibility labels, page metadata, and world signs. Browser language is detected; `?lang=vi` or `?lang=en` also works for shared links.
- Open **World** to choose sunrise, daylight, sunset, night, or the automatic day/night cycle; select clear weather, rain, snow, or changing weather; and control the headlights. A full automatic day lasts about four and a half minutes.
- Rain and snow affect tire grip. Loose props, benches, planters, snowmen, and shoreline rocks respond to gravity, car impacts, and each other; click or tap one to give it a nudge. Snowmen participate only during snow. Trees, buildings, stalls, fences, rocks, and bridge rails use height-aware collision boundaries derived from their actual geometry, including instanced details. Fixed contacts use a spatial grid and the car’s oriented footprint, while route planning keeps a small obstacle graph. Sleeping props avoid unnecessary simulation work. R resets the car and every prop to their original positions. Streams can be crossed anywhere by driving: shallow water slows the car slightly and the suspension follows the ford bed. Bridges remain available for a dry crossing. Route planning and physical props also permit stream crossings.
- Bowling and TNT clearings are available from the map. Hit the pins to knock them down; hit TNT at speed to detonate it. Gentle contact does not trigger TNT. Chain reactions push nearby objects and can launch the car. Explosions pause with the world, respect reduced motion, and use the global speaker mute.
- Drive into a glowing portal to travel to the other side of the island. Both gates also appear in the map.
- Light and dark interface themes use shared contrast-checked colors and remain independent of the world's daylight. The selected theme is remembered locally, with the system preference as the initial default.
- Project videos autoplay muted, loop inline, and pause when their panel closes or the page is hidden. Native playback controls remain available for the main demo. “Keep exploring” and Contact cards use silent video previews in the selected language; they load/play only when scrolled into view, pause offscreen, and release the old recording when the panel changes or closes.
- Switching EN/VI explicitly releases the old video resource, binds and loads the selected recording, and updates posters, monitor previews, and gallery timestamps. A visual audit found that only Ceremony and ICUE have full EN/VI pairs. Both HR, Contracts, and File Compressor sources show Vietnamese UI; both Crypto sources show English. The player labels the actual recorded language and explains a missing counterpart.
- Quiet background music loops using the local `mixkit-a-very-happy-christmas-897.mp3` soundtrack. Pause/play is immediately to the right of the speaker icon. The speaker mutes music, engine audio, and nature ambience; the music button separately remembers whether music is enabled. Autoplay is attempted on load and retries on the first trusted interaction when the browser blocks audible autoplay. Hidden tabs pause music, and explicit pause stays paused.
- Wind and flowing water use local natural-sound recordings beneath the music. Wind strengthens with rain/snow, and the stream becomes louder as the car approaches the river. Rooster calls occur only from 05:30–09:30 on the island clock, at least 32 real seconds apart. Birdsong loops during sunset, 17:00–19:00. Time presets update the soundscape immediately; rapid preset changes cannot spam animal calls. Nature ambience keeps playing quietly through panels, pauses in hidden tabs, and follows the global speaker mute. [Sound sources and licenses](src/assets/audio/AMBIENCE-SOURCES.md) document the existing wind/water assets and CC0 bird/rooster recordings.
- Synthesized engine audio follows speed, RPM, acceleration, and gear changes; road noise rises while driving. Audio unlocks on your first interaction and is silent at rest. The sound button remembers your mute choice. H sounds the horn.
- Reduced-motion support, lighter weather effects on mobile, and the project browser are included.

Project demos always open muted. Engine audio is enabled for driving unless you mute it, and never starts before an interaction. Discovered stops are remembered only for the browser session; language, theme, and mute choice are remembered locally. There are no analytics, credentials, accounts, tracking, or backend services.

## Content and assets

Project titles, facts, links, and demo videos were taken from the original portfolio source at `full-stack-course/1.web-portfolio-en/index.html`. The external `full-stack-course/` source directory is not part of this repository.

Vietnamese project names and links were checked against `full-stack-course/1.web-portfolio-vn/index.html` in that external source directory. This retains the six selected portfolio projects without importing private application data. Videos are copied from the matching English or Vietnamese portfolio’s `public/` directory. Posters and the 20 unique annotated gallery stills are frames extracted from those videos. Original recording hashes verify source provenance; visual frame inspection verifies actual UI language. The added project stories describe demonstrated features without introducing client claims or performance metrics.

The world and showcase objects use original procedural geometry in the scene modules. Three.js r175 is vendored locally with its MIT license in `src/vendor/THREE-LICENSE.txt` so the portfolio has no CDN dependencies. The UI uses system fonts.

## Edit

- `src/data.js`: project details, links, translations, and landmark locations.
- `src/world.js`: scene, buildings, vegetation, car, lighting, and camera.
- `src/driving.js`: vehicle behavior and guided-tour road routing.
- `src/controls.js` / `src/driving-hud.js`: physical WASD/Space keys, mouse, trackpad and touch gestures, and automatic overlay visibility while driving.
- `src/media.js` / `src/panel-previews.js`: muted autoplay, safe main-demo playback, and visible card previews.
- `src/preferences.js`: language selection from a URL, saved choice, or browser locale.
- `src/island-boundary.js`: continuous physical perimeter, striped curbs, guardrails, and night reflectors.
- `src/wayfinding.js`: inward road arrows, route-aware outer-road directions, and bilingual town signs.
- `src/aerial-dynamics.js`: driving tuning, full car orientation, angular controls, dodges, and landing recovery.
- `src/playground.js`: large pins, labeled TNT crates, blast effects, chain reactions, and clearing reservations.
- `src/physics.js` / `src/world-physics.js`: rigid bodies, spatial collision queries, geometry-derived contacts, complete movable props, stacking, gravity, click impulses, and portal travel.
- `src/scenery.js`: scattered cottages, bridge decks, vegetation, lanterns, and gates.
- `src/stream-water.js`: shallow stream bed, reflective animated water, foam, and car wakes.
- `src/night-fires.js`: movable fire cans, automatic day/night flames, and nearby flickering lights.
- `src/atmosphere.js` / `src/environment-state.js`: daylight cycle, skies, rain, snow, and weather state.
- `src/flyover.js`: detailed periodic airplane flyovers.
- `src/island-life.js` / `src/tree-details.js`: snowmen, market vendors, stalls, and layered forest foliage.
- `src/scene-presentation.js`: world-facing text contrast across daylight and weather.
- `src/tech-text.js`: adapted React Bits Tech Text engine for the header wordmark.
- `src/environment-audio.js`: wind, proximity-based stream audio, morning rooster timing, sunset birds, and master mute.
- `src/background-music.js`: quiet looping music, autoplay retry, pause preference, visibility, and mute.
- `src/vehicle.js` / `src/engine-audio.js`: detailed car, lights, suspension, and procedural audio.
- `src/world-layout.js` / `src/camera-framing.js`: shared physical layout and viewport-filling framing.
- `src/app.js`: navigation, project panels, map, language, and audio.
- `src/case-studies.js`: bilingual project stories and annotated demo frames.
- `src/project-media.js`: audited language-specific video and poster selection.
- `src/showcase.js`: project-specific 3D displays, informative monitor screens, workbench, envelope, and car preview.
- `src/stack-tools.js`: brief English/Vietnamese tool explanations.
- `src/portfolio-metadata.js`: localized project dates and demo timestamps.
- `src/styles.css`: responsive interface and visual theme.
- `src/portfolio-panels.css`: wide studio panels, galleries, project cards, and small-screen layouts.
- `src/assets/`: project demo videos, posters, and favicon.

There is a project browser fallback if WebGL is unavailable. The 3D world requires a modern WebGL2 browser. Shared project links use `#project/hr` (replace `hr` with any project ID).

## Hosting

`.openai/hosting.json` retains the private Sites project identity and declares `dist/` as static output. The existing longd.tech domain and source project are unchanged.

## Verification

The production build and automated tests pass. The tests cover original media and translations, project routes, keyboard/pointer gestures, muted video playback, UI palette contrast, bridge and river navigation, gravity and stacking, mass-based impacts, oriented car collisions, portal cooldowns, weather and daylight, particle budgets, vehicle details and headlights, engine sound behavior, camera framing and car visibility, cleanup, and static-file/video-range responses. They also validate environmental-audio timing, proximity fades, successful-play cooldowns, rapid preset changes, mute/visibility/disposal, real local sound assets, music pause/unlock/cleanup, flight paths and reduced motion, snow-only snowmen, stall clearance, instanced foliage ownership, widened bridge driving, daylight text contrast, cache revisions, native video resource replacement, original EN/VI recording hashes, localized gallery dimensions and timestamps, bounded showcase geometry, information-screen text wrapping and contrast, screen visibility ahead of the bezel, raycast hits, click-versus-drag behavior, texture ownership, and fallback behavior. Additional DOM and complete-scene checks exercise project previews, all six stories in both languages, display controls, tool explanations and keyboard focus, language replacement of an open video, gallery seeking and close safety, related links, About and Contact content, bilingual World controls, weather/headlights, map gates, independent interface theme, and viewport framing. Both portals and every guided project stop are also simulated with complete scenery and physical props in clear, rain, and snow.

Run `npm test` for the automated checks and `npm run build` to create the self-contained static site in `dist/`. Production builds stamp the HTML and entire module graph with a content revision, and preview code revalidates to avoid stale language mappings. Automated checks cover code, DOM behavior, and scene structure; native browser pixels and audible playback require manual review.

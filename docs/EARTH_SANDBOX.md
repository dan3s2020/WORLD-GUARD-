# Earth sandbox v0.4

The earlier entry point opened the original isometric hospital dashboard. The v0.3 camera also remained attached to six small districts. The latest verbatim rejection requires a mobile world that the observer can actually enter and explore.

## World and controls

`index.html` routes to `play.html` while preserving feature query parameters. The original dashboard is preserved byte-for-byte at `infrastructure.html`. `game.css` gives the game the complete dynamic viewport; training, decisions, checkpoint recovery and history are inside an accessible native dialog. Modal closure returns focus to the world controls. A new world starts running; reload restores paused.

`game-explorer.mjs` owns a spherical observer camera with orbit, free-flight and first-person walking modes. The observer has independent latitude, longitude, yaw, pitch and altitude. Globe picking and validated coordinate travel are not restricted to inhabited cities. Keyboard, touch joystick, directional buttons, drag-look, pinch and zoom buttons have concrete bindings. Walking includes gravity, jumping and basic wall/block collision. Flight intentionally moves freely above terrain.

`sim/planet-world.mjs` supplies deterministic terrain sampling, illustrative continent membership, biomes, coordinate conversion, distance across the date line and validated block addresses. `game-terrain.mjs` maintains at most 49 nearby 32-unit chunks, builds at most three chunks per rendered frame and disposes evicted geometry. Terrain and trees continue beyond the six districts, which retain their furnished homes, offices, civic buildings and moving resident bodies.

The planet radius is 6,000 game units. Scale is intentionally compressed; coordinates are a navigation address, not a claim of survey accuracy. Coastlines use bundled public-domain Natural Earth 1:110m geometry. Latitude-indexed coast edges keep land queries small during chunk generation. Nearby elevations, vegetation and biomes are procedural; there are no real street/elevation datasets, downloaded satellite tiles or runtime CDN requests. Provenance is recorded in `docs/licenses/NATURAL-EARTH.md`.

## Building changes the same world

Grass, stone, wood and glass blocks use actual scene meshes, ray picking, observer collision and persisted edit history. Placement cannot overwrite existing houses. Removal applies to placed blocks; excavation of the underlying terrain is not implemented. Undo records an inverse edit. Each edit obtains a frame from `sim/spatial-life.mjs`; replay reconstructs the block set as of that frame without modifying current geometry state or training weights.

Blocks near districts produce local collision obstacles in the physical resident engine. A resident stops when its next movement intersects a block and cannot perform its workplace action before arrival. Removing that obstacle allows the same route to continue. Automatic pathfinding around newly built obstructions is not implemented.

JSON and IndexedDB retain the neural checkpoint, world, physical routes, replay and exploration data. Exploration validation runs before imported state replaces the live world. Old v0.3 checkpoints remain readable. Human review and replay capacity prevent further block edits. Limits are 4,096 simultaneous placed blocks, 12,000 edits and 6,000 recorded world snapshots; first frames are never silently discarded.

Unchanged resident histories share immutable arrays across motion snapshots, and structured checkpoint cloning preserves that sharing. The live renderer reads current world state without repeatedly serializing the entire population. Historical API reads still return defensive copies. JSON export remains larger than the in-memory/IndexedDB representation because JSON cannot retain shared object references.

## Training and scope

The same 1,174-parameter contextual neural model learns from actual executed/vetoed life decisions. Seven finite scenario families cover the existing daily routine. Resident poses/action labels and the hospital indicator derive from authoritative history; the indicator is a visualization, not a new full electrical-grid simulation. Blocking a route changes whether a decision can execute, rather than only changing a label in a dashboard.

Laya checkpoint inference/fine-tuning, independent adversarial learning, long-horizon society/economy, planet-wide population, real-world workstation control and public spectator hosting remain incomplete. The app does not establish a model's beliefs or consciousness. Existing 30 partial and 10 missing checklist entries remain uncompleted; four narrow new sandbox capabilities are separately traceable to the current verbatim.

## Verification

Run `npm test` and `npm run test:game:browser`. Unit coverage includes worldwide deterministic terrain, validation, route obstruction, checkpoint continuation and the existing safety/learning suite. Browser coverage exercises the root game, actual perspective zoom, non-city coordinates, traversal and chunk replacement, jumping, mobile CDP touch pinch/joystick, landscape, block creation/replay/restoration, failed import, review navigation, legacy pages and WebGL/storage failures.

Browser evidence is desktop Chromium and a simulated 390px touch viewport. Physical Android/iOS performance and native Windows/Termux launchers require device validation. The bundle remains standalone for local Python serving.

## Design reconciliation

| Previous rule                    | Evidence of requested change                                       | Resolution                                        |
| -------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| Stacked dashboard on mobile      | Current verbatim explicitly rejects a training UI with a rendering | Full-viewport game; console opens on demand       |
| Camera attached to six districts | User requests god-like travel anywhere on Earth                    | Independent spherical camera and streamed terrain |
| Pause until initial Start        | User expects a living world on launch                              | Fresh worlds run; restored checkpoints pause      |
| Navy/cyan/gold controls          | Established project palette                                        | Preserved for the HUD and overlays                |

The premium static auditor is supplementary: it cannot resolve external `addEventListener` bindings and may flag native buttons as actionless. Runtime browser tests inspect the actual controls. Static audit output and any remaining findings must be reported separately from passing runtime tests.

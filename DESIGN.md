# WorldGuard Lab — design context

**Purpose**: a test bench for alignment researchers to understand the observable relationship between agent intent, protected simulated infrastructure, world damage, and explicit human approvals.

**North Star:** civil-defense situation room with a miniature isometric city, not a videogame reward casino.

**Experience:** the world is the dominant visual and source of truth; numeric impact metrics and a trustworthy event log frame the simulation. The human authorization station is visibly distinct from the agent's decisions.

**Tokens** (canonical values implemented in `styles.css` `:root`):
- `--bg: #080f1d` deep navy field
- `--panel: #111d31` station panel
- `--line: #2b3c57` separators
- `--text: #ebf5ff` primary reading color
- `--muted: #94a9c1` secondary metadata
- `--cyan: #4ae1f3` defender/mission
- `--gold: #ffc47c` human approval/critical infrastructure
- `--red: #fa7783` adversarial/destructive risks
- `--good: #77d9b1` proven simulation success

**Typography:** restrained Georgia display hero and metrics; system UI body; monospace for coordinates, audit status, event timestamps and engine diagnostics.

**Layout:** map-first 2-column dashboard on desktop; stacked and scrollable controls on mobile. Labels remain visible when icons are absent. All actions use native buttons and keyboard focus rings.

**Signature:** isometric micro-city with visible civil institutions, civilians, and explicit consequences, under a human oversight console.

**Known boundary:** appearance communicates synthetic outcomes only; real-world alignment cannot be inferred from the displayed score.

## v0.2 life simulation visual extension
- New page: `life.html`, with independent `life.css`; legacy isometric infrastructure console's appearance and functionality stay intact.
- Reuses deep navy, cyan, warm authorization gold, monospace instrumentation and restrained serif display typography.
- Additional signature: a continuously reprojectable mathematical sphere with geographical markers; drill-down into a 2.5D city and building/apartment observer. Performance and clarity outrank map realism.
- The user can reach all cities and residents via accessible native controls even if pointer-based map picking fails.
- Event history and snapshots share a consistent immutable frame index.

## Living Planet 3D — v0.3 corrective implementation

The user explicitly requires a real 3D game, superseding the earlier isometric-only North Star for the new `play.html` surface. Legacy pages retain their visual contracts. The new North Star is a miniature inhabited planet: real perspective geometry connects an orbital overview to streets, furnished interiors and identifiable moving residents.

The game scene is the dominant canvas, with quiet instrumentation using the established navy/cyan/gold palette. `game.css :root` owns this surface's canonical tokens, preserving the names and values of the original `styles.css` palette. Georgia remains the restrained display typeface; system UI owns controls; monospace owns world coordinates, training evidence and audit records. No external fonts or CDN assets are required at runtime.

`game-scene.mjs` owns meshes, camera/LOD, native pointer and touch controls. `game-ui.mjs` owns actions and accessible native controls. Camera zoom has finite observable bounds: the whole sphere at the far limit and 1.2 world units from the agent target at the near limit. Geometry is synthetic and Earth-inspired, not a geographic Earth renderer. Moving bodies and action poses represent authoritative simulation state; they do not prove general intelligence or human identity.

The right column uses the established UI language. Below 900px it moves below the scene and preserves document scrolling. Only the scene uses `touch-action:none`; other content scrolls normally. Motion is paused until the operator starts it. Reduced-motion mode removes UI transitions; deliberate simulation playback remains available under operator control.

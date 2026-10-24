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

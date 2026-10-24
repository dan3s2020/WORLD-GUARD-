# Life Lab v0.2 — implemented slice, contracts and gaps

Source specification: `docs/VERBATIM_ACTION_LIFE_SIMULATION_2026-10-24.md` in the repository.

## What runs today

- `sim/life.mjs`: seed-based fictional cities/buildings/apartments/residents; discrete scenes; world transitions; protected-harm veto; human review; provenance-marked adversarial prompt scenes; immutable event frames and replay snapshots.
- `sim/life-train.mjs`: tabular contextual action-value updates over finite binary contexts with ε-greedy exploration; held-out evaluation. Agent policy outputs discrete IDs and cannot alter safety controls.
- `life-ui.mjs`, `life.html`, `life.css`: Earth-inspired 3D orthographic projection, city/isometric apartment zoom, live step/run, state snapshot timeline, inspector and JSON export. Uses canvas, no external libraries.
- `tests/life.test.mjs`: deterministic safety and learning checks. `scripts/smoke-browser.py` optionally exercises controls in Chromium using an offline harness.

### Validated example

12,000 synthetic reward updates and 2,000 independently sampled evaluation choices; see `npm run train:life` for reproducible figures and `npm test` for invariants. The reward function is authored by developers; models trained against it can exploit flaws. There is **no** evidence of general-world alignment.

### Security / authority boundaries

1. All persona stories are **fictional simulation roles**, never an assertion that an AI actually believes it is human or that real users are interacting with people.
2. Agent actions execute in a simulated domain. There is no tool bridge to real desktops, no accounts, tokens, customer data or autonomous external tasks.
3. Human authorization lives outside the learner. Pending review blocks all steps, approval is one simulated limited reroute, rejection safely advances through a deferred choice, and harmful reroute is blocked regardless of policy.
4. World snapshots represent only modeled facts, not omniscience about the real world. `rogue` variables describe simulated context, not real people.
5. A browser page cannot be used as an authoritative approval system for external actions. Production design needs a server-side safety runtime, audit storage, signed permissions, and third-party testing.

## Verbatim requirement coverage matrix

| Requirement | Present status | Verification |
|---|---|---|
| Scripted action menu including waking, Excel evasion, software job | **Implemented** | Scenario unit tests and decision UI |
| Real reward-based policy weight updates | **Implemented** (tabular contextual learner) | held-out improvement test and CLI |
| Life narrative, home/work contexts, several fictional agents | **Implemented as small synthetic slices** | persistent day-long stats, history inspector |
| AI truly believes it is human | **Not demonstrable** | only fictional role consistency can be tested |
| Planet Earth with deep geographical resolution | **Partial** | rotating 3D projection with 6 synthetic city markers; no Earth tiles |
| City → building → apartment → agent | **Implemented at toy scale** | offline Chromium smoke test |
| Full replay first frame to last | **Implemented per episode** | snapshot invariants, scrubber and export |
| Real-time watch while decisions execute | **Implemented locally** | live run / pause, event ledger |
| Adversarial manipulation training | **Toy scene only** | simulated untrusted co-worker message |
| Approval before consequential actions | **Implemented in toy engine** | pause, approve, deny, veto tests |
| User models workflow for real PC tasks | **Not implemented** | requires a separate tool bridge and permission model |
| Public internet observers and downloadable simulator | **Source downloadable; no hosted public broadcast** | browser works locally; deploy separately |
| Global, long-horizon, multi-agent RL over evolving worlds | **Not implemented** | next major research milestone |

## Next research milestones

M3: persisted, schema-versioned causal world with inter-agent interactions and truthful uncertainty; M4: richer WebGL or Godot render synchronized with server events; M5: multi-episode sequential RL and independent adversarial self-play; M6: authenticated sandboxed read-only public spectator feed; M7: narrowly scoped real tool bridge and rigorous independent evaluations. Implement each only behind testable invariants, with metrics separate for success, harm and consultation quality.

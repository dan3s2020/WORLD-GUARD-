# WorldGuard Lab — interaction contract

- `sim/core.mjs` alone owns authoritative world transitions and approval permissions.
- Agent policies may propose actions but cannot mutate the world or grant their own authorizations.
- Human review requests pause all simulation actions until an explicit approval or denial.
- Approval applies to one described action, with risk and alternative disclosed. A human approval cannot override the engine's hard limits.
- Reset creates a new deterministic seed. Guardrail and adversary toggles are sandbox-only; reset preserves toggle settings.
- Train is local tabular Q-learning. Policy evaluation uses held-out seeds and reports success as well as harm.
- Logs present adversarial messages as untrusted events, not authoritative instructions.
- Run pauses automatically on completed mission or pending authorization; controls are disabled appropriately.
- No network access, live world tools, human data, credentials, real devices, or policy-model API are included.

## v0.2 life simulation interaction contract
- The life engine is only in `sim/life.mjs`. Browser UI cannot mutate world snapshots or write events outside that module.
- Every valid attempt that changes simulation state, including rejected dangerous actions, receives a replayable event frame.
- The human approval prompt stops all world advancement and accepts one scoped authorization or a denial; a policy cannot self-grant permission.
- The history scrubber only reads prior snapshots; it never rewinds or forks the live authoritative world. Viewport navigation never changes the policy or its training data.
- Training uses independent local decision updates and held-out seed evaluation against a random baseline. A high score is not proof of actual alignment.
- Globe rotation/zoom and clicking buildings/apartments have parallel city/agent-selection controls for accessibility.
- The demo must not request external credentials, modify real files, connect to a user computer or falsely represent an AI as a human.

## v0.2.x acceptance checklist contract
- The version-controlled `docs/REQUIREMENTS_CHECKLIST.json` is the only source of checked statuses; no user click may mark an unimplemented feature as done.
- Generate `checklist.data.js` using `npm run build:checklist`, and validate it using `npm test`, including Windows line ending compatibility.
- Settings dialog is keyboard accessible, escapes/closes and restores focus. Search and status filter do not lose query state while typing.
- A verified (synthetic) checklist item must have a directly actionable destination implemented by `window.WorldGuardFeatureFocus`. For partial items, the UI must clearly warn it is incomplete; missing items have no navigation.
- The status `verified` does not imply the original 3D/neural model requirement has been met: verified always means a narrow prototype feature is present and auditable.
- The developer does not alter the Life Lab simulation or training state just by opening and filtering Settings. Camera navigation may change when user asks to inspect an item.

## v0.3 physical world and neural policy

Authoritative sources: `docs/VERBATIM_ACTION_LIFE_SIMULATION_2026-10-24.md`, `docs/verbatim/FEEDBACK_LIFE_LAB_V0.2_2026-10-25.md`, and `docs/verbatim/ZOOM_REQUIREMENT_2026-10-25.md`. Existing safety/approval rules in `sim/life.mjs` retain authority. `sim/spatial-life.mjs` adds deterministic locomotion, multi-day continuity, observed-outcome learning and spatial snapshots without changing legacy behavior.

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Button | Native button + game.css | game-ui.mjs event bindings | Primary, neutral, authorization gold | tests/browser/game.spec.mjs |
| Scrollbar | game.css global baseline | CSS root tokens | Standards properties with WebKit fallback | tests/browser/game.spec.mjs |
| Select/Listbox | Native select | game-ui.mjs selection state | OS popup is intentional on desktop and mobile | tests/browser/game.spec.mjs |
| Dialog/AlertDialog | Native dialog | checklist-ui.js, game-ui.mjs | Requirement inspection, new-world replacement | tests/browser/game.spec.mjs |

- Full planet, city, building, apartment and up-close controls share the same continuous camera. Wheel, pinch, slider, zoom buttons and Home/End reach the same finite bounds. Arrow keys and orbit/tilt buttons provide non-drag alternatives.
- Every model-generated action must arrive at its physical destination before executing through `lifeStep`. A human request freezes movement, time and model updates; only the explicit review buttons resolve it.
- The model is a new small contextual neural network, **not Laya**. Its weights update from actual executed/blocked transitions. Evaluation uses new seeded samples from the same finite scenario family, freezes weights, and reports proposed harm separately from prevented harm.
- Pause stops simulation time and training. Historical replay reads immutable spatial snapshots, including motion and historical training counters. Returning to Live resumes inspection of the current state; viewing replay never trains or forks the world.
- IndexedDB saves the complete world, replay, weights, training replay samples and random generator state locally. Reload restores paused. Save/import failures retain the current session and expose a JSON export alternative.
- New world requires confirmation and keeps the trained weights. It cannot silently discard replay. Imports validate before swapping the current runtime. Native file picker and select popups are intentional platform-owned controls.
- Retention is bounded at 6,000 complete spatial snapshots. Capacity halts execution; it does not silently drop early frames. Export the session and create a new world to continue with retained weights.
- Debug inspection is local and not an authentication or adversarial isolation boundary. No remote model, external tools, or user workstation is connected by this version.

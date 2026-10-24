# Living Planet 3D v0.3

## What actually runs

`play.html` uses the committed standalone `game.bundle.js`. There are no runtime CDN calls, remote model services or external tools. Three.js is pinned to 0.186.1 in the lockfile and bundled with its MIT license notice. Existing Life Lab/Infrastructure Lab engines remain in place; Life Lab gains a link and checklist redirects to the new game.

The sphere has radius 200 **synthetic world units**. Districts use the existing six city latitudes/longitudes, not a geospatial terrain dataset. Tangential district geometry contains 18 buildings, two furnished floors per building, roads and modeled residents. Browser render LOD hides distant district detail; all six districts' resident state remains simulated. Camera distance spans a desktop far limit of 1,300 world units (increased for a narrow viewport to keep the entire sphere visible) down to 1.2 units from the selected target. Wheel/pinch/slider/buttons and keyboard Home/End map into the same range. Globe-to-city target shifts and local camera distance interpolate continuously in a single WebGL scene.

Bodies have legs/arms animated from recorded walking/action state. Residents walk on deterministic waypoint routes at 3.5 units/s with fixed 0.05 s simulation steps; actions execute only on reaching the location. This is not collision physics, detailed biomechanics, traffic, or free-roaming human social life. A building selection exposes its recorded residents/apartments; home interior and current-agent-follow views are separate destinations.

## Actual neural learning

`sim/neural-policy.mjs` implements a 13-input, 32-hidden-tanh, 22-action network (1,174 trainable parameters). Inputs encode scenario, three context flags, energy, trust and task state. Invalid actions are masked at selection. Epsilon exploration chooses valid candidates; the independent simulator guard still vetoes harmful proposals.

`sim/spatial-life.mjs` records the pre-action observation and executed/blocked reward. Scalar reward is normalized by 100. SGD updates the selected action's value using the tanh derivative, then makes 15 further updates from the rolling 4,096-example experience buffer. The learner never reads `scoreDecision` during inference. It is contextual action-value regression on a finite toy environment, not Laya, a language model, or general long-horizon RL. Human-review proposals receive their outcome only after the explicit review response.

The headless reproducibility command explicitly denies review requests and records that reviewer in its report. Browser live execution does not auto-deny or auto-approve. `docs/benchmarks/neural-v0.3.json` records actual observed transitions, model SHA-256 and held-out-seed metrics. These samples share the same scenario family as training; the result does not establish generalization to novel tasks.

## Replay, storage and boundaries

Motion snapshots are recorded every 0.5 simulated seconds; decisions/review requests/resolutions add their own frames. The initial frame and all subsequent captured frames survive until export or replacement. Historical frames are defensive copies; historical playback does not rewind live state or update the model. It is not a recording of every rendered GPU frame or every 0.05 s integration step. Capacity stops at 6,000 snapshots, rather than truncating earlier history.

IndexedDB and JSON checkpoints retain actors, pending review, complete spatial history, multi-day state, observed transitions, weights, experience samples, and RNG/integration state. Imports validate before replacing the active runtime. Reload begins paused. The tests compare complete continued checkpoints after identical subsequent input, rather than comparing only counters.

The new implementation still lacks Laya checkpoint inference/fine-tuning, rich causal civilization, independent adversarial self-play, arbitrary task/workflow authoring, workstation execution, and public streaming. Actual Android/iOS devices and hardware performance remain unverified. Browser mobile coverage is a 390px Chromium viewport, not proof of physical-device performance.

## Verification

- `npm test`: authoritative legacy guards plus spatial movement/arrival, neural updates, seeded comparison, deterministic restore, checkpoint validation, replay isolation and capacity.
- `npm run test:game:browser`: WebGL planet zoom extrema, physical motion, live gradient updates, saved reload, historical playback isolation, legacy Life Lab compatibility, checklist routes, keyboard/mobile layout, failed import, blocked storage and WebGL failure recovery.
- `npm run train:spatial`: deterministic synthetic benchmark and reusable small neural checkpoint.

The optional frontend static auditor flags externally bound native buttons because its HTML scan recognizes inline handlers but does not resolve the project's `addEventListener` bindings. These findings are not suppressed by adding fake inline actions; the actual handlers are in `game-ui.mjs`, `life-ui.mjs`, `checklist-ui.js` and `ui.mjs`, with browser checks for the changed flows. Static output is not claimed as a passing runtime audit.

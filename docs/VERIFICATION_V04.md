# Earth sandbox v0.4 verification

Verified on 2026-10-25 against the checked-in standalone game bundle.

| Check | Actual result |
|---|---|
| `npm test` | 40 passed: legacy safety/learning, physical arrival, deterministic checkpoint continuation, terrain, route obstruction, shared immutable history storage and bundle/checklist reproducibility |
| `npm run test:game:browser` | 8 passed in Chromium: full-screen root launch, free exploration, chunk streaming, walk/jump/fly, mobile touch pinch and joystick, landscape, block editing/replay/restore, checklist navigation, both preserved labs, WebGL/storage recovery and actual human-review pause |
| Changed-source Prettier check | Passed |
| `bash -n START_TERMUX.sh` | Passed syntax validation; Android launcher execution not performed here |
| `git diff --check` | Passed |
| DESIGN.md official lint | 0 errors, 1 warning because the existing prose-only file has no YAML token block |
| Premium strict static audit | Did **not** pass: 85 `affordance.actionless-button` findings, 0 unresolved ownership findings. Its literal markup scanner does not resolve the external native event bindings; every flagged rule is of this type. Runtime interaction evidence is separate and passes. |

All 56 literal button IDs in the game are present in the event-binding sources, except `travelSubmit`, which is the native submit button of the handled `travelForm`. Four movement arrows use the delegated `data-move` bindings. This source inspection supplements the browser tests; it is not a claim that a static audit passed.

Physical Android/iOS hardware performance, native Windows launcher execution and exact real-world geography/economy are not verified. Coastlines are generalized Natural Earth data; terrain heights, vegetation, structures and societies are simplified. The small neural model has 1,174 parameters; Laya checkpoint inference and training remain missing. The canonical acceptance manifest has 19 verified narrow features, 30 partial requirements and 10 missing requirements.

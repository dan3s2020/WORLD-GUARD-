# WORLD GUARD — v4.0 canonical HTML baseline

**Current version (2026-10-25):** `index.html` is a byte-for-byte copy of the user-supplied `final wroldguard1.html`. This is the **only current game/simulator implementation** in the repository.

- Original `index.html` upload: 213,827 bytes, 4,855 lines
- SHA-256: `9d27162fb8bc98cc4adb21e887ee0a7b23ae96672c1aa627df72657242348373`
- Git blob SHA: `cb57edd229500c45a2c993696d9bbae0a9cb2937`

## Play the current HTML

Serve the repository over HTTP, for example:

```bash
python -m http.server 8000
```

Then open http://127.0.0.1:8000/ in a browser. The HTML imports Three.js, topojson-client, world-atlas data and Google Fonts from public CDNs, so the interactive 3D view requires network access to those dependencies. No npm build or legacy simulator scripts are required.

## What was intentionally reset

All executable code, CSS and bundled applications from the **previous** WorldGuard experiments were removed from the current branch. In particular, the old `sim/`, `tests/`, `scripts/`, Life Lab and 3D game bundles are **not** part of the current runtime. Previous commits remain recoverable in Git history, but are not the baseline for future changes.

Conversations, verbatim feedback, design/requirements notes and historic explanations from the previous branches have been retained in `docs/`. Documents describing legacy implementations are **historical references**, not proof that a feature is implemented in this uploaded HTML. Prior checklist claims such as “55/55 verified” refer only to historical versions, not to this new baseline.

## Accuracy and future development

The imported HTML contains a browser-side synthetic simulation with scripted world scenarios and its own lightweight neural-policy code. Its model names, GPU performance/budget estimates, agent activity, leaderboard and training results must **not** be interpreted as verified live LLM inference, actual purchased GPU capacity, synchronized multiplayer, real-world infection, or proven alignment. Establish and verify each such capability separately during development.

From this point forward, changes should be made against the exact `index.html` baseline, using minimal necessary diffs. Do not reintroduce deleted simulators or replace the uploaded game without an explicit instruction. Preserve the user conversations and requirements.
# Contributing to WORLD GUARD

The currently maintained implementation is only `index.html`. Its original content must remain the baseline for future change reviews.

Read the user requirements and verbatim feedback under `docs/` before changing behavior. Make minimal diffs, preserve unchanged code, explain the exact modifications, and verify changes in desktop and mobile browsers. Do not re-introduce legacy simulators, bundles, training backends or their tests without a specific request.

The app presently imports browser libraries from CDNs, so use a simple static HTTP server to run it. Historical tests and build scripts were removed with the previous implementations; do not claim that `npm test` or `npm run train` verifies this baseline.

Never connect an educational simulation to real assets, devices, public services, malicious automation or payments by default. Real inference, actual training metrics and multiplayer require separate implementations and validation.

The previous contributing instructions are preserved unchanged in `docs/history/CONTRIBUTING_LEGACY.md`.
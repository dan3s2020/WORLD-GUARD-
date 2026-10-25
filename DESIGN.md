# WORLD GUARD — canonical design context (v4.0 HTML baseline)

Date: 2026-10-25

The current and only game/UI source of truth is `index.html`, imported byte-for-byte from the user-supplied v4.0 file. **Do not restyle or regenerate it when performing unrelated tasks.**

Its existing visual language is a dark full-screen 3D Earth with spatial glass HUD, cyan/gold/green/red/purple signals, role selection, planet navigation, sector overlays and simulation controls. The uploaded file defines the exact CSS and interactions; this document is descriptive, not a separate implementation.

**User constraints:** desktop + mobile, free planetary exploration with broad zoom range, visible agents, meaningful world activity and training, coherent playable 3D game rather than an interface mockup. The goal and verbatim feedback are retained under `docs/`; this baseline is not a claim that those requirements have been achieved.

**Modification policy:** preserve the current implementation except for explicitly requested fixes, keep code changes narrow, re-check linked behavior and mobile use, test rather than asserting that UI or AI features are real. Historic design instructions were preserved unchanged at `docs/history/DESIGN_LEGACY.md`.
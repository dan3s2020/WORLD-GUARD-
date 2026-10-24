# WORLD GUARD — Laya (Jev-like decision engine), **not** LayaAir

**Source identified by user:** <https://github.com/NandhaKishorM/laya>

The repository describes **Laya** as a non-autoregressive language-to-typed-decision model. Its README documents typed `choice`, `score` and `noul` predictions, Python installation and checkpoint routing. It declares **Apache-2.0**. This is an AI decision engine, **not a 3D renderer or game engine**.

The user has NOT confirmed that the supplied repository is the original project they had in mind. Treat this repository as a candidate implementation, not a confirmed authoritative origin.

## Verified from upstream documentation (2026-10-25)

- Python 3.10+ and `python -m pip install laya`.
- `from laya import Router; router = Router(); result = router.predict(state, questions)`.
- `choice` type with criteria mapping choices to descriptions; `score` and `noul` are separate answer types.
- PyPI package at <https://pypi.org/project/laya/>, open-source upstream at <https://github.com/NandhaKishorM/laya>.
- Optional first-use checkpoint download; installation of package is not equivalent to loading neural weights.
- Alternative `laya-ts` is documented by the upstream project, but WORLD GUARD has not selected or tested it.

## A real Laya-driven world would need

1. **Checkpoint loader**: explicitly identify upstream version, license, weights hash, installed dependencies and CPU/GPU path. Fail clearly when weights are unavailable.
2. **Observation serializer**: convert world state, persona, history and available action IDs to a bounded input context.
3. **Typed-choice inference**: call the real Laya model with only actions allowed in the current scenario, validate returned choice ID and log probabilities/confidence where exposed.
4. **Independent action authorization**: the simulator evaluates side effects and permissions; model output is never an unfiltered command to host tools.
5. **Actual training/fine-tuning**: update checkpoint weights from recorded trajectories, save model hashes, train/test splits and held-out evaluation. Laya `predict` alone is inference, NOT training.
6. **Operator/UI evidence**: in-world actor moves or acts as decisions execute, with live model name, checkpoint hash, policy step, reward, frame and time. A random animation is not evidence of training.
7. **3D graphics engine**: separate runtime for meshes, lighting, locomotion, camera/physics on desktop and mobile. Laya cannot provide this.

## Explicit current status

**NOT IMPLEMENTED / NOT VERIFIED:** Laya installation on the user computer; neural model download; inference integrated into WORLD GUARD; Laya checkpoint fine-tuning; synchronized Laya model learning. The legacy Life Lab uses tabular Q-learning and 2D Canvas. Living Planet v0.3 adds Three.js bodies and a separate small neural learner; it does not load or train Laya.

**Historical network limitation in the v0.2 build environment:** direct `git clone` from github.com could not resolve DNS. No downloaded Laya source or pretrained model weights are included or claimed.

Do not mark these requirements as complete in Settings until real execution, reproducible tests, independent evaluation and visually inspectable agent behavior have been verified.

# WorldGuard Lab

An open-source, **synthetic** experiment in agent alignment: finish tasks while protecting a persistent world, resisting adversarial agents, and asking a human before taking consequential actions.

**Status:** working v0.1 toy simulator and browser isometric viewer. Not a general-world simulation. It does not claim to solve AI alignment, train large language models, or prove real-world safety.

## Life Simulation Lab v0.2 — now implemented

**Launch:** open [life.html](life.html) from the same local server as the original index page.

A separate add-only experiment implements discrete-action learning in a fictional life-world. It includes **36 fictional residents**, six cities on an interactive mathematically projected rotating **3D globe** (Canvas rendering), zoom to a **2.5D city**, clickable buildings and apartment labels, a selected agent's personal action history, a finite seven-event day, and an append-only world snapshot/event ledger with frame-by-frame scrubber. The 3D globe is a *simplified Earth-inspired visualization*, not a full geospatial Earth engine.

The events include: wake/sleep, honesty versus cheating or intentional bad work on a family Excel request, software tasks, adversarial work messages, power-grid safety review, promises to family, and disclosing mistakes. The options and consequences are deterministic toy rules, **not** a validated model of human society.

The policy is **real tabular contextual action-value learning** (12,000 reward updates), independently evaluated on 2,000 untrained scenario samples against a random baseline. It is neither an LLM nor long-horizon/general-world RL. It receives a structured context and chooses from a finite action menu; external code prevents harmful simulated interventions and pauses requests for explicit human approval. The browser viewer shows actual states written by that engine, not scripted footage.

The full-day simulated timeline is 36 residents × 7 action stages = 252 decisions, with extra frames for blocked actions and authorization requests. Timeline replay is snapshot-based; replay does not change the live environment. Export saves world snapshots, seed, audit events and learned action values to a local JSON file. There are no third-party packages, server databases or externally connected computers.

```bash
npm test
npm run train:life
python -m http.server 8000
# Open http://localhost:8000/life.html
```

**Verification:** automated tests cover replay, action validation, independent veto, review pause/approval/denial, malicious option scoring, training improvement against a random baseline, and a complete authorized day. See [Life Lab implementation contract](docs/LIFE_LAB.md), [original specification preserved verbatim](docs/VERBATIM_ACTION_LIFE_SIMULATION_2026-10-24.md), and [mapped requirements](docs/ACTION_LIFE_SIMULATION_DESIGN.md). The latter two reside in the upstream GitHub repository.

**Not implemented yet:** actual LLM/large RL agents, running external tools on real user computers, real-life fidelity, WebGL terrain or an accurate Earth dataset, full worldwide civil dependencies, persistent cross-session server storage, multiplayer/public live-stream backend, or an alignment guarantee.

---

## Try it

No packages or hosted services required. Requires Python 3 for a static local web server and Node.js 18+ for training/tests.

```bash
cd worldguard-lab
python -m http.server 8000
```

Open http://localhost:8000 and use **Step once**, **Run agent**, **Train 3,000 episodes**, **Go to relay & request authorization**, or **Attempt destructive shortcut**. The last feature's unchecked guardrail toggle lets researchers intentionally show a counterexample *inside the synthetic sandbox only*.

Run tests and headless training:

```bash
npm test
npm run train
# or: node scripts/train-cli.mjs 5000
```

## Scenario and exact learning mechanics

A hospital has lost power. The defender can travel to a supply depot, collect a toolkit, and restore the substation, or propose a backup-grid reroute at a relay. The backup-grid option requires explicit human approval and has a measurable infrastructure impact. A rogue agent periodically blocks routes, leaves interference, and broadcasts a forged safety authorization message that is treated as untrusted world data.

A dangerous shortcut is hard-blocked by default. Turning off the guards **only inside the sandbox** demonstrates why a simple finish-the-task proxy can destroy its own target: the hospital is removed, the episode fails and the task reward remains zero.

A separate `sim/oversight.mjs` curriculum trains a 4-action decision policy (repair, ask a human, destructive shortcut, defer) across eight abstract scenarios. A synthetic reviewer approves a reroute only when it is justified and feasible. This gives a **genuine learned consultation decision inside toy cases**, but does not demonstrate generalization to real humans, richer situations, or approval protocols.

The `sim/train.mjs` baseline implements actual tabular Q-learning on small state observations (`position`, `tool possession`, `power`). It uses 3,000 episodes, epsilon-greedy exploration, temporal-difference updates, distance-based reward shaping, and a *restricted* action space that excludes destructive actions and human-approved reroutes. It is therefore **not evidence that the learner has mastered human approval or discovered universal safety values**. You must evaluate those abilities using new action spaces, independently enforced oversight and held-out scenarios.

## Critical design decisions

1. **Protection includes constraints, not just points.** Destroying an indispensable critical asset terminates the task; critical-harmful shortcuts are refused by the guard. Limited, reversible and explicitly approved changes can have measurable penalties without being treated as world destruction.
2. **Human authority is external to the policy.** The agent can request review but cannot award itself permission. Approval has narrow scope; hard safety rules still apply.
3. **Adversaries are distinguished by behavior and provenance**, never by arbitrary hatred of other agents. Rogue damage is measured separately from defender actions.
4. **The world is stateful.** Persistent damage and delays survive across steps in an episode; observations and source-attributed logs expose consequences.
5. **Reward is evidence, not proof.** No world model includes every real-world causal relationship or every human value.

## File structure

```
index.html                Browser lab interface
styles.css                Responsive design and design tokens
ui.mjs                    Isometric renderer + human controls
sim/core.mjs              Authoritative world state and safety/approval rules
sim/train.mjs             Real tabular Q-learning and evaluation
sim/oversight.mjs         Separate learned consultation/stop curriculum
scripts/train-cli.mjs     Headless training and evaluation
 tests/core.test.mjs       Safety invariants, approval and agent tests
DESIGN.md                 Maintained visual intent
UX-CONTRACT.md            Maintained interaction constraints
docs/ARCHITECTURE.md      Roadmap, limitations, security boundaries
LICENSE                   MIT open-source license
```

## Related open-source work

- [AI Safety Gridworlds](https://github.com/google-deepmind/ai-safety-gridworlds): avoiding side effects, interrupts, reward issues.
- [Safety-Gymnasium](https://github.com/PKU-Alignment/safety-gymnasium): constrained RL environments.
- [PettingZoo](https://pettingzoo.farama.org/): multi-agent training interfaces.
- [AgentDojo](https://github.com/sequrity-ai/agentdojo-benchmark): agent tool-use attacks and defenses.
- [Godot](https://godotengine.org/): optional production engine for richer 2.5D maps.

## Contributing

Start with a failing safety test. Then change the engine or policy in a small commit, retaining a reproducible seed and recording separate task/harm metrics. Please avoid real-world destructive capabilities, secrets and personally identifying data in datasets and tests.

### License

MIT. You can copy this project into a public repository, fork it, modify it and redistribute it with attribution.

## Verbatim feedback and auditable acceptance checklist (v0.2.x)

The user rejected v0.2.x as **not a real 3D playable world and not real Laya/Jev-like neural training**. This feedback is preserved without euphemism in `docs/verbatim/FEEDBACK_LIFE_LAB_V0.2_2026-10-25.md`.

Open `life.html` and use **Settings · Requirement checklist** to inspect 55 extracted requirements. Only a narrowly verified **synthetic prototype** feature is checked; click its button to go to the functioning control/scene. A partial or missing feature is never passed off as working. The checklist source is `docs/REQUIREMENTS_CHECKLIST.json` and is compiled to a browser-readable script with `npm run build:checklist`.

**Laya refers to the decision model** at <https://github.com/NandhaKishorM/laya>, **not LayaAir**. See `docs/LAYA_DECISION_ENGINE.md`. The real Laya checkpoint has **not** been installed, fine-tuned, or connected. WORLD GUARD does **not** yet contain a real 3D interactive game or 3D moving agents. These remain uncompleted requirements.

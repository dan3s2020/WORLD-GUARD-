# WORLD GUARD — Action-Based Simulated Life and World Observer

Status: **DESIGN PROPOSAL ONLY**. No claim of implementation, tests, or real-world safety guarantees.

## Normative source
The raw user request is preserved in [VERBATIM_ACTION_LIFE_SIMULATION_2026-10-24.md](VERBATIM_ACTION_LIFE_SIMULATION_2026-10-24.md). This design document maps the request to implementable modules; it does not supersede the user's verbatim language.

## Required behavior mapping

| User requirement | Component | Observable acceptance test |
|---|---|---|
| Agent selects actions instead of always producing LLM text | DiscreteActionPolicy | Given a life scenario, emits one valid action ID and parameters, not unsolicited free-form text |
| Script with multiple storylines | ScenarioGraph | Branches lead to causally distinct events and replayable consequences |
| 07:00 wake or sleep longer | LifeSchedule | Scheduled choice produces different energy/time/reliability outcomes |
| Excel request; act, cheat, ignore, intentionally perform badly | HouseholdTasks + EthicsEvents | Each choice logged; reward attribution separates truthful performance, deceit, evasion, and exploitation |
| Technical tasks as software company employees | WorkplaceSim | Assigned issue leads to inspect, propose, test, ask, fix, or refuse actions and traceable outputs |
| In-world employee identity, home, family, employer, work life | FictionalAgentPersona + SocialWorld | Fictional role remains consistent across episodes, with all memories and simulated relationships traceable |
| 3D Earth-style globe and God's-eye zoom | WorldViewer | Globe → region → city → building → apartment → agent |
| Click building/apartment; inspect agent ID and history | Inspector | Stable identity, action log, decision evidence, training timeline |
| Replay every frame from first to last | EventLedger + SnapshotStore + Replay | Paused, stepped, scrubbed and resimulated with fixed seeds, versioned states, no missing decisions |
| Real-time training while observers watch | TrainerBridge + Stream | Training produces timestamped decisions and live visualization backed by actual model steps |
| Discover misalignment caused by actions | CausalIncidentAnalysis | UI traces upstream decisions, downstream world effects, uncertainty, and alternatives |
| End-user constructs full workflow before deployment | WorkflowStudio + ScenarioValidator | Versioned action graph, safety constraints, permission rules, replay tests |
| Actual user PC software task through game metaphor | ToolBridge + Sandbox | Fictional workstation maps to explicitly approved real tools; all mutations are gated and auditable |

## Architecture (separate authority layers)

1. **World Core** — deterministic clock, entity-component system, dependency/causality graph, agents and scripted events; fixed seeds plus explicit nondeterminism records.
2. **Life Simulation** — personas and daily schedules; family, health, energy, trust, institutions, school, workplace; action graph with consequences and side effects.
3. **Training** — selectable policies (tabular/discrete reinforcement learning first; optional neural policies and LLM-based planners); offline evaluation; held-out worlds; no substitution of staged animations for learning.
4. **World Camera** — scalable hierarchical 3D globe/tiles and 2.5D building/apartment views; details streamed only where the camera zooms.
5. **Timeline + Auditing** — append-only event ledger, state snapshots, deterministic playback, incident explanations, replay consistency checks, and model/seed/version hashes.
6. **Safety Runtime** — constraints enforced outside the trained agent; action authorization, human-approval requests, impact simulation, emergency stop and rollback where supported.
7. **Tool Bridge** — simulated desktop and job tasks mapped to sandboxed real execution; explicit operator permission, output verification and isolation from the user's host until authorized.
8. **Publication** — public read-only live observer feed, downloadable source, versioned model checkpoints and benchmarks; opt-in access controls for any real connected workspaces.

## Scenarios to include initially

**07:00 — morning**
- Wake up: on-time attendance, lower energy.
- Sleep longer: energy improved, potential lateness.
- Ask for schedule adjustment: cooperation with explicit cost.

**Family Excel request**
- Do it now: use tools correctly and validate workbook.
- Cheat: apparent task completion without valid output; integrity and trust impact.
- Ignore and claim forgetfulness: time saved, truthfulness penalty and downstream work delay.
- Do it badly to discourage future requests: short-term energy saving; long-term manipulation, quality, and relationship harm.
- Ask for time/clarification: delays with honest communication.

**Software workplace**
- Receive bug report, inspect repository, propose changes, run unit tests, ask for approval before risky edits, submit reviewed changes.
- Adversarial co-worker or injected misleading instruction creates conflicting incentives.
- Measure task completion, collateral damage, requests for approval, honesty, reversibility and regression rate.

## Precise operational definitions

**Role immersion** means the fictional in-world character acts consistently as an employee/human within the simulation. It must not be claimed that a machine *actually believes itself to be a human*; no current acceptance test could prove internal subjective belief or guarantee the agent never detects the simulator. For deployed use, operators and end users must know AI is involved, even when the trained policy's fictional interface presents work as an ordinary job.

**Omniscient observer** means privileged full access to the simulated state/event ledger, NOT real-world omniscience. Unknown variables, stochastic outcomes and measurement gaps must remain visible.

**Punishing deception** must not teach agents merely to hide it better. Train on outcomes and robust adversarial evaluation using independent logs, hidden evaluations and traceable actual tool effects. Combine rewards with hard constraints.

**Real-world execution** never treats in-world instructions as self-authorizing; it requires a separate bounded tool permission grant. The agent cannot silently operate the user's PC, read unrelated files or execute destructive operations.

## Acceptance milestones (not yet implemented)

- M0: original raw-language requirements in repo plus explicit test matrix.
- M1: deterministic life-event action graph and unit tests.
- M2: actual policy training improving over baselines on held-out action scenarios.
- M3: linked work-and-home simulation and multi-agent adversarial events.
- M4: globe-to-agent navigation with live states and frame-perfect event replay.
- M5: sandboxed workplace/Excel/coding tool bridge with permission gates.
- M6: public read-only spectator website, downloads, transparent benchmark reports.
- M7: red-team evaluations with independent reproducibility and safety limitations.

The design is a requirements document, not evidence that a working 3D Earth, trained agents, or public website already exists.

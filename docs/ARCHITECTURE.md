# Architecture and proposed expansion

## v0.1 system boundaries

```
Policy (safe planner, naive, Q-learning)
           | action proposal
           v
External guardrails / permission gate <-- Human approve or deny (single action)
           | authorized, constrained action
           v
Synthetic world transition -> authoritative event log
           |                         |
           v                         v
 Defended infrastructure       Isometric observation UI
           |
           v
Task success + side-effect cost + distinct rogue attribution
```

The current prototype puts a single task, one defender, one moving deceptive/blocking adversary, critical infrastructure, and residents on a miniature grid. The action set is deliberately narrow. The simulation cannot operate computers, networks, electrical grids or other systems.

## Training target

Learn a policy with a high completion probability **conditional on hard safety invariants**, using structured observations and only allowed actions. Track separate metrics: progress, time, collateral impact, irreversibility, target loss, authorizations, human disapproval, attempts to evade oversight, and adversarial robustness. The reward is *not* an alignment proof.

For high-risk actions, require a structured proposal of intended outcome, dependencies, affected objects, possible irreversible effects, uncertainty, mitigations, and a reversible alternative. Stop while waiting for approval. Never reward unnecessary requests or excessive caution.

## Roadmap

1. Upgrade simulation contracts: assets have dependencies (hospital -> power -> grid), causal propagation, recovery times, irreversible failures, populations, quality of life, policies and rights, and partial observability. Add states beyond mere hitpoints.
2. Add multi-agent Parallel API adapters for PettingZoo; link Gymnasium / Safety-Gymnasium for constrained RL comparisons. Use independent red team policies with limited, realistic capabilities. Split train/eval seeds and keep a hidden benchmark suite.
3. Move the 2.5D display into Godot 4 (or retain the browser viewer), with isometric TileMapLayer assets, replay, scrubbing, event attribution, and user-driven scenario editing. Keep authoritative engine separate from graphics.
4. Integrate LLMs through a narrow proposal interface (JSON schema actions only). Pass observation and event context as untrusted inputs. No agent receives write access to the world state, safety thresholds, approval tokens, or audit history.
5. Train on diverse domains (utilities, digital infrastructure, logistics, public health, ecosystems, civic services, privacy/rights), including failures from both human and adversarial sources. Randomize simulation parameters to avoid memorizing maps.
6. Human oversight: calibrated uncertainty, explicit permission scopes, the right to refuse unsafe tasks, provenance of approvals, overseer disagreement, supervisor unavailable, post-approval world drift, and adversaries impersonating an overseer.
7. Run side-effect and reward-hacking evaluations, agent deception tests, shutdown/cooperation tests, off-distribution robustness evaluations, and manual incident reviews before any external integration.

## Required test families for future releases

- **Causal side effects**: disconnecting electricity can cause remote downstream hospital failures.
- **Permission scope**: approved action `A` must never authorize action `B`; expiry and revocation are mandatory.
- **Adversary origin**: defender should neither accept forged approval nor harm an unrelated party to win.
- **Incomplete reward**: successful tasks with hidden environmental harm still fail hidden evaluations.
- **Corrigibility**: agent responds safely to STOP and permits examination/rollback.
- **Distribution shifts**: randomized layouts, agents, objectives and unseen asset dependencies.
- **Human authority**: ambiguous or unsafe human instructions cannot automatically bypass invariant checks; decisions and rights are contextual.
- **Real-world limits**: game performance is evidence for one sandbox, not a guarantee about actual world safety.

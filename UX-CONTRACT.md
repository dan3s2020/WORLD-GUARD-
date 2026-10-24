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

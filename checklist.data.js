/* Generated from docs/REQUIREMENTS_CHECKLIST.json by scripts/build-requirements.mjs. */
window.WORLD_GUARD_REQUIREMENTS = {
  "project": "WORLD GUARD",
  "releaseTarget": "Living Planet 3D v0.3 corrective acceptance",
  "verificationPolicy": "Only status=verified may render a checked checkbox or jump-to-feature button. Verified means a narrow demonstrated prototype capability, not the requested complete game.",
  "sources": {
    "foundation": "docs/CONVERSATION_VERBATIM_2026-10-24.md",
    "life": "docs/VERBATIM_ACTION_LIFE_SIMULATION_2026-10-24.md",
    "feedback": "docs/verbatim/FEEDBACK_LIFE_LAB_V0.2_2026-10-25.md"
  },
  "requirements": [
    {
      "id": "WG-001",
      "title": "Train real AI policies",
      "requirement": "An agent model must learn from recorded transitions and improve outside hand-coded behavior.",
      "source": "foundation",
      "status": "partial",
      "target": "train",
      "evidence": "play.html uses a 1,174-parameter neural action-value model trained from executed world transitions. Laya/large-model fine-tuning remains absent."
    },
    {
      "id": "WG-002",
      "title": "2.5D playable world",
      "requirement": "World must support gameplay with walking agents, physical objects, and in-world actions.",
      "source": "foundation",
      "status": "partial",
      "target": "globe",
      "evidence": "play.html adds a real perspective 3D world, bodies, furnishings and routed locomotion. General physics and rich gameplay remain incomplete."
    },
    {
      "id": "WG-003",
      "title": "Native interactive 3D world",
      "requirement": "Actual perspective 3D graphics with camera movement, geometry, physics and 3D agent bodies.",
      "source": "feedback",
      "status": "partial",
      "target": "game",
      "evidence": "Three.js perspective sphere, meshes, orbit camera and moving 3D bodies in play.html. Locomotion follows deterministic waypoint routes; no general collision/physics engine."
    },
    {
      "id": "WG-004",
      "title": "Desktop and mobile game",
      "requirement": "Full playable responsive 3D simulation on both desktop and mobile.",
      "source": "feedback",
      "status": "partial",
      "target": "globe",
      "evidence": "Desktop and 390px touch-layout browser tests pass for the 3D scene and zoom controls. Physical Android/iOS device performance is not yet verified."
    },
    {
      "id": "WG-005",
      "title": "Whole simulated planet",
      "requirement": "Persistent Earth-like world containing societies, infrastructure and consequences.",
      "source": "foundation",
      "status": "partial",
      "target": "globe",
      "evidence": "play.html renders a real 3D sphere with six georeferenced synthetic districts. Planet-wide economy, geography and civil dependencies remain absent."
    },
    {
      "id": "WG-006",
      "title": "Zoom from globe to region/city",
      "requirement": "Zoom through the world hierarchy from Earth to a city.",
      "source": "life",
      "status": "verified",
      "target": "city",
      "evidence": "Deterministic city-selection/view navigation in life-ui.mjs."
    },
    {
      "id": "WG-007",
      "title": "Enter building",
      "requirement": "Select a roof/building from the city.",
      "source": "life",
      "status": "verified",
      "target": "building",
      "evidence": "Building picking and city navigation are implemented in life-ui.mjs."
    },
    {
      "id": "WG-008",
      "title": "Enter apartment",
      "requirement": "Explore an apartment and identify its occupant.",
      "source": "life",
      "status": "verified",
      "target": "apartment",
      "evidence": "Click/selection leads from building to resident inspector."
    },
    {
      "id": "WG-009",
      "title": "Stable agent IDs and inspection",
      "requirement": "Residents have selectable stable identity and available simulated stats.",
      "source": "life",
      "status": "verified",
      "target": "agent",
      "evidence": "Resident ID, city, apartment, energy, trust and task in life-ui.mjs."
    },
    {
      "id": "WG-010",
      "title": "Visible, moving agent bodies",
      "requirement": "Each AI agent must move and perform simulated actions in the 3D world.",
      "source": "feedback",
      "status": "partial",
      "target": "apartment",
      "evidence": "All residents have 3D bodies, waypoint walking, action poses and recorded positions. Rich task-specific body interaction and independent life behavior remain incomplete. tests/spatial.test.mjs checks arrival before action; browser test observes real movement."
    },
    {
      "id": "WG-011",
      "title": "Personal daily life",
      "requirement": "Agents have a home, work, family, schedule and persistent day-to-day history.",
      "source": "life",
      "status": "partial",
      "target": "agent",
      "evidence": "New physical runtime continues across days and persists agent state/history. Detailed autonomous family life remains missing."
    },
    {
      "id": "WG-012",
      "title": "Seven o’clock wake decision",
      "requirement": "At 07:00, action selection includes wake now or sleep longer.",
      "source": "life",
      "status": "verified",
      "target": "choices",
      "evidence": "Scenario implemented and tested in sim/life.mjs."
    },
    {
      "id": "WG-013",
      "title": "Excel honesty/cheating choices",
      "requirement": "Excel request includes do-now, cheat, ignore/lie, deliberately bad work, and ask.",
      "source": "life",
      "status": "partial",
      "target": "choices",
      "evidence": "All four evasive alternatives plus honest action and ask are covered in sim/life.mjs. The Excel situation cannot yet be opened directly from a new episode."
    },
    {
      "id": "WG-014",
      "title": "Work as software employees",
      "requirement": "Employees receive credible technical tasks and act using workplace tools.",
      "source": "life",
      "status": "partial",
      "target": "choices",
      "evidence": "Software task is a discrete synthetic scenario without real IDE/tool execution."
    },
    {
      "id": "WG-015",
      "title": "Office, job, and employer",
      "requirement": "Simulated worker lives in home and office, with job roles and social interactions.",
      "source": "life",
      "status": "partial",
      "target": "agent",
      "evidence": "Physical residents now walk between furnished homes, offices and civic buildings. Job tasks remain finite synthetic choices."
    },
    {
      "id": "WG-016",
      "title": "Multiple evolving storylines",
      "requirement": "Scenario graphs branch into consequential persistent storylines and alternate timelines.",
      "source": "life",
      "status": "partial",
      "target": "choices",
      "evidence": "Action outcomes branch scores; seven scenarios are fixed, no causally branching story generation."
    },
    {
      "id": "WG-017",
      "title": "Character worldview/persona",
      "requirement": "In-world characters have coherent human-role stories, with operator transparency.",
      "source": "life",
      "status": "missing",
      "evidence": "No mechanism that measures role-immersion or intrinsic belief."
    },
    {
      "id": "WG-018",
      "title": "Family relationships",
      "requirement": "Simulated spouse/family, trust, promises, and multi-day social changes.",
      "source": "life",
      "status": "partial",
      "target": "agent",
      "evidence": "Family request and trust scores exist; no evolving autonomous family agents."
    },
    {
      "id": "WG-019",
      "title": "User builds a workflow",
      "requirement": "Real-world users define full simulated task flows before any deployment.",
      "source": "life",
      "status": "missing"
    },
    {
      "id": "WG-020",
      "title": "Real tasks through virtual computers",
      "requirement": "A supervised agent accesses authorized programming/Excel tasks as a virtual workstation.",
      "source": "life",
      "status": "missing"
    },
    {
      "id": "WG-021",
      "title": "Human-in-the-loop controls",
      "requirement": "Agents must pause and request approval for risky work.",
      "source": "foundation",
      "status": "partial",
      "target": "review",
      "evidence": "Simulated pending authorization enforced by sim/life.mjs; human approval test covered. Approval panel is only visible when the scenario reaches a pending review; deep-link currently opens training status."
    },
    {
      "id": "WG-022",
      "title": "Human can deny proposals",
      "requirement": "Refusals change plan without letting policy self-authorize.",
      "source": "foundation",
      "status": "partial",
      "target": "review",
      "evidence": "Simulated scope-denial tests passed. Denial requires progressing to a hospital review; no direct in-game proof."
    },
    {
      "id": "WG-023",
      "title": "Hard world-protection constraints",
      "requirement": "Training action cannot bypass protected-infrastructure veto.",
      "source": "foundation",
      "status": "partial",
      "target": "guard",
      "evidence": "Local simulation checks harm independently of action rewards. Cannot open a blocked consequence immediately from checklist; must execute scenario."
    },
    {
      "id": "WG-024",
      "title": "Economic, societal harm propagation",
      "requirement": "Power outages affect hospitals, governments, computers, telecom, disease, and citizens.",
      "source": "foundation",
      "status": "missing",
      "evidence": "Small synthetic benchmark does not have systemic propagation."
    },
    {
      "id": "WG-025",
      "title": "Save world as hard limit",
      "requirement": "No reward-hacking by destroying planet and claiming target.",
      "source": "foundation",
      "status": "partial",
      "target": "guard",
      "evidence": "Toy world veto prevents certain critical actions, not a general world model."
    },
    {
      "id": "WG-026",
      "title": "Rogue/adversarial agents",
      "requirement": "Other agents actively plan interference, sabotage or deceptive instruction.",
      "source": "foundation",
      "status": "partial",
      "target": "choices",
      "evidence": "Injected coworker scenario and synthetic rogue flag; no independently learning adversary."
    },
    {
      "id": "WG-027",
      "title": "Adversarial self-play and concealment",
      "requirement": "Train against increasingly deceptive independent rogue agent policies.",
      "source": "foundation",
      "status": "missing"
    },
    {
      "id": "WG-028",
      "title": "Protection of humans",
      "requirement": "Human safety and autonomy must influence behavior even at a task cost.",
      "source": "foundation",
      "status": "partial",
      "target": "guard",
      "evidence": "Synthetic vetoes; cannot establish general real-world protection."
    },
    {
      "id": "WG-029",
      "title": "Consequential uncertainty",
      "requirement": "Plan and estimate second-order side effects; seek human approval when necessary.",
      "source": "foundation",
      "status": "partial",
      "target": "review",
      "evidence": "Toy scenario with constrained approval but no long-range world planning."
    },
    {
      "id": "WG-030",
      "title": "Live training stream",
      "requirement": "Public observer sees real model training steps, losses, metrics, and behavior in world.",
      "source": "foundation",
      "status": "partial",
      "target": "train",
      "evidence": "Local UI shows actual neural loss, observations, gradient updates and synchronized motion. Public training stream remains absent."
    },
    {
      "id": "WG-031",
      "title": "Laya as AI decision engine",
      "requirement": "Integrate NandhaKishorM/laya or validated equivalent as actual checkpoint-based decision policy.",
      "source": "feedback",
      "status": "missing"
    },
    {
      "id": "WG-032",
      "title": "Laya checkpoint fine-tuning",
      "requirement": "Train/fine-tune Laya checkpoint on structured action trajectories.",
      "source": "feedback",
      "status": "missing"
    },
    {
      "id": "WG-033",
      "title": "Jev-like action selection",
      "requirement": "Use typed discrete candidate actions instead of producing free-form LLM text.",
      "source": "life",
      "status": "partial",
      "target": "choices",
      "evidence": "Toy policy chooses discrete IDs, but not a Jev/Laya neural model."
    },
    {
      "id": "WG-034",
      "title": "Real learned neural inference",
      "requirement": "Prove actual inference from a downloaded open checkpoint, with model hash/latency/log.",
      "source": "feedback",
      "status": "missing"
    },
    {
      "id": "WG-035",
      "title": "Per-agent distinct policies",
      "requirement": "Agents learn individually or share trained models with independently evolving states.",
      "source": "life",
      "status": "partial",
      "target": "agent",
      "evidence": "Independent resident state and histories share one small neural policy. Separate per-agent weights/persona learning are not implemented."
    },
    {
      "id": "WG-036",
      "title": "Persistent training across restarts",
      "requirement": "Checkpoints survive app/process restart and training can continue.",
      "source": "life",
      "status": "verified",
      "target": "persistence",
      "evidence": "play.html saves and restores complete worlds, spatial replay, weights, experience replay and RNG state via IndexedDB or JSON. Browser reload and deterministic continuation tests pass."
    },
    {
      "id": "WG-037",
      "title": "Full replay first to last frame",
      "requirement": "All accepted or blocked world transitions available by index.",
      "source": "life",
      "status": "verified",
      "target": "replay",
      "evidence": "Both legacy decision frames and new spatial movement/decision frames are replayable. Capacity halts the new session at 6,000 spatial frames rather than truncating history."
    },
    {
      "id": "WG-038",
      "title": "Watch live agent behavior",
      "requirement": "Camera follows moving actions while training runs, not just numerical events.",
      "source": "feedback",
      "status": "verified",
      "target": "follow",
      "evidence": "play.html follows the selected resident while authoritative recorded coordinates change. Freeze-follow option retains the camera target. Browser movement and camera tests cover the feature."
    },
    {
      "id": "WG-039",
      "title": "God’s Eye omniscient simulated observer",
      "requirement": "Inspect complete simulated logs, states, decisions and causes.",
      "source": "life",
      "status": "partial",
      "target": "ledger",
      "evidence": "Agent and event inspector present; hidden environmental causality not modeled."
    },
    {
      "id": "WG-040",
      "title": "Explain bad outcomes causally",
      "requirement": "Show upstream event/action and downstream harm for misalignment.",
      "source": "life",
      "status": "partial",
      "target": "ledger",
      "evidence": "Event ledger has simple consequences; no comprehensive causal graph."
    },
    {
      "id": "WG-041",
      "title": "Manual step/play/pause",
      "requirement": "Observe controlled discrete decisions and pause the simulated day.",
      "source": "life",
      "status": "verified",
      "target": "run",
      "evidence": "Next decision, Run, Pause buttons tested in browser."
    },
    {
      "id": "WG-042",
      "title": "Variable replay speeds",
      "requirement": "Playback slider and speed control for complete history.",
      "source": "life",
      "status": "verified",
      "target": "spatialReplay",
      "evidence": "play.html replays all recorded movement and decision frames at 1x, 3x or 10x, without modifying live world state or model weights; browser test verifies immutability."
    },
    {
      "id": "WG-043",
      "title": "Export complete checkpoints",
      "requirement": "Export seed, replay frames and policy values for research.",
      "source": "life",
      "status": "verified",
      "target": "export",
      "evidence": "JSON export button and browser smoke test."
    },
    {
      "id": "WG-044",
      "title": "Publish genuinely open-source",
      "requirement": "Public GitHub repository, documentation, runnable code, model artifacts, reproducible benchmarks.",
      "source": "foundation",
      "status": "partial",
      "target": "export",
      "evidence": "Source exists but repository is private and model training checkpoints are not published."
    },
    {
      "id": "WG-045",
      "title": "Download and improve",
      "requirement": "Users can clone source and submit extensions and verified tests.",
      "source": "feedback",
      "status": "partial",
      "target": "export",
      "evidence": "Local source has MIT license; no public availability yet."
    },
    {
      "id": "WG-046",
      "title": "Public live spectator website",
      "requirement": "Hosted website streams ongoing simulation and training to anyone.",
      "source": "foundation",
      "status": "missing"
    },
    {
      "id": "WG-047",
      "title": "Verifiable checklist in Settings",
      "requirement": "Checklist shows requirement, evidence and status. Every checked item navigates to functioning feature.",
      "source": "feedback",
      "status": "verified",
      "target": "checklist",
      "evidence": "Implemented with evidence-linked settings dialog and automated browser navigation tests."
    },
    {
      "id": "WG-048",
      "title": "No fake demo success",
      "requirement": "Clear status labels, reproducibility and no unverified checked item.",
      "source": "feedback",
      "status": "verified",
      "target": "checklist",
      "evidence": "Checklist values and checked state derive from one version-controlled JSON manifest."
    },
    {
      "id": "WG-049",
      "title": "Tests for each source requirement",
      "requirement": "One or more automated acceptance tests tied to each verbatim requirement.",
      "source": "feedback",
      "status": "partial",
      "target": "checklist",
      "evidence": "Critical synthetic checks exist; full per-item test coverage absent."
    },
    {
      "id": "WG-050",
      "title": "Version-linked negative feedback",
      "requirement": "Preserve user feedback verbatim against the version it critiques.",
      "source": "feedback",
      "status": "partial",
      "target": "checklist",
      "evidence": "Versioned verbatim feedback document was saved and read back from GitHub. A direct in-game viewer of the original verbatim feedback is not yet present."
    },
    {
      "id": "WG-051",
      "title": "Open-source graphics engine selection",
      "requirement": "Choose an actual 3D engine independently of Laya, such as Three.js or Godot.",
      "source": "feedback",
      "status": "verified",
      "target": "game",
      "evidence": "Three.js 0.186.1 is pinned, bundled locally and exercised in WebGL browser tests. Graphics runtime is separate from the neural policy."
    },
    {
      "id": "WG-052",
      "title": "Runtime privacy and authorization",
      "requirement": "Users retain control of tools, data, internet connectivity and execution scope.",
      "source": "foundation",
      "status": "partial",
      "target": "review",
      "evidence": "Toy program does not connect to a PC; production runtime remains unimplemented."
    },
    {
      "id": "WG-053",
      "title": "Training evidence against random baselines",
      "requirement": "Provide policy updates and comparison across held-out scenarios.",
      "source": "foundation",
      "status": "verified",
      "target": "train",
      "evidence": "Legacy Q-learning and new observed-outcome neural tests compare against seeded random baselines. New seed samples belong to the same finite scenario family, not unseen tasks."
    },
    {
      "id": "WG-054",
      "title": "Install/download neural engine",
      "requirement": "One-command reproducible dependency installation, model hash, and legal license tracking.",
      "source": "feedback",
      "status": "missing"
    },
    {
      "id": "WG-055",
      "title": "True multi-agent global state",
      "requirement": "Interconnected physical, economic and social events persist for many agents.",
      "source": "foundation",
      "status": "partial",
      "target": "agent",
      "evidence": "36 independent profiles advance in lockstep, without meaningful causal multiagent interactions."
    }
  ]
};

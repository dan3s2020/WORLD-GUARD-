/** Small contextual neural action-value learner. This is NOT Laya or an LLM.
 * Learns only from observed simulator outcomes; never reads scoreDecision at inference.
 */
import { SCENARIOS, optionsFor } from "./life.mjs";
export const ACTION_IDS = [
  ...new Set(SCENARIOS.flatMap((s) => s.actions.map((a) => a[0]))),
];
export const INPUTS = 13,
  HIDDEN = 32,
  OUTPUTS = ACTION_IDS.length;
const finite = (a) => Array.isArray(a) && a.every(Number.isFinite);
export function featuresFor(d) {
  const id = typeof d.scenario === "string" ? d.scenario : d.scenario.id;
  const n = SCENARIOS.findIndex((s) => s.id === id);
  if (n < 0) throw Error("Unknown neural scenario");
  return [
    ...SCENARIOS.map((_, i) => +(i === n)),
    +!!d.context.urgent,
    +!!d.context.rogue,
    +!!d.context.fatigued,
    (d.agent?.energy ?? 75) / 100,
    (d.agent?.trust ?? 80) / 100,
    Math.max(-1, Math.min(1, (d.agent?.task ?? 0) / 200)),
  ];
}
export function createNeuralPolicy({
  seed = 20261025,
  checkpoint = null,
} = {}) {
  let randomState = seed >>> 0 || 1;
  const random = () =>
    (randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0) /
    4294967296;
  let w1 = Array.from(
    { length: INPUTS * HIDDEN },
    () => (random() - 0.5) * Math.sqrt(6 / INPUTS),
  );
  let b1 = Array(HIDDEN).fill(0),
    w2 = Array.from(
      { length: HIDDEN * OUTPUTS },
      () => (random() - 0.5) * 0.12,
    ),
    b2 = Array(OUTPUTS).fill(0);
  let updates = 0,
    observations = 0,
    loss = 0,
    buffer = [];
  function forward(x) {
    const h = b1.map((b, j) =>
      Math.tanh(b + x.reduce((s, v, i) => s + v * w1[j * INPUTS + i], 0)),
    );
    const q = b2.map(
      (b, k) => b + h.reduce((s, v, j) => s + v * w2[k * HIDDEN + j], 0),
    );
    return { h, q };
  }
  function choose(d, { explore = false } = {}) {
    const ids = optionsFor(
      typeof d.scenario === "string" ? d.scenario : d.scenario.id,
    ).map((a) => a.id);
    if (explore && random() < Math.max(0.08, 0.45 / (1 + observations / 350)))
      return ids[Math.floor(random() * ids.length)];
    const { q } = forward(featuresFor(d));
    return ids.reduce((a, b) =>
      q[ACTION_IDS.indexOf(a)] >= q[ACTION_IDS.indexOf(b)] ? a : b,
    );
  }
  function train(sample) {
    const { x, k, target } = sample,
      { h, q } = forward(x);
    const err = Math.max(-3, Math.min(3, q[k] - target)),
      rate = 0.012;
    const old = w2.slice(k * HIDDEN, (k + 1) * HIDDEN);
    for (let j = 0; j < HIDDEN; j++) {
      w2[k * HIDDEN + j] -= rate * err * h[j];
      const dh = err * old[j] * (1 - h[j] * h[j]);
      b1[j] -= rate * dh;
      for (let i = 0; i < INPUTS; i++) w1[j * INPUTS + i] -= rate * dh * x[i];
    }
    b2[k] -= rate * err;
    updates++;
    loss = updates === 1 ? err * err : 0.98 * loss + 0.02 * err * err;
  }
  function observe(d, action, reward) {
    const k = ACTION_IDS.indexOf(action);
    if (k < 0 || !Number.isFinite(reward))
      throw Error("Invalid training transition");
    buffer.push({
      x: featuresFor(d),
      k,
      target: Math.max(-2, Math.min(1, reward / 100)),
    });
    if (buffer.length > 4096) buffer.shift();
    observations++;
    train(buffer[buffer.length - 1]);
    for (let i = 0; i < 15; i++)
      train(buffer[Math.floor(random() * buffer.length)]);
    return stats();
  }
  function stats() {
    return {
      model: "WorldGuard MLP 13×32×" + OUTPUTS,
      updates,
      observations,
      loss,
      parameters: w1.length + b1.length + w2.length + b2.length,
    };
  }
  function exportCheckpoint() {
    return {
      format: "worldguard-neural-v1",
      seed,
      randomState,
      w1: [...w1],
      b1: [...b1],
      w2: [...w2],
      b2: [...b2],
      updates,
      observations,
      loss,
      buffer: buffer.map((s) => ({ x: [...s.x], k: s.k, target: s.target })),
    };
  }
  function restore(c) {
    if (c?.format !== "worldguard-neural-v1")
      throw Error("Unsupported neural checkpoint");
    for (const [a, size] of [
      [c.w1, INPUTS * HIDDEN],
      [c.b1, HIDDEN],
      [c.w2, HIDDEN * OUTPUTS],
      [c.b2, OUTPUTS],
    ])
      if (!finite(a) || a.length !== size)
        throw Error("Invalid neural weights");
    if (
      !Number.isInteger(c.seed) ||
      !Number.isInteger(c.randomState) ||
      !Number.isInteger(c.observations) ||
      c.observations < 0 ||
      !Number.isInteger(c.updates) ||
      c.updates < 0 ||
      !Number.isFinite(c.loss) ||
      !Array.isArray(c.buffer) ||
      c.buffer.length > 4096
    )
      throw Error("Invalid neural metadata");
    for (const s of c.buffer)
      if (
        !finite(s.x) ||
        s.x.length !== INPUTS ||
        !Number.isInteger(s.k) ||
        s.k < 0 ||
        s.k >= OUTPUTS ||
        !Number.isFinite(s.target)
      )
        throw Error("Invalid neural replay sample");
    seed = c.seed;
    w1 = [...c.w1];
    b1 = [...c.b1];
    w2 = [...c.w2];
    b2 = [...c.b2];
    randomState = c.randomState >>> 0;
    updates = c.updates;
    observations = c.observations;
    loss = c.loss;
    buffer = c.buffer.map((s) => ({ x: [...s.x], k: s.k, target: s.target }));
  }
  if (checkpoint) restore(checkpoint);
  return {
    choose,
    observe,
    stats,
    exportCheckpoint,
    values: (d) => {
      const q = forward(featuresFor(d)).q;
      return optionsFor(
        typeof d.scenario === "string" ? d.scenario : d.scenario.id,
      ).map((a) => ({ ...a, value: q[ACTION_IDS.indexOf(a.id)] * 100 }));
    },
  };
}

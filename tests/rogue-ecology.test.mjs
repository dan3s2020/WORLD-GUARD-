import test from "node:test";
import assert from "node:assert/strict";
import { createRogueEcology, MAX_ROGUES } from "../sim/rogue-ecology.mjs";
import { createSpatialLife } from "../sim/spatial-life.mjs";

test("latent rivals mutate, reproduce, but never vanish from the simulated cities", () => {
  const e = createRogueEcology({ seed: 20, cities: ["eu", "af"] });
  const before = e.residents().filter((r) => r.reservoir);
  for (let i = 0; i < 400; i++) e.progress();
  const after = e.residents().filter((r) => r.reservoir);
  assert.equal(after.length, 2);
  assert.ok(after.every((r) => r.latent));
  assert.ok(after.some((r, i) => JSON.stringify(r.genes) !== JSON.stringify(before[i].genes)));
  assert.ok(e.stats().births > 0);
  assert.ok(e.stats().maxGeneration > 0);
  assert.ok(e.stats().population <= MAX_ROGUES);
});
test("rogue tactics and fitness change following real simulated duel outcomes", () => {
  const e = createRogueEcology({ cities: ["eu"], seed: 41 });
  const a = e.preview("eu", "injection");
  assert.ok(a);
  const prior = e.exportCheckpoint().agents.find((r) => r.id === a.id);
  const d = e.duel(a, "verify", 25);
  assert.ok(["defender", "rogue"].includes(d.winner));
  assert.ok([-34, 15].includes(d.rewardDelta));
  assert.equal(e.stats().encounters, 1);
  assert.notDeepEqual(e.exportCheckpoint().agents.find((r) => r.id === a.id), prior);
  assert.equal(e.preview("eu", "morning"), null);
});
test("dormant rivalry and duels resume exactly after checkpoint restoration", () => {
  const a = createRogueEcology({ seed: 100, cities: ["eu", "af"] });
  for (let i = 0; i < 41; i++) {
    const p = a.preview("eu", "software");
    if (p) a.duel(p, "test_fix", 20);
    a.progress();
  }
  const c = a.exportCheckpoint();
  const b = createRogueEcology({ seed: 100, cities: ["eu", "af"], checkpoint: c });
  assert.deepEqual(b.exportCheckpoint(), c);
  for (let i = 0; i < 35; i++) {
    for (const instance of [a, b]) {
      const p = instance.preview("af", "hospital");
      if (p) instance.duel(p, "repair", 23);
      instance.progress();
    }
  }
  assert.deepEqual(b.exportCheckpoint(), a.exportCheckpoint());
});
test("invalid agent genomes and removal of protected reservoirs fail import", () => {
  const a = createRogueEcology({ seed: 9, cities: ["eu"] });
  const c = a.exportCheckpoint();
  c.agents[0].genes.stealth = NaN;
  assert.throws(() => createRogueEcology({ seed: 9, cities: ["eu"], checkpoint: c }), /rogue agent/i);
  const b = a.exportCheckpoint();
  b.agents[0].latent = false;
  assert.throws(() => createRogueEcology({ seed: 9, cities: ["eu"], checkpoint: b }), /reservoir/i);
});
test("spatial game emits rival duels only after actions and preserves their rewards", () => {
  const r = createSpatialLife({ population: 1 });
  r.act("wake");
  r.act("complete");
  r.prepare();
  for (let i = 0; i < 200 && !r.state().ready; i++) r.advance(0.25, { auto: false });
  assert.equal(r.act("test_fix").ok, true);
  assert.ok(r.state().records.at(-1).duel);
  assert.equal(
    r.state().records.at(-1).reward,
    r.state().records.at(-1).baseReward + r.state().records.at(-1).duel.rewardDelta,
  );
  assert.equal(r.state().rogues.encounters, 2);
  assert.equal(r.state().frames.at(-1).event.duel.id, r.state().records.at(-1).duel.id);
});
test("spatial checkpoint and replay retain rogue history and deterministic continuation", () => {
  const a = createSpatialLife({ population: 1 });
  a.act("wake");
  a.act("complete");
  a.prepare();
  for (let i = 0; i < 200 && !a.state().ready; i++) a.advance(0.25, { auto: false });
  a.act("test_fix");
  const c = a.exportCheckpoint();
  const b = createSpatialLife({ checkpoint: c });
  assert.deepEqual(b.exportCheckpoint(), c);
  for (let i = 0; i < 35; i++) {
    a.advance(0.25, { auto: false });
    b.advance(0.25, { auto: false });
  }
  assert.deepEqual(b.exportCheckpoint(), a.exportCheckpoint());
  assert.equal(a.frame(0).rogues.encounters, 0);
});
test("legacy spatial checkpoints without rivals remain loadable", () => {
  const r = createSpatialLife({ population: 1 });
  const c = r.exportCheckpoint();
  delete c.rogueEcology;
  const restored = createSpatialLife({ checkpoint: c });
  assert.equal(restored.state().rogues.population, 12);
  assert.equal(restored.state().rogues.dormant, 6);
});

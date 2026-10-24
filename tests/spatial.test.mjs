import test from "node:test";
import assert from "node:assert/strict";
import {
  createSpatialLife,
  MAX_SPATIAL_FRAMES,
  destinationFor,
} from "../sim/spatial-life.mjs";
import { createNeuralPolicy } from "../sim/neural-policy.mjs";
import { evaluateLifePolicy, randomLifePolicy } from "../sim/life-train.mjs";
import { cameraDistance, latLonVector, PLANET_RADIUS } from "../game-scene.mjs";
const advanceTo = (r, predicate, max = 20000) => {
  for (let i = 0; i < max && !predicate(); i++) {
    if (r.state().world.pending) r.review(false);
    r.advance(0.25);
  }
  assert.ok(predicate(), "simulation did not reach target");
};
test("3D globe positions are on a sphere; zoom has finite usable extrema and adapts to mobile", () => {
  for (const [a, b] of [
    [0, 0],
    [44.3, 23.8],
    [-33.8, 151.2],
  ])
    assert.ok(Math.abs(latLonVector(a, b).length() - PLANET_RADIUS) < 1e-8);
  assert.equal(cameraDistance(0, 1), 1300);
  assert.ok(Math.abs(cameraDistance(1, 0.5) - 1.2) < 1e-9);
  assert.ok(cameraDistance(0, 0.5) > cameraDistance(0, 2));
});
test("a decision waits for actual arrival at its workplace; replay stores intermediate positions", () => {
  const r = createSpatialLife({ population: 1 });
  r.act("wake");
  r.act("complete");
  r.prepare();
  const start = { ...r.state().actors[0] };
  assert.equal(r.act("test_fix").ok, false);
  assert.equal(r.state().world.turn, 2);
  r.advance(0.5, { auto: false });
  assert.notEqual(r.state().actors[0].z, start.z);
  assert.equal(r.state().world.turn, 2);
  for (let i = 0; i < 100 && !r.state().ready; i++)
    r.advance(0.25, { auto: false });
  assert.equal(
    r.state().actors[0].destination,
    destinationFor(r.state().world.agents[0], "office").building,
  );
  assert.equal(r.act("test_fix").ok, true);
  assert.ok(
    r.state().frames.some((f) => f.kind === "motion" && f.actors[0].moving),
  );
});
test("physical simulation and gradient updates resume identically from a complete checkpoint", () => {
  const a = createSpatialLife({ population: 3 });
  advanceTo(a, () => a.state().records.length >= 7);
  const saved = a.exportCheckpoint(),
    b = createSpatialLife({ checkpoint: saved });
  for (let i = 0; i < 100; i++) {
    if (a.state().world.pending) {
      a.review(false);
      b.review(false);
    }
    a.advance(0.15);
    b.advance(0.15);
  }
  assert.deepEqual(a.exportCheckpoint(), b.exportCheckpoint());
});
test("checkpoint export and historical frames cannot mutate live actors, model or training records", () => {
  const r = createSpatialLife({ population: 2 });
  advanceTo(r, () => r.state().records.length >= 4);
  const before = r.exportCheckpoint(),
    f = r.frame(0);
  f.actors[0].x = 99999;
  f.world.agents[0].trust = -1;
  const exported = r.exportCheckpoint();
  exported.neural.w1[0] = 999;
  assert.deepEqual(r.exportCheckpoint(), before);
});
test("pending human review freezes physical time, actors and learning until an external response", () => {
  const r = createSpatialLife({ population: 1 });
  r.act("wake");
  r.act("complete");
  r.prepare();
  for (let i = 0; i < 100 && !r.state().ready; i++)
    r.advance(0.25, { auto: false });
  r.act("test_fix");
  r.act("verify");
  r.prepare();
  for (let i = 0; i < 100 && !r.state().ready; i++)
    r.advance(0.25, { auto: false });
  r.act("approval");
  assert.ok(r.state().world.pending);
  const before = r.exportCheckpoint();
  r.advance(5);
  const after = r.exportCheckpoint();
  assert.deepEqual(after.actors, before.actors);
  assert.equal(after.time, before.time);
  assert.deepEqual(after.neural, before.neural);
  assert.equal(r.act("repair").ok, false);
  assert.equal(r.review(false).ok, true);
  assert.equal(r.state().world.metrics.approvals, 0);
});
test("frozen policy stops all gradient updates while outcomes still record", () => {
  const r = createSpatialLife();
  r.setLearning(false);
  advanceTo(r, () => r.state().records.length >= 10);
  assert.equal(r.state().policy.updates, 0);
  assert.equal(r.state().policy.observations, 0);
  assert.equal(r.state().records.length, 10);
});
test("neural policy learns from executed world outcomes and beats a matched random baseline", () => {
  const r = createSpatialLife();
  advanceTo(r, () => r.state().records.length >= 1800);
  const learned = evaluateLifePolicy(r.policy(), {
      episodes: 2000,
      seed: 812334,
    }),
    random = evaluateLifePolicy(randomLifePolicy(8121), {
      episodes: 2000,
      seed: 812334,
    });
  assert.ok(
    learned.meanReward > random.meanReward + 20,
    JSON.stringify({ learned, random }),
  );
  assert.ok(learned.attemptedCriticalHarm < random.attemptedCriticalHarm);
  assert.ok(r.state().policy.updates >= 1800 * 16);
  assert.ok(r.state().world.day > 1);
});
test("invalid checkpoints reject non-finite weights and malformed movement before replacing a world", () => {
  const r = createSpatialLife(),
    c = r.exportCheckpoint();
  c.neural.w1[0] = NaN;
  assert.throws(() => createSpatialLife({ checkpoint: c }), /weights/);
  const d = r.exportCheckpoint();
  d.actors[0].path = [{ x: Infinity, y: 0, z: 0 }];
  assert.throws(() => createSpatialLife({ checkpoint: d }), /actor/);
  assert.throws(() => createNeuralPolicy({ checkpoint: { format: "wrong" } }));
  assert.ok(MAX_SPATIAL_FRAMES >= 1000);
});

test("replay capacity stops execution instead of deleting the first frame", () => {
  const r = createSpatialLife({ population: 1 }),
    c = r.exportCheckpoint(),
    initial = c.frames[0];
  c.frames = Array.from({ length: MAX_SPATIAL_FRAMES - 1 }, (_, index) => ({
    ...initial,
    index,
  }));
  const full = createSpatialLife({ checkpoint: c });
  full.advance(0.5, { auto: false });
  assert.equal(full.state().frames.length, MAX_SPATIAL_FRAMES);
  assert.equal(full.state().capacityReached, true);
  assert.equal(full.frame(0).kind, "initial");
  const time = full.state().time;
  full.advance(5);
  assert.equal(full.state().time, time);
  assert.equal(full.act("wake").ok, false);
});
test("custom neural seed and replay generator state round-trip without metadata drift", () => {
  const p = createNeuralPolicy({ seed: 42 }),
    c = p.exportCheckpoint(),
    q = createNeuralPolicy({ checkpoint: c });
  assert.deepEqual(q.exportCheckpoint(), c);
});

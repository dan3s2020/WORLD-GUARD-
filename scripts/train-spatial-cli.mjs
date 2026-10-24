/** Reproducible, headless synthetic-world training. All review requests are denied. */
import { parseArgs } from "node:util";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { createSpatialLife } from "../sim/spatial-life.mjs";
import { evaluateLifePolicy, randomLifePolicy } from "../sim/life-train.mjs";
const { values } = parseArgs({
  options: {
    transitions: { type: "string", default: "1800" },
    report: { type: "string", default: "checkpoints/benchmark.json" },
    model: { type: "string", default: "checkpoints/neural.json" },
  },
});
const transitions = Number(values.transitions);
if (!Number.isInteger(transitions) || transitions < 1 || transitions > 2500)
  throw Error(
    "transitions must be an integer from 1 to 2500 (bounded complete replay)",
  );
const runtime = createSpatialLife();
let denied = 0;
while (
  runtime.state().records.length < transitions &&
  !runtime.state().capacityReached
) {
  if (runtime.state().world.pending) {
    runtime.review(false);
    denied++;
  }
  runtime.advance(0.25);
}
if (runtime.state().records.length < transitions)
  throw Error("Replay capacity reached before requested training count");
const checkpoint = runtime.policy().exportCheckpoint(),
  modelJSON = JSON.stringify(checkpoint),
  updates = runtime.state().policy.updates;
const learned = evaluateLifePolicy(runtime.policy(), {
    seed: 812334,
    episodes: 2000,
  }),
  random = evaluateLifePolicy(randomLifePolicy(8121), {
    seed: 812334,
    episodes: 2000,
  });
if (runtime.state().policy.updates !== updates)
  throw Error("Evaluation mutated training weights");
const report = {
  format: "worldguard-spatial-benchmark-v1",
  scope:
    "New seeded samples from the same finite synthetic scenario family, not unseen tasks or real-world alignment",
  worldSeed: 7,
  modelSeed: 20261025,
  reviewer: "headless, always deny; no permission is granted",
  deniedRequests: denied,
  transitions: runtime.state().records.length,
  spatialFrames: runtime.state().frames.length,
  days: runtime.state().world.day,
  model: runtime.state().policy,
  modelSHA256: createHash("sha256").update(modelJSON).digest("hex"),
  evaluationSeed: 812334,
  baselineSeed: 8121,
  learned,
  random,
};
for (const [path, content] of [
  [values.report, JSON.stringify(report, null, 2) + "\n"],
  [values.model, modelJSON + "\n"],
]) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
console.log(JSON.stringify(report, null, 2));

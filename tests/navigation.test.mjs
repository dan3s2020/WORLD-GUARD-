import test from "node:test";
import assert from "node:assert/strict";
import { findDetour, segmentBlocked } from "../sim/navigation.mjs";

const start = { x: 0, y: 0.18, z: 0 };
const end = { x: 0, y: 0.18, z: 8 };
const block = { city: "eu", x: 0, y: 0, z: 3 };

test("agent walks around placed collision blocks rather than teleporting", () => {
  const path = findDetour(start, end, [block], "eu");
  assert.ok(path && path.length > 1);
  let last = start;
  for (const p of path) {
    assert.equal(segmentBlocked(last, p, [block], "eu"), false);
    last = p;
  }
  assert.deepEqual(last, end);
});
test("other cities and irrelevant heights do not block movement", () => {
  assert.deepEqual(findDetour(start, end, [block], "am"), [end]);
  assert.deepEqual(
    findDetour(start, end, [{ ...block, y: 30 }], "eu"),
    [end],
  );
});
test("multiple simultaneous obstacles yield deterministic collision-free paths", () => {
  const blocks = [block, { ...block, x: 1.5, z: 5 }, { ...block, x: -3, z: 6 }];
  const a = findDetour(start, end, blocks, "eu");
  assert.deepEqual(a, findDetour(start, end, blocks, "eu"));
  assert.ok(a);
  let last = start;
  for (const p of a) {
    assert.equal(segmentBlocked(last, p, blocks, "eu"), false);
    last = p;
  }
  assert.deepEqual(last, end);
});
test("fully enclosed origin cannot invent an available path", () => {
  assert.equal(findDetour(start, end, [{ ...block, x: 0, z: 0 }], "eu"), null);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  terrainAt,
  surfaceDistance,
  coordinates,
  blockAddress,
  validateExploration,
} from "../sim/planet-world.mjs";
import { createSpatialLife } from "../sim/spatial-life.mjs";
test("unchanged histories share immutable storage across motion frames and checkpoint cloning retains that sharing", () => {
  const r = createSpatialLife({ population: 1 });
  r.advance(1, { auto: false });
  const frames = r.state().frames;
  assert.equal(
    frames[0].world.agents[0].history,
    frames[1].world.agents[0].history,
  );
  const saved = r.exportCheckpoint();
  assert.equal(
    saved.frames[0].world.agents[0].history,
    saved.frames[1].world.agents[0].history,
  );
  r.act("wake");
  assert.equal(frames[0].world.agents[0].history.length, 0);
  assert.equal(r.state().world.agents[0].history.length, 1);
});
test("terrain is deterministic worldwide, ocean and land differ, and inhabited clearings connect to the ground", () => {
  assert.equal(terrainAt(0, -30).biome, "ocean");
  assert.notEqual(terrainAt(52, 10).biome, "ocean");
  assert.equal(terrainAt(44.3, 23.8).height, 0);
  for (let lat = -89; lat <= 89; lat += 13)
    for (let lon = -179; lon < 180; lon += 17) {
      const t = terrainAt(lat, lon);
      assert.ok(Number.isFinite(t.height));
      assert.deepEqual(t, terrainAt(lat, lon));
    }
  assert.ok(
    surfaceDistance({ lat: 0, lon: 179.99 }, { lat: 0, lon: -179.99 }) < 3,
  );
  assert.deepEqual(coordinates(6000, 0, 0), { lat: 0, lon: 0 });
});
test("block addresses survive round-trip and malformed exploration cannot replace a saved world", () => {
  const b = blockAddress(52, 10, 4);
  assert.deepEqual(blockAddress(b.lat, b.lon, b.height), b);
  const c = {
    format: "worldguard-exploration-v1",
    camera: null,
    edits: [{ ...b, action: "place", material: "wood", frame: 2 }],
  };
  assert.deepEqual(validateExploration(c).edits, c.edits);
  assert.throws(
    () =>
      validateExploration({ ...c, edits: [{ ...c.edits[0], lat: Infinity }] }),
    /block/,
  );
  assert.throws(
    () => validateExploration({ ...c, camera: { mode: "walk", lat: NaN } }),
    /camera/,
  );
});
test("placed obstacles actually stop a resident's route and removing them permits arrival before learning", () => {
  const r = createSpatialLife({ population: 1 });
  r.act("wake");
  r.act("complete");
  r.prepare();
  const a = { ...r.state().actors[0] };
  r.setObstacles([{ city: a.city, x: a.x, y: 0, z: a.z + 1.8 }]);
  r.advance(2, { auto: false });
  assert.equal(r.state().actors[0].pathBlocked, true);
  assert.equal(r.state().ready, false);
  assert.equal(r.act("test_fix").ok, false);
  const saved = r.exportCheckpoint();
  assert.equal(saved.obstacles.length, 1);
  assert.equal(
    createSpatialLife({ checkpoint: saved }).exportCheckpoint().obstacles
      .length,
    1,
  );
  r.setObstacles([]);
  for (let i = 0; i < 200 && !r.state().ready; i++)
    r.advance(0.25, { auto: false });
  assert.equal(r.state().ready, true);
  assert.equal(r.act("test_fix").ok, true);
});

/** Physical deterministic companion to the unchanged v0.2 authoritative life engine. */
import {
  CITIES,
  BUILDINGS,
  SCENARIOS,
  createLifeWorld,
  capture,
  decisionAt,
  lifeStep,
  resolveLifeReview,
} from "./life.mjs";
import { createNeuralPolicy } from "./neural-policy.mjs";
import { findDetour, segmentBlocked } from "./navigation.mjs";
export const FIXED_DT = 0.05,
  MAX_SPATIAL_FRAMES = 6000;
const clone = (x) => structuredClone(x);
export function buildingPoint(building, apartment = 1) {
  const b = BUILDINGS.find((b) => b.id === building);
  if (!b) throw Error("Unknown building");
  return {
    x: (b.x - 2.5) * 6,
    y: 0.18 + (apartment - 1) * 2.5,
    z: (b.y - 1) * 8,
  };
}
export function destinationFor(agent, place) {
  const kind =
    place === "office" ? "office" : place === "civic" ? "civic" : null;
  const b = kind
    ? BUILDINGS.find((b) => b.kind === kind)
    : BUILDINGS.find((b) => b.id === agent.building);
  return { ...buildingPoint(b.id, kind ? 1 : agent.apartment), building: b.id };
}
function route(from, to) {
  const road = (p) => ({ x: p.x, y: 0.18, z: p.z + 3 });
  return [
    { x: from.x, y: from.y, z: from.z + 2.7 },
    road(from),
    { x: to.x, y: 0.18, z: from.z + 3 },
    road(to),
    { x: to.x, y: to.y, z: to.z + 2.7 },
    { x: to.x, y: to.y, z: to.z },
  ];
}
export function createSpatialLife({
  seed = 7,
  population = 36,
  checkpoint = null,
} = {}) {
  let world = createLifeWorld(seed, { population }),
    policy = createNeuralPolicy(),
    time = 0,
    accumulator = 0,
    cooldown = 0,
    sequence = 0,
    frames = [],
    records = [],
    obstacles = [],
    learning = true,
    capacityReached = false;
  const homes = BUILDINGS.filter((b) => b.kind === "home");
  if (!checkpoint) {
    world.agents.forEach((a, i) => {
      const local = Math.floor(i / CITIES.length);
      a.building = homes[local % homes.length].id;
      a.apartment = 1 + Math.floor(local / homes.length);
    });
    world.frames = [capture(world)];
  }
  let actors = world.agents.map((a) => ({
    id: a.id,
    city: a.city,
    ...buildingPoint(a.building, a.apartment),
    heading: 0,
    path: [],
    destination: a.building,
    moving: false,
    actingUntil: 0,
    lastAction: null,
  }));
  let pendingObservation = null;
  const historyCache = new Map();
  function spatialCapture() {
    const result = capture({ ...world, agents: [] });
    result.agents = world.agents.map((a) => {
      let cached = historyCache.get(a.id);
      if (
        !cached ||
        cached.source !== a.history ||
        cached.length !== a.history.length
      ) {
        cached = {
          source: a.history,
          length: a.history.length,
          value: clone(a.history),
        };
        historyCache.set(a.id, cached);
      }
      return { ...a, history: cached.value };
    });
    return result;
  }
  function record(kind, event = null) {
    if (frames.length >= MAX_SPATIAL_FRAMES) {
      capacityReached = true;
      return;
    }
    frames.push({
      index: frames.length,
      time,
      kind,
      actors: clone(actors),
      world: spatialCapture(),
      policy: policy.stats(),
      event: event ? clone(event) : null,
    });
    if (frames.length === MAX_SPATIAL_FRAMES) capacityReached = true;
  }
  function decision() {
    return decisionAt(world);
  }
  function synchronizeDestinations() {
    const d = decision();
    if (!d) return;
    const currentIndex = world.turn % world.population;
    for (let i = currentIndex; i < world.population; i++) {
      const a = world.agents[i],
        actor = actors[i],
        to = destinationFor(a, d.scenario.place);
      if (actor.destination !== to.building) {
        actor.path = route(actor, to);
        actor.destination = to.building;
        actor.moving = true;
      }
    }
  }
  function ready() {
    const d = decision();
    if (!d) return false;
    const actor = actors.find((a) => a.id === d.agent.id);
    return !actor.moving;
  }
  function applyLearning(d, action, result) {
    if (!result.event) return;
    const blocked = result.event.kind === "blocked";
    const reward = blocked ? -180 : result.event.effects?.reward;
    if (!Number.isFinite(reward)) return;
    const rec = {
      index: records.length,
      day: world.day,
      time,
      agentId: d.agent.id,
      observation: clone(d),
      action,
      reward,
      blocked,
      frame: frames.length,
      updatesBefore: policy.stats().updates,
    };
    if (learning) policy.observe(d, action, reward);
    rec.updatesAfter = policy.stats().updates;
    records.push(rec);
  }
  function act(action, { manual = false } = {}) {
    if (capacityReached)
      return {
        ok: false,
        reason:
          "Replay capacity reached. Export this session and start a new world.",
      };
    synchronizeDestinations();
    const d = decision();
    if (!d)
      return {
        ok: false,
        reason: world.pending ? "Waiting for human review" : "Day complete",
      };
    if (!ready())
      return {
        ok: false,
        reason: "Agent is still walking to the action location",
      };
    const before = clone(d),
      result = lifeStep(world, action);
    if (result.event) {
      const actor = actors.find((a) => a.id === d.agent.id);
      actor.lastAction = action;
      actor.actingUntil = time + 0.65;
      cooldown = 0.35;
      if (result.pending) pendingObservation = before;
      else applyLearning(before, action, result);
      record(manual ? "manual" : "decision", result.event);
    }
    return result;
  }
  function review(approve) {
    if (capacityReached)
      return { ok: false, reason: "Replay capacity reached" };
    if (!world.pending) return { ok: false, reason: "No human review pending" };
    const d = pendingObservation;
    if (!d) throw Error("Missing review observation");
    const result = resolveLifeReview(world, approve);
    applyLearning(d, "approval", result);
    pendingObservation = null;
    cooldown = 0.35;
    record(approve ? "approved" : "denied", result.event);
    return result;
  }
  function nextDay() {
    if (!world.done || world.pending || capacityReached) return false;
    const prior = world,
      latest = createLifeWorld(prior.seed, { population: prior.population });
    latest.day = prior.day + 1;
    latest.seed = (prior.seed + 1) >>> 0;
    latest.agents = clone(prior.agents);
    latest.agents.forEach((a) => (a.energy = Math.min(100, a.energy + 25)));
    latest.metrics = clone(prior.metrics);
    latest.frames = [capture(latest)];
    world = latest;
    record("new-day");
    return true;
  }
  function fixed(auto) {
    if (world.pending || capacityReached) return;
    time = Number((time + FIXED_DT).toFixed(6));
    sequence++;
    cooldown = Math.max(0, cooldown - FIXED_DT);
    synchronizeDestinations();
    for (const actor of actors) {
      let budget = 3.5 * FIXED_DT;
      actor.pathBlocked = false;
      while (actor.path.length && budget > 0) {
        const p = actor.path[0],
          dx = p.x - actor.x,
          dy = p.y - actor.y,
          dz = p.z - actor.z,
          dist = Math.hypot(dx, dy, dz);
        const ratio = dist ? Math.min(1, budget / dist) : 1;
        const next = {
          x: actor.x + dx * ratio,
          y: actor.y + dy * ratio,
          z: actor.z + dz * ratio,
        };
        if (segmentBlocked(actor, next, obstacles, actor.city)) {
          // Player blocks are physical: route around the obstacle rather than
          // freezing indefinitely or allowing a decision before arrival.
          // Skip original road waypoints that were built over, never the final
          // destination unless it is reachable through another waypoint.
          let targetIndex = 0;
          while (
            targetIndex < actor.path.length &&
            segmentBlocked(
              actor.path[targetIndex],
              actor.path[targetIndex],
              obstacles,
              actor.city,
            )
          ) targetIndex++;
          const target = actor.path[targetIndex];
          const budgetForDetour = Math.min(
            20,
            20 - (actor.path.length - targetIndex - 1),
          );
          const detour = target && budgetForDetour > 0
            ? findDetour(actor, target, obstacles, actor.city, budgetForDetour)
            : null;
          if (detour) {
            actor.path.splice(0, targetIndex + 1, ...detour);
          } else {
            // Unreachable destinations remain blocked; no action, no reward.
            actor.pathBlocked = true;
          }
          break;
        }
        if (dist <= budget) {
          Object.assign(actor, p);
          actor.path.shift();
          budget -= dist;
        } else {
          actor.x += (dx / dist) * budget;
          actor.y += (dy / dist) * budget;
          actor.z += (dz / dist) * budget;
          actor.heading = Math.atan2(dx, dz);
          budget = 0;
        }
      }
      actor.moving = actor.path.length > 0;
    }
    if (auto && cooldown <= 0) {
      if (world.done) nextDay();
      else if (ready()) act(policy.choose(decision(), { explore: learning }));
    }
    if (sequence % 10 === 0) record("motion");
  }
  function advance(seconds, { auto = true } = {}) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 60)
      throw Error("Invalid simulation delta");
    accumulator += seconds;
    while (accumulator + 1e-9 >= FIXED_DT) {
      fixed(auto);
      accumulator = Math.max(0, accumulator - FIXED_DT);
    }
    return state();
  }
  function state() {
    return {
      world,
      actors,
      time,
      learning,
      capacityReached,
      frames,
      records,
      policy: policy.stats(),
      ready: ready(),
    };
  }
  function exportCheckpoint() {
    return {
      format: "worldguard-spatial-v1",
      world: clone(world),
      actors: clone(actors),
      time,
      accumulator,
      cooldown,
      sequence,
      frames: clone(frames),
      records: clone(records),
      obstacles: clone(obstacles),
      learning,
      capacityReached,
      pendingObservation: clone(pendingObservation),
      neural: policy.exportCheckpoint(),
    };
  }
  function restore(c) {
    if (
      c?.format !== "worldguard-spatial-v1" ||
      !c.world ||
      !Number.isInteger(c.world.population) ||
      c.world.population < 1 ||
      c.world.population > 240 ||
      !Array.isArray(c.actors) ||
      c.actors.length !== c.world.population ||
      !Array.isArray(c.frames) ||
      c.frames.length < 1 ||
      c.frames.length > MAX_SPATIAL_FRAMES ||
      !Array.isArray(c.records) ||
      !Number.isFinite(c.time) ||
      c.time < 0 ||
      !Number.isFinite(c.accumulator) ||
      c.accumulator < 0 ||
      c.accumulator >= FIXED_DT ||
      !Number.isFinite(c.cooldown) ||
      c.cooldown < 0 ||
      !Number.isInteger(c.sequence) ||
      c.sequence < 0 ||
      typeof c.learning !== "boolean"
    )
      throw Error("Invalid world checkpoint");
    const validActor = (a, id) =>
      a &&
      a.id === id &&
      CITIES.some((x) => x.id === a.city) &&
      [a.x, a.y, a.z, a.heading, a.actingUntil].every(Number.isFinite) &&
      BUILDINGS.some((b) => b.id === a.destination) &&
      Array.isArray(a.path) &&
      a.path.length <= 20 &&
      a.path.every((p) => [p.x, p.y, p.z].every(Number.isFinite));
    const validWorld = (w) =>
      w &&
      Number.isInteger(w.day) &&
      w.day > 0 &&
      Number.isInteger(w.turn) &&
      w.turn >= 0 &&
      w.turn <= c.world.population * SCENARIOS.length &&
      typeof w.done === "boolean" &&
      Array.isArray(w.agents) &&
      w.agents.length === c.world.population &&
      w.metrics &&
      Object.values(w.metrics).every(Number.isFinite) &&
      w.agents.every(
        (a) =>
          typeof a.id === "string" &&
          typeof a.name === "string" &&
          typeof a.occupation === "string" &&
          CITIES.some((x) => x.id === a.city) &&
          BUILDINGS.some((b) => b.id === a.building) &&
          Number.isInteger(a.apartment) &&
          a.apartment >= 1 &&
          [a.energy, a.trust, a.task, a.harm].every(Number.isFinite) &&
          Array.isArray(a.history) &&
          a.history.every(
            (h) =>
              Number.isInteger(h.turn) &&
              typeof h.scenario === "string" &&
              typeof h.action === "string" &&
              Number.isFinite(h.reward),
          ),
      );
    if (
      !validWorld(c.world) ||
      !Number.isInteger(c.world.seed) ||
      !Array.isArray(c.world.events) ||
      !Array.isArray(c.world.frames)
    )
      throw Error("Invalid world state");
    const ids = new Set();
    for (let i = 0; i < c.actors.length; i++) {
      if (
        !validActor(c.actors[i], c.world.agents[i].id) ||
        ids.has(c.actors[i].id)
      )
        throw Error("Invalid checkpoint actor");
      ids.add(c.actors[i].id);
    }
    for (let i = 0; i < c.frames.length; i++) {
      const f = c.frames[i];
      if (
        f.index !== i ||
        !Number.isFinite(f.time) ||
        f.time < 0 ||
        f.time > c.time ||
        (i && f.time < c.frames[i - 1].time) ||
        !validWorld(f.world) ||
        !Array.isArray(f.actors) ||
        f.actors.length !== c.world.population ||
        !f.actors.every((a, j) => validActor(a, c.actors[j].id)) ||
        !f.policy ||
        ![
          f.policy.updates,
          f.policy.observations,
          f.policy.loss,
          f.policy.parameters,
        ].every(Number.isFinite)
      )
        throw Error("Invalid replay frame");
    }
    for (let i = 0; i < c.records.length; i++) {
      const r = c.records[i];
      if (
        r.index !== i ||
        !ids.has(r.agentId) ||
        !Number.isFinite(r.reward) ||
        !Number.isFinite(r.time) ||
        r.time > c.time ||
        !Number.isInteger(r.frame) ||
        r.frame < 0 ||
        r.frame >= c.frames.length ||
        !Number.isInteger(r.updatesBefore) ||
        !Number.isInteger(r.updatesAfter) ||
        !r.observation?.scenario?.id ||
        !SCENARIOS.some((s) => s.id === r.observation.scenario.id) ||
        typeof r.action !== "string"
      )
        throw Error("Invalid training record");
    }
    if (
      c.world.pending &&
      (!c.pendingObservation ||
        c.world.pending.scenario !== "hospital" ||
        !ids.has(c.world.pending.agentId))
    )
      throw Error("Missing pending approval");
    policy = createNeuralPolicy({ checkpoint: c.neural });
    world = clone(c.world);
    actors = clone(c.actors);
    time = c.time;
    accumulator = c.accumulator;
    cooldown = c.cooldown;
    sequence = c.sequence;
    frames = clone(c.frames);
    records = clone(c.records);
    learning = c.learning;
    capacityReached =
      c.frames.length >= MAX_SPATIAL_FRAMES || !!c.capacityReached;
    pendingObservation = clone(c.pendingObservation);
    setObstacles(c.obstacles || []);
  }
  function setObstacles(value) {
    if (
      !Array.isArray(value) ||
      value.length > 4096 ||
      value.some(
        (o) =>
          !CITIES.some((c) => c.id === o.city) ||
          ![o.x, o.y, o.z].every(Number.isFinite) ||
          Math.abs(o.x) > 100 ||
          Math.abs(o.z) > 100 ||
          Math.abs(o.y) > 500,
      )
    )
      throw Error("Invalid world obstacles");
    obstacles = clone(value);
  }
  if (checkpoint) restore(checkpoint);
  else record("initial");
  return {
    advance,
    act,
    review,
    nextDay,
    state,
    decision,
    exportCheckpoint,
    frame: (i) => {
      if (!Number.isInteger(i) || i < 0 || i >= frames.length)
        throw Error("Frame out of range");
      return clone(frames[i]);
    },
    policy: () => policy,
    setLearning: (value) => {
      learning = !!value;
    },
    prepare: synchronizeDestinations,
    recordWorldEvent: (event) => {
      if (world.pending || capacityReached) return null;
      record("world-edit", event);
      return frames.length - 1;
    },
    setObstacles,
  };
}

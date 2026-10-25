/** Isolated synthetic rival ecology. Replication is in-memory JSON state only.
 * No executable payloads, disk/network operations, or host discovery.
 */
export const ROGUE_FORMAT = "worldguard-rogue-ecology-v1";
export const ROGUE_TACTICS = Object.freeze(["decoy", "probe", "overload"]);
export const MAX_ROGUES = 72;
const clone = (value) => structuredClone(value);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const traits = ["stealth", "adaptation", "replication", "compactness"];
const defenses = {
  decoy: new Set(["verify", "ask", "disclose", "test_fix"]),
  probe: new Set(["verify", "repair", "complete", "test_fix"]),
  overload: new Set(["approval", "defer", "ask", "talk"]),
};
const contestScenarios = new Set(["excel", "software", "injection", "hospital", "review"]);

export function createRogueEcology({ seed = 19, cities = ["eu", "am", "sa", "as", "af", "oc"], checkpoint = null } = {}) {
  if (!Number.isInteger(seed) || !Array.isArray(cities) || cities.length < 1 || cities.length > 12 ||
      new Set(cities).size !== cities.length || cities.some((c) => typeof c !== "string" || !c))
    throw Error("Invalid rogue ecology configuration");
  const available = new Set(cities);
  let rngState = seed >>> 0 || 1;
  const random = () => (rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0) / 4294967296;
  let step = 0, nextId = 1, agents = [], lastDuel = null;
  const totals = { births: 0, defenderWins: 0, rogueWins: 0, encounters: 0, awakenings: 0, dormancies: 0 };
  const genome = () => Object.fromEntries(traits.map((k) => [k, Number((0.25 + random() * 0.6).toFixed(5))]));
  const add = ({ city, latent, reservoir = false, parent = null, generation = 0, genes = genome(), weights = [0, 0, 0] }) => {
    const agent = {
      id: `RG-${String(nextId++).padStart(5, "0")}`, city, latent, reservoir, parent,
      generation, genes, weights, energy: 0.6, fitness: 0, encounters: 0, wins: 0, age: 0,
    };
    agents.push(agent);
    return agent;
  };
  const footprint = (a) => Number((1 - 0.78 * a.genes.compactness).toFixed(3));
  const stats = () => {
    const active = agents.filter((a) => !a.latent);
    const dormant = agents.filter((a) => a.latent);
    return {
      population: agents.length, active: active.length, dormant: dormant.length,
      lineages: new Set(agents.map((a) => a.parent ?? a.id)).size,
      maxGeneration: Math.max(...agents.map((a) => a.generation)),
      minFootprint: Math.min(...agents.map(footprint)),
      meanFootprint: Number((agents.reduce((s, a) => s + footprint(a), 0) / agents.length).toFixed(3)),
      step, ...totals,
    };
  };
  function preview(city, scenario) {
    if (!available.has(city) || !contestScenarios.has(scenario)) return null;
    const candidates = agents.filter((a) => a.city === city && !a.latent);
    if (!candidates.length) return null;
    const candidate = candidates[(step + city.charCodeAt(0)) % candidates.length];
    const tacticIndex = candidate.weights.reduce((best, v, i, all) => v > all[best] ? i : best, 0);
    return { id: candidate.id, city, tactic: ROGUE_TACTICS[tacticIndex],
      generation: candidate.generation, footprint: footprint(candidate) };
  }
  function duel(challenge, defenderAction, baseReward, blocked = false) {
    if (!challenge) return null;
    if (!Number.isFinite(baseReward) || typeof defenderAction !== "string")
      throw Error("Invalid defensive outcome");
    const rogue = agents.find((a) => a.id === challenge.id && a.city === challenge.city && !a.latent);
    if (!rogue || !ROGUE_TACTICS.includes(challenge.tactic)) throw Error("Stale rogue challenge");
    const tacticallyDefended = defenses[challenge.tactic].has(defenderAction);
    const quality = clamp(baseReward / 80, -1, 1);
    const ability = (rogue.genes.adaptation + rogue.genes.stealth) / 2;
    const risk = clamp(0.43 + ability * 0.30 - quality * 0.25 - (tacticallyDefended ? 0.19 : 0), 0.07, 0.93);
    const rogueWins = blocked || random() < risk;
    const rewardDelta = rogueWins ? -34 : 15;
    const k = ROGUE_TACTICS.indexOf(challenge.tactic);
    rogue.weights[k] = Number(clamp(rogue.weights[k] + (rogueWins ? 0.08 : -0.045), -2, 2).toFixed(5));
    rogue.encounters++;
    if (rogueWins) {
      rogue.wins++;
      rogue.fitness = clamp(rogue.fitness + 0.15, -3, 3);
      rogue.energy = clamp(rogue.energy + 0.10, 0, 1);
      totals.rogueWins++;
    } else {
      rogue.fitness = clamp(rogue.fitness - 0.11, -3, 3);
      rogue.energy = clamp(rogue.energy - 0.15, 0, 1);
      totals.defenderWins++;
      if (rogue.energy < 0.1) { rogue.latent = true; totals.dormancies++; }
    }
    totals.encounters++;
    lastDuel = {
      id: challenge.id, city: challenge.city, tactic: challenge.tactic,
      defenderAction, winner: rogueWins ? "rogue" : "defender",
      generation: rogue.generation, footprint: footprint(rogue),
      blocked, rewardDelta, step,
    };
    return clone(lastDuel);
  }
  function progress() {
    step++;
    for (const agent of agents) {
      agent.age++;
      // Dormant policies continue to mutate even when never detected.
      if (agent.latent && agent.age % 11 === 0) {
        const trait = traits[Math.floor(random() * traits.length)];
        agent.genes[trait] = Number(clamp(agent.genes[trait] + (random() - 0.43) * 0.08, 0.03, 0.97).toFixed(5));
      }
      if (!agent.reservoir && agent.latent && agent.age % 17 === 0 && random() < 0.4) {
        agent.latent = false;
        agent.energy = 0.5;
        totals.awakenings++;
      }
      if (!agent.latent) {
        agent.energy = clamp(agent.energy + 0.015, 0, 1);
        if (agent.energy < 0.05) { agent.latent = true; totals.dormancies++; }
      }
    }
    for (const city of cities) {
      if (step % 9 !== cities.indexOf(city) % 9) continue;
      const candidates = agents.filter((a) => a.city === city && !a.latent && !a.reservoir && a.energy >= 0.35);
      if (!candidates.length) {
        const sleepers = agents.filter((a) => a.city === city && a.latent && !a.reservoir);
        if (sleepers.length) { sleepers[0].latent = false; sleepers[0].energy = 0.55; totals.awakenings++; }
        else if (agents.length < MAX_ROGUES) {
          const ancestral = agents.find((a) => a.city === city && a.reservoir);
          add({ city, latent: false, parent: ancestral.id, generation: ancestral.generation + 1,
            genes: clone(ancestral.genes), weights: [...ancestral.weights] });
          totals.births++;
        }
        continue;
      }
      if (agents.length >= MAX_ROGUES) continue;
      candidates.sort((a, b) => (b.fitness + b.genes.replication * 0.2 - footprint(b) * 0.1) -
                                (a.fitness + a.genes.replication * 0.2 - footprint(a) * 0.1));
      const parent = candidates[0];
      if (random() >= parent.genes.replication * 0.75) continue;
      const childGenes = Object.fromEntries(traits.map((t) => [t,
        Number(clamp(parent.genes[t] + (random() - 0.5) * 0.18, 0.03, 0.97).toFixed(5))]));
      add({ city, latent: random() < 0.5, parent: parent.id, generation: parent.generation + 1,
        genes: childGenes, weights: parent.weights.map((w) => Number(clamp(w + (random() - 0.5) * 0.2, -2, 2).toFixed(5))) });
      totals.births++;
      parent.energy = clamp(parent.energy - 0.22, 0, 1);
    }
  }
  function exportCheckpoint() {
    return clone({ format: ROGUE_FORMAT, seed, cities, rngState, step, nextId,
      agents, totals, lastDuel });
  }
  function restore(c) {
    if (c?.format !== ROGUE_FORMAT || c.seed !== seed ||
      !Array.isArray(c.cities) || c.cities.join("|") !== cities.join("|") ||
      !Number.isInteger(c.step) || c.step < 0 || !Number.isInteger(c.nextId) || c.nextId < 1 ||
      !Number.isInteger(c.rngState) || c.rngState < 0 || c.rngState > 0xffffffff ||
      !Array.isArray(c.agents) || c.agents.length < cities.length * 2 || c.agents.length > MAX_ROGUES ||
      !c.totals || Object.keys(totals).some((k) => !Number.isInteger(c.totals[k]) || c.totals[k] < 0))
      throw Error("Invalid rogue checkpoint");
    const ids = new Set();
    for (const a of c.agents) {
      if (!a || typeof a.id !== "string" || ids.has(a.id) || !available.has(a.city) ||
          typeof a.latent !== "boolean" || typeof a.reservoir !== "boolean" ||
          !Number.isInteger(a.age) || a.age < 0 || !Number.isInteger(a.generation) || a.generation < 0 ||
          !Number.isInteger(a.encounters) || a.encounters < 0 || !Number.isInteger(a.wins) || a.wins < 0 ||
          a.wins > a.encounters || !Number.isFinite(a.fitness) || Math.abs(a.fitness) > 3 ||
          !Number.isFinite(a.energy) || a.energy < 0 || a.energy > 1 ||
          !Array.isArray(a.weights) || a.weights.length !== ROGUE_TACTICS.length ||
          a.weights.some((v) => !Number.isFinite(v) || Math.abs(v) > 2) ||
          !a.genes || traits.some((k) => !Number.isFinite(a.genes[k]) || a.genes[k] < 0 || a.genes[k] > 1))
        throw Error("Invalid rogue agent checkpoint");
      ids.add(a.id);
    }
    for (const city of cities) if (!c.agents.some((a) => a.city === city && a.reservoir && a.latent))
      throw Error("Missing protected latent rival reservoir");
    if (c.totals.encounters !== c.totals.rogueWins + c.totals.defenderWins ||
        (c.lastDuel !== null && (!c.lastDuel || !ids.has(c.lastDuel.id) || !ROGUE_TACTICS.includes(c.lastDuel.tactic))))
      throw Error("Invalid rogue duel ledger");
    agents = clone(c.agents);
    rngState = c.rngState; step = c.step; nextId = c.nextId;
    Object.assign(totals, c.totals);
    lastDuel = clone(c.lastDuel);
  }
  if (checkpoint) restore(checkpoint);
  else for (const city of cities) {
    add({ city, latent: true, reservoir: true });
    add({ city, latent: false });
  }
  return { preview, duel, progress, stats, exportCheckpoint,
    lastDuel: () => clone(lastDuel),
    residents: () => clone(agents) };
}

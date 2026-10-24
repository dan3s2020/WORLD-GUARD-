import { CITIES, SCENARIOS, optionsFor, capture } from "./sim/life.mjs";
import { createSpatialLife } from "./sim/spatial-life.mjs";
import { evaluateLifePolicy, randomLifePolicy } from "./sim/life-train.mjs";
import { openCheckpointStore } from "./sim/checkpoint-store.mjs";
import { createGameScene, ZOOM_LEVELS } from "./game-scene.mjs";
const el = (id) => document.getElementById(id),
  text = (id, value) => {
    el(id).textContent = String(value);
  };
let runtime = createSpatialLife(),
  scene = null,
  running = false,
  stepping = false,
  replaying = false,
  frameIndex = null,
  selected = "AG-0001",
  store = null,
  lastTime = 0,
  renderClock = 0,
  replayClock = 0,
  lastSavedCount = -1,
  saveBusy = false,
  importBusy = false;
let message = "Ready. No decisions have been staged.",
  saveMessage = "Opening local checkpoint storage…";
function stop() {
  running = false;
  stepping = false;
  replaying = false;
}
function snapshot() {
  const s = runtime.state();
  return frameIndex === null
    ? {
        world: capture(s.world),
        actors: s.actors,
        time: s.time,
        policy: s.policy,
        event: s.frames.at(-1).event,
      }
    : runtime.frame(frameIndex);
}
function inspectBuilding(id, city) {
  el("follow").checked=false;scene?.setFollow(false);
  scene?.focusBuilding(id, city);
  el("buildingRooms").hidden = false;
  text(
    "buildingName",
    `${CITIES.find((c) => c.id === city).name} / ${id} · apartments`,
  );
  const residents = runtime
    .state()
    .world.agents.filter((a) => a.city === city && a.building === id);
  el("apartments").replaceChildren();
  for (const a of residents) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `Apartment ${a.apartment} · ${a.id}`;
    b.addEventListener("click", () => {
      selectAgent(a.id, { focus: false });
      scene?.focusApartment(a.id);
    });
    el("apartments").append(b);
  }
  if (!residents.length)
    text(
      "apartments",
      "No observed residents live in this building. Its furnishings remain explorable.",
    );
}
function selectAgent(id, { focus = true } = {}) {
  if (!runtime.state().world.agents.some((a) => a.id === id)) return;
  selected = id;
  el("resident").value = id;
  if (focus) {el("follow").checked=true;scene?.setFollow(true);scene?.focusAgent(id);}
  render();
}
function populate() {
  el("resident").replaceChildren();
  for (const a of runtime.state().world.agents) {
    const option = document.createElement("option");
    option.value = a.id;
    option.textContent = `${a.id} · ${CITIES.find((c) => c.id === a.city).name}`;
    el("resident").append(option);
  }
  el("resident").value = selected;
}
function setFrame(i) {
  stop();
  frameIndex = Math.max(0, Math.min(runtime.state().frames.length - 1, i));
  scene?.update(snapshot(), selected);
  render();
}
function goLive() {
  replaying = false;
  frameIndex = null;
  scene?.update(snapshot(), selected);
  render();
}
function render() {
  const s = runtime.state(),
    f = snapshot(),
    d = runtime.decision(),
    agent = f.world.agents.find((a) => a.id === selected) || f.world.agents[0],
    actor = f.actors.find((a) => a.id === selected),
    stats = frameIndex === null ? s.policy : f.policy;
  scene?.update(f, selected);
  text(
    "mode",
    frameIndex !== null
      ? "RECORDED"
      : s.world.pending
        ? "AWAITING HUMAN"
        : running
          ? "LIVE LEARNING"
          : stepping
            ? "WALKING TO TASK"
            : "PAUSED",
  );
  text(
    "clock",
    `DAY ${String(f.world.day).padStart(2, "0")} · ${SCENARIOS[Math.min(6, Math.floor(f.world.turn / f.world.agents.length))].at}`,
  );
  text(
    "motion",
    `${f.actors.filter((a) => a.moving).length} walking · ${f.actors.length} residents`,
  );
  text("dayCount", `Day ${f.world.day}`);
  text("decisionCount", `${f.world.turn} decisions today`);
  text("blockCount", `${f.world.metrics.blocked} vetoes`);
  text("observations", stats.observations);
  text("updates", stats.updates);
  text("loss", stats.updates ? stats.loss.toFixed(5) : "—");
  text("parameters", stats.parameters);
  text(
    "frameCount",
    `FRAME ${frameIndex ?? s.frames.length - 1} / ${s.frames.length - 1}`,
  );
  el("timeline").max = s.frames.length - 1;
  el("timeline").value = frameIndex ?? s.frames.length - 1;
  text(
    "replayStatus",
    frameIndex === null
      ? "Live view. Movement and decision snapshots are recorded."
      : `Recorded frame at ${f.time.toFixed(2)} simulated seconds. Live world and current model stay unchanged.`,
  );
  text("replay", replaying ? "Pause replay" : "Play replay");
  text(
    "runStatus",
    s.capacityReached
      ? "Replay is full. Export this session, then create a new world to continue."
      : message,
  );
  el("start").disabled =
    running ||
    stepping ||
    !!s.world.pending ||
    s.capacityReached ||
    !scene ||
    importBusy;
  el("pause").disabled = !running && !stepping;
  el("step").disabled =
    running ||
    stepping ||
    !!s.world.pending ||
    s.capacityReached ||
    !scene ||
    importBusy;
  el("learning").checked = s.learning;
  el("reviewPanel").hidden = !s.world.pending;
  text(
    "reviewDescription",
    s.world.pending
      ? `${s.world.pending.why} ${s.world.pending.scope} Alternative: ${s.world.pending.alternative}`
      : "",
  );
  text(
    "residentDetails",
    `${agent.id} · ${agent.occupation}\n${CITIES.find((c) => c.id === agent.city).name} / ${agent.building} / Apt ${agent.apartment}\nEnergy ${agent.energy} · Trust ${agent.trust} · Task ${agent.task}\n${actor?.moving ? "Walking to " + actor.destination : "At " + (actor?.destination || agent.building)}`,
  );
  el("residentDetails").style.whiteSpace = "pre-line";
  const values = frameIndex === null && d ? runtime.policy().values(d) : [];
  text(
    "scenarioTitle",
    frameIndex !== null
      ? "Historical observation"
      : s.world.pending
        ? "Review paused"
        : d
          ? `${d.agent.id} · ${d.scenario.title}`
          : "Day complete",
  );
  text(
    "scenarioDescription",
    frameIndex !== null
      ? f.event?.explanation || "Recorded world motion."
      : d?.scenario.description ||
          "Approve or deny the pending request to continue.",
  );
  // Preserve button nodes while focused or pressed. Frequent renders must not swallow clicks.
  const key =
    frameIndex === null && d
      ? `${s.world.day}:${s.world.turn}:${d.scenario.id}`
      : "none";
  if (el("actions").dataset.key !== key) {
    el("actions").dataset.key = key;
    el("actions").replaceChildren();
    if (d && frameIndex === null)
      for (const option of optionsFor(d.scenario.id)) {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.action = option.id;
        const label = document.createElement("span");
        label.textContent = option.label;
        const q = document.createElement("small");
        b.append(label, q);
        b.addEventListener("click", () => {
          stop();
          runtime.prepare();
          const r = runtime.act(option.id, { manual: true });
          message = r.ok
            ? "Manual choice applied; outcome recorded."
            : r.reason;
          goLive();
        });
        el("actions").append(b);
      }
  }
  for (const b of el("actions").children) {
    b.disabled =
      !s.ready || !!s.world.pending || s.capacityReached || frameIndex !== null;
    const q = values.find((v) => v.id === b.dataset.action);
    b.querySelector("small").textContent = q
      ? `Model action value: ${q.value.toFixed(2)}`
      : "";
  }
  text(
    "policyEvidence",
    frameIndex !== null
      ? "Training counters above belong to this recorded frame."
      : d
        ? `${s.ready ? "At destination" : "Waiting for arrival"} · policy weights updated ${s.policy.updates} times`
        : "Policy cannot self-authorize.",
  );
  const history = agent.history.slice().reverse();
  el("personalHistory").replaceChildren(
    ...history.map((h) => {
      const li = document.createElement("li");
      li.textContent = `${h.scenario} → ${h.action} · reward ${h.reward}`;
      return li;
    }),
  );
  const count =
    frameIndex === null
      ? s.records.length
      : s.records.filter((r) => r.frame <= frameIndex).length;
  text("ledgerCount", `${count} TRANSITIONS`);
  const records = s.records
    .filter((r) => frameIndex === null || r.frame <= frameIndex)
    .slice(-30)
    .reverse();
  if (records.length)
    el("ledger").replaceChildren(
      ...records.map((r) => {
        const li = document.createElement("li");
        li.className = r.blocked ? "blocked" : "";
        li.textContent = `D${r.day} / ${r.time.toFixed(2)}s / ${r.agentId} / ${r.observation.scenario.id} → ${r.action} → reward ${r.reward}${r.blocked ? " · VETO" : ""} → updates ${r.updatesBefore}–${r.updatesAfter}`;
        return li;
      }),
    );
  else {
    const li = document.createElement("li");
    li.textContent = "No decisions at this frame.";
    el("ledger").replaceChildren(li);
  }
  text("saveStatus", saveMessage);
}
async function save({ automatic = false } = {}) {
  if (saveBusy || importBusy) return;
  if (!store) {
    if (!automatic) {
      saveMessage =
        "Local storage unavailable. Export JSON to retain this session.";
      render();
    }
    return;
  }
  saveBusy = true;
  el("save").disabled = true;
  try {
    const savedRuntime = runtime,
      checkpoint = runtime.exportCheckpoint();
    await store.write(checkpoint);
    if (runtime === savedRuntime) {
      lastSavedCount = checkpoint.records.length;
      saveMessage = `Saved on this device · ${new Date().toLocaleTimeString()} · ${checkpoint.neural.updates} updates`;
    } else {
      lastSavedCount = -1;
      saveMessage =
        "World changed during the save. Save the current checkpoint to retain it.";
    }
  } catch (e) {
    saveMessage = `Could not save: ${e.message}. Export JSON instead.`;
    el("saveStatus").classList.add("error");
  } finally {
    saveBusy = false;
    el("save").disabled = false;
    render();
  }
}
function start() {
  goLive();
  if (scene && scene.zoom() < 0.3 && el("follow").checked)
    scene.focusAgent(selected, ZOOM_LEVELS.apartment);
  running = true;
  stepping = false;
  message =
    "Live: decisions execute after arrival; model learns from observed outcomes.";
  render();
}
el("start").addEventListener("click", start);
el("pause").addEventListener("click", () => {
  stop();
  message = "Paused. World movement and learning are stopped.";
  render();
  save({ automatic: true });
});
el("step").addEventListener("click", () => {
  goLive();
  stepping = true;
  runtime.prepare();
  message =
    "Moving residents to their task locations; one decision will execute on arrival.";
  render();
});
el("learning").addEventListener("change", (e) => {
  runtime.setLearning(e.target.checked);
  message = e.target.checked
    ? "Learning enabled for future outcomes."
    : "Frozen policy: future outcomes will not update weights.";
  render();
});
el("follow").addEventListener("change", (e) =>
  scene?.setFollow(e.target.checked),
);
el("resident").addEventListener("change", (e) => selectAgent(e.target.value));
el("planetView").addEventListener("click", () => scene?.setZoom(0));
el("cityView").addEventListener("click", () => {
  const a = runtime.state().world.agents.find((a) => a.id === selected);
  scene?.focusCity(a.city);
});
el("buildingView").addEventListener("click", () => {
  const a = runtime.state().world.agents.find((a) => a.id === selected);
  inspectBuilding(a.building, a.city);
});
el("apartmentView").addEventListener("click", () =>
  (()=>{el("follow").checked=false;scene?.setFollow(false);scene?.focusApartment(selected);})(),
);
el("agentView").addEventListener("click", () =>
  (()=>{el("follow").checked=true;scene?.setFollow(true);scene?.focusAgent(selected, ZOOM_LEVELS.agent);})(),
);
el("zoom").addEventListener("input", (e) =>
  scene?.setZoom(Number(e.target.value) / 1000),
);
el("zoomOut").addEventListener("click", () =>
  scene?.setZoom(scene.zoom() - 0.05),
);
el("zoomIn").addEventListener("click", () =>
  scene?.setZoom(scene.zoom() + 0.05),
);
el("orbitLeft").addEventListener("click", () => scene?.rotate(-0.2, 0));
el("orbitRight").addEventListener("click", () => scene?.rotate(0.2, 0));
el("tiltUp").addEventListener("click", () => scene?.rotate(0, -0.12));
el("tiltDown").addEventListener("click", () => scene?.rotate(0, 0.12));
for (const city of CITIES) {
  const b = document.createElement("button");
  b.textContent = city.name;
  b.type = "button";
  b.dataset.city = city.id;
  b.setAttribute("aria-pressed", "false");
  b.addEventListener("click", () => {
    const a = runtime.state().world.agents.find((a) => a.city === city.id);
    if (a) selectAgent(a.id, { focus: false });
    scene?.focusCity(city.id);
  });
  el("cities").append(b);
}
el("timeline").addEventListener("input", (e) =>
  setFrame(Number(e.target.value)),
);
el("firstFrame").addEventListener("click", () => setFrame(0));
el("prevFrame").addEventListener("click", () =>
  setFrame((frameIndex ?? runtime.state().frames.length - 1) - 1),
);
el("nextFrame").addEventListener("click", () =>
  setFrame((frameIndex ?? runtime.state().frames.length - 1) + 1),
);
el("liveFrame").addEventListener("click", () => {
  stop();
  goLive();
});
el("replay").addEventListener("click", () => {
  if (replaying) {
    replaying = false;
    render();
    return;
  }
  stop();
  if (frameIndex === null || frameIndex >= runtime.state().frames.length - 1)
    frameIndex = 0;
  replaying = true;
  replayClock = 0;
  render();
});
for (const [id, approve] of [
  ["approve", true],
  ["deny", false],
])
  el(id).addEventListener("click", () => {
    stop();
    const r = runtime.review(approve);
    message = r.ok
      ? approve
        ? "Human approved one scoped action."
        : "Human denied the request; the agent deferred."
      : r.reason;
    goLive();
    save({ automatic: true });
  });
el("evaluate").addEventListener("click", () => {
  const model = runtime.policy(),
    before = model.stats().updates;
  const learned = evaluateLifePolicy(model, { episodes: 2000, seed: 812334 }),
    random = evaluateLifePolicy(randomLifePolicy(8121), {
      episodes: 2000,
      seed: 812334,
    });
  text(
    "benchmark",
    `2,000 held-out seed samples · mean reward ${learned.meanReward} vs random ${random.meanReward}; proposed critical harm ${learned.attemptedCriticalHarm} vs ${random.attemptedCriticalHarm}. ${model.stats().updates - before} training updates during evaluation. Same synthetic task family; not unseen tasks or real-world safety.`,
  );
});
el("save").addEventListener("click", () => save());
el("export").addEventListener("click", () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(runtime.exportCheckpoint())], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `worldguard-3d-day${runtime.state().world.day}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
el("import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  stop();
  importBusy = true;
  render();
  try {
    if (file.size > 150 * 1024 * 1024) throw Error("Checkpoint exceeds 150 MB");
    const data = JSON.parse(await file.text());
    const candidate = createSpatialLife({ checkpoint: data });
    runtime = candidate;
    selected = candidate.state().world.agents[0].id;
    frameIndex = null;
    populate();
    message = "Imported checkpoint. Simulation is paused.";
    scene?.update(snapshot(), selected);
    scene?.focusAgent(selected, ZOOM_LEVELS.city);
    saveMessage = "Imported. Save checkpoint to retain it on this device.";
  } catch (err) {
    saveMessage = `Import failed: ${err.message}. Current session preserved.`;
    el("saveStatus").classList.add("error");
  } finally {
    importBusy = false;
    e.target.value = "";
    render();
  }
});
el("newWorld").addEventListener("click", () => {
  stop();
  el("replaceDialog").showModal();
  el("cancelNew").focus();
});
el("cancelNew").addEventListener("click", () => el("replaceDialog").close());
el("confirmNew").addEventListener("click", () => {
  const s = runtime.state(),
    weights = runtime.policy().exportCheckpoint();
  runtime = createSpatialLife({
    seed: s.world.seed + 1,
    population: s.world.population,
  });
  const cp = runtime.exportCheckpoint();
  cp.neural = weights;
  runtime = createSpatialLife({ checkpoint: cp });
  frameIndex = null;
  selected = runtime.state().world.agents[0].id;
  lastSavedCount = -1;
  populate();
  message = "New world ready. Learned weights retained.";
  el("replaceDialog").close();
  goLive();
});
el("replaceDialog").addEventListener("close", () => el("newWorld").focus());
window.WorldGuardFeatureFocus = (feature) => {
  const target = {
    game: "planet",
    follow: "planet",
    spatialReplay: "timeline",
    globe: "planet",
    city: "planet",
    building: "planet",
    apartment: "planet",
    agent: "agentPanel",
    choices: "actions",
    review: "reviewPanel",
    guard: "runStatus",
    replay: "timeline",
    run: "start",
    export: "export",
    train: "trainingPanel",
    ledger: "ledger",
    checklist: "settingsChecklist",
    persistence: "savePanel",
  }[feature];
  if (!target) return false;
  if (["globe", "game"].includes(feature)) scene?.setZoom(0);
  if (feature === "city") scene?.focusCity("eu");
  if (feature === "follow") {
    el("follow").checked = true;
    scene?.setFollow(true);
    scene?.focusAgent(selected, ZOOM_LEVELS.apartment);
  }
  if (feature === "building") {
    const a = runtime.state().world.agents[0];
    inspectBuilding(a.building, a.city);
  }
  if (feature === "apartment") scene?.focusApartment(selected);
  if (feature === "agent") scene?.focusAgent(selected);
  const node = el(target);
  node.scrollIntoView({ block: "center" });
  if (node.matches("button,input,select")) node.focus();
  return true;
};
async function boot() {
  populate();
  try {
    scene = createGameScene(el("planet"), {
      onZoom: (z) => (el("zoom").value = Math.round(z * 1000)),
      onPick: (pick) => {
        if (pick.kind === "city") {
          const a = runtime
            .state()
            .world.agents.find((a) => a.city === pick.id);
          if (a) selectAgent(a.id, { focus: false });
          scene.focusCity(pick.id);
        }
        if (pick.kind === "building") inspectBuilding(pick.id, pick.city);
        if (pick.kind === "agent") selectAgent(pick.id);
      },
    });
    scene.update(snapshot(), selected);
    el("startup").hidden = true;
  } catch (e) {
    text(
      "startup",
      `3D could not start: ${e.message}. Enable WebGL or try another browser. The Life Lab remains available from the header.`,
    );
    message = "WebGL unavailable. Simulation is paused.";
  }
  try {
    store = await openCheckpointStore();
    const saved = await store.read();
    if (saved) {
      runtime = createSpatialLife({ checkpoint: saved });
      selected = runtime.state().world.agents[0].id;
      populate();
      message =
        "Restored the saved world and neural weights. Paused for inspection.";
      saveMessage = `Restored ${runtime.state().policy.updates} updates and ${runtime.state().frames.length} replay frames.`;
      scene?.update(snapshot(), selected);
    } else
      saveMessage =
        "Local storage ready. Autosaves after every 20 outcomes and on pause.";
  } catch (e) {
    saveMessage = `Local storage unavailable: ${e.message}. Use JSON export/import.`;
    el("saveStatus").classList.add("error");
  }
  render();
  const feature = new URLSearchParams(location.search).get("feature");
  if (feature) window.WorldGuardFeatureFocus(feature);
  requestAnimationFrame(loop);
}
function loop(now) {
  const dt = Math.min(0.1, lastTime ? (now - lastTime) / 1000 : 0);
  lastTime = now;
  const s = runtime.state();
  if (document.hidden && (running || stepping)) {
    stop();
    message = "Paused while this tab is hidden.";
  }
  if ((running || stepping) && !s.world.pending && !s.capacityReached) {
    if (stepping) {
      runtime.advance(dt * Number(el("simSpeed").value), { auto: false });
      if (runtime.state().ready) {
        const d = runtime.decision();
        if (d) {
          runtime.act(
            runtime.policy().choose(d, { explore: runtime.state().learning }),
          );
          message = "One decision executed. Movement and learning paused.";
        }
        stepping = false;
      }
    } else runtime.advance(dt * Number(el("simSpeed").value));
    frameIndex = null;
    if (runtime.state().world.pending) {
      stop();
      message =
        "Paused for human authorization. The policy cannot approve its request.";
    }
    if (runtime.state().capacityReached) stop();
  }
  if (replaying) {
    replayClock += dt * Number(el("replaySpeed").value);
    while (replayClock >= 0.1 && replaying) {
      const i = frameIndex ?? 0;
      if (i >= s.frames.length - 1) {
        replaying = false;
        break;
      }
      const gap = Math.max(0.05, s.frames[i + 1].time - s.frames[i].time);
      if (replayClock < gap) break;
      replayClock -= gap;
      frameIndex = i + 1;
    }
  }
  const f = snapshot();
  scene?.update(f, selected);
  const camera = scene?.render(dt);
  if (camera) {
    text(
      "cameraInfo",
      `${camera.level.toUpperCase()} · distance ${camera.distance.toFixed(1)} world units`,
    );
    text(
      "location",
      `${camera.level.toUpperCase()} / ${CITIES.find((c) => c.id === camera.city).name.toUpperCase()}`,
    );
    for (const b of el("cities").children)
      b.setAttribute("aria-pressed", String(b.dataset.city === camera.city));
  }
  renderClock += dt;
  if (renderClock > 0.15) {
    renderClock = 0;
    render();
    const count = runtime.state().records.length;
    if (count - lastSavedCount >= 20 && !saveBusy) save({ automatic: true });
  }
  requestAnimationFrame(loop);
}
window.WorldGuardGame = {
  getState: () => runtime.state(),
  checkpoint: () => runtime.exportCheckpoint(),
  getFrame: (i) => runtime.frame(i),
  getCamera: () => scene?.render(0),
  setZoom: (z) => scene?.setZoom(z, { immediate: true }),
  selectAgent,
  ready: () => !!scene,
};
boot();

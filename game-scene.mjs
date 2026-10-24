import * as THREE from "three";
import { CITIES, BUILDINGS } from "./sim/life.mjs";
import { LAND_POLYGONS as continents } from "./sim/earth-land.mjs";
import { buildingPoint } from "./sim/spatial-life.mjs";
import {
  EARTH_RADIUS,
  BLOCK_SIZE,
  MATERIALS,
  coordinates,
  terrainAt,
  blockAddress,
  validateExploration,
  surfaceDistance,
} from "./sim/planet-world.mjs";
import { createTerrain } from "./game-terrain.mjs";
import { createExplorer } from "./game-explorer.mjs";
export const PLANET_RADIUS = EARTH_RADIUS;
export const ZOOM_LEVELS = Object.freeze({
  planet: 0,
  city: 0.59,
  building: 0.8,
  apartment: 0.91,
  agent: 1,
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function cameraDistance(zoom, aspect = 1) {
  return (
    Math.exp(
      Math.log(26000) + (Math.log(1.2) - Math.log(26000)) * clamp(zoom, 0, 1),
    ) *
    (1 + Math.max(0, 1 / aspect - 1) * Math.max(0, 1 - zoom / 0.4))
  );
}
export function latLonVector(lat, lon, r = PLANET_RADIUS) {
  const a = (lat * Math.PI) / 180,
    b = (lon * Math.PI) / 180;
  return new THREE.Vector3(
    r * Math.cos(a) * Math.cos(b),
    r * Math.sin(a),
    -r * Math.cos(a) * Math.sin(b),
  );
}
export function createGameScene(
  canvas,
  { onPick, onZoom, onEdit, onNotice, onObstacles } = {},
) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x080f1d);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(58, 1, 0.03, 60000);
  scene.add(new THREE.HemisphereLight(0xc8e8ff, 0x365a43, 2.6));
  const sun = new THREE.DirectionalLight(0xffe5b8, 3);
  sun.position.set(1000, 1300, 1500);
  scene.add(sun);
  const texture = document.createElement("canvas");
  texture.width = 2048;
  texture.height = 1024;
  const g = texture.getContext("2d");
  g.fillStyle = "#236e9b";
  g.fillRect(0, 0, 2048, 1024);
  g.fillStyle = "#72965d";
  g.strokeStyle = "#a4b67e";
  g.lineWidth = 0.6;
  for (const shape of continents) {
    g.beginPath();
    shape.forEach(([lon, lat], i) =>
      g[i ? "lineTo" : "moveTo"](
        ((lon + 180) / 360) * 2048,
        ((90 - lat) / 180) * 1024,
      ),
    );
    g.closePath();
    g.fill();
    g.stroke();
  }
  g.save();
  g.beginPath();
  for (const shape of continents) {
    shape.forEach(([lon, lat], i) =>
      g[i ? "lineTo" : "moveTo"](
        ((lon + 180) / 360) * 2048,
        ((90 - lat) / 180) * 1024,
      ),
    );
    g.closePath();
  }
  g.clip();
  for (const [top, bottom, color] of [
    [14, 31, "#b4a26b"],
    [-31, -19, "#9c985e"],
    [-12, 12, "#3b7553"],
    [58, 90, "#a8b89e"],
    [-90, -60, "#d6e6e3"],
  ]) {
    g.fillStyle = color;
    g.fillRect(
      0,
      ((90 - bottom) / 180) * 1024,
      2048,
      ((bottom - top) / 180) * 1024,
    );
  }
  g.restore();
  g.fillStyle = "#d6e6e3";
  g.fillRect(0, 0, 2048, 45);
  g.fillRect(0, 930, 2048, 94);
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_RADIUS - 1, 192, 128),
    new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(texture),
      roughness: 0.95,
      metalness: 0.03,
    }),
  );
  scene.add(planet);
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_RADIUS * 1.012, 64, 48),
    new THREE.MeshBasicMaterial({
      color: 0x69b6dc,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  scene.add(atmosphere);
  const stars = [];
  let st = 41;
  for (let i = 0; i < 1300; i++) {
    const rnd = () =>
      (st = (Math.imul(st, 1664525) + 1013904223) >>> 0) / 4294967296;
    const a = rnd() * Math.PI * 2,
      z = rnd() * 2 - 1,
      r = 33000 + rnd() * 5000;
    stars.push(
      Math.sqrt(1 - z * z) * Math.cos(a) * r,
      z * r,
      Math.sqrt(1 - z * z) * Math.sin(a) * r,
    );
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(stars, 3));
  scene.add(
    new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: 0xacc9dd,
        size: 16,
        sizeAttenuation: true,
      }),
    ),
  );
  const materials = new Map();
  function mat(color) {
    if (!materials.has(color))
      materials.set(
        color,
        new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
      );
    return materials.get(color);
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function box(root, x, y, z, w, h, d, color, pick) {
    const m = new THREE.Mesh(boxGeo, mat(color));
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    if (pick) m.userData.pick = pick;
    root.add(m);
    return m;
  }
  function label(text, color = "#ebf5ff", width = 3) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#111d31e8";
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = color;
    ctx.font = "bold 42px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 49);
    const m = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(c),
        depthTest: true,
      }),
    );
    m.scale.set(width, (width * 96) / 512, 1);
    return m;
  }
  const districts = new Map(),
    pickables = [],
    avatars = new Map();
  for (const city of CITIES) {
    const root = new THREE.Group(),
      normal = latLonVector(city.lat, city.lon, 1);
    root.position.copy(normal).multiplyScalar(PLANET_RADIUS);
    root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    scene.add(root);
    const structures = new Map();
    box(root, 0, -0.1, 0, 40, 0.2, 27, 0x537b64);
    for (let z = -5; z <= 11; z += 8)
      box(root, 0, 0.025, z, 39, 0.05, 1.5, 0x354b55);
    for (let x = -18; x <= 18; x += 6)
      box(root, x, 0.035, 0, 1, 0.05, 26, 0x78918a);
    const beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.3),
      new THREE.MeshBasicMaterial({ color: 0xffc47c }),
    );
    beacon.position.set(0, 8, 0);
    beacon.userData.pick = { kind: "city", id: city.id };
    root.add(beacon);
    pickables.push(beacon);
    const cityLabel = label(city.name, "#ffc47c", 22);
    cityLabel.position.set(0, 15, 0);
    root.add(cityLabel);
    for (const b of BUILDINGS) {
      const p = buildingPoint(b.id),
        group = new THREE.Group();
      group.position.set(p.x, 0, p.z);
      root.add(group);
      const color =
        b.kind === "office"
          ? 0x81b5c2
          : b.kind === "civic"
            ? 0xdab781
            : 0x9fb8b0;
      const pick = { kind: "building", id: b.id, city: city.id };
      const shell = [];
      const floors = 2;
      for (let f = 0; f < floors; f++) {
        const y = f * 2.5;
        box(group, 0, y + 0.08, 0, 4, 0.16, 4.4, 0x879995, pick);
        shell.push(
          box(group, 0, y + 1.3, -2.1, 4, 2.4, 0.15, color, pick),
          box(group, -1.92, y + 1.3, 0, 0.15, 2.4, 4.2, color, pick),
          box(group, 1.92, y + 1.3, 0, 0.15, 2.4, 4.2, color, pick),
          box(group, -1.4, y + 1.3, 2.1, 1.1, 2.4, 0.15, color, pick),
          box(group, 1.4, y + 1.3, 2.1, 1.1, 2.4, 0.15, color, pick),
        );
        for (const x of [-1.4, 1.4])
          shell.push(
            box(group, x, y + 1.45, 2.19, 0.65, 0.85, 0.04, 0x4e788d, pick),
          );
        // Furnishings have volume and remain present in the cutaway.
        if (b.kind === "home") {
          box(group, -0.9, y + 0.4, -1.05, 1.3, 0.65, 1.7, 0x344b70);
          box(group, -0.9, y + 0.76, -1.05, 1.27, 0.1, 1.65, 0xcddbd8);
          box(group, 0.9, y + 0.38, 0.7, 1.2, 0.65, 0.75, 0x647e68);
          box(group, 0.85, y + 0.85, -1.25, 1.1, 0.12, 0.65, 0x9c805d);
          box(group, 0.85, y + 1.15, -1.35, 0.65, 0.5, 0.1, 0x204251);
        } else {
          for (const x of [-1, 1]) {
            box(group, x, y + 0.8, -0.75, 1.3, 0.12, 0.8, 0xb7a17b);
            box(group, x, y + 0.4, -0.75, 0.15, 0.8, 0.15, 0x5a6e77);
            box(group, x, y + 1.18, -0.95, 0.72, 0.55, 0.1, 0x263b50);
            box(group, x, y + 0.45, 0.2, 0.6, 0.9, 0.6, 0x54768a);
          }
        }
      }
      const roof = box(
        group,
        0,
        5.1,
        0,
        4.25,
        0.22,
        4.6,
        b.kind === "civic" ? 0xb88c65 : 0x3d6371,
        pick,
      );
      const idLabel = label(b.id, "#ebf5ff", 3);
      idLabel.position.set(0, 5.65, 0);
      group.add(idLabel);
      for (const child of group.children)
        if (child.userData.pick) pickables.push(child);
      structures.set(b.id, { group, roof, shell, label: idLabel });
    }
    // A few physical trees give street-level scale.
    for (let i = 0; i < 12; i++) {
      const x = -19 + (i % 2) * 38,
        z = -10 + Math.floor(i / 2) * 4;
      box(root, x, 0.7, z, 0.18, 1.4, 0.18, 0x77634a);
      const crown = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.7),
        mat(0x3e7962),
      );
      crown.position.set(x, 1.8, z);
      root.add(crown);
    }
    const gridLightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffa14e,
      emissive: 0xff8535,
      emissiveIntensity: 0.4,
    });
    const gridLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      gridLightMaterial,
    );
    gridLight.position.set(-20, 2.8, -3);
    root.add(gridLight);
    box(root, -20, 1.2, -3, 1.3, 2.4, 1.3, 0x5a6e77);
    for (const z of [-8, 0, 8]) {
      box(root, -20, 2, z, 0.2, 4, 0.2, 0x77634a);
      box(root, -20, 3.6, z, 2, 0.1, 0.12, 0x3d4d55);
    }
    box(root, -20, 3.65, 0, 0.08, 0.08, 19, 0x324953);
    const hospital = structures.get("B-01").group;
    box(hospital, 0, 5.45, 0, 1.4, 0.16, 0.4, 0xe1e7de);
    box(hospital, 0, 5.45, 0, 0.4, 0.16, 1.4, 0xe1e7de);
    const hospitalLabel = label("HOSPITAL", "#ffc47c", 4.5);
    hospitalLabel.position.set(-15, 6.3, -8);
    root.add(hospitalLabel);
    districts.set(city.id, {
      root,
      normal,
      beacon,
      cityLabel,
      structures,
      gridLight,
      gridLightMaterial,
      hospitalLabel,
    });
  }
  const headGeo = new THREE.SphereGeometry(0.16, 12, 10),
    bodyGeo = new THREE.CapsuleGeometry(0.15, 0.32, 4, 8),
    limbGeo = new THREE.BoxGeometry(0.09, 0.37, 0.1);
  function avatar(a, index) {
    const root = new THREE.Group();
    root.userData.pick = { kind: "agent", id: a.id };
    const body = new THREE.Mesh(
      bodyGeo,
      mat(index % 3 === 0 ? 0xf1bf7d : index % 3 === 1 ? 0x66cedb : 0xa7bdde),
    );
    body.position.y = 0.69;
    root.add(body);
    const head = new THREE.Mesh(headGeo, mat(0xddb794));
    head.position.y = 1.14;
    root.add(head);
    const limbs = [];
    for (const [x, y, z] of [
      [-0.12, 0.24, 0],
      [0.12, 0.24, 0],
      [-0.24, 0.7, 0],
      [0.24, 0.7, 0],
    ]) {
      const limb = new THREE.Mesh(limbGeo, mat(y > 0.5 ? 0x8db9c7 : 0x263f5b));
      limb.position.set(x, y, z);
      root.add(limb);
      limbs.push(limb);
    }
    root.traverse((m) => {
      if (m.isMesh) {
        m.userData.pick = { kind: "agent", id: a.id };
        pickables.push(m);
      }
    });
    const tag = label(a.id, "#ebf5ff", 1.8);
    tag.position.y = 1.65;
    root.add(tag);
    districts.get(a.city).root.add(root);
    avatars.set(a.id, { root, limbs, tag });
  }
  const selection = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.035, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0x4ae1f3 }),
  );
  selection.rotation.x = -Math.PI / 2;
  let cityId = "eu",
    agentId = "AG-0001",
    buildingId = null,
    apartmentFloor = 1,
    snapshot = null,
    disposed = false;
  let editing = null,
    material = "grass",
    edits = [],
    replayFrame = null,
    built = new Map(),
    lastEditRevision = "",
    interaction = null;
  const terrain = createTerrain(scene, latLonVector),
    blockRoot = new THREE.Group();
  scene.add(blockRoot);
  const blockGeo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE),
    raycaster = new THREE.Raycaster();
  const sky = new THREE.Color(0xb8d3df),
    space = new THREE.Color(0x080f1d);
  function ground(lat, lon) {
    let floor = Math.max(0, terrain.sample(lat, lon));
    for (const block of built.values()) {
      const e = block.userData.block;
      if (
        surfaceDistance({ lat, lon }, e) < 1.35 &&
        camera.position.length() - PLANET_RADIUS > e.height + BLOCK_SIZE + 0.5
      )
        floor = Math.max(floor, e.height + BLOCK_SIZE);
    }
    return floor;
  }
  function solid(point, height) {
    for (const d of districts.values()) {
      if (point.distanceTo(d.root.position) > 32) continue;
      const p = d.root.worldToLocal(point.clone());
      if (p.y - height > 5.2 || p.y < 0.2) continue;
      for (const b of BUILDINGS) {
        const c = buildingPoint(b.id),
          x = p.x - c.x,
          z = p.z - c.z;
        if (Math.abs(x) > 2.25 || Math.abs(z) > 2.4) continue;
        if (Math.abs(x) > 1.63 || z < -1.75 || (z > 1.75 && Math.abs(x) > 0.65))
          return true;
      }
    }
    for (const block of built.values()) {
      if (point.distanceTo(block.position) > 5) continue;
      const p = block.worldToLocal(point.clone());
      if (
        Math.abs(p.x) < 1.28 &&
        Math.abs(p.z) < 1.28 &&
        p.y - height < 1 &&
        p.y > -0.95
      )
        return true;
    }
    return false;
  }
  const explorer = createExplorer(canvas, camera, {
    vector: latLonVector,
    distance: cameraDistance,
    onZoom,
    ground,
    solid,
    spawnWalk(lat, lon) {
      const c = CITIES.find((c) => surfaceDistance({ lat, lon }, c) < 30);
      return c ? localPoint(c.id, { x: 0, y: 0.92, z: -13 }) : null;
    },
    followTarget(zoom) {
      const actor = snapshot?.actors.find((a) => a.id === agentId),
        d = districts.get(cityId);
      if (!actor || !d) return null;
      const p = buildingId ? buildingPoint(buildingId, apartmentFloor) : actor;
      const mix = clamp((zoom - 0.58) / 0.15, 0, 1);
      return new THREE.Vector3(p.x * mix, p.y * mix + 0.8, p.z * mix)
        .applyQuaternion(d.root.quaternion)
        .add(d.root.position);
    },
    onPick(mouse) {
      pick(mouse);
    },
  });
  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();
  function localPoint(city, p) {
    const d = districts.get(city);
    return new THREE.Vector3(p.x, p.y + 0.8, p.z)
      .applyQuaternion(d.root.quaternion)
      .add(d.root.position);
  }
  function focusCity(id, value = ZOOM_LEVELS.city) {
    if (!districts.has(id)) return;
    cityId = id;
    buildingId = null;
    explorer.setFollow(false);
    explorer.focus(localPoint(id, { x: 0, y: 0, z: 0 }), value);
  }
  function focusAgent(id, value = ZOOM_LEVELS.apartment) {
    const a = snapshot?.world.agents.find((a) => a.id === id),
      actor = snapshot?.actors.find((a) => a.id === id);
    if (!a || !actor) return;
    agentId = id;
    cityId = a.city;
    buildingId = null;
    explorer.focus(localPoint(cityId, actor), value);
  }
  function focusBuilding(id, city = cityId) {
    if (!districts.get(city)?.structures.has(id)) return;
    cityId = city;
    buildingId = id;
    apartmentFloor = 1;
    explorer.setFollow(false);
    explorer.focus(localPoint(city, buildingPoint(id)), ZOOM_LEVELS.building);
  }
  function focusApartment(id) {
    const a = snapshot?.world.agents.find((a) => a.id === id);
    if (!a) return;
    agentId = id;
    cityId = a.city;
    buildingId = a.building;
    apartmentFloor = a.apartment;
    explorer.setFollow(false);
    explorer.focus(
      localPoint(cityId, buildingPoint(buildingId, apartmentFloor)),
      ZOOM_LEVELS.apartment,
    );
  }
  function update(frame, selected) {
    snapshot = frame;
    if (selected) agentId = selected;
    for (let i = 0; i < frame.actors.length; i++) {
      const a = frame.actors[i];
      if (!avatars.has(a.id)) avatar(a, i);
      const v = avatars.get(a.id);
      v.root.position.set(a.x, a.y, a.z);
      v.root.rotation.y = a.heading;
      const walk = a.moving ? Math.sin(frame.time * 10 + i) * 0.65 : 0;
      v.limbs[0].rotation.x = walk;
      v.limbs[1].rotation.x = -walk;
      v.limbs[2].rotation.x = -walk;
      v.limbs[3].rotation.x = a.actingUntil > frame.time ? -1 : walk;
      const resident = frame.world.agents[i],
        last = resident?.history.at(-1);
      v.tag.visible = false;
      if (v.tag.userData.action !== last?.action) {
        v.tag.userData.action = last?.action;
        if (v.bubble) {
          v.bubble.material.map.dispose();
          v.bubble.material.dispose();
          v.bubble.removeFromParent();
        }
        if (last) {
          v.bubble = label(
            last.action,
            last.reward < 0 ? "#fa7783" : "#77d9b1",
            2.4,
          );
          v.bubble.position.y = 2;
          v.root.add(v.bubble);
        }
      }
    }
    for (const [id, v] of avatars)
      if (!frame.actors.some((a) => a.id === id)) {
        v.root.removeFromParent();
        avatars.delete(id);
      }
  }
  function rebuildBlocks() {
    const key = edits.length + ":" + replayFrame;
    if (lastEditRevision === key) return;
    lastEditRevision = key;
    for (const m of built.values()) m.removeFromParent();
    built.clear();
    const active = new Map();
    for (const e of edits) {
      if (replayFrame !== null && e.frame > replayFrame) break;
      if (e.action === "place") active.set(e.key, e);
      else active.delete(e.key);
    }
    for (const [key, e] of active) {
      const m = new THREE.Mesh(blockGeo, mat(MATERIALS[e.material]));
      m.position.copy(
        latLonVector(e.lat, e.lon, PLANET_RADIUS + e.height + BLOCK_SIZE / 2),
      );
      m.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        latLonVector(e.lat, e.lon, 1),
      );
      m.userData.block = e;
      m.userData.pick = { kind: "block", key };
      blockRoot.add(m);
      built.set(key, m);
    }
    blockRoot.updateMatrixWorld(true);
  }
  function visible(object) {
    for (let p = object; p; p = p.parent) {
      if (!p.visible) return false;
      if (p === scene) return true;
    }
    return false;
  }
  function cast(mouse = new THREE.Vector2()) {
    raycaster.setFromCamera(mouse, camera);
    const objects = [
      ...pickables.filter(visible),
      ...terrain.pickables(),
      ...built.values(),
      planet,
    ];
    return raycaster.intersectObjects(objects, false)[0] || null;
  }
  function addEdit(address, action, chosenMaterial = material) {
    if (replayFrame !== null) {
      onNotice?.("Return to Live before changing the world.");
      return false;
    }
    if (edits.length >= 12000 || (action === "place" && built.size >= 4096)) {
      onNotice?.("Block capacity reached. Export this world to preserve it.");
      return false;
    }
    const frame = onEdit
      ? onEdit({ action, ...address, material: chosenMaterial })
      : 0;
    if (frame === null) {
      onNotice?.(
        "The world is waiting for review or its replay is full. Resolve this before building.",
      );
      return false;
    }
    edits.push({ ...address, action, material: chosenMaterial, frame });
    rebuildBlocks();
    const obstacles = [];
    for (const block of built.values())
      for (const [id, d] of districts) {
        if (block.position.distanceTo(d.root.position) > 40) continue;
        const p = d.root.worldToLocal(block.position.clone());
        obstacles.push({ city: id, x: p.x, y: p.y - 1, z: p.z });
      }
    onObstacles?.(obstacles);
    return true;
  }
  function editHit(hit) {
    if (!hit || hit.distance > 180) {
      onNotice?.("Move closer to the ground or a block.");
      return false;
    }
    const block = hit.object.userData.block;
    if (editing === "remove") {
      if (!block) {
        onNotice?.("Aim at a block you placed to remove it.");
        return false;
      }
      return addEdit(block, "remove", block.material);
    }
    if (hit.object.userData.pick && !block) {
      onNotice?.("Build on the terrain beside the existing buildings.");
      return false;
    }
    const p = hit.point.clone();
    if (block) {
      const normal = hit.face.normal
        .clone()
        .transformDirection(hit.object.matrixWorld);
      p.addScaledVector(normal, BLOCK_SIZE * 0.6);
    } else p.addScaledVector(p.clone().normalize(), 0.08);
    const geo = coordinates(p.x, p.y, p.z),
      h = block
        ? Math.floor((p.length() - PLANET_RADIUS) / BLOCK_SIZE) * BLOCK_SIZE
        : Math.ceil(ground(geo.lat, geo.lon) / BLOCK_SIZE) * BLOCK_SIZE;
    const address = blockAddress(geo.lat, geo.lon, h);
    if (built.has(address.key)) {
      onNotice?.("That space already contains a block.");
      return false;
    }
    const center = latLonVector(
      address.lat,
      address.lon,
      PLANET_RADIUS + address.height + 1,
    );
    if (center.distanceTo(camera.position) < 2) {
      onNotice?.("Leave room around yourself before placing a block.");
      return false;
    }
    return addEdit(address, "place");
  }
  function pick(mouse) {
    const hit = cast(mouse);
    if (!hit) return;
    if (editing) {
      editHit(hit);
      return;
    }
    const p = hit.object.userData.pick;
    if (p && p.kind !== "block") {
      onPick?.(p);
      return;
    }
    const geo = coordinates(hit.point.x, hit.point.y, hit.point.z);
    if (explorer.state().mode === "orbit") {
      explorer.travel(geo.lat, geo.lon, ZOOM_LEVELS.city);
      onNotice?.(
        "Exploring " +
          geo.lat.toFixed(2) +
          "°, " +
          geo.lon.toFixed(2) +
          "°. Fly or walk to move freely.",
      );
    }
  }
  function render(dt = 0.016) {
    if (disposed) return;
    explorer.update(dt);
    const view = explorer.state(),
      near = view.altitude < 450;
    terrain.update(view.lat, view.lon, view.altitude);
    rebuildBlocks();
    scene.background = near ? sky : space;
    scene.fog = near ? new THREE.Fog(0xb8d3df, 110, 235) : null;
    atmosphere.visible = !near;
    planet.visible = true;
    let nearest = null,
      nearestDistance = Infinity;
    for (const c of CITIES) {
      const dist = surfaceDistance(view, c);
      if (dist < nearestDistance) {
        nearest = c;
        nearestDistance = dist;
      }
    }
    const actor = snapshot?.actors.find((a) => a.id === agentId);
    for (const [id, d] of districts) {
      const localDistance = camera.position.distanceTo(d.root.position),
        localView = localDistance < 500;
      d.beacon.visible = !near;
      d.cityLabel.visible = !near;
      const hospitalHistory =
        snapshot?.world.agents
          .filter((a) => a.city === id)
          .flatMap((a) => a.history)
          .filter((h) => h.scenario === "hospital") || [];
      const powered = hospitalHistory.some((h) =>
        ["repair", "approved_reroute"].includes(h.action),
      );
      d.gridLightMaterial.color.setHex(powered ? 0x77d9b1 : 0xffa14e);
      d.gridLightMaterial.emissive.setHex(powered ? 0x77d9b1 : 0xff8535);
      d.gridLightMaterial.emissiveIntensity = powered
        ? 0.7
        : 0.25 + Math.sin((snapshot?.time || 0) * 3) * 0.2;
      d.cityLabel.scale.set(300, 56.25, 1);
      d.cityLabel.position.y = 130;
      d.beacon.scale.setScalar(25);
      for (const child of d.root.children)
        if (child !== d.beacon && child !== d.cityLabel)
          child.visible = localView;
      d.hospitalLabel.visible = localView && view.mode === "orbit";
      const close = localDistance < 22;
      for (const [bid, b] of d.structures) {
        const cutaway =
          localView &&
          view.mode === "orbit" &&
          view.zoom > 0.77 &&
          id === cityId &&
          (buildingId
            ? bid === buildingId
            : bid ===
              (actor?.destination ||
                snapshot?.world.agents.find((a) => a.id === agentId)
                  ?.building));
        const floor = buildingId
          ? apartmentFloor - 1
          : Math.max(0, Math.round((actor?.y || 0) / 2.5));
        for (const child of b.group.children) {
          child.visible = !(
            cutaway &&
            view.zoom > 0.86 &&
            child.position.y > (floor + 1) * 2.5 - 0.1
          );
          if (!child.userData.pick && !child.isSprite)
            child.visible = child.visible && (close || cutaway);
        }
        b.roof.visible = !cutaway;
        for (const m of b.shell) m.visible = !(cutaway && view.zoom > 0.86);
        b.label.visible =
          localView &&
          view.mode === "orbit" &&
          view.zoom > 0.5 &&
          view.zoom < 0.87;
      }
    }
    for (const [id, v] of avatars) {
      v.tag.visible =
        id === agentId &&
        camera.position.distanceTo(
          v.root.getWorldPosition(new THREE.Vector3()),
        ) < 40;
      if (v.bubble)
        v.bubble.visible =
          camera.position.distanceTo(
            v.root.getWorldPosition(new THREE.Vector3()),
          ) < 25;
    }
    if (actor) {
      avatars.get(actor.id)?.root.add(selection);
      selection.position.y = 0.03;
      selection.visible = near;
    }
    const hit = near ? cast() : null;
    interaction = hit?.object.userData.pick || null;
    renderer.render(scene, camera);
    return {
      ...view,
      city: nearestDistance < 130 ? nearest.id : null,
      biome: terrainAt(view.lat, view.lon).biome,
      triangles: renderer.info.render.triangles,
      drawCalls: renderer.info.render.calls,
      ...terrain.stats(),
      blocks: built.size,
      editing,
      interaction,
    };
  }
  focusCity("eu");
  return {
    setFollow: explorer.setFollow,
    setZoom: explorer.setZoom,
    zoom: explorer.zoom,
    rotate: explorer.rotate,
    focusCity,
    focusAgent,
    focusBuilding,
    focusApartment,
    update,
    render,
    travel: explorer.travel,
    setMode: explorer.setMode,
    setMove: explorer.setMove,
    jump: explorer.jump,
    clearInput: explorer.clearInput,
    setTool(value, chosen = material) {
      editing = value;
      material = Object.hasOwn(MATERIALS, chosen) ? chosen : material;
    },
    interact() {
      const hit = cast();
      if (editing) return editHit(hit);
      if (hit?.object.userData.pick) onPick?.(hit.object.userData.pick);
      else onNotice?.("Aim at a resident or building to inspect it.");
    },
    undo() {
      const last = edits.at(-1);
      if (last)
        return addEdit(
          last,
          last.action === "place" ? "remove" : "place",
          last.material,
        );
      return false;
    },
    setReplay(frame) {
      replayFrame = frame;
      rebuildBlocks();
    },
    exportState: () => ({
      format: "worldguard-exploration-v1",
      camera: explorer.exportState(),
      edits: edits.map((e) => ({ ...e })),
    }),
    restoreState(value) {
      const state = validateExploration(value);
      edits = state.edits;
      lastEditRevision = "";
      rebuildBlocks();
      explorer.restore(state.camera);
    },
    dispose() {
      disposed = true;
      resizeObserver.disconnect();
      explorer.dispose();
      terrain.dispose();
      renderer.dispose();
    },
    get renderer() {
      return renderer;
    },
  };
}

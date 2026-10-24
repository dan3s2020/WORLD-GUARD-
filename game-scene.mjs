import * as THREE from "three";
import { CITIES, BUILDINGS } from "./sim/life.mjs";
import { continents } from "./sim/geography.mjs";
import { buildingPoint } from "./sim/spatial-life.mjs";
export const PLANET_RADIUS = 200;
export const ZOOM_LEVELS = Object.freeze({
  planet: 0,
  city: 0.44,
  building: 0.72,
  apartment: 0.86,
  agent: 1,
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function cameraDistance(zoom, aspect = 1) {
  return (
    Math.exp(
      Math.log(1300) + (Math.log(1.2) - Math.log(1300)) * clamp(zoom, 0, 1),
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
export function createGameScene(canvas, { onPick, onZoom } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x080f1d);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(48, 1, 0.03, 8000);
  scene.add(new THREE.HemisphereLight(0xc8e8ff, 0x365a43, 2.6));
  const sun = new THREE.DirectionalLight(0xffe5b8, 3);
  sun.position.set(1000, 1300, 1500);
  scene.add(sun);
  const texture = document.createElement("canvas");
  texture.width = 2048;
  texture.height = 1024;
  const g = texture.getContext("2d");
  g.fillStyle = "#235679";
  g.fillRect(0, 0, 2048, 1024);
  g.strokeStyle = "#548498";
  g.lineWidth = 1;
  for (let x = 0; x < 2048; x += 2048 / 24) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 1024);
    g.stroke();
  }
  for (let y = 0; y < 1024; y += 1024 / 12) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(2048, y);
    g.stroke();
  }
  g.fillStyle = "#518a77";
  g.strokeStyle = "#83ac8e";
  g.lineWidth = 2;
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
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_RADIUS, 128, 96),
    new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(texture),
      roughness: 0.95,
      metalness: 0.03,
    }),
  );
  scene.add(planet);
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(202, 64, 48),
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
      r = 2200 + rnd() * 700;
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
        size: 1.5,
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
    districts.set(city.id, { root, normal, beacon, cityLabel, structures });
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
  let zoom = 0.1,
    targetZoom = 0.1,
    cityId = "eu",
    agentId = "AG-0001",
    buildingId = null,
    azimuth = 0.6,
    polar = 0.78,
    panX = 0,
    panZ = 0,
    snapshot = null,
    disposed = false;
  let apartmentFloor = 1;
  let tracking = true,
    frozenPosition = null;
  let pointerStart = null,
    pointers = new Map(),
    pinchStart = null,
    dragged = false;
  const raycaster = new THREE.Raycaster(),
    mouse = new THREE.Vector2();
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
  function setZoom(value, { immediate = false } = {}) {
    targetZoom = clamp(value, 0, 1);
    if (immediate) zoom = targetZoom;
    onZoom?.(targetZoom);
  }
  function focusCity(id, value = ZOOM_LEVELS.city) {
    if (!districts.has(id)) return;
    cityId = id;
    buildingId = null;
    panX = panZ = 0;
    setZoom(value);
  }
  function focusAgent(id, value = ZOOM_LEVELS.apartment) {
    const a = snapshot?.world.agents.find((a) => a.id === id);
    if (!a) return;
    agentId = id;
    cityId = a.city;
    buildingId = null;
    panX = panZ = 0;
    setZoom(value);
  }
  function focusApartment(id) {
    const a = snapshot?.world.agents.find((a) => a.id === id);
    if (!a) return;
    agentId = id;
    cityId = a.city;
    buildingId = a.building;
    apartmentFloor = a.apartment;
    panX = panZ = 0;
    setZoom(ZOOM_LEVELS.apartment);
  }
  function focusBuilding(id, city = cityId) {
    apartmentFloor = 1;
    if (!districts.get(city)?.structures.has(id)) return;
    cityId = city;
    buildingId = id;
    panX = panZ = 0;
    setZoom(ZOOM_LEVELS.building);
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
      v.tag.visible = zoom > 0.35 && a.city === cityId;
    }
    for (const [id, v] of avatars)
      if (!frame.actors.some((a) => a.id === id)) {
        v.root.removeFromParent();
        avatars.delete(id);
      }
  }
  function render(dt = 0.016) {
    if (disposed) return;
    zoom += (targetZoom - zoom) * (1 - Math.exp(-dt * 9));
    const district = districts.get(cityId),
      actor = snapshot?.actors.find((a) => a.id === agentId),
      chosen = snapshot?.world.agents.find((a) => a.id === agentId);
    let local = new THREE.Vector3(panX, 0.8, panZ);
    if (zoom > 0.5) {
      const mix = clamp((zoom - 0.5) / 0.2, 0, 1);
      let p = buildingId
        ? buildingPoint(buildingId, apartmentFloor)
        : !tracking && frozenPosition
          ? frozenPosition
          : actor?.city === cityId
            ? actor
            : { x: 0, y: 0.2, z: 0 };
      local.lerp(new THREE.Vector3(p.x + panX, p.y + 0.7, p.z + panZ), mix);
    }
    const surface = local
      .applyQuaternion(district.root.quaternion)
      .add(district.root.position);
    const blend = clamp(zoom / 0.32, 0, 1);
    const target = surface.multiplyScalar(blend * blend * (3 - 2 * blend));
    const offset = new THREE.Vector3(
      Math.sin(azimuth) * Math.sin(polar),
      Math.cos(polar),
      Math.cos(azimuth) * Math.sin(polar),
    ).applyQuaternion(district.root.quaternion);
    camera.position
      .copy(target)
      .addScaledVector(offset, cameraDistance(zoom, camera.aspect));
    camera.up.copy(district.normal);
    camera.lookAt(target);
    camera.near = zoom < 0.25 ? 0.5 : 0.025;
    camera.updateProjectionMatrix();
    for (const [id, d] of districts) {
      d.beacon.visible = zoom < 0.36;
      d.cityLabel.visible = zoom < 0.36;
      const localView = id === cityId;
      for (const child of d.root.children)
        if (child !== d.beacon && child !== d.cityLabel)
          child.visible = localView && zoom > 0.23;
      for (const [bid, b] of d.structures) {
        b.label.visible = localView && zoom > 0.28 && zoom < 0.85;
        const cutaway =
          localView &&
          zoom > 0.63 &&
          (buildingId
            ? bid === buildingId
            : bid === (actor?.destination || chosen?.building));
        const floor = buildingId
          ? apartmentFloor - 1
          : Math.max(0, Math.round((actor?.y || 0) / 2.5));
        for (const child of b.group.children)
          child.visible = !(
            cutaway &&
            zoom > 0.75 &&
            child.position.y > (floor + 1) * 2.5 - 0.1
          );
        b.label.visible = localView && zoom > 0.28 && zoom < 0.85;
        b.roof.visible = !cutaway;
        for (const m of b.shell) m.visible = !(cutaway && zoom > 0.75);
      }
    }
    if (actor) {
      const av = avatars.get(actor.id);
      av?.root.add(selection);
      selection.position.y = 0.03;
      selection.visible = zoom > 0.35;
    }
    renderer.render(scene, camera);
    return {
      zoom,
      targetZoom,
      distance: cameraDistance(zoom, camera.aspect),
      city: cityId,
      target: target.toArray(),
      tracking,
      level:
        zoom < 0.3
          ? "planet"
          : zoom < 0.62
            ? "city"
            : zoom < 0.8
              ? "building"
              : zoom < 0.95
                ? "apartment"
                : "agent",
      triangles: renderer.info.render.triangles,
    };
  }
  function pick(x, y) {
    const r = canvas.getBoundingClientRect();
    mouse.set(
      ((x - r.left) / r.width) * 2 - 1,
      (-(y - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster
      .intersectObjects(pickables, false)
      .find((h) => h.object.visible && h.object.parent?.visible);
    if (hit) onPick?.(hit.object.userData.pick);
  }
  const handlers = {
    pointerdown: (e) => {
      canvas.focus({ preventScroll: true });
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      if (pointers.size === 1) {
        pointerStart = { x: e.clientX, y: e.clientY, azimuth, polar };
        dragged = false;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = {
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          zoom: targetZoom,
        };
        dragged = true;
      }
    },
    pointermove: (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinchStart) {
        const [a, b] = [...pointers.values()];
        setZoom(
          pinchStart.zoom +
            Math.log(Math.hypot(a.x - b.x, a.y - b.y) / pinchStart.distance) *
              0.18,
        );
      } else if (pointerStart && pointers.size === 1) {
        const dx = e.clientX - pointerStart.x,
          dy = e.clientY - pointerStart.y;
        if (Math.hypot(dx, dy) > 5) dragged = true;
        azimuth = pointerStart.azimuth - dx * 0.006;
        polar = clamp(pointerStart.polar + dy * 0.006, 0.06, 1.43);
      }
    },
    pointerup: (e) => {
      const click = pointers.size === 1 && !dragged;
      pointers.delete(e.pointerId);
      pointerStart = null;
      pinchStart = null;
      if (click) pick(e.clientX, e.clientY);
    },
    pointercancel: () => {
      pointers.clear();
      pointerStart = null;
      pinchStart = null;
    },
    wheel: (e) => {
      e.preventDefault();
      setZoom(targetZoom - e.deltaY * 0.0004);
    },
    keydown: (e) => {
      if (
        [
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "+",
          "-",
          "=",
          "Home",
          "End",
        ].includes(e.key)
      )
        e.preventDefault();
      if (e.key === "ArrowLeft") azimuth -= 0.12;
      if (e.key === "ArrowRight") azimuth += 0.12;
      if (e.key === "ArrowUp") polar = clamp(polar - 0.1, 0.06, 1.43);
      if (e.key === "ArrowDown") polar = clamp(polar + 0.1, 0.06, 1.43);
      if (e.key === "+" || e.key === "=") setZoom(targetZoom + 0.04);
      if (e.key === "-") setZoom(targetZoom - 0.04);
      if (e.key === "Home") setZoom(0);
      if (e.key === "End") setZoom(1);
    },
  };
  for (const [name, handler] of Object.entries(handlers))
    canvas.addEventListener(
      name,
      handler,
      name === "wheel" ? { passive: false } : undefined,
    );
  return {
    setFollow: (value) => {
      tracking = !!value;
      const a = snapshot?.actors.find((a) => a.id === agentId);
      frozenPosition = a ? { x: a.x, y: a.y, z: a.z } : null;
    },
    setZoom,
    focusCity,
    focusAgent,
    focusBuilding,
    focusApartment,
    update,
    render,
    zoom: () => targetZoom,
    rotate: (x, y) => {
      azimuth += x;
      polar = clamp(polar + y, 0.06, 1.43);
    },
    dispose: () => {
      disposed = true;
      resizeObserver.disconnect();
      for (const [name, h] of Object.entries(handlers))
        canvas.removeEventListener(name, h);
      renderer.dispose();
    },
    get renderer() {
      return renderer;
    },
  };
}

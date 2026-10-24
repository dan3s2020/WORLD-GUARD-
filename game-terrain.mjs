import * as THREE from "three";
import {
  EARTH_RADIUS,
  coordinates,
  terrainAt,
  noise,
} from "./sim/planet-world.mjs";
const UP = new THREE.Vector3(0, 1, 0);
/** Small rolling chunk cache. Only terrain around the observer is allocated. */
export function createTerrain(scene, vector) {
  const root = new THREE.Group();
  scene.add(root);
  let anchor = null,
    chunks = new Map(),
    queue = [],
    revision = 0;
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    flatShading: true,
  });
  const trunks = new THREE.MeshStandardMaterial({
    color: 0x70513b,
    roughness: 1,
  });
  const leaves = new THREE.MeshStandardMaterial({
    color: 0x45734c,
    roughness: 1,
  });
  const trunkGeo = new THREE.BoxGeometry(0.65, 3, 0.65),
    leafGeo = new THREE.BoxGeometry(3.6, 3, 3.6);
  const dummy = new THREE.Object3D(),
    color = new THREE.Color(),
    point = new THREE.Vector3();
  const CELL = 4,
    CHUNK = 32,
    RANGE = 3;
  function clear() {
    for (const c of chunks.values()) {
      c.traverse((m) => {
        if (m.isMesh && !m.isInstancedMesh) m.geometry.dispose();
        if (m.isInstancedMesh) m.dispose();
      });
      root.remove(c);
    }
    chunks.clear();
    queue = [];
  }
  function reset(lat, lon) {
    clear();
    anchor = { lat, lon };
    root.position.copy(vector(lat, lon));
    root.quaternion.setFromUnitVectors(UP, vector(lat, lon, 1));
    revision++;
    root.updateMatrixWorld(true);
  }
  function at(x, z) {
    point.set(x, 0, z).applyQuaternion(root.quaternion).add(root.position);
    const geo = coordinates(point.x, point.y, point.z),
      t = terrainAt(geo.lat, geo.lon);
    // Curvature is present at every terrain vertex, including the sea bed.
    return { ...t, geo, y: t.height - (x * x + z * z) / (2 * EARTH_RADIUS) };
  }
  function build(cx, cz) {
    const group = new THREE.Group(),
      positions = [],
      colors = [],
      trees = [];
    const quad = (corners, tint, shade = 1) => {
      color.setHex(tint).multiplyScalar(shade);
      for (const index of [0, 1, 2, 0, 2, 3]) {
        positions.push(...corners[index]);
        colors.push(color.r, color.g, color.b);
      }
    };
    for (let ix = 0; ix < 8; ix++)
      for (let iz = 0; iz < 8; iz++) {
        const x = cx * CHUNK + ix * CELL,
          z = cz * CHUNK + iz * CELL,
          t = at(x + 2, z + 2),
          h = t.y;
        quad(
          [
            [x, h, z],
            [x, h, z + 4],
            [x + 4, h, z + 4],
            [x + 4, h, z],
          ],
          t.color,
          0.94 + noise(x, z) * 0.12,
        );
        for (const [dx, dz, edge] of [
          [
            -4,
            0,
            [
              [x, z + 4],
              [x, z],
            ],
          ],
          [
            4,
            0,
            [
              [x + 4, z],
              [x + 4, z + 4],
            ],
          ],
          [
            0,
            -4,
            [
              [x, z],
              [x + 4, z],
            ],
          ],
          [
            0,
            4,
            [
              [x + 4, z + 4],
              [x, z + 4],
            ],
          ],
        ]) {
          const low = at(x + 2 + dx, z + 2 + dz).y;
          if (low < h - 0.08) {
            const [[a, b], [c, d]] = edge;
            quad(
              [
                [a, h, b],
                [c, h, d],
                [c, low, d],
                [a, low, b],
              ],
              t.biome === "snow" ? 0x98a7a1 : 0x847354,
              0.8,
            );
          }
        }
        if (
          ["grassland", "highland"].includes(t.biome) &&
          noise(
            Math.round(t.geo.lat * 1000),
            Math.round(t.geo.lon * 1000),
            31,
          ) > 0.945
        )
          trees.push({ x: x + 2, y: h, z: z + 2 });
      }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.terrain = true;
    group.add(mesh);
    if (trees.length) {
      const a = new THREE.InstancedMesh(trunkGeo, trunks, trees.length),
        b = new THREE.InstancedMesh(leafGeo, leaves, trees.length);
      trees.forEach((t, i) => {
        dummy.position.set(t.x, t.y + 1.5, t.z);
        dummy.updateMatrix();
        a.setMatrixAt(i, dummy.matrix);
        dummy.position.y = t.y + 4;
        dummy.updateMatrix();
        b.setMatrixAt(i, dummy.matrix);
      });
      group.add(a, b);
    }
    root.add(group);
    chunks.set(`${cx}:${cz}`, group);
  }
  function update(lat, lon, altitude) {
    root.visible = altitude < 800;
    if (!root.visible) return;
    const p = vector(lat, lon);
    if (!anchor || p.distanceTo(root.position) > 180) reset(lat, lon);
    const local = root.worldToLocal(p.clone()),
      cx = Math.floor(local.x / CHUNK),
      cz = Math.floor(local.z / CHUNK);
    const wanted = new Set(),
      pending = [];
    for (let x = cx - RANGE; x <= cx + RANGE; x++)
      for (let z = cz - RANGE; z <= cz + RANGE; z++) {
        const key = `${x}:${z}`;
        wanted.add(key);
        if (!chunks.has(key))
          pending.push({ x, z, d: (x - cx) ** 2 + (z - cz) ** 2 });
      }
    for (const [key, c] of chunks)
      if (!wanted.has(key)) {
        root.remove(c);
        c.traverse((m) => {
          if (m.isMesh && !m.isInstancedMesh) m.geometry.dispose();
          if (m.isInstancedMesh) m.dispose();
        });
        chunks.delete(key);
      }
    queue = pending.sort((a, b) => a.d - b.d);
    // Bounded generation work per animation frame, including teleports.
    for (let n = 0; n < 3 && queue.length; n++) {
      const c = queue.shift();
      build(c.x, c.z);
    }
  }
  return {
    root,
    update,
    sample: (lat, lon) => {
      if (!anchor) return terrainAt(lat, lon).height;
      const local = root.worldToLocal(vector(lat, lon).clone());
      return at(
        Math.floor(local.x / CELL) * CELL + 2,
        Math.floor(local.z / CELL) * CELL + 2,
      ).height;
    },
    pickables: () => [...chunks.values()].map((c) => c.children[0]),
    stats: () => ({ chunks: chunks.size, queued: queue.length, revision }),
    dispose: () => {
      clear();
      material.dispose();
      trunks.dispose();
      leaves.dispose();
      trunkGeo.dispose();
      leafGeo.dispose();
      root.removeFromParent();
    },
  };
}

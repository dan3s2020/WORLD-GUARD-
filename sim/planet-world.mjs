/** Compressed procedural Earth sandbox with bundled generalized Natural Earth coasts. */
import { LAND_POLYGONS } from "./earth-land.mjs";
import { CITIES } from "./life.mjs";
export const EARTH_RADIUS = 6000;
export const BLOCK_SIZE = 2;
export const MATERIALS = Object.freeze({
  grass: 0x769447,
  stone: 0x969b99,
  wood: 0x93643f,
  glass: 0x8bced8,
});
const rad = Math.PI / 180;
// Index coast edges by latitude so chunk generation does not scan the whole map.
const latitudeEdges = Array.from({ length: 181 }, () => []);
for (const shape of LAND_POLYGONS)
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const a = shape[j],
      b = shape[i];
    for (
      let bin = Math.max(0, Math.floor(Math.min(a[1], b[1]) + 90));
      bin <= Math.min(180, Math.floor(Math.max(a[1], b[1]) + 90));
      bin++
    )
      latitudeEdges[bin].push([a, b]);
  }
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const wrapLongitude = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
export function coordinates(x, y, z) {
  const r = Math.hypot(x, y, z);
  return {
    lat: Math.asin(clamp(y / r, -1, 1)) / rad,
    lon: wrapLongitude(Math.atan2(-z, x) / rad),
  };
}
export function surfaceDistance(a, b) {
  const dlat = (b.lat - a.lat) * rad,
    dlon = wrapLongitude(b.lon - a.lon) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(clamp(h, 0, 1)));
}
export function isLand(lat, lon) {
  if (lat < -89.9) return true;
  let inside = false;
  for (const [[xi, yi], [xj, yj]] of latitudeEdges[
    clamp(Math.floor(lat + 90), 0, 180)
  ])
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  return inside;
}
export function noise(x, z, salt = 0) {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}
function smoothNoise(x, z, salt) {
  const a = Math.floor(x),
    b = Math.floor(z),
    u = x - a,
    v = z - b;
  const s = u * u * (3 - 2 * u),
    t = v * v * (3 - 2 * v);
  const lo = noise(a, b, salt) * (1 - s) + noise(a + 1, b, salt) * s;
  const hi = noise(a, b + 1, salt) * (1 - s) + noise(a + 1, b + 1, salt) * s;
  return lo * (1 - t) + hi * t;
}
export function terrainAt(lat, lon) {
  let city = null,
    nearest = Infinity;
  for (const c of CITIES) {
    const d = surfaceDistance({ lat, lon }, c);
    if (d < nearest) {
      city = c;
      nearest = d;
    }
  }
  // A level clearing connects the inherited inhabited districts to the countryside.
  if (nearest < 31)
    return { height: 0, biome: "settlement", color: 0x718b48, city: city.id };
  const land = isLand(lat, lon) || nearest < 85;
  if (!land) return { height: -4, biome: "ocean", color: 0x257997, city: null };
  const x = lon * rad * EARTH_RADIUS,
    z = lat * rad * EARTH_RADIUS;
  const broad = smoothNoise(x / 180, z / 180, 7),
    detail = smoothNoise(x / 35, z / 35, 19);
  let height = Math.max(
    2,
    Math.floor((broad * broad * 46 + detail * 6 - 4) / 2) * 2,
  );
  if (nearest < 85) height = Math.floor((height * (nearest - 31)) / 54 / 2) * 2;
  const ice = Math.abs(lat) > 62 || height > 31;
  const desert = Math.abs(lat) > 14 && Math.abs(lat) < 31 && broad > 0.35;
  return {
    height,
    biome: ice
      ? "snow"
      : desert
        ? "desert"
        : height > 19
          ? "highland"
          : "grassland",
    color: ice
      ? 0xdce8dd
      : desert
        ? 0xcdb57a
        : height > 19
          ? 0x929989
          : 0x6e9249,
    city: null,
  };
}
export function blockAddress(lat, lon, height) {
  const step = BLOCK_SIZE / EARTH_RADIUS / rad;
  const row = Math.round(lat / step),
    column = Math.round(wrapLongitude(lon) / step);
  return {
    lat: clamp(row * step, -89.99, 89.99),
    lon: wrapLongitude(column * step),
    height: Math.round(height / BLOCK_SIZE) * BLOCK_SIZE,
    key: `${row}:${column}:${Math.round(height / BLOCK_SIZE)}`,
  };
}
export function validateExploration(value) {
  if (value == null) return { camera: null, edits: [] };
  if (
    value.format !== "worldguard-exploration-v1" ||
    !Array.isArray(value.edits) ||
    value.edits.length > 12000
  )
    throw Error("Invalid exploration checkpoint");
  const camera = value.camera;
  if (
    camera &&
    (![
      camera.lat,
      camera.lon,
      camera.altitude,
      camera.yaw,
      camera.pitch,
      camera.zoom,
    ].every(Number.isFinite) ||
      Math.abs(camera.lat) > 90 ||
      Math.abs(camera.lon) > 180 ||
      camera.altitude < 0 ||
      camera.altitude > 1000000 ||
      camera.zoom < 0 ||
      camera.zoom > 1 ||
      (camera.targetHeight !== undefined &&
        (!Number.isFinite(camera.targetHeight) ||
          Math.abs(camera.targetHeight) > 1000)) ||
      (camera.polar !== undefined &&
        (!Number.isFinite(camera.polar) ||
          camera.polar < 0.05 ||
          camera.polar > 1.5)) ||
      !["orbit", "fly", "walk"].includes(camera.mode))
  )
    throw Error("Invalid saved camera");
  const edits = value.edits.map((e, i) => {
    if (
      !Number.isInteger(e.frame) ||
      e.frame < 0 ||
      (i && e.frame < value.edits[i - 1].frame) ||
      ![e.lat, e.lon, e.height].every(Number.isFinite) ||
      Math.abs(e.lat) > 90 ||
      Math.abs(e.lon) > 180 ||
      e.height < -10 ||
      e.height > 500 ||
      !["place", "remove"].includes(e.action) ||
      !Object.hasOwn(MATERIALS, e.material)
    )
      throw Error("Invalid saved block edit");
    const address = blockAddress(e.lat, e.lon, e.height);
    return {
      ...address,
      frame: e.frame,
      action: e.action,
      material: e.material,
    };
  });
  const active = new Set();
  for (const e of edits) {
    if (e.action === "place") active.add(e.key);
    else active.delete(e.key);
    if (active.size > 4096) throw Error("Saved world exceeds block capacity");
  }
  return { camera: camera ? { ...camera } : null, edits };
}

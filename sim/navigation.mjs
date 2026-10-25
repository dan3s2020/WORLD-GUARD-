/** Deterministic collision-aware waypoint detours for residents in the 3D game.
 * The physical geometry is authoritative; this does not alter policy rewards.
 */
export const BODY_CLEARANCE = 1.25;
const CORNER_MARGIN = 0.35;
const EPS = 1e-9;
const MAX_ROUTE_NODES = 20;

function overlapsHeight(o, y0, y1) {
  return Math.max(y0, y1) + 1.3 > o.y && Math.min(y0, y1) < o.y + 2;
}

/** Whether a continuous body sweep intersects any placed collision cube. */
export function segmentBlocked(a, b, obstacles, city) {
  for (const o of obstacles) {
    if (o.city !== city || !overlapsHeight(o, a.y, b.y)) continue;
    const r = BODY_CLEARANCE;
    let low = 0, high = 1;
    let hit = true;
    for (const axis of ['x', 'z']) {
      const d = b[axis] - a[axis], min = o[axis] - r, max = o[axis] + r;
      if (Math.abs(d) < EPS) {
        if (a[axis] <= min || a[axis] >= max) { hit = false; break; }
      } else {
        const t0 = (min - a[axis]) / d, t1 = (max - a[axis]) / d;
        low = Math.max(low, Math.min(t0, t1));
        high = Math.min(high, Math.max(t0, t1));
        if (low >= high - EPS) { hit = false; break; }
      }
    }
    if (hit && high > EPS && low < 1 - EPS) return true;
  }
  return false;
}

/** Visibility-graph shortest route around placed blocks. Returns intermediates
 * and the original destination, or null if it is unreachable. No teleporting.
 */
export function findDetour(from, to, obstacles, city, maxNodes = MAX_ROUTE_NODES) {
  if (![from.x, from.y, from.z, to.x, to.y, to.z].every(Number.isFinite))
    throw Error('Invalid navigation point');
  if (!Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 20)
    throw Error('Invalid navigation budget');
  if (!segmentBlocked(from, to, obstacles, city)) return [{ ...to }];
  const relevant = obstacles.filter((o) =>
    o.city === city && overlapsHeight(o, from.y, to.y) &&
    o.x >= Math.min(from.x, to.x) - 12 && o.x <= Math.max(from.x, to.x) + 12 &&
    o.z >= Math.min(from.z, to.z) - 12 && o.z <= Math.max(from.z, to.z) + 12
  );
  // Conservative bound on player-built mazes; never invent a route.
  if (relevant.length > 24) return null;
  const points = [{ ...from }, { ...to }];
  for (const o of relevant) {
    const r = BODY_CLEARANCE + CORNER_MARGIN;
    for (const dx of [-r, r]) for (const dz of [-r, r])
      points.push({ x: o.x + dx, y: from.y, z: o.z + dz });
  }
  const dist = Array(points.length).fill(Infinity), prev = Array(points.length).fill(-1);
  const done = Array(points.length).fill(false);
  dist[0] = 0;
  for (let step = 0; step < points.length; step++) {
    let best = -1;
    for (let i = 0; i < points.length; i++)
      if (!done[i] && (best < 0 || dist[i] < dist[best])) best = i;
    if (best < 0 || !Number.isFinite(dist[best])) break;
    if (best === 1) break;
    done[best] = true;
    for (let j = 1; j < points.length; j++) {
      if (j === best || done[j] || segmentBlocked(points[best], points[j], relevant, city)) continue;
      const cost = Math.hypot(points[best].x - points[j].x, points[best].z - points[j].z);
      const next = dist[best] + cost;
      if (next < dist[j] - EPS) { dist[j] = next; prev[j] = best; }
    }
  }
  if (!Number.isFinite(dist[1])) return null;
  const indices = [], seen = new Set();
  for (let p = 1; p !== 0; p = prev[p]) {
    if (p < 0 || seen.has(p) || indices.length >= maxNodes) return null;
    seen.add(p);
    indices.push(p);
  }
  return indices.reverse().map((i) => ({ ...points[i] }));
}

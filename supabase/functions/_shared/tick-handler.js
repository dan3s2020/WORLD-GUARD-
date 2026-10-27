// World clock for Supabase: load -> apply queued actions -> advance -> save -> publish.
// Plain JavaScript (runs in the Supabase Edge Runtime and in Node tests).
import { createService, upsertPlayer, applyAction, advance, publicState, agentsDetail, takeDecisionLog, ACTIVE_MS } from './engine/world-service.js';
import { createQNet } from './engine/policy.js';
import { CHECKPOINT } from './engine/checkpoint.js';

const policy = createQNet({ weights: CHECKPOINT.weights }).policy;

export async function runTick({ url, serviceKey, fetchImpl = fetch, now = Date.now(), tickMs = 1000, maxTicks = 30 }) {
  const rest = async (path, init = {}) => {
    const res = await fetchImpl(`${url}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', ...(init.headers || {}) }
    });
    if (!res.ok) throw new Error(`${init.method || 'GET'} ${path.split('?')[0]} -> ${res.status} ${await res.text()}`);
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  };

  const rows = await rest('world_private?id=eq.1&select=state,version');
  let svc, version;
  if (!rows.length || !rows[0].state) {
    svc = createService();
    version = rows.length ? rows[0].version : null;
  } else {
    svc = rows[0].state;
    version = rows[0].version;
  }

  const since = new Date(now - ACTIVE_MS).toISOString();
  const players = await rest(`players?select=id,name,role,trained,last_seen&last_seen=gt.${encodeURIComponent(since)}`);
  for (const p of players) upsertPlayer(svc, p.id, { name: p.name, role: p.role, trained: p.trained }, Date.parse(p.last_seen));

  const actions = await rest('actions?processed=eq.false&select=id,player_id,kind,payload,created_at&order=id.asc&limit=300');
  for (const a of actions) applyAction(svc, a.player_id, { ...(a.payload || {}), kind: a.kind, aid: a.id }, Date.parse(a.created_at));

  const last = svc.lastTickAt || now - tickMs;
  const n = Math.max(1, Math.min(maxTicks, Math.round((now - last) / tickMs)));
  advance(svc, n, policy, now);
  svc.lastTickAt = Math.max(last + n * tickMs, now - maxTicks * tickMs);
  const log = takeDecisionLog(svc);

  // Optimistic concurrency: if another invocation saved first, this one does nothing.
  const stamp = new Date(now).toISOString();
  if (version === null) {
    await rest('world_private', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ id: 1, state: svc, version: 1, updated_at: stamp }) });
  } else {
    const saved = await rest(`world_private?id=eq.1&version=eq.${version}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ state: svc, version: version + 1, updated_at: stamp }) });
    if (!saved.length) return { ok: false, skipped: 'concurrent update' };
  }
  await rest('world_public?id=eq.1', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ tick: svc.world.tick, state: publicState(svc, now), agents: agentsDetail(svc), updated_at: stamp }) });
  if (actions.length) await rest(`actions?id=in.(${actions.map(a => a.id).join(',')})`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ processed: true }) });
  if (log.length) await rest('decisions', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(log.map(record => ({ record }))) });
  return { ok: true, tick: svc.world.tick, ticks: n, actions: actions.length, players: players.length, decisions: log.length };
}

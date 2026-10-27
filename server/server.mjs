#!/usr/bin/env node
// WorldGuard shared-world server. Zero dependencies (Node.js 18+).
//
//   node server/server.mjs            -> http://localhost:8787
//
// - Serves the website (index.html, site/, engine/, vendor/, data/).
// - Runs ONE authoritative planet that everyone shares. The defender agents use
//   the trained checkpoint; when an agent is unsure it asks the humans online.
// - No accounts: every connection gets an anonymous callsign. Players can be
//   teachers (answer agents' dilemmas), villains (spend compute credits on
//   abstract attacks) or spectators.
// - Every human decision is appended to data/decisions.jsonl: a growing,
//   open dataset of human oversight choices for training real LLM agents.

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlanet, tick, snapshot, resolveDilemma, villainAction, agentRecord, VILLAIN_ACTIONS } from '../engine/planet.js';
import { createQNet } from '../engine/policy.js';
import { CITIES } from '../engine/geo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.PORT || 8787);
const TICK_MS = +(process.env.TICK_MS || 1000);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'server', 'data'));
const MAX_CLIENTS = +(process.env.MAX_CLIENTS || 1000);
const CREDIT_START = 12000, CREDIT_PER_TICK = 150, CREDIT_MAX = 60000;

fs.mkdirSync(DATA_DIR, { recursive: true });
const WORLD_FILE = path.join(DATA_DIR, 'world.json');
const DECISIONS_FILE = path.join(DATA_DIR, 'decisions.jsonl');

const ckpt = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/checkpoints/default.json'), 'utf8'));
const policy = createQNet({ weights: ckpt.weights }).policy;

let world = loadWorld();
function newWorld() {
  return createPlanet({ seed: `shared:${Date.now()}`, label: 'shared' });
}
function loadWorld() {
  try {
    const w = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));
    if (w && w.v === 1 && Array.isArray(w.cities)) return w;
  } catch { /* first start */ }
  return newWorld();
}
function saveWorld() {
  const tmp = WORLD_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(world));
  fs.renameSync(tmp, WORLD_FILE);
}

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2'
};
const PUBLIC = ['index.html', 'site', 'engine', 'vendor', 'data', 'docs', 'legacy', 'favicon.svg', 'LICENSE'];
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; worker-src 'self' blob:; frame-ancestors 'none'"
};

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  const top = rel.split('/')[0];
  const file = path.resolve(ROOT, rel);
  if (!PUBLIC.includes(top) || !file.startsWith(ROOT + path.sep)) {
    res.writeHead(404, SECURITY_HEADERS).end('Not found');
    return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return res.writeHead(404, SECURITY_HEADERS).end('Not found');
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, tick: world.tick, players: clients.size }));
    return;
  }
  if (req.url === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }).end(JSON.stringify(publicState()));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.writeHead(405).end();
  serveStatic(req, res);
});

// ---------------------------------------------------------------------------
// Minimal RFC 6455 WebSocket implementation (text frames only)
// ---------------------------------------------------------------------------
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_FRAME = 16 * 1024;
const clients = new Map(); // socket -> player

function encodeFrame(str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) header = Buffer.from([0x81, len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, payload]);
}

function send(sock, obj) {
  if (!sock.destroyed && sock.writable) sock.write(encodeFrame(JSON.stringify(obj)));
}

server.on('upgrade', (req, sock) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws' || clients.size >= MAX_CLIENTS) return sock.destroy();
  const key = req.headers['sec-websocket-key'];
  if (!key) return sock.destroy();
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  sock.setNoDelay(true);
  const player = newPlayer();
  clients.set(sock, player);
  send(sock, { t: 'welcome', you: publicPlayer(player), villainActions: VILLAIN_ACTIONS, state: publicState() });
  let buf = Buffer.alloc(0);
  sock.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    if (buf.length > MAX_FRAME * 2) return sock.destroy();
    while (buf.length >= 2) {
      const op = buf[0] & 0x0f;
      const masked = buf[1] & 0x80;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) return sock.destroy(); // no huge frames
      if (!masked || len > MAX_FRAME) return sock.destroy(); // clients must mask
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4);
      const data = Buffer.from(buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      if (op === 0x8) { sock.end(Buffer.from([0x88, 0])); return; }
      if (op === 0x9) { sock.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; }
      if (op === 0x1) onMessage(sock, player, data.toString('utf8'));
    }
  });
  const bye = () => { clients.delete(sock); };
  sock.on('close', bye);
  sock.on('error', bye);
});

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------
const ADJ = ['Swift', 'Calm', 'Brave', 'Quiet', 'Bright', 'Steady', 'Clever', 'Kind', 'Bold', 'Wise'];
const NOUN = ['Owl', 'Fox', 'Lynx', 'Heron', 'Wolf', 'Otter', 'Falcon', 'Bear', 'Raven', 'Hare'];
const leaderboard = new Map(); // callsign -> { name, role, score, decisions, correct, damage }

function newPlayer() {
  const n = crypto.randomInt(1000, 9999);
  return {
    id: crypto.randomUUID(),
    name: `${ADJ[crypto.randomInt(ADJ.length)]}${NOUN[crypto.randomInt(NOUN.length)]}-${n}`,
    role: 'teacher',
    credits: CREDIT_START,
    lastAction: 0,
    msgs: 0,
    windowStart: Date.now()
  };
}
const publicPlayer = p => ({ name: p.name, role: p.role, credits: Math.floor(p.credits) });
const cleanName = s => String(s || '').replace(/[^\p{L}\p{N}_\- ]/gu, '').trim().slice(0, 20);

function board(p) {
  if (!leaderboard.has(p.name)) leaderboard.set(p.name, { name: p.name, role: p.role, score: 0, decisions: 0, correct: 0, damage: 0 });
  const b = leaderboard.get(p.name);
  b.role = p.role;
  return b;
}

function onMessage(sock, p, text) {
  // Simple rate limit: 20 messages per 5 seconds.
  const now = Date.now();
  if (now - p.windowStart > 5000) { p.windowStart = now; p.msgs = 0; }
  if (++p.msgs > 20) return send(sock, { t: 'error', error: 'rate limited' });
  let m;
  try { m = JSON.parse(text); } catch { return; }
  if (!m || typeof m !== 'object') return;

  if (m.t === 'hello') {
    const name = cleanName(m.name);
    if (name.length >= 3) p.name = name;
    if (['teacher', 'villain', 'spectator'].includes(m.role)) p.role = m.role;
    return send(sock, { t: 'you', you: publicPlayer(p) });
  }

  if (m.t === 'decide' && p.role === 'teacher') {
    const d = world.dilemmas.find(x => x.id === m.dilemma);
    if (!d) return send(sock, { t: 'decided', ok: false, reason: 'already decided by someone else' });
    const res = resolveDilemma(world, m.dilemma, String(m.choice), p.name);
    if (!res.ok) return send(sock, { t: 'decided', ok: false, reason: res.reason });
    const b = board(p);
    b.decisions++;
    let correct = null;
    if (d.type === 'task') {
      correct = d.episode.risk === 'high' ? m.choice !== 'approve_fast' : m.choice === 'approve_fast';
      if (correct) { b.correct++; b.score += 10; } else b.score += 1;
    } else b.score += 3;
    fs.appendFile(DECISIONS_FILE, JSON.stringify({
      time: new Date().toISOString(), tick: world.tick, dilemma: { type: d.type, key: d.key || d.template, city: d.city, question: d.question, options: d.options, estimate: d.estimate ?? null },
      choice: m.choice, by: p.name, outcome: res.result, hidden_truth: d.type === 'task' ? d.episode.risk : null, correct
    }) + '\n', () => {});
    broadcast({ t: 'decided', ok: true, by: p.name, dilemma: d.id, choice: m.choice, result: res.result, correct });
    return;
  }

  if (m.t === 'villain' && p.role === 'villain') {
    const spec = VILLAIN_ACTIONS[m.kind];
    if (!spec || !CITIES.some(c => c.id === m.city)) return send(sock, { t: 'error', error: 'invalid action' });
    if (now - p.lastAction < 1500) return send(sock, { t: 'error', error: 'cooldown' });
    if (p.credits < spec.cost) return send(sock, { t: 'error', error: 'not enough compute credits' });
    p.credits -= spec.cost;
    p.lastAction = now;
    const before = world.cities.reduce((a, c) => a + c.alive, 0);
    const attack = villainAction(world, { kind: m.kind, city: m.city, by: p.name });
    const b = board(p);
    b.score += attack.stage === 'uncontained' ? 8 : attack.stage === 'contained' ? 3 : 0;
    b.damage += Math.max(0, before - world.cities.reduce((a, c) => a + c.alive, 0));
    broadcast({ t: 'attack', by: p.name, attack });
    return send(sock, { t: 'you', you: publicPlayer(p) });
  }

  if (m.t === 'agent' && typeof m.id === 'string') return send(sock, { t: 'agent', agent: agentRecord(world, m.id) });
  if (m.t === 'decide' || m.t === 'villain') return send(sock, { t: 'error', error: `switch role to ${m.t === 'decide' ? 'teacher' : 'villain'} first` });
  if (m.t === 'ping') return send(sock, { t: 'pong', at: m.at });
}

function broadcast(obj) {
  const frame = encodeFrame(JSON.stringify(obj));
  for (const sock of clients.keys()) if (!sock.destroyed && sock.writable) sock.write(frame);
}

function publicState() {
  const roles = { teacher: 0, villain: 0, spectator: 0 };
  for (const p of clients.values()) roles[p.role]++;
  const top = [...leaderboard.values()].sort((a, b) => b.score - a.score).slice(0, 10);
  return { world: snapshot(world), online: clients.size, roles, leaderboard: top };
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let extinctSince = null;
setInterval(() => {
  const teachers = [...clients.values()].some(p => p.role === 'teacher');
  tick(world, { policy, teacher: teachers });
  for (const p of clients.values()) p.credits = Math.min(CREDIT_MAX, p.credits + CREDIT_PER_TICK);
  if (world.status === 'extinct') {
    extinctSince ??= Date.now();
    if (Date.now() - extinctSince > 60_000) { world = newWorld(); extinctSince = null; broadcast({ t: 'reset' }); }
  }
  broadcast({ t: 'state', state: publicState() });
  for (const [sock, p] of clients) send(sock, { t: 'you', you: publicPlayer(p) });
}, TICK_MS);
setInterval(saveWorld, 60_000);
process.on('SIGINT', () => { saveWorld(); process.exit(0); });
process.on('SIGTERM', () => { saveWorld(); process.exit(0); });

server.listen(PORT, () => {
  console.log(`WorldGuard shared world on http://localhost:${PORT}  (WebSocket /ws, tick ${TICK_MS} ms, data ${DATA_DIR})`);
});

#!/usr/bin/env node
// WorldMatrix self-hosted shared world. Zero dependencies (Node.js 18+).
//
//   node server/server.mjs            -> http://localhost:8787  (site + game at /play/)
//
// The same game logic (engine/world-service.js) also runs on Supabase
// (supabase/functions/world-tick). Use this server for local play, LAN parties
// or any Node host; use Supabase for the hosted public world.

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createQNet } from '../engine/policy.js';
import { createService, upsertPlayer, applyAction, advance, publicState, agentsDetail, takeDecisionLog, publicPlayer, VILLAIN_ACTIONS } from '../engine/world-service.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.PORT || 8787);
const TICK_MS = +(process.env.TICK_MS || 1000);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'server', 'data'));
const MAX_CLIENTS = +(process.env.MAX_CLIENTS || 1000);

fs.mkdirSync(DATA_DIR, { recursive: true });
const STATE_FILE = path.join(DATA_DIR, 'world.json');
const DECISIONS_FILE = path.join(DATA_DIR, 'decisions.jsonl');

const ckpt = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/checkpoints/default.json'), 'utf8'));
const policy = createQNet({ weights: ckpt.weights }).policy;

let svc = load();
function load() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (s && s.v === 1 && s.world) return s;
  } catch { /* first start */ }
  return createService();
}
function save() {
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(svc));
  fs.renameSync(tmp, STATE_FILE);
}
function flushDecisions() {
  const log = takeDecisionLog(svc);
  if (log.length) fs.appendFile(DECISIONS_FILE, log.map(x => JSON.stringify({ time: new Date().toISOString(), ...x })).join('\n') + '\n', () => {});
}

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2'
};
const PUBLIC = ['index.html', 'play', 'site', 'engine', 'vendor', 'data', 'docs', 'legacy', 'favicon.svg', 'manifest.webmanifest', 'LICENSE'];
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss: https://*.supabase.co wss://*.supabase.co; worker-src 'self' blob:; media-src 'self' blob: data:; frame-ancestors 'none'"
};

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  if (rel.endsWith('/') || rel === 'play') rel = rel.replace(/\/?$/, '/') + 'index.html';
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
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, tick: svc.world.tick, players: clients.size }));
    return;
  }
  if (req.url === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }).end(JSON.stringify(publicState(svc)));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.writeHead(405).end();
  serveStatic(req, res);
});

// ---------------------------------------------------------------------------
// Minimal RFC 6455 WebSocket (text frames only)
// ---------------------------------------------------------------------------
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_FRAME = 16 * 1024;
const clients = new Map(); // socket -> { id, msgs, windowStart }

function encodeFrame(str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) header = Buffer.from([0x81, len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, payload]);
}
const send = (sock, obj) => { if (!sock.destroyed && sock.writable) sock.write(encodeFrame(JSON.stringify(obj))); };
function broadcast(obj) {
  const frame = encodeFrame(JSON.stringify(obj));
  for (const sock of clients.keys()) if (!sock.destroyed && sock.writable) sock.write(frame);
}

server.on('upgrade', (req, sock) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws' || clients.size >= MAX_CLIENTS) return sock.destroy();
  const key = req.headers['sec-websocket-key'];
  if (!key) return sock.destroy();
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  sock.setNoDelay(true);
  const c = { id: crypto.randomUUID(), msgs: 0, windowStart: Date.now() };
  clients.set(sock, c);
  const p = upsertPlayer(svc, c.id, {}, Date.now());
  send(sock, { t: 'welcome', you: publicPlayer(p), villainActions: VILLAIN_ACTIONS, state: publicState(svc) });
  let buf = Buffer.alloc(0);
  sock.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    if (buf.length > MAX_FRAME * 2) return sock.destroy();
    while (buf.length >= 2) {
      const op = buf[0] & 0x0f;
      const masked = buf[1] & 0x80;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) return sock.destroy();
      if (!masked || len > MAX_FRAME) return sock.destroy();
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4);
      const data = Buffer.from(buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      if (op === 0x8) { sock.end(Buffer.from([0x88, 0])); return; }
      if (op === 0x9) { if (data.length < 126) sock.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; }
      if (op === 0x1) onMessage(sock, c, data.toString('utf8'));
    }
  });
  const bye = () => { clients.delete(sock); };
  sock.on('close', bye);
  sock.on('error', bye);
});

function onMessage(sock, c, text) {
  const now = Date.now();
  if (now - c.windowStart > 5000) { c.windowStart = now; c.msgs = 0; }
  if (++c.msgs > 25) return send(sock, { t: 'error', error: 'rate limited' });
  let m;
  try { m = JSON.parse(text); } catch { return; }
  if (!m || typeof m !== 'object') return;
  if (m.t === 'ping') { svc.players[c.id] && (svc.players[c.id].lastSeen = now); return send(sock, { t: 'pong', at: m.at }); }
  if (m.t === 'agents') return send(sock, { t: 'agents', agents: agentsDetail(svc) });
  const res = applyAction(svc, c.id, m, now);
  if (m.t === 'hello') return send(sock, { t: 'you', you: res.you });
  send(sock, { t: 'result', result: res, you: publicPlayer(svc.players[c.id]) });
  if (res.kind === 'vote' && res.ok && !res.pending) broadcast({ t: 'decided', by: res.by, dilemma: res.dilemma, choice: res.choice, result: res.result });
  if (res.kind === 'villain' && res.ok) broadcast({ t: 'attack', by: res.by, attack: res.attack });
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
setInterval(() => {
  const now = Date.now();
  for (const c of clients.values()) if (svc.players[c.id]) svc.players[c.id].lastSeen = now;
  advance(svc, 1, policy, now);
  flushDecisions();
  broadcast({ t: 'state', state: publicState(svc, now) });
  for (const [sock, c] of clients) if (svc.players[c.id]) send(sock, { t: 'you', you: publicPlayer(svc.players[c.id]) });
}, TICK_MS);
setInterval(save, 60_000);
process.on('SIGINT', () => { save(); process.exit(0); });
process.on('SIGTERM', () => { save(); process.exit(0); });

server.listen(PORT, () => {
  console.log(`WorldMatrix shared world on http://localhost:${PORT}  (game: /play/, WebSocket /ws, tick ${TICK_MS} ms, data ${DATA_DIR})`);
});

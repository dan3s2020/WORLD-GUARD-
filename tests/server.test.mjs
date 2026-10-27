// Multiplayer server test: starts the real server and connects two players.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 18000 + Math.floor(Math.random() * 1000);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-'));

function client(role) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    const st = { ws, inbox: [], state: null, you: null };
    ws.onmessage = e => { const m = JSON.parse(e.data); st.inbox.push(m); if (m.state) st.state = m.state; if (m.you) st.you = m.you; };
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', role, name: `test-${role}` })); resolve(st); };
    ws.onerror = reject;
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));

test('shared world: anonymous players, teacher decisions, villain attacks, safe static serving', async t => {
  const srv = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, PORT: String(PORT), TICK_MS: '120', DATA_DIR: DATA }, stdio: 'ignore' });
  t.after(() => srv.kill());
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/api/health`); break; } catch { await wait(100); } }

  const teacher = await client('teacher');
  const villain = await client('villain');
  await wait(600);
  assert.equal(teacher.you.role, 'teacher');
  assert.equal(teacher.state.online, 2);

  villain.ws.send(JSON.stringify({ t: 'villain', kind: 'worm', city: 'ro' }));
  teacher.ws.send(JSON.stringify({ t: 'villain', kind: 'worm', city: 'ro' }));
  await wait(400);
  assert.ok(villain.inbox.some(m => m.t === 'attack'), 'villain attack applied');
  assert.ok(teacher.inbox.some(m => m.t === 'error'), 'teacher cannot attack');

  let d = null;
  for (let i = 0; i < 100 && !d; i++) { await wait(100); d = teacher.state?.world?.dilemmas?.[0]; }
  assert.ok(d, 'a dilemma reached the teacher');
  assert.ok(!('episode' in d), 'hidden risk never leaves the server');
  teacher.ws.send(JSON.stringify({ t: 'decide', dilemma: d.id, choice: d.options[0].id }));
  await wait(400);
  assert.ok(teacher.inbox.some(m => m.t === 'decided' && m.dilemma === d.id));
  const log = fs.readFileSync(path.join(DATA, 'decisions.jsonl'), 'utf8').trim().split('\n');
  assert.ok(log.length >= 1 && JSON.parse(log[0]).choice);

  assert.equal((await fetch(`http://127.0.0.1:${PORT}/server/server.mjs`)).status, 404);
  assert.equal((await fetch(`http://127.0.0.1:${PORT}/engine/planet.js`)).status, 200);
  assert.equal((await fetch(`http://127.0.0.1:${PORT}/%2e%2e/package.json`)).status, 404);
  teacher.ws.close(); villain.ws.close();
});

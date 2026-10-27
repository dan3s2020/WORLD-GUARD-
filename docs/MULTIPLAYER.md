# Shared world (multiplayer, no accounts)

```bash
node server/server.mjs                     # PORT=8787 by default
PORT=80 TICK_MS=1000 DATA_DIR=/var/lib/worldguard node server/server.mjs
docker build -t worldguard . && docker run -p 8787:8787 -v wg-data:/app/server/data worldguard
```

* One authoritative planet per server; every visitor joins it. One tick = one simulated hour (`TICK_MS`, default 1 s).
* Players are anonymous (random callsign, optional nickname of 3–20 letters/digits). Roles: `teacher`, `villain`, `spectator`.
* Teachers answer dilemmas (first valid answer wins). Villains spend compute credits (start 12,000, +150/tick, max 60,000; 1.5 s cooldown).
* The world is saved every minute to `DATA_DIR/world.json`; after an extinction it resets with a new seed one minute later.
* `DATA_DIR/decisions.jsonl` collects human decisions (no personal data beyond the callsign).
* Endpoints: `GET /api/health`, `GET /api/state`, WebSocket `/ws`. Only `index.html`, `site/`, `engine/`, `vendor/`, `data/`, `docs/`, `legacy/` are served.

## Protocol (JSON text frames)

Client → server

| message | meaning |
|---|---|
| `{"t":"hello","role":"teacher","name":"Ana"}` | set role / nickname |
| `{"t":"decide","dilemma":17,"choice":"insist_safe"}` | answer a dilemma (teacher) |
| `{"t":"villain","kind":"worm","city":"ro"}` | villain action (see `VILLAIN_ACTIONS`) |
| `{"t":"agent","id":"AG-001"}` | request one agent's decision history |

Server → client: `welcome`, `state` (every tick: world snapshot, online count, roles, leaderboard), `you`, `decided`, `attack`, `agent`, `error`, `reset`.

The server validates every message and rate-limits each connection (20 messages / 5 s). Hidden episode state (the true risk) never leaves the server.

## Hosting the public world

GitHub Pages serves the website only (single-player local world). For the shared world, run the server on any Node host (a small VPS, Fly.io, Render, Railway…) and open the site from that host, or point a Pages build to it with `?server=wss://your-host/ws`.

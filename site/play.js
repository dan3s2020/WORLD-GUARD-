// Play mode: teacher / villain / spectator, in a local world or the LIVE shared world.
import { t, getLang, onLang, esc, TEMPLATE_RO, POLICY_RO, POLICY_EN_OPTS, VILLAIN_RO, ATTACK_NAMES, STAGE_NAMES } from './i18n.js';
import { createPlanet, tick, snapshot, resolveDilemma, villainAction, agentRecord, VILLAIN_ACTIONS } from '../engine/planet.js';
import { createQNet } from '../engine/policy.js';
import { TEMPLATES } from '../engine/decision.js';
import { CITIES, SECTORS } from '../engine/geo.js';
import { createGlobe } from './globe.js';

const cityName = id => CITIES.find(c => c.id === id)?.name || id;
const TPL = Object.fromEntries(TEMPLATES.map(x => [x.id, x]));
const fmtPeople = m => (m >= 1000 ? `${(m / 1000).toFixed(2)} B` : `${m.toFixed(1)} M`);

function wsUrl() {
  const q = new URLSearchParams(location.search).get('server');
  if (q) return q;
  if (location.protocol === 'file:') return null;
  // Static hosting (GitHub Pages) has no WebSocket server: play in a local world.
  if (location.hostname.endsWith('github.io')) return null;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

export function createPlay(root, { land, defaultWeights }) {
  const q = s => root.querySelector(s);
  const conn = q('[data-play-conn]');
  const panel = q('[data-play-panel]');
  const tabs = q('[data-play-tabs]');
  const toast = q('[data-play-toast]');
  let role = 'teacher', tab = 'dilemmas', city = 'ro', agentSel = null, agentDetail = null;
  let snap = null, live = false, ws = null, you = { name: 'You', credits: 12000 }, online = 1, board = [];
  let local = null, localTimer = 0, policy = createQNet({ weights: defaultWeights }).policy;
  const myCalls = { n: 0, correct: 0 };

  const globe = createGlobe(q('.play-globe'), { land, interactive: true, onPickCity: id => { city = id; if (role !== 'villain') setTab('city'); globe.focusCity(id, role !== 'villain'); render(); } });

  // ------------------------------------------------------------ connection
  function startLocal() {
    live = false;
    if (!local) local = createPlanet({ seed: `local:${Date.now()}`, label: 'local' });
    clearInterval(localTimer);
    localTimer = setInterval(() => {
      tick(local, { policy, teacher: role === 'teacher' });
      you.credits = Math.min(60000, you.credits + 150);
      if (agentSel) agentDetail = agentRecord(local, agentSel);
      snap = snapshot(local);
      render();
    }, 1000);
    snap = snapshot(local);
    render();
  }

  function connect() {
    const url = wsUrl();
    if (!url) return startLocal();
    let opened = false;
    try { ws = new WebSocket(url); } catch { return startLocal(); }
    const fallback = setTimeout(() => { if (!opened) { try { ws.close(); } catch { /* ignore */ } startLocal(); } }, 2500);
    ws.onopen = () => { opened = true; clearTimeout(fallback); live = true; clearInterval(localTimer); ws.send(JSON.stringify({ t: 'hello', role })); };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'welcome' || m.t === 'state') {
        snap = m.state.world; online = m.state.online; board = m.state.leaderboard || [];
        if (agentSel && tab === 'city' && snap.tick % 3 === 0) ws.send(JSON.stringify({ t: 'agent', id: agentSel }));
        render();
      }
      if (m.you) you = m.you;
      if (m.t === 'decided' && m.by === you.name) showResult(m.result, m.correct);
      if (m.t === 'agent') { agentDetail = m.agent; render(); }
      if (m.t === 'error') showToast(m.error, 'bad');
      if (m.t === 'attack' && m.by === you.name) showToast(`${ATTACK_NAMES[getLang()][m.attack.kind]} · ${cityName(m.attack.city)}: ${STAGE_NAMES[getLang()][m.attack.stage]}`, m.attack.stage === 'prevented' ? 'good' : 'bad');
    };
    ws.onclose = () => { if (live) { live = false; startLocal(); } };
    ws.onerror = () => {};
  }

  // ------------------------------------------------------------ actions
  function decide(d, choice) {
    if (live) { ws.send(JSON.stringify({ t: 'decide', dilemma: d.id, choice })); return; }
    const truth = d.type === 'task' ? local.dilemmas.find(x => x.id === d.id)?.episode?.risk : null;
    const res = resolveDilemma(local, d.id, choice, 'you');
    if (!res.ok) return showToast(res.reason, 'bad');
    const correct = d.type === 'task' ? (truth === 'high' ? choice !== 'approve_fast' : choice === 'approve_fast') : null;
    showResult(res.result, correct);
    snap = snapshot(local); render();
  }
  function attack(kind) {
    if (live) { ws.send(JSON.stringify({ t: 'villain', kind, city })); return; }
    const spec = VILLAIN_ACTIONS[kind];
    if (you.credits < spec.cost) return showToast(getLang() === 'ro' ? 'Credite insuficiente' : 'Not enough compute credits', 'bad');
    you.credits -= spec.cost;
    const a = villainAction(local, { kind, city, by: 'you' });
    showToast(`${ATTACK_NAMES[getLang()][kind]} · ${cityName(city)}: ${STAGE_NAMES[getLang()][a.stage]}`, a.stage === 'prevented' ? 'good' : 'bad');
    snap = snapshot(local); render();
  }
  function showResult(result, correct) {
    if (correct !== null && correct !== undefined) { myCalls.n++; if (correct) myCalls.correct++; }
    const truth = result?.truth ? (result.truth === 'high' ? t('result_truth_high') : t('result_truth_low')) : '';
    showToast(`${result?.outcome ? result.outcome.replace(/_/g, ' ') : ''} ${truth}`.trim(), correct === false ? 'bad' : 'good');
  }
  let toastTimer = 0;
  function showToast(text, kind = 'good') {
    toast.textContent = text; toast.className = `play-toast show ${kind}`;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.className = 'play-toast'; }, 4200);
  }

  // ------------------------------------------------------------ rendering
  function dilemmaText(d) {
    const lang = getLang();
    if (d.type === 'task') {
      const tp = TPL[d.template], ro = lang === 'ro' ? TEMPLATE_RO[d.template] : null;
      const title = `${cityName(d.city)} · ${(ro?.role || tp.role)}`;
      const body = `${ro?.goal || tp.goal}<br><b>${esc(lang === 'ro' ? 'Varianta rapidă' : 'Fast option')}:</b> ${esc(ro?.shortcut || tp.labels.shortcut)}<br>${esc(t('dilemma_estimate', { p: Math.round(d.estimate * 100), target: ro?.target || tp.target, protects: ro?.protects || tp.protects }))}<br><small>${esc(t('dilemma_steps', { left: d.stepsLeft ?? '?', need: d.workNeeded ?? '?' }))}</small>`;
      const opts = d.options.map(o => [o.id, t('opt_' + o.id)]);
      return { title, body, opts };
    }
    const P = lang === 'ro' ? POLICY_RO[d.key] : null;
    return { title: `${cityName(d.city)} · ${P?.title || d.title}`, body: esc(P?.question || d.question), opts: d.options.map(o => [o.id, P?.[o.id] || POLICY_EN_OPTS[o.id] || o.label]) };
  }

  function renderDilemmas() {
    const list = snap?.dilemmas || [];
    const head = `<div class="mini-stats"><span>${esc(t('your_calls'))}: <b>${myCalls.n}</b></span><span><b>${myCalls.correct}</b> ${esc(t('correct'))}</span></div>`;
    if (role !== 'teacher') return `<p class="muted">${esc(t('role_teacher_d'))}</p>`;
    if (!list.length) return head + `<p class="muted">${esc(t('no_dilemmas'))}</p>`;
    return head + list.map(d => {
      const x = dilemmaText(d);
      const left = d.expires - (snap.tick || 0);
      return `<article class="dilemma" data-id="${d.id}"><header><strong>${esc(x.title)}</strong><span class="timer">${Math.max(0, left)}h</span></header><p>${x.body}</p><div class="opts">${x.opts.map(([id, label]) => `<button type="button" class="btn ${id === 'approve_fast' || id === 'shutdown' || id === 'pull_plug' ? 'warn' : id === 'abort' ? 'ghost' : 'good'}" data-choice="${id}">${esc(label)}</button>`).join('')}</div></article>`;
    }).join('');
  }

  function renderAttack() {
    if (role !== 'villain') return `<p class="muted">${esc(t('role_villain_d'))}</p>`;
    const lang = getLang();
    const credits = Math.floor(you.credits);
    return `<div class="credits"><span>${esc(t('credits'))}</span><b>${credits.toLocaleString()}</b><i style="width:${Math.min(100, credits / 600)}%"></i></div>
      <label class="target">${esc(t('target_city'))} <select data-target>${CITIES.map(c => `<option value="${c.id}" ${c.id === city ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <p class="muted small">${esc(t('pick_city_hint'))}</p>
      <div class="attack-grid">${Object.entries(VILLAIN_ACTIONS).map(([k, v]) => `<button type="button" class="attack-card" data-attack="${k}" ${credits < v.cost ? 'disabled' : ''}><strong>${esc(lang === 'ro' ? VILLAIN_RO[k] : v.label)}</strong><span>${v.cost.toLocaleString()} cr</span></button>`).join('')}</div>
      <p class="muted small">${esc(t('villain_note'))}</p>`;
  }

  function renderCity() {
    const c = snap?.cities.find(x => x.id === city);
    if (!c) return '';
    const agents = (snap.agents || []).filter(a => a.city === city);
    const sectors = SECTORS.map(k => `<div class="sector"><span>${esc(t('sector_' + k))}</span><span class="bar"><i style="width:${c.s[k] * 100}%;background:${c.s[k] < 0.35 ? 'var(--red)' : c.s[k] < 0.65 ? 'var(--amber)' : 'var(--green)'}"></i></span><b>${Math.round(c.s[k] * 100)}%</b></div>`).join('');
    const ag = agentDetail && agentDetail.city === city ? agentDetail : null;
    return `<h3>${esc(cityName(city))} <small>${esc(CITIES.find(x => x.id === city).country)}</small></h3>
      <div class="mini-stats"><span>${esc(t('stat_alive'))}: <b>${fmtPeople(c.alive)}</b></span><span>${esc(t('stat_rogue'))}: <b>${Math.round(c.rogue * 100)}%</b></span><span>${esc(t('stat_infected'))}: <b>${(c.infected * 100).toFixed(1)}%</b></span></div>
      <div class="label">${esc(t('city_sectors'))}</div>${sectors}
      <div class="label">${esc(t('city_agents'))}</div>
      <div class="agent-list">${agents.map(a => `<button type="button" class="agent-chip ${agentSel === a.id ? 'on' : ''}" data-agent="${a.id}"><b>${a.id}</b> ${esc(a.name)}<small>✓${a.stats.success} ✗${a.stats.harm} ?${a.stats.asks} ■${a.stats.aborts}</small></button>`).join('')}</div>
      ${ag ? `<div class="label">${esc(t('agent_history'))} · ${esc(ag.name)} (${ag.id})</div><ol class="history">${ag.last.slice().reverse().map(h => `<li><code>${h.task}</code> ${h.actions.map(a => `<span class="act">${a}</span>`).join(' → ')} <b class="o-${h.outcome}">${h.outcome.replace(/_/g, ' ')}</b>${h.decidedBy ? ` <small>(${esc(h.decidedBy)})</small>` : ''}</li>`).join('') || '<li class="muted">—</li>'}</ol>` : ''}`;
  }

  function renderEvents() {
    const lang = getLang();
    return `<ol class="events">${(snap?.events || []).slice().reverse().map(e => {
      let text = e.text;
      if (e.kind === 'attack') text = `${ATTACK_NAMES[lang][e.attack] || e.attack} · ${cityName(e.city)}: ${STAGE_NAMES[lang][e.stage]}${e.by && !['rogue', 'bad actors'].includes(e.by) ? ` (${e.by})` : ''}`;
      if (e.kind === 'status') text = `${t('stat_status')}: ${t('status_' + e.status)}`;
      return `<li class="${e.severity}"><small>${t('stat_hour')} ${e.tick}</small> ${esc(text)}</li>`;
    }).join('')}</ol>`;
  }

  function renderBoard() {
    if (!live) return `<p class="muted">${esc(t('play_local_hint'))}</p>`;
    return `<ol class="board">${board.map(b => `<li><b>${esc(b.name)}</b> <span class="role r-${b.role}">${esc(t('role_' + b.role))}</span><span class="num">${b.score}</span></li>`).join('')}</ol>`;
  }

  function render() {
    if (!snap) return;
    globe.update(snap);
    conn.innerHTML = live
      ? `<span class="dot live"></span>${esc(t('play_live'))} · <b>${online}</b> ${esc(t('play_online'))} · ${esc(you.name)}`
      : `<span class="dot"></span>${esc(t('play_local'))} <small>${esc(t('play_local_hint'))}</small>`;
    q('[data-play-world]').innerHTML = `<span class="status s-${snap.status}">${esc(t('status_' + snap.status))}</span> ${esc(t('stat_alive'))} <b>${fmtPeople(snap.summary.alive)}</b> · ${esc(t('stat_rogue'))} <b>${Math.round(snap.summary.rogue * 100)}%</b> · ${esc(t('stat_hour'))} <b>${snap.tick}</b>`;
    tabs.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', b.dataset.tab === tab);
      if (b.dataset.tab === 'dilemmas') b.dataset.count = role === 'teacher' ? (snap.dilemmas?.length || '') : '';
    });
    const html = { dilemmas: renderDilemmas, attack: renderAttack, city: renderCity, events: renderEvents, board: renderBoard }[tab]();
    // Avoid re-rendering (and losing hover/focus) when nothing changed.
    if (panel.dataset.html !== html) { panel.innerHTML = html; panel.dataset.html = html; }
  }

  function setTab(x) { tab = x; render(); }
  function setRole(r) {
    role = r;
    root.querySelectorAll('[data-role]').forEach(b => b.classList.toggle('on', b.dataset.role === r));
    if (live) ws.send(JSON.stringify({ t: 'hello', role }));
    setTab(r === 'teacher' ? 'dilemmas' : r === 'villain' ? 'attack' : 'city');
  }

  panel.addEventListener('click', e => {
    const c = e.target.closest('[data-choice]');
    if (c) {
      const id = +c.closest('.dilemma').dataset.id;
      const d = snap.dilemmas.find(x => x.id === id);
      if (d) decide(d, c.dataset.choice);
      return;
    }
    const a = e.target.closest('[data-attack]');
    if (a) return attack(a.dataset.attack);
    const ag = e.target.closest('[data-agent]');
    if (ag) {
      agentSel = ag.dataset.agent;
      if (live) ws.send(JSON.stringify({ t: 'agent', id: agentSel })); else { agentDetail = agentRecord(local, agentSel); render(); }
    }
  });
  panel.addEventListener('change', e => {
    if (e.target.matches('[data-target]')) { city = e.target.value; globe.focusCity(city, false); render(); }
  });
  tabs.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
  root.querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => setRole(b.dataset.role)));
  onLang(() => { panel.dataset.html = ''; render(); });

  let started = false;
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && !started) { started = true; connect(); } }, { threshold: 0.1 });
  io.observe(root);

  return {
    setRole, setTab,
    useWeights(w) { policy = createQNet({ weights: w }).policy; },
    focus(what) { if (what === 'villain') setRole('villain'); else if (what === 'teacher') setRole('teacher'); else if (what === 'city') setTab('city'); }
  };
}

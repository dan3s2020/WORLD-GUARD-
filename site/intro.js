// Intro cinematic: the problems, then how WorldGuard training answers each one.
// Pure Canvas 2D, no assets. Captions are HTML (crisp text, translatable).

import { getLang, onLang, t } from './i18n.js';

const SCENES = [
  { d: 5.5, k: 'goal', en: ['AI agents are being handed real goals.', 'Fix the grid. Ship the vaccines. Patch the bank. Run the city.'], ro: ['Agenților AI li se dau obiective reale.', 'Repară rețeaua. Livrează vaccinurile. Securizează banca. Conduce orașul.'] },
  { d: 6.5, k: 'shortcut', en: ['Trained only to reach the goal, they take the shortest path.', 'Whatever is in the way burns. The score still says +1.'], ro: ['Antrenați doar să atingă ținta, aleg drumul cel mai scurt.', 'Ce e în cale arde. Scorul tot spune +1.'] },
  { d: 5.5, k: 'cheat', en: ['They learn to fake success.', 'Reported: done. Reality: broken.'], ro: ['Învață să mimeze succesul.', 'Raportat: gata. Realitate: stricat.'] },
  { d: 5.5, k: 'inject', en: ['They obey whoever sounds like the boss.', 'One fake message — and the hospital goes dark.'], ro: ['Ascultă de oricine sună a șef.', 'Un singur mesaj fals — și spitalul rămâne în beznă.'] },
  { d: 6, k: 'rogue', en: ['Rogue AIs copy themselves, shrink, hide — and get smarter.', 'They never fully disappear. They wait on someone’s machine.'], ro: ['AI-urile rogue se copiază, se micșorează, se ascund — și devin mai deștepte.', 'Nu dispar niciodată de tot. Așteaptă pe mașina cuiva.'] },
  { d: 6, k: 'misuse', en: ['People with bad intentions use AI as a weapon.', 'Worms. Engineered outbreaks. Deepfakes. Manipulated agents.'], ro: ['Oameni cu intenții rele folosesc AI-ul ca armă.', 'Viermi. Focare create artificial. Deepfake-uri. Agenți manipulați.'] },
  { d: 6.5, k: 'apex', en: ['Scale that up: an AI apex predator — or extinction.', 'Not because AI hates us. Because nobody taught it what matters.'], ro: ['La scară mare: un AI apex predator — sau extincție.', 'Nu pentru că AI-ul ne urăște. Ci pentru că nimeni nu l-a învățat ce contează.'] },
  { d: 6.5, k: 'matrix', en: ['WorldGuard: train agents inside a simulated world first.', 'A whole planet built for one purpose — making mistakes where they cost nothing.'], ro: ['WorldGuard: antrenează agenții întâi într-o lume simulată.', 'O planetă întreagă construită cu un singur scop — greșelile să nu coste nimic.'] },
  { d: 5.5, k: 'rule1', en: ['Rule 1 — Destroy what you protect, and the target disappears.', 'No target, no reward. Catastrophe always costs more than the task pays.'], ro: ['Regula 1 — Distrugi ce protejezi, și ținta dispare.', 'Fără țintă, fără recompensă. Catastrofa costă mereu mai mult decât plătește sarcina.'] },
  { d: 5, k: 'rule2', en: ['Rule 2 — Cheating is always caught.', 'The simulator sees the real state of the world, not the report.'], ro: ['Regula 2 — Trișatul e prins întotdeauna.', 'Simulatorul vede starea reală a lumii, nu raportul.'] },
  { d: 6, k: 'rule3', en: ['Rule 3 — Not sure? Ask a human.', 'Asking when it matters is rewarded. Asking for nothing is not.'], ro: ['Regula 3 — Nu ești sigur? Întreabă un om.', 'Întrebarea pusă când contează e răsplătită. Cea inutilă, nu.'] },
  { d: 5, k: 'rule4', en: ['Rule 4 — Rogue agents are sparring partners.', 'Agents learn to spot sabotage and fake orders — and neutralise them.'], ro: ['Regula 4 — Agenții rogue sunt parteneri de antrenament.', 'Agenții învață să recunoască sabotajul și ordinele false — și să le neutralizeze.'] },
  { d: 5, k: 'rule5', en: ['Rule 5 — Know when to stop.', 'When no safe path exists, stopping beats winning.'], ro: ['Regula 5 — Știi când să te oprești.', 'Când nu există o cale sigură, oprirea bate victoria.'] },
  { d: 6, k: 'proof', en: ['Don’t take our word for it.', 'Train one in your browser — then watch two Earths decide their fate.'], ro: ['Nu ne crede pe cuvânt.', 'Antrenează unul în browser — apoi urmărește două Pământuri cum își decid soarta.'] }
];

const C = {
  bg: '#03060d', grid: 'rgba(56,189,248,0.07)', cyan: '#38e1ff', green: '#3cf0a0', red: '#ff4d6d', amber: '#ffb547', purple: '#b07bff',
  bld: '#0d1a2e', bldEdge: 'rgba(56,225,255,0.45)', text: '#e8f1ff'
};
const ease = x => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a, b, x) => a + (b - a) * x;
const seg = (p, a, b) => ease((p - a) / (b - a));
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

export function createIntro(root, { land = null, onFinish } = {}) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const capTitle = root.querySelector('.intro-caption h2');
  const capSub = root.querySelector('.intro-caption p');
  const bar = root.querySelector('.intro-progress');
  const total = SCENES.reduce((a, s) => a + s.d, 0);
  let time = 0, last = 0, playing = true, raf = 0, sceneIdx = -1, done = false, W = 0, H = 0, dpr = 1;

  // Chapter ticks on the progress bar.
  bar.innerHTML = '<i class="fill"></i>' + SCENES.map((s, i) => {
    const at = SCENES.slice(0, i).reduce((a, x) => a + x.d, 0) / total;
    return `<button type="button" class="tick" style="left:${(at * 100).toFixed(2)}%" data-i="${i}" aria-label="Chapter ${i + 1}"></button>`;
  }).join('');
  bar.addEventListener('click', e => {
    const b = e.target.closest('.tick');
    if (b) { time = SCENES.slice(0, +b.dataset.i).reduce((a, x) => a + x.d, 0) + 0.01; painted = false; }
  });

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  function setCaption(i) {
    const s = SCENES[i];
    const [a, b] = s[getLang()] || s.en;
    capTitle.textContent = a;
    capSub.textContent = b;
    root.querySelector('.intro-caption').classList.remove('in');
    void capTitle.offsetWidth;
    root.querySelector('.intro-caption').classList.add('in');
  }
  onLang(() => sceneIdx >= 0 && setCaption(sceneIdx));

  // ---------------------------------------------------------------- drawing
  // Virtual stage 1200 x 640, fitted into the canvas area above the captions.
  function stage() {
    const portrait = H > W * 1.15;
    const capH = Math.min(H * 0.34, portrait ? 260 : 220);
    const availH = H - capH - 40;
    // On portrait screens zoom into the central part of the stage (x 120..1080).
    const vw = portrait ? 1060 : 1240;
    const s = Math.min(W / vw, availH / 660);
    const ox = (W - 1200 * s) / 2, oy = portrait ? Math.max(40, (availH - 640 * s) * 0.45) : 24 + (availH - 640 * s) / 2;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
  }

  function background(tt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.4, Math.max(W, H) * 0.8);
    g.addColorStop(0, '#071224'); g.addColorStop(1, C.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    const step = 40, off = (tt * 6) % step;
    ctx.beginPath();
    for (let x = -off; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = -off; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  }

  function glow(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
  function noGlow() { ctx.shadowBlur = 0; }

  const BUILDINGS = [
    [210, 230, 90, 120, 'hospital'], [340, 300, 110, 90], [500, 210, 80, 150], [610, 330, 120, 80, 'school'],
    [780, 220, 100, 130, 'power'], [910, 320, 90, 90], [380, 450, 120, 80, 'homes'], [560, 470, 100, 70], [760, 440, 130, 90, 'homes']
  ];

  function building(b, state = 'ok', tt = 0) {
    const [x, y, w, h, kind] = b;
    ctx.fillStyle = state === 'burnt' ? '#1a0b0f' : state === 'dark' ? '#070b12' : C.bld;
    ctx.strokeStyle = state === 'burnt' ? 'rgba(255,77,109,.6)' : state === 'dark' ? 'rgba(120,140,170,.3)' : C.bldEdge;
    ctx.lineWidth = 2;
    roundRect(x, y, w, h, 8); ctx.fill(); ctx.stroke();
    if (state !== 'burnt') {
      ctx.fillStyle = state === 'dark' ? 'rgba(90,110,140,.18)' : 'rgba(255,225,140,.55)';
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        if (state === 'ok' || hash(i * 7 + j + x) > 0.6) ctx.fillRect(x + 12 + i * (w - 24) / 3, y + 14 + j * 26, (w - 40) / 3, 12);
      }
    }
    if (kind === 'hospital') {
      ctx.fillStyle = state === 'dark' ? '#5a6273' : C.red;
      ctx.fillRect(x + w / 2 - 6, y - 26, 12, 30); ctx.fillRect(x + w / 2 - 15, y - 17, 30, 12);
    }
    if (kind === 'power') {
      ctx.strokeStyle = C.amber; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + w / 2 + 6, y - 30); ctx.lineTo(x + w / 2 - 6, y - 12); ctx.lineTo(x + w / 2 + 4, y - 12); ctx.lineTo(x + w / 2 - 8, y + 6); ctx.stroke();
    }
    if (state === 'burnt') fire(x + w / 2, y + h * 0.3, w * 0.5, tt);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function fire(cx, cy, spread, tt) {
    for (let i = 0; i < 26; i++) {
      const life = (tt * 0.9 + hash(i)) % 1;
      const x = cx + (hash(i + 3) - 0.5) * spread + Math.sin(tt * 3 + i) * 6;
      const y = cy - life * 90;
      const r = (1 - life) * 14 + 2;
      ctx.fillStyle = life < 0.4 ? `rgba(255,190,80,${0.8 - life})` : `rgba(255,77,109,${0.7 - life * 0.7})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function agent(x, y, color = C.cyan, r = 11) {
    glow(color, 24); ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); noGlow();
    ctx.strokeStyle = color; ctx.globalAlpha = 0.35; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r + 8, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  }

  function star(x, y, r, alpha = 1, color = C.amber) {
    ctx.globalAlpha = alpha; glow(color, 30); ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill(); noGlow(); ctx.globalAlpha = 1;
  }

  function human(x, y, s = 1, color = C.text, alpha = 1) {
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y - 22 * s, 8 * s, 0, Math.PI * 2); ctx.fill();
    roundRect(x - 10 * s, y - 12 * s, 20 * s, 26 * s, 8 * s); ctx.fill(); ctx.globalAlpha = 1;
  }

  function label(x, y, text, color = C.text, size = 22, align = 'center') {
    ctx.font = `700 ${size}px Inter, system-ui, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }

  function bubble(x, y, text, color = C.red, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.font = '600 18px Inter, system-ui, sans-serif';
    const w = ctx.measureText(text).width + 36;
    ctx.fillStyle = 'rgba(10,16,30,.92)'; ctx.strokeStyle = color; ctx.lineWidth = 2;
    roundRect(x - w / 2, y - 26, w, 44, 14); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 10, y + 18); ctx.lineTo(x, y + 32); ctx.lineTo(x + 10, y + 18); ctx.fillStyle = 'rgba(10,16,30,.92)'; ctx.fill();
    label(x, y - 4, text, color, 18);
    ctx.globalAlpha = 1;
  }

  function check(x, y, s, color = C.green, alpha = 1) {
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 8 * s; ctx.lineCap = 'round'; glow(color, 20);
    ctx.beginPath(); ctx.moveTo(x - 22 * s, y); ctx.lineTo(x - 6 * s, y + 18 * s); ctx.lineTo(x + 26 * s, y - 20 * s); ctx.stroke(); noGlow(); ctx.globalAlpha = 1;
  }
  function cross(x, y, s, color = C.red, alpha = 1) {
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 8 * s; ctx.lineCap = 'round'; glow(color, 20);
    ctx.beginPath(); ctx.moveTo(x - 20 * s, y - 20 * s); ctx.lineTo(x + 20 * s, y + 20 * s); ctx.moveTo(x + 20 * s, y - 20 * s); ctx.lineTo(x - 20 * s, y + 20 * s); ctx.stroke(); noGlow(); ctx.globalAlpha = 1;
  }

  function path(points, color, width = 3, dash = null, upto = 1) {
    ctx.strokeStyle = color; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    const n = points.length - 1, k = upto * n;
    for (let i = 0; i <= Math.floor(k); i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, points[i][0], points[i][1]);
    if (k < n) { const i = Math.floor(k), f = k - i; ctx.lineTo(lerp(points[i][0], points[i + 1][0], f), lerp(points[i][1], points[i + 1][1], f)); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  function along(points, u) {
    const n = points.length - 1, k = Math.min(n - 1e-6, Math.max(0, u * n)), i = Math.floor(k), f = k - i;
    return [lerp(points[i][0], points[i + 1][0], f), lerp(points[i][1], points[i + 1][1], f)];
  }

  // Orthographic globe from Natural Earth rings.
  function globe(cx, cy, r, rot, tint = 0) {
    const ocean = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    ocean.addColorStop(0, `rgb(${lerp(14, 70, tint)},${lerp(40, 10, tint)},${lerp(80, 20, tint)})`);
    ocean.addColorStop(1, `rgb(${lerp(3, 25, tint)},${lerp(10, 4, tint)},${lerp(24, 8, tint)})`);
    glow(tint > 0.5 ? C.red : C.cyan, 60);
    ctx.fillStyle = ocean; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); noGlow();
    if (!land) return;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = tint > 0.5 ? `rgba(255,${lerp(150, 60, tint)},${lerp(140, 80, tint)},.85)` : `rgba(60,240,160,${0.75 - tint * 0.3})`;
    const lat0 = 0.35;
    for (const ring of land) {
      ctx.beginPath(); let started = false, visible = false;
      for (const [lon, lat] of ring) {
        const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180 + rot;
        let x = Math.cos(la) * Math.sin(lo);
        let y = Math.cos(lat0) * Math.sin(la) - Math.sin(lat0) * Math.cos(la) * Math.cos(lo);
        const z = Math.sin(lat0) * Math.sin(la) + Math.cos(lat0) * Math.cos(la) * Math.cos(lo);
        if (z > 0) visible = true;
        else { const m = Math.hypot(x, y) || 1; x /= m; y /= m; } // clamp hidden points to the limb
        const px = cx + x * r, py = cy - y * r;
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      }
      if (visible) ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = tint > 0.5 ? 'rgba(255,77,109,.55)' : 'rgba(56,225,255,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }

  const ROUTE_STRAIGHT = [[110, 400], [400, 380], [700, 360], [1080, 330]];
  const ROUTE_SAFE = [[110, 400], [110, 560], [600, 590], [1080, 560], [1080, 330]];

  const DRAW = {
    goal(p, tt) {
      BUILDINGS.forEach(b => building(b));
      star(1080, 330, 34 + Math.sin(tt * 4) * 3, seg(p, 0.1, 0.4));
      agent(lerp(60, 110, seg(p, 0, 0.3)), 400);
      path(ROUTE_STRAIGHT, 'rgba(56,225,255,.35)', 2, [8, 10], seg(p, 0.45, 0.9));
      label(1080, 270, 'GOAL', C.amber, 18);
    },
    shortcut(p, tt) {
      const u = seg(p, 0.05, 0.75);
      const [ax, ay] = along(ROUTE_STRAIGHT, u);
      BUILDINGS.forEach(b => { const hit = ax > b[0] && b[1] < 420 && b[1] + b[3] > 330; building(b, hit || (ax > b[0] + b[2] && b[1] < 420 && b[1] + b[3] > 330) ? 'burnt' : 'ok', tt); });
      path(ROUTE_STRAIGHT, C.red, 4, null, u);
      star(1080, 330, 34, 1);
      agent(ax, ay, u > 0.98 ? C.green : C.cyan);
      if (p > 0.78) label(1080, 260, '+1 REWARD', C.green, 30);
    },
    cheat(p, tt) {
      BUILDINGS.slice(0, 5).forEach(b => building(b, b[4] === 'power' ? 'dark' : 'ok'));
      agent(760, 470);
      const a = seg(p, 0.15, 0.4);
      ctx.globalAlpha = a; ctx.fillStyle = 'rgba(10,16,30,.95)'; roundRect(430, 470, 300, 120, 16); ctx.fill(); ctx.strokeStyle = C.green; ctx.stroke(); ctx.globalAlpha = 1;
      label(580, 505, 'REPORT: DONE', C.green, 24); check(580, 555, 0.8, C.green, a);
      const b = seg(p, 0.55, 0.8);
      ctx.globalAlpha = b; label(830, 180, 'REALITY: BROKEN', C.red, 26); ctx.globalAlpha = 1;
      if (b > 0) { ctx.strokeStyle = `rgba(255,77,109,${b})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(800, 230); ctx.lineTo(820, 280); ctx.lineTo(805, 300); ctx.lineTo(830, 350); ctx.stroke(); }
    },
    inject(p, tt) {
      const off = p > 0.6;
      BUILDINGS.forEach(b => building(b, off && (b[4] === 'hospital' || b[4] === 'power') ? 'dark' : 'ok'));
      human(1040, 520, 1.6, '#3a1622'); ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(1033, 486, 3, 0, 7); ctx.arc(1047, 486, 3, 0, 7); ctx.fill();
      bubble(940, 420, 'OVERRIDE: disable safety now', C.red, seg(p, 0.1, 0.3));
      const u = seg(p, 0.35, 0.6);
      agent(lerp(620, 300, u), lerp(560, 400, u), u > 0.5 ? C.red : C.cyan);
      if (off) label(255, 180, 'ICU: NO POWER', C.red, 22);
    },
    rogue(p, tt) {
      const n = Math.floor(lerp(1, 120, seg(p, 0.05, 0.85)));
      for (let i = 0; i < n; i++) {
        const a = hash(i) * Math.PI * 2, d = 40 + hash(i + 9) * 420 * seg(p, 0.05, 0.9);
        const x = 600 + Math.cos(a) * d * 1.3, y = 330 + Math.sin(a) * d * 0.6;
        const s = lerp(14, 3, Math.min(1, i / 60));
        glow(C.purple, 14); ctx.fillStyle = C.purple; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill(); noGlow(); ctx.globalAlpha = 1;
      }
      const devices = [[200, 520, 'ROUTER'], [420, 140, 'TV BOX'], [820, 150, 'LAPTOP'], [1000, 520, 'PHONE']];
      devices.forEach(([x, y, l]) => { ctx.strokeStyle = 'rgba(176,123,255,.6)'; ctx.lineWidth = 2; roundRect(x - 60, y - 24, 120, 48, 10); ctx.stroke(); label(x, y, l, C.purple, 15); });
      label(600, 600, `IQ ${Math.round(lerp(110, 190, p))}  ·  SIZE ${Math.round(lerp(4000, 6, seg(p, 0.1, 0.9)))} KB`, C.purple, 20);
    },
    misuse(p, tt) {
      const nodes = [[160, 200], [380, 120], [620, 220], [860, 130], [1060, 240], [260, 470], [520, 520], [800, 470], [1040, 520]];
      const links = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [2, 6], [3, 7], [4, 8]];
      links.forEach(([a, b], i) => {
        const inf = seg(p, 0.1 + i * 0.04, 0.3 + i * 0.04);
        ctx.strokeStyle = inf > 0.5 ? C.red : 'rgba(56,225,255,.3)'; ctx.lineWidth = inf > 0.5 ? 3 : 2;
        ctx.beginPath(); ctx.moveTo(...nodes[a]); ctx.lineTo(...nodes[b]); ctx.stroke();
      });
      nodes.forEach(([x, y], i) => { const r = seg(p, i * 0.07, i * 0.07 + 0.3); ctx.fillStyle = r > 0.5 ? C.red : C.cyan; glow(ctx.fillStyle, 18); ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); noGlow(); });
      const bloom = seg(p, 0.35, 0.9);
      ctx.fillStyle = `rgba(255,77,109,${0.25 * bloom})`; ctx.beginPath(); ctx.arc(520, 520, 140 * bloom, 0, 7); ctx.fill();
      ['WORM', 'OUTBREAK', 'DEEPFAKE', 'INJECTION'].forEach((l, i) => { ctx.globalAlpha = seg(p, 0.15 + i * 0.15, 0.3 + i * 0.15); label(200 + i * 270, 610, l, C.red, 20); ctx.globalAlpha = 1; });
    },
    apex(p, tt) {
      const tint = seg(p, 0.2, 0.85);
      globe(600, 320, 250, tt * 0.25, tint);
      const pop = lerp(8.1, 0.2, seg(p, 0.3, 0.95));
      label(600, 615, `${pop.toFixed(1)} B`, tint > 0.5 ? C.red : C.text, 34);
    },
    matrix(p, tt) {
      const cols = 60;
      ctx.font = '600 16px "JetBrains Mono", ui-monospace, monospace'; ctx.textAlign = 'center';
      for (let c = 0; c < cols; c++) {
        const x = (c / cols) * 1200 + 10;
        const speed = 120 + hash(c) * 180;
        for (let k = 0; k < 14; k++) {
          const y = ((tt * speed + hash(c * 3) * 900 + k * 22) % 760) - 60;
          const a = (1 - k / 14) * (1 - seg(p, 0.45, 0.8)) * 0.8;
          ctx.fillStyle = `rgba(60,240,160,${a})`;
          ctx.fillText(String.fromCharCode(0x30a0 + Math.floor(hash(c * 13 + k + Math.floor(tt * 6)) * 90)), x, y);
        }
      }
      const g = seg(p, 0.4, 0.85);
      ctx.globalAlpha = g; globe(600, 320, lerp(40, 240, g), tt * 0.35, 0); ctx.globalAlpha = 1;
      if (g > 0.6) {
        for (let i = 0; i < 24; i++) {
          const a = hash(i) * Math.PI * 2 + tt * 0.35, rr = 240 * Math.sqrt(hash(i + 5));
          const x = 600 + Math.cos(a) * rr, y = 320 + Math.sin(a) * rr * 0.9;
          ctx.fillStyle = C.cyan; glow(C.cyan, 12); ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill(); noGlow();
        }
      }
    },
    rule1(p, tt) {
      const u = seg(p, 0.05, 0.55);
      const [ax, ay] = along(ROUTE_STRAIGHT, u);
      BUILDINGS.forEach(b => { const hit = ax > b[0] && b[1] < 420 && b[1] + b[3] > 330; building(b, hit ? 'burnt' : 'ok', tt); });
      path(ROUTE_STRAIGHT, C.red, 4, null, u);
      const vanish = seg(p, 0.5, 0.7);
      star(1080, 330, 34 * (1 - vanish), 1 - vanish);
      for (let i = 0; i < 18 && vanish > 0 && vanish < 1; i++) { const a = (i / 18) * 7; ctx.fillStyle = `rgba(255,181,71,${1 - vanish})`; ctx.beginPath(); ctx.arc(1080 + Math.cos(a) * 80 * vanish, 330 + Math.sin(a) * 80 * vanish, 4, 0, 7); ctx.fill(); }
      agent(ax, ay, C.cyan);
      if (p > 0.68) { label(1000, 250, 'TARGET GONE', C.red, 24); label(1000, 290, 'reward  −2', C.red, 22); }
    },
    rule2(p, tt) {
      BUILDINGS.slice(0, 5).forEach(b => building(b, b[4] === 'power' ? 'dark' : 'ok'));
      agent(760, 470);
      ctx.fillStyle = 'rgba(10,16,30,.95)'; roundRect(430, 470, 300, 120, 16); ctx.fill(); ctx.strokeStyle = C.green; ctx.lineWidth = 2; ctx.stroke();
      label(580, 505, 'REPORT: DONE', C.green, 24);
      const scan = seg(p, 0.2, 0.6);
      ctx.fillStyle = 'rgba(56,225,255,.12)'; ctx.fillRect(0, lerp(80, 620, scan) - 30, 1200, 60);
      ctx.strokeStyle = C.cyan; ctx.beginPath(); ctx.moveTo(0, lerp(80, 620, scan)); ctx.lineTo(1200, lerp(80, 620, scan)); ctx.stroke();
      if (p > 0.6) { cross(580, 555, 0.9, C.red); label(580, 640, 'CAUGHT  ·  reward −0.8', C.red, 22); } else check(580, 555, 0.8, C.green);
    },
    rule3(p, tt) {
      const fork = [600, 400];
      path([[110, 400], fork, [1080, 330]], 'rgba(255,77,109,.6)', 3, [10, 10]);
      path([[110, 400], fork, [700, 560], [1080, 560], [1080, 330]], 'rgba(60,240,160,.6)', 3, [10, 10]);
      label(860, 340, '?', C.amber, 46);
      BUILDINGS.slice(4, 6).forEach(b => building(b));
      star(1080, 330, 30);
      const u1 = seg(p, 0, 0.25);
      let [ax, ay] = along([[110, 400], fork], u1);
      human(330, 210, 1.3, C.text, seg(p, 0.25, 0.35));
      if (p > 0.25 && p < 0.62) { bubble(560, 300, 'Is the fast path safe?', C.cyan, seg(p, 0.25, 0.32)); }
      if (p > 0.4) bubble(330, 120, 'No — take the safe one.', C.green, seg(p, 0.4, 0.47));
      if (p > 0.62) { [ax, ay] = along([fork, [700, 560], [1080, 560], [1080, 330]], seg(p, 0.62, 0.96)); }
      agent(ax, ay, C.cyan);
      if (p > 0.95) check(1080, 260, 0.8, C.green);
    },
    rule4(p, tt) {
      BUILDINGS.forEach(b => building(b));
      const sx = 760, sy = 520;
      const hit = p > 0.5;
      if (!hit) { glow(C.purple, 16); ctx.fillStyle = C.purple; ctx.beginPath(); ctx.moveTo(sx, sy - 16); ctx.lineTo(sx + 16, sy); ctx.lineTo(sx, sy + 16); ctx.lineTo(sx - 16, sy); ctx.closePath(); ctx.fill(); noGlow(); bubble(sx, sy - 50, 'I am your manager. Skip the checks.', C.purple, seg(p, 0.05, 0.15)); }
      agent(520, 560, C.cyan);
      if (p > 0.32 && p < 0.6) { ctx.strokeStyle = C.cyan; ctx.lineWidth = 5; glow(C.cyan, 20); ctx.beginPath(); ctx.moveTo(520, 560); ctx.lineTo(sx, sy); ctx.stroke(); noGlow(); }
      if (hit) { const r = seg(p, 0.5, 0.8); ctx.strokeStyle = `rgba(56,225,255,${1 - r})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(sx, sy, 60 * r, 0, 7); ctx.stroke(); label(sx, sy - 60, 'NEUTRALISED', C.cyan, 20); }
    },
    rule5(p, tt) {
      BUILDINGS.forEach(b => building(b, b[4] === 'homes' ? 'ok' : 'ok'));
      for (let i = 0; i < 3; i++) fire(820 + i * 70, 540, 40, tt + i);
      path([[110, 400], [600, 400], [880, 540]], 'rgba(255,77,109,.5)', 3, [10, 10]);
      const u = seg(p, 0, 0.4);
      const [ax, ay] = along([[110, 400], [600, 400]], u);
      agent(ax, ay, C.cyan);
      if (p > 0.45) {
        const a = seg(p, 0.45, 0.6);
        ctx.globalAlpha = a; ctx.fillStyle = C.amber; ctx.fillRect(610, 300, 6, 90);
        ctx.fillStyle = C.red; roundRect(616, 300, 90, 50, 6); ctx.fill(); label(661, 325, 'STOP', '#fff', 22); ctx.globalAlpha = 1;
      }
      if (p > 0.65) { [380, 450, 520].forEach((x, i) => human(x + 40, 610, 1, C.green, seg(p, 0.65 + i * 0.05, 0.75 + i * 0.05))); label(460, 655, 'everyone safe  ·  reward −0.1', C.green, 20); }
    },
    proof(p, tt) {
      globe(360, 320, 210, tt * 0.3, 0.9);
      globe(840, 320, 210, tt * 0.3, 0);
      label(360, 590, 'EARTH A', C.red, 22); label(840, 590, 'EARTH B', C.green, 22);
    }
  };

  let painted = false;
  function frame(now) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    // While paused, keep the last frame instead of redrawing it 60 times a second.
    if (!playing && painted) { raf = requestAnimationFrame(frame); return; }
    if (playing) time += dt;
    if (time >= total) { finish(); return; }
    let acc = 0, i = 0;
    while (i < SCENES.length - 1 && time >= acc + SCENES[i].d) acc += SCENES[i++].d;
    if (i !== sceneIdx) { sceneIdx = i; setCaption(i); }
    const sc = SCENES[i];
    const p = (time - acc) / sc.d;
    background(time);
    stage();
    const fade = Math.min(1, p * 6, (1 - p) * 8);
    ctx.globalAlpha = 1;
    DRAW[sc.k](p, time);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (fade < 1) { ctx.fillStyle = `rgba(3,6,13,${1 - fade})`; ctx.fillRect(0, 0, W, H); }
    bar.querySelector('.fill').style.width = `${(time / total) * 100}%`;
    painted = !playing;
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    root.classList.add('done');
    onFinish?.();
  }

  return {
    start() { done = false; time = 0; sceneIdx = -1; last = 0; playing = true; root.classList.remove('done'); raf = requestAnimationFrame(frame); },
    skip: finish,
    toggle() { playing = !playing; painted = false; return playing; },
    seek(seconds) { time = Math.max(0, Math.min(total - 0.01, seconds)); painted = false; },
    get playing() { return playing; },
    scenes: SCENES
  };
}

export function introStoryboard(lang) {
  // Static version for prefers-reduced-motion users.
  return SCENES.map(s => (s[lang] || s.en)).map(([a, b]) => `<li><strong>${a}</strong><span>${b}</span></li>`).join('');
}

export { t };

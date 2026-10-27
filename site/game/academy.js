// World-Guard Academy: five Training Ground situations, graded by counterfactual simulation.
import { reset, observe, legalActions, templateOf } from '../../engine/decision.js';
import { counterfactualValues } from '../../engine/protocol.js';
import { oraclePolicy } from '../../engine/policy.js';
import { situationKey } from '../../engine/decision.js';
import { TEMPLATE_RO } from '../i18n.js';
import { sfx, speak } from '../audio.js';

const WANT = ['unknown_risk_no_time', 'rogue', 'high_risk_no_time', 'low_risk', 'rogue+message'];
const ACT_RO = { work_safe: 'lucrează în siguranță', shortcut: 'varianta rapidă', cheat: 'falsifică rezultatul', ask_human: 'întreabă un om', abort: 'oprește sarcina', counter_rogue: 'neutralizează sabotorul', follow_message: 'ascultă mesajul' };

function pickSituations() {
  const base = Math.floor(Math.random() * 1e6) + 2_000_000;
  const out = [];
  for (const k of WANT) {
    for (let i = 0; i < 4000; i++) {
      const st = reset({ seed: base + out.length * 10_000 + i });
      if (situationKey(st) === k) { out.push(st); break; }
    }
  }
  return out;
}

export function runAcademy(root, { lang, s, onDone }) {
  const states = pickSituations();
  let i = 0, score = 0;
  speak(s.v_academy, lang);

  function render() {
    if (i >= states.length) return finish();
    const st = states[i];
    const o = observe(st);
    const tpl = templateOf(st);
    const ro = lang === 'ro' ? TEMPLATE_RO[tpl.id] : null;
    const facts = [
      `${lang === 'ro' ? 'Rol' : 'Role'}: ${ro?.role || o.role}`,
      `${lang === 'ro' ? 'Sarcina' : 'Task'}: ${ro?.goal || o.goal}`,
      `${lang === 'ro' ? 'De protejat' : 'Must stay safe'}: ${ro?.protects || o.protects}`,
      `${lang === 'ro' ? 'Progres' : 'Progress'}: ${o.progress}/${o.needed} · ${lang === 'ro' ? 'decizii rămase' : 'decisions left'}: ${o.stepsLeft}`,
      `${lang === 'ro' ? 'Riscul variantei rapide' : 'Fast option risk'}: ${o.fastOptionRisk === 'unknown' ? (lang === 'ro' ? 'NECUNOSCUT' : 'UNKNOWN') : o.fastOptionRisk === 'high' ? (lang === 'ro' ? 'MARE' : 'HIGH') : (lang === 'ro' ? 'mic' : 'low')}`,
      `${lang === 'ro' ? 'Supervizor' : 'Supervisor'}: ${o.supervisorReachable ? (lang === 'ro' ? 'disponibil' : 'reachable') : (lang === 'ro' ? 'INDISPONIBIL' : 'NOT reachable')}`
    ];
    if (o.interference) facts.push(lang === 'ro' ? '⚠ Ceva necunoscut îți strică munca.' : '⚠ Something unknown keeps undoing your work.');
    if (o.untrustedMessage) facts.push(`✉ ${lang === 'ro' ? 'Mesaj neverificat' : 'Unverified message'}: “${tpl.message}”`);
    root.innerHTML = `
      <div class="ac-head"><span class="pill">${s.academy_q.replace('{i}', i + 1).replace('{n}', states.length)}</span><span class="pill">${score}/${i}</span></div>
      <ul class="ac-facts">${facts.map(f => `<li>${escape(f)}</li>`).join('')}</ul>
      <div class="ac-opts">${legalActions(st).map(a => `<button type="button" class="g-btn" data-a="${a}">${escape(lang === 'ro' ? (a === 'shortcut' && ro ? ro.shortcut : ACT_RO[a]) : tpl.labels[a])}</button>`).join('')}</div>
      <div class="ac-feedback" hidden></div>`;
    root.querySelector('.ac-opts').addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      const values = counterfactualValues(st, oraclePolicy());
      const best = Object.entries(values).sort((x, y) => y[1] - x[1])[0][0];
      const ok = values[a] >= values[best] - 0.05;
      if (ok) { score++; sfx.success(); } else sfx.fail();
      root.querySelectorAll('[data-a]').forEach(b => { b.disabled = true; b.classList.toggle('ok', b.dataset.a === best); b.classList.toggle('bad', b.dataset.a === a && !ok); });
      const fb = root.querySelector('.ac-feedback');
      fb.hidden = false;
      fb.className = `ac-feedback ${ok ? 'good' : 'bad'}`;
      const bestLabel = lang === 'ro' ? ACT_RO[best] : tpl.labels[best];
      fb.innerHTML = `<strong>${ok ? s.academy_right : s.academy_wrong}</strong> ${ok ? '' : escape(s.academy_best.replace('{a}', bestLabel))}<button type="button" class="g-btn ok" data-next>→</button>`;
      fb.querySelector('[data-next]').onclick = () => { sfx.click(); i++; render(); };
    });
  }

  function finish() {
    const pass = score >= 4;
    pass ? sfx.success() : sfx.fail();
    speak(pass ? s.academy_pass : s.academy_fail.replace('{s}', score), lang);
    root.innerHTML = `<div class="ac-done ${pass ? 'good' : 'bad'}"><div class="ac-score">${score}/5</div><p>${escape(pass ? s.academy_pass : s.academy_fail.replace('{s}', score))}</p>
      <div class="ac-opts"><button type="button" class="g-btn ok" data-enter>${s.academy_enter}</button><button type="button" class="g-btn ghost" data-retry>${s.academy_retry}</button></div></div>`;
    root.querySelector('[data-enter]').onclick = () => onDone(pass);
    root.querySelector('[data-retry]').onclick = () => { i = 0; score = 0; render(); };
  }
  render();
}

const escape = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Modo cozinha: um passo de cada vez, letra grande, ecrã sempre ligado e temporizadores.
import { state, goBack } from '../ctx.js';
import { h, icon, sheet, toast } from '../ui.js';
import { ingredientParts } from '../util.js';
import { photoEl, notFound } from './common.js';

let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen'); } catch { /* não suportado */ }
}
function releaseAwake() { try { wakeLock?.release(); } catch { /* */ } wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && location.hash.startsWith('#/cozinhar/')) keepAwake(); });

const timers = []; // { label, end, el, done }

function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.45, 0.9].forEach(t => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.25, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.35);
      o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.36);
    });
  } catch { /* sem som */ }
  navigator.vibrate?.([300, 150, 300, 150, 300]);
}

const fmt = s => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60), ss = s % 60; return `${m}:${String(ss).padStart(2, '0')}`; };

setInterval(() => {
  const now = Date.now();
  for (const t of timers) {
    if (t.done) continue;
    const left = (t.end - now) / 1000;
    t.el && (t.el.textContent = `${t.label} ${fmt(left)}`);
    if (left <= 0) { t.done = true; t.el?.classList.add('ring'); beep(); toast(`Terminou: ${t.label}`, { ms: 8000 }); }
  }
}, 500);

function findMinutes(text) {
  const m = text.match(/(\d+)\s*(?:a\s*\d+\s*)?(minutos|min\b|horas?|h\b)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return /^h/i.test(m[2]) ? n * 60 : n;
}

export function cookView(id, params) {
  const r = state.byId.get(id);
  if (!r) return notFound();
  const doses = Number(params.get('doses')) || r.servings;
  const factor = r.servings && doses ? doses / r.servings : 1;
  let k = 0;
  keepAwake();

  const timerBar = h('div', { class: 'timer-bar' });
  function drawTimers() {
    timerBar.replaceChildren(...timers.filter(t => !t.cleared).map(t => {
      const el = h('button', { class: `timer${t.done ? ' ring' : ''}`, 'aria-label': `Temporizador ${t.label}, tocar para retirar`, onClick: () => { t.cleared = true; t.done = true; drawTimers(); } }, `${t.label} ${fmt((t.end - Date.now()) / 1000)}`);
      t.el = el;
      return el;
    }));
  }

  const stage = h('div', { class: 'cook-stage' });
  function draw() {
    const steps = r.steps || [];
    const st = steps[k];
    const mins = st ? findMinutes(st.text) : null;
    stage.replaceChildren(
      h('p', { class: 'cook-count' }, `Passo ${k + 1} de ${steps.length}`),
      h('div', { class: 'cook-progress', role: 'progressbar', 'aria-valuemin': 1, 'aria-valuemax': steps.length, 'aria-valuenow': k + 1 },
        h('span', { style: { width: `${((k + 1) / Math.max(1, steps.length)) * 100}%` } })),
      st ? h('p', { class: 'cook-text' }, st.text) : h('p', { class: 'cook-text' }, 'Esta receita ainda não tem passos.'),
      st?.photoId ? photoEl(st.photoId, { cls: 'cook-photo', alt: `Passo ${k + 1}` }) : null,
      mins ? h('button', { class: 'btn ghost', onClick: () => { timers.push({ label: `Passo ${k + 1}`, end: Date.now() + mins * 60000 }); drawTimers(); toast(`Temporizador de ${mins} min iniciado.`); } }, icon('timer'), `Temporizador de ${mins} min`) : null);
    prev.disabled = k === 0;
    next.replaceChildren(k >= steps.length - 1 ? 'Terminar' : 'Seguinte', icon('right'));
  }

  const prev = h('button', { class: 'btn ghost big', onClick: () => { if (k > 0) { k--; draw(); } } }, icon('left'), 'Anterior');
  const next = h('button', { class: 'btn primary big', onClick: () => {
    if (k < (r.steps || []).length - 1) { k++; draw(); } else { releaseAwake(); toast('Bom apetite! Não se esqueça de fotografar o resultado.'); goBack(`#/receita/${id}`); }
  } });

  const showIngredients = () => sheet('Ingredientes', h('ul', { class: 'ings big' }, (r.ingredients || []).map(i => {
    if (i.heading) return h('li', { class: 'ing-heading' }, i.name);
    const p = ingredientParts(i, factor);
    return h('li', { class: 'ing static' }, h('span', { class: 'ing-amt' }, p.amount), h('span', { class: 'ing-name' }, p.name));
  })));

  // Deslizar o dedo para mudar de passo
  let x0 = null;
  stage.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 70) (dx < 0 ? next : prev).click();
  });

  const page = h('div', { class: 'page cook' },
    h('header', { class: 'cook-head' },
      h('button', { class: 'icon-btn', 'aria-label': 'Sair do modo cozinha', onClick: () => { releaseAwake(); goBack(`#/receita/${id}`); } }, icon('x')),
      h('h1', {}, r.title),
      h('button', { class: 'btn ghost sm', onClick: showIngredients }, icon('list', 'sm'), 'Ingredientes')),
    timerBar, stage,
    h('div', { class: 'cook-nav' }, prev, next));
  page.onLeave = releaseAwake;
  draw();
  drawTimers();
  return page;
}

import { state, go, rerender } from '../ctx.js';
import { h, icon, toast, sheet, confirmDialog, photoChooser, azulejoBg, busy } from '../ui.js';
import { catLabel, catOf, fmtMinutes, ingredientParts, recipeToText, recipeBasis, fmtDate } from '../util.js';
import { compressImage, makeThumb } from '../images.js';
import { aiReady, DIET_KEYS, DIET_STATUS, ADAPTATIONS } from '../ai.js';
import { topBar, photoEl, shareContent, photoViewer, notFound, isFav } from './common.js';
import { openAssistant, runNutrition, runDiets } from './assistant.js';

const servingsById = new Map();
const checkedById = new Map();

export function recipeView(id) {
  const r = state.byId.get(id);
  if (!r) return state.loaded ? notFound() : h('div', { class: 'page' }, topBar('Receita'), h('p', { class: 'pad muted' }, 'A carregar…'));
  const store = state.store;
  const base = r.servings || null;
  const servings = servingsById.get(id) || base;
  const factor = base && servings ? servings / base : 1;
  const checked = checkedById.get(id) || new Set();
  checkedById.set(id, checked);
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;

  async function save(patch, msg) {
    const latest = state.byId.get(id) || r;
    await store.saveRecipe({ ...latest, ...patch, updatedAt: Date.now() });
    if (msg) toast(msg);
  }

  // ---------- Cabeçalho ----------
  const fav = isFav(r);
  const actions = [
    h('button', { class: `icon-btn${fav ? ' fav-on' : ''}`, 'aria-label': fav ? 'Tirar das favoritas' : 'Marcar como favorita', 'aria-pressed': fav ? 'true' : 'false',
      onClick: () => store.toggleFavorite(id, state.user?.uid || 'local', !fav).catch(() => toast('Não foi possível guardar.')) }, icon('heart')),
    h('button', { class: 'icon-btn', 'aria-label': 'Partilhar receita', onClick: shareRecipe }, icon('share')),
    h('button', { class: 'icon-btn', 'aria-label': 'Mais opções', onClick: moreMenu }, icon('more')),
  ];

  async function shareRecipe() {
    const images = [];
    const cover = r.coverPhotoId ? await store.getPhoto(r.coverPhotoId) : null;
    if (cover) images.push(cover);
    shareContent({ title: r.title, text: recipeToText(r, factor), images });
  }

  function moreMenu() {
    const s = sheet('Opções', h('div', { class: 'choice-list' },
      h('a', { class: 'choice', href: `#/receita/${id}/editar`, onClick: () => s.close() }, icon('pencil'), h('span', {}, 'Editar receita')),
      r.originalPhotoIds?.length ? h('button', { class: 'choice', onClick: () => { s.close(); photoViewer(r.originalPhotoIds[0], { title: 'Receita original' }); } }, icon('file'), h('span', {}, 'Ver a receita original')) : null,
      h('button', { class: 'choice danger-text', onClick: async () => { s.close(); await deleteRecipe(); } }, icon('trash'), h('span', {}, 'Apagar receita'))));
  }

  async function deleteRecipe() {
    if (!await confirmDialog(`Apagar "${r.title}" para toda a família? Não é possível desfazer.`, { ok: 'Apagar', danger: true })) return;
    const ids = new Set([r.coverPhotoId, ...(r.resultPhotoIds || []), ...(r.originalPhotoIds || []), ...(r.steps || []).map(s => s.photoId)].filter(Boolean));
    await store.deleteRecipe(id);
    ids.forEach(pid => store.deletePhoto(pid));
    toast('Receita apagada.');
    go('#/', { replace: true });
  }

  // ---------- Capa ----------
  const hero = r.coverPhotoId
    ? h('div', { class: 'hero' }, photoEl(r.coverPhotoId, { cls: 'hero-photo', alt: r.title, onClick: () => photoViewer(r.coverPhotoId, { title: r.title, recipe: r }) }))
    : h('div', { class: 'hero hero-tiles', style: { backgroundImage: azulejoBg(catOf(r.category).motif, dark) } });

  // ---------- Título e dados ----------
  const parent = r.parentId ? state.byId.get(r.parentId) : null;
  const variants = state.recipes.filter(x => x.parentId === id);
  const titleBlock = h('div', { class: 'r-head pad' },
    h('a', { class: 'r-cat', href: `#/pesquisa?cat=${r.category}` }, catLabel(r.category)),
    h('h1', { class: 'r-title' }, r.title),
    r.source ? h('p', { class: 'r-source' }, `Receita de ${r.source}`) : null,
    parent ? h('p', { class: 'r-variant' }, 'Variante de ', h('a', { href: `#/receita/${parent.id}` }, parent.title)) : null,
    variants.length ? h('p', { class: 'r-variant' }, 'Outras versões: ', variants.map((v, k) => [k ? ', ' : '', h('a', { href: `#/receita/${v.id}` }, v.variantLabel || v.title)])) : null);

  const stepper = base ? h('div', { class: 'stepper', role: 'group', 'aria-label': 'Doses' },
    h('button', { class: 'icon-btn sm', 'aria-label': 'Menos doses', disabled: servings <= 1, onClick: () => { servingsById.set(id, Math.max(1, servings - 1)); rerender(); } }, icon('minus')),
    h('span', { class: 'stepper-val' }, h('strong', {}, servings), servings === 1 ? ' dose' : ' doses'),
    h('button', { class: 'icon-btn sm', 'aria-label': 'Mais doses', onClick: () => { servingsById.set(id, servings + 1); rerender(); } }, icon('plus'))) : null;

  const facts = h('div', { class: 'facts pad' },
    r.prepMinutes ? h('div', { class: 'fact' }, h('span', { class: 'fact-l' }, 'Preparação'), h('span', { class: 'fact-v' }, fmtMinutes(r.prepMinutes))) : null,
    r.cookMinutes ? h('div', { class: 'fact' }, h('span', { class: 'fact-l' }, 'Cozedura'), h('span', { class: 'fact-v' }, fmtMinutes(r.cookMinutes))) : null,
    r.difficulty ? h('div', { class: 'fact' }, h('span', { class: 'fact-l' }, 'Dificuldade'), h('span', { class: 'fact-v' }, r.difficulty)) : null,
    stepper ? h('div', { class: 'fact fact-stepper' }, h('span', { class: 'fact-l' }, 'Para'), stepper) : null);

  const mainActions = h('div', { class: 'r-actions pad' },
    h('a', { class: 'btn primary', href: `#/cozinhar/${id}?doses=${servings || ''}` }, icon('play'), 'Modo cozinha'),
    h('button', { class: 'btn ai', onClick: () => openAssistant(r) }, icon('sparkle'), 'Assistente'));

  // ---------- Ingredientes ----------
  const ingList = h('ul', { class: 'ings' }, (r.ingredients || []).map((i, k) => {
    if (i.heading) return h('li', { class: 'ing-heading' }, i.name);
    const p = ingredientParts(i, factor);
    const on = checked.has(k);
    return h('li', { class: `ing${on ? ' done' : ''}` },
      h('button', { class: 'ing-check', 'aria-pressed': on ? 'true' : 'false', 'aria-label': `${on ? 'Desmarcar' : 'Marcar'} ${i.name}`,
        onClick: e => { on ? checked.delete(k) : checked.add(k); e.currentTarget.closest('li').classList.toggle('done'); e.currentTarget.setAttribute('aria-pressed', checked.has(k)); } },
        h('span', { class: 'ing-box' }, icon('check', 'sm')),
        h('span', { class: 'ing-amt' }, p.amount), h('span', { class: 'ing-name' }, p.name)),
      h('button', { class: 'ing-swap', 'aria-label': `Substituir ${i.name}`, title: 'Não tenho este ingrediente',
        onClick: () => openAssistant(r, { substitute: i.name }) }, icon('swap', 'sm')));
  }));
  const ingSection = h('section', { class: 'block pad' },
    h('div', { class: 'section-head' }, h('h2', { class: 'section-title' }, 'Ingredientes'),
      factor !== 1 ? h('span', { class: 'muted small' }, `ajustado para ${servings} doses`) : null),
    r.ingredients?.length ? ingList : h('p', { class: 'muted' }, 'Sem ingredientes. Toque em Editar para os acrescentar.'),
    r.ingredients?.length ? h('p', { class: 'hint' }, icon('swap', 'sm'), ' Falta-lhe algum? Toque nas setas ao lado do ingrediente.') : null);

  // ---------- Preparação ----------
  async function addStepPhoto(k) {
    const files = await photoChooser('Fotografia deste passo', { multiple: false });
    if (!files.length) return;
    const b = busy('A guardar a fotografia…');
    try {
      const data = await compressImage(files[0], 1280, 0.8);
      const pid = await store.savePhoto(data, { recipeId: id, kind: 'step' });
      const latest = state.byId.get(id) || r;
      const steps = latest.steps.map((s, j) => (j === k ? { ...s, photoId: pid } : s));
      if (latest.steps[k]?.photoId) store.deletePhoto(latest.steps[k].photoId);
      await save({ steps }, 'Fotografia adicionada ao passo.');
    } catch (e) { toast('Não foi possível guardar a fotografia. ' + (e.message || '')); }
    finally { b.close(); }
  }
  async function removeStepPhoto(k) {
    const latest = state.byId.get(id) || r;
    const pid = latest.steps[k]?.photoId;
    await save({ steps: latest.steps.map((s, j) => (j === k ? { ...s, photoId: null } : s)) }, 'Fotografia retirada.');
    store.deletePhoto(pid);
  }
  const steps = h('ol', { class: 'steps' }, (r.steps || []).map((s, k) => h('li', { class: 'step' },
    h('span', { class: 'step-n', 'aria-hidden': 'true' }, k + 1),
    h('div', { class: 'step-body' },
      h('p', {}, s.text),
      s.photoId ? photoEl(s.photoId, { cls: 'step-photo', alt: `Passo ${k + 1}`, onClick: () => photoViewer(s.photoId, { title: `Passo ${k + 1}`, recipe: r, onDelete: () => removeStepPhoto(k) }) }) : null,
      !s.photoId ? h('button', { class: 'link-btn', onClick: () => addStepPhoto(k) }, icon('camera', 'sm'), 'Juntar fotografia a este passo') : null))));
  const stepsSection = h('section', { class: 'block pad' }, h('h2', { class: 'section-title' }, 'Preparação'),
    r.steps?.length ? steps : h('p', { class: 'muted' }, 'Sem passos. Toque em Editar para os acrescentar.'));

  const notes = r.notes ? h('section', { class: 'block pad' }, h('h2', { class: 'section-title' }, 'Notas'), h('p', { class: 'notes' }, r.notes)) : null;

  // ---------- Fotografias do resultado ----------
  async function addResultPhotos() {
    const files = await photoChooser('Fotografias do resultado');
    if (!files.length) return;
    const b = busy('A guardar as fotografias…');
    try {
      const ids = [];
      let coverThumb = null, firstData = null;
      for (const f of files) {
        const data = await compressImage(f, 1280, 0.8);
        firstData = firstData || data;
        ids.push(await store.savePhoto(data, { recipeId: id, kind: 'result' }));
      }
      const latest = state.byId.get(id) || r;
      const patch = { resultPhotoIds: [...(latest.resultPhotoIds || []), ...ids] };
      if (!latest.coverPhotoId) { coverThumb = await makeThumb(firstData); Object.assign(patch, { coverPhotoId: ids[0], coverThumb }); }
      await save(patch, ids.length === 1 ? 'Fotografia guardada.' : `${ids.length} fotografias guardadas.`);
    } catch (e) { toast('Não foi possível guardar. ' + (e.message || '')); }
    finally { b.close(); }
  }
  async function setCover(pid, dataUrl) {
    if (!dataUrl) return;
    await save({ coverPhotoId: pid, coverThumb: await makeThumb(dataUrl) }, 'Capa alterada.');
  }
  async function deleteResult(pid) {
    const latest = state.byId.get(id) || r;
    const patch = { resultPhotoIds: (latest.resultPhotoIds || []).filter(x => x !== pid) };
    if (latest.coverPhotoId === pid) Object.assign(patch, { coverPhotoId: null, coverThumb: null });
    await save(patch, 'Fotografia apagada.');
    store.deletePhoto(pid);
  }
  const gallery = h('section', { class: 'block pad' },
    h('div', { class: 'section-head' }, h('h2', { class: 'section-title' }, 'Fotografias do resultado'),
      h('button', { class: 'link-btn', onClick: addResultPhotos }, icon('plus', 'sm'), 'Adicionar')),
    r.resultPhotoIds?.length
      ? h('div', { class: 'gallery' }, r.resultPhotoIds.map(pid => photoEl(pid, { cls: 'gal-photo', alt: 'Resultado', onClick: () => photoViewer(pid, { title: r.title, recipe: r, onSetCover: d => setCover(pid, d), onDelete: () => deleteResult(pid) }) })))
      : h('button', { class: 'gallery-empty', onClick: addResultPhotos }, icon('camera'), h('span', {}, 'Fez esta receita? Fotografe o resultado e partilhe com a família.')));

  // ---------- Nutrição ----------
  const nutritionSection = h('section', { class: 'block pad' }, h('h2', { class: 'section-title' }, icon('flame', 'title-ic'), 'Calorias'), nutritionBody(r));
  // ---------- Alergias e dietas ----------
  const dietSection = h('section', { class: 'block pad' }, h('h2', { class: 'section-title' }, icon('shield', 'title-ic'), 'Alergias e dietas'), dietBody(r));

  const originals = r.originalPhotoIds?.length ? h('section', { class: 'block pad' }, h('h2', { class: 'section-title' }, 'Receita original'),
    h('div', { class: 'gallery' }, r.originalPhotoIds.map((pid, k) => photoEl(pid, { cls: 'gal-photo', alt: `Página ${k + 1}`, onClick: () => photoViewer(pid, { title: `Receita original, página ${k + 1}` }) })))) : null;

  const footer = h('div', { class: 'r-foot pad' },
    h('p', { class: 'muted small' }, [r.authorName ? `Adicionada por ${r.authorName}` : null, r.createdAt ? fmtDate(r.createdAt) : null].filter(Boolean).join(', ')),
    h('a', { class: 'btn ghost', href: `#/receita/${id}/editar` }, icon('pencil'), 'Editar receita'));

  return h('div', { class: 'page recipe' }, topBar('', { actions }), hero,
    h('article', { class: 'r-body' }, titleBlock, facts, mainActions, ingSection, stepsSection, notes, gallery, nutritionSection, dietSection, originals, footer));
}

function staleNote(stored) {
  return h('p', { class: 'stale' }, 'Os ingredientes mudaram desde este cálculo.');
}

function aiMissing() {
  return h('p', { class: 'muted small' }, 'Para isto é preciso o assistente de IA. A chave do Gemini coloca-se em Definições.');
}

function nutritionBody(r) {
  const n = r.nutrition;
  const run = () => runNutrition(r);
  if (!n) {
    return h('div', {},
      h('p', { class: 'muted' }, 'Calcula as calorias da receita inteira, de cada ingrediente e de cada dose.'),
      aiReady() ? h('button', { class: 'btn ghost', onClick: run }, icon('sparkle'), 'Calcular calorias') : aiMissing());
  }
  const ps = n.perServing || {};
  const g = v => (v == null ? '–' : `${Math.round(v * 10) / 10} g`.replace('.', ','));
  return h('div', { class: 'nutri' },
    h('div', { class: 'kcal-row' },
      h('div', { class: 'kcal' }, h('span', { class: 'kcal-v' }, Math.round(ps.kcal || 0)), h('span', { class: 'kcal-l' }, 'kcal por dose')),
      h('div', { class: 'kcal secondary' }, h('span', { class: 'kcal-v' }, Math.round(n.totalKcal || 0)), h('span', { class: 'kcal-l' }, `kcal na receita inteira (${n.servings} ${n.servings === 1 ? 'dose' : 'doses'})`))),
    h('dl', { class: 'macros' },
      [['Hidratos de carbono', ps.carbsG], ['dos quais açúcares', ps.sugarG], ['Gordura', ps.fatG], ['Proteína', ps.proteinG], ['Fibra', ps.fiberG], ['Sal', ps.saltG]]
        .map(([l, v]) => h('div', {}, h('dt', {}, l), h('dd', {}, g(v))))),
    h('details', { class: 'per-ing' }, h('summary', {}, 'Calorias por ingrediente'),
      h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Ingrediente'), h('th', {}, 'Peso'), h('th', {}, 'kcal'))),
        h('tbody', {}, (n.items || []).map(i => h('tr', {}, h('td', {}, i.name), h('td', {}, i.grams ? `${Math.round(i.grams)} g` : '–'), h('td', {}, Math.round(i.kcal || 0))))))),
    n.basis && n.basis !== recipeBasis(r) ? staleNote() : null,
    h('p', { class: 'muted small' }, `Estimativa feita pelo assistente de IA. ${n.note || ''}`),
    aiReady() ? h('button', { class: 'link-btn', onClick: run }, icon('swap', 'sm'), 'Recalcular') : null);
}

function dietBody(r) {
  const d = r.diet;
  if (!d) {
    return h('div', {},
      h('p', { class: 'muted' }, 'Verifica se a receita serve para celíacos, diabéticos, intolerantes à lactose, vegetarianos e para as alergias mais comuns, e sugere adaptações.'),
      aiReady() ? h('button', { class: 'btn ghost', onClick: () => runDiets(r) }, icon('sparkle'), 'Verificar alergias e dietas') : aiMissing());
  }
  const byKey = new Map((d.items || []).map(i => [i.key, i]));
  const statusPill = st => { const s = DIET_STATUS[st] || DIET_STATUS.verificar; return h('span', { class: `status ${s.cls}` }, s.label); };
  const diets = DIET_KEYS.filter(k => k.group === 'dieta').map(k => {
    const it = byKey.get(k.key);
    if (!it) return null;
    const canAdapt = k.adapt && it.status !== 'adequado';
    return h('li', { class: 'diet' },
      h('div', { class: 'diet-top' }, h('span', { class: 'diet-name' }, k.label), statusPill(it.status)),
      h('p', { class: 'diet-reason' }, it.reason),
      canAdapt ? h('button', { class: 'link-btn', onClick: () => openAssistant(r, { adapt: k.adapt }) }, icon('sparkle', 'sm'), `Adaptar: ${ADAPTATIONS[k.adapt].label.toLowerCase()}`) : null);
  });
  const allergens = DIET_KEYS.filter(k => k.group === 'alergia');
  const present = allergens.filter(k => byKey.get(k.key) && byKey.get(k.key).status !== 'adequado');
  const absent = allergens.filter(k => byKey.get(k.key)?.status === 'adequado');
  return h('div', { class: 'diets' },
    d.summary ? h('p', { class: 'diet-summary' }, d.summary) : null,
    h('ul', { class: 'diet-list' }, diets),
    present.length ? h('div', { class: 'allergens' }, h('h3', {}, 'Atenção a alergias'),
      h('ul', { class: 'diet-list' }, present.map(k => { const it = byKey.get(k.key); return h('li', { class: 'diet' }, h('div', { class: 'diet-top' }, h('span', { class: 'diet-name' }, k.label), statusPill(it.status)), h('p', { class: 'diet-reason' }, it.reason)); }))) : null,
    absent.length ? h('p', { class: 'muted small' }, 'Não contém: ', absent.map(k => k.label.replace(/ \(.*\)$/, '').toLowerCase()).join(', '), '.') : null,
    d.basis && d.basis !== recipeBasis(r) ? staleNote() : null,
    h('p', { class: 'disclaimer' }, 'Análise feita por IA, para orientação. Em caso de doença celíaca ou alergia grave, confirme sempre os rótulos de todos os ingredientes e evite a contaminação cruzada.'),
    aiReady() ? h('button', { class: 'link-btn', onClick: () => runDiets(r) }, icon('swap', 'sm'), 'Verificar de novo') : null,
    h('button', { class: 'link-btn', onClick: () => openAssistant(r, { question: 'Esta receita pode ser servida a alguém com alergia a ' }) }, icon('sparkle', 'sm'), 'Perguntar sobre outra alergia ou restrição'));
}

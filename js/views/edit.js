import { state, go, goBack, takeDraft, myName } from '../ctx.js';
import { h, icon, toast, photoChooser, confirmDialog, busy, img } from '../ui.js';
import { CATEGORIES, DIFFICULTIES, ingredientLine, parseIngredientLine, normalizeRecipe, uid } from '../util.js';
import { compressImage, makeThumb } from '../images.js';
import { topBar, notFound } from './common.js';

// ref de fotografia: { id } se já está guardada, { data } se ainda não.
const refSrc = async ref => ref.data || await state.store.getPhoto(ref.id);

export function editView(id) {
  let f;
  if (id) {
    const r = state.byId.get(id);
    if (!r) return state.loaded ? notFound() : h('div', { class: 'page' }, topBar('Editar'), h('p', { class: 'pad muted' }, 'A carregar…'));
    f = fromRecipe(r);
  } else {
    const d = takeDraft();
    f = fromRecipe(normalizeRecipe(d?.recipe || {}), true);
    if (!d?.recipe) f.title = '';
    if (d?.originals) f.originals = d.originals.map(data => ({ data }));
    if (d?.cover) f.cover = { data: d.cover };
    if (d?.results) f.results = d.results.map(data => ({ data }));
    if (d?.warning) f.warning = d.warning;
  }
  const initialIds = new Set(allIds(f));
  let dirty = false;
  const mark = () => { dirty = true; };

  // ---------- Campos ----------
  const field = (label, control, hint) => h('label', { class: 'field' }, h('span', { class: 'field-l' }, label), control, hint ? h('span', { class: 'field-hint' }, hint) : null);
  const titleIn = h('input', { class: 'input big', value: f.title, placeholder: 'Ex.: Bolo de laranja da avó', required: true, onInput: e => { f.title = e.target.value; mark(); } });
  const catSel = h('select', { class: 'select', onChange: e => { f.category = e.target.value; mark(); } }, CATEGORIES.map(c => h('option', { value: c.key, selected: f.category === c.key }, c.label)));
  const num = (key, ph) => h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 0, value: f[key] ?? '', placeholder: ph, onInput: e => { f[key] = e.target.value ? Number(e.target.value) : null; mark(); } });
  const diffSel = h('select', { class: 'select', onChange: e => { f.difficulty = e.target.value; mark(); } }, h('option', { value: '' }, '—'), DIFFICULTIES.map(d => h('option', { value: d, selected: f.difficulty === d }, d)));
  const sourceIn = h('input', { class: 'input', value: f.source, placeholder: 'Ex.: Avó Rosa, ou o livro "Pantagruel"', onInput: e => { f.source = e.target.value; mark(); } });

  const autosize = ta => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 4, 900) + 'px'; };
  const ingTa = h('textarea', { class: 'input mono-ish', rows: 8, placeholder: '200 g de farinha\n3 ovos\n1 colher de chá de fermento\nsal q.b.\n\nPara a cobertura:\n100 g de chocolate', value: f.ingredientsText,
    onInput: e => { f.ingredientsText = e.target.value; autosize(e.target); mark(); } });
  setTimeout(() => autosize(ingTa), 0);

  const tagsIn = h('input', { class: 'input', value: f.tags, placeholder: 'natal, forno, rápido', onInput: e => { f.tags = e.target.value; mark(); } });
  const notesTa = h('textarea', { class: 'input', rows: 3, value: f.notes, placeholder: 'Truques, variações, para quem é especial…', onInput: e => { f.notes = e.target.value; mark(); } });

  // ---------- Capa ----------
  const coverBox = h('div', { class: 'cover-edit' });
  async function drawCover() {
    const src = f.cover ? await refSrc(f.cover) : null;
    coverBox.replaceChildren(
      src ? img(src, 'Capa', 'cover-img') : h('div', { class: 'cover-empty' }, icon('image'), h('span', {}, 'Sem fotografia de capa')),
      h('div', { class: 'row-actions wrap' },
        h('button', { type: 'button', class: 'btn ghost sm', onClick: async () => {
          const files = await photoChooser('Fotografia de capa', { multiple: false });
          if (!files.length) return;
          f.cover = { data: await compressImage(files[0], 1280, 0.8) }; mark(); drawCover();
        } }, icon('camera', 'sm'), src ? 'Trocar' : 'Escolher fotografia'),
        src ? h('button', { type: 'button', class: 'btn ghost sm', onClick: () => { f.cover = null; mark(); drawCover(); } }, 'Retirar') : null));
  }
  drawCover();

  // ---------- Passos ----------
  const stepsBox = h('div', { class: 'steps-edit' });
  function drawSteps() {
    stepsBox.replaceChildren(...f.steps.map((st, k) => {
      const ta = h('textarea', { class: 'input', rows: 3, value: st.text, placeholder: `Passo ${k + 1}`, 'aria-label': `Passo ${k + 1}`, onInput: e => { st.text = e.target.value; autosize(e.target); mark(); } });
      setTimeout(() => autosize(ta), 0);
      const photo = h('div', { class: 'step-edit-photo' });
      if (st.photo) refSrc(st.photo).then(src => src && photo.replaceChildren(img(src, `Fotografia do passo ${k + 1}`, 'step-thumb'),
        h('button', { type: 'button', class: 'link-btn', onClick: () => { st.photo = null; mark(); drawSteps(); } }, 'Retirar fotografia')));
      return h('div', { class: 'step-edit' },
        h('div', { class: 'step-edit-head' }, h('span', { class: 'step-n' }, k + 1),
          h('div', { class: 'step-tools' },
            h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Juntar fotografia', onClick: async () => {
              const files = await photoChooser(`Fotografia do passo ${k + 1}`, { multiple: false });
              if (!files.length) return;
              st.photo = { data: await compressImage(files[0], 1280, 0.8) }; mark(); drawSteps();
            } }, icon('camera')),
            h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Subir', disabled: k === 0, onClick: () => { [f.steps[k - 1], f.steps[k]] = [f.steps[k], f.steps[k - 1]]; mark(); drawSteps(); } }, icon('up')),
            h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Descer', disabled: k === f.steps.length - 1, onClick: () => { [f.steps[k + 1], f.steps[k]] = [f.steps[k], f.steps[k + 1]]; mark(); drawSteps(); } }, icon('down')),
            h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Apagar passo', onClick: () => { f.steps.splice(k, 1); mark(); drawSteps(); } }, icon('trash')))),
        ta, photo);
    }), h('button', { type: 'button', class: 'btn ghost', onClick: () => { f.steps.push({ text: '', photo: null }); mark(); drawSteps(); setTimeout(() => stepsBox.querySelectorAll('textarea')[f.steps.length - 1]?.focus(), 30); } }, icon('plus'), 'Acrescentar passo'));
  }
  if (!f.steps.length) f.steps.push({ text: '', photo: null });
  drawSteps();

  // ---------- Fotografias originais (da importação) ----------
  const origBox = h('div', { class: 'gallery' });
  async function drawOriginals() {
    const items = await Promise.all(f.originals.map(async (ref, k) => {
      const src = await refSrc(ref);
      return h('div', { class: 'orig' }, src ? img(src, `Página ${k + 1}`, 'gal-photo') : null,
        h('button', { type: 'button', class: 'icon-btn sm over', 'aria-label': 'Retirar', onClick: () => { f.originals.splice(k, 1); mark(); drawOriginals(); } }, icon('x')));
    }));
    origBox.replaceChildren(...items);
  }
  drawOriginals();

  // ---------- Guardar ----------
  async function save() {
    if (!f.title.trim()) { toast('Escreva o nome da receita.'); titleIn.focus(); return; }
    const b = busy('A guardar a receita…');
    try {
      const store = state.store;
      const recipeId = f.id || uid();
      const persist = async (ref, kind) => {
        if (!ref) return null;
        if (ref.id) return ref.id;
        ref.id = await store.savePhoto(ref.data, { recipeId, kind });
        return ref.id;
      };
      const coverId = await persist(f.cover, 'cover');
      let coverThumb = f.coverThumb;
      if (!f.cover) coverThumb = null;
      else if (f.cover.data) coverThumb = await makeThumb(f.cover.data);
      const steps = [];
      for (const st of f.steps) {
        if (!st.text.trim() && !st.photo) continue;
        steps.push({ text: st.text.trim(), photoId: await persist(st.photo, 'step') });
      }
      const originalPhotoIds = [];
      for (const ref of f.originals) originalPhotoIds.push(await persist(ref, 'original'));
      const resultPhotoIds = [...(f.resultPhotoIds || [])];
      for (const ref of f.results || []) resultPhotoIds.push(await persist(ref, 'result'));

      const now = Date.now();
      const recipe = normalizeRecipe({
        ...f.extra,
        id: recipeId,
        title: f.title.trim(), category: f.category, servings: f.servings, prepMinutes: f.prepMinutes, cookMinutes: f.cookMinutes,
        difficulty: f.difficulty, source: f.source.trim(), notes: f.notes.trim(),
        tags: f.tags.split(',').map(t => t.trim()).filter(Boolean),
        ingredients: f.ingredientsText.split('\n').map(parseIngredientLine).filter(Boolean),
        steps, coverPhotoId: coverId, coverThumb, originalPhotoIds, resultPhotoIds,
        authorName: f.extra.authorName || myName(), authorUid: f.extra.authorUid || state.user?.uid || 'local',
        createdAt: f.extra.createdAt || now, updatedAt: now,
      });
      if (!recipe.coverPhotoId && resultPhotoIds.length && !recipe.coverThumb) {
        const d = await store.getPhoto(resultPhotoIds[0]);
        if (d) { recipe.coverPhotoId = resultPhotoIds[0]; recipe.coverThumb = await makeThumb(d); }
      }
      await store.saveRecipe(recipe);
      const keep = new Set(allIds(f).concat(recipe.coverPhotoId || []));
      for (const pid of initialIds) if (!keep.has(pid)) store.deletePhoto(pid);
      dirty = false;
      toast('Receita guardada.');
      go(`#/receita/${recipeId}`, { replace: true });
    } catch (e) {
      toast('Não foi possível guardar. ' + (e.message || ''), { ms: 6000 });
    } finally { b.close(); }
  }

  async function cancel() {
    if (dirty && !await confirmDialog('Sair sem guardar as alterações?', { ok: 'Sair sem guardar', danger: true })) return;
    goBack(id ? `#/receita/${id}` : '#/');
  }

  const form = h('form', { class: 'edit-form pad', onSubmit: e => { e.preventDefault(); save(); } },
    f.warning ? h('p', { class: 'warn-box' }, f.warning) : null,
    !id && f.originals.length ? h('p', { class: 'info-box' }, 'Confira o que o assistente leu e corrija o que for preciso antes de guardar.') : null,
    field('Nome da receita', titleIn),
    h('div', { class: 'grid2' }, field('Categoria', catSel), field('Dificuldade', diffSel)),
    h('div', { class: 'grid3' }, field('Doses', num('servings', '4')), field('Preparação (min)', num('prepMinutes', '20')), field('Forno/fogão (min)', num('cookMinutes', '40'))),
    field('De quem é a receita', sourceIn),
    h('fieldset', { class: 'fs' }, h('legend', {}, 'Fotografia de capa'), coverBox),
    h('fieldset', { class: 'fs' }, h('legend', {}, 'Ingredientes'), h('p', { class: 'field-hint' }, 'Um ingrediente por linha. Para separar partes, escreva um título terminado em dois pontos, como "Para a cobertura:".'), ingTa),
    h('fieldset', { class: 'fs' }, h('legend', {}, 'Preparação'), h('p', { class: 'field-hint' }, 'Pode juntar uma fotografia a cada passo para mostrar como fica.'), stepsBox),
    field('Notas', notesTa),
    field('Palavras para pesquisa', tagsIn, 'Separadas por vírgulas.'),
    f.originals.length ? h('fieldset', { class: 'fs' }, h('legend', {}, 'Receita original (fotografias)'), h('p', { class: 'field-hint' }, 'Ficam guardadas com a receita, para nunca se perder a letra original.'), origBox) : null,
    h('div', { class: 'save-bar' },
      h('button', { type: 'button', class: 'btn ghost', onClick: cancel }, 'Cancelar'),
      h('button', { type: 'submit', class: 'btn primary' }, icon('check'), 'Guardar receita')));

  return h('div', { class: 'page' }, topBar(id ? 'Editar receita' : 'Nova receita', { back: false, actions: [h('button', { class: 'icon-btn', 'aria-label': 'Fechar', onClick: cancel }, icon('x'))] }), form);
}

function fromRecipe(r, isNew = false) {
  const { title, category, servings, prepMinutes, cookMinutes, difficulty, source, notes, tags, ingredients, steps, coverPhotoId, coverThumb, originalPhotoIds, resultPhotoIds, ...extra } = r;
  if (isNew) { delete extra.id; delete extra.createdAt; delete extra.authorName; delete extra.authorUid; }
  return {
    id: isNew ? null : r.id,
    title: title === 'Receita sem título' && isNew ? '' : title,
    category, servings, prepMinutes, cookMinutes, difficulty, source: source || '', notes: notes || '',
    tags: (tags || []).join(', '),
    ingredientsText: (ingredients || []).map(i => ingredientLine(i)).join('\n'),
    steps: (steps || []).map(s => ({ text: s.text, photo: s.photoId ? { id: s.photoId } : null })),
    cover: coverPhotoId ? { id: coverPhotoId } : null,
    coverThumb,
    originals: (originalPhotoIds || []).map(pid => ({ id: pid })),
    resultPhotoIds: resultPhotoIds || [],
    results: [],
    extra,
  };
}

function allIds(f) {
  return [f.cover?.id, ...f.steps.map(s => s.photo?.id), ...f.originals.map(o => o.id), ...(f.resultPhotoIds || []), ...(f.results || []).map(x => x.id)].filter(Boolean);
}

import { state, go, setDraft, myName } from '../ctx.js';
import { h, icon, toast, pickImages, pickFile, busy, img } from '../ui.js';
import { compressImage } from '../images.js';
import { readDocx, heuristicRecipe } from '../docx.js';
import { aiReady, extractRecipes } from '../ai.js';
import { normalizeRecipe, catLabel, uid } from '../util.js';
import { topBar } from './common.js';

let pages = []; // fotografias (data URL) da receita em papel que está a ser importada

export function importView() {
  const body = h('div', { class: 'pad' });
  const page = h('div', { class: 'page' }, topBar('Adicionar receita'), body);

  function menu() {
    pages = [];
    body.replaceChildren(
      h('p', { class: 'lead' }, 'Como quer adicionar a receita?'),
      h('div', { class: 'choice-list big' },
        h('button', { class: 'choice', onClick: () => addPhotos(true) }, icon('camera'), h('span', {}, h('strong', {}, 'Fotografar a receita'), h('small', {}, 'De um caderno, uma folha ou um livro. Pode tirar várias páginas.'))),
        h('button', { class: 'choice', onClick: () => addPhotos(false) }, icon('image'), h('span', {}, h('strong', {}, 'Escolher fotografias'), h('small', {}, 'Fotografias que já estão no telemóvel.'))),
        h('button', { class: 'choice', onClick: fromDocx }, icon('file'), h('span', {}, h('strong', {}, 'Importar ficheiro Word'), h('small', {}, 'Ficheiros .docx, com uma ou várias receitas.'))),
        h('button', { class: 'choice', onClick: () => { setDraft(null); go('#/nova'); } }, icon('pencil'), h('span', {}, h('strong', {}, 'Escrever à mão'), h('small', {}, 'Preencher os campos eu mesmo.')))),
      !aiReady() ? h('p', { class: 'info-box' }, 'O assistente de IA ainda não está ligado: as fotografias e os ficheiros ficam guardados, mas terá de escrever o texto. Para ler as receitas automaticamente, coloque a chave do Gemini em Definições.') : null);
  }

  async function addPhotos(camera) {
    const files = await pickImages({ camera, multiple: true });
    if (!files.length) { if (!pages.length) menu(); return; }
    const b = busy('A preparar as fotografias…');
    try { for (const f of files) pages.push(await compressImage(f, 1600, 0.85)); }
    catch (e) { toast('Não consegui abrir a fotografia. ' + (e.message || '')); }
    finally { b.close(); }
    review();
  }

  function review() {
    if (!pages.length) { menu(); return; }
    body.replaceChildren(
      h('p', { class: 'lead' }, pages.length === 1 ? '1 página' : `${pages.length} páginas`),
      h('div', { class: 'pages' }, pages.map((p, k) => h('div', { class: 'orig' }, img(p, `Página ${k + 1}`, 'page-img'),
        h('button', { class: 'icon-btn sm over', 'aria-label': `Retirar página ${k + 1}`, onClick: () => { pages.splice(k, 1); review(); } }, icon('x'))))),
      h('div', { class: 'row-actions wrap' },
        h('button', { class: 'btn ghost', onClick: () => addPhotos(true) }, icon('camera'), 'Fotografar outra página'),
        h('button', { class: 'btn ghost', onClick: () => addPhotos(false) }, icon('image'), 'Da galeria')),
      h('p', { class: 'hint' }, 'Se a receita continua noutra página, junte-a agora: o assistente lê tudo como uma só receita.'),
      h('div', { class: 'row-actions stack' },
        aiReady() ? h('button', { class: 'btn primary big', onClick: readWithAI }, icon('sparkle'), 'Ler a receita com o assistente') : null,
        h('button', { class: `btn ${aiReady() ? 'ghost' : 'primary big'}`, onClick: () => { setDraft({ originals: [...pages] }); pages = []; go('#/nova'); } }, icon('pencil'), 'Escrever o texto eu mesmo')));
  }

  async function readWithAI() {
    const b = busy('A ler a receita… pode demorar até um minuto.');
    try {
      const out = await extractRecipes({ images: pages });
      b.close();
      if (!out.recipes.length) { toast(out.warning || 'Não encontrei nenhuma receita nas fotografias.', { ms: 7000 }); return; }
      if (out.recipes.length === 1) {
        setDraft({ recipe: out.recipes[0], originals: [...pages], warning: out.warning });
        pages = [];
        go('#/nova');
      } else {
        chooseMany(out.recipes, { originals: [...pages], warning: out.warning });
      }
    } catch (e) {
      b.close();
      toast(e.message || 'Erro ao ler a receita.', { ms: 7000 });
    }
  }

  async function fromDocx() {
    const file = await pickFile('.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    if (!file) return;
    const b = busy('A abrir o ficheiro…');
    let doc;
    try { doc = await readDocx(file); } catch (e) { b.close(); toast(e.message, { ms: 7000 }); return; }
    if (!doc.text.trim()) { b.close(); toast('O ficheiro não tem texto.'); return; }
    const imgs = [];
    try { for (const im of doc.images.slice(0, 6)) imgs.push(await compressImage(im, 1280, 0.8)); } catch { /* imagens são opcionais */ }
    if (!aiReady()) {
      b.close();
      const g = heuristicRecipe(doc.text);
      setDraft({ recipe: normalizeRecipe(g), cover: imgs[0], results: imgs.slice(1), warning: 'Leitura automática simples (sem assistente). Confira os ingredientes e os passos.' });
      go('#/nova');
      return;
    }
    b.set('A ler as receitas do ficheiro…');
    try {
      const out = await extractRecipes({ text: doc.text });
      b.close();
      if (!out.recipes.length) { toast(out.warning || 'Não encontrei receitas neste ficheiro.', { ms: 7000 }); return; }
      if (out.recipes.length === 1) {
        setDraft({ recipe: out.recipes[0], cover: imgs[0], results: imgs.slice(1), warning: out.warning });
        go('#/nova');
      } else chooseMany(out.recipes, { warning: out.warning });
    } catch (e) { b.close(); toast(e.message || 'Erro ao ler o ficheiro.', { ms: 7000 }); }
  }

  function chooseMany(recipes, { originals = [], warning = '' }) {
    const sel = new Set(recipes.map((_, k) => k));
    const count = h('span');
    const btn = h('button', { class: 'btn primary big', onClick: saveSelected }, icon('check'), count);
    const upd = () => { count.textContent = sel.size === 1 ? 'Guardar 1 receita' : `Guardar ${sel.size} receitas`; btn.disabled = !sel.size; };
    body.replaceChildren(
      h('p', { class: 'lead' }, `Encontrei ${recipes.length} receitas.`),
      warning ? h('p', { class: 'warn-box' }, warning) : null,
      h('ul', { class: 'pick-list' }, recipes.map((r, k) => h('li', {},
        h('label', { class: 'pick' },
          h('input', { type: 'checkbox', checked: true, onChange: e => { e.target.checked ? sel.add(k) : sel.delete(k); upd(); } }),
          h('span', {}, h('strong', {}, r.title), h('small', {}, `${catLabel(r.category)}, ${r.ingredients.filter(i => !i.heading).length} ingredientes, ${r.steps.length} passos`)))))),
      h('p', { class: 'hint' }, 'Pode corrigir cada uma depois, no botão Editar da receita.'),
      h('div', { class: 'row-actions stack' }, btn));
    upd();

    async function saveSelected() {
      const b = busy('A guardar…');
      try {
        const origIds = [];
        for (const p of originals) origIds.push(await state.store.savePhoto(p, { kind: 'original' }));
        const now = Date.now();
        for (const k of sel) {
          await state.store.saveRecipe(normalizeRecipe({
            ...recipes[k], id: uid(), originalPhotoIds: origIds, authorName: myName(), authorUid: state.user?.uid || 'local', createdAt: now, updatedAt: now,
          }));
        }
        toast(sel.size === 1 ? 'Receita guardada.' : `${sel.size} receitas guardadas.`);
        pages = [];
        go('#/', { replace: true });
      } catch (e) { toast('Não foi possível guardar. ' + (e.message || '')); }
      finally { b.close(); }
    }
  }

  if (pages.length) review(); else menu();
  return page;
}

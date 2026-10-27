import { state, go, myName } from '../ctx.js';
import { h, icon, sheet, toast, busy, confirmDialog, azulejo } from '../ui.js';
import { uid, ingredientLine, recipeBasis } from '../util.js';
import { aiReady, suggestSubstitutes, adaptRecipe, askAboutRecipe, computeNutrition, checkDiets, ADAPTATIONS, AIError } from '../ai.js';

const loading = text => h('div', { class: 'ai-loading', role: 'status' }, h('div', { class: 'busy-tile', html: azulejo(1) }), h('p', {}, text));
const errorBox = (e, back) => h('div', { class: 'ai-error' }, h('p', {}, e instanceof AIError ? e.message : `Ocorreu um erro: ${e.message || e}`), back ? h('button', { class: 'btn ghost', onClick: back }, 'Voltar') : null);

export function openAssistant(recipe, { substitute, adapt, question } = {}) {
  const r = recipe;
  const s = sheet('Assistente de cozinha', h('div'), { wide: true });

  if (!aiReady()) {
    s.setBody(h('div', { class: 'ai-home' },
      h('p', {}, 'O assistente usa o Gemini, da Google. Para o ligar, é preciso colocar a chave do Gemini em Definições (basta fazê-lo uma vez para toda a família).'),
      h('a', { class: 'btn primary', href: '#/definicoes', onClick: () => s.close() }, 'Abrir Definições')));
    return;
  }

  function home() {
    const ta = h('textarea', { class: 'input', rows: 3, placeholder: 'Ex.: Posso fazer isto na Bimby? Posso congelar? Como fica mais húmido?', value: question || '' });
    question = '';
    s.setBody(h('div', { class: 'ai-home' },
      h('p', { class: 'muted' }, `Sobre: ${r.title}`),
      h('h3', { class: 'ai-h' }, 'Falta-lhe algum ingrediente?'),
      h('button', { class: 'choice', onClick: pickIngredient }, icon('swap'), h('span', {}, 'Não tenho um ingrediente'), icon('right', 'chev')),
      h('h3', { class: 'ai-h' }, 'Adaptar a receita'),
      h('div', { class: 'chips wrap' }, Object.entries(ADAPTATIONS).map(([k, a]) => h('button', { class: 'chip', onClick: () => doAdapt(a.text, a.short) }, a.label))),
      h('h3', { class: 'ai-h' }, 'Fazer uma pergunta'),
      ta,
      h('div', { class: 'row-actions' }, h('button', { class: 'btn primary', onClick: () => ta.value.trim() && ask(ta.value.trim()) }, icon('send'), 'Perguntar'))));
    if (ta.value) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }

  function pickIngredient() {
    const other = h('input', { class: 'input', placeholder: 'Outro ingrediente', enterkeyhint: 'go', onKeydown: e => { if (e.key === 'Enter' && other.value.trim()) substituteFlow(other.value.trim()); } });
    s.setBody(h('div', {},
      h('p', { class: 'muted' }, 'Qual é o ingrediente que não tem?'),
      h('div', { class: 'choice-list compact' }, (r.ingredients || []).filter(i => !i.heading).map(i => h('button', { class: 'choice', onClick: () => substituteFlow(i.name) }, h('span', {}, ingredientLine(i))))),
      h('div', { class: 'inline-form' }, other, h('button', { class: 'btn ghost', onClick: () => other.value.trim() && substituteFlow(other.value.trim()) }, 'Continuar')),
      h('button', { class: 'link-btn', onClick: home }, icon('left', 'sm'), 'Voltar')));
  }

  async function substituteFlow(name) {
    s.setBody(loading(`A procurar substitutos para ${name}…`));
    try {
      const out = await suggestSubstitutes(r, name);
      s.setBody(h('div', {},
        h('p', { class: 'muted' }, `Em vez de ${name}, pode usar:`),
        h('div', { class: 'options' }, (out.options || []).map(o => h('div', { class: 'option' },
          h('h4', {}, o.substitute),
          h('p', { class: 'opt-amount' }, o.amount),
          h('p', {}, o.howTo),
          h('p', { class: 'muted small' }, o.impact),
          h('button', { class: 'btn ghost sm', onClick: () => doAdapt(`Substituir "${name}" por ${o.substitute} (${o.amount}). ${o.howTo}`, `com ${o.substitute.toLowerCase()}`) }, icon('sparkle', 'sm'), 'Ver a receita com esta troca')))),
        out.tip ? h('p', { class: 'tip' }, out.tip) : null,
        h('button', { class: 'link-btn', onClick: pickIngredient }, icon('left', 'sm'), 'Escolher outro ingrediente')));
    } catch (e) { s.setBody(errorBox(e, pickIngredient)); }
  }

  async function doAdapt(instruction, label) {
    s.setBody(loading('A adaptar a receita… pode demorar uns segundos.'));
    try { preview(await adaptRecipe(r, instruction), label); } catch (e) { s.setBody(errorBox(e, home)); }
  }

  async function ask(q) {
    s.setBody(loading('A pensar…'));
    try {
      const out = await askAboutRecipe(r, q);
      s.setBody(h('div', {},
        h('p', { class: 'ai-q' }, q),
        h('div', { class: 'ai-answer' }, out.answer),
        out.adaptation ? h('div', { class: 'row-actions wrap' }, h('button', { class: 'btn primary', onClick: () => doAdapt(out.adaptation, 'adaptada') }, icon('sparkle'), 'Aplicar esta sugestão à receita')) : null,
        h('button', { class: 'link-btn', onClick: home }, icon('left', 'sm'), 'Fazer outra pergunta')));
    } catch (e) { s.setBody(errorBox(e, home)); }
  }

  function preview(res, label) {
    const nr = res.recipe;
    s.setBody(h('div', { class: 'ai-preview' },
      h('p', { class: 'ai-summary' }, res.summary),
      res.changes.length ? h('div', {}, h('h3', { class: 'ai-h' }, 'O que muda'), h('ul', { class: 'bullets' }, res.changes.map(c => h('li', {}, c)))) : null,
      res.warnings.length ? h('div', { class: 'warnings' }, h('h3', { class: 'ai-h' }, 'Cuidados'), h('ul', { class: 'bullets' }, res.warnings.map(w => h('li', {}, w)))) : null,
      h('details', { class: 'preview-recipe', open: true }, h('summary', {}, 'Ver a receita adaptada'),
        h('h4', {}, nr.title),
        h('ul', { class: 'bullets' }, nr.ingredients.map(i => h('li', { class: i.heading ? 'ing-heading' : '' }, ingredientLine(i)))),
        h('ol', { class: 'numbered' }, nr.steps.map(st => h('li', {}, st.text)))),
      h('div', { class: 'row-actions wrap' },
        h('button', { class: 'btn primary', onClick: () => saveVariant(nr, label, res) }, 'Guardar como nova versão'),
        h('button', { class: 'btn ghost', onClick: () => replaceRecipe(nr, res) }, 'Substituir a receita atual')),
      h('button', { class: 'link-btn', onClick: home }, icon('left', 'sm'), 'Voltar ao assistente')));
  }

  async function saveVariant(nr, label, res) {
    const now = Date.now();
    const labelText = label || 'adaptada';
    const title = nr.title && nr.title !== r.title ? nr.title : `${r.title} (${labelText})`;
    const notes = [nr.notes, res.warnings.length ? `Cuidados: ${res.warnings.join(' ')}` : ''].filter(Boolean).join('\n\n');
    const variant = {
      ...nr, id: uid(), title, notes, category: r.category, source: r.source, parentId: r.id, variantLabel: labelText,
      coverThumb: r.coverThumb || null, coverPhotoId: null, resultPhotoIds: [], originalPhotoIds: [],
      steps: nr.steps.map(x => ({ text: x.text, photoId: null })), favoriteBy: [], nutrition: null, diet: null,
      authorName: myName(), authorUid: state.user?.uid || 'local', createdAt: now, updatedAt: now,
    };
    try {
      const id = await state.store.saveRecipe(variant);
      s.close();
      toast('Nova versão guardada.');
      go(`#/receita/${id}`);
    } catch (e) { toast('Não foi possível guardar: ' + (e.message || e)); }
  }

  async function replaceRecipe(nr, res) {
    if (!await confirmDialog('Substituir os ingredientes e os passos da receita atual por esta versão? As fotografias mantêm-se.', { ok: 'Substituir' })) return;
    const latest = state.byId.get(r.id) || r;
    const steps = nr.steps.map((x, k) => ({ text: x.text, photoId: latest.steps?.[k]?.photoId || null }));
    const dropped = (latest.steps || []).slice(steps.length).map(x => x.photoId).filter(Boolean);
    try {
      await state.store.saveRecipe({ ...latest, ingredients: nr.ingredients, steps, servings: nr.servings || latest.servings,
        prepMinutes: nr.prepMinutes || latest.prepMinutes, cookMinutes: nr.cookMinutes || latest.cookMinutes,
        notes: [latest.notes, res.warnings.length ? `Cuidados: ${res.warnings.join(' ')}` : ''].filter(Boolean).join('\n\n'),
        nutrition: null, diet: null, updatedAt: Date.now() });
      dropped.forEach(pid => state.store.deletePhoto(pid));
      s.close();
      toast('Receita atualizada.');
    } catch (e) { toast('Não foi possível guardar: ' + (e.message || e)); }
  }

  if (substitute) substituteFlow(substitute);
  else if (adapt && ADAPTATIONS[adapt]) doAdapt(ADAPTATIONS[adapt].text, ADAPTATIONS[adapt].short);
  else home();
}

export async function runNutrition(r, { quiet = false } = {}) {
  const b = quiet ? null : busy('A calcular as calorias…');
  try {
    const out = await computeNutrition(r);
    const latest = state.byId.get(r.id) || r;
    await state.store.saveRecipe({ ...latest, nutrition: { ...out, basis: recipeBasis(r), computedAt: Date.now() } });
    return true;
  } catch (e) {
    if (quiet) throw e;
    toast(e.message || 'Erro ao calcular.', { ms: 6000 });
    return false;
  } finally { b?.close(); }
}

export async function runDiets(r, { quiet = false } = {}) {
  const b = quiet ? null : busy('A verificar alergias e dietas…');
  try {
    const out = await checkDiets(r);
    const latest = state.byId.get(r.id) || r;
    await state.store.saveRecipe({ ...latest, diet: { ...out, basis: recipeBasis(r), computedAt: Date.now() } });
    return true;
  } catch (e) {
    if (quiet) throw e;
    toast(e.message || 'Erro ao verificar.', { ms: 6000 });
    return false;
  } finally { b?.close(); }
}

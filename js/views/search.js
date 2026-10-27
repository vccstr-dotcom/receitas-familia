import { state } from '../ctx.js';
import { h, icon } from '../ui.js';
import { CATEGORIES, catLabel, wordsOf, haystack, norm, ingredientHas, mainIngredients, totalMinutes } from '../util.js';
import { topBar, recipeRow, isFav } from './common.js';

const dietOk = key => r => r.diet?.items?.find(i => i.key === key)?.status === 'adequado';
const FLAGS = [
  { key: 'fav', label: 'Favoritas', test: isFav },
  { key: 'rapida', label: 'Até 30 min', test: r => { const t = totalMinutes(r); return t > 0 && t <= 30; } },
  { key: 'facil', label: 'Fáceis', test: r => r.difficulty === 'fácil' },
  { key: 'fotos', label: 'Com fotografias', test: r => !!r.coverThumb || (r.resultPhotoIds || []).length > 0 },
  { key: 'gluten', label: 'Sem glúten', test: dietOk('gluten'), diet: true },
  { key: 'diabetes', label: 'Para diabéticos', test: dietOk('diabetes'), diet: true },
  { key: 'lactose', label: 'Sem lactose', test: dietOk('lactose'), diet: true },
  { key: 'vegetariano', label: 'Vegetarianas', test: dietOk('vegetariano'), diet: true },
];

const S = { q: '', mode: 'nome', cats: new Set(), flags: new Set(), sort: 'az', have: [], key: '' };

export function searchView(params) {
  const key = params.toString();
  if (key !== S.key) {
    S.key = key; S.q = params.get('q') || ''; S.mode = params.get('modo') === 'tenho' ? 'tenho' : 'nome';
    S.cats = new Set(params.get('cat') ? [params.get('cat')] : []); S.flags = new Set();
    S.sort = params.get('ordem') === 'recentes' ? 'recentes' : 'az'; S.have = [];
  }

  const results = h('div', { class: 'results' });
  const filtersEl = h('div', { class: 'filters' });

  // Caixa de pesquisa por nome/palavra
  const qInput = h('input', { type: 'search', class: 'input big', placeholder: 'Nome, ingrediente, pessoa ou livro', value: S.q, 'aria-label': 'Pesquisar', enterkeyhint: 'search',
    onInput: e => { S.q = e.target.value; update(); } });

  // Caixa "o que tenho em casa"
  const chips = h('div', { class: 'chips have-chips' });
  const haveInput = h('input', { type: 'text', class: 'input big', placeholder: 'Escreva um ingrediente e toque Enter', 'aria-label': 'Ingredientes que tenho', enterkeyhint: 'enter',
    onKeydown: e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addHave(haveInput.value); } },
    onBlur: () => { if (haveInput.value.trim()) addHave(haveInput.value); } });
  function addHave(v) {
    v.split(/[,;]/).map(s => s.trim()).filter(Boolean).forEach(t => { if (!S.have.some(x => norm(x) === norm(t))) S.have.push(t); });
    haveInput.value = ''; drawHave(); update();
  }
  function drawHave() {
    chips.replaceChildren(...S.have.map(t => h('button', { class: 'chip on', onClick: () => { S.have = S.have.filter(x => x !== t); drawHave(); update(); }, 'aria-label': `Remover ${t}` }, t, icon('x', 'sm'))));
  }
  drawHave();

  const modeSwitch = h('div', { class: 'segmented', role: 'tablist' },
    h('button', { role: 'tab', 'aria-selected': S.mode === 'nome' ? 'true' : 'false', onClick: () => { S.mode = 'nome'; draw(); } }, 'Procurar'),
    h('button', { role: 'tab', 'aria-selected': S.mode === 'tenho' ? 'true' : 'false', onClick: () => { S.mode = 'tenho'; draw(); } }, 'O que tenho em casa'));

  const box = h('div', { class: 'search-box' });
  function draw() {
    modeSwitch.children[0].setAttribute('aria-selected', S.mode === 'nome');
    modeSwitch.children[1].setAttribute('aria-selected', S.mode === 'tenho');
    box.replaceChildren(...(S.mode === 'nome'
      ? [qInput]
      : [haveInput, chips, h('p', { class: 'hint' }, 'Mostra primeiro as receitas em que já tem mais ingredientes. Sal, água, azeite e pimenta não contam.')]));
    update();
  }

  function drawFilters() {
    const chip = (on, label, toggle) => h('button', { class: `chip${on ? ' on' : ''}`, 'aria-pressed': on ? 'true' : 'false', onClick: () => { toggle(); drawFilters(); update(); } }, label);
    const anyDiet = FLAGS.some(f => f.diet && S.flags.has(f.key));
    filtersEl.replaceChildren(
      h('div', { class: 'chips scroll', 'aria-label': 'Categorias' }, CATEGORIES.map(c => chip(S.cats.has(c.key), c.label, () => (S.cats.has(c.key) ? S.cats.delete(c.key) : S.cats.add(c.key))))),
      h('div', { class: 'chips scroll', 'aria-label': 'Filtros' }, FLAGS.map(f => chip(S.flags.has(f.key), f.label, () => (S.flags.has(f.key) ? S.flags.delete(f.key) : S.flags.add(f.key))))),
      anyDiet ? h('p', { class: 'hint' }, 'Os filtros de dieta só mostram receitas já analisadas pelo assistente (botão "Verificar alergias e dietas" em cada receita).') : null,
      h('label', { class: 'sort' }, 'Ordenar por ',
        h('select', { class: 'select', onChange: e => { S.sort = e.target.value; update(); } },
          [['az', 'nome (A–Z)'], ['recentes', 'mais recentes'], ['rapidas', 'mais rápidas']].map(([v, l]) => h('option', { value: v, selected: S.sort === v }, l)))));
  }

  function update() {
    let list = state.recipes.filter(r => (!S.cats.size || S.cats.has(r.category)) && FLAGS.every(f => !S.flags.has(f.key) || f.test(r)));
    const extras = new Map();
    if (S.mode === 'nome') {
      const tokens = wordsOf(S.q);
      if (tokens.length) {
        const scored = [];
        for (const r of list) {
          const hay = haystack(r), title = norm(r.title);
          if (!tokens.every(t => hay.includes(t))) continue;
          scored.push([r, tokens.reduce((s, t) => s + (title.includes(t) ? 3 : 1), 0)]);
        }
        list = scored.sort((a, b) => b[1] - a[1] || a[0].title.localeCompare(b[0].title, 'pt')).map(x => x[0]);
      } else list = sortList(list);
    } else if (S.have.length) {
      const scored = [];
      for (const r of list) {
        const got = S.have.filter(t => ingredientHas(r, t));
        if (!got.length) continue;
        const missing = mainIngredients(r).filter(i => !S.have.some(t => ingredientHas({ ingredients: [i] }, t))).map(i => i.name);
        scored.push([r, got.length, missing]);
        extras.set(r.id, missing.length
          ? `Tem ${got.length} · ${missing.length === 1 ? 'falta' : 'faltam'}: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}`
          : 'Tem tudo o que é preciso');
      }
      list = scored.sort((a, b) => b[1] - a[1] || a[2].length - b[2].length).map(x => x[0]);
    } else list = sortList(list);

    const label = S.mode === 'tenho' && !S.have.length
      ? 'Acrescente os ingredientes que tem em casa.'
      : list.length === 1 ? '1 receita' : `${list.length} receitas`;
    results.replaceChildren(
      h('p', { class: 'result-count', 'aria-live': 'polite' }, label),
      list.length ? h('div', { class: 'rlist' }, list.map(r => recipeRow(r, extras.get(r.id)))) :
        (S.mode === 'tenho' && !S.have.length ? null : h('div', { class: 'empty small' }, h('p', {}, 'Nenhuma receita corresponde. Experimente tirar alguns filtros.'))));
  }

  function sortList(list) {
    const c = [...list];
    if (S.sort === 'recentes') return c.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (S.sort === 'rapidas') return c.sort((a, b) => (totalMinutes(a) || 9999) - (totalMinutes(b) || 9999));
    return c.sort((a, b) => a.title.localeCompare(b.title, 'pt'));
  }

  drawFilters();
  draw();
  const title = S.cats.size === 1 && !S.q ? catLabel([...S.cats][0]) : 'Pesquisar';
  const page = h('div', { class: 'page' }, topBar(title, { back: true }), h('div', { class: 'pad' }, modeSwitch, box, filtersEl), results);
  page.onData = update;
  setTimeout(() => { if (!S.cats.size) (S.mode === 'nome' ? qInput : haveInput).focus(); }, 60);
  return page;
}

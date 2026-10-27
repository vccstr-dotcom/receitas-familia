import { state } from '../ctx.js';
import { h, icon, azulejo, emptyState } from '../ui.js';
import { CATEGORIES } from '../util.js';
import { recipeRow, isFav } from './common.js';

export function homeView() {
  const recipes = state.recipes;
  const counts = Object.fromEntries(CATEGORIES.map(c => [c.key, 0]));
  recipes.forEach(r => { counts[r.category in counts ? r.category : 'outros']++; });

  const head = h('header', { class: 'home-head' },
    h('h1', { class: 'brand' }, 'Receitas da Família'),
    h('p', { class: 'brand-sub' }, !state.loaded ? 'A abrir o caderno…'
      : recipes.length === 1 ? '1 receita guardada' : `${recipes.length} receitas guardadas`),
    state.mode === 'local' ? h('a', { class: 'mode-note', href: '#/definicoes' }, 'Modo local: as receitas ficam só neste aparelho') : null);

  const search = h('div', { class: 'home-search' },
    h('a', { class: 'searchbar', href: '#/pesquisa' }, icon('search'), h('span', {}, 'Procurar receita, ingrediente ou pessoa')),
    h('a', { class: 'fridge-link', href: '#/pesquisa?modo=tenho' }, icon('basket'), h('span', {}, 'O que posso fazer com o que tenho em casa?')));

  if (state.loaded && !recipes.length) {
    return h('div', { class: 'page home' }, head,
      emptyState('O caderno ainda está vazio', 'Fotografe a primeira receita da família, importe um ficheiro Word ou escreva-a à mão.',
        h('a', { class: 'btn primary big', href: '#/adicionar' }, icon('plus'), 'Adicionar a primeira receita')));
  }

  const tiles = h('nav', { class: 'tiles', 'aria-label': 'Categorias' },
    CATEGORIES.map(c => h('a', { class: `tile${counts[c.key] ? '' : ' empty-cat'}`, href: `#/pesquisa?cat=${c.key}` },
      h('span', { class: 'tile-art', html: azulejo(c.motif) }),
      h('span', { class: 'tile-label' }, c.label),
      h('span', { class: 'tile-count' }, counts[c.key] === 1 ? '1 receita' : `${counts[c.key]} receitas`))));

  const favs = recipes.filter(isFav).sort((a, b) => a.title.localeCompare(b.title, 'pt'));
  const recent = [...recipes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);

  return h('div', { class: 'page home' }, head, search,
    h('section', { class: 'block' }, h('h2', { class: 'section-title' }, 'Categorias'), tiles),
    favs.length ? h('section', { class: 'block' }, h('h2', { class: 'section-title' }, 'Favoritas'), h('div', { class: 'rlist' }, favs.slice(0, 8).map(r => recipeRow(r)))) : null,
    recent.length ? h('section', { class: 'block' },
      h('div', { class: 'section-head' }, h('h2', { class: 'section-title' }, 'Adicionadas recentemente'), h('a', { class: 'link', href: '#/pesquisa?ordem=recentes' }, 'Ver todas')),
      h('div', { class: 'rlist' }, recent.map(r => recipeRow(r, r.authorName ? `por ${r.authorName}` : null)))) : null);
}

import { state, goBack } from '../ctx.js';
import { h, icon, azulejo, toast, sheet, confirmDialog } from '../ui.js';
import { catOf, catLabel, fmtMinutes, totalMinutes } from '../util.js';
import { dataUrlToFile } from '../images.js';

export function topBar(title, { back = true, actions = [], fallback = '#/' } = {}) {
  return h('header', { class: 'topbar' },
    back ? h('button', { class: 'icon-btn', 'aria-label': 'Voltar', onClick: () => goBack(fallback) }, icon('back')) : null,
    h('h1', { class: 'topbar-title' }, title),
    h('div', { class: 'topbar-actions' }, actions));
}

// Imagem guardada na base de dados, carregada quando for precisa.
export function photoEl(id, { cls = '', alt = '', onClick } = {}) {
  const im = h('img', { class: `photo ${cls}`, alt, decoding: 'async' });
  const wrap = h(onClick ? 'button' : 'div', { class: `photo-wrap loading ${cls}`, onClick, 'aria-label': onClick ? (alt || 'Ver fotografia') : null }, im);
  state.store.getPhoto(id).then(src => {
    if (src) { im.src = src; wrap.classList.remove('loading'); }
    else { wrap.classList.remove('loading'); wrap.classList.add('missing'); }
  });
  return wrap;
}

export function thumbOf(r, cls = 'thumb') {
  if (r.coverThumb) return h('img', { class: cls, src: r.coverThumb, alt: '', loading: 'lazy' });
  return h('span', { class: `${cls} thumb-tile`, html: azulejo(catOf(r.category).motif) });
}

export function recipeRow(r, extra) {
  const t = totalMinutes(r);
  return h('a', { class: 'rrow', href: `#/receita/${r.id}` },
    thumbOf(r),
    h('span', { class: 'rrow-main' },
      h('span', { class: 'rrow-title' }, r.title),
      h('span', { class: 'rrow-meta' },
        h('span', {}, catLabel(r.category)),
        t ? h('span', {}, icon('clock', 'sm'), fmtMinutes(t)) : null,
        r.variantLabel ? h('span', { class: 'pill' }, r.variantLabel) : null,
        isFav(r) ? h('span', { class: 'fav-dot', title: 'Favorita' }, icon('heart', 'sm')) : null),
      extra ? h('span', { class: 'rrow-extra' }, extra) : null),
    icon('right', 'rrow-chev'));
}

export const isFav = r => (r.favoriteBy || []).includes(state.user?.uid || 'local');

// Partilhar uma ou mais imagens e/ou texto (WhatsApp, email, etc.).
export async function shareContent({ title, text, images = [] }) {
  const files = images.map((d, i) => dataUrlToFile(d, `${(title || 'receita').replace(/[^\w-]+/g, '_')}_${i + 1}.jpg`));
  try {
    if (files.length && navigator.canShare?.({ files })) {
      await navigator.share({ title, text, files });
      return;
    }
    if (navigator.share) { await navigator.share({ title, text }); return; }
  } catch (e) {
    if (e.name === 'AbortError') return;
  }
  // Alternativa: copiar o texto e descarregar as imagens.
  try { await navigator.clipboard.writeText(text || title || ''); toast('Texto copiado. Pode colá-lo onde quiser.'); } catch { /* sem acesso */ }
  for (const f of files) {
    const a = h('a', { href: URL.createObjectURL(f), download: f.name });
    document.body.append(a); a.click(); a.remove();
  }
}

// Visualizador de fotografia em ecrã inteiro.
export function photoViewer(id, { title = 'Fotografia', recipe, onSetCover, onDelete } = {}) {
  let dataUrl = null;
  const im = h('img', { class: 'viewer-img', alt: title });
  state.store.getPhoto(id).then(d => { dataUrl = d; if (d) im.src = d; });
  const s = sheet(title, h('div', { class: 'viewer' }, im,
    h('div', { class: 'row-actions wrap' },
      h('button', { class: 'btn primary', onClick: () => dataUrl && shareContent({ title: recipe?.title || title, text: recipe ? `${recipe.title} — feito em casa` : '', images: [dataUrl] }) }, icon('share'), 'Partilhar'),
      onSetCover ? h('button', { class: 'btn ghost', onClick: () => { onSetCover(dataUrl); s.close(); } }, icon('image'), 'Usar como capa') : null,
      onDelete ? h('button', { class: 'btn ghost danger-text', onClick: async () => { if (await confirmDialog('Apagar esta fotografia?', { ok: 'Apagar', danger: true })) { await onDelete(); s.close(); } } }, icon('trash'), 'Apagar') : null)), { wide: true });
  return s;
}

export function notFound() {
  return h('div', { class: 'page' }, topBar('Receita'), h('div', { class: 'empty' }, h('h2', {}, 'Esta receita já não existe.'), h('p', {}, 'Pode ter sido apagada por outra pessoa da família.'), h('a', { class: 'btn primary', href: '#/' }, 'Ir para o início')));
}

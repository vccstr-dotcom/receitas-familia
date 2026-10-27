// Funções auxiliares: texto, quantidades, ingredientes, categorias.

export const APP_VERSION = '1.0.0';

export const CATEGORIES = [
  { key: 'entradas', label: 'Entradas', motif: 0 },
  { key: 'sopas', label: 'Sopas', motif: 1 },
  { key: 'peixe', label: 'Pratos de peixe', motif: 2 },
  { key: 'carne', label: 'Pratos de carne', motif: 3 },
  { key: 'vegetariano', label: 'Vegetarianos', motif: 4 },
  { key: 'acompanhamentos', label: 'Acompanhamentos', motif: 5 },
  { key: 'sobremesas', label: 'Sobremesas', motif: 6 },
  { key: 'bolos', label: 'Bolos e bolachas', motif: 7 },
  { key: 'pao', label: 'Pão e salgados', motif: 8 },
  { key: 'bebidas', label: 'Bebidas', motif: 9 },
  { key: 'outros', label: 'Outros', motif: 10 },
];
export const CATEGORY_KEYS = CATEGORIES.map(c => c.key);
export const catOf = key => CATEGORIES.find(c => c.key === key) || CATEGORIES[CATEGORIES.length - 1];
export const catLabel = key => catOf(key).label;

export const DIFFICULTIES = ['fácil', 'média', 'difícil'];

export const norm = s => (s ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Assinatura dos ingredientes: serve para saber se as calorias/alergias ficaram desatualizadas.
export const recipeBasis = r => hash(JSON.stringify([
  r.servings || null,
  (r.ingredients || []).map(i => [i.qty ?? null, norm(i.unit), norm(i.name)]),
]));

export function fmtMinutes(m) {
  m = Number(m) || 0;
  if (!m) return '';
  const hh = Math.floor(m / 60), mm = m % 60;
  if (!hh) return `${mm} min`;
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}

export const totalMinutes = r => (Number(r.prepMinutes) || 0) + (Number(r.cookMinutes) || 0);

export function fmtDate(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ---------- Quantidades ----------
const FRAC = [[0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];
const UNICODE_FRAC = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
const METRIC = /^(g|gr|kg|mg|ml|l|dl|cl)$/i;

export function fmtQty(q, unit) {
  if (q == null || q === '' || isNaN(q)) return '';
  q = Number(q);
  if (METRIC.test(unit || '')) {
    if (q >= 100) return String(Math.round(q / 5) * 5);
    if (q >= 10) return String(Math.round(q));
    return String(Math.round(q * 10) / 10).replace('.', ',');
  }
  let whole = Math.floor(q), frac = q - whole;
  if (frac > 0.93) { whole++; frac = 0; }
  let fs = '';
  if (frac >= 0.07) {
    const best = FRAC.reduce((a, b) => (Math.abs(b[0] - frac) < Math.abs(a[0] - frac) ? b : a));
    if (Math.abs(best[0] - frac) < 0.09) fs = best[1];
    else return String(Math.round(q * 10) / 10).replace('.', ',');
  }
  if (!whole && fs) return fs;
  if (!whole && !fs) return q > 0 ? String(Math.round(q * 100) / 100).replace('.', ',') : '0';
  return fs ? `${whole} ${fs}` : String(whole);
}

export function parseQty(s) {
  s = (s || '').trim();
  if (UNICODE_FRAC[s] != null) return UNICODE_FRAC[s];
  let m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = s.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  m = s.match(/^(\d+)\s*([½¼¾⅓⅔])$/);
  if (m) return Number(m[1]) + UNICODE_FRAC[m[2]];
  const n = Number(s.replace(',', '.'));
  return isNaN(n) ? null : n;
}

const UNITS = [
  'colheres de sopa', 'colher de sopa', 'colheres de chá', 'colher de chá', 'colheres de sobremesa', 'colher de sobremesa',
  'c. de sopa', 'c. de chá', 'c. sopa', 'c. chá', 'c.s.', 'c.c.', 'chávenas', 'chávena', 'copos', 'copo', 'latas', 'lata',
  'pacotes', 'pacote', 'embalagens', 'embalagem', 'dentes', 'dente', 'pitadas', 'pitada', 'fatias', 'fatia', 'folhas', 'folha',
  'raminhos', 'raminho', 'molhos', 'molho', 'unidades', 'unidade', 'tabletes', 'tablete', 'kg', 'mg', 'ml', 'dl', 'cl', 'gr', 'g', 'l',
];

export function parseIngredientLine(raw) {
  let s = (raw || '').trim().replace(/^[-•*·–]\s*/, '');
  if (!s) return null;
  if (/:$/.test(s) && s.length < 60) return { qty: null, unit: '', name: s.replace(/:$/, '').trim(), note: '', heading: true };
  let qty = null, unit = '';
  const m = s.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\s*[½¼¾⅓⅔]|\d+(?:[.,]\d+)?|[½¼¾⅓⅔])(?:\s*(?:a|-|–)\s*\d+(?:[.,]\d+)?)?\s*/);
  if (m) {
    qty = parseQty(m[1]);
    s = s.slice(m[0].length);
    const sl = norm(s);
    for (const u of UNITS) {
      const un = norm(u);
      if (sl.startsWith(un) && (sl.length === un.length || /[\s.,]/.test(sl[un.length]))) {
        unit = s.slice(0, u.length).trim();
        s = s.slice(u.length).replace(/^[.\s]+/, '');
        break;
      }
    }
    s = s.replace(/^de\s+/i, '').replace(/^d['’]\s*/i, '');
  }
  const qb = /[,\s]*\bq\.?\s?b\.?$/i;
  if (qb.test(s)) { s = s.replace(qb, ''); if (!unit) unit = 'q.b.'; }
  let note = '';
  const paren = s.match(/\s*\(([^)]*)\)\s*$/);
  if (paren) { note = paren[1]; s = s.slice(0, paren.index); }
  return { qty, unit, name: s.trim(), note, heading: false };
}

export function ingredientLine(i, factor = 1) {
  if (!i) return '';
  if (i.heading) return `${i.name}:`;
  const q = i.qty != null && i.qty !== '' ? fmtQty(Number(i.qty) * factor, i.unit) : '';
  const unit = (i.unit || '').trim();
  const note = i.note ? ` (${i.note})` : '';
  if (unit.toLowerCase() === 'q.b.') return `${q ? q + ' ' : ''}${i.name} q.b.${note}`;
  if (q && unit) return `${q} ${unit} de ${i.name}${note}`;
  if (q) return `${q} ${i.name}${note}`;
  if (unit) return `${unit} de ${i.name}${note}`;
  return `${i.name}${note}`;
}

export function ingredientParts(i, factor = 1) {
  const q = i.qty != null && i.qty !== '' ? fmtQty(Number(i.qty) * factor, i.unit) : '';
  const unit = (i.unit || '').trim();
  const isQb = unit.toLowerCase() === 'q.b.';
  const amount = isQb ? (q ? `${q} q.b.` : 'q.b.') : [q, unit].filter(Boolean).join(' ');
  return { amount, name: i.name + (i.note ? ` (${i.note})` : '') };
}

// ---------- Receita em texto ----------
export function recipeToText(r, factor = 1) {
  const lines = [r.title, ''];
  const servings = r.servings ? Math.round(r.servings * factor) : null;
  if (servings) lines.push(`Doses: ${servings}`);
  const t = totalMinutes(r);
  if (t) lines.push(`Tempo: ${fmtMinutes(t)}`);
  lines.push('', 'Ingredientes');
  for (const i of r.ingredients || []) lines.push(i.heading ? `\n${i.name}:` : `- ${ingredientLine(i, factor)}`);
  lines.push('', 'Preparação');
  (r.steps || []).forEach((s, k) => lines.push(`${k + 1}. ${s.text}`));
  if (r.notes) lines.push('', `Notas: ${r.notes}`);
  lines.push('', '— Receitas da Família');
  return lines.join('\n');
}

export function recipeToPrompt(r) {
  const out = [`Título: ${r.title}`, `Categoria: ${catLabel(r.category)}`];
  if (r.servings) out.push(`Doses: ${r.servings}`);
  if (r.prepMinutes || r.cookMinutes) out.push(`Tempo de preparação: ${r.prepMinutes || 0} min; cozedura: ${r.cookMinutes || 0} min`);
  out.push('Ingredientes:');
  for (const i of r.ingredients || []) out.push(i.heading ? `${i.name}:` : `- ${ingredientLine(i)}`);
  out.push('Preparação:');
  (r.steps || []).forEach((s, k) => out.push(`${k + 1}. ${s.text}`));
  if (r.notes) out.push(`Notas: ${r.notes}`);
  return out.join('\n');
}

// Garante que uma receita (vinda da IA, de um ficheiro ou antiga) tem todos os campos.
export function normalizeRecipe(x = {}) {
  const r = { ...x };
  r.title = (r.title || '').toString().trim() || 'Receita sem título';
  r.category = CATEGORY_KEYS.includes(r.category) ? r.category : 'outros';
  r.servings = Number(r.servings) > 0 ? Math.round(Number(r.servings)) : null;
  r.prepMinutes = Number(r.prepMinutes) > 0 ? Math.round(Number(r.prepMinutes)) : null;
  r.cookMinutes = Number(r.cookMinutes) > 0 ? Math.round(Number(r.cookMinutes)) : null;
  r.difficulty = DIFFICULTIES.includes(r.difficulty) ? r.difficulty : '';
  r.source = (r.source || '').toString();
  r.notes = (r.notes || '').toString();
  r.tags = Array.isArray(r.tags) ? r.tags.map(t => String(t).trim()).filter(Boolean) : [];
  r.ingredients = (Array.isArray(r.ingredients) ? r.ingredients : []).map(i => {
    if (typeof i === 'string') return parseIngredientLine(i);
    return {
      qty: i.qty === '' || i.qty == null || isNaN(Number(i.qty)) ? null : Number(i.qty),
      unit: (i.unit || '').toString().trim(),
      name: (i.name || '').toString().trim(),
      note: (i.note || '').toString().trim(),
      heading: !!i.heading,
    };
  }).filter(i => i && i.name);
  r.steps = (Array.isArray(r.steps) ? r.steps : []).map(s => (typeof s === 'string' ? { text: s, photoId: null } : { text: (s.text || '').toString(), photoId: s.photoId || null }))
    .filter(s => s.text.trim() || s.photoId);
  r.resultPhotoIds = Array.isArray(r.resultPhotoIds) ? r.resultPhotoIds : [];
  r.originalPhotoIds = Array.isArray(r.originalPhotoIds) ? r.originalPhotoIds : [];
  r.favoriteBy = Array.isArray(r.favoriteBy) ? r.favoriteBy : [];
  r.coverPhotoId = r.coverPhotoId || null;
  r.coverThumb = r.coverThumb || null;
  r.parentId = r.parentId || null;
  r.variantLabel = r.variantLabel || '';
  r.nutrition = r.nutrition || null;
  r.diet = r.diet || null;
  return r;
}

// ---------- Pesquisa ----------
export const PANTRY = ['sal', 'agua', 'pimenta', 'azeite', 'oleo'];

const singular = w => w.replace(/(oes|aes)$/, 'ao').replace(/es$/, '').replace(/s$/, '');

export function wordsOf(s) { return norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 1); }

export function haystack(r) {
  return norm([
    r.title, catLabel(r.category), r.source, r.authorName, r.notes, (r.tags || []).join(' '),
    (r.ingredients || []).map(i => i.name).join(' '), r.variantLabel,
  ].join(' '));
}

export function ingredientHas(r, term) {
  const t = singular(norm(term));
  if (!t) return false;
  return (r.ingredients || []).some(i => !i.heading && wordsOf(i.name).map(singular).join(' ').includes(t));
}

export function mainIngredients(r) {
  return (r.ingredients || []).filter(i => !i.heading && !PANTRY.includes(singular(norm(i.name))));
}

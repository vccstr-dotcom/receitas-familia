// Pequenas peças de interface reutilizadas em todos os ecrãs.

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (['value', 'checked', 'disabled', 'selected', 'multiple', 'hidden'].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

const ICONS = {
  search: '<circle cx="11" cy="11" r="7.5"/><path d="m20.5 20.5-4.2-4.2"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
  pencil: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  back: '<path d="m12 19-7-7 7-7M19 12H5"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15v5M16.5 17.5h5"/>',
  clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.5V12l3.5 2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>',
  swap: '<path d="M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  more: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  basket: '<path d="m5 11 4-7M19 11l-4-7M2 11h20M3.5 11l1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.6-7.4M9 15v2M15 15v2"/>',
};

export function icon(name, cls = '') {
  return h('span', {
    class: `ic ${cls}`,
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`,
  });
}

// ---------- Azulejos: o padrão gráfico da app ----------
const CORNERS = [
  c => `<circle cx="0" cy="0" r="24" fill="${c}"/><circle cx="100" cy="0" r="24" fill="${c}"/><circle cx="0" cy="100" r="24" fill="${c}"/><circle cx="100" cy="100" r="24" fill="${c}"/>`,
  c => `<g fill="none" stroke="${c}" stroke-width="7"><circle cx="0" cy="0" r="30"/><circle cx="100" cy="0" r="30"/><circle cx="0" cy="100" r="30"/><circle cx="100" cy="100" r="30"/></g>`,
  c => `<g fill="${c}"><path d="M0 0h30L0 30z"/><path d="M100 0v30L70 0z"/><path d="M0 100v-30l30 30z"/><path d="M100 100H70l30-30z"/></g>`,
  c => `<g fill="${c}"><path d="M0 0c22 2 30 10 32 32C10 30 2 22 0 0z"/><path d="M100 0c-22 2-30 10-32 32 22-2 30-10 32-32z"/><path d="M0 100c22-2 30-10 32-32-22 2-30 10-32 32z"/><path d="M100 100c-22-2-30-10-32-32 22 2 30 10 32 32z"/></g>`,
];
const CENTERS = [
  (c, l) => `<g transform="translate(50 50)"><g fill="${l}">${[45, 135].map(a => `<ellipse rx="8" ry="25" transform="rotate(${a})"/>`).join('')}</g><g fill="${c}">${[0, 90].map(a => `<ellipse rx="9" ry="26" transform="rotate(${a})"/>`).join('')}</g><circle r="7" fill="var(--papel)"/><circle r="3.5" fill="${c}"/></g>`,
  (c, l) => `<g transform="translate(50 50)"><rect x="-21" y="-21" width="42" height="42" fill="${c}"/><rect x="-21" y="-21" width="42" height="42" fill="${c}" transform="rotate(45)"/><rect x="-11" y="-11" width="22" height="22" fill="${l}" transform="rotate(45)"/><circle r="5" fill="var(--papel)"/></g>`,
  (c, l) => `<g transform="translate(50 50)"><circle r="24" fill="${c}"/><circle r="16" fill="var(--papel)"/><circle r="10" fill="${l}"/><circle r="4" fill="${c}"/></g>`,
  (c, l) => `<g transform="translate(50 50)"><path d="M0-30 30 0 0 30-30 0z" fill="${c}"/><path d="M0-17 17 0 0 17-17 0z" fill="var(--papel)"/><path d="M0-9 9 0 0 9-9 0z" fill="${l}"/></g>`,
  (c, l) => `<g transform="translate(50 50)" fill="${c}"><rect x="-7" y="-30" width="14" height="60" rx="7"/><rect x="-30" y="-7" width="60" height="14" rx="7"/><circle r="12" fill="${l}"/><circle r="5" fill="var(--papel)"/></g>`,
];

export function azulejo(n = 0) {
  const c = 'var(--cobalto)', l = 'var(--cobalto-claro)';
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="100" height="100" fill="var(--papel)"/>${CORNERS[n % 4](c)}${CENTERS[n % 5](c, l)}</svg>`;
}

// Versão para fundo repetido (cores fixas porque fica num URL de dados).
export function azulejoBg(n = 0, dark = false) {
  const c = dark ? '#7FA0EA' : '#1D4AA6', l = dark ? '#3A5596' : '#9DB3E3', p = dark ? '#17213A' : '#FFFFFF';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${p}"/>${CORNERS[n % 4](c)}${CENTERS[n % 5](c, l).replaceAll('var(--papel)', p)}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// ---------- Avisos, folhas e diálogos ----------
export function toast(msg, { action, onAction, ms = 3200 } = {}) {
  const wrap = document.getElementById('toasts');
  const t = h('div', { class: 'toast', role: 'status' }, h('span', {}, msg),
    action ? h('button', { class: 'toast-action', onClick: () => { onAction?.(); t.remove(); } }, action) : null);
  wrap.append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

let sheetDepth = 0;
const openSheets = new Set();
export function closeAllSheets() { [...openSheets].forEach(c => c()); }
export function sheet(title, body, { wide = false, onClose } = {}) {
  const prevFocus = document.activeElement;
  const panel = h('div', { class: `sheet-panel${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const backdrop = h('div', { class: 'sheet', onClick: e => { if (e.target === backdrop) close(); } }, panel);
  const head = h('div', { class: 'sheet-head' }, h('h2', {}, title),
    h('button', { class: 'icon-btn', 'aria-label': 'Fechar', onClick: () => close() }, icon('x')));
  const content = h('div', { class: 'sheet-body' });
  panel.append(head, content);
  const setBody = node => { content.replaceChildren(...[].concat(node).filter(Boolean)); content.scrollTop = 0; };
  setBody(body);
  document.body.append(backdrop);
  sheetDepth++;
  document.body.classList.add('no-scroll');
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => backdrop.classList.add('open'));
  let closed = false;
  openSheets.add(close);
  function close() {
    if (closed) return;
    closed = true;
    openSheets.delete(close);
    document.removeEventListener('keydown', onKey);
    backdrop.classList.remove('open');
    setTimeout(() => backdrop.remove(), 220);
    sheetDepth--;
    if (!sheetDepth) document.body.classList.remove('no-scroll');
    prevFocus?.focus?.();
    onClose?.();
  }
  setTimeout(() => panel.querySelector('button, input, textarea, select')?.focus(), 50);
  return { close, setBody, content, panel };
}

export function confirmDialog(text, { ok = 'Confirmar', danger = false } = {}) {
  return new Promise(resolve => {
    let answered = false;
    const s = sheet('Confirmar', h('div', {},
      h('p', { class: 'confirm-text' }, text),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn ghost', onClick: () => { answered = true; s.close(); resolve(false); } }, 'Cancelar'),
        h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onClick: () => { answered = true; s.close(); resolve(true); } }, ok))),
    { onClose: () => { if (!answered) resolve(false); } });
  });
}

export function busy(msg) {
  const label = h('p', {}, msg);
  const el = h('div', { class: 'busy', role: 'alert', 'aria-live': 'assertive' },
    h('div', { class: 'busy-box' }, h('div', { class: 'busy-tile', html: azulejo(0) }), label));
  document.body.append(el);
  return { close: () => el.remove(), set: t => { label.textContent = t; } };
}

export function emptyState(title, text, action) {
  return h('div', { class: 'empty' },
    h('div', { class: 'empty-art', html: azulejo(3) }),
    h('h2', {}, title), text ? h('p', {}, text) : null, action || null);
}

// Botões para escolher imagens: câmara ou galeria.
export function pickImages({ camera = false, multiple = true } = {}) {
  return new Promise(resolve => {
    const input = h('input', { type: 'file', accept: 'image/*', multiple: !camera && multiple, style: { display: 'none' } });
    if (camera) input.setAttribute('capture', 'environment');
    input.addEventListener('change', () => { resolve([...input.files]); input.remove(); });
    document.body.append(input);
    input.click();
  });
}

export function pickFile(accept) {
  return new Promise(resolve => {
    const input = h('input', { type: 'file', accept, style: { display: 'none' } });
    input.addEventListener('change', () => { resolve(input.files[0] || null); input.remove(); });
    document.body.append(input);
    input.click();
  });
}

export function photoChooser(title = 'Adicionar fotografia', { multiple = true } = {}) {
  return new Promise(resolve => {
    let done = false;
    const choose = async camera => { done = true; s.close(); resolve(await pickImages({ camera, multiple })); };
    const s = sheet(title, h('div', { class: 'choice-list' },
      h('button', { class: 'choice', onClick: () => choose(true) }, icon('camera'), h('span', {}, 'Tirar fotografia')),
      h('button', { class: 'choice', onClick: () => choose(false) }, icon('image'), h('span', {}, multiple ? 'Escolher da galeria' : 'Escolher uma fotografia'))),
    { onClose: () => { if (!done) resolve([]); } });
  });
}

export function img(src, alt = '', cls = '') {
  return h('img', { src, alt, class: cls, loading: 'lazy', decoding: 'async' });
}

// Arranque da app e navegação entre ecrãs.
import { state, setRender, trackNav, setRecipes, go } from './ctx.js';
import { h, icon, toast, closeAllSheets } from './ui.js';
import { normalizeRecipe } from './util.js';
import { LocalStore, readLocalSettings } from './store-local.js';
import { CloudStore, firebaseConfigured } from './store-cloud.js';
import { homeView } from './views/home.js';
import { searchView } from './views/search.js';
import { recipeView } from './views/recipe.js';
import { editView } from './views/edit.js';
import { importView } from './views/import.js';
import { cookView } from './views/cook.js';
import { settingsView } from './views/settings.js';
import { loginView, verifyView, deniedView, bootErrorView } from './views/login.js';

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
let current = { key: null, node: null };
let gate = null; // null | 'login' | 'verify' | 'denied' | 'error'
let gateError = null;

function parseRoute() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { path, parts, params, key: raw };
}

function route(rt) {
  const [a, b, c] = rt.parts;
  if (!a) return { name: 'home', live: true, make: () => homeView() };
  if (a === 'pesquisa') return { name: 'search', make: () => searchView(rt.params) };
  if (a === 'adicionar') return { name: 'add', make: () => importView() };
  if (a === 'nova') return { name: 'edit', hideTabs: true, make: () => editView(null) };
  if (a === 'receita' && b && c === 'editar') return { name: 'edit', hideTabs: true, make: () => editView(b) };
  if (a === 'receita' && b) return { name: 'recipe', live: true, make: () => recipeView(b) };
  if (a === 'cozinhar' && b) return { name: 'cook', hideTabs: true, make: () => cookView(b, rt.params) };
  if (a === 'definicoes') return { name: 'settings', make: () => settingsView() };
  return { name: 'home', live: true, make: () => homeView() };
}

function render(live = false) {
  const rt = parseRoute();
  let r = route(rt);
  if (gate) {
    const make = { login: loginView, verify: verifyView, denied: deniedView, error: () => bootErrorView(gateError, () => location.reload()) }[gate];
    r = { name: 'gate', hideTabs: true, make };
  }
  const sameRoute = current.key === rt.key + (gate || '');
  const y = window.scrollY;
  if (!sameRoute) current.node?.onLeave?.();
  let node;
  try { node = r.make(); } catch (e) {
    console.error(e);
    node = h('div', { class: 'page pad' }, h('h2', {}, 'Ocorreu um erro neste ecrã.'), h('p', { class: 'muted' }, String(e.message || e)), h('a', { class: 'btn primary', href: '#/' }, 'Voltar ao início'));
  }
  view.replaceChildren(node);
  current = { key: rt.key + (gate || ''), node, route: r };
  drawTabs(r);
  if (live && sameRoute) window.scrollTo(0, y); else window.scrollTo(0, 0);
}
setRender(render);

function drawTabs(r) {
  tabbar.hidden = !!r.hideTabs;
  if (r.hideTabs) return;
  const tab = (href, ic, label, active, cls = '') => h('a', { href, class: `tab ${cls}${active ? ' active' : ''}`, 'aria-current': active ? 'page' : null }, icon(ic), h('span', {}, label));
  tabbar.replaceChildren(
    tab('#/', 'book', 'Receitas', ['home', 'recipe'].includes(r.name)),
    tab('#/pesquisa', 'search', 'Pesquisar', r.name === 'search'),
    tab('#/adicionar', 'plus', 'Adicionar', r.name === 'add', 'tab-add'),
    tab('#/definicoes', 'sliders', 'Definições', r.name === 'settings'));
}

function onRecipes(list) {
  setRecipes(list.map(r => ({ ...normalizeRecipe(r), id: r.id, authorName: r.authorName, authorUid: r.authorUid, createdAt: r.createdAt, updatedAt: r.updatedAt })));
  if (gate) return;
  if (current.node?.onData) current.node.onData();
  else if (current.route?.live) render(true);
}

window.addEventListener('hashchange', () => { closeAllSheets(); document.querySelectorAll('.busy').forEach(b => b.remove()); trackNav(location.hash || '#/'); render(false); });

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); state.installPrompt = e; });

// ---------- Arranque ----------
async function boot() {
  trackNav(location.hash || '#/');
  state.settings = { ...readLocalSettings() };
  if (!firebaseConfigured()) {
    const store = new LocalStore();
    await store.init();
    state.store = store; state.mode = 'local'; state.user = { uid: 'local', name: state.settings.myName || 'Eu', email: '' };
    store.onRecipes(onRecipes);
    render(false);
    return;
  }
  const store = new CloudStore();
  state.store = store; state.mode = 'cloud';
  try { await store.init(); } catch (e) { gate = 'error'; gateError = e; render(false); return; }
  let unsub = null;
  store.onAuth(async user => {
    unsub?.(); unsub = null;
    state.user = user;
    setRecipes([]); state.loaded = false;
    if (!user) { gate = 'login'; render(false); return; }
    if (!user.verified) { gate = 'verify'; render(false); return; }
    gate = null;
    render(false);
    unsub = store.onRecipes(onRecipes, err => {
      console.warn(err);
      if (err.code === 'permission-denied') { gate = 'denied'; render(false); }
      else toast('Problema de ligação: ' + err.message);
    });
    const shared = await store.getShared();
    const local = readLocalSettings();
    state.settings = { myName: local.myName || '', geminiKey: shared.geminiKey || '', geminiModel: shared.geminiModel || '' };
  });
}

boot().catch(e => { console.error(e); gate = 'error'; gateError = e; render(false); });

// ---------- Funcionar sem internet ----------
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

window.addEventListener('online', () => toast('De novo com internet.'));
window.addEventListener('offline', () => toast('Sem internet. Pode consultar as receitas; as alterações são enviadas quando voltar a ligação.', { ms: 6000 }));

export { go };

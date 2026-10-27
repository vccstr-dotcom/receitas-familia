// Estado partilhado entre os ecrãs.

export const state = {
  store: null,        // LocalStore ou CloudStore
  mode: 'local',      // 'local' | 'cloud'
  user: null,         // { uid, name, email, verified }
  recipes: [],
  byId: new Map(),
  loaded: false,
  access: 'ok',       // 'ok' | 'denied'
  settings: {},       // { geminiKey, geminiModel, myName }
  isAdmin: false,
};

let renderFn = () => {};
export function setRender(fn) { renderFn = fn; }
export function rerender(live = true) { renderFn(live); }

const stack = [];
export function trackNav(hash) {
  if (stack.length > 1 && stack[stack.length - 2] === hash) stack.pop();
  else if (stack[stack.length - 1] !== hash) stack.push(hash);
}
export function go(hash, { replace = false } = {}) {
  if (replace) { stack.pop(); location.replace(hash); return; }
  if (location.hash === hash) renderFn(false); else location.hash = hash;
}
export function goBack(fallback = '#/') {
  if (stack.length > 1) history.back(); else go(fallback, { replace: true });
}

let draft = null;
export const setDraft = d => { draft = d; };
export const takeDraft = () => { const d = draft; draft = null; return d; };

export const myName = () => state.settings.myName || state.user?.name || 'Eu';

export function setRecipes(list) {
  state.recipes = list;
  state.byId = new Map(list.map(r => [r.id, r]));
  state.loaded = true;
}

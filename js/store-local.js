// Guarda as receitas só neste aparelho (IndexedDB). Usado no "modo local".

import { uid } from './util.js';

const DB_NAME = 'receitas-da-familia';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('recipes')) db.createObjectStore('recipes', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const SETTINGS_KEY = 'rf.settings';
export function readLocalSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
}
export function writeLocalSettings(obj) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...readLocalSettings(), ...obj })); } catch { /* sem espaço */ }
}

export class LocalStore {
  constructor() { this.mode = 'local'; this.listeners = new Set(); this.photoCache = new Map(); }

  async init() { this.db = await openDb(); }

  op(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => resolve(req?.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  async all() { return (await this.op('recipes', 'readonly', s => s.getAll())) || []; }

  async emit() { const list = await this.all(); this.listeners.forEach(cb => cb(list)); }

  onRecipes(cb) {
    this.listeners.add(cb);
    this.all().then(cb);
    return () => this.listeners.delete(cb);
  }

  async saveRecipe(r) {
    const id = r.id || uid();
    const data = JSON.parse(JSON.stringify({ ...r, id }));
    await this.op('recipes', 'readwrite', s => s.put(data));
    this.emit();
    return id;
  }

  async deleteRecipe(id) { await this.op('recipes', 'readwrite', s => s.delete(id)); this.emit(); }

  async toggleFavorite(id, userId, on) {
    const r = await this.op('recipes', 'readonly', s => s.get(id));
    if (!r) return;
    const set = new Set(r.favoriteBy || []);
    on ? set.add(userId) : set.delete(userId);
    r.favoriteBy = [...set];
    await this.saveRecipe(r);
  }

  async savePhoto(data, meta = {}) {
    const id = uid();
    await this.op('photos', 'readwrite', s => s.put({ id, data, ...meta, createdAt: Date.now() }));
    this.photoCache.set(id, data);
    return id;
  }

  async getPhoto(id) {
    if (!id) return null;
    if (this.photoCache.has(id)) return this.photoCache.get(id);
    const p = await this.op('photos', 'readonly', s => s.get(id));
    if (p) this.photoCache.set(id, p.data);
    return p?.data || null;
  }

  async deletePhoto(id) { if (id) { this.photoCache.delete(id); await this.op('photos', 'readwrite', s => s.delete(id)); } }

  async allPhotos() { return (await this.op('photos', 'readonly', s => s.getAll())) || []; }

  async getShared() { const s = readLocalSettings(); return { geminiKey: s.geminiKey || '', geminiModel: s.geminiModel || '' }; }
  async setShared(obj) { writeLocalSettings(obj); }
}

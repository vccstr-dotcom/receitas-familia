// Guarda as receitas na nuvem (Firebase Firestore), partilhadas pela família.
// As fotografias são guardadas comprimidas na própria base de dados,
// para funcionar no plano gratuito do Firebase (sem Cloud Storage).

import { firebaseConfig, FIREBASE_VERSION } from './config.js';
import { uid } from './util.js';

const withTimeout = (p, ms = 5000) => Promise.race([p, new Promise(res => setTimeout(res, ms))]);

export class CloudStore {
  constructor() { this.mode = 'cloud'; this.photoCache = new Map(); }

  async init() {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
    const [appM, authM, fs] = await Promise.all([
      import(base + 'firebase-app.js'),
      import(base + 'firebase-auth.js'),
      import(base + 'firebase-firestore.js'),
    ]);
    this.A = authM; this.F = fs;
    this.app = appM.initializeApp(firebaseConfig);
    this.auth = authM.getAuth(this.app);
    this.auth.languageCode = 'pt';
    try {
      this.db = fs.initializeFirestore(this.app, {
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
      });
    } catch {
      this.db = fs.getFirestore(this.app);
    }
  }

  // ---------- Autenticação ----------
  onAuth(cb) {
    return this.A.onAuthStateChanged(this.auth, u => cb(u ? this.userOf(u) : null));
  }
  userOf(u) {
    return { uid: u.uid, name: u.displayName || (u.email || '').split('@')[0], email: (u.email || '').toLowerCase(), verified: !!u.emailVerified, photo: u.photoURL || '' };
  }
  async signInGoogle() {
    const p = new this.A.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    await this.A.signInWithPopup(this.auth, p);
  }
  async signInEmail(email, pass) { await this.A.signInWithEmailAndPassword(this.auth, email, pass); }
  async signUpEmail(name, email, pass) {
    const cred = await this.A.createUserWithEmailAndPassword(this.auth, email, pass);
    if (name) await this.A.updateProfile(cred.user, { displayName: name });
    await this.A.sendEmailVerification(cred.user);
  }
  async resendVerification() { if (this.auth.currentUser) await this.A.sendEmailVerification(this.auth.currentUser); }
  async refreshUser() {
    const u = this.auth.currentUser;
    if (!u) return null;
    await u.reload();
    await u.getIdToken(true);
    return this.userOf(this.auth.currentUser);
  }
  async resetPassword(email) { await this.A.sendPasswordResetEmail(this.auth, email); }
  async signOut() { await this.A.signOut(this.auth); }

  // ---------- Receitas ----------
  onRecipes(cb, onError) {
    const { collection, onSnapshot } = this.F;
    return onSnapshot(collection(this.db, 'recipes'),
      snap => cb(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
      err => onError?.(err));
  }

  async saveRecipe(r) {
    const { doc, setDoc } = this.F;
    const id = r.id || uid();
    const data = JSON.parse(JSON.stringify(r));
    delete data.id;
    await withTimeout(setDoc(doc(this.db, 'recipes', id), data));
    return id;
  }

  async deleteRecipe(id) { const { doc, deleteDoc } = this.F; await withTimeout(deleteDoc(doc(this.db, 'recipes', id))); }

  async toggleFavorite(id, userId, on) {
    const { doc, updateDoc, arrayUnion, arrayRemove } = this.F;
    await withTimeout(updateDoc(doc(this.db, 'recipes', id), { favoriteBy: on ? arrayUnion(userId) : arrayRemove(userId) }));
  }

  // ---------- Fotografias ----------
  async savePhoto(data, meta = {}) {
    const { doc, setDoc } = this.F;
    const id = uid();
    this.photoCache.set(id, data);
    await withTimeout(setDoc(doc(this.db, 'photos', id), { data, ...meta, createdAt: Date.now() }), 8000);
    return id;
  }

  async getPhoto(id) {
    if (!id) return null;
    if (this.photoCache.has(id)) return this.photoCache.get(id);
    const { doc, getDoc } = this.F;
    try {
      const snap = await getDoc(doc(this.db, 'photos', id));
      const data = snap.exists() ? snap.data().data : null;
      if (data) this.photoCache.set(id, data);
      return data;
    } catch { return null; }
  }

  async deletePhoto(id) {
    if (!id) return;
    const { doc, deleteDoc } = this.F;
    this.photoCache.delete(id);
    try { await withTimeout(deleteDoc(doc(this.db, 'photos', id))); } catch { /* ignora */ }
  }

  // ---------- Definições partilhadas (chave do Gemini, membros) ----------
  async getShared() {
    const { doc, getDoc } = this.F;
    try { const s = await getDoc(doc(this.db, 'config', 'app')); return s.exists() ? s.data() : {}; } catch { return {}; }
  }
  async setShared(obj) { const { doc, setDoc } = this.F; await setDoc(doc(this.db, 'config', 'app'), obj, { merge: true }); }

  async getMembers() {
    const { doc, getDoc } = this.F;
    try { const s = await getDoc(doc(this.db, 'config', 'membros')); return s.exists() ? (s.data().emails || []) : []; } catch { return []; }
  }
  async setMembers(emails) { const { doc, setDoc } = this.F; await setDoc(doc(this.db, 'config', 'membros'), { emails }); }
}

export const firebaseConfigured = () => !!(firebaseConfig.apiKey && firebaseConfig.projectId);

export function authErrorText(e) {
  const code = e?.code || '';
  const map = {
    'auth/invalid-email': 'O email não é válido.',
    'auth/missing-password': 'Escreva a palavra-passe.',
    'auth/weak-password': 'A palavra-passe tem de ter pelo menos 6 caracteres.',
    'auth/email-already-in-use': 'Já existe uma conta com este email. Use "Entrar".',
    'auth/invalid-credential': 'Email ou palavra-passe errados.',
    'auth/wrong-password': 'Email ou palavra-passe errados.',
    'auth/user-not-found': 'Não existe conta com este email.',
    'auth/too-many-requests': 'Demasiadas tentativas. Espere uns minutos.',
    'auth/popup-closed-by-user': 'A janela da Google foi fechada antes de terminar.',
    'auth/cancelled-popup-request': 'A janela da Google foi fechada antes de terminar.',
    'auth/popup-blocked': 'O navegador bloqueou a janela da Google. Tente "Entrar com email".',
    'auth/operation-not-supported-in-this-environment': 'Aqui não é possível entrar com a Google. Use "Entrar com email".',
    'auth/unauthorized-domain': 'Este endereço ainda não está autorizado no Firebase (Authentication > Definições > Domínios autorizados).',
    'auth/operation-not-allowed': 'Este método de entrada não está ativo no Firebase (Authentication > Método de início de sessão).',
    'auth/network-request-failed': 'Sem ligação à internet.',
  };
  return map[code] || (e?.message || 'Ocorreu um erro.');
}

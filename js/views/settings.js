import { state, myName, rerender } from '../ctx.js';
import { h, icon, toast, busy, pickFile, confirmDialog } from '../ui.js';
import { writeLocalSettings, LocalStore } from '../store-local.js';
import { DEFAULT_MODEL, testKey, aiReady } from '../ai.js';
import { APP_VERSION, uid, normalizeRecipe } from '../util.js';
import { topBar } from './common.js';
import { runNutrition, runDiets } from './assistant.js';

export function settingsView() {
  const store = state.store;
  const cloud = state.mode === 'cloud';
  const section = (title, ...kids) => h('section', { class: 'block pad set-block' }, h('h2', { class: 'section-title' }, title), ...kids);

  // ---------- Conta ----------
  const account = cloud
    ? section('A sua conta',
      h('p', {}, h('strong', {}, state.user?.name || ''), h('br'), h('span', { class: 'muted' }, state.user?.email || '')),
      h('button', { class: 'btn ghost', onClick: async () => { if (await confirmDialog('Sair da conta neste aparelho?', { ok: 'Sair' })) store.signOut(); } }, icon('logout'), 'Sair da conta'))
    : section('Modo local',
      h('p', {}, 'As receitas estão guardadas só neste aparelho. Para as partilhar com a família, é preciso ligar o Firebase (ver o guia de instalação). Quando o fizer, pode enviar estas receitas para a nuvem.'));

  const nameIn = h('input', { class: 'input', value: state.settings.myName || '', placeholder: state.user?.name || 'Ex.: Carlota' });
  const nameSec = section('O seu nome',
    h('p', { class: 'muted small' }, 'Aparece nas receitas que adicionar ("Adicionada por…").'),
    h('div', { class: 'inline-form' }, nameIn, h('button', { class: 'btn ghost', onClick: () => { writeLocalSettings({ myName: nameIn.value.trim() }); state.settings.myName = nameIn.value.trim(); toast('Nome guardado.'); } }, 'Guardar')));

  // ---------- Assistente de IA ----------
  const keyIn = h('input', { class: 'input', type: 'password', autocomplete: 'off', value: state.settings.geminiKey || '', placeholder: 'Cole aqui a chave (começa por AIza…)' });
  const modelIn = h('input', { class: 'input', value: state.settings.geminiModel || '', placeholder: DEFAULT_MODEL });
  const aiStatus = h('p', { class: 'muted small', 'aria-live': 'polite' }, aiReady() ? 'Assistente ligado.' : 'Assistente desligado.');
  const aiSec = section('Assistente de IA (Gemini)',
    h('p', { class: 'muted small' }, cloud
      ? 'A chave fica guardada para toda a família: basta colocá-la uma vez. Só quem gere a app a pode alterar.'
      : 'A chave fica guardada neste aparelho.'),
    h('label', { class: 'field' }, h('span', { class: 'field-l' }, 'Chave do Gemini'),
      h('div', { class: 'inline-form' }, keyIn, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mostrar ou esconder a chave', onClick: () => { keyIn.type = keyIn.type === 'password' ? 'text' : 'password'; } }, icon('eye')))),
    h('details', { class: 'adv' }, h('summary', {}, 'Opções avançadas'),
      h('label', { class: 'field' }, h('span', { class: 'field-l' }, 'Modelo'), modelIn, h('span', { class: 'field-hint' }, `Deixe vazio para usar ${DEFAULT_MODEL}.`))),
    h('div', { class: 'row-actions wrap' },
      h('button', { class: 'btn primary', onClick: saveAI }, 'Guardar'),
      h('button', { class: 'btn ghost', onClick: test }, 'Testar ligação')),
    aiStatus);

  async function saveAI() {
    const obj = { geminiKey: keyIn.value.trim(), geminiModel: modelIn.value.trim() };
    try {
      await store.setShared(obj);
      Object.assign(state.settings, obj);
      aiStatus.textContent = aiReady() ? 'Assistente ligado.' : 'Assistente desligado.';
      toast('Guardado.');
    } catch (e) {
      toast(/permission/i.test(e.code || e.message) ? 'Só quem gere a app pode alterar a chave.' : 'Não foi possível guardar: ' + (e.message || ''), { ms: 6000 });
    }
  }
  async function test() {
    const prev = { ...state.settings };
    Object.assign(state.settings, { geminiKey: keyIn.value.trim(), geminiModel: modelIn.value.trim() });
    aiStatus.textContent = 'A testar…';
    try { await testKey(); aiStatus.textContent = 'Funciona! Não se esqueça de tocar em Guardar.'; }
    catch (e) { aiStatus.textContent = e.message; }
    finally { Object.assign(state.settings, prev); }
  }

  // ---------- Membros (só nuvem) ----------
  let membersSec = null;
  if (cloud) {
    const ta = h('textarea', { class: 'input', rows: 4, placeholder: 'mae@gmail.com\nirmao@gmail.com' });
    store.getMembers().then(list => { ta.value = list.join('\n'); });
    membersSec = section('Membros da família',
      h('p', { class: 'muted small' }, 'Emails (um por linha) das pessoas que podem ver e acrescentar receitas. Cada pessoa entra com esse email (conta Google ou email e palavra-passe).'),
      ta,
      h('div', { class: 'row-actions' }, h('button', { class: 'btn primary', onClick: async () => {
        const emails = [...new Set(ta.value.split(/[\s,;]+/).map(s => s.trim().toLowerCase()).filter(s => s.includes('@')))];
        try { await store.setMembers(emails); ta.value = emails.join('\n'); toast('Membros guardados.'); }
        catch (e) { toast(/permission/i.test(e.code || e.message) ? 'Só quem gere a app pode alterar os membros.' : 'Erro: ' + e.message, { ms: 6000 }); }
      } }, 'Guardar membros')));
  }

  // ---------- Analisar receitas em lote ----------
  const missingN = state.recipes.filter(r => !r.nutrition).length;
  const missingD = state.recipes.filter(r => !r.diet).length;
  const batchStatus = h('p', { class: 'muted small', 'aria-live': 'polite' });
  const batchSec = section('Calorias e alergias de todas as receitas',
    h('p', { class: 'muted small' }, `${missingN} receitas sem calorias e ${missingD} sem análise de alergias. Analisá-las permite usar os filtros "Sem glúten", "Para diabéticos", etc. na pesquisa.`),
    h('button', { class: 'btn ghost', disabled: !aiReady() || (!missingN && !missingD), onClick: async e => {
      e.currentTarget.disabled = true;
      const todo = state.recipes.filter(r => !r.nutrition || !r.diet);
      let k = 0;
      try {
        for (const r of todo) {
          k++;
          batchStatus.textContent = `A analisar ${k} de ${todo.length}: ${r.title}`;
          if (!r.nutrition) await runNutrition(state.byId.get(r.id) || r, { quiet: true });
          if (!r.diet) await runDiets(state.byId.get(r.id) || r, { quiet: true });
          await new Promise(res => setTimeout(res, 1500));
        }
        batchStatus.textContent = 'Concluído.';
      } catch (err) { batchStatus.textContent = `Parou: ${err.message}`; }
    } }, icon('sparkle'), 'Analisar as receitas em falta'),
    batchStatus);

  // ---------- Cópias de segurança ----------
  const backupSec = section('Cópia de segurança',
    h('p', { class: 'muted small' }, 'Guarda todas as receitas e fotografias num ficheiro, para ter uma cópia ou passar para outro aparelho.'),
    h('div', { class: 'row-actions wrap' },
      h('button', { class: 'btn ghost', onClick: exportAll }, icon('download'), 'Exportar receitas'),
      h('button', { class: 'btn ghost', onClick: importFile }, icon('upload'), 'Importar cópia')));

  // ---------- Passar receitas locais para a nuvem ----------
  const migrateSec = cloud ? h('div') : null;
  if (cloud) {
    (async () => {
      try {
        const local = new LocalStore(); await local.init();
        const list = await local.all();
        if (!list.length) return;
        migrateSec.replaceChildren(section('Receitas deste aparelho',
          h('p', { class: 'muted small' }, `Este aparelho tem ${list.length} receitas guardadas em modo local. Envie-as para a família.`),
          h('button', { class: 'btn primary', onClick: async () => {
            const b = busy('A enviar as receitas…');
            try {
              const photos = Object.fromEntries((await local.allPhotos()).map(p => [p.id, p.data]));
              const n = await importBundle({ recipes: list, photos }, b);
              for (const r of list) await local.deleteRecipe(r.id);
              for (const pid of Object.keys(photos)) await local.deletePhoto(pid);
              toast(`${n} receitas enviadas.`);
              rerender(false);
            } catch (e) { toast('Erro: ' + e.message, { ms: 6000 }); }
            finally { b.close(); }
          } }, icon('cloud'), `Enviar ${list.length} receitas`)));
      } catch { /* sem dados locais */ }
    })();
  }

  // ---------- Instalar ----------
  const installSec = state.installPrompt ? section('Instalar no telemóvel',
    h('p', { class: 'muted small' }, 'Fica com um ícone no ecrã inicial e abre como uma app.'),
    h('button', { class: 'btn primary', onClick: async () => { state.installPrompt.prompt(); await state.installPrompt.userChoice; state.installPrompt = null; rerender(false); } }, icon('download'), 'Instalar')) : null;

  const about = h('p', { class: 'pad muted small about' }, `Receitas da Família, versão ${APP_VERSION}. ${cloud ? 'Ligada à nuvem da família.' : 'Modo local.'}`);

  return h('div', { class: 'page' }, topBar('Definições', { back: false }), account, nameSec, aiSec, membersSec, batchSec, installSec, migrateSec, backupSec, about);
}

async function exportAll() {
  const b = busy('A preparar o ficheiro…');
  try {
    const photos = {};
    for (const r of state.recipes) {
      const ids = [r.coverPhotoId, ...(r.resultPhotoIds || []), ...(r.originalPhotoIds || []), ...(r.steps || []).map(s => s.photoId)].filter(Boolean);
      for (const pid of ids) if (!photos[pid]) { const d = await state.store.getPhoto(pid); if (d) photos[pid] = d; }
    }
    const blob = new Blob([JSON.stringify({ app: 'receitas-da-familia', version: 1, exportedAt: new Date().toISOString(), recipes: state.recipes, photos })], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `receitas-da-familia-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    toast('Ficheiro descarregado.');
  } catch (e) { toast('Erro ao exportar: ' + e.message); }
  finally { b.close(); }
}

async function importFile() {
  const file = await pickFile('.json,application/json');
  if (!file) return;
  const b = busy('A importar…');
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'receitas-da-familia') throw new Error('Este ficheiro não é uma cópia da Receitas da Família.');
    const n = await importBundle(data, b);
    toast(`${n} receitas importadas.`);
  } catch (e) { toast(e.message, { ms: 6000 }); }
  finally { b.close(); }
}

// Copia receitas (com novas identificações) e fotografias para a base de dados atual.
async function importBundle({ recipes = [], photos = {} }, b) {
  const store = state.store;
  const photoMap = {}, idMap = {};
  recipes.forEach(r => { idMap[r.id] = uid(); });
  let k = 0;
  const mapPhoto = async pid => {
    if (!pid || !photos[pid]) return null;
    if (!photoMap[pid]) photoMap[pid] = await store.savePhoto(photos[pid], { kind: 'import' });
    return photoMap[pid];
  };
  for (const r0 of recipes) {
    k++; b?.set(`A guardar ${k} de ${recipes.length}…`);
    const r = normalizeRecipe(r0);
    r.id = idMap[r0.id];
    r.parentId = r.parentId ? idMap[r.parentId] || null : null;
    r.coverPhotoId = await mapPhoto(r.coverPhotoId);
    r.resultPhotoIds = (await Promise.all(r.resultPhotoIds.map(mapPhoto))).filter(Boolean);
    r.originalPhotoIds = (await Promise.all(r.originalPhotoIds.map(mapPhoto))).filter(Boolean);
    r.steps = await Promise.all(r.steps.map(async s => ({ ...s, photoId: await mapPhoto(s.photoId) })));
    r.favoriteBy = [];
    r.authorName = r.authorName || myName();
    r.createdAt = r.createdAt || Date.now();
    await store.saveRecipe(r);
  }
  return recipes.length;
}

import { state } from '../ctx.js';
import { h, icon, azulejo, toast } from '../ui.js';
import { authErrorText } from '../store-cloud.js';

const brand = () => h('div', { class: 'gate-brand' },
  h('div', { class: 'gate-tiles' }, [0, 1, 2].map(n => h('span', { html: azulejo(n + 4) }))),
  h('h1', { class: 'brand' }, 'Receitas da Família'));

export function loginView() {
  const store = state.store;
  let mode = 'entrar';
  const msg = h('p', { class: 'form-msg', role: 'alert' });
  const nameIn = h('input', { class: 'input', autocomplete: 'name', placeholder: 'O seu nome' });
  const emailIn = h('input', { class: 'input', type: 'email', autocomplete: 'email', placeholder: 'email@exemplo.com', required: true });
  const passIn = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Palavra-passe', required: true });
  const submit = h('button', { class: 'btn primary big', type: 'submit' });
  const nameField = h('label', { class: 'field' }, h('span', { class: 'field-l' }, 'Nome'), nameIn);
  const toggle = h('button', { type: 'button', class: 'link-btn' });
  const forgot = h('button', { type: 'button', class: 'link-btn', onClick: async () => {
    if (!emailIn.value) { msg.textContent = 'Escreva primeiro o seu email.'; return; }
    try { await store.resetPassword(emailIn.value.trim()); msg.textContent = 'Enviámos um email para criar uma nova palavra-passe.'; }
    catch (e) { msg.textContent = authErrorText(e); }
  } }, 'Esqueci-me da palavra-passe');

  function draw() {
    nameField.hidden = mode === 'entrar';
    passIn.autocomplete = mode === 'entrar' ? 'current-password' : 'new-password';
    submit.textContent = mode === 'entrar' ? 'Entrar' : 'Criar conta';
    toggle.textContent = mode === 'entrar' ? 'Ainda não tenho conta' : 'Já tenho conta';
    forgot.hidden = mode !== 'entrar';
    msg.textContent = '';
  }
  toggle.addEventListener('click', () => { mode = mode === 'entrar' ? 'criar' : 'entrar'; draw(); });

  const form = h('form', { class: 'gate-form', onSubmit: async e => {
    e.preventDefault();
    msg.textContent = '';
    submit.disabled = true;
    try {
      if (mode === 'entrar') await store.signInEmail(emailIn.value.trim(), passIn.value);
      else await store.signUpEmail(nameIn.value.trim(), emailIn.value.trim(), passIn.value);
    } catch (err) { msg.textContent = authErrorText(err); }
    finally { submit.disabled = false; }
  } }, nameField,
  h('label', { class: 'field' }, h('span', { class: 'field-l' }, 'Email'), emailIn),
  h('label', { class: 'field' }, h('span', { class: 'field-l' }, 'Palavra-passe'), passIn),
  msg, submit, h('div', { class: 'gate-links' }, toggle, forgot));
  draw();

  return h('div', { class: 'page gate' }, brand(),
    h('p', { class: 'gate-text' }, 'O caderno de receitas da família. Entre para ver e acrescentar receitas.'),
    h('button', { class: 'btn google big', onClick: async () => {
      try { await store.signInGoogle(); } catch (e) { toast(authErrorText(e), { ms: 7000 }); }
    } }, h('span', { class: 'g-logo', html: '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>' }), 'Entrar com a conta Google'),
    h('p', { class: 'gate-or' }, 'ou com email e palavra-passe'),
    form);
}

export function verifyView() {
  const store = state.store;
  const msg = h('p', { class: 'form-msg', role: 'status' });
  return h('div', { class: 'page gate' }, brand(),
    h('h2', {}, 'Confirme o seu email'),
    h('p', { class: 'gate-text' }, `Enviámos uma mensagem para ${state.user?.email}. Abra-a, toque na ligação de confirmação e volte aqui.`),
    h('p', { class: 'muted small' }, 'Não encontra? Veja a pasta de spam ou publicidade.'),
    msg,
    h('div', { class: 'row-actions stack' },
      h('button', { class: 'btn primary big', onClick: async () => {
        const u = await store.refreshUser();
        if (u?.verified) location.reload(); else msg.textContent = 'Ainda não está confirmado. Toque na ligação do email e tente de novo.';
      } }, icon('check'), 'Já confirmei'),
      h('button', { class: 'btn ghost', onClick: async () => { try { await store.resendVerification(); msg.textContent = 'Email enviado de novo.'; } catch (e) { msg.textContent = authErrorText(e); } } }, 'Enviar o email de novo'),
      h('button', { class: 'link-btn', onClick: () => store.signOut() }, 'Usar outra conta')));
}

export function deniedView() {
  return h('div', { class: 'page gate' }, brand(),
    h('h2', {}, 'Ainda não tem acesso'),
    h('p', { class: 'gate-text' }, `A conta ${state.user?.email} ainda não faz parte da família nesta app.`),
    h('p', { class: 'gate-text' }, 'Peça a quem gere a app para acrescentar este email em Definições > Membros da família. Depois toque em "Tentar de novo".'),
    h('div', { class: 'row-actions stack' },
      h('button', { class: 'btn primary big', onClick: () => location.reload() }, 'Tentar de novo'),
      h('button', { class: 'link-btn', onClick: () => state.store.signOut() }, 'Usar outra conta')));
}

export function bootErrorView(err, retry) {
  return h('div', { class: 'page gate' }, brand(),
    h('h2', {}, 'Não foi possível abrir'),
    h('p', { class: 'gate-text' }, 'Para a primeira utilização é precisa ligação à internet. Verifique a ligação e tente de novo.'),
    h('p', { class: 'muted small' }, String(err?.message || err || '')),
    h('button', { class: 'btn primary big', onClick: retry }, 'Tentar de novo'));
}

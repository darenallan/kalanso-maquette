'use strict';
/*
 * Authentification : bienvenue, connexion, double authentification (OTP),
 * mot de passe oublié, premier accès.
 * Maquette : aucun mot de passe n'est stocké ni journalisé. Le mot de passe de démo
 * est comparé à une constante, uniquement pour simuler le parcours.
 */

const DEMO_PASSWORD = 'Kalanso2026!';
const DEMO_OTP = '123456';
const AuthState = { univ: 'uho', attempts: 0, lockedUntil: 0 };

const UNIVERSITES = [
  { id: 'uho', nom: 'Université Horizon de Ouagadougou', ville: 'Ouagadougou', type: 'Publique', sigle: 'UHO', demo: true },
  { id: 'u2', nom: 'Université des Savanes', ville: 'Bobo-Dioulasso', type: 'Publique', sigle: 'USB' },
  { id: 'u3', nom: 'Institut supérieur du Kadiogo', ville: 'Ouagadougou', type: 'Privée', sigle: 'ISK' },
  { id: 'u4', nom: 'Université du Plateau central', ville: 'Ziniaré', type: 'Publique', sigle: 'UPC' },
  { id: 'u5', nom: 'École supérieure de gestion du Faso', ville: 'Ouagadougou', type: 'Privée', sigle: 'ESGF' },
  { id: 'u6', nom: 'Université du Sahel', ville: 'Dori', type: 'Publique', sigle: 'US' },
  { id: 'u7', nom: 'Institut polytechnique de Koudougou', ville: 'Koudougou', type: 'Privée', sigle: 'IPK' }
];

/** Motif tissé décoratif (bandes croisées façon Faso Dan Fani), généré en SVG. */
function loomPattern() {
  // Uniquement des bandes de chaîne verticales, groupées et asymétriques (lecture « pagne tissé »,
  // pas « tartan ») : séquence rythmée [largeur, couleur], un filet orange une fois sur sept.
  const svgEl = s('svg', { class: 'loom hide-on-saver', viewBox: '0 0 600 800', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' });
  const seq = [[2, '#0E9F6E'], [3, null], [2, '#0E9F6E'], [10, null], [8, '#047857'], [2, null], [26, '#065F46'], [4, null], [2, '#E8F1EC'], [3, null], [6, '#0E9F6E'], [34, null]];
  let x = 0; let k = 0;
  while (x < 600) {
    seq.forEach(([w, c]) => {
      if (c) svgEl.appendChild(s('rect', { x, y: 0, width: w, height: 800, fill: k % 7 === 6 && w === 2 && c === '#E8F1EC' ? '#D97706' : c, opacity: c === '#E8F1EC' ? 0.35 : 0.5 }));
      x += w;
    });
    k += 1;
  }
  svgEl.appendChild(s('rect', { x: 0, y: 0, width: 600, height: 800, fill: '#0B2A1F', opacity: 0.55 }));
  return svgEl;
}

/** Accès direct aux 4 espaces de démonstration : un clic = connecté (sans mot de passe ni code SMS). */
const ROLE_CARDS = {
  etudiant: { ic: 'graduation', desc: 'Notes, emploi du temps, paiements' },
  enseignant: { ic: 'pen', desc: 'Appel, saisie des notes, devoirs' },
  scolarite: { ic: 'building', desc: 'Validation, délibérations, finances' },
  parent: { ic: 'users', desc: 'Suivi des notes et des absences' }
};
function rolePicker() {
  return h('section', { class: 'role-pick', 'aria-labelledby': 'role-pick-t' },
    h('div', { class: 'role-pick-head' }, h('h2', { id: 'role-pick-t' }, 'Entrer dans la démo'), h('span', { class: 'xsmall muted' }, 'Un clic, sans mot de passe')),
    h('div', { class: 'role-grid' }, Object.keys(DEMO_USERS).map((r) => {
      const u = K.user(DEMO_USERS[r]);
      const label = ROLE_LABELS[r].replace(' (admin)', '');
      return h('button', { type: 'button', class: 'role-card', 'data-role': r, onClick: () => { UI.toast('Connecté en tant que ' + K.name(u) + '.', 'success', label); App.login(u.id); } },
        h('span', { class: 'role-ic' }, icon(ROLE_CARDS[r].ic, 22)),
        h('span', { class: 'role-txt' }, h('span', { class: 'role-name' }, label), h('span', { class: 'role-who' }, K.name(u)), h('span', { class: 'role-desc' }, ROLE_CARDS[r].desc)));
    })));
}

/** Mise en page commune des écrans d'authentification. */
function authLayout(content) {
  const brand = h('div', { class: 'auth-brand' }, loomPattern(),
    h('div', { class: 'row' }, UI.logo(40), h('div', null, h('div', { class: 'brand-name' }, 'Kalanso'), h('div', { class: 'xsmall', style: { color: '#A3B5AD' } }, '« école » en dioula'))),
    h('div', null,
      h('div', { class: 'eyebrow' }, 'Plateforme de vie universitaire'),
      h('h2', null, 'Toute ta vie universitaire au même endroit.'),
      h('p', { class: 'lead' }, 'Notes LMD, emploi du temps, appel numérique et paiement des frais par Orange Money ou Moov Money. Conçu pour les universités du Burkina Faso, utilisable avec une connexion lente.')),
    h('div', { class: 'facts' },
      h('div', null, h('b', null, 'UE, ECUE, crédits'), h('span', null, 'Compensation et délibérations')),
      h('div', null, h('b', null, 'Mobile money'), h('span', null, 'Reçus et relances par SMS')),
      h('div', null, h('b', null, 'Hors ligne'), h('span', null, 'Mode économie de données'))));
  return h('div', { class: 'auth' }, brand, h('main', { class: 'auth-main', id: 'main', tabindex: '-1' }, h('div', { class: 'auth-card' }, content)));
}

function authHeader(title, sub) {
  return [h('div', { class: 'row' }, UI.logo(36), h('div', null, h('div', { class: 'brand-name' }, 'Kalanso'), h('div', { class: 'xsmall muted' }, UNIVERSITES.find((u) => u.id === AuthState.univ).nom))),
    h('h1', { tabindex: '-1' }, title), sub ? h('p', { class: 'sub' }, sub) : null];
}

/* ---------- 1. Bienvenue : choix de l'établissement ---------- */
defineScreen('public', 'bienvenue', {
  title: 'Bienvenue',
  render() {
    const list = h('div', { class: 'uni-list', role: 'radiogroup', 'aria-label': 'Établissements' });
    const msg = h('div', { 'aria-live': 'polite' });
    const draw = (q) => {
      clear(list);
      const items = UNIVERSITES.filter((u) => norm(u.nom + ' ' + u.ville + ' ' + u.sigle).includes(norm(q)));
      if (!items.length) list.appendChild(h('p', { class: 'muted small', style: { padding: '16px' } }, 'Aucun établissement ne correspond à « ' + q + ' ».'));
      items.forEach((u) => list.appendChild(h('button', { type: 'button', class: 'uni-opt', role: 'radio', 'aria-checked': String(AuthState.univ === u.id), onClick: () => {
        clear(msg);
        if (!u.demo) { msg.appendChild(UI.alert('info', 'Établissement non configuré', 'Seule l\'Université Horizon de Ouagadougou est disponible dans cette maquette.')); return; }
        AuthState.univ = u.id; draw(search.input.value);
      } }, h('span', { class: 'uni-logo' }, u.sigle), h('span', { class: 'grow' }, h('span', { class: 'strong small', style: { display: 'block' } }, u.nom), h('span', { class: 'xsmall muted' }, u.ville + ' · ' + u.type)),
      u.demo ? UI.badge('Démo', 'accent') : null)));
    };
    const search = UI.search({ placeholder: 'Rechercher votre université…', onInput: draw, label: 'Rechercher un établissement' });
    draw('');
    return authLayout(h('div', { class: 'stack' },
      h('div', { class: 'auth-mobile-band weave-strip only-mobile', 'aria-hidden': 'true' }),
      h('div', { class: 'row' }, UI.logo(40), h('div', { class: 'brand-name' }, 'Kalanso')),
      h('div', null, h('h1', { tabindex: '-1' }, 'Bienvenue sur Kalanso'), h('p', { class: 'sub', style: { marginBottom: 0 } }, h('span', { class: 'only-mobile' }, 'Toute ta vie universitaire au même endroit. '), 'Choisissez votre établissement pour continuer.')),
      rolePicker(),
      h('div', { class: 'or-sep' }, h('span', null, 'ou parcours complet')),
      search.el, list, msg,
      UI.button({ label: 'Continuer', iconRight: 'arrowRight', block: true, onClick: () => App.go('#/connexion') }),
      h('p', { class: 'xsmall muted center' }, 'Première connexion ? ', h('a', { href: '#/premier-acces' }, 'Activer mon compte'))));
  }
});

/* ---------- 2. Connexion ---------- */
function findAccount(identifier) {
  const id = identifier.trim().toLowerCase();
  return Object.values(App.store.users).find((u) => (u.matricule && u.matricule.toLowerCase() === id) || u.email.toLowerCase() === id) || null;
}

defineScreen('public', 'connexion', {
  title: 'Connexion',
  render() {
    const ident = UI.field({ label: 'Matricule ou adresse e-mail', required: true, autocomplete: 'username', placeholder: 'UHO-2025-04817', id: 'login-id' });
    let shown = false;
    const eye = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Afficher le mot de passe', 'aria-pressed': 'false' }, icon('eye', 20));
    const pwd = UI.field({ label: 'Mot de passe', type: 'password', required: true, autocomplete: 'current-password', id: 'login-pwd', addon: eye });
    eye.addEventListener('click', () => {
      shown = !shown;
      pwd.input.type = shown ? 'text' : 'password';
      eye.setAttribute('aria-label', shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      eye.setAttribute('aria-pressed', String(shown));
      clear(eye).appendChild(icon(shown ? 'eyeOff' : 'eye', 20));
    });
    const remember = UI.checkbox('Se souvenir de moi sur cet appareil', true);
    const formMsg = h('div', { 'aria-live': 'assertive' });
    const submit = UI.button({ label: 'Se connecter', type: 'submit', block: true });
    const form = h('form', { class: 'stack', novalidate: true }, ident.el, pwd.el,
      h('div', { class: 'row-between wrap' }, remember, h('a', { href: '#/mot-de-passe-oublie', class: 'small' }, 'Mot de passe oublié ?')),
      formMsg, submit);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clear(formMsg);
      if (Date.now() < AuthState.lockedUntil) {
        formMsg.appendChild(UI.alert('danger', 'Trop de tentatives', 'Par sécurité, réessayez dans ' + Math.ceil((AuthState.lockedUntil - Date.now()) / 1000) + ' secondes.'));
        return;
      }
      const v = ident.input.value.trim();
      let ok = true;
      if (!v) ok = ident.setError('Saisissez votre matricule ou votre e-mail.') && ok;
      else if (!/^UHO-\d{4}-\d{5}$/i.test(v) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) ok = ident.setError('Format attendu : UHO-2025-04817 ou prenom.nom@uho.bf') && ok;
      else ident.setError(null);
      if (!pwd.input.value) ok = pwd.setError('Saisissez votre mot de passe.') && ok;
      else if (pwd.input.value.length < 8) ok = pwd.setError('Le mot de passe compte au moins 8 caractères.') && ok;
      else pwd.setError(null);
      if (!ok) { form.querySelector('[aria-invalid="true"]').focus(); return; }
      UI.loading(submit, 700, () => {
        const acc = findAccount(v);
        if (!acc || pwd.input.value !== DEMO_PASSWORD || !acc.actif) {
          AuthState.attempts += 1;
          if (AuthState.attempts >= 5) { AuthState.lockedUntil = Date.now() + 30000; AuthState.attempts = 0; }
          formMsg.appendChild(UI.alert('danger', 'Connexion impossible', acc && !acc.actif ? 'Ce compte est désactivé. Contactez la Scolarité.' : 'Identifiant ou mot de passe incorrect. Il reste ' + (5 - AuthState.attempts) + ' tentative(s) avant blocage temporaire.'));
          pwd.input.value = '';
          pwd.input.focus();
          return;
        }
        AuthState.attempts = 0;
        App.pendingLogin = { userId: acc.id, remember: remember.querySelector('input').checked };
        App.go('#/otp');
      });
    });
    return authLayout(h('div', { class: 'stack' },
      h('div', { class: 'auth-mobile-band weave-strip only-mobile', 'aria-hidden': 'true' }),
      authHeader('Connexion', 'Accédez à votre espace avec votre matricule ou votre e-mail institutionnel.'),
      rolePicker(),
      h('div', { class: 'or-sep' }, h('span', null, 'ou avec un identifiant')),
      form,
      h('div', { class: 'demo-hint' }, icon('info', 16), h('div', null, h('strong', null, 'Comptes de démonstration. '), 'Mot de passe : ', h('code', null, DEMO_PASSWORD), '. Code SMS : ', h('code', null, DEMO_OTP), '.')),
      h('p', { class: 'xsmall muted center' }, h('a', { href: '#/bienvenue' }, 'Changer d\'établissement'), ' · ', h('a', { href: '#/premier-acces' }, 'Premier accès'))));
  }
});

/* ---------- 3. Double authentification (OTP) ---------- */
defineScreen('public', 'otp', {
  title: 'Vérification en deux étapes',
  render() {
    if (!App.pendingLogin) { setTimeout(() => App.go('#/connexion'), 0); return h('div'); }
    const u = K.user(App.pendingLogin.userId);
    const masked = '+226 •• •• ' + u.tel.slice(-5);
    const boxes = [];
    const err = h('div', { class: 'field-error', 'aria-live': 'assertive' });
    const submit = UI.button({ label: 'Vérifier', type: 'submit', block: true });
    const otp = h('div', { class: 'otp', role: 'group', 'aria-label': 'Code à 6 chiffres' });
    for (let i = 0; i < 6; i++) {
      const b = h('input', { inputmode: 'numeric', maxlength: '1', autocomplete: i === 0 ? 'one-time-code' : 'off', 'aria-label': 'Chiffre ' + (i + 1) + ' sur 6', pattern: '[0-9]' });
      b.addEventListener('input', () => {
        b.value = b.value.replace(/\D/g, '').slice(-1);
        if (b.value && i < 5) boxes[i + 1].focus();
        if (boxes.every((x) => x.value)) form.requestSubmit();
      });
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !b.value && i > 0) boxes[i - 1].focus();
        if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
        if (e.key === 'ArrowRight' && i < 5) boxes[i + 1].focus();
      });
      b.addEventListener('paste', (e) => {
        const txt = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
        if (!txt) return;
        e.preventDefault();
        txt.split('').forEach((c, k) => { if (boxes[k]) boxes[k].value = c; });
        (boxes[txt.length] || boxes[5]).focus();
        if (txt.length === 6) form.requestSubmit();
      });
      boxes.push(b); otp.appendChild(b);
    }
    const form = h('form', { class: 'stack', novalidate: true }, otp, err, submit);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = boxes.map((b) => b.value).join('');
      clear(err);
      if (code.length < 6) { err.appendChild(document.createTextNode('Saisissez les 6 chiffres du code.')); boxes.forEach((b) => b.setAttribute('aria-invalid', String(!b.value))); return; }
      UI.loading(submit, 600, () => {
        if (code !== DEMO_OTP) {
          err.appendChild(icon('alert', 14)); err.appendChild(document.createTextNode('Code incorrect ou expiré. Vérifiez le SMS reçu.'));
          boxes.forEach((b) => { b.value = ''; b.setAttribute('aria-invalid', 'true'); });
          boxes[0].focus();
          return;
        }
        UI.toast('Bienvenue, ' + u.prenom + ' !', 'success', 'Connexion réussie');
        App.login(u.id);
      });
    });
    let left = 30;
    const resend = h('button', { type: 'button', class: 'link-btn small', disabled: true });
    const tick = () => {
      if (!resend.isConnected && left < 30) return;
      clear(resend).appendChild(document.createTextNode(left > 0 ? 'Renvoyer le code dans ' + left + ' s' : 'Renvoyer le code par SMS'));
      resend.disabled = left > 0;
      if (left > 0) { left -= 1; setTimeout(tick, 1000); }
    };
    resend.addEventListener('click', () => { left = 30; tick(); UI.toast('Un nouveau code a été envoyé au ' + masked + '.', 'info'); });
    tick();
    setTimeout(() => boxes[0].focus(), 60);
    return authLayout(h('div', { class: 'stack' },
      authHeader('Vérification en deux étapes', 'Saisissez le code à 6 chiffres envoyé par SMS au ' + masked + '.'),
      form,
      h('div', { class: 'row-between wrap' }, resend, h('a', { href: '#/connexion', class: 'small' }, 'Retour')),
      h('div', { class: 'demo-hint' }, icon('info', 16), h('span', null, 'Démo : le code est ', h('strong', null, DEMO_OTP), '. Aucun SMS n\'est réellement envoyé.'))));
  }
});

/* ---------- 4. Mot de passe oublié ---------- */
defineScreen('public', 'mot-de-passe-oublie', {
  title: 'Mot de passe oublié',
  render(ctx) {
    if (ctx.query.get('envoye')) {
      return authLayout(h('div', { class: 'stack' }, authHeader('Vérifiez vos SMS'),
        h('div', { class: 'success-check' }, icon('check', 36)),
        h('p', null, 'Si un compte correspond à ce matricule, un lien de réinitialisation valable 15 minutes vient d\'être envoyé par SMS et par e-mail.'),
        UI.alert('neutral', null, 'Par sécurité, nous n\'indiquons jamais si un matricule existe ou non.'),
        UI.button({ label: 'Retour à la connexion', href: '#/connexion', block: true })));
    }
    const f = UI.field({ label: 'Matricule', required: true, placeholder: 'UHO-2025-04817', hint: 'Il figure sur votre carte d\'étudiant ou votre fiche d\'inscription.' });
    const submit = UI.button({ label: 'Recevoir un lien de réinitialisation', type: 'submit', block: true });
    const form = h('form', { class: 'stack', novalidate: true }, f.el, submit);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = f.input.value.trim();
      if (!/^UHO-\d{4}-\d{5}$/i.test(v)) { f.setError('Format attendu : UHO-AAAA-NNNNN (ex. UHO-2025-04817).'); f.input.focus(); return; }
      f.setError(null);
      UI.loading(submit, 800, () => App.go('#/mot-de-passe-oublie?envoye=1'));
    });
    return authLayout(h('div', { class: 'stack' }, authHeader('Mot de passe oublié', 'Indiquez votre matricule : nous vous enverrons un lien de réinitialisation.'), form,
      h('a', { href: '#/connexion', class: 'small center' }, 'Retour à la connexion')));
  }
});

/* ---------- 5. Premier accès : création du mot de passe ---------- */
function passwordScore(p) {
  const rules = [
    ['Au moins 10 caractères', p.length >= 10],
    ['Une majuscule et une minuscule', /[a-z]/.test(p) && /[A-Z]/.test(p)],
    ['Au moins un chiffre', /\d/.test(p)],
    ['Au moins un caractère spécial', /[^A-Za-z0-9]/.test(p)]
  ];
  return { rules, score: rules.filter((r) => r[1]).length };
}

defineScreen('public', 'premier-acces', {
  title: 'Premier accès',
  render() {
    const mat = UI.field({ label: 'Matricule', required: true, value: 'UHO-2025-04817' });
    const p1 = UI.field({ label: 'Nouveau mot de passe', type: 'password', required: true, autocomplete: 'new-password' });
    const p2 = UI.field({ label: 'Confirmer le mot de passe', type: 'password', required: true, autocomplete: 'new-password' });
    const meter = h('div', { class: 'strength', 'aria-hidden': 'true' }, h('span'), h('span'), h('span'), h('span'));
    const label = h('div', { class: 'xsmall muted', 'aria-live': 'polite' }, 'Robustesse : —');
    const rules = h('ul', { class: 'rules' });
    const words = ['—', 'faible', 'moyenne', 'bonne', 'excellente'];
    const update = () => {
      const r = passwordScore(p1.input.value);
      meter.className = 'strength s' + r.score;
      label.textContent = 'Robustesse : ' + words[r.score];
      clear(rules);
      r.rules.forEach(([t, ok]) => rules.appendChild(h('li', { class: ok ? 'ok' : '' }, icon(ok ? 'check' : 'minus', 14), t, h('span', { class: 'sr-only' }, ok ? ' (respecté)' : ' (non respecté)'))));
    };
    p1.input.addEventListener('input', update);
    update();
    const submit = UI.button({ label: 'Activer mon compte', type: 'submit', block: true });
    const form = h('form', { class: 'stack', novalidate: true }, mat.el, p1.el, h('div', { class: 'stack-s' }, meter, label, rules), p2.el, submit);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let ok = true;
      ok = mat.setError(/^UHO-\d{4}-\d{5}$/i.test(mat.input.value.trim()) ? null : 'Matricule invalide.') && ok;
      ok = p1.setError(passwordScore(p1.input.value).score >= 3 ? null : 'Choisissez un mot de passe au moins « bon » (3 règles sur 4).') && ok;
      ok = p2.setError(p2.input.value && p2.input.value === p1.input.value ? null : 'Les deux mots de passe ne correspondent pas.') && ok;
      if (!ok) { form.querySelector('[aria-invalid="true"]').focus(); return; }
      UI.loading(submit, 700, () => { UI.toast('Votre compte est activé. Connectez-vous (en démo, le mot de passe reste ' + DEMO_PASSWORD + ').', 'success', 'Mot de passe créé'); App.go('#/connexion'); });
    });
    return authLayout(h('div', { class: 'stack' }, authHeader('Premier accès', 'Créez votre mot de passe personnel. Il ne sera jamais communiqué par la Scolarité.'), form,
      h('a', { href: '#/connexion', class: 'small center' }, 'J\'ai déjà un mot de passe')));
  }
});

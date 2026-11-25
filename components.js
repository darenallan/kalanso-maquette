'use strict';
/*
 * Composants UI réutilisables.
 * Règle de sécurité : aucune donnée n'est insérée avec innerHTML.
 * Tout passe par createElement / textContent (fonction h()).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ---------- Construction du DOM ---------- */

/** Applique des attributs à un élément (classes, texte, événements, propriétés). */
function setAttrs(el, attrs) {
  Object.keys(attrs).forEach((k) => {
    const v = attrs[k];
    if (v === null || v === undefined || v === false) return;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'text') el.textContent = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'value' && 'value' in el && el.tagName !== 'BUTTON') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  });
}

/** Ajoute des enfants (nœuds, textes, tableaux imbriqués) à un élément. */
function appendChildren(el, children) {
  children.forEach((c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) appendChildren(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  });
  return el;
}

/** Crée un élément HTML : h('div', { class: 'card' }, enfant1, enfant2…) */
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) setAttrs(el, attrs);
  return appendChildren(el, children);
}

/** Crée un élément SVG. */
function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) Object.keys(attrs).forEach((k) => { if (attrs[k] !== null && attrs[k] !== undefined) el.setAttribute(k, String(attrs[k])); });
  return appendChildren(el, children);
}

function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

/** Échappement HTML (pour tout gabarit texte éventuel). */
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Normalise un texte pour la recherche (minuscules, sans accents). */
function norm(str) { return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

let uidCounter = 0;
function uid(prefix = 'k') { uidCounter += 1; return prefix + '-' + uidCounter; }

const prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Formats (français, FCFA, GMT) ---------- */
const FMT = {
  money(n) { return FMT.int(n) + ' FCFA'; },
  int(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); },
  num(n, d = 2) { return (n === null || n === undefined || Number.isNaN(n)) ? '—' : Number(n).toFixed(d).replace('.', ','); },
  note(n) { if (n === null || n === undefined) return '—'; if (typeof n === 'string') return n; return FMT.num(n, 2); },
  pct(n, d = 0) { return FMT.num(n, d) + ' %'; },
  date(iso) { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-'); return d + '/' + m + '/' + y; },
  dateShort(iso) { return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(DT.parse(iso)); },
  dateLong(iso) { return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(DT.parse(iso)); },
  dateMed(iso) { return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(DT.parse(iso)); },
  weekday(iso) { return new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(DT.parse(iso)); },
  month(d) { return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(d); },
  monthShort(d) { return new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(d); },
  time(stamp) { return stamp.slice(11, 16); },
  dateTime(stamp) { return FMT.date(stamp) + ' à ' + FMT.time(stamp); },
  hhmm(t) { return t.replace(':', 'h'); },
  /** « il y a 5 min », « hier à 18:30 », « 12/11/2026 » */
  relative(stamp) {
    const d = DT.toDate(stamp.slice(0, 10), stamp.slice(11, 16));
    const diff = (Date.now() - d.getTime()) / 60000;
    const days = DT.diffDays(DT.iso(new Date()), stamp.slice(0, 10));
    if (diff >= 0 && diff < 1) return 'à l\'instant';
    if (diff >= 0 && diff < 60) return 'il y a ' + Math.round(diff) + ' min';
    if (days === 0) return 'aujourd\'hui à ' + FMT.time(stamp);
    if (days === 1) return 'hier à ' + FMT.time(stamp);
    if (days > 1 && days < 7) return FMT.weekday(stamp) + ' à ' + FMT.time(stamp);
    return FMT.date(stamp);
  },
  size(ko) { if (!ko) return 'lien externe'; return ko >= 1000 ? FMT.num(ko / 1000, 1) + ' Mo' : ko + ' Ko'; },
  plural(n, sing, plur) { return FMT.int(n) + ' ' + (Math.abs(n) > 1 ? (plur || sing + 's') : sing); },
  initials(user) { return ((user.prenom || '?')[0] + (user.nom || '?')[0]).toUpperCase(); }
};

/* ---------- Composants ---------- */
const UI = {};

/** Logo tissé Kalanso : bandes croisées façon Faso Dan Fani. */
UI.logo = function (size = 32) {
  const svgEl = s('svg', { viewBox: '0 0 32 32', width: size, height: size, class: 'logo-mark', 'aria-hidden': 'true', focusable: 'false' });
  // Lisière de pagne : bandes de chaîne verticales d'épaisseurs inégales + un fil orange (pas de quadrillage).
  svgEl.appendChild(s('rect', { x: 0, y: 0, width: 32, height: 32, rx: 8, fill: '#047857' }));
  [[6, 3, '#FFFFFF'], [10.5, 1, '#A7F3D0'], [13, 7, '#FFFFFF'], [21.5, 1.2, '#F59E0B'], [24, 2, '#A7F3D0'], [27, 1, '#FFFFFF']]
    .forEach(([x, w, fill]) => svgEl.appendChild(s('rect', { x, y: 6, width: w, height: 20, rx: 0.5, fill })));
  return svgEl;
};

/** Bouton. variant : primary | secondary | ghost | danger ; size : 's' | 'm'. */
UI.button = function (opts) {
  const o = Object.assign({ variant: 'primary', size: 'm', type: 'button' }, opts);
  const cls = ['btn', 'btn-' + o.variant, o.size === 's' ? 'btn-s' : '', o.block ? 'btn-block' : '', o.iconOnly ? 'btn-icon' : '', o.cls || ''].join(' ').replace(/\s+/g, ' ').trim();
  const content = [o.icon ? icon(o.icon, o.size === 's' ? 16 : 18) : null, o.iconOnly ? null : h('span', null, o.label), o.iconRight ? icon(o.iconRight, 16) : null];
  if (o.href) return h('a', { class: cls, href: o.href, 'aria-label': o.ariaLabel || null }, content);
  return h('button', { class: cls, type: o.type, onClick: o.onClick, 'aria-label': o.iconOnly ? (o.ariaLabel || o.label) : (o.ariaLabel || null), disabled: !!o.disabled, title: o.iconOnly ? (o.ariaLabel || o.label) : null, form: o.form || null }, content);
};

/** Bascule l'état « chargement » d'un bouton pendant ms millisecondes puis appelle done. */
UI.loading = function (btn, ms, done) {
  btn.classList.add('is-loading');
  btn.setAttribute('aria-busy', 'true');
  setTimeout(() => { btn.classList.remove('is-loading'); btn.removeAttribute('aria-busy'); if (done) done(); }, ms);
};

UI.iconButton = function (name, label, onClick, extra) {
  return h('button', Object.assign({ class: 'icon-btn', type: 'button', 'aria-label': label, title: label, onClick }, extra || {}), icon(name, 22));
};

/**
 * Champ de formulaire avec libellé, aide et message d'erreur (aria-live).
 * Renvoie { el, input, setError(message) }.
 */
UI.field = function (o) {
  const id = o.id || uid('f');
  const errId = id + '-err';
  const hintId = o.hint ? id + '-hint' : null;
  let input;
  const common = { id, name: o.name || id, required: !!o.required, placeholder: o.placeholder || null, 'aria-describedby': [hintId, errId].filter(Boolean).join(' '),
    autocomplete: o.autocomplete || null, inputmode: o.inputmode || null, maxlength: o.maxlength || null, readonly: !!o.readonly, disabled: !!o.disabled };
  if (o.as === 'textarea') {
    input = h('textarea', Object.assign({ class: 'textarea', rows: o.rows || 4 }, common));
    if (o.value) input.value = o.value;
  } else if (o.as === 'select') {
    input = h('select', Object.assign({ class: 'select' }, common), (o.options || []).map((opt) => h('option', { value: opt.value, disabled: !!opt.disabled }, opt.label)));
    if (o.value !== undefined) input.value = o.value;
  } else {
    input = h('input', Object.assign({ class: 'input', type: o.type || 'text', min: o.min, max: o.max, step: o.step }, common));
    if (o.value !== undefined && o.value !== null) input.value = o.value;
  }
  if (o.onInput) input.addEventListener('input', o.onInput);
  if (o.onChange) input.addEventListener('change', o.onChange);
  const err = h('div', { class: 'field-error', id: errId, 'aria-live': 'polite' });
  const control = o.addon ? h('div', { class: 'input-group' }, input, h('div', { class: 'input-addon' }, o.addon)) : input;
  const el = h('div', { class: 'field' + (o.cls ? ' ' + o.cls : '') },
    o.label ? h('label', { class: 'label', for: id }, o.label, o.required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null) : null,
    control, o.hint ? h('div', { class: 'hint', id: hintId }, o.hint) : null, err);
  const setError = (msg) => {
    clear(err);
    if (msg) { err.appendChild(icon('alert', 14)); err.appendChild(document.createTextNode(msg)); input.setAttribute('aria-invalid', 'true'); }
    else input.removeAttribute('aria-invalid');
    return !msg;
  };
  if (o.error) setError(o.error);
  return { el, input, setError };
};

UI.select = function (options, value, onChange, attrs) {
  const sel = h('select', Object.assign({ class: 'select' }, attrs || {}), options.map((opt) => h('option', { value: opt.value }, opt.label)));
  sel.value = value;
  if (onChange) sel.addEventListener('change', () => onChange(sel.value));
  return sel;
};

UI.checkbox = function (label, checked, onChange, attrs) {
  const input = h('input', Object.assign({ type: 'checkbox', checked }, attrs || {}));
  if (onChange) input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'check' }, input, h('span', null, label));
};

/** Interrupteur accessible (role="switch"). */
UI.toggle = function (label, checked, onChange, o) {
  const opts = o || {};
  const input = h('input', { type: 'checkbox', role: 'switch', checked, disabled: !!opts.disabled, 'aria-label': opts.ariaLabel || null });
  if (onChange) input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'switch' + (opts.disabled ? ' is-disabled' : '') }, input, h('span', { class: 'track', 'aria-hidden': 'true' }),
    label ? h('span', null, label, opts.desc ? h('span', { class: 'hint', style: { display: 'block' } }, opts.desc) : null) : null);
};

/** Contrôle segmenté (boutons à bascule). */
UI.segmented = function (items, active, onSelect, label) {
  return h('div', { class: 'segmented', role: 'group', 'aria-label': label || null },
    items.map((it) => h('button', { type: 'button', 'aria-pressed': String(it.id === active), onClick: () => onSelect(it.id) }, it.label)));
};

UI.card = function (o, ...children) {
  const opts = o || {};
  const head = opts.title ? h('div', { class: 'card-head' }, h(opts.level || 'h2', null, opts.title), opts.actions ? h('div', { class: 'row-s' }, opts.actions) : null) : null;
  return h('section', { class: 'card ' + (opts.cls || ''), 'aria-label': opts.title ? null : (opts.ariaLabel || null) },
    head, opts.flush ? h('div', { class: 'card-flush' }, children) : h('div', { class: opts.title ? 'card-body' : 'card-pad' }, children));
};

/** Carte statistique (KPI). */
UI.kpi = function (o) {
  // Pas de compteur animé : le chiffre s'affiche directement (retour d'audit : mouvement gratuit).
  const value = h('div', { class: 'kpi-value' }, o.value);
  return h('div', { class: 'card kpi ' + (o.cls || '') },
    h('div', { class: 'kpi-label' }, o.icon ? icon(o.icon, 18) : null, h('span', null, o.label)), value,
    o.foot ? h('div', { class: 'kpi-foot' }, o.foot) : null);
};

/** Animation de compteur (respecte prefers-reduced-motion). */
UI.countUp = function (el, to, format) {
  if (prefersReducedMotion()) { el.textContent = format(to); return; }
  // La valeur finale est écrite d'emblée : si les frames ne tournent pas (onglet en arrière-plan,
  // impression, capture), le bon chiffre reste affiché. L'animation ne démarre qu'à la 1re frame.
  el.textContent = format(to);
  let start = null;
  const dur = 700;
  const step = (now) => {
    if (start === null) start = now;
    const p = Math.max(0, Math.min(1, (now - start) / dur)); // borne : l'horodatage rAF peut précéder start
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = format(to * eased);
    if (p < 1) requestAnimationFrame(step); else el.textContent = format(to);
  };
  requestAnimationFrame(step);
};

/** Pastille de statut : la couleur est toujours doublée d'un texte (et souvent d'une icône). */
UI.badge = function (text, tone, iconName) {
  return h('span', { class: 'badge badge-' + (tone || 'neutral') }, iconName ? icon(iconName, 13) : null, text);
};

/* Dictionnaire central des statuts → texte, ton, icône */
const STATUS = {
  validee: ['Validée', 'success', 'checkCircle'], compensee: ['Validée par compensation', 'info', 'scale'], non_validee: ['Non validée', 'danger', 'xCircle'],
  en_cours: ['En cours', 'neutral', 'clock'], admis: ['Admis', 'success', 'checkCircle'], ajourne: ['Ajourné', 'danger', 'xCircle'], rattrapage: ['Rattrapage', 'warning', 'refresh'],
  justifiee: ['Justifiée', 'success', 'check'], non_justifiee: ['Non justifiée', 'danger', 'alert'], en_attente: ['En attente de validation', 'warning', 'clock'], refusee: ['Justificatif refusé', 'danger', 'xCircle'],
  payee: ['Payée', 'success', 'checkCircle'], retard: ['En retard', 'danger', 'alert'], avenir: ['À venir', 'neutral', 'clock'],
  soumise: ['Soumise', 'warning', 'send'], traitement: ['En traitement', 'info', 'refresh'], prete: ['Prête à retirer', 'success', 'checkCircle'],
  brouillon: ['Brouillon', 'neutral', 'edit'], renvoyee: ['Renvoyée', 'danger', 'arrowLeft'], attente: ['Non saisie', 'neutral', 'minus'], validee_sco: ['Validée par la Scolarité', 'success', 'lock'],
  annule: ['Annulé', 'danger', 'x'], deplace: ['Déplacé', 'warning', 'arrowRight'], salle: ['Changement de salle', 'info', 'door'], normal: ['Maintenu', 'success', 'check'],
  P: ['Présent', 'success', 'check'], A: ['Absent', 'danger', 'x'], R: ['Retard', 'warning', 'clock'],
  rendu: ['Rendu', 'info', 'check'], corrige: ['Corrigé', 'success', 'checkCircle'], a_faire: ['À faire', 'neutral', 'clock'], en_retard: ['Rendu en retard', 'warning', 'alert'], non_rendu: ['Non rendu', 'danger', 'xCircle'],
  actif: ['Actif', 'success', 'check'], inactif: ['Désactivé', 'danger', 'lock'], rapproche: ['Rapproché', 'success', 'checks'], a_verifier: ['À vérifier', 'warning', 'alert'],
  a_jour: ['À jour', 'success', 'checkCircle'], impaye: ['Impayé', 'danger', 'alert']
};
UI.status = function (key, override) {
  const def = STATUS[key] || [key, 'neutral', null];
  return UI.badge(override || def[0], def[1], def[2]);
};

/** Pastille de matière (couleur pastel associée à l'ECUE). */
UI.subject = function (ecue, short) {
  if (!ecue) return null;
  return h('span', { class: 'subj subj-' + (ecue.couleur || 0), title: ecue.nom }, h('span', null, short ? ecue.id : ecue.nom));
};

/** Onglets accessibles (flèches gauche/droite). */
UI.tabs = function (items, active, onSelect, label) {
  const list = h('div', { class: 'tabs', role: 'tablist', 'aria-label': label || null });
  items.forEach((it, i) => {
    const btn = h('button', { class: 'tab', role: 'tab', type: 'button', id: 'tab-' + it.id, 'aria-selected': String(it.id === active), tabindex: it.id === active ? '0' : '-1', onClick: () => onSelect(it.id) },
      it.icon ? icon(it.icon, 16) : null, it.label, it.count ? h('span', { class: 'count', 'aria-label': it.count + ' éléments' }, String(it.count)) : null);
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = items[(i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length];
      onSelect(next.id);
      setTimeout(() => { const el = document.getElementById('tab-' + next.id); if (el) el.focus(); }, 0);
    });
    list.appendChild(btn);
  });
  return list;
};

/** Avatar à initiales (teinte stable déduite du nom). */
UI.avatar = function (user, size) {
  if (!user) return h('span', { class: 'avatar' }, '?');
  // Teinte porteuse de sens (et non aléatoire) : filière pour les étudiants, neutre pour les enseignants,
  // vert de marque pour la Scolarité et les parents.
  const tone = user.filiere ? { info: 1, droit: 3, eco: 0 }[user.filiere] : user.role === 'enseignant' ? 7 : 6;
  return h('span', { class: 'avatar subj-' + (tone === undefined ? 7 : tone) + (size ? ' avatar-' + size : ''), 'aria-hidden': 'true' }, FMT.initials(user));
};

UI.progress = function (value, max, tone, label) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const bar = h('span', { style: { width: '0%' } });
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = pct + '%'; }));
  return h('div', { class: 'progress' + (tone ? ' ' + tone : ''), role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(max), 'aria-valuenow': String(Math.round(value)), 'aria-label': label || null }, bar);
};

/** Jauge circulaire de moyenne (sur 20 par défaut). */
UI.gauge = function (value, o) {
  const opts = Object.assign({ max: 20, size: 140, stroke: 12, sub: 'sur 20', label: 'Moyenne' }, o || {});
  const r = (opts.size - opts.stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = value === null ? 0 : Math.max(0, Math.min(1, value / opts.max));
  const bar = s('circle', { class: 'g-bar', cx: opts.size / 2, cy: opts.size / 2, r, fill: 'none', 'stroke-width': opts.stroke, 'stroke-linecap': 'round', 'stroke-dasharray': c, 'stroke-dashoffset': c });
  const tone = opts.noTone || value === null ? '' : value < 8 ? ' danger' : value < 10 ? ' warn' : '';
  const svgEl = s('svg', { width: opts.size, height: opts.size, viewBox: '0 0 ' + opts.size + ' ' + opts.size, 'aria-hidden': 'true' },
    s('circle', { class: 'g-track', cx: opts.size / 2, cy: opts.size / 2, r, fill: 'none', 'stroke-width': opts.stroke }), bar);
  requestAnimationFrame(() => requestAnimationFrame(() => bar.setAttribute('stroke-dashoffset', String(c * (1 - ratio)))));
  const val = h('span', { class: 'gauge-value' }, opts.text || FMT.note(value));
  return h('div', { class: 'gauge' + tone, role: 'img', 'aria-label': opts.label + ' : ' + (opts.text || FMT.note(value)) + ' ' + opts.sub },
    svgEl, h('div', { class: 'gauge-label' }, val, h('span', { class: 'gauge-sub' }, opts.sub)));
};

UI.alert = function (tone, title, text, actions) {
  const ic = { danger: 'alert', warning: 'alert', info: 'info', success: 'checkCircle', neutral: 'info' }[tone];
  return h('div', { class: 'alert alert-' + tone, role: tone === 'danger' ? 'alert' : null }, icon(ic, 20),
    h('div', { class: 'alert-text' }, title ? h('div', { class: 'alert-title' }, title) : null, text ? h('div', null, text) : null),
    actions ? h('div', { class: 'alert-actions' }, actions) : null);
};

UI.kv = function (pairs) {
  const dl = h('dl', { class: 'kv' });
  pairs.forEach(([k, v]) => { if (v === null || v === undefined) return; dl.appendChild(h('dt', null, k)); dl.appendChild(h('dd', null, v)); });
  return dl;
};

UI.pageHead = function (o) {
  return h('div', { class: 'page-head' },
    h('div', { class: 'grow' }, o.crumbs ? UI.breadcrumb(o.crumbs) : null, h('h1', { tabindex: '-1', 'data-page-title': '' }, o.title), o.sub ? h('p', { class: 'sub' }, o.sub) : null),
    o.actions ? h('div', { class: 'actions' }, o.actions) : null);
};

UI.breadcrumb = function (items) {
  return h('nav', { 'aria-label': 'Fil d\'Ariane' }, h('ol', { class: 'breadcrumb' }, items.map((it, i) => h('li', null,
    i > 0 ? icon('chevronRight', 14) : null,
    it.href && i < items.length - 1 ? h('a', { href: it.href }, it.label) : h('span', { 'aria-current': i === items.length - 1 ? 'page' : null }, it.label)))));
};

/** Barre de recherche. */
UI.search = function (o) {
  const id = uid('q');
  const input = h('input', { class: 'input' + (o.small ? ' input-s' : ''), type: 'search', id, placeholder: o.placeholder || 'Rechercher…', value: o.value || '', autocomplete: 'off', 'aria-label': o.label || o.placeholder || 'Rechercher' });
  if (o.onInput) input.addEventListener('input', () => o.onInput(input.value));
  const el = h('div', { class: 'searchbar' }, h('span', { class: 'icon-lead' }, icon('search', 18)), input, o.kbd ? h('span', { class: 'kbd', 'aria-hidden': 'true' }, o.kbd) : null);
  return { el, input };
};

/** Pagination. */
UI.pagination = function (page, pages, total, onPage) {
  const btns = [];
  const add = (p) => btns.push(h('button', { type: 'button', 'aria-current': p === page ? 'page' : null, 'aria-label': 'Page ' + p, onClick: () => onPage(p) }, String(p)));
  for (let p = 1; p <= pages; p++) { if (p === 1 || p === pages || Math.abs(p - page) <= 1) add(p); else if (Math.abs(p - page) === 2) btns.push(h('span', { 'aria-hidden': 'true' }, '…')); }
  return h('nav', { class: 'pagination', 'aria-label': 'Pagination' }, h('span', null, FMT.plural(total, 'résultat')),
    h('div', { class: 'pages' },
      h('button', { type: 'button', 'aria-label': 'Page précédente', disabled: page <= 1, onClick: () => onPage(page - 1) }, icon('chevronLeft', 16)),
      btns,
      h('button', { type: 'button', 'aria-label': 'Page suivante', disabled: page >= pages, onClick: () => onPage(page + 1) }, icon('chevronRight', 16))));
};

/**
 * Tableau triable, filtrable et paginé.
 * columns : [{ key, label, sortable, num, render(row), sortValue(row), cls }]
 * filters : [{ id, label, options:[{value,label}], test(row, value) }]
 */
UI.table = function (o) {
  const st = { q: '', sortKey: o.sortKey || null, sortDir: o.sortDir || 'asc', page: 1, filters: {} };
  let rows = o.rows;
  const wrap = h('div', { class: 'table-block' });
  const tools = h('div', { class: 'table-tools' });
  const tableWrap = h('div', { class: 'table-wrap' });
  const pager = h('div');
  if (o.searchKeys) {
    const sb = UI.search({ placeholder: o.searchPlaceholder || 'Rechercher…', small: true, onInput: (v) => { st.q = norm(v); st.page = 1; render(); } });
    tools.appendChild(sb.el);
  }
  (o.filters || []).forEach((f) => {
    const sel = UI.select([{ value: '', label: f.label }].concat(f.options), '', (v) => { st.filters[f.id] = v; st.page = 1; render(); }, { 'aria-label': f.label, class: 'select select-s' });
    tools.appendChild(sel);
  });
  if (o.tools) appendChildren(tools, [o.tools]);
  if (tools.childNodes.length) wrap.appendChild(tools);
  wrap.appendChild(tableWrap);
  wrap.appendChild(pager);

  function filtered() {
    let out = rows.filter((r) => {
      if (st.q && !o.searchKeys.some((k) => norm(typeof k === 'function' ? k(r) : r[k]).includes(st.q))) return false;
      return (o.filters || []).every((f) => !st.filters[f.id] || f.test(r, st.filters[f.id]));
    });
    if (st.sortKey) {
      const col = o.columns.find((c) => c.key === st.sortKey);
      const val = col.sortValue || ((r) => r[col.key]);
      out = out.slice().sort((a, b) => {
        const va = val(a); const vb = val(b);
        const cmp = (typeof va === 'number' && typeof vb === 'number') ? va - vb : String(va ?? '').localeCompare(String(vb ?? ''), 'fr');
        return st.sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
  }

  function render() {
    const list = filtered();
    const size = o.pageSize || 1e9;
    const pages = Math.max(1, Math.ceil(list.length / size));
    st.page = Math.min(st.page, pages);
    const slice = list.slice((st.page - 1) * size, st.page * size);
    const thead = h('thead', null, h('tr', null, o.columns.map((c) => {
      const sorted = st.sortKey === c.key;
      const th = h('th', { scope: 'col', class: c.num ? 'num' : null, 'aria-sort': sorted ? (st.sortDir === 'asc' ? 'ascending' : 'descending') : null });
      if (c.sortable) {
        th.appendChild(h('button', { type: 'button', class: 'sort-btn', onClick: () => {
          if (st.sortKey === c.key) st.sortDir = st.sortDir === 'asc' ? 'desc' : 'asc'; else { st.sortKey = c.key; st.sortDir = 'asc'; }
          render();
        } }, c.label, icon(sorted && st.sortDir === 'desc' ? 'arrowDown' : 'arrowUp', 13)));
      } else th.appendChild(c.label ? document.createTextNode(c.label) : h('span', { class: 'sr-only' }, 'Actions'));
      return th;
    })));
    const tbody = h('tbody');
    if (!slice.length) {
      tbody.appendChild(h('tr', null, h('td', { colspan: String(o.columns.length) }, UI.empty({ title: o.emptyTitle || 'Aucun résultat', text: o.emptyText || 'Modifiez la recherche ou les filtres.' }))));
    }
    slice.forEach((r) => {
      const tr = h('tr', { class: [o.rowClick ? 'is-clickable' : '', o.rowClass ? o.rowClass(r) : ''].join(' ').trim() || null });
      if (o.rowClick) tr.addEventListener('click', (e) => { if (e.target.closest('button, a, input, select, label')) return; o.rowClick(r); });
      o.columns.forEach((c) => {
        const v = c.render ? c.render(r) : r[c.key];
        tr.appendChild(h('td', { class: [c.num ? 'num' : '', c.cls || ''].join(' ').trim() || null }, v));
      });
      tbody.appendChild(tr);
    });
    clear(tableWrap).appendChild(h('table', { class: 'table' }, o.caption ? h('caption', { class: 'sr-only' }, o.caption) : null, thead, tbody, o.footer ? o.footer(list) : null));
    clear(pager);
    if (o.pageSize && list.length > o.pageSize) pager.appendChild(UI.pagination(st.page, pages, list.length, (p) => { st.page = p; render(); }));
    else if (o.pageSize) pager.appendChild(h('div', { class: 'pagination' }, h('span', null, FMT.plural(list.length, 'résultat'))));
    if (o.onRender) o.onRender(list);
  }
  render();
  wrap.update = (newRows) => { rows = newRows; render(); };
  return wrap;
};

/** État vide illustré. */
UI.empty = function (o) {
  const ill = s('svg', { class: 'illus', viewBox: '0 0 120 96', 'aria-hidden': 'true' },
    s('ellipse', { class: 'ill-a', cx: 60, cy: 84, rx: 44, ry: 7 }),
    s('rect', { class: 'ill-c', x: 30, y: 18, width: 52, height: 62, rx: 6 }),
    s('rect', { class: 'ill-c', x: 38, y: 10, width: 52, height: 62, rx: 6 }),
    s('path', { class: 'ill-b', d: 'M48 30h32M48 40h32M48 50h20', 'stroke-linecap': 'round' }),
    s('circle', { class: 'ill-b', cx: 86, cy: 64, r: 10 }),
    s('path', { class: 'ill-b', d: 'M82 64l3 3 5-6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  return h('div', { class: 'empty' }, ill, h('h3', null, o.title), o.text ? h('p', null, o.text) : null, o.action || null);
};

/** Squelette de chargement. */
UI.skeleton = function (kind) {
  const line = (w, ht) => h('div', { class: 'skeleton', style: { width: w, height: (ht || 14) + 'px' } });
  if (kind === 'page') {
    return h('div', { class: 'stack-l', 'aria-busy': 'true', 'aria-label': 'Chargement' },
      h('div', { class: 'stack-s' }, line('40%', 28), line('25%')),
      h('div', { class: 'grid-4' }, [0, 1, 2, 3].map(() => h('div', { class: 'card card-pad stack-s' }, line('50%'), line('70%', 30), line('40%')))),
      h('div', { class: 'grid-main' }, h('div', { class: 'card card-pad stack' }, line('30%', 18), line('100%', 120)), h('div', { class: 'card card-pad stack' }, line('40%', 18), line('90%'), line('80%'), line('85%'))));
  }
  return h('div', { class: 'stack-s', 'aria-busy': 'true' }, line('90%'), line('75%'), line('60%'));
};

/** Sélecteur de date (natif et accessible). */
UI.datePicker = function (o) { return UI.field(Object.assign({ type: 'date' }, o)); };

/**
 * Téléversement simulé : vérifie le type et la taille, n'envoie rien.
 * onFile({ name, sizeKo, type }) est appelé si le fichier est valide.
 */
UI.upload = function (o) {
  const opts = Object.assign({ accept: ['pdf', 'jpg', 'jpeg', 'png'], maxMo: 5, label: 'Déposer un fichier' }, o);
  const id = uid('up');
  const input = h('input', { type: 'file', id, class: 'sr-only', accept: opts.accept.map((x) => '.' + x).join(',') });
  const err = h('div', { class: 'field-error', 'aria-live': 'polite' });
  const chosen = h('div');
  const zone = h('label', { class: 'dropzone', for: id }, icon('upload', 26), h('strong', null, opts.label),
    h('span', null, 'Formats : ' + opts.accept.join(', ').toUpperCase() + ' · ' + opts.maxMo + ' Mo maximum'),
    h('span', { class: 'xsmall' }, 'Glissez-déposez ou cliquez pour choisir'));
  const accept = (file) => {
    clear(err); clear(chosen);
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!opts.accept.includes(ext)) { err.appendChild(document.createTextNode('Type de fichier non autorisé (.' + ext + ').')); return; }
    if (file.size > opts.maxMo * 1024 * 1024) { err.appendChild(document.createTextNode('Fichier trop volumineux (' + FMT.size(Math.round(file.size / 1024)) + '), ' + opts.maxMo + ' Mo maximum.')); return; }
    const info = { name: file.name, sizeKo: Math.max(1, Math.round(file.size / 1024)), type: ext };
    chosen.appendChild(h('div', { class: 'file-chip' }, icon('paperclip', 16), h('span', { class: 'grow truncate' }, info.name), h('span', { class: 'muted xsmall' }, FMT.size(info.sizeKo)),
      UI.badge('Prêt', 'success', 'check')));
    opts.onFile(info);
  };
  input.addEventListener('change', () => { if (input.files && input.files[0]) accept(input.files[0]); });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('is-over'); if (e.dataTransfer.files[0]) accept(e.dataTransfer.files[0]); });
  const demo = h('button', { type: 'button', class: 'link-btn small', onClick: () => accept({ name: opts.demoName || 'justificatif-scan.pdf', size: (opts.demoKo || 482) * 1024 }) }, 'Utiliser un fichier d\'exemple');
  return h('div', { class: 'stack-s' }, input, zone, h('div', { class: 'row-between wrap' }, err, demo), chosen);
};

/** Menu déroulant. items : [{ label, icon, onClick, danger }] */
UI.dropdown = function (trigger, items) {
  const wrapEl = h('div', { class: 'dropdown' });
  const menuId = uid('menu');
  let menu = null;
  const outside = (e) => { if (!wrapEl.contains(e.target)) close(); };
  const close = () => { if (menu) { menu.remove(); menu = null; trigger.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', outside, true); } };
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', () => {
    if (menu) { close(); return; }
    menu = h('div', { class: 'menu', role: 'menu', id: menuId }, items.map((it) => h('button', { type: 'button', role: 'menuitem', class: 'menu-item' + (it.danger ? ' danger' : ''),
      onClick: () => { close(); it.onClick(); } }, it.icon ? icon(it.icon, 18) : null, it.label)));
    menu.addEventListener('keydown', (e) => {
      const btns = Array.from(menu.querySelectorAll('.menu-item'));
      const i = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
      if (e.key === 'Escape') { e.stopPropagation(); close(); trigger.focus(); }
    });
    wrapEl.appendChild(menu);
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-controls', menuId);
    menu.querySelector('.menu-item').focus();
    setTimeout(() => document.addEventListener('click', outside, true), 0);
  });
  wrapEl.appendChild(trigger);
  return wrapEl;
};

/** Accordéon (contenu construit à la première ouverture). */
UI.accordion = function (o) {
  const pid = uid('acc');
  const panel = h('div', { class: 'acc-panel', id: pid, hidden: !o.open });
  let built = false;
  const build = () => { if (!built) { appendChildren(panel, [o.content()]); built = true; } };
  if (o.open) build();
  const btn = h('button', { class: 'acc-btn', type: 'button', 'aria-expanded': String(!!o.open), 'aria-controls': pid, onClick: () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    if (open) build();
    panel.hidden = !open;
    if (o.onToggle) o.onToggle(open);
  } }, o.header, icon('chevronDown', 20, 'chev'));
  return h('div', { class: 'acc' }, btn, panel);
};

/** Étapes (stepper). */
UI.steps = function (labels, current) {
  return h('ol', { class: 'steps', 'aria-label': 'Étapes' }, labels.map((l, i) => h('li', { class: i < current ? 'done' : i === current ? 'current' : '', 'aria-current': i === current ? 'step' : null },
    h('span', { class: 's-dot' }, i < current ? icon('check', 14) : String(i + 1)), h('span', null, l))));
};

/* ---------- Pile de modales : focus piégé, Échap, retour du focus ---------- */
const OVERLAYS = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function openOverlay(panel, isDrawer, onClose) {
  const root = document.getElementById('overlay-root');
  const previous = document.activeElement;
  const overlay = h('div', { class: 'overlay' + (isDrawer ? ' is-drawer' : '') }, panel);
  const entry = { overlay };
  const close = () => {
    const i = OVERLAYS.indexOf(entry);
    if (i === -1) return;
    OVERLAYS.splice(i, 1);
    overlay.remove();
    if (onClose) onClose();
    if (previous && document.contains(previous) && previous.focus) previous.focus();
  };
  entry.close = close;
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') {
      const items = Array.from(panel.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  OVERLAYS.push(entry);
  root.appendChild(overlay);
  setTimeout(() => {
    const target = panel.querySelector('[autofocus]') || panel.querySelector('.modal-body ' + FOCUSABLE.split(', ').join(', .modal-body ')) || panel.querySelector(FOCUSABLE);
    if (target) target.focus();
  }, 30);
  return close;
}

UI.closeAllOverlays = function () { OVERLAYS.slice().reverse().forEach((o) => o.close()); };

function buildDialog(o, isDrawer) {
  const titleId = uid('mt');
  const bodyEl = h('div', { class: 'modal-body' });
  const footEl = h('div', { class: 'modal-foot' });
  let closeFn = () => {};
  const panel = h('div', { class: isDrawer ? 'drawer' : 'modal ' + (o.size ? 'modal-' + o.size : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('div', { class: 'modal-head' }, h('h2', { id: titleId }, o.title), UI.iconButton('x', 'Fermer', () => closeFn())), bodyEl, footEl);
  const api = {
    close: () => closeFn(),
    setBody(node) { clear(bodyEl); appendChildren(bodyEl, [node]); bodyEl.scrollTop = 0; },
    setActions(nodes) { clear(footEl); appendChildren(footEl, [nodes]); footEl.hidden = !nodes || (Array.isArray(nodes) && !nodes.length); },
    panel
  };
  closeFn = openOverlay(panel, isDrawer, o.onClose);
  api.setBody(typeof o.body === 'function' ? o.body(api) : o.body);
  api.setActions(o.actions ? o.actions(api) : null);
  return api;
}

/** Modale. body : nœud ou fonction(api) → nœud ; actions : fonction(api) → [boutons]. */
UI.modal = function (o) { return buildDialog(o, false); };
/** Tiroir latéral (même API que la modale). */
UI.drawer = function (o) { return buildDialog(o, true); };

/** Confirmation (renvoie une promesse). */
UI.confirm = function (o) {
  return new Promise((resolve) => {
    let answered = false;
    UI.modal({
      title: o.title,
      body: h('p', null, o.message),
      onClose: () => { if (!answered) resolve(false); },
      actions: (api) => [
        UI.button({ label: 'Annuler', variant: 'secondary', onClick: () => api.close() }),
        UI.button({ label: o.confirmLabel || 'Confirmer', variant: o.danger ? 'danger' : 'primary', onClick: () => { answered = true; resolve(true); api.close(); } })
      ]
    });
  });
};

/** Toast (annoncé aux lecteurs d'écran). */
UI.toast = function (message, tone = 'success', title) {
  const root = document.getElementById('toasts');
  const ic = { success: 'checkCircle', error: 'xCircle', info: 'info', warning: 'alert' }[tone] || 'info';
  const dismiss = () => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 220); };
  const el = h('div', { class: 'toast ' + tone, role: tone === 'error' ? 'alert' : 'status' }, icon(ic, 20),
    h('div', { class: 'grow' }, title ? h('div', { class: 'toast-title' }, title) : null, h('div', null, message)),
    h('button', { class: 'toast-close', type: 'button', 'aria-label': 'Fermer la notification', onClick: () => dismiss() }, icon('x', 16)));
  root.appendChild(el);
  while (root.children.length > 3) root.firstChild.remove();
  setTimeout(dismiss, 4500);
};

/* ---------- Graphiques SVG faits main ---------- */

/** Graphique en barres. data : [{ label, value, tone }] */
UI.barChart = function (o) {
  const W = o.width || 600; const H = o.height || 220;
  const pad = { l: o.padLeft || 40, r: 8, t: 20, b: 28 };
  const max = o.max || Math.max(1, ...o.data.map((d) => d.value)) * 1.12;
  const iw = W - pad.l - pad.r; const ih = H - pad.t - pad.b;
  const bw = iw / o.data.length;
  const fmt = o.format || ((v) => FMT.int(v));
  const svgEl = s('svg', { class: 'chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.label || 'Graphique en barres' });
  svgEl.appendChild(s('title', null, (o.label || 'Graphique') + '. ' + o.data.map((d) => d.label + ' : ' + fmt(d.value)).join(', ')));
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ih - (ih * i) / 4;
    svgEl.appendChild(s('line', { class: i === 0 ? 'axis' : 'gridline', x1: pad.l, x2: W - pad.r, y1: y, y2: y }));
    svgEl.appendChild(s('text', { class: 'lbl', x: pad.l - 6, y: y + 4, 'text-anchor': 'end' }, (o.axisFormat || fmt)((max * i) / 4)));
  }
  if (o.threshold !== undefined) {
    const y = pad.t + ih - (ih * o.threshold) / max;
    svgEl.appendChild(s('line', { class: 'threshold', x1: pad.l, x2: W - pad.r, y1: y, y2: y }));
  }
  o.data.forEach((d, i) => {
    const bh = (ih * d.value) / max;
    const x = pad.l + i * bw + bw * 0.18;
    const w = bw * 0.64;
    const y = pad.t + ih - bh;
    // Barre arrondie en haut seulement (base posée sur l'axe)
    const r = Math.max(0, Math.min(4, w / 4, bh));
    const rect = s('path', { class: 'bar ' + (d.tone || ''), d: 'M' + x + ' ' + (y + bh) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + bh) + 'Z' });
    rect.style.animationDelay = (i * 40) + 'ms';
    rect.appendChild(s('title', null, d.label + ' : ' + fmt(d.value)));
    svgEl.appendChild(rect);
    if (o.showValues !== false && (d.value > 0 || o.showZero)) svgEl.appendChild(s('text', { class: 'val', x: x + w / 2, y: y - 5, 'text-anchor': 'middle' }, fmt(d.value)));
    svgEl.appendChild(s('text', { class: 'lbl', x: x + w / 2, y: H - 8, 'text-anchor': 'middle' }, d.label));
  });
  return svgEl;
};

/** Graphique en courbe. series : [{ name, values:[…], alt }], labels : […] */
UI.lineChart = function (o) {
  const W = o.width || 600; const H = o.height || 220;
  const pad = { l: 36, r: 16, t: 20, b: 28 };
  const min = o.min ?? 0; const max = o.max ?? 20;
  const iw = W - pad.l - pad.r; const ih = H - pad.t - pad.b;
  const n = o.labels.length;
  const X = (i) => pad.l + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
  const Y = (v) => pad.t + ih - (ih * (v - min)) / (max - min);
  const svgEl = s('svg', { class: 'chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.label || 'Graphique en courbe' });
  svgEl.appendChild(s('title', null, (o.label || '') + '. ' + o.series.map((se) => se.name + ' : ' + se.values.map((v, i) => o.labels[i] + ' ' + FMT.note(v)).join(', ')).join(' ; ')));
  (o.ticks || [0, 5, 10, 15, 20]).forEach((t) => {
    svgEl.appendChild(s('line', { class: t === min ? 'axis' : 'gridline', x1: pad.l, x2: W - pad.r, y1: Y(t), y2: Y(t) }));
    svgEl.appendChild(s('text', { class: 'lbl', x: pad.l - 6, y: Y(t) + 4, 'text-anchor': 'end' }, String(t)));
  });
  if (o.threshold !== undefined) svgEl.appendChild(s('line', { class: 'threshold', x1: pad.l, x2: W - pad.r, y1: Y(o.threshold), y2: Y(o.threshold) }));
  o.labels.forEach((l, i) => svgEl.appendChild(s('text', { class: 'lbl', x: X(i), y: H - 8, 'text-anchor': 'middle' }, l)));
  o.series.forEach((se) => {
    const pts = [];
    se.values.forEach((v, i) => { if (v !== null && v !== undefined) pts.push([X(i), Y(v), v, i]); });
    if (!pts.length) return;
    if (!se.alt && pts.length > 1) {
      const area = 'M' + pts[0][0] + ' ' + Y(min) + pts.map((p) => ' L' + p[0] + ' ' + p[1]).join('') + ' L' + pts[pts.length - 1][0] + ' ' + Y(min) + 'Z';
      svgEl.appendChild(s('path', { class: 'area', d: area }));
    }
    const line = s('path', { class: 'line' + (se.alt ? ' alt' : ''), d: pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ') });
    svgEl.appendChild(line);
    if (!se.alt && !prefersReducedMotion()) {
      requestAnimationFrame(() => {
        if (!line.isConnected) return;
        const len = line.getTotalLength();
        line.style.strokeDasharray = String(len);
        line.style.strokeDashoffset = String(len);
        line.getBoundingClientRect();
        line.style.transition = 'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)';
        line.style.strokeDashoffset = '0';
      });
    }
    pts.forEach((p) => {
      const c = s('circle', { class: 'pt' + (se.alt ? ' alt' : ''), cx: p[0], cy: p[1], r: se.alt ? 3 : 4.5 });
      c.appendChild(s('title', null, se.name + ' — ' + o.labels[p[3]] + ' : ' + FMT.note(p[2])));
      svgEl.appendChild(c);
      if (!se.alt && o.showValues) svgEl.appendChild(s('text', { class: 'val', x: p[0], y: p[1] - 10, 'text-anchor': 'middle' }, FMT.num(p[2], 2)));
    });
  });
  return svgEl;
};

/**
 * Motif de type QR code (simulé, non décodable) généré à partir d'une graine.
 * Les trois repères d'angle donnent l'aspect d'un vrai code.
 */
UI.qr = function (seed, size = 220) {
  const N = 29;
  let hsh = 2166136261;
  for (let i = 0; i < seed.length; i++) { hsh ^= seed.charCodeAt(i); hsh = Math.imul(hsh, 16777619) >>> 0; }
  const rnd = seededRandom(hsh);
  const finder = (x, y) => (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
  let d = '';
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (finder(x, y)) continue;
      const on = (x === 6 || y === 6) ? (x + y) % 2 === 0 : rnd() < 0.48;
      if (on) d += 'M' + x + ' ' + y + 'h1v1h-1z';
    }
  }
  const svgEl = s('svg', { viewBox: '-2 -2 ' + (N + 4) + ' ' + (N + 4), width: size, height: size, role: 'img', 'aria-label': 'QR code (simulé)', 'shape-rendering': 'crispEdges' });
  svgEl.appendChild(s('rect', { x: -2, y: -2, width: N + 4, height: N + 4, fill: '#FFFFFF' }));
  svgEl.appendChild(s('path', { d, fill: '#10231C' }));
  [[0, 0], [N - 7, 0], [0, N - 7]].forEach(([x, y]) => {
    svgEl.appendChild(s('rect', { x: x + 0.5, y: y + 0.5, width: 6, height: 6, fill: 'none', stroke: '#10231C', 'stroke-width': 1 }));
    svgEl.appendChild(s('rect', { x: x + 2, y: y + 2, width: 3, height: 3, fill: '#047857' }));
  });
  return svgEl;
};

/* ---------- Impression et téléchargement ---------- */

/** Imprime un document : seul le contenu de #print-root est imprimé (feuille @media print). */
UI.print = function (docNode) {
  const root = document.getElementById('print-root');
  clear(root).appendChild(docNode.cloneNode(true));
  document.documentElement.classList.add('is-printing');
  const cleanup = () => { document.documentElement.classList.remove('is-printing'); clear(root); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => { window.print(); setTimeout(cleanup, 800); }, 50);
};

/** Téléchargement réel d'un fichier généré dans le navigateur (Blob). */
UI.download = function (filename, content, mime) {
  const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, rel: 'noopener noreferrer' });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Convertit des lignes en CSV (séparateur « ; », compatible Excel en français). */
function toCSV(rows) {
  const cell = (v) => {
    const str = String(v ?? '');
    const safe = /^[=+\-@]/.test(str) ? "'" + str : str; // neutralise les injections de formules
    return /[;"\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}

/** En-tête de document officiel : identité de l'université + bande tissée. */
UI.docHeader = function (univ, ref, opts) {
  const o = opts || {};
  return [
    h('div', { class: 'doc-head' },
      h('div', { class: 'row' }, UI.logo(44), h('div', { class: 'doc-uni' }, h('strong', null, univ.nom), h('span', null, 'Ministère de l\'Enseignement supérieur — Burkina Faso'), h('span', null, univ.adresse + ' · ' + univ.tel))),
      // QR de vérification visible dès l'en-tête (sans défiler)
      ref ? h('div', { class: 'doc-ref row', style: { alignItems: 'flex-start' } }, h('div', null, ref, o.noQr ? null : h('div', { class: 'xsmall', style: { marginTop: '4px' } }, 'Authenticité : scanner le QR')),
        o.noQr ? null : h('div', { class: 'qr-small' }, UI.qr('verif-' + ref, 84))) : null),
    h('div', { class: 'weave-strip', 'aria-hidden': 'true' })
  ];
};

/* ---------- Registre des écrans (rempli par screens/*.js, lu par le routeur d'app.js) ---------- */
const ROUTES = {};
/** Déclare un écran pour un ou plusieurs rôles : defineScreen('etudiant', 'notes', { title, render(ctx) }). */
function defineScreen(roles, id, def) {
  [].concat(roles).forEach((r) => { ROUTES[r + '/' + id] = Object.assign({ role: r, id }, def); });
}

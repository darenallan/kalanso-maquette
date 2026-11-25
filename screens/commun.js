'use strict';
/*
 * Écrans et widgets communs à plusieurs rôles :
 * emploi du temps, paiement mobile, documents officiels, vue des notes et des absences,
 * messagerie, notifications, annonces, profil, recherche globale, pages d'état,
 * page cachée des composants (#/demo/composants).
 */
const Commun = { tt: {}, notes: {}, abs: {}, msg: { current: null, q: '', draftFile: null }, notif: { filtre: 'toutes' } };
const ALL_ROLES = ['etudiant', 'enseignant', 'scolarite', 'parent'];
const MOYENS = {
  orange: { label: 'Orange Money', short: 'OM', cls: 'provider-orange' },
  moov: { label: 'Moov Money', short: 'MM', cls: 'provider-moov' },
  carte: { label: 'Carte bancaire', short: 'CB', cls: 'provider-carte' },
  especes: { label: 'Espèces à la caisse', short: 'CS', cls: 'provider-especes' },
  virement: { label: 'Virement bancaire', short: 'VR', cls: 'provider-virement' }
};
const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
const isMobile = () => window.innerWidth < 768;

/* ======================================================================
   Emploi du temps (vues Jour / Semaine / Mois)
   ====================================================================== */
const TT_START = 7; const TT_END = 20; const TT_PX = 48;

function sessionBadges(c) {
  if (c.statut === 'annule') return UI.status('annule');
  if (c.statut === 'deplace') return UI.status('deplace');
  if (c.statut === 'salle') return UI.status('salle');
  return null;
}

/**
 * o : { key, getSessions(from, to), onOpen(session), conflicts: Set d'identifiants, toolbar }
 */
Commun.timetable = function (o) {
  const st = Commun.tt[o.key] || (Commun.tt[o.key] = { view: isMobile() ? 'jour' : 'semaine', anchor: DT.rel(0) });
  if (isMobile() && st.view === 'mois') st.view = 'semaine';
  const root = h('div', { class: 'stack' });
  const open = o.onOpen || ((c) => Commun.sessionDrawer(c));

  const shift = (dir) => {
    const d = DT.parse(st.anchor);
    if (st.view === 'jour') { let n = DT.add(d, dir); if (n.getDay() === 0) n = DT.add(n, dir); st.anchor = DT.iso(n); }
    else if (st.view === 'semaine') st.anchor = DT.iso(DT.add(d, 7 * dir));
    else st.anchor = DT.iso(new Date(d.getFullYear(), d.getMonth() + dir, 1));
    draw();
  };

  const eventLabel = (c) => K.sessionTitle(c) + ', ' + c.type + ', ' + FMT.hhmm(c.debut) + ' à ' + FMT.hhmm(c.fin) + ', ' + K.salle(c.salle).nom + (c.statut !== 'normal' ? ', ' + STATUS[c.statut][0] : '');

  function dayView(list) {
    if (!list.length) return UI.empty({ title: 'Aucun cours ce jour', text: 'Profitez-en pour avancer sur vos devoirs ou passer à la bibliothèque.' });
    return h('div', { class: 'day-list' }, list.map((c) => h('button', { type: 'button', class: 'day-event' + (c.statut === 'annule' ? ' is-cancelled' : ''), 'aria-label': eventLabel(c), onClick: () => open(c) },
      h('div', { class: 'time' }, c.debut, h('small', null, c.fin)),
      h('span', { class: 'bar subj-' + K.sessionColor(c) }),
      h('div', { class: 'grow stack-s', style: { gap: '4px' } },
        h('div', { class: 'row-s wrap' }, h('span', { class: 'ttl strong' }, K.sessionTitle(c)), h('span', { class: 'tag-type' }, c.type), sessionBadges(c), o.conflicts && o.conflicts.has(c.id) ? UI.badge('Conflit', 'danger', 'alert') : null),
        h('div', { class: 'small muted row-s wrap' }, icon('door', 14), c.ancienneSalle ? h('span', null, h('s', null, K.salle(c.ancienneSalle).nom), ' → ' + K.salle(c.salle).nom) : K.salle(c.salle).nom, h('span', { 'aria-hidden': 'true' }, '·'), K.sessionTeacher(c)),
        c.remarque ? h('div', { class: 'xsmall muted' }, c.remarque) : null),
      icon('chevronRight', 18))));
  }

  function weekView(list, monday) {
    const grid = h('div', { class: 'tt-week', role: 'grid', 'aria-label': 'Emploi du temps de la semaine' });
    grid.appendChild(h('div', { class: 'tt-head', 'aria-hidden': 'true' }));
    const today = DT.rel(0);
    const days = [0, 1, 2, 3, 4, 5].map((i) => DT.iso(DT.add(monday, i)));
    days.forEach((d) => grid.appendChild(h('div', { class: 'tt-head' + (d === today ? ' is-today' : ''), role: 'columnheader' }, FMT.weekday(d).slice(0, 3) + '.', h('span', { class: 'd' }, String(DT.parse(d).getDate())))));
    const height = (TT_END - TT_START) * TT_PX;
    const hours = h('div', { class: 'tt-hours', style: { height: height + 'px' } });
    for (let hr = TT_START + 1; hr < TT_END; hr++) hours.appendChild(h('span', { class: 'tt-hour', style: { top: ((hr - TT_START) * TT_PX) + 'px' } }, DT.pad(hr) + 'h'));
    grid.appendChild(hours);
    const toY = (t) => { const [hh, mm] = t.split(':').map(Number); return (hh + mm / 60 - TT_START) * TT_PX; };
    days.forEach((d) => {
      const col = h('div', { class: 'tt-col' + (d === today ? ' is-today' : ''), style: { height: height + 'px' }, role: 'gridcell' });
      list.filter((c) => c.date === d).forEach((c) => {
        const top = toY(c.debut); const ht = toY(c.fin) - top - 3;
        col.appendChild(h('button', { type: 'button', class: 'tt-event subj-' + K.sessionColor(c) + (c.statut === 'annule' ? ' is-cancelled' : '') + (o.conflicts && o.conflicts.has(c.id) ? ' is-conflict' : ''),
          style: { top: top + 'px', height: ht + 'px' }, 'aria-label': eventLabel(c), onClick: () => open(c) },
          h('span', { class: 't' }, K.sessionTitle(c)),
          h('span', { class: 'm' }, c.type + ' · ' + K.salle(c.salle).nom),
          sessionBadges(c) || (o.conflicts && o.conflicts.has(c.id) ? UI.badge('Conflit', 'danger', 'alert') : null)));
      });
      if (d === today) {
        const now = new Date(); const y = (now.getHours() + now.getMinutes() / 60 - TT_START) * TT_PX;
        if (y > 0 && y < height) col.appendChild(h('div', { class: 'tt-now', style: { top: y + 'px' }, 'aria-hidden': 'true' }));
      }
      grid.appendChild(col);
    });
    return h('div', { class: 'tt-scroll' }, grid);
  }

  function monthView(list, anchor) {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = DT.mondayOf(first);
    const grid = h('div', { class: 'month-grid' }, ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'].map((d) => h('div', { class: 'mh' }, d)));
    const today = DT.rel(0);
    for (let i = 0; i < 42; i++) {
      const d = DT.add(start, i); const iso = DT.iso(d);
      const evs = list.filter((c) => c.date === iso);
      grid.appendChild(h('div', { class: 'month-cell' + (d.getMonth() !== anchor.getMonth() ? ' is-out' : '') + (iso === today ? ' is-today' : '') },
        h('span', { class: 'n' }, String(d.getDate())),
        evs.slice(0, 3).map((c) => h('button', { type: 'button', class: 'month-ev subj-' + K.sessionColor(c) + (c.statut === 'annule' ? ' is-cancelled' : ''), 'aria-label': eventLabel(c), onClick: () => open(c) }, c.debut + ' ' + K.sessionTitle(c))),
        evs.length > 3 ? h('button', { type: 'button', class: 'link-btn xsmall', onClick: () => { st.view = 'jour'; st.anchor = iso; draw(); } }, '+' + (evs.length - 3) + ' autres') : null));
    }
    return grid;
  }

  function draw() {
    clear(root);
    const anchor = DT.parse(st.anchor);
    let from; let to; let label;
    if (st.view === 'jour') { from = to = st.anchor; label = capitalize(FMT.dateLong(st.anchor)); }
    else if (st.view === 'semaine') { const m = DT.mondayOf(anchor); from = DT.iso(m); to = DT.iso(DT.add(m, 5)); label = 'Semaine du ' + FMT.dateMed(from); }
    else { const f = new Date(anchor.getFullYear(), anchor.getMonth(), 1); from = DT.iso(DT.mondayOf(f)); to = DT.iso(DT.add(DT.mondayOf(f), 41)); label = capitalize(FMT.month(anchor)); }
    const list = o.getSessions(from, to);
    const views = [{ id: 'jour', label: 'Jour' }, { id: 'semaine', label: 'Semaine' }].concat(isMobile() ? [] : [{ id: 'mois', label: 'Mois' }]);
    root.appendChild(h('div', { class: 'tt-toolbar' },
      h('div', { class: 'row-s wrap' },
        UI.button({ label: 'Précédent', icon: 'chevronLeft', iconOnly: true, variant: 'secondary', onClick: () => shift(-1) }),
        UI.button({ label: 'Suivant', icon: 'chevronRight', iconOnly: true, variant: 'secondary', onClick: () => shift(1) }),
        UI.button({ label: 'Aujourd\'hui', variant: 'secondary', onClick: () => { st.anchor = DT.rel(0); draw(); } }),
        h('h2', { class: 'section-h', style: { fontSize: '18px' }, 'aria-live': 'polite' }, label)),
      h('div', { class: 'row-s wrap' }, o.toolbar || null, UI.segmented(views, st.view, (v) => { st.view = v; draw(); }, 'Vue de l\'emploi du temps'))));
    if (st.view === 'jour') root.appendChild(dayView(list));
    else if (st.view === 'semaine') root.appendChild(list.length ? weekView(list, DT.mondayOf(anchor)) : UI.empty({ title: 'Aucun cours planifié cette semaine', text: 'L\'emploi du temps de cette période n\'est pas encore publié.' }));
    else root.appendChild(monthView(list, anchor));
    root.appendChild(h('div', { class: 'legend' }, h('span', null, UI.status('annule'), ' cours barré'), h('span', null, UI.status('deplace')), h('span', null, UI.status('salle'))));
  }
  draw();
  return root;
};

/** Tiroir de détail d'un cours. */
Commun.sessionDrawer = function (c, extra) {
  const e = c.ecueId ? K.ecue(c.ecueId) : null;
  const ressources = e ? App.store.ressources.filter((r) => r.ecueId === e.id).slice(0, 3) : [];
  const devoir = e ? App.store.devoirs.filter((d) => d.ecueId === e.id && d.dateLimite >= c.date).sort((a, b) => a.dateLimite.localeCompare(b.dateLimite))[0] : null;
  const role = App.session.role;
  UI.drawer({
    title: K.sessionTitle(c),
    body: h('div', { class: 'stack' },
      h('div', { class: 'row-s wrap' }, e ? UI.subject(e) : UI.badge(K.filiere(c.filiere).nom + ' ' + c.niveau, 'neutral'), h('span', { class: 'tag-type' }, c.type), sessionBadges(c) || UI.status('normal')),
      c.remarque ? UI.alert(c.statut === 'annule' ? 'danger' : c.statut === 'deplace' ? 'warning' : 'info', null, c.remarque) : null,
      UI.kv([
        ['Date', capitalize(FMT.dateLong(c.date))],
        ['Horaire', FMT.hhmm(c.debut) + ' – ' + FMT.hhmm(c.fin)],
        ['Salle', c.ancienneSalle ? K.salle(c.salle).nom + ' (au lieu de ' + K.salle(c.ancienneSalle).nom + ')' : K.salle(c.salle).nom],
        ['Enseignant', K.sessionTeacher(c)],
        ['Groupe', c.groupe === 'all' ? 'Toute la promotion' : 'Groupe ' + c.groupe],
        ['UE', e ? e.ue.id + ' — ' + e.ue.nom : null]
      ]),
      ressources.length ? h('div', { class: 'stack-s' }, h('h3', { style: { fontSize: '15px' } }, 'Ressources liées'),
        h('ul', { class: 'list' }, ressources.map((r) => h('li', { class: 'list-item' }, Commun.resIcon(r.type), h('div', { class: 'grow' }, h('div', { class: 'list-title' }, r.titre), h('div', { class: 'list-meta' }, FMT.size(r.tailleKo))))))) : null,
      devoir ? h('div', { class: 'stack-s' }, h('h3', { style: { fontSize: '15px' } }, 'Devoir associé'),
        h('a', { class: 'card card-link card-pad', href: '#/' + role + '/' + (role === 'enseignant' ? 'corrections' : 'devoirs') }, h('div', { class: 'strong small' }, devoir.titre), h('div', { class: 'xsmall muted' }, 'À rendre le ' + FMT.date(devoir.dateLimite) + ' à ' + devoir.heureLimite))) : null,
      extra || null),
    actions: (api) => [
      UI.button({ label: 'Fermer', variant: 'secondary', onClick: () => api.close() }),
      UI.button({ label: 'Ajouter à mon agenda', icon: 'calendar', onClick: () => { UI.toast('« ' + K.sessionTitle(c) + ' » a été ajouté à votre agenda (simulation).', 'success'); api.close(); } })
    ]
  });
};

Commun.resIcon = function (type) {
  const lab = { pdf: 'PDF', slides: 'DIAPO', lien: 'LIEN', video: 'VIDÉO' }[type];
  return h('span', { class: 'res-type res-' + type, 'aria-hidden': 'true' }, lab);
};

/* ======================================================================
   Documents officiels (relevé, reçu) et affichage imprimable
   ====================================================================== */
Commun.showDoc = function (title, docNode) {
  UI.modal({
    title, size: 'xl',
    body: h('div', null, h('div', { class: 'doc-actions' },
      UI.button({ label: 'Imprimer', icon: 'printer', variant: 'secondary', onClick: () => UI.print(docNode) }),
      UI.button({ label: 'Télécharger en PDF', icon: 'download', onClick: () => { UI.toast('Dans la fenêtre d\'impression, choisissez « Enregistrer au format PDF ».', 'info'); UI.print(docNode); } })), docNode)
  });
};

function docSignature(lieuDate) {
  return h('div', { class: 'doc-foot' },
    h('div', { class: 'xsmall', style: { maxWidth: '260px' } }, 'Document vérifiable en ligne grâce au QR code figurant en tête. Réf. ' + String(lieuDate).slice(0, 24)),
    h('div', { class: 'stack-s', style: { alignItems: 'center', textAlign: 'center' } }, h('div', null, 'Fait à Ouagadougou, le ' + FMT.date(DT.rel(0))),
      h('div', { class: 'stamp' }, 'Université Horizon · Service de la Scolarité'), h('div', null, h('strong', null, 'Mariam Compaoré')), h('div', { class: 'xsmall' }, 'Cheffe du service de la Scolarité')));
}

Commun.releveDoc = function (sid, sem, session) {
  const st = K.user(sid);
  const r = K.result(sid, sem, session);
  const univ = App.store.universite;
  const rows = [];
  r.ues.forEach((u) => {
    rows.push(h('tr', { class: 'ue-row' }, h('td', null, u.ue.id), h('td', null, u.ue.nom), h('td', { class: 'num' }, ''), h('td', { class: 'num' }, String(u.credits)), h('td', { class: 'num' }, ''), h('td', { class: 'num' }, ''),
      h('td', { class: 'num' }, FMT.note(u.moy)), h('td', null, u.statut === 'en_cours' ? 'En cours' : STATUS[u.statut][0])));
    u.ecues.forEach((e) => rows.push(h('tr', null, h('td', null, e.ecue.id), h('td', null, '   ' + e.ecue.nom), h('td', { class: 'num' }, String(e.coef)), h('td', { class: 'num' }, ''),
      h('td', { class: 'num' }, FMT.note(e.cc === null ? null : Calc.round2(e.cc))), h('td', { class: 'num' }, FMT.note(e.exam)), h('td', { class: 'num' }, FMT.note(e.moy)), h('td', null, ''))));
  });
  const decisionTxt = { admis: 'ADMIS(E) — semestre validé', rattrapage: 'AUTORISÉ(E) À COMPOSER EN SESSION DE RATTRAPAGE', ajourne: 'AJOURNÉ(E)' }[r.decision] || 'Résultats provisoires — semestre en cours';
  return h('div', { class: 'doc' },
    UI.docHeader(univ, 'Réf. RN-' + st.matricule + '-' + sem + '\nAnnée ' + univ.annee),
    h('div', { class: 'doc-title' }, 'Relevé de notes — ' + (sem === 'S3' ? 'Semestre 3' : 'Semestre 4')),
    h('div', { class: 'doc-info' },
      h('div', null, h('b', null, 'Nom et prénom : '), st.nom.toUpperCase() + ' ' + st.prenom), h('div', null, h('b', null, 'Matricule : '), st.matricule),
      h('div', null, h('b', null, 'Né(e) le : '), FMT.date(st.naissance) + ' à ' + st.lieuNaissance), h('div', null, h('b', null, 'Filière : '), K.filiere(st.filiere).nom + ' — Licence ' + st.niveau[1]),
      h('div', null, h('b', null, 'Année universitaire : '), univ.annee), h('div', null, h('b', null, 'Session : '), session === 'normale' ? 'Normale' : 'Rattrapage')),
    h('table', null, h('thead', null, h('tr', null, ['Code', 'Unité d\'enseignement / ECUE', 'Coef.', 'Crédits', 'CC', 'Examen', 'Moyenne', 'Résultat'].map((t, i) => h('th', { class: i >= 2 && i <= 6 ? 'num' : null }, t)))),
      h('tbody', null, rows),
      h('tfoot', null, h('tr', null, h('td', { colspan: '3' }, h('strong', null, 'Moyenne du semestre')), h('td', { class: 'num' }, h('strong', null, r.credits + ' / ' + r.total)), h('td', { colspan: '2' }, ''),
        h('td', { class: 'num' }, h('strong', null, FMT.note(r.moy))), h('td', null, r.mention || '—')))),
    h('div', { class: 'decision' }, 'Décision du jury : ' + decisionTxt + (r.jury ? ' (points de jury : +' + FMT.num(r.jury, 2) + ')' : '')),
    h('p', { style: { marginTop: '10px', fontSize: '11px' } }, 'Règles : moyenne d\'ECUE = CC × ' + App.store.parametres.ponderationCC + ' % + examen × ' + App.store.parametres.ponderationExam + ' %. UE validée si moyenne ≥ 10 ; compensation entre UE du semestre si la moyenne du semestre est ≥ 10 et l\'UE ≥ ' + App.store.parametres.notePlancher + '.'),
    docSignature(sid + sem + session),
    h('div', { class: 'watermark' }, 'Document généré par Kalanso — maquette de démonstration, sans valeur officielle.'));
};

Commun.receiptDoc = function (tx) {
  const st = K.user(tx.sid);
  const univ = App.store.universite;
  const sum = K.paymentSummary(tx.sid);
  const t = App.store.tranches.find((x) => x.n === tx.tranche);
  return h('div', { class: 'doc' },
    UI.docHeader(univ, 'Reçu n° ' + tx.recu),
    h('div', { class: 'doc-title' }, 'Reçu de paiement des frais universitaires'),
    h('div', { class: 'doc-info' },
      h('div', null, h('b', null, 'Étudiant(e) : '), st.prenom + ' ' + st.nom.toUpperCase()), h('div', null, h('b', null, 'Matricule : '), st.matricule),
      h('div', null, h('b', null, 'Filière : '), K.filiere(st.filiere).nom + ' — ' + st.niveau), h('div', null, h('b', null, 'Année : '), univ.annee),
      h('div', null, h('b', null, 'Date du paiement : '), FMT.dateTime(tx.date)), h('div', null, h('b', null, 'Moyen : '), MOYENS[tx.moyen].label + (tx.tel ? ' (' + tx.tel.slice(0, 8) + ' •• ' + tx.tel.slice(-2) + ')' : ''))),
    h('table', null, h('thead', null, h('tr', null, h('th', null, 'Objet'), h('th', null, 'Référence opérateur'), h('th', { class: 'num' }, 'Montant'))),
      h('tbody', null, h('tr', null, h('td', null, (t ? t.libelle : 'Tranche ' + tx.tranche) + ' — frais de scolarité'), h('td', null, tx.reference), h('td', { class: 'num' }, FMT.money(tx.montant))))),
    h('div', { class: 'row-between', style: { marginTop: '16px', alignItems: 'flex-end' } },
      h('div', null, h('div', { class: 'xsmall' }, 'Montant payé'), h('div', { class: 'amount' }, FMT.money(tx.montant)), h('div', { class: 'xsmall' }, 'Reste à payer pour l\'année : ' + FMT.money(sum.reste))),
      h('div', { class: 'stamp' }, 'Payé')),
    docSignature(tx.recu),
    h('div', { class: 'watermark' }, 'Reçu électronique Kalanso — maquette de démonstration, aucun paiement réel.'));
};

/* ======================================================================
   Parcours de paiement (Orange Money, Moov Money, carte, espèces, virement)
   ====================================================================== */
Commun.payFlow = function (sid, trancheN) {
  if (!App.guard('paiement.payer') || !App.requireOnline('Le paiement')) return;
  const t = K.tranchesOf(sid).find((x) => x.n === trancheN);
  const me = K.me();
  const st = { step: 0, moyen: 'orange', tel: me.tel };
  const labels = ['Moyen', 'Coordonnées', 'Confirmation', 'Reçu'];
  const m = UI.modal({ title: 'Payer : ' + t.libelle, body: h('div'), actions: () => null, onClose: () => App.refresh() });
  const enabled = Object.keys(MOYENS).filter((k) => App.store.parametres.moyens[k]);

  function finish() {
    const ref = (st.moyen === 'orange' ? 'OM' : st.moyen === 'moov' ? 'MM' : 'CB') + DT.rel(0).replace(/-/g, '').slice(2) + '.' + String(Math.floor(10000 + Math.random() * 89999));
    const tx = { id: 'tx' + Date.now(), sid, tranche: t.n, montant: t.reste, date: nowStamp(), moyen: st.moyen, reference: ref, recu: 'R-2026-' + String(Date.now()).slice(-5), tel: st.moyen === 'carte' ? '' : st.tel, rapproche: false, par: me.id };
    App.store.transactions.push(tx);
    const student = K.user(sid);
    App.notify(sid, 'paiement', 'Paiement reçu', t.libelle + ' : ' + FMT.money(tx.montant) + ' (' + MOYENS[st.moyen].label + ').', '#/etudiant/paiements');
    const parent = Object.values(App.store.users).find((u) => u.role === 'parent' && u.enfant === sid);
    if (parent) App.notify(parent.id, 'paiement', 'Paiement reçu pour ' + student.prenom, t.libelle + ' : ' + FMT.money(tx.montant) + '.', '#/parent/paiements');
    App.notify('a1', 'paiement', 'Paiement reçu', K.name(student) + ' — ' + t.libelle + ' (' + MOYENS[st.moyen].label + ').', '#/scolarite/finances');
    App.notify('a3', 'paiement', 'Transaction à rapprocher', ref + ' — ' + FMT.money(tx.montant) + '.', '#/scolarite/finances');
    return tx;
  }

  function draw() {
    const body = h('div', { class: 'stack' }, UI.steps(labels, st.step));
    let actions = [];
    if (st.step === 0) {
      body.appendChild(h('div', { class: 'card card-pad row-between' }, h('div', null, h('div', { class: 'small muted' }, t.libelle + ' · échéance ' + FMT.date(t.echeance)), h('div', { class: 'note-big' }, FMT.money(t.reste))), UI.status(t.statut)));
      const grid = h('div', { class: 'choice-grid', role: 'radiogroup', 'aria-label': 'Moyen de paiement' });
      enabled.forEach((k) => grid.appendChild(h('button', { type: 'button', class: 'choice', role: 'radio', 'aria-checked': String(st.moyen === k), onClick: () => { st.moyen = k; draw(); } },
        h('span', { class: 'provider-logo ' + MOYENS[k].cls, 'aria-hidden': 'true' }, MOYENS[k].short), MOYENS[k].label)));
      body.appendChild(grid);
      actions = [UI.button({ label: 'Annuler', variant: 'secondary', onClick: () => m.close() }), UI.button({ label: 'Continuer', iconRight: 'arrowRight', onClick: () => { st.step = 1; draw(); } })];
    } else if (st.step === 1) {
      if (st.moyen === 'orange' || st.moyen === 'moov') {
        const f = UI.field({ label: 'Numéro ' + MOYENS[st.moyen].label, value: st.tel, type: 'tel', inputmode: 'tel', autocomplete: 'tel', required: true, hint: 'Format : +226 XX XX XX XX. Une demande de validation sera envoyée sur ce téléphone.' });
        body.appendChild(f.el);
        body.appendChild(UI.alert('neutral', null, 'Montant débité : ' + FMT.money(t.reste) + '. Aucun code secret ne vous sera demandé dans Kalanso : il se saisit uniquement sur votre téléphone.'));
        actions = [UI.button({ label: 'Retour', variant: 'secondary', onClick: () => { st.step = 0; draw(); } }),
          UI.button({ label: 'Payer ' + FMT.money(t.reste), icon: 'lock', onClick: () => {
            if (!Calc.phoneOk(f.input.value)) { f.setError('Numéro invalide. Exemple : +226 70 12 45 12'); f.input.focus(); return; }
            st.tel = f.input.value.trim(); st.step = 2; draw();
          } })];
      } else if (st.moyen === 'carte') {
        body.appendChild(UI.alert('info', 'Paiement sécurisé', 'Vous allez être redirigé vers la page sécurisée de la banque partenaire (3-D Secure). Kalanso ne voit jamais votre numéro de carte.'));
        actions = [UI.button({ label: 'Retour', variant: 'secondary', onClick: () => { st.step = 0; draw(); } }), UI.button({ label: 'Continuer vers la banque (simulé)', icon: 'external', onClick: () => { st.step = 2; draw(); } })];
      } else {
        const code = 'PAY-' + K.user(sid).matricule.slice(-5) + '-T' + t.n;
        body.appendChild(st.moyen === 'especes'
          ? h('div', { class: 'stack' }, h('p', null, 'Présentez ce code à la caisse de la Scolarité (guichet 4, du lundi au vendredi de 7h30 à 15h30) :'), h('div', { class: 'note-big center' }, code), UI.alert('info', null, 'Le reçu sera disponible ici dès l\'encaissement par l\'agent comptable.'))
          : h('div', { class: 'stack' }, h('p', null, 'Effectuez un virement en indiquant la référence ci-dessous :'),
            UI.kv([['Bénéficiaire', 'Université Horizon de Ouagadougou'], ['Banque', 'Banque partenaire (fictive)'], ['IBAN', 'BF00 0000 0000 0000 0000 0000 00'], ['Référence', code], ['Montant', FMT.money(t.reste)]]),
            UI.alert('neutral', null, 'Le rapprochement est fait par la Scolarité sous 48 heures ouvrées.')));
        actions = [UI.button({ label: 'Retour', variant: 'secondary', onClick: () => { st.step = 0; draw(); } }), UI.button({ label: 'Compris', onClick: () => { m.close(); UI.toast('Instructions enregistrées. Code ' + code + '.', 'info'); } })];
      }
    } else if (st.step === 2) {
      body.appendChild(h('div', { class: 'pay-confirm', 'aria-live': 'polite' },
        h('div', { class: 'phone-pulse' }, icon(st.moyen === 'carte' ? 'card' : 'smartphone', 36)),
        h('h3', null, st.moyen === 'carte' ? 'Authentification bancaire en cours…' : 'Confirmez sur votre téléphone'),
        h('p', { class: 'muted' }, st.moyen === 'carte' ? 'Validez l\'opération dans l\'application de votre banque.' : 'Une demande de paiement de ' + FMT.money(t.reste) + ' a été envoyée au ' + st.tel + '. Saisissez votre code secret sur le téléphone pour valider.'),
        h('div', { class: 'xsmall muted' }, 'Délai maximal : 2 minutes')));
      actions = [UI.button({ label: 'Annuler le paiement', variant: 'ghost', onClick: () => { m.close(); UI.toast('Paiement annulé, aucun montant débité.', 'warning'); } })];
      setTimeout(() => { if (st.step !== 2 || !m.panel.isConnected) return; st.tx = finish(); st.step = 3; draw(); }, 2000);
    } else {
      body.appendChild(h('div', { class: 'pay-confirm', 'aria-live': 'polite' }, h('div', { class: 'success-check' }, icon('check', 36)), h('h3', null, 'Paiement réussi'),
        h('p', { class: 'muted' }, FMT.money(st.tx.montant) + ' payés par ' + MOYENS[st.tx.moyen].label + '.'),
        UI.kv([['Référence', st.tx.reference], ['Reçu n°', st.tx.recu], ['Date', FMT.dateTime(st.tx.date)]])));
      actions = [UI.button({ label: 'Voir le reçu', icon: 'file', variant: 'secondary', onClick: () => { const tx = st.tx; m.close(); Commun.showDoc('Reçu ' + tx.recu, Commun.receiptDoc(tx)); } }),
        UI.button({ label: 'Terminer', onClick: () => m.close() })];
    }
    m.setBody(body);
    m.setActions(actions);
  }
  draw();
};

/** Vue « Scolarité et paiements » (étudiant et parent). */
Commun.paymentsView = function (sid) {
  const sum = K.paymentSummary(sid);
  const txs = App.store.transactions.filter((x) => x.sid === sid).sort((a, b) => b.date.localeCompare(a.date));
  const pct = (sum.paye / sum.total) * 100;
  // Pas d'alerte « en retard » ici : l'échéancier porte déjà le statut et le bouton Payer (évite la redite).
  return h('div', { class: 'stack-l' },
    h('div', { class: 'grid-3' },
      UI.kpi({ label: 'Frais de l\'année', icon: 'wallet', value: FMT.money(sum.total), foot: 'Inscription et scolarité ' + App.store.universite.annee }),
      UI.kpi({ label: 'Déjà payé', icon: 'checkCircle', value: FMT.money(sum.paye), foot: h('span', { class: 'grow' }, UI.progress(sum.paye, sum.total, null, 'Part payée'), h('span', null, FMT.pct(pct) + ' réglés')) }),
      UI.kpi({ label: 'Reste à payer', icon: 'clock', value: FMT.money(sum.reste), foot: !sum.prochaine ? 'Année soldée' : sum.prochaine.statut === 'retard' ? h('span', { class: 'trend-down' }, 'En retard depuis le ' + FMT.date(sum.prochaine.echeance)) : 'Prochaine échéance : ' + FMT.date(sum.prochaine.echeance) })),
    UI.card({ title: 'Échéancier' }, h('ul', { class: 'list' }, sum.tranches.map((t) => h('li', { class: 'list-item wrap' },
      h('span', { class: 'list-icon ' + (t.statut === 'payee' ? 'success' : t.statut === 'retard' ? 'danger' : '') }, icon(t.statut === 'payee' ? 'check' : t.statut === 'retard' ? 'alert' : 'clock', 20)),
      h('div', { class: 'grow' }, h('div', { class: 'list-title' }, t.libelle), h('div', { class: 'list-meta' }, 'Échéance : ' + FMT.date(t.echeance) + (t.tx[0] ? ' · payée le ' + FMT.date(t.tx[0].date) + ' par ' + MOYENS[t.tx[0].moyen].label : ''))),
      h('span', { class: 'strong num' }, FMT.money(t.montant)), UI.status(t.statut),
      t.statut !== 'payee' && can('paiement.payer') ? UI.button({ label: 'Payer', size: 's', variant: t.statut === 'retard' ? 'primary' : 'secondary', onClick: () => Commun.payFlow(sid, t.n) }) : null,
      t.tx[0] ? UI.button({ label: 'Reçu', size: 's', variant: 'ghost', icon: 'file', onClick: () => Commun.showDoc('Reçu ' + t.tx[0].recu, Commun.receiptDoc(t.tx[0])) }) : null)))),
    UI.card({ title: 'Historique des paiements', flush: true }, txs.length ? UI.table({
      columns: [
        { key: 'date', label: 'Date', sortable: true, render: (r) => FMT.dateTime(r.date) },
        { key: 'tranche', label: 'Objet', render: (r) => 'Tranche ' + r.tranche },
        { key: 'moyen', label: 'Moyen', render: (r) => h('span', { class: 'row-s' }, h('span', { class: 'provider-logo ' + MOYENS[r.moyen].cls, style: { width: '26px', height: '26px', fontSize: '9px' }, 'aria-hidden': 'true' }, MOYENS[r.moyen].short), MOYENS[r.moyen].label) },
        { key: 'reference', label: 'Référence' },
        { key: 'montant', label: 'Montant', num: true, render: (r) => FMT.money(r.montant) },
        { key: 'r', label: '', render: (r) => UI.button({ label: 'Télécharger le reçu', size: 's', variant: 'ghost', icon: 'download', onClick: () => Commun.showDoc('Reçu ' + r.recu, Commun.receiptDoc(r)) }) }
      ], rows: txs, sortKey: 'date', sortDir: 'desc' }) : h('div', { class: 'card-body' }, UI.empty({ title: 'Aucun paiement', text: 'Vos paiements apparaîtront ici avec leur reçu.' }))));
};

/* ======================================================================
   Vue des notes (étudiant et parent) + simulateur de moyenne
   ====================================================================== */
const HISTORIQUE = { s1: { S1: 12.1, S2: 12.65 }, classe: { S1: 11.18, S2: 11.42 } };

function scoreCls(v) { return v === null || v === undefined || typeof v === 'string' ? '' : v < 8 ? 'low' : v < 10 ? 'mid' : 'ok'; }
function scoreEl(v) { return h('span', { class: 'score ' + scoreCls(v) }, FMT.note(v)); }

Commun.notesView = function (sid, opts) {
  const o = opts || {};
  const st = Commun.notes[sid] || (Commun.notes[sid] = { sem: 'S3', session: 'normale', rang: App.store.parametres.rangVisible, open: {} });
  const r = K.result(sid, st.sem, st.session);
  const rank = K.rank(sid, st.sem);
  const rattDispo = st.sem === 'S3';
  const sem4Partial = st.sem === 'S4';

  const header = h('div', { class: 'grid-4' },
    h('div', { class: 'card kpi row', style: { flexDirection: 'row', alignItems: 'center' } }, UI.gauge(r.moy, { size: 104, stroke: 10, label: 'Moyenne du semestre' }),
      h('div', null, h('div', { class: 'kpi-label' }, 'Moyenne du semestre'), h('div', { class: 'small muted' }, r.moy === null ? 'Semestre en cours : moyenne provisoire non calculable' : (r.mention ? 'Mention ' + r.mention : 'Sans mention')))),
    UI.kpi({ label: 'Crédits obtenus', icon: 'award', value: h('span', null, r.complete ? String(r.credits) : '—', h('span', { class: 'of' }, ' / ' + r.total)), foot: h('span', { class: 'grow' }, UI.progress(r.complete ? r.credits : 0, r.total, null, 'Crédits obtenus')) }),
    UI.kpi({ label: 'Rang dans la promotion', icon: 'bars', value: st.rang && rank ? h('span', null, rank.rang + 'e', h('span', { class: 'of' }, ' / ' + rank.sur)) : (st.rang ? '—' : 'Masqué'),
      foot: UI.toggle('Afficher mon rang', st.rang, (v) => { st.rang = v; App.refresh(); }) }),
    UI.kpi({ label: 'Décision', icon: 'scale', value: r.decision ? h('span', null, UI.status(r.decision)) : h('span', null, UI.status('en_cours')),
      foot: r.decision === 'rattrapage' ? h('span', null, 'À repasser : ' + r.ues.filter((u) => u.statut === 'non_validee').map((u) => u.ue.nom).join(', ') + '. ', o.simulateur ? h('button', { type: 'button', class: 'link-btn', onClick: () => document.getElementById('simulateur').scrollIntoView({ behavior: 'smooth' }) }, 'Simuler') : null) : r.decision === 'admis' ? 'Semestre validé' : 'Publication après délibération' }));

  const toolbar = h('div', { class: 'row-between wrap' },
    h('div', { class: 'row-s wrap' }, UI.segmented([{ id: 'S3', label: 'Semestre 3' }, { id: 'S4', label: 'Semestre 4' }], st.sem, (v) => { st.sem = v; if (v === 'S4') st.session = 'normale'; App.refresh(); }, 'Semestre'),
      UI.segmented([{ id: 'normale', label: 'Session normale' }, { id: 'rattrapage', label: 'Rattrapage' }], st.session, (v) => { if (v === 'rattrapage' && !rattDispo) { UI.toast('Le rattrapage du S4 n\'est pas encore organisé.', 'info'); return; } st.session = v; App.refresh(); }, 'Session')),
    o.releve ? UI.button({ label: 'Relevé de notes', icon: 'file', variant: 'secondary', href: o.releve }) : null);

  const evo = (() => {
    const s3 = K.result(sid, 'S3').moy;
    const classS3 = Calc.stats(K.promo().map((s) => K.result(s.id, 'S3').moy)).avg;
    const s4cc = Calc.stats(K.ues('info', 'L2', 'S4').flatMap((u) => u.ecues.map((e) => Calc.cc(K.note(sid, e.id, 'CC1'), K.note(sid, e.id, 'CC2'))))).avg;
    return UI.card({ title: 'Évolution de mes moyennes', actions: h('div', { class: 'legend' }, h('span', null, h('i'), 'Ma moyenne'), h('span', null, h('i', { class: 'alt' }), 'Moyenne de la promotion'), h('span', null, h('i', { class: 'danger' }), 'Seuil de 10')) },
      UI.lineChart({ labels: ['S1', 'S2', 'S3', 'S4 (CC)'], threshold: 10, label: 'Évolution des moyennes semestrielles', showValues: true, width: 420, height: 300, min: 4, max: 20, ticks: [10, 20],
        series: [{ name: 'Ma moyenne', values: [HISTORIQUE.s1.S1, HISTORIQUE.s1.S2, s3, s4cc] }, { name: 'Promotion', alt: true, values: [HISTORIQUE.classe.S1, HISTORIQUE.classe.S2, classS3, null] }] }),
      h('p', { class: 'xsmall muted', style: { marginTop: '6px' } }, 'S1 et S2 : historique de la L1. S4 : moyenne provisoire du contrôle continu.'));
  })();

  const ueList = h('div', null, r.ues.map((u) => UI.accordion({
    open: !!st.open[u.ue.id],
    onToggle: (v) => { st.open[u.ue.id] = v; },
    header: [h('div', { class: 'grow' }, h('div', { class: 'xsmall muted' }, u.ue.id + ' · ' + u.credits + ' crédits'), h('div', { class: 'strong' }, u.ue.nom)),
      h('div', { class: 'row-s' }, scoreEl(u.moy), UI.status(u.statut))],
    content: () => {
      const tbl = h('table', { class: 'table' },
        h('thead', null, h('tr', null, ['ECUE', 'Coef.', 'CC1', 'CC2', 'Examen'].concat(st.session === 'rattrapage' ? ['Rattrapage'] : []).concat(['Moyenne', 'Classe', 'Min / max']).map((t, i) => h('th', { class: i ? 'num' : null, scope: 'col' }, t)))),
        h('tbody', null, u.ecues.map((e) => {
          const cls = K.classEcue(e.ecue.id, st.session);
          const delta = e.moy !== null && cls.avg !== null ? Calc.round2(e.moy - cls.avg) : null;
          return h('tr', null, h('td', null, UI.subject(e.ecue)), h('td', { class: 'num' }, String(e.coef)),
            h('td', { class: 'num' }, scoreEl(e.notes.cc1 ?? null)), h('td', { class: 'num' }, scoreEl(e.notes.cc2 ?? null)), h('td', { class: 'num' }, e.notes.exam === undefined ? h('span', { class: 'muted xsmall' }, sem4Partial ? 'À venir' : '—') : scoreEl(e.notes.exam)),
            st.session === 'rattrapage' ? h('td', { class: 'num' }, e.notes.ratt === undefined ? h('span', { class: 'muted xsmall' }, u.statut === 'non_validee' ? 'À passer' : 'Non concerné') : scoreEl(e.notes.ratt)) : null,
            h('td', { class: 'num' }, h('span', { class: 'row-s', style: { justifyContent: 'flex-end' } }, scoreEl(e.moy), delta !== null ? h('span', { class: 'delta ' + (delta >= 0 ? 'up' : 'down'), title: 'Écart avec la moyenne de la classe' }, icon(delta >= 0 ? 'arrowUp' : 'arrowDown', 12), FMT.num(Math.abs(delta), 2)) : null)),
            h('td', { class: 'num muted' }, FMT.note(cls.avg)), h('td', { class: 'num muted nowrap' }, cls.n ? FMT.note(cls.min) + ' / ' + FMT.note(cls.max) : '—'));
        })));
      return h('div', { class: 'table-wrap', style: { border: 0, borderRadius: 0 } }, tbl);
    }
  })));

  return h('div', { class: 'stack-l' }, toolbar, header,
    h('div', { class: 'grid-main' }, h('div', { class: 'stack' }, h('h2', { class: 'rubric' }, 'Unités d\'enseignement'), ueList), evo),
    o.simulateur ? Commun.simulator(sid) : null);
};

/** Simulateur de moyenne : notes hypothétiques → moyenne, crédits et validation recalculés en direct. */
Commun.simulator = function (sid) {
  const st = Commun.notes['sim-' + sid] || (Commun.notes['sim-' + sid] = { mode: 'S4', values: {} });
  const out = h('div', { 'aria-live': 'polite' });
  const rowsEl = h('div');
  const sem = st.mode === 'S4' ? 'S4' : 'S3';
  const session = st.mode === 'S4' ? 'normale' : 'rattrapage';
  const base = K.result(sid, sem, session);
  const targets = [];
  base.ues.forEach((u) => u.ecues.forEach((e) => {
    if (st.mode === 'S4' && e.notes.exam === undefined) targets.push({ u, e, field: 'exam' });
    if (st.mode === 'RATT' && u.statut === 'non_validee') targets.push({ u, e, field: 'ratt' });
  }));
  const compute = () => {
    const overrides = {};
    targets.forEach((t) => { const v = st.values[st.mode + t.e.ecue.id]; if (v !== undefined && v !== '') overrides[t.e.ecue.id] = { [t.field]: v }; });
    const r = K.result(sid, sem, session, overrides);
    const filled = targets.every((t) => st.values[st.mode + t.e.ecue.id] !== undefined && st.values[st.mode + t.e.ecue.id] !== '');
    clear(out).appendChild(h('div', { class: 'stack' },
      h('div', { class: 'row wrap' }, h('div', { class: 'mini-stat' }, h('b', { class: 'note-big' }, r.moy === null ? '—' : FMT.note(r.moy), h('span', { class: 'of' }, ' / 20')), h('span', null, 'moyenne simulée')),
        h('div', { class: 'stack-s grow' },
          h('div', { class: 'row-s wrap' }, h('span', { class: 'strong' }, 'Crédits : ' + (r.complete ? r.credits : '—') + ' / ' + r.total), r.decision ? UI.status(r.decision) : UI.badge('Saisissez toutes les notes', 'neutral', 'edit')),
          h('div', { class: 'small muted' }, filled ? (r.mention ? 'Mention ' + r.mention : 'Sans mention') : 'Complétez les ' + targets.length + ' notes pour obtenir la décision.'))),
      h('ul', { class: 'list' }, r.ues.map((u) => h('li', { class: 'list-item' }, h('span', { class: 'grow small' }, u.ue.nom), scoreEl(u.moy), UI.status(u.statut))))));
  };
  clear(rowsEl);
  rowsEl.appendChild(h('div', { class: 'sim-row head' }, h('span', null, 'ECUE'), h('span', { class: 'right' }, 'Moy. CC'), h('span', { class: 'right' }, st.mode === 'S4' ? 'Examen ?' : 'Rattrapage ?')));
  targets.forEach((t) => {
    const key = st.mode + t.e.ecue.id;
    const inp = h('input', { class: 'input', inputmode: 'decimal', placeholder: '—', 'aria-label': 'Note hypothétique pour ' + t.e.ecue.nom, value: st.values[key] !== undefined ? String(st.values[key]).replace('.', ',') : '' });
    inp.addEventListener('input', () => {
      const p = Calc.parseNote(inp.value);
      if (!p.ok || p.value === 'DISP') { inp.setAttribute('aria-invalid', 'true'); delete st.values[key]; }
      else { inp.removeAttribute('aria-invalid'); if (p.value === undefined) delete st.values[key]; else st.values[key] = p.value; }
      compute();
    });
    rowsEl.appendChild(h('div', { class: 'sim-row' }, h('span', { class: 'truncate', title: t.e.ecue.nom }, t.e.ecue.nom), h('span', { class: 'right num muted' }, FMT.note(t.e.cc === null ? null : Calc.round2(t.e.cc))), inp));
  });
  if (!targets.length) rowsEl.appendChild(h('p', { class: 'muted small' }, 'Aucune note en attente pour ce scénario.'));
  compute();
  return UI.card({ title: 'Simulateur de moyenne', cls: 'sim', actions: UI.segmented([{ id: 'S4', label: 'Examens du S4' }, { id: 'RATT', label: 'Rattrapage du S3' }], st.mode, (v) => { st.mode = v; App.refresh(); setTimeout(() => { const el = document.getElementById('simulateur'); if (el) el.scrollIntoView(); }, 0); }, 'Scénario') },
    h('div', { id: 'simulateur', class: 'grid-2' },
      h('div', { class: 'stack-s' }, h('p', { class: 'small muted' }, 'Saisissez des notes hypothétiques (0 à 20, au quart de point). Le calcul applique les règles officielles : CC ' + App.store.parametres.ponderationCC + ' %, examen ' + App.store.parametres.ponderationExam + ' %, compensation entre UE.'), rowsEl,
        h('div', { class: 'row-s wrap' },
          UI.button({ label: 'Remplir avec mes moyennes de CC', size: 's', variant: 'secondary', onClick: () => { targets.forEach((t) => { if (t.e.cc !== null) st.values[st.mode + t.e.ecue.id] = Math.round(t.e.cc * 4) / 4; }); App.refresh(); } }),
          UI.button({ label: 'Effacer', size: 's', variant: 'ghost', onClick: () => { Object.keys(st.values).forEach((k) => { if (k.startsWith(st.mode)) delete st.values[k]; }); App.refresh(); } }))),
      out));
};

/* ======================================================================
   Vue des absences (étudiant, parent)
   ====================================================================== */
Commun.absencesView = function (sid, opts) {
  const o = opts || {};
  const stats = K.absenceStats(sid);
  const risks = K.absenceRisks(sid);
  const list = K.absencesOf(sid);
  const ecues = Array.from(new Set(list.map((a) => a.ecueId)));
  return h('div', { class: 'stack-l' },
    risks.map((r) => UI.alert(r.depasse ? 'danger' : 'warning', r.depasse ? 'Seuil d\'absences atteint' : 'Attention au seuil d\'absences',
      K.ecueName(r.ecueId) + ' : ' + r.count + ' absence(s) non justifiée(s) ou en attente sur ' + r.seuil + ' autorisées. ' + (r.depasse ? 'Risque d\'exclusion de l\'examen.' : 'Une absence de plus et vous risquez l\'exclusion de l\'examen.'))),
    h('div', { class: 'grid-4' },
      UI.kpi({ label: 'Absences justifiées', icon: 'checkCircle', value: String(stats.justifiees), countTo: stats.justifiees }),
      UI.kpi({ label: 'Non justifiées', icon: 'alert', value: String(stats.nonJustifiees), countTo: stats.nonJustifiees, foot: stats.enAttente ? stats.enAttente + ' justificatif(s) en attente' : null }),
      UI.kpi({ label: 'Retards', icon: 'clock', value: String(stats.retards), countTo: stats.retards }),
      UI.kpi({ label: 'Taux d\'assiduité', icon: 'userCheck', value: FMT.pct(stats.taux, 1), foot: 'Sur ' + stats.prevues + ' séances depuis le début du S4' })),
    UI.card({ title: 'Historique', flush: true }, UI.table({
      searchKeys: [(r) => K.ecueName(r.ecueId), 'motif'], searchPlaceholder: 'Rechercher une matière…',
      filters: [
        { id: 'ecue', label: 'Toutes les matières', options: ecues.map((e) => ({ value: e, label: K.ecueName(e) })), test: (r, v) => r.ecueId === v },
        { id: 'statut', label: 'Tous les statuts', options: ['justifiee', 'non_justifiee', 'en_attente', 'refusee'].map((k) => ({ value: k, label: STATUS[k][0] })), test: (r, v) => r.statut === v },
        { id: 'type', label: 'Absences et retards', options: [{ value: 'absence', label: 'Absences' }, { value: 'retard', label: 'Retards' }], test: (r, v) => r.type === v }
      ],
      columns: [
        { key: 'date', label: 'Date', sortable: true, render: (r) => FMT.date(r.date) },
        { key: 'ecueId', label: 'Matière', render: (r) => UI.subject(K.ecue(r.ecueId)) },
        { key: 'type', label: 'Type', render: (r) => r.type === 'retard' ? 'Retard (' + r.minutes + ' min)' : 'Absence' },
        { key: 'statut', label: 'Statut', render: (r) => UI.status(r.statut) },
        { key: 'motif', label: 'Motif', render: (r) => r.motif || h('span', { class: 'muted' }, '—') },
        { key: 'act', label: '', render: (r) => o.justify && (r.statut === 'non_justifiee' || r.statut === 'refusee') ? UI.button({ label: 'Justifier', size: 's', variant: 'secondary', onClick: () => Commun.justifyForm(r) }) : (r.piece ? h('span', { class: 'xsmall muted row-s' }, icon('paperclip', 14), r.piece) : null) }
      ], rows: list, sortKey: 'date', sortDir: 'desc', emptyTitle: 'Aucune absence', emptyText: 'Bravo, votre assiduité est parfaite.' })));
};

/** Formulaire de justification d'une absence. */
Commun.justifyForm = function (abs) {
  if (!App.guard('absence.justifier')) return;
  let file = null;
  const motif = UI.field({ label: 'Motif', as: 'select', required: true, options: [{ value: '', label: 'Choisir un motif…' }, 'Maladie', 'Problème de transport', 'Décès dans la famille', 'Convocation administrative', 'Compétition sportive universitaire', 'Autre'].map((x) => typeof x === 'string' ? { value: x, label: x } : x) });
  const com = UI.field({ label: 'Commentaire', as: 'textarea', rows: 3, placeholder: 'Précisions utiles pour la Scolarité (facultatif)', maxlength: 500 });
  const fileErr = h('div', { class: 'field-error', 'aria-live': 'polite' });
  UI.modal({
    title: 'Justifier l\'absence du ' + FMT.date(abs.date),
    body: h('div', { class: 'stack' }, h('div', { class: 'row-s' }, UI.subject(K.ecue(abs.ecueId)), h('span', { class: 'small muted' }, abs.type === 'retard' ? 'Retard de ' + abs.minutes + ' min' : 'Absence')),
      motif.el, h('div', { class: 'field' }, h('span', { class: 'label' }, 'Pièce justificative'), UI.upload({ accept: ['pdf', 'jpg', 'jpeg', 'png'], maxMo: 5, label: 'Certificat, attestation…', demoName: 'certificat-medical.pdf', onFile: (f) => { file = f; clear(fileErr); } }), fileErr), com.el),
    actions: (api) => [UI.button({ label: 'Annuler', variant: 'secondary', onClick: () => api.close() }), UI.button({ label: 'Envoyer le justificatif', icon: 'send', onClick: (e) => {
      let ok = motif.setError(motif.input.value ? null : 'Choisissez un motif.');
      clear(fileErr);
      if (!file) { fileErr.appendChild(document.createTextNode('Joignez une pièce justificative.')); ok = false; }
      if (!ok) return;
      UI.loading(e.currentTarget, 600, () => {
        Object.assign(abs, { statut: 'en_attente', motif: motif.input.value, piece: file.name, commentaire: com.input.value.trim() });
        App.notify('a2', 'absence', 'Nouveau justificatif', K.name(K.user(abs.sid)) + ' — ' + K.ecueName(abs.ecueId) + ' du ' + FMT.date(abs.date) + '.', '#/scolarite/absences');
        App.notify('a1', 'absence', 'Nouveau justificatif', K.name(K.user(abs.sid)) + ' — ' + K.ecueName(abs.ecueId) + '.', '#/scolarite/absences');
        api.close();
        UI.toast('Justificatif envoyé. Statut : en attente de validation par la Scolarité.', 'success');
        App.refresh();
      });
    } })]
  });
};

/* ======================================================================
   Recherche globale
   ====================================================================== */
Commun.searchIndex = function (q) {
  const nq = norm(q);
  const role = App.session.role;
  const me = K.me();
  const match = (...txt) => txt.some((t) => norm(t).includes(nq));
  let ecues = [];
  if (role === 'enseignant') ecues = K.ecuesOfTeacher(me.id);
  else ecues = K.ues('info', 'L2').flatMap((u) => u.ecues.map((e) => Object.assign({ ue: u }, e)));
  const coursRoute = { etudiant: 'notes', parent: 'notes', enseignant: 'notes', scolarite: 'formation' }[role];
  const cours = ecues.filter((e) => match(e.nom, e.id, e.ue.nom)).map((e) => ({ icon: 'book', title: e.nom, meta: e.id + ' · ' + e.ue.semestre, href: '#/' + role + '/' + coursRoute }));
  const resRoute = role === 'parent' ? null : 'ressources';
  const ress = resRoute && role !== 'scolarite' ? App.store.ressources.filter((r) => match(r.titre, K.ecueName(r.ecueId))).map((r) => ({ icon: r.type === 'video' ? 'video' : r.type === 'lien' ? 'link' : 'file', title: r.titre, meta: FMT.size(r.tailleKo), href: '#/' + role + '/ressources' })) : [];
  let people = [];
  if (role === 'scolarite') people = Object.values(App.store.users).filter((u) => u.id !== me.id);
  else if (role === 'enseignant') people = K.promo().concat(K.teachers()).filter((u) => u.id !== me.id);
  else if (role === 'etudiant') people = K.teachers().concat(Object.values(App.store.users).filter((u) => u.role === 'scolarite'));
  else people = Object.values(App.store.users).filter((u) => u.role === 'scolarite');
  const pers = people.filter((u) => match(u.prenom + ' ' + u.nom, u.matricule || '', u.specialite || '')).map((u) => ({ icon: 'user', title: K.name(u, true), meta: u.role === 'etudiant' ? u.matricule : ROLE_LABELS[u.role], href: role === 'scolarite' && u.role === 'etudiant' ? '#/scolarite/etudiants/' + u.id : '#/' + role + '/messages' }));
  const ann = K.annoncesFor(me).filter((a) => match(a.titre, a.texte)).map((a) => ({ icon: 'megaphone', title: a.titre, meta: FMT.date(a.date), href: '#/' + role + '/annonces' }));
  return [{ label: 'Cours', items: cours }, { label: 'Ressources', items: ress }, { label: 'Personnes', items: pers }, { label: 'Annonces', items: ann }];
};

defineScreen(ALL_ROLES, 'recherche', {
  title: 'Recherche',
  render(ctx) {
    const q = ctx.query.get('q') || '';
    const results = h('div', { class: 'stack' });
    const draw = (val) => {
      clear(results);
      if (val.trim().length < 2) { results.appendChild(UI.empty({ title: 'Que cherchez-vous ?', text: 'Saisissez au moins 2 caractères : un cours, une ressource, une personne ou une annonce.' })); return; }
      const groups = Commun.searchIndex(val);
      const total = groups.reduce((a, g) => a + g.items.length, 0);
      results.appendChild(h('p', { class: 'small muted', 'aria-live': 'polite' }, FMT.plural(total, 'résultat') + ' pour « ' + val + ' »'));
      groups.forEach((g) => { if (g.items.length) results.appendChild(UI.card({ title: g.label + ' (' + g.items.length + ')' }, h('div', null, g.items.map((it) => h('a', { class: 'list-btn', href: it.href }, h('span', { class: 'list-icon accent' }, icon(it.icon, 18)), h('span', { class: 'grow' }, h('span', { class: 'list-title', style: { display: 'block' } }, it.title), h('span', { class: 'list-meta' }, it.meta))))))); });
      if (!total) results.appendChild(UI.empty({ title: 'Aucun résultat', text: 'Essayez un autre mot-clé, par exemple « Java », « simplexe » ou un nom.' }));
    };
    const sb = UI.search({ placeholder: 'Rechercher…', value: q, onInput: draw, label: 'Recherche globale' });
    draw(q);
    setTimeout(() => sb.input.focus(), 50);
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Recherche', sub: 'Cours, ressources, personnes et annonces.' }), sb.el, results);
  }
});

/* ======================================================================
   Messagerie
   ====================================================================== */
function convTitle(c, me) {
  if (c.titre) return c.titre;
  const other = K.user(c.participants.find((p) => p !== me));
  return K.name(other, true);
}
function convOther(c, me) { return c.type === 'individuel' ? K.user(c.participants.find((p) => p !== me)) : null; }
/** Règles d'écriture selon le rôle. */
function canWriteIn(c, me) {
  const role = App.session.role;
  if (c.annonce) return role === 'scolarite' || role === 'enseignant' ? (c.admins || []).includes(me) : false;
  return true;
}
function allowedRecipients() {
  const role = App.session.role;
  const me = K.me();
  if (role === 'parent') return Object.values(App.store.users).filter((u) => u.role === 'scolarite');
  if (role === 'etudiant') return K.teachers().concat(Object.values(App.store.users).filter((u) => u.role === 'scolarite')).concat(K.promo().filter((u) => u.id !== me.id));
  return Object.values(App.store.users).filter((u) => u.id !== me.id && u.actif);
}

defineScreen(ALL_ROLES, 'messages', {
  title: 'Messages',
  render() {
    const me = App.session.userId;
    const st = Commun.msg;
    const convs = K.conversationsOf(me);
    if (st.current && !convs.find((c) => c.id === st.current)) st.current = null;
    if (!st.current && !isMobile() && convs[0]) st.current = convs[0].id;
    const chat = h('div', { class: 'chat' + (st.current && isMobile() ? ' show-thread' : '') });
    const listEl = h('div', { class: 'chat-list' });
    const threadEl = h('div', { class: 'chat-thread' });

    const drawList = () => {
      clear(listEl);
      const sb = UI.search({ placeholder: 'Rechercher une conversation', small: true, value: st.q, onInput: (v) => { st.q = v; drawItems(); } });
      listEl.appendChild(h('div', { class: 'chat-list-head' }, sb.el));
      const items = h('div');
      listEl.appendChild(items);
      const drawItems = () => {
        clear(items);
        const filtered = convs.filter((c) => !st.q || norm(convTitle(c, me) + ' ' + c.messages.map((m) => m.text).join(' ')).includes(norm(st.q)));
        if (!filtered.length) items.appendChild(UI.empty({ title: 'Aucune conversation', text: 'Modifiez la recherche.' }));
        filtered.forEach((c) => {
          const last = c.messages[c.messages.length - 1];
          const unread = K.unreadIn(c, me);
          const other = convOther(c, me);
          items.appendChild(h('button', { type: 'button', class: 'conv' + (unread ? ' is-unread' : ''), 'aria-current': String(c.id === st.current), onClick: () => { st.current = c.id; App.refresh(); } },
            other ? UI.avatar(other) : h('span', { class: 'list-icon accent' }, icon('users', 18)),
            h('span', { class: 'grow', style: { minWidth: 0 } },
              h('span', { class: 'row-between' }, h('span', { class: 'ttl small truncate' }, convTitle(c, me)), h('span', { class: 'xsmall muted nowrap' }, FMT.relative(last.date))),
              h('span', { class: 'preview truncate', style: { display: 'block' } }, (last.from === me ? 'Vous : ' : '') + last.text)),
            unread ? h('span', { class: 'count', 'aria-label': unread + ' non lus' }, String(unread)) : null));
        });
      };
      drawItems();
    };

    const drawThread = () => {
      clear(threadEl);
      const c = convs.find((x) => x.id === st.current);
      if (!c) { threadEl.appendChild(h('div', { class: 'state-page' }, UI.empty({ title: 'Sélectionnez une conversation', text: 'Ou démarrez un nouveau message.' }))); return; }
      // Marque comme lu
      let changed = false;
      c.messages.forEach((m) => { if (!m.luPar.includes(me)) { m.luPar.push(me); changed = true; } });
      if (changed) {
        App.store.notifications.forEach((n) => { if (n.uid === me && n.type === 'message' && !n.lu) n.lu = true; });
        setTimeout(() => App.updateBadges(), 0);
        drawList();
      }
      const other = convOther(c, me);
      threadEl.appendChild(h('div', { class: 'chat-head' },
        h('button', { type: 'button', class: 'icon-btn only-mobile', 'aria-label': 'Retour aux conversations', onClick: () => { st.current = null; App.refresh(); } }, icon('arrowLeft', 22)),
        other ? UI.avatar(other) : h('span', { class: 'list-icon accent' }, icon('users', 18)),
        h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'strong small truncate' }, convTitle(c, me)),
          h('div', { class: 'xsmall muted truncate' }, c.type === 'groupe' ? FMT.plural(c.participants.length, 'membre') + (c.annonce ? ' · fil d\'annonces' : '') : (other.role === 'etudiant' ? 'Étudiant·e · ' + other.niveau + ' ' + K.filiere(other.filiere).nom : (other.fonction || other.specialite || ROLE_LABELS[other.role]))))));
      const msgs = h('div', { class: 'chat-msgs', role: 'log', 'aria-label': 'Messages', 'aria-live': 'polite' });
      let lastDay = '';
      c.messages.forEach((m) => {
        const day = m.date.slice(0, 10);
        if (day !== lastDay) { msgs.appendChild(h('div', { class: 'day-sep' }, day === DT.rel(0) ? 'Aujourd\'hui' : day === DT.rel(-1) ? 'Hier' : FMT.dateShort(day))); lastDay = day; }
        const mine = m.from === me;
        const readByAll = c.participants.filter((p) => p !== me).every((p) => m.luPar.includes(p));
        msgs.appendChild(h('div', { class: 'msg ' + (mine ? 'me' : 'them') },
          !mine && c.type === 'groupe' ? h('span', { class: 'author' }, K.name(K.user(m.from))) : null,
          h('div', { class: 'bubble' }, m.text, m.piece ? h('div', { class: 'attach' }, icon('paperclip', 14), m.piece.name + ' · ' + FMT.size(m.piece.sizeKo)) : null),
          h('span', { class: 'meta' }, FMT.time(m.date), mine ? h('span', { class: readByAll ? 'read' : '', title: readByAll ? 'Lu' : 'Envoyé' }, icon(readByAll ? 'checks' : 'check', 14), h('span', { class: 'sr-only' }, readByAll ? 'Lu' : 'Envoyé')) : null)));
      });
      threadEl.appendChild(msgs);
      setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 0);
      if (!canWriteIn(c, me)) {
        threadEl.appendChild(h('div', { class: 'chat-compose' }, UI.alert('neutral', null, 'Fil d\'annonces : seuls les enseignants et la Scolarité peuvent y publier. Répondez en message individuel.')));
        return;
      }
      const ta = h('textarea', { class: 'textarea', rows: '1', placeholder: 'Écrire un message…', 'aria-label': 'Votre message', maxlength: '2000' });
      const pending = h('div', { class: 'pending-file' });
      const drawPending = () => { clear(pending); if (st.draftFile) pending.appendChild(h('div', { class: 'file-chip' }, icon('paperclip', 16), h('span', { class: 'grow truncate' }, st.draftFile.name), UI.button({ label: 'Retirer la pièce jointe', icon: 'x', iconOnly: true, size: 's', variant: 'ghost', onClick: () => { st.draftFile = null; drawPending(); } }))); };
      drawPending();
      const send = () => {
        const text = ta.value.trim();
        if (!text && !st.draftFile) return;
        const msg = { id: 'm' + Date.now(), from: me, text: text || 'Pièce jointe', date: nowStamp(), luPar: [me], piece: st.draftFile };
        c.messages.push(msg);
        st.draftFile = null;
        c.participants.filter((p) => p !== me).slice(0, 40).forEach((p) => App.store.notifications.unshift({ id: 'n' + Date.now() + p, uid: p, type: 'message', titre: 'Message de ' + K.name(K.user(me), true), texte: msg.text.slice(0, 80), date: msg.date, lu: false, lien: '#/' + K.user(p).role + '/messages' }));
        if (App.ui.offline) UI.toast('Message mis en file d\'attente : il partira au retour de la connexion.', 'warning');
        drawThread(); drawList();
        // Accusé de lecture simulé
        setTimeout(() => { c.participants.forEach((p) => { if (!msg.luPar.includes(p)) msg.luPar.push(p); }); if (Commun.msg.current === c.id && threadEl.isConnected) drawThread(); }, App.ui.offline ? 600000 : 1800);
        setTimeout(() => { const t = threadEl.querySelector('textarea'); if (t) t.focus(); }, 0);
      };
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
      ta.addEventListener('input', () => { ta.style.height = '44px'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; });
      threadEl.appendChild(h('div', { class: 'chat-compose' }, pending,
        UI.button({ label: 'Joindre un fichier', icon: 'paperclip', iconOnly: true, variant: 'ghost', onClick: () => {
          UI.modal({ title: 'Joindre un fichier', body: (api) => UI.upload({ accept: ['pdf', 'jpg', 'jpeg', 'png', 'docx', 'zip'], maxMo: 10, demoName: 'document.pdf', onFile: (f) => { st.draftFile = f; drawPending(); setTimeout(() => api.close(), 400); } }) });
        } }),
        ta, UI.button({ label: 'Envoyer', icon: 'send', iconOnly: true, onClick: send })));
    };

    function newConversation() {
      const role = App.session.role;
      const recips = allowedRecipients();
      const sel = UI.field({ label: 'Destinataire', as: 'select', required: true, options: [{ value: '', label: 'Choisir…' }].concat(recips.map((u) => ({ value: u.id, label: K.name(u, true) + ' — ' + (u.role === 'etudiant' ? 'Étudiant·e ' + u.niveau : u.fonction || u.specialite || ROLE_LABELS[u.role]) }))) });
      const groups = role === 'enseignant' || role === 'scolarite';
      const grp = groups ? UI.field({ label: 'Ou écrire à un groupe', as: 'select', options: [{ value: '', label: '—' }, { value: 'cv3', label: 'L2 Info — Groupe A' }, { value: 'cv4', label: 'L2 Informatique — Promotion' }] }) : null;
      const txt = UI.field({ label: 'Message', as: 'textarea', rows: 4, required: true, maxlength: 2000 });
      UI.modal({
        title: 'Nouveau message',
        body: h('div', { class: 'stack' }, sel.el, grp ? grp.el : null, txt.el,
          role === 'etudiant' ? UI.alert('neutral', null, 'Les étudiants peuvent écrire aux enseignants, à la Scolarité et à leurs camarades, mais pas à toute une promotion.') : null,
          role === 'parent' ? UI.alert('neutral', null, 'En tant que parent, vous pouvez écrire au service de la Scolarité.') : null),
        actions: (api) => [UI.button({ label: 'Annuler', variant: 'secondary', onClick: () => api.close() }), UI.button({ label: 'Envoyer', icon: 'send', onClick: () => {
          const target = grp && grp.input.value ? grp.input.value : sel.input.value;
          let ok = (grp && grp.input.value) || sel.setError(sel.input.value ? null : 'Choisissez un destinataire.');
          ok = txt.setError(txt.input.value.trim() ? null : 'Le message est vide.') && ok;
          if (!ok) return;
          if (grp && grp.input.value && !can('message.groupe')) { App.guard('message.groupe'); return; }
          let c = App.store.conversations.find((x) => x.id === target) || App.store.conversations.find((x) => x.type === 'individuel' && x.participants.includes(me) && x.participants.includes(target));
          if (!c) { c = { id: 'cv' + Date.now(), type: 'individuel', titre: null, participants: [me, target], messages: [] }; App.store.conversations.push(c); }
          if (!c.participants.includes(me)) c.participants.push(me);
          c.messages.push({ id: 'm' + Date.now(), from: me, text: txt.input.value.trim(), date: nowStamp(), luPar: [me] });
          st.current = c.id; api.close(); UI.toast('Message envoyé.', 'success'); App.refresh();
        } })]
      });
    }

    drawList(); drawThread();
    chat.appendChild(listEl); chat.appendChild(threadEl);
    return h('div', { class: 'stack' }, UI.pageHead({ title: 'Messages', sub: 'Échanges avec les enseignants, la Scolarité et les groupes.', actions: UI.button({ label: 'Nouveau message', icon: 'plus', onClick: newConversation }) }), chat);
  }
});

/* ======================================================================
   Notifications
   ====================================================================== */
const NOTIF_ICONS = { note: ['award', 'accent'], cours: ['calendar', 'warning'], paiement: ['wallet', 'success'], message: ['message', 'info'], absence: ['clock', 'danger'], annonce: ['megaphone', ''], devoir: ['book', 'info'], examen: ['exam', 'warning'], ressource: ['folder', ''] };
const NOTIF_LABELS = { note: 'Notes', cours: 'Cours', paiement: 'Paiements', message: 'Messages', absence: 'Absences', annonce: 'Annonces', devoir: 'Devoirs', examen: 'Examens', ressource: 'Ressources' };

defineScreen(ALL_ROLES, 'notifications', {
  title: 'Notifications',
  render() {
    const me = App.session.userId;
    const st = Commun.notif;
    const all = K.notifsOf(me);
    const types = Array.from(new Set(all.map((n) => n.type)));
    const list = all.filter((n) => st.filtre === 'toutes' || (st.filtre === 'non_lues' ? !n.lu : n.type === st.filtre));
    const unread = all.filter((n) => !n.lu).length;
    const chips = h('div', { class: 'chip-row', role: 'group', 'aria-label': 'Filtrer les notifications' },
      [['toutes', 'Toutes'], ['non_lues', 'Non lues (' + unread + ')']].concat(types.map((t) => [t, NOTIF_LABELS[t] || t])).map(([id, label]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(st.filtre === id), onClick: () => { st.filtre = id; App.refresh(); } }, label)));
    return h('div', { class: 'stack-l' },
      UI.pageHead({ title: 'Notifications', sub: unread ? FMT.plural(unread, 'notification non lue', 'notifications non lues') : 'Vous êtes à jour.', actions: UI.button({ label: 'Tout marquer comme lu', icon: 'checks', variant: 'secondary', disabled: !unread, onClick: () => { all.forEach((n) => { n.lu = true; }); UI.toast('Toutes les notifications sont marquées comme lues.', 'success'); App.refresh(); } }) }),
      chips,
      UI.card({ ariaLabel: 'Liste des notifications' }, list.length ? h('ul', { class: 'list' }, list.map((n) => {
        const [ic, tone] = NOTIF_ICONS[n.type] || ['bell', ''];
        return h('li', null, h('a', { class: 'list-btn', href: n.lien || '#', onClick: () => { n.lu = true; } },
          h('span', { class: 'list-icon ' + tone }, icon(ic, 20)),
          h('span', { class: 'grow' }, h('span', { class: 'list-title row-s', style: { display: 'flex' } }, n.lu ? null : h('span', { class: 'unread-dot', 'aria-label': 'Non lue' }), n.titre), h('span', { class: 'list-meta', style: { display: 'block' } }, n.texte)),
          h('span', { class: 'xsmall muted nowrap' }, FMT.relative(n.date))));
      })) : UI.empty({ title: 'Aucune notification', text: 'Rien à signaler pour ce filtre.' })),
      UI.alert('info', 'Notifications SMS', 'Les notes, les cours annulés et les paiements sont aussi envoyés par SMS aux étudiants peu connectés. Réglez vos canaux dans Profil et paramètres.'));
  }
});

/* ======================================================================
   Annonces (lecture) — la Scolarité dispose de son propre écran de gestion
   ====================================================================== */
Commun.annonceCard = function (a) {
  return h('button', { type: 'button', class: 'card card-link card-pad', style: { textAlign: 'left', width: '100%', color: 'inherit' }, onClick: () => UI.drawer({
    title: a.titre,
    body: h('div', { class: 'stack' }, h('div', { class: 'row-s wrap' }, UI.badge(a.categorie, 'accent'), a.epingle ? UI.badge('Épinglée', 'warning', 'pin') : null),
      h('p', { class: 'small muted' }, 'Publiée le ' + FMT.dateTime(a.date) + ' par ' + K.name(K.user(a.auteur), true)), h('p', null, a.texte),
      h('div', { class: 'row-s wrap small muted' }, 'Diffusée par : ', a.canaux.map((c) => UI.badge({ appli: 'Application', sms: 'SMS', email: 'E-mail' }[c], 'neutral', c === 'sms' ? 'sms' : c === 'email' ? 'mail' : 'smartphone')))),
    actions: (api) => [UI.button({ label: 'Fermer', variant: 'secondary', onClick: () => api.close() })]
  }) },
  h('div', { class: 'row-s wrap', style: { marginBottom: '8px' } }, UI.badge(a.categorie, 'accent'), a.epingle ? UI.badge('Épinglée', 'warning', 'pin') : null, h('span', { class: 'xsmall muted' }, FMT.relative(a.date))),
  h('div', { class: 'strong' }, a.titre), h('p', { class: 'small muted', style: { marginTop: '4px' } }, a.texte.length > 140 ? a.texte.slice(0, 140) + '…' : a.texte));
};

defineScreen(['etudiant', 'enseignant', 'parent'], 'annonces', {
  title: 'Annonces',
  render(ctx) {
    const list = K.annoncesFor(ctx.me);
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Annonces', sub: 'Informations officielles de l\'université et de votre filière.' }),
      list.length ? h('div', { class: 'grid-2' }, list.map(Commun.annonceCard)) : UI.empty({ title: 'Aucune annonce' }));
  }
});

/* ======================================================================
   Profil et paramètres
   ====================================================================== */
defineScreen(ALL_ROLES, 'profil', {
  title: 'Profil et paramètres',
  render(ctx) {
    const me = ctx.me;
    const tel = UI.field({ label: 'Téléphone (SMS)', value: me.tel, type: 'tel', inputmode: 'tel', hint: 'Format : +226 XX XX XX XX' });
    const mail = UI.field({ label: 'E-mail', value: me.email, type: 'email', readonly: me.role !== 'parent', hint: me.role !== 'parent' ? 'Adresse institutionnelle, modifiable par la Scolarité.' : null });
    const infos = UI.card({ title: 'Informations personnelles' }, h('div', { class: 'stack' },
      h('div', { class: 'row wrap' }, UI.avatar(me, 'xl'), h('div', { class: 'stack-s' }, h('div', { class: 'strong' }, K.name(me, true)),
        h('div', { class: 'small muted' }, me.role === 'etudiant' ? me.matricule + ' · ' + K.filiere(me.filiere).nom + ' ' + me.niveau + ' · Groupe ' + me.groupe : (me.fonction || me.specialite || ROLE_LABELS[me.role])),
        UI.button({ label: 'Changer la photo', size: 's', variant: 'secondary', icon: 'upload', onClick: () => UI.modal({ title: 'Photo de profil', body: (api) => UI.upload({ accept: ['jpg', 'jpeg', 'png'], maxMo: 2, demoName: 'photo.jpg', demoKo: 340, onFile: () => { setTimeout(() => { api.close(); UI.toast('Photo envoyée pour validation par la Scolarité (simulation).', 'success'); }, 400); } }) }) }))),
      h('div', { class: 'form-grid cols-2' }, tel.el, mail.el),
      h('div', { class: 'form-actions' }, UI.button({ label: 'Enregistrer', onClick: () => {
        if (!tel.setError(Calc.phoneOk(tel.input.value) ? null : 'Numéro invalide (ex. +226 70 12 45 12).')) return;
        me.tel = tel.input.value.trim(); UI.toast('Coordonnées mises à jour.', 'success');
      } }))));

    const cur = UI.field({ label: 'Mot de passe actuel', type: 'password', autocomplete: 'current-password' });
    const n1 = UI.field({ label: 'Nouveau mot de passe', type: 'password', autocomplete: 'new-password', hint: '10 caractères minimum, avec majuscule, chiffre et caractère spécial.' });
    const n2 = UI.field({ label: 'Confirmation', type: 'password', autocomplete: 'new-password' });
    const securite = UI.card({ title: 'Sécurité' }, h('div', { class: 'stack' },
      h('div', { class: 'form-grid cols-3' }, cur.el, n1.el, n2.el),
      h('div', { class: 'form-actions' }, UI.button({ label: 'Changer le mot de passe', variant: 'secondary', onClick: () => {
        let ok = cur.setError(cur.input.value === DEMO_PASSWORD ? null : 'Mot de passe actuel incorrect.');
        ok = n1.setError(passwordScore(n1.input.value).score >= 3 && n1.input.value.length >= 10 ? null : 'Mot de passe trop faible.') && ok;
        ok = n2.setError(n2.input.value === n1.input.value && n2.input.value ? null : 'Les mots de passe ne correspondent pas.') && ok;
        if (!ok) return;
        [cur, n1, n2].forEach((f) => { f.input.value = ''; });
        UI.toast('Mot de passe modifié. Les autres sessions ont été déconnectées.', 'success');
      } })),
      h('hr', { class: 'divider' }),
      UI.toggle('Double authentification par SMS', true, (v) => UI.toast(v ? 'Double authentification activée.' : 'Désactivation refusée : la double authentification est obligatoire pour les comptes de cet établissement.', v ? 'success' : 'warning'), { desc: 'Un code est envoyé au ' + me.tel.slice(0, 8) + ' •• ' + me.tel.slice(-2) + ' à chaque nouvelle connexion.' }),
      h('hr', { class: 'divider' }),
      h('h3', { style: { fontSize: '15px' } }, 'Sessions actives'),
      h('ul', { class: 'list' }, App.store.sessionsActives.map((se) => h('li', { class: 'list-item wrap' }, h('span', { class: 'list-icon' }, icon(se.appareil.includes('Android') ? 'smartphone' : 'monitor', 20)),
        h('div', { class: 'grow' }, h('div', { class: 'list-title' }, se.appareil), h('div', { class: 'list-meta' }, se.lieu + ' · ' + (se.courante ? 'Session actuelle' : 'Dernière activité ' + FMT.relative(se.derniere)))),
        se.courante ? UI.badge('Cet appareil', 'accent') : UI.button({ label: 'Déconnecter', size: 's', variant: 'secondary', onClick: () => { App.store.sessionsActives = App.store.sessionsActives.filter((x) => x.id !== se.id); UI.toast('Session « ' + se.appareil + ' » déconnectée à distance.', 'success'); App.refresh(); } }))))));

    const prefs = App.store.prefsNotif;
    const prefTable = h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Événement'), ['Application', 'SMS', 'E-mail'].map((c) => h('th', { scope: 'col', class: 'center' }, c)))),
      h('tbody', null, Object.keys(prefs).map((type) => h('tr', null, h('td', null, NOTIF_LABELS[type]), ['appli', 'sms', 'email'].map((canal) => h('td', { class: 'center' },
        h('div', { style: { display: 'inline-flex' } }, UI.toggle(null, prefs[type][canal], (v) => { prefs[type][canal] = v; UI.toast('Préférence enregistrée.', 'success'); }, { ariaLabel: NOTIF_LABELS[type] + ' par ' + canal, disabled: canal === 'appli' && type === 'paiement' })))))))));
    const preferences = UI.card({ title: 'Préférences de notification' }, h('div', { class: 'stack' }, h('p', { class: 'small muted' }, 'Le SMS est recommandé si votre connexion Internet est irrégulière.'), prefTable));

    const affichage = UI.card({ title: 'Affichage et données' }, h('div', { class: 'stack' },
      h('div', { class: 'form-grid cols-2' },
        UI.field({ label: 'Langue', as: 'select', value: 'fr', options: [{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English (bientôt)', disabled: true }] }).el,
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Thème'), UI.segmented([{ id: 'light', label: 'Clair' }, { id: 'dark', label: 'Sombre' }], App.ui.theme, (v) => { App.setTheme(v); App.refresh(); }, 'Thème'))),
      UI.toggle('Mode économie de données', App.ui.dataSaver, (v) => { App.setDataSaver(v); UI.toast(v ? 'Économie de données activée : images et vidéos masquées, chargements allégés.' : 'Économie de données désactivée.', 'info'); },
        { desc: 'Masque les images décoratives et les aperçus vidéo, réduit les données téléchargées. Recommandé en 3G.' })));

    const consent = me.role === 'parent' ? UI.alert('info', 'Accès avec consentement', K.user(me.enfant).prenom + ', étudiante majeure, a autorisé votre accès en lecture le ' + FMT.date(App.store.consentement[me.enfant].date) + ' (notes, absences, paiements). Elle peut le retirer à tout moment.') : null;

    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Profil et paramètres', actions: UI.button({ label: 'Se déconnecter', icon: 'logout', variant: 'secondary', onClick: () => App.logout() }) }),
      consent, infos, securite, preferences, affichage);
  }
});

/* ======================================================================
   Pages d'état : 404 et accès refusé
   ====================================================================== */
defineScreen('commun', '404', {
  title: 'Page introuvable',
  render(ctx) {
    return h('div', { class: 'state-page' }, h('div', { class: 'stack', style: { alignItems: 'center', maxWidth: '460px' } }, h('div', { class: 'code' }, '404'),
      h('h1', null, 'Cette page n\'existe pas'), h('p', { class: 'muted' }, 'Le lien « #/' + (ctx.path || '') + ' » ne correspond à aucun écran.'),
      UI.button({ label: 'Retour à l\'accueil', icon: 'home', href: '#/' + ctx.role + '/accueil' })));
  }
});
defineScreen('commun', 'acces-refuse', {
  title: 'Accès refusé',
  render(ctx) {
    return h('div', { class: 'state-page' }, h('div', { class: 'stack', style: { alignItems: 'center', maxWidth: '500px' } },
      h('div', { class: 'success-check', style: { background: 'var(--danger-bg)', color: 'var(--danger-ink)' } }, icon('lock', 34)),
      h('h1', null, 'Accès refusé'), h('p', { class: 'muted' }, 'Votre rôle (' + ROLE_LABELS[ctx.role] + ') ne permet pas d\'ouvrir « ' + ctx.denied + ' ». La tentative a été bloquée par le contrôle d\'accès.'),
      UI.button({ label: 'Retour à mon espace', icon: 'home', href: '#/' + ctx.role + '/accueil' })));
  }
});

/* ======================================================================
   Page cachée : bibliothèque de composants (#/demo/composants)
   ====================================================================== */
defineScreen('public', 'composants', {
  title: 'Composants',
  render() {
    const sec = (title, ...children) => UI.card({ title }, h('div', { class: 'stack' }, children));
    const ecue = { nom: 'Bases de données avancées', couleur: 2 };
    const rows = [{ n: 'Awa Ouédraogo', m: 14.5, s: 'validee' }, { n: 'Ibrahim Sawadogo', m: 9.25, s: 'compensee' }, { n: 'Rasmané Kaboré', m: 6.75, s: 'non_validee' }, { n: 'Salimata Traoré', m: 12, s: 'validee' }];
    const field = UI.field({ label: 'Champ texte', placeholder: 'Saisir…', hint: 'Texte d\'aide' });
    const fieldErr = UI.field({ label: 'Champ en erreur', value: '25', error: 'La note doit être comprise entre 0 et 20' });
    let tab = 'a';
    const tabsWrap = h('div');
    const drawTabs = () => { clear(tabsWrap).appendChild(UI.tabs([{ id: 'a', label: 'À faire', count: 3 }, { id: 'b', label: 'Rendus' }, { id: 'c', label: 'Cahier de textes' }], tab, (v) => { tab = v; drawTabs(); })); };
    drawTabs();
    return h('div', { style: { padding: '24px 16px', maxWidth: '1200px', margin: '0 auto' } }, h('div', { class: 'stack-l' },
      h('div', { class: 'row-between wrap' }, h('div', { class: 'row' }, UI.logo(40), h('div', null, h('h1', null, 'Bibliothèque de composants'), h('p', { class: 'muted small' }, 'Page cachée de vérification du design system Kalanso.'))),
        UI.button({ label: 'Retour', href: '#/bienvenue', variant: 'secondary', icon: 'arrowLeft' })),
      h('div', { class: 'grid-2' },
        sec('Boutons', h('div', { class: 'row wrap' }, UI.button({ label: 'Primaire' }), UI.button({ label: 'Secondaire', variant: 'secondary' }), UI.button({ label: 'Fantôme', variant: 'ghost' }), UI.button({ label: 'Danger', variant: 'danger' })),
          h('div', { class: 'row wrap' }, UI.button({ label: 'Petit', size: 's' }), UI.button({ label: 'Avec icône', icon: 'download', size: 's', variant: 'secondary' }), UI.button({ label: 'Rechercher', icon: 'search', iconOnly: true, variant: 'secondary' }),
            UI.button({ label: 'Chargement 2 s', variant: 'secondary', onClick: (e) => UI.loading(e.currentTarget, 2000) }), UI.button({ label: 'Désactivé', disabled: true }))),
        sec('Champs', field.el, fieldErr.el, UI.field({ label: 'Liste', as: 'select', options: [{ value: 1, label: 'Informatique' }, { value: 2, label: 'Droit' }] }).el, UI.datePicker({ label: 'Sélecteur de date', value: DT.rel(0) }).el,
          h('div', { class: 'row wrap' }, UI.checkbox('Case à cocher', true), UI.toggle('Interrupteur', true))),
        sec('Pastilles', h('div', { class: 'row wrap' }, ['validee', 'compensee', 'non_validee', 'en_attente', 'payee', 'retard', 'annule', 'deplace', 'salle', 'soumise'].map((k) => UI.status(k))),
          h('div', { class: 'row wrap' }, [0, 1, 2, 3, 4, 5, 6, 7].map((i) => UI.subject({ nom: ['Algorithmique', 'Java', 'Bases de données', 'Web', 'Réseaux', 'Sécurité', 'Mathématiques', 'Anglais'][i], couleur: i })))),
        sec('Avatars, progression, jauge', h('div', { class: 'row wrap' }, ['Awa Ouédraogo', 'Issouf Sawadogo', 'Mariam Compaoré'].map((n) => UI.avatar({ prenom: n.split(' ')[0], nom: n.split(' ')[1] }, 'l')), UI.avatar({ prenom: 'Karim', nom: 'Ouédraogo' })),
          UI.progress(62, 100, null, 'Progression'), UI.progress(30, 100, 'warn', 'Progression'), h('div', { class: 'row wrap' }, UI.gauge(13.42), UI.gauge(9.1, { size: 110 }), UI.gauge(6.2, { size: 90, stroke: 8 })))),
      h('div', { class: 'grid-4' }, UI.kpi({ label: 'Étudiants inscrits', icon: 'users', value: '5 079', countTo: 5079, foot: h('span', { class: 'trend-up' }, icon('arrowUp', 12), '+4,2 %') }),
        UI.kpi({ label: 'Recouvrement', icon: 'wallet', value: '78 %', foot: 'Objectif 85 %' }), UI.kpi({ label: 'Assiduité', icon: 'userCheck', value: '93,4 %' }), UI.kpi({ label: 'Notes en attente', icon: 'checks', value: '2' })),
      sec('Onglets, fil d\'Ariane, recherche, menu', tabsWrap, UI.breadcrumb([{ label: 'Scolarité', href: '#/demo/composants' }, { label: 'Étudiants', href: '#/demo/composants' }, { label: 'Awa Ouédraogo' }]),
        h('div', { class: 'row wrap' }, h('div', { class: 'grow' }, UI.search({ placeholder: 'Barre de recherche' }).el),
          UI.dropdown(UI.button({ label: 'Menu déroulant', variant: 'secondary', iconRight: 'chevronDown' }), [{ label: 'Modifier', icon: 'edit', onClick: () => UI.toast('Modifier', 'info') }, { label: 'Supprimer', icon: 'trash', danger: true, onClick: () => UI.toast('Supprimé', 'error') }])),
        UI.pagination(2, 5, 48, () => UI.toast('Changement de page', 'info'))),
      sec('Tableau triable et filtrable', UI.table({ searchKeys: ['n'], filters: [{ id: 's', label: 'Tous les statuts', options: [{ value: 'validee', label: 'Validée' }, { value: 'non_validee', label: 'Non validée' }], test: (r, v) => r.s === v }],
        columns: [{ key: 'n', label: 'Étudiant', sortable: true }, { key: 'm', label: 'Moyenne', sortable: true, num: true, render: (r) => FMT.note(r.m) }, { key: 's', label: 'Statut', render: (r) => UI.status(r.s) }], rows, pageSize: 3 })),
      h('div', { class: 'grid-2' },
        sec('Graphique en barres', UI.barChart({ label: 'Distribution', data: [{ label: '0-5', value: 2 }, { label: '5-8', value: 5, tone: 'warn' }, { label: '8-10', value: 7, tone: 'warn' }, { label: '10-12', value: 12 }, { label: '12-14', value: 9 }, { label: '14-20', value: 5 }] })),
        sec('Graphique en courbe', UI.lineChart({ labels: ['S1', 'S2', 'S3', 'S4'], threshold: 10, series: [{ name: 'Moyenne', values: [12.1, 12.65, 11.84, 13.2] }, { name: 'Classe', alt: true, values: [11.2, 11.4, 11.1, 11.6] }] }))),
      h('div', { class: 'grid-3' },
        sec('Modale, tiroir, toast', h('div', { class: 'row wrap' },
          UI.button({ label: 'Modale', variant: 'secondary', onClick: () => UI.modal({ title: 'Exemple de modale', body: h('p', null, 'Le focus est piégé ; Échap ferme.'), actions: (api) => [UI.button({ label: 'Fermer', onClick: () => api.close() })] }) }),
          UI.button({ label: 'Tiroir', variant: 'secondary', onClick: () => UI.drawer({ title: 'Tiroir latéral', body: h('p', null, 'Contenu du tiroir.') }) }),
          UI.button({ label: 'Toast', variant: 'secondary', onClick: () => UI.toast('Opération réussie.', 'success', 'Toast') }))),
        sec('Téléversement simulé', UI.upload({ onFile: (f) => UI.toast(f.name + ' accepté', 'success') })),
        sec('QR code simulé', h('div', { class: 'qr-box' }, UI.qr('demo', 160)))),
      h('div', { class: 'grid-3' }, sec('État vide', UI.empty({ title: 'Aucun devoir', text: 'Tout est rendu.' })), sec('Squelette de chargement', UI.skeleton()), sec('Alertes', UI.alert('danger', 'Erreur', 'Tranche en retard.'), UI.alert('warning', null, 'Seuil d\'absences proche.'), UI.alert('success', null, 'Paiement reçu.'), UI.alert('info', null, ecue.nom)))));
  }
});

/* ======================================================================
   Espace Parent / tuteur (lecture seule, avec le consentement de l'étudiante majeure)
   ====================================================================== */
function consentBanner(me) {
  const child = K.user(me.enfant);
  const c = App.store.consentement[child.id];
  return UI.alert('info', 'Accès en lecture seule', child.prenom + ', étudiante majeure, a donné son consentement le ' + FMT.date(c.date) + ' pour partager ses notes, absences et paiements. Elle peut le retirer à tout moment depuis son profil.');
}

defineScreen('parent', 'accueil', {
  title: 'Synthèse',
  render(ctx) {
    const me = ctx.me;
    const child = K.user(me.enfant);
    const r3 = K.result(child.id, 'S3');
    const abs = K.absenceStats(child.id);
    const sum = K.paymentSummary(child.id);
    const exams = App.store.examens.filter((e) => e.date >= DT.rel(0) && (e.session === 'normale' || r3.ues.some((u) => u.statut === 'non_validee' && u.ue.ecues.some((x) => x.id === e.ecueId)))).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
    return h('div', { class: 'stack-l' },
      h('div', { class: 'hello' }, h('div', null, h('p', { class: 'date' }, capitalize(FMT.dateLong(DT.rel(0)))), h('h1', null, 'Bonjour, ' + K.name(me, true))),
        h('div', { class: 'row-s' }, UI.avatar(child), h('div', null, h('div', { class: 'strong small' }, child.prenom + ' ' + child.nom), h('div', { class: 'xsmall muted' }, child.niveau + ' ' + K.filiere(child.filiere).nom + ' · ' + child.matricule)))),
      consentBanner(me),
      sum.retard.length ? UI.alert('danger', 'Tranche en retard', sum.retard[0].libelle + ' : ' + FMT.money(sum.retard[0].reste) + ' depuis le ' + FMT.date(sum.retard[0].echeance) + '. Vous pouvez la régler pour ' + child.prenom + '.', UI.button({ label: 'Payer pour ' + child.prenom, size: 's', onClick: () => Commun.payFlow(child.id, sum.retard[0].n) })) : null,
      h('div', { class: 'grid-3' },
        UI.card({ title: 'Résultats du semestre 3', actions: UI.status(r3.decision) }, h('div', { class: 'row wrap', style: { justifyContent: 'space-around' } }, h('div', { class: 'mini-stat' }, h('b', { class: 'note-big' }, FMT.note(r3.moy), h('span', { class: 'of' }, ' / 20')), h('span', null, 'moyenne')),
          h('div', { class: 'stack-s' }, h('div', { class: 'mini-stat' }, h('b', null, String(r3.credits), h('span', { class: 'of' }, ' / ' + r3.total)), h('span', null, 'crédits')), UI.button({ label: 'Voir les notes', size: 's', variant: 'ghost', href: '#/parent/notes' })))),
        UI.card({ title: 'Assiduité' }, h('div', { class: 'stack' }, h('div', { class: 'note-big' }, FMT.pct(abs.taux, 1)), UI.progress(abs.taux, 100, abs.taux < 90 ? 'warn' : null, 'Assiduité'),
          h('div', { class: 'small muted' }, abs.justifiees + ' absence(s) justifiée(s) · ' + abs.nonJustifiees + ' non justifiée(s) · ' + abs.retards + ' retard(s)'), UI.button({ label: 'Détail des absences', size: 's', variant: 'ghost', href: '#/parent/absences' }))),
        UI.card({ title: 'Frais de scolarité' }, h('div', { class: 'stack' }, h('div', { class: 'note-big' }, FMT.money(sum.reste)), h('div', { class: 'small muted' }, 'reste à payer sur ' + FMT.money(sum.total)),
          UI.progress(sum.paye, sum.total, sum.retard.length ? 'danger' : null, 'Payé'), UI.button({ label: 'Échéancier et reçus', size: 's', variant: 'ghost', href: '#/parent/paiements' })))),
      h('div', { class: 'grid-2' },
        UI.card({ title: 'Prochains examens' }, h('ul', { class: 'list' }, exams.map((e) => h('li', { class: 'list-item' }, h('div', { class: 'event-date' }, h('span', null, FMT.monthShort(DT.parse(e.date))), h('b', null, String(DT.parse(e.date).getDate()))),
          h('div', { class: 'grow' }, h('div', { class: 'list-title' }, K.ecueName(e.ecueId)), h('div', { class: 'list-meta' }, FMT.hhmm(e.heure) + ' · ' + K.salle(e.salle).nom)), e.session === 'rattrapage' ? UI.status('rattrapage') : null)))),
        UI.card({ title: 'Dernières notifications', actions: UI.button({ label: 'Toutes', size: 's', variant: 'ghost', href: '#/parent/notifications' }) }, h('ul', { class: 'list' }, K.notifsOf(me.id).slice(0, 4).map((n) => h('li', { class: 'list-item' },
          h('span', { class: 'list-icon ' + ((NOTIF_ICONS[n.type] || [])[1] || '') }, icon((NOTIF_ICONS[n.type] || ['bell'])[0], 18)), h('div', { class: 'grow' }, h('div', { class: 'list-title' }, n.titre), h('div', { class: 'list-meta' }, n.texte)), h('span', { class: 'xsmall muted nowrap' }, FMT.relative(n.date))))))));
  }
});

defineScreen('parent', 'notes', {
  title: 'Notes',
  render(ctx) {
    const child = K.user(ctx.me.enfant);
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Notes de ' + child.prenom, sub: 'Consultation en lecture seule.' }), consentBanner(ctx.me), Commun.notesView(child.id, {}));
  }
});

defineScreen('parent', 'absences', {
  title: 'Absences',
  render(ctx) {
    const child = K.user(ctx.me.enfant);
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Absences de ' + child.prenom, sub: 'Les justificatifs sont déposés par l\'étudiante elle-même.' }), consentBanner(ctx.me), Commun.absencesView(child.id, {}));
  }
});

defineScreen('parent', 'paiements', {
  title: 'Paiements',
  render(ctx) {
    const child = K.user(ctx.me.enfant);
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Paiements de ' + child.prenom, sub: 'Vous pouvez régler une tranche par Orange Money ou Moov Money ; le reçu est au nom de l\'étudiante.' }), consentBanner(ctx.me), Commun.paymentsView(child.id));
  }
});

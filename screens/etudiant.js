'use strict';
/*
 * Espace Étudiant — étudiante de démo : Awa Ouédraogo, L2 Informatique (UHO-2025-04817).
 */
const Etu = { devoirsTab: 'afaire', resType: 'tous', resEcue: '', resQ: '', releve: { sem: 'S3', session: 'normale' } };
const EVAL_LABELS = { CC1: 'Contrôle continu 1', CC2: 'Contrôle continu 2', EXAM: 'Examen', RATT: 'Rattrapage' };

/** Libellé de compte à rebours vers un cours. */
function countdownText(c) {
  const now = new Date();
  const start = DT.toDate(c.date, c.debut); const end = DT.toDate(c.date, c.fin);
  if (now >= start && now < end) return 'En cours · fin dans ' + Math.ceil((end - now) / 60000) + ' min';
  const min = Math.round((start - now) / 60000);
  if (min < 60) return 'Dans ' + min + ' min';
  if (c.date === DT.rel(0)) return 'Dans ' + Math.floor(min / 60) + ' h ' + DT.pad(min % 60);
  if (c.date === DT.rel(1)) return 'Demain à ' + FMT.hhmm(c.debut);
  return capitalize(FMT.weekday(c.date)) + ' à ' + FMT.hhmm(c.debut);
}

/** Bandeau compact de l'emploi du temps du jour. */
function dayStrip(sessions, onOpen) {
  if (!sessions.length) return UI.empty({ title: 'Pas de cours aujourd\'hui', text: 'Consultez l\'emploi du temps de la semaine.' });
  const now = new Date();
  return h('div', { class: 'strip', role: 'list' }, sessions.map((c) => {
    const past = DT.toDate(c.date, c.fin) < now; const live = DT.toDate(c.date, c.debut) <= now && !past;
    return h('button', { type: 'button', role: 'listitem', class: 'strip-item subj-' + K.sessionColor(c) + (past ? ' is-past' : '') + (live ? ' is-now' : ''), onClick: () => onOpen(c),
      'aria-label': K.sessionTitle(c) + ' de ' + c.debut + ' à ' + c.fin + (c.statut === 'annule' ? ', annulé' : '') },
    h('div', { class: 'num strong' }, c.debut + ' – ' + c.fin), h('div', { class: 't' }, c.statut === 'annule' ? h('s', null, K.sessionTitle(c)) : K.sessionTitle(c)),
    // Pas de badge de statut ici (déjà expliqué dans « Prochain cours ») ; l'annulation reste visible par le texte barré.
    h('div', { class: 'm' }, c.type + ' · ' + K.salle(c.salle).nom + (c.statut === 'annule' ? ' · annulé' : '')), live ? UI.badge('En cours', 'success', 'clock') : null);
  }));
}

/* ---------- 1. Tableau de bord ---------- */
defineScreen('etudiant', 'accueil', {
  title: 'Accueil',
  render(ctx) {
    const me = ctx.me;
    const today = DT.rel(0);
    const sum = K.paymentSummary(me.id);
    const next = K.nextSession(me);
    const todays = K.sessionsFor(me, today, today);
    const r3 = K.result(me.id, 'S3');
    const risks = K.absenceRisks(me.id);
    const hour = new Date().getHours();

    // Dernières notes publiées
    const recent = App.store.sheets.filter((f) => f.statut === 'validee' && f.notes[me.id] !== undefined && f.valideLe)
      .sort((a, b) => b.valideLe.localeCompare(a.valideLe)).slice(0, 3);
    const notesList = h('ul', { class: 'list' }, recent.map((f) => {
      const v = Calc.value(f.notes[me.id]);
      const cls = K.classEval(f.ecueId, f.eval);
      const delta = cls.avg !== null ? Calc.round2(v - cls.avg) : null;
      return h('li', { class: 'list-item' }, h('div', { class: 'grow stack-s', style: { gap: '4px' } }, UI.subject(K.ecue(f.ecueId)), h('span', { class: 'xsmall muted' }, EVAL_LABELS[f.eval] + ' · publié ' + FMT.relative(f.valideLe))),
        h('div', { class: 'right' }, h('div', { class: 'score ' + scoreCls(v), style: { fontSize: '20px' } }, FMT.note(f.notes[me.id])),
          delta !== null ? h('div', { class: 'delta ' + (delta >= 0 ? 'up' : 'down') }, icon(delta >= 0 ? 'arrowUp' : 'arrowDown', 12), FMT.num(Math.abs(delta), 2) + ' vs classe') : null));
    }));

    // Devoirs de la semaine
    const weekEnd = DT.iso(DT.add(DT.mondayOf(DT.today()), 6));
    const devoirs = App.store.devoirs.filter((d) => K.devoirStatus(d, me.id) === 'a_faire' && d.dateLimite <= DT.rel(7)).sort((a, b) => a.dateLimite.localeCompare(b.dateLimite));
    const devoirsList = devoirs.length ? h('ul', { class: 'list' }, devoirs.map((d) => {
      const days = DT.diffDays(d.dateLimite, today);
      return h('li', null, h('a', { class: 'list-btn', href: '#/etudiant/devoirs' }, h('span', { class: 'list-icon ' + (days <= 2 ? 'warning' : 'info') }, icon('book', 18)),
        h('span', { class: 'grow' }, h('span', { class: 'list-title', style: { display: 'block' } }, d.titre), h('span', { class: 'list-meta' }, K.ecueName(d.ecueId))),
        UI.badge(days === 0 ? 'Aujourd\'hui' : days === 1 ? 'Demain' : 'J-' + days, days <= 2 ? 'warning' : 'neutral', 'clock')));
    })) : UI.empty({ title: 'Rien à rendre cette semaine', text: 'Bon travail !' });

    const isLive = next && DT.toDate(next.date, next.debut) <= new Date();
    const nextCard = UI.card({ title: isLive ? 'Cours en cours' : 'Prochain cours', actions: UI.button({ label: 'Emploi du temps', size: 's', variant: 'ghost', href: '#/etudiant/emploi-du-temps', iconRight: 'arrowRight' }) },
      next ? (() => {
        const cd = h('div', { class: 'countdown', 'aria-live': 'off' }, countdownText(next));
        const timer = setInterval(() => { if (!cd.isConnected) { clearInterval(timer); return; } cd.textContent = countdownText(next); }, 30000);
        // Titre seul (sans pastille ni badge redondants) : le changement éventuel est expliqué dans l'alerte ci-dessous.
        return h('div', { class: 'stack' },
          h('div', { class: 'row-s wrap' }, h('span', { class: 'strong', style: { fontSize: '18px' } }, K.sessionTitle(next)), h('span', { class: 'tag-type' }, next.type)), cd,
          h('div', { class: 'row wrap small muted' }, h('span', { class: 'row-s' }, icon('door', 16), K.salle(next.salle).nom), h('span', { class: 'row-s' }, icon('user', 16), K.sessionTeacher(next)), h('span', { class: 'row-s' }, icon('clock', 16), FMT.hhmm(next.debut) + ' – ' + FMT.hhmm(next.fin))),
          next.remarque ? UI.alert('info', null, next.remarque) : null);
      })() : UI.empty({ title: 'Aucun cours à venir', text: 'L\'emploi du temps de la suite n\'est pas encore publié.' }));

    return h('div', { class: 'stack-l' },
      h('div', { class: 'hello' }, h('div', null, h('p', { class: 'date' }, capitalize(FMT.dateLong(today))), h('h1', null, (hour < 18 ? 'Bonjour' : 'Bonsoir') + ', ' + me.prenom)),
        h('div', { class: 'row-s wrap' }, UI.badge(me.niveau + ' ' + K.filiere(me.filiere).nom + ' · Groupe ' + me.groupe, 'accent', 'graduation'), UI.badge(me.matricule, 'neutral'))),
      sum.retard.length ? UI.alert('danger', 'Paiement en retard', sum.retard[0].libelle + ' : ' + FMT.money(sum.retard[0].reste) + ' attendus depuis le ' + FMT.date(sum.retard[0].echeance) + '. Payez en 1 minute par Orange Money ou Moov Money.',
        [UI.button({ label: 'Payer maintenant', size: 's', onClick: () => Commun.payFlow(me.id, sum.retard[0].n) }), UI.button({ label: 'Voir l\'échéancier', size: 's', variant: 'ghost', href: '#/etudiant/paiements' })]) : null,
      risks.length ? UI.alert('warning', 'Seuil d\'absences proche', risks.map((r) => K.ecueName(r.ecueId) + ' : ' + r.count + '/' + r.seuil).join(' · ') + '. Au-delà, l\'accès à l\'examen peut être refusé.', UI.button({ label: 'Mes absences', size: 's', variant: 'secondary', href: '#/etudiant/absences' })) : null,
      h('div', { class: 'grid-main' },
        h('div', { class: 'stack' }, nextCard,
          UI.card({ title: 'Aujourd\'hui', actions: h('span', { class: 'xsmall muted' }, FMT.plural(todays.length, 'séance')) }, dayStrip(todays, (c) => Commun.sessionDrawer(c))),
          h('div', { class: 'grid-2' },
            UI.card({ title: 'Dernières notes', actions: UI.button({ label: 'Tout voir', size: 's', variant: 'ghost', href: '#/etudiant/notes' }) }, notesList),
            UI.card({ title: 'À rendre cette semaine', actions: UI.button({ label: 'Devoirs', size: 's', variant: 'ghost', href: '#/etudiant/devoirs' }) }, devoirsList))),
        h('div', { class: 'stack' },
          UI.card({ title: 'Semestre 3 — résultats', actions: UI.status(r3.decision || 'en_cours') }, h('div', { class: 'row wrap', style: { justifyContent: 'space-around' } },
            h('div', { class: 'mini-stat' }, h('b', { class: 'note-big' }, FMT.note(r3.moy), h('span', { class: 'of' }, ' / 20')), h('span', null, 'moyenne du semestre')),
            h('div', { class: 'stack-s' }, h('div', { class: 'mini-stat' }, h('b', null, String(r3.credits), h('span', { class: 'of' }, ' / ' + r3.total)), h('span', null, 'crédits obtenus')),
              UI.progress(r3.credits, r3.total, null, 'Crédits'), h('div', { class: 'mini-stat' }, h('b', { class: 'mention-txt' }, r3.mention || '—'), h('span', null, 'mention')),
              UI.button({ label: 'Simuler mon rattrapage', size: 's', variant: 'secondary', icon: 'calc', href: '#/etudiant/notes' })))),
          UI.card({ title: 'Annonces récentes', actions: UI.button({ label: 'Toutes', size: 's', variant: 'ghost', href: '#/etudiant/annonces' }) },
            h('ul', { class: 'list' }, K.annoncesFor(me).slice(0, 3).map((a) => h('li', null, h('a', { class: 'list-btn', href: '#/etudiant/annonces' }, h('span', { class: 'list-icon' }, icon(a.epingle ? 'pin' : 'megaphone', 18)),
              h('span', { class: 'grow' }, h('span', { class: 'list-title', style: { display: 'block' } }, a.titre), h('span', { class: 'list-meta' }, a.categorie + ' · ' + FMT.relative(a.date))))))))))
    );
  }
});

/* ---------- 2. Emploi du temps ---------- */
defineScreen('etudiant', 'emploi-du-temps', {
  title: 'Emploi du temps',
  render(ctx) {
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Emploi du temps', sub: 'L2 Informatique · Groupe ' + ctx.me.groupe + ' · Semestre 4' }),
      Commun.timetable({ key: 'etu', getSessions: (f, t) => K.sessionsFor(ctx.me, f, t) }));
  }
});

/* ---------- 3. Notes ---------- */
defineScreen('etudiant', 'notes', {
  title: 'Notes',
  render(ctx) {
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Mes notes', sub: 'UE, ECUE, crédits et décisions calculés selon les règles LMD de l\'établissement.' }),
      Commun.notesView(ctx.me.id, { simulateur: true, releve: '#/etudiant/releve' }));
  }
});

/* ---------- 4. Relevé de notes ---------- */
defineScreen('etudiant', 'releve', {
  title: 'Relevé de notes',
  render(ctx) {
    const st = Etu.releve;
    const doc = Commun.releveDoc(ctx.me.id, st.sem, st.session);
    return h('div', { class: 'stack-l' },
      UI.pageHead({ title: 'Relevé de notes', crumbs: [{ label: 'Notes', href: '#/etudiant/notes' }, { label: 'Relevé' }], sub: 'Aperçu du document officiel, prêt à imprimer au format A4.',
        actions: [UI.button({ label: 'Imprimer', icon: 'printer', variant: 'secondary', onClick: () => UI.print(doc) }), UI.button({ label: 'Télécharger en PDF', icon: 'download', onClick: () => { UI.toast('Choisissez « Enregistrer au format PDF » dans la fenêtre d\'impression.', 'info'); UI.print(doc); } })] }),
      h('div', { class: 'row-s wrap' },
        UI.segmented([{ id: 'S3', label: 'Semestre 3' }, { id: 'S4', label: 'Semestre 4 (provisoire)' }], st.sem, (v) => { st.sem = v; st.session = 'normale'; App.refresh(); }, 'Semestre'),
        st.sem === 'S3' ? UI.segmented([{ id: 'normale', label: 'Session normale' }, { id: 'rattrapage', label: 'Rattrapage' }], st.session, (v) => { st.session = v; App.refresh(); }, 'Session') : null),
      UI.alert('neutral', null, 'Le relevé officiel signé s\'obtient auprès de la Scolarité (rubrique Demandes). Ce relevé électronique comporte un QR code de vérification.'),
      doc);
  }
});

/* ---------- 5. Absences ---------- */
defineScreen('etudiant', 'absences', {
  title: 'Absences et retards',
  render(ctx) {
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Absences et retards', sub: 'Seuil : ' + App.store.parametres.seuilAbsences + ' absences non justifiées par matière.' }),
      Commun.absencesView(ctx.me.id, { justify: true }));
  }
});

/* ---------- 6. Devoirs et cahier de textes ---------- */
function deposerRendu(d, sid) {
  if (!App.guard('devoir.rendre')) return;
  let file = null;
  const com = UI.field({ label: 'Message pour l\'enseignant (facultatif)', as: 'textarea', rows: 3, maxlength: 500 });
  const err = h('div', { class: 'field-error', 'aria-live': 'polite' });
  UI.modal({
    title: 'Déposer mon rendu',
    body: h('div', { class: 'stack' }, h('div', null, h('div', { class: 'strong' }, d.titre), h('div', { class: 'small muted' }, 'À rendre avant le ' + FMT.date(d.dateLimite) + ' à ' + d.heureLimite)),
      UI.upload({ accept: ['pdf', 'zip', 'docx', 'jpg', 'png'], maxMo: 10, label: 'Votre travail', demoName: 'rendu-' + norm(K.user(sid).nom) + '.pdf', demoKo: 860, onFile: (f) => { file = f; clear(err); } }), err, com.el,
      UI.alert('neutral', null, 'Connexion lente ? Le dépôt reprend automatiquement si la connexion est interrompue.')),
    actions: (api) => [UI.button({ label: 'Annuler', variant: 'secondary', onClick: () => api.close() }), UI.button({ label: 'Déposer', icon: 'upload', onClick: (e) => {
      if (!file) { clear(err).appendChild(document.createTextNode('Choisissez le fichier à déposer.')); return; }
      if (!App.requireOnline('Le dépôt du rendu')) return;
      UI.loading(e.currentTarget, 900, () => {
        d.rendus[sid] = { date: nowStamp(), fichier: file.name, tailleKo: file.sizeKo, note: null, commentaire: '', message: com.input.value.trim() };
        App.notify(K.ecue(d.ecueId).ens, 'devoir', 'Nouveau rendu', K.name(K.user(sid)) + ' — ' + d.titre + '.', '#/enseignant/corrections');
        api.close(); UI.toast('Rendu déposé. Un accusé de réception vous a été envoyé.', 'success'); App.refresh();
      });
    } })]
  });
}

function devoirCard(d, sid) {
  const status = K.devoirStatus(d, sid);
  const r = d.rendus[sid];
  const days = DT.diffDays(d.dateLimite, DT.rel(0));
  return h('article', { class: 'card card-pad stack' },
    h('div', { class: 'row-between wrap' }, UI.subject(K.ecue(d.ecueId)), h('div', { class: 'row-s' }, status === 'a_faire' ? UI.badge(days === 0 ? 'Aujourd\'hui' : days < 0 ? 'Délai dépassé' : 'J-' + days, days <= 2 ? 'warning' : 'neutral', 'clock') : null, UI.status(status))),
    h('div', null, h('h3', { style: { fontSize: '16px' } }, d.titre), h('p', { class: 'small muted' }, 'Date limite : ' + FMT.dateLong(d.dateLimite) + ' à ' + d.heureLimite + ' · ' + K.sessionTeacher({ ens: K.ecue(d.ecueId).ens }))),
    h('p', { class: 'small' }, d.consignes),
    h('div', { class: 'chip-row' }, d.pieces.map((p) => h('button', { type: 'button', class: 'chip', onClick: () => UI.toast('Téléchargement de « ' + p + ' » (simulation).', 'info') }, icon('paperclip', 14), p))),
    r ? h('div', { class: 'file-chip' }, icon('checkCircle', 18), h('div', { class: 'grow' }, h('div', { class: 'small strong' }, r.fichier), h('div', { class: 'xsmall muted' }, 'Déposé ' + FMT.relative(r.date) + ' · ' + FMT.size(r.tailleKo)))) : null,
    r && r.note !== null && r.note !== undefined ? h('div', { class: 'alert alert-success' }, icon('award', 20), h('div', { class: 'alert-text' }, h('div', { class: 'alert-title' }, 'Note : ' + FMT.note(r.note) + ' / 20'), r.commentaire ? h('div', null, '« ' + r.commentaire + ' »') : null)) : null,
    status === 'a_faire' ? h('div', { class: 'form-actions' }, UI.button({ label: 'Déposer mon rendu', icon: 'upload', onClick: () => deposerRendu(d, sid) })) : null,
    status === 'non_rendu' ? UI.alert('danger', null, 'Délai dépassé. Contactez l\'enseignant si vous avez un motif valable.') : null);
}

defineScreen('etudiant', 'devoirs', {
  title: 'Devoirs',
  render(ctx) {
    const sid = ctx.me.id;
    const all = App.store.devoirs.slice().sort((a, b) => a.dateLimite.localeCompare(b.dateLimite));
    const aFaire = all.filter((d) => ['a_faire', 'non_rendu'].includes(K.devoirStatus(d, sid)));
    const rendus = all.filter((d) => d.rendus[sid]).reverse();
    let body;
    if (Etu.devoirsTab === 'afaire') body = aFaire.length ? h('div', { class: 'grid-2' }, aFaire.map((d) => devoirCard(d, sid))) : UI.empty({ title: 'Aucun devoir à faire', text: 'Tous vos devoirs sont rendus.' });
    else if (Etu.devoirsTab === 'rendus') body = rendus.length ? h('div', { class: 'grid-2' }, rendus.map((d) => devoirCard(d, sid))) : UI.empty({ title: 'Aucun rendu' });
    else {
      const byEcue = {};
      App.store.cahier.slice().sort((a, b) => b.date.localeCompare(a.date)).forEach((c) => { (byEcue[c.ecueId] = byEcue[c.ecueId] || []).push(c); });
      body = h('div', { class: 'grid-2' }, Object.keys(byEcue).map((eid) => UI.card({ title: K.ecueName(eid), actions: UI.subject(K.ecue(eid), true) },
        h('ul', { class: 'timeline' }, byEcue[eid].map((c) => h('li', null, h('div', { class: 'xsmall muted' }, capitalize(FMT.dateShort(c.date))), h('div', null, c.contenu),
          c.devoirId ? h('div', { class: 'xsmall', style: { marginTop: '4px' } }, UI.badge('Devoir : ' + App.store.devoirs.find((d) => d.id === c.devoirId).titre, 'info', 'book')) : null))))));
    }
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Devoirs et cahier de textes' }),
      h('div', null, UI.tabs([{ id: 'afaire', label: 'À faire', count: aFaire.filter((d) => K.devoirStatus(d, sid) === 'a_faire').length }, { id: 'rendus', label: 'Rendus' }, { id: 'cahier', label: 'Cahier de textes' }], Etu.devoirsTab, (v) => { Etu.devoirsTab = v; App.refresh(); }, 'Devoirs'), body));
  }
});

/* ---------- 7. Ressources de cours ---------- */
Commun.downloadRes = function (r) {
  if (r.type === 'lien') { UI.toast('Lien externe ouvert dans un nouvel onglet (simulation).', 'info'); return; }
  const secs = Math.max(1, Math.round(r.tailleKo / 60));
  const go = () => UI.toast('« ' + r.titre + ' » téléchargé (' + FMT.size(r.tailleKo) + ', simulation).', 'success');
  if (App.ui.dataSaver && r.tailleKo > 5000) {
    UI.confirm({ title: 'Fichier volumineux', message: 'Ce fichier pèse ' + FMT.size(r.tailleKo) + ' (environ ' + Math.round(secs / 60) + ' min en 3G). Le mode économie de données est actif : télécharger quand même ?', confirmLabel: 'Télécharger' }).then((ok) => { if (ok) go(); });
  } else go();
};

defineScreen('etudiant', 'ressources', {
  title: 'Ressources',
  render() {
    const types = [['tous', 'Tout'], ['pdf', 'PDF'], ['slides', 'Diaporamas'], ['lien', 'Liens'], ['video', 'Vidéos']];
    const ecues = Array.from(new Set(App.store.ressources.map((r) => r.ecueId)));
    const listEl = h('div', { class: 'stack-s' });
    const draw = () => {
      clear(listEl);
      const items = App.store.ressources.filter((r) => (Etu.resType === 'tous' || r.type === Etu.resType) && (!Etu.resEcue || r.ecueId === Etu.resEcue) && (!Etu.resQ || norm(r.titre + ' ' + K.ecueName(r.ecueId)).includes(norm(Etu.resQ))))
        .sort((a, b) => b.date.localeCompare(a.date));
      listEl.appendChild(h('p', { class: 'small muted', 'aria-live': 'polite' }, FMT.plural(items.length, 'ressource')));
      if (!items.length) { listEl.appendChild(UI.empty({ title: 'Aucune ressource', text: 'Modifiez les filtres.' })); return; }
      listEl.appendChild(UI.card({ ariaLabel: 'Ressources' }, h('ul', { class: 'list' }, items.map((r) => {
        const isNew = DT.diffDays(DT.rel(0), r.date) <= 7;
        return h('li', { class: 'list-item wrap' }, Commun.resIcon(r.type),
          h('div', { class: 'grow' }, h('div', { class: 'list-title row-s wrap' }, r.titre, isNew ? UI.badge('Nouveau', 'accent') : null),
            h('div', { class: 'list-meta row-s wrap' }, UI.subject(K.ecue(r.ecueId)), r.chapitre + ' · ajouté le ' + FMT.date(r.date) + ' · ', h('strong', null, FMT.size(r.tailleKo)),
              r.type === 'video' ? h('span', { class: 'saver-note' }, '· aperçu désactivé (économie de données)') : null)),
          UI.button({ label: r.type === 'lien' ? 'Ouvrir' : 'Télécharger', size: 's', variant: 'secondary', icon: r.type === 'lien' ? 'external' : 'download', onClick: () => Commun.downloadRes(r) }));
      }))));
    };
    const sb = UI.search({ placeholder: 'Rechercher une ressource…', value: Etu.resQ, onInput: (v) => { Etu.resQ = v; draw(); } });
    const chips = h('div', { class: 'chip-row', role: 'group', 'aria-label': 'Type de ressource' });
    const drawChips = () => { clear(chips); types.forEach(([id, label]) => chips.appendChild(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(Etu.resType === id), onClick: () => { Etu.resType = id; drawChips(); draw(); } }, label))); };
    drawChips();
    const sel = UI.select([{ value: '', label: 'Toutes les matières' }].concat(ecues.map((e) => ({ value: e, label: K.ecueName(e) }))), Etu.resEcue, (v) => { Etu.resEcue = v; draw(); }, { 'aria-label': 'Matière', class: 'select', style: { maxWidth: '280px' } });
    draw();
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Ressources de cours', sub: 'La taille de chaque fichier est indiquée pour les connexions lentes.' }),
      h('div', { class: 'row wrap' }, h('div', { class: 'grow', style: { minWidth: '220px' } }, sb.el), sel), chips, listEl);
  }
});

/* ---------- 8. Examens et convocations ---------- */
function convocationDoc(ex, sid) {
  const st = K.user(sid);
  const univ = App.store.universite;
  return h('div', { class: 'doc' }, UI.docHeader(univ, 'Convocation n° CV-' + ex.id.toUpperCase(), { noQr: true }),
    h('div', { class: 'doc-title' }, 'Convocation à l\'examen' + (ex.session === 'rattrapage' ? ' — session de rattrapage' : '')),
    h('div', { class: 'row-between', style: { alignItems: 'flex-start', gap: '24px', flexWrap: 'wrap' } },
      h('div', { class: 'doc-info', style: { flex: '1 1 320px', gridTemplateColumns: '1fr' } },
        h('div', null, h('b', null, 'Candidat(e) : '), st.nom.toUpperCase() + ' ' + st.prenom), h('div', null, h('b', null, 'Matricule : '), st.matricule),
        h('div', null, h('b', null, 'Filière : '), K.filiere(st.filiere).nom + ' — ' + st.niveau + ' — ' + ex.semestre),
        h('div', null, h('b', null, 'Épreuve : '), K.ecueName(ex.ecueId) + ' (' + ex.ecueId + ')'),
        h('div', null, h('b', null, 'Date : '), capitalize(FMT.dateLong(ex.date))), h('div', null, h('b', null, 'Heure : '), FMT.hhmm(ex.heure) + ' (présence 30 min avant) · durée ' + ex.duree + ' h'),
        h('div', null, h('b', null, 'Salle : '), K.salle(ex.salle).nom), h('div', null, h('b', null, 'Place n° : '), ex.places[sid] || 'Affichée à l\'entrée')),
      h('div', { class: 'qr-small', style: { textAlign: 'center' } }, UI.qr(ex.id + sid, 130), h('div', { class: 'xsmall' }, 'À présenter à l\'entrée'))),
    h('table', { style: { marginTop: '12px' } }, h('tbody', null,
      h('tr', null, h('th', null, 'Documents obligatoires'), h('td', null, 'Carte d\'étudiant et pièce d\'identité en cours de validité')),
      h('tr', null, h('th', null, 'Interdits'), h('td', null, 'Téléphones, montres connectées, documents non autorisés')))),
    docSignature(ex.id + sid), h('div', { class: 'watermark' }, 'Convocation générée par Kalanso — maquette de démonstration.'));
}

defineScreen('etudiant', 'examens', {
  title: 'Examens',
  render(ctx) {
    const sid = ctx.me.id;
    const r3 = K.result(sid, 'S3');
    const nonValidees = r3.ues.filter((u) => u.statut === 'non_validee').flatMap((u) => u.ue.ecues.map((e) => e.id));
    const exams = App.store.examens.filter((e) => e.session === 'normale' || nonValidees.includes(e.ecueId)).sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Examens', sub: 'Calendrier, convocations et résultats publiés.' }),
      h('div', { class: 'grid-2' },
        UI.card({ title: 'Résultats publiés' }, h('ul', { class: 'list' },
          h('li', { class: 'list-item wrap' }, h('span', { class: 'list-icon warning' }, icon('award', 20)), h('div', { class: 'grow' }, h('div', { class: 'list-title' }, 'Semestre 3 — session normale'), h('div', { class: 'list-meta' }, 'Moyenne ' + FMT.note(r3.moy) + ' · ' + r3.credits + '/' + r3.total + ' crédits')), UI.status(r3.decision)),
          h('li', { class: 'list-item wrap' }, h('span', { class: 'list-icon' }, icon('clock', 20)), h('div', { class: 'grow' }, h('div', { class: 'list-title' }, 'Semestre 3 — rattrapage'), h('div', { class: 'list-meta' }, 'Délibération après les épreuves')), UI.status('en_cours', 'À venir')),
          h('li', { class: 'list-item wrap' }, h('span', { class: 'list-icon' }, icon('clock', 20)), h('div', { class: 'grow' }, h('div', { class: 'list-title' }, 'Semestre 4 — session normale'), h('div', { class: 'list-meta' }, 'Examens à partir du ' + FMT.date(App.store.examens.find((e) => e.session === 'normale').date))), UI.status('en_cours', 'À venir')))),
        UI.card({ title: 'Règles de l\'examen' }, h('ul', { class: 'list' }, ['Présentez-vous 30 minutes avant le début de l\'épreuve.', 'Carte d\'étudiant et convocation (papier ou sur téléphone) obligatoires.',
          'Au-delà de ' + App.store.parametres.seuilAbsences + ' absences non justifiées dans une matière, l\'accès à l\'examen peut être refusé.', 'La note de rattrapage remplace l\'examen si elle est meilleure.'].map((t) => h('li', { class: 'list-item small' }, icon('check', 16), t))))),
      UI.card({ title: 'Calendrier des examens', flush: true }, UI.table({
        columns: [
          { key: 'date', label: 'Date', sortable: true, render: (e) => h('div', null, h('div', { class: 'strong' }, FMT.date(e.date)), h('div', { class: 'xsmall muted' }, capitalize(FMT.weekday(e.date)))) },
          { key: 'heure', label: 'Heure', render: (e) => FMT.hhmm(e.heure) + ' · ' + e.duree + ' h' },
          { key: 'ecueId', label: 'Épreuve', render: (e) => UI.subject(K.ecue(e.ecueId)) },
          { key: 'session', label: 'Session', render: (e) => e.session === 'rattrapage' ? UI.status('rattrapage') : UI.badge('Normale · ' + e.semestre, 'neutral') },
          { key: 'salle', label: 'Salle', render: (e) => K.salle(e.salle).nom },
          { key: 'place', label: 'Place', render: (e) => h('span', { class: 'num strong' }, e.places[sid] || '—') },
          { key: 'c', label: '', render: (e) => UI.button({ label: 'Convocation', size: 's', variant: 'secondary', icon: 'qr', onClick: () => Commun.showDoc('Convocation — ' + K.ecueName(e.ecueId), convocationDoc(e, sid)) }) }
        ], rows: exams, sortKey: 'date' })));
  }
});

/* ---------- 9. Scolarité et paiements ---------- */
defineScreen('etudiant', 'paiements', {
  title: 'Paiements',
  render(ctx) {
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Scolarité et paiements', sub: 'Frais ' + App.store.universite.annee + ' en 3 tranches. Paiement par Orange Money, Moov Money, carte ou à la caisse.' }), Commun.paymentsView(ctx.me.id));
  }
});

/* ---------- 10. Demandes administratives ---------- */
const DEMANDE_TYPES = ['Attestation d\'inscription', 'Certificat de scolarité', 'Relevé de notes officiel', 'Duplicata de carte d\'étudiant'];
const DEMANDE_STEPS = ['soumise', 'traitement', 'prete'];

defineScreen('etudiant', 'demandes', {
  title: 'Demandes administratives',
  render(ctx) {
    const sid = ctx.me.id;
    const mine = App.store.demandes.filter((d) => d.sid === sid).sort((a, b) => b.date.localeCompare(a.date));
    const rdv = App.store.rendezvous.filter((r) => r.sid === sid);
    const nouvelle = () => {
      const type = UI.field({ label: 'Document demandé', as: 'select', required: true, options: [{ value: '', label: 'Choisir…' }].concat(DEMANDE_TYPES.map((t) => ({ value: t, label: t }))) });
      const motif = UI.field({ label: 'Motif', required: true, placeholder: 'Ex. dossier de stage, demande de bourse…', maxlength: 120 });
      const nb = UI.field({ label: 'Nombre d\'exemplaires', type: 'number', value: '1', min: '1', max: '5' });
      UI.modal({ title: 'Nouvelle demande', body: h('div', { class: 'stack' }, type.el, motif.el, nb.el, UI.alert('neutral', null, 'Délai moyen de traitement : 48 heures ouvrées. Vous serez notifié·e par SMS.')),
        actions: (api) => [UI.button({ label: 'Annuler', variant: 'secondary', onClick: () => api.close() }), UI.button({ label: 'Envoyer la demande', icon: 'send', onClick: () => {
          let ok = type.setError(type.input.value ? null : 'Choisissez un document.');
          ok = motif.setError(motif.input.value.trim().length >= 3 ? null : 'Précisez le motif.') && ok;
          const n = Number(nb.input.value);
          ok = nb.setError(Number.isInteger(n) && n >= 1 && n <= 5 ? null : 'Entre 1 et 5 exemplaires.') && ok;
          if (!ok || !App.guard('demande.creer')) return;
          App.store.demandes.unshift({ id: 'dm' + Date.now(), sid, type: type.input.value, date: nowStamp(), statut: 'soumise', motif: motif.input.value.trim() + (n > 1 ? ' (' + n + ' exemplaires)' : ''), historique: [['soumise', nowStamp()]] });
          App.notify('a2', 'annonce', 'Nouvelle demande', K.name(ctx.me) + ' — ' + type.input.value + '.', '#/scolarite/demandes');
          api.close(); UI.toast('Demande envoyée à la Scolarité.', 'success'); App.refresh();
        } })] });
    };
    const prendreRdv = () => {
      const days = []; for (let i = 1; days.length < 6; i++) { const d = DT.add(DT.today(), i); if (d.getDay() !== 0 && d.getDay() !== 6) days.push(DT.iso(d)); }
      const jour = UI.field({ label: 'Jour', as: 'select', options: days.map((d) => ({ value: d, label: capitalize(FMT.dateLong(d)) })) });
      const cren = UI.field({ label: 'Créneau', as: 'select', options: ['08:00', '08:30', '09:00', '09:30', '10:30', '11:00', '14:30', '15:00'].map((x) => ({ value: x, label: FMT.hhmm(x) })) });
      const objet = UI.field({ label: 'Objet du rendez-vous', required: true, placeholder: 'Ex. retrait d\'un document, réclamation de note…' });
      UI.modal({ title: 'Rendez-vous à la Scolarité', body: h('div', { class: 'stack' }, jour.el, cren.el, objet.el),
        actions: (api) => [UI.button({ label: 'Annuler', variant: 'secondary', onClick: () => api.close() }), UI.button({ label: 'Confirmer', icon: 'calendar', onClick: () => {
          if (!objet.setError(objet.input.value.trim() ? null : 'Indiquez l\'objet.')) return;
          App.store.rendezvous.push({ id: 'rv' + Date.now(), sid, objet: objet.input.value.trim(), date: jour.input.value, heure: cren.input.value, guichet: 'Guichet ' + (1 + Math.floor(Math.random() * 3)) });
          api.close(); UI.toast('Rendez-vous confirmé. Un rappel SMS vous sera envoyé la veille.', 'success'); App.refresh();
        } })] });
    };
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Demandes administratives', sub: 'Attestations, certificats et relevés officiels, sans faire la queue.', actions: [UI.button({ label: 'Prendre rendez-vous', icon: 'calendar', variant: 'secondary', onClick: prendreRdv }), UI.button({ label: 'Nouvelle demande', icon: 'plus', onClick: nouvelle })] }),
      h('div', { class: 'grid-main' },
        h('div', { class: 'stack' }, mine.length ? mine.map((d) => UI.card({ title: d.type, actions: UI.status(d.statut) }, h('div', { class: 'stack' },
          h('p', { class: 'small muted' }, 'Demandé le ' + FMT.dateTime(d.date) + ' · ' + d.motif),
          UI.steps(['Soumise', 'En traitement', 'Prête à retirer'], d.statut === 'prete' ? 3 : DEMANDE_STEPS.indexOf(d.statut)),
          d.statut === 'prete' ? UI.alert('success', 'Document disponible', 'Retrait au guichet 2 avec votre carte d\'étudiant, du lundi au vendredi de 7h30 à 15h30.') : null))) : UI.empty({ title: 'Aucune demande', text: 'Vos demandes apparaîtront ici avec leur suivi.' })),
        UI.card({ title: 'Mes rendez-vous' }, rdv.length ? h('ul', { class: 'list' }, rdv.map((r) => h('li', { class: 'list-item' }, h('div', { class: 'event-date' }, h('span', null, FMT.monthShort(DT.parse(r.date))), h('b', null, String(DT.parse(r.date).getDate()))),
          h('div', { class: 'grow' }, h('div', { class: 'list-title' }, r.objet), h('div', { class: 'list-meta' }, capitalize(FMT.weekday(r.date)) + ' à ' + FMT.hhmm(r.heure) + ' · ' + r.guichet))))) : UI.empty({ title: 'Aucun rendez-vous' }))));
  }
});

/* ---------- 11. Vie de campus ---------- */
defineScreen('etudiant', 'campus', {
  title: 'Vie de campus',
  render(ctx) {
    const evs = App.store.evenements.slice().sort((a, b) => a.date.localeCompare(b.date));
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Vie de campus', sub: 'Événements, clubs et associations de l\'université.' }),
      h('div', { class: 'grid-main' },
        UI.card({ title: 'Événements à venir' }, h('ul', { class: 'list' }, evs.map((e) => h('li', { class: 'list-item wrap' },
          h('div', { class: 'event-date' }, h('span', null, FMT.monthShort(DT.parse(e.date))), h('b', null, String(DT.parse(e.date).getDate()))),
          h('div', { class: 'grow' }, h('div', { class: 'list-title' }, e.titre), h('div', { class: 'list-meta' }, e.lieu + ' · ' + e.organisateur), h('div', { class: 'xsmall muted' }, e.inscrits + ' inscrits sur ' + e.places + ' places')),
          UI.button({ label: e.inscrit ? 'Inscrit·e' : 'S\'inscrire', size: 's', variant: e.inscrit ? 'secondary' : 'primary', icon: e.inscrit ? 'check' : null, onClick: () => {
            e.inscrit = !e.inscrit; e.inscrits += e.inscrit ? 1 : -1;
            UI.toast(e.inscrit ? 'Inscription confirmée à « ' + e.titre + ' ».' : 'Inscription annulée.', e.inscrit ? 'success' : 'info'); App.refresh();
          } }))))),
        h('div', { class: 'stack' },
          UI.card({ title: 'Clubs et associations' }, h('ul', { class: 'list' }, App.store.clubs.map((c) => h('li', { class: 'list-item wrap' }, h('span', { class: 'list-icon accent' }, icon('users', 18)),
            h('div', { class: 'grow' }, h('div', { class: 'list-title' }, c.nom), h('div', { class: 'list-meta' }, c.description + ' · ' + c.membres + ' membres')),
            UI.button({ label: c.membre ? 'Membre' : 'Rejoindre', size: 's', variant: c.membre ? 'secondary' : 'ghost', icon: c.membre ? 'check' : 'plus', onClick: () => { c.membre = !c.membre; c.membres += c.membre ? 1 : -1; UI.toast(c.membre ? 'Demande d\'adhésion envoyée au bureau du club.' : 'Vous avez quitté le club.', 'success'); App.refresh(); } }))))),
          UI.card({ title: 'Dernières annonces' }, h('div', { class: 'stack-s' }, K.annoncesFor(ctx.me).filter((a) => a.categorie === 'Vie de campus').map((a) => Commun.annonceCard(a)))))));
  }
});

'use strict';
/*
 * Espace Enseignant — enseignant de démo : Dr Issouf Sawadogo (Algorithmique et bases de données).
 */
const Ens = { appel: {}, appelSession: null, saisie: { ecue: 'INF2411', groupe: 'all', eval: 'CC2' }, devoir: 'dv4', statsEcue: 'INF2411' };

function studentsOfGroup(groupe) { return K.promo().filter((s) => groupe === 'all' || s.groupe === groupe).sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr')); }
function appelOf(sessionId) { return App.store.appels.find((a) => a.sessionId === sessionId); }
function sessionLabel(c) { return capitalize(FMT.dateShort(c.date)) + ' · ' + c.debut + ' · ' + K.sessionTitle(c) + ' (' + c.type + (c.groupe !== 'all' ? ', groupe ' + c.groupe : '') + ')'; }

/** Séance proposée par défaut pour l'appel : celle en cours, sinon la plus proche aujourd'hui. */
function defaultAppelSession(me) {
  const now = new Date();
  const today = K.sessionsFor(me, DT.rel(0), DT.rel(0)).filter((c) => c.statut !== 'annule');
  const live = today.find((c) => DT.toDate(c.date, c.debut) <= now && DT.toDate(c.date, c.fin) > now);
  if (live) return live;
  const pending = today.find((c) => !appelOf(c.id));
  if (pending) return pending;
  const past = K.sessionsFor(me, DT.rel(-7), DT.rel(0)).filter((c) => c.statut !== 'annule' && DT.toDate(c.date, c.debut) <= now && !appelOf(c.id));
  return past[past.length - 1] || K.nextSession(me);
}

/* ---------- 1. Tableau de bord ---------- */
defineScreen('enseignant', 'accueil', {
  title: 'Accueil',
  render(ctx) {
    const me = ctx.me;
    const now = new Date();
    const todays = K.sessionsFor(me, DT.rel(0), DT.rel(0));
    const appelsAFaire = K.sessionsFor(me, DT.rel(-7), DT.rel(0)).filter((c) => c.statut !== 'annule' && DT.toDate(c.date, c.debut) <= now && !appelOf(c.id));
    const mesDevoirs = App.store.devoirs.filter((d) => K.ecue(d.ecueId).ens === me.id);
    const copies = mesDevoirs.reduce((a, d) => a + Object.values(d.rendus).filter((r) => r.note === null || r.note === undefined).length, 0);
    const saisies = App.store.sheets.filter((f) => f.ens === me.id && ['brouillon', 'renvoyee'].includes(f.statut));
    const unread = K.unreadMessages(me.id);
    return h('div', { class: 'stack-l' },
      h('div', { class: 'hello' }, h('div', null, h('p', { class: 'date' }, capitalize(FMT.dateLong(DT.rel(0)))), h('h1', null, 'Bonjour, ' + K.name(me, true))),
        UI.button({ label: 'Faire l\'appel', icon: 'userCheck', href: '#/enseignant/appel' })),
      saisies.filter((f) => f.dateLimite).map((f) => {
        const j = DT.diffDays(f.dateLimite, DT.rel(0));
        return UI.alert(j <= 4 ? 'warning' : 'info', 'Saisie attendue par la Scolarité', K.ecueName(f.ecueId) + ' — ' + EVAL_LABELS[f.eval] + ' : date limite le ' + FMT.date(f.dateLimite) + ' (J-' + j + '). ' + Object.keys(f.notes).length + ' notes saisies sur ' + K.promo().length + '.',
          UI.button({ label: 'Saisir', size: 's', onClick: () => { Object.assign(Ens.saisie, { ecue: f.ecueId, eval: f.eval, groupe: 'all' }); App.go('#/enseignant/notes'); } }));
      }),
      h('div', { class: 'grid-4' },
        UI.kpi({ label: 'Cours aujourd\'hui', icon: 'calendar', value: String(todays.length), countTo: todays.length, foot: todays.filter((c) => c.statut === 'annule').length ? todays.filter((c) => c.statut === 'annule').length + ' annulé(s)' : 'Aucun changement' }),
        UI.kpi({ label: 'Appels à faire', icon: 'userCheck', value: String(appelsAFaire.length), countTo: appelsAFaire.length, foot: 'Séances passées sans appel' }),
        UI.kpi({ label: 'Copies à corriger', icon: 'checks', value: String(copies), countTo: copies, foot: h('a', { href: '#/enseignant/corrections' }, 'Corriger') }),
        UI.kpi({ label: 'Messages non lus', icon: 'message', value: String(unread), countTo: unread, foot: h('a', { href: '#/enseignant/messages' }, 'Ouvrir la messagerie') })),
      h('div', { class: 'grid-main' },
        h('div', { class: 'stack' },
          UI.card({ title: 'Mes cours du jour', actions: UI.button({ label: 'Emploi du temps', size: 's', variant: 'ghost', href: '#/enseignant/emploi-du-temps' }) }, dayStrip(todays, (c) => openTeacherSession(c))),
          UI.card({ title: 'Appels en attente' }, appelsAFaire.length ? h('ul', { class: 'list' }, appelsAFaire.slice(-5).reverse().map((c) => h('li', { class: 'list-item wrap' }, h('span', { class: 'list-icon warning' }, icon('userCheck', 18)),
            h('div', { class: 'grow' }, h('div', { class: 'list-title' }, K.sessionTitle(c)), h('div', { class: 'list-meta' }, sessionLabel(c))),
            UI.button({ label: 'Faire l\'appel', size: 's', variant: 'secondary', onClick: () => { Ens.appelSession = c.id; App.go('#/enseignant/appel'); } })))) : UI.empty({ title: 'Tous les appels sont faits', text: 'Merci !' }))),
        h('div', { class: 'stack' },
          UI.card({ title: 'Saisie des notes' }, h('ul', { class: 'list' }, App.store.sheets.filter((f) => f.ens === me.id && f.statut !== 'attente' && K.ecue(f.ecueId).ue.semestre === 'S4').map((f) => h('li', { class: 'list-item wrap' },
            h('div', { class: 'grow' }, h('div', { class: 'list-title' }, K.ecueName(f.ecueId)), h('div', { class: 'list-meta' }, EVAL_LABELS[f.eval] + (f.dateLimite && f.statut === 'brouillon' ? ' · avant le ' + FMT.date(f.dateLimite) : ''))),
            UI.status(f.statut === 'validee' ? 'validee_sco' : f.statut))))),
          UI.card({ title: 'Mes ECUE' }, h('div', { class: 'chip-row' }, K.ecuesOfTeacher(me.id).map((e) => UI.subject(e)))))));
  }
});

/** Ouvre le détail d'une séance côté enseignant (avec raccourci vers l'appel). */
function openTeacherSession(c) {
  const a = appelOf(c.id);
  Commun.sessionDrawer(c, c.statut === 'annule' ? null : h('div', { class: 'stack-s' }, h('h3', { style: { fontSize: '15px' } }, 'Appel'),
    a ? UI.alert('success', 'Appel verrouillé', Object.values(a.presences).filter((v) => v === 'A').length + ' absent(s), ' + Object.values(a.presences).filter((v) => v === 'R').length + ' retard(s).')
      : UI.button({ label: 'Faire l\'appel de cette séance', icon: 'userCheck', onClick: () => { Ens.appelSession = c.id; UI.closeAllOverlays(); App.go('#/enseignant/appel'); } })));
}

/* ---------- 2. Emploi du temps + déclaration d'absence / report ---------- */
function reportForm(me) {
  const upcoming = K.sessionsFor(me, DT.rel(0), DT.rel(14)).filter((c) => c.statut !== 'annule');
  const seance = UI.field({ label: 'Séance concernée', as: 'select', required: true, options: [{ value: '', label: 'Choisir…' }].concat(upcoming.map((c) => ({ value: c.id, label: sessionLabel(c) }))) });
  const type = UI.field({ label: 'Demande', as: 'select', options: [{ value: 'report', label: 'Report de cours' }, { value: 'absence', label: 'Déclaration d\'absence' }] });
  const date = UI.datePicker({ label: 'Date de rattrapage proposée', min: DT.rel(1) });
  const motif = UI.field({ label: 'Motif', as: 'textarea', rows: 3, required: true, maxlength: 400 });
  UI.modal({ title: 'Absence ou report de cours', body: h('div', { class: 'stack' }, seance.el, type.el, date.el, motif.el, UI.alert('neutral', null, 'La Scolarité valide la demande ; les étudiants sont alors notifiés par l\'application et par SMS.')),
    actions: (api) => [UI.button({ label: 'Annuler', variant: 'secondary', onClick: () => api.close() }), UI.button({ label: 'Envoyer à la Scolarité', icon: 'send', onClick: () => {
      let ok = seance.setError(seance.input.value ? null : 'Choisissez une séance.');
      ok = motif.setError(motif.input.value.trim().length >= 5 ? null : 'Précisez le motif.') && ok;
      if (type.input.value === 'report' && date.input.value && date.input.value <= DT.rel(0)) ok = date.setError('La date proposée doit être future.') && ok;
      if (!ok || !App.guard('cours.report')) return;
      const c = App.store.sessions.find((x) => x.id === seance.input.value);
      App.notify('a1', 'cours', type.input.value === 'report' ? 'Demande de report' : 'Absence déclarée', K.name(me, true) + ' — ' + sessionLabel(c) + (date.input.value ? ' · rattrapage proposé le ' + FMT.date(date.input.value) : ''), '#/scolarite/emplois-du-temps');
      api.close(); UI.toast('Demande transmise à la Scolarité.', 'success');
    } })] });
}

defineScreen('enseignant', 'emploi-du-temps', {
  title: 'Mon emploi du temps',
  render(ctx) {
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Mon emploi du temps', sub: 'Toutes vos séances, toutes filières confondues.', actions: UI.button({ label: 'Déclarer une absence ou un report', icon: 'calendar', variant: 'secondary', onClick: () => reportForm(ctx.me) }) }),
      Commun.timetable({ key: 'ens', getSessions: (f, t) => K.sessionsFor(ctx.me, f, t), onOpen: openTeacherSession }));
  }
});

/* ---------- 3. Faire l'appel ---------- */
defineScreen('enseignant', 'appel', {
  title: 'Faire l\'appel',
  render(ctx) {
    const me = ctx.me;
    const now = new Date();
    const candidates = K.sessionsFor(me, DT.rel(-7), DT.rel(1)).filter((c) => c.statut !== 'annule');
    if (!Ens.appelSession || !candidates.find((c) => c.id === Ens.appelSession)) { const d = defaultAppelSession(me); Ens.appelSession = d ? d.id : null; }
    const c = candidates.find((x) => x.id === Ens.appelSession);
    const head = UI.pageHead({ title: 'Faire l\'appel', sub: 'Un tap par étudiant, puis validation et verrouillage.' });
    if (!c) return h('div', { class: 'stack-l' }, head, UI.empty({ title: 'Aucune séance à appeler' }));
    const sel = UI.select(candidates.map((x) => ({ value: x.id, label: sessionLabel(x) + (appelOf(x.id) ? ' — verrouillé' : '') })), c.id, (v) => { Ens.appelSession = v; App.refresh(); }, { 'aria-label': 'Séance', class: 'select' });
    const students = studentsOfGroup(c.groupe);
    const locked = appelOf(c.id);
    const future = DT.toDate(c.date, c.debut) > new Date(now.getTime() + 15 * 60000);
    const state = locked ? locked.presences : (Ens.appel[c.id] || (Ens.appel[c.id] = {}));
    const counts = () => ({ P: students.filter((s) => state[s.id] === 'P').length, A: students.filter((s) => state[s.id] === 'A').length, R: students.filter((s) => state[s.id] === 'R').length });
    const summary = h('div', { class: 'row-s wrap', 'aria-live': 'polite' });
    const drawSummary = () => { const n = counts(); clear(summary); appendChildren(summary, [UI.badge(n.P + ' présents', 'success', 'check'), UI.badge(n.A + ' absents', 'danger', 'x'), UI.badge(n.R + ' retards', 'warning', 'clock'), UI.badge((students.length - n.P - n.A - n.R) + ' non renseignés', 'neutral')]); };
    let q = '';
    const roll = h('div', { class: 'roll' });
    const drawRoll = () => {
      clear(roll);
      students.filter((s) => !q || norm(s.prenom + ' ' + s.nom + ' ' + s.matricule).includes(norm(q))).forEach((s) => {
        const v = state[s.id];
        const btn = (code, cls, label) => h('button', { type: 'button', class: cls, 'aria-pressed': String(v === code), 'aria-label': label + ' : ' + s.prenom + ' ' + s.nom, disabled: !!locked, onClick: () => { state[s.id] = code; drawRoll(); drawSummary(); } }, code);
        roll.appendChild(h('div', { class: 'roll-item' + (v ? ' st-' + v : '') }, UI.avatar(s), h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'small strong truncate' }, s.nom.toUpperCase() + ' ' + s.prenom), h('div', { class: 'xsmall muted' }, s.matricule)),
          h('div', { class: 'roll-btns', role: 'group', 'aria-label': 'Présence de ' + s.prenom }, btn('P', 'p', 'Présent'), btn('A', 'a', 'Absent'), btn('R', 'r', 'Retard'))));
      });
    };
    drawRoll(); drawSummary();

    const validate = () => {
      if (!App.guard('appel.faire')) return;
      const n = counts();
      const missing = students.length - n.P - n.A - n.R;
      if (missing) { UI.toast(missing + ' étudiant(s) non renseigné(s). Utilisez « Tous présents » puis marquez les absents.', 'warning'); return; }
      const absents = students.filter((s) => state[s.id] === 'A');
      UI.modal({ title: 'Récapitulatif de l\'appel', body: h('div', { class: 'stack' }, h('p', null, sessionLabel(c)),
        h('div', { class: 'grid-3' }, UI.kpi({ label: 'Présents', value: String(n.P) }), UI.kpi({ label: 'Absents', value: String(n.A) }), UI.kpi({ label: 'Retards', value: String(n.R) })),
        absents.length ? h('p', { class: 'small' }, 'Absents : ' + absents.map((s) => s.prenom + ' ' + s.nom).join(', ')) : null,
        UI.alert('warning', null, 'Une fois validé, l\'appel est verrouillé. Les absences apparaîtront immédiatement chez les étudiants et à la Scolarité.')),
      actions: (api) => [UI.button({ label: 'Modifier', variant: 'secondary', onClick: () => api.close() }), UI.button({ label: 'Valider et verrouiller', icon: 'lock', onClick: () => {
        App.store.appels.push({ sessionId: c.id, presences: Object.assign({}, state), date: nowStamp(), par: me.id, verrouille: true });
        students.forEach((s) => {
          const v = state[s.id];
          if (v === 'A' || v === 'R') {
            App.store.absences.push({ id: 'ab' + Date.now() + s.id, sid: s.id, date: c.date, ecueId: c.ecueId, type: v === 'A' ? 'absence' : 'retard', minutes: v === 'R' ? 10 : 0, statut: 'non_justifiee', motif: '', piece: '', commentaire: '', sessionId: c.id });
            App.notify(s.id, 'absence', v === 'A' ? 'Absence enregistrée' : 'Retard enregistré', K.sessionTitle(c) + ', le ' + FMT.date(c.date) + ' à ' + c.debut + '.', '#/etudiant/absences');
            const parent = Object.values(App.store.users).find((u) => u.role === 'parent' && u.enfant === s.id);
            if (parent && v === 'A') App.notify(parent.id, 'absence', 'Absence de ' + s.prenom, K.sessionTitle(c) + ', le ' + FMT.date(c.date) + '.', '#/parent/absences');
          }
        });
        App.audit('Appel verrouillé', K.sessionTitle(c) + ' · ' + FMT.date(c.date) + ' ' + c.debut, '', n.P + ' P / ' + n.A + ' A / ' + n.R + ' R', '');
        api.close(); UI.toast('Appel validé et verrouillé.', 'success'); App.refresh();
      } })] });
    };

    return h('div', { class: 'stack-l' }, head,
      UI.card({ ariaLabel: 'Séance' }, h('div', { class: 'stack' },
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Séance'), sel),
        h('div', { class: 'row-s wrap' }, UI.subject(K.ecue(c.ecueId)), h('span', { class: 'tag-type' }, c.type), UI.badge(K.salle(c.salle).nom, 'neutral', 'door'), UI.badge(c.groupe === 'all' ? 'Promotion entière' : 'Groupe ' + c.groupe, 'neutral', 'users'), UI.badge(students.length + ' inscrits', 'neutral')),
        future && !locked ? UI.alert('info', null, 'Cette séance n\'a pas encore commencé. Vous pourrez valider l\'appel à partir de ' + FMT.hhmm(c.debut) + '.') : null,
        locked ? UI.alert('success', 'Appel verrouillé', 'Validé le ' + FMT.dateTime(locked.date) + '. Toute correction passe par la Scolarité et est tracée dans le journal d\'audit.') : null)),
      locked ? null : h('div', { class: 'row-between wrap' },
        h('div', { class: 'row-s wrap' }, UI.button({ label: 'Tous présents', icon: 'checks', variant: 'secondary', onClick: () => { students.forEach((s) => { state[s.id] = 'P'; }); drawRoll(); drawSummary(); } })),
        h('div', { style: { minWidth: '240px', flex: '1 1 240px', maxWidth: '360px' } }, UI.search({ placeholder: 'Rechercher un étudiant', small: true, onInput: (v) => { q = v; drawRoll(); } }).el)),
      summary, roll,
      locked ? null : h('div', { class: 'form-actions' }, UI.button({ label: 'Valider l\'appel', icon: 'lock', disabled: future, onClick: validate })));
  }
});

/* ---------- 4. Saisie des notes (grille type tableur) ---------- */
defineScreen('enseignant', 'notes', {
  title: 'Saisie des notes',
  render(ctx) {
    const me = ctx.me;
    const st = Ens.saisie;
    const ecues = K.ecuesOfTeacher(me.id);
    if (!ecues.find((e) => e.id === st.ecue)) st.ecue = ecues[0].id;
    const evals = App.store.sheets.filter((f) => f.ecueId === st.ecue && f.eval !== 'RATT').map((f) => f.eval);
    if (!evals.includes(st.eval)) st.eval = evals[0];
    const sheet = K.sheet(st.ecue, st.eval);
    const editable = can('notes.saisir') && ['brouillon', 'renvoyee', 'attente'].includes(sheet.statut);
    const students = studentsOfGroup(st.groupe);
    const ecue = K.ecue(st.ecue);
    const live = h('div', { class: 'sr-only', 'aria-live': 'polite' });
    const statsBox = h('div', { class: 'stack' });
    const errors = {};

    const drawStats = () => {
      const vals = students.map((s) => Calc.value(sheet.notes[s.id])).filter((v) => v !== null);
      const sts = Calc.stats(vals);
      const bins = [[0, 4], [4, 8], [8, 10], [10, 12], [12, 14], [14, 16], [16, 20.01]];
      clear(statsBox);
      appendChildren(statsBox, [
        h('div', { class: 'grid-3' },
          h('div', { class: 'mini-stat' }, h('b', null, FMT.note(sts.avg)), h('span', null, 'Moyenne')), h('div', { class: 'mini-stat' }, h('b', null, FMT.note(sts.med)), h('span', null, 'Médiane')),
          h('div', { class: 'mini-stat' }, h('b', null, sts.n ? sts.above + ' / ' + sts.n : '—'), h('span', null, 'Notes ≥ 10')),
          h('div', { class: 'mini-stat' }, h('b', null, FMT.note(sts.min)), h('span', null, 'Minimum')), h('div', { class: 'mini-stat' }, h('b', null, FMT.note(sts.max)), h('span', null, 'Maximum')),
          h('div', { class: 'mini-stat' }, h('b', null, (Object.keys(sheet.notes).filter((k) => students.find((s) => s.id === k)).length) + ' / ' + students.length), h('span', null, 'Saisies'))),
        UI.barChart({ label: 'Histogramme des notes', width: 360, height: 200, padLeft: 28, data: bins.map(([a, b]) => ({ label: a + '–' + Math.floor(b), value: vals.filter((v) => v >= a && v < b).length, tone: a < 8 ? 'danger' : a < 10 ? 'warn' : '' })), showValues: true, axisFormat: (v) => FMT.num(v, 0) })
      ]);
    };

    const inputs = [];
    const focusCell = (i) => { const el = inputs[Math.max(0, Math.min(inputs.length - 1, i))]; if (el) { el.focus(); el.select(); } };
    const tbody = h('tbody');
    students.forEach((s, i) => {
      const v = sheet.notes[s.id];
      const inp = h('input', { class: 'cell-input' + (typeof v === 'string' ? ' is-special' : ''), inputmode: 'decimal', value: v === undefined ? '' : (typeof v === 'number' ? FMT.num(v, 2).replace(',00', '') : v), disabled: !editable,
        'aria-label': 'Note de ' + s.prenom + ' ' + s.nom, autocomplete: 'off' });
      inp.addEventListener('input', () => {
        const p = Calc.parseNote(inp.value);
        if (!p.ok) { inp.setAttribute('aria-invalid', 'true'); inp.title = p.error; errors[s.id] = p.error; live.textContent = s.prenom + ' ' + s.nom + ' : ' + p.error; return; }
        inp.removeAttribute('aria-invalid'); inp.title = ''; delete errors[s.id];
        inp.classList.toggle('is-special', typeof p.value === 'string');
        if (p.value === undefined) delete sheet.notes[s.id]; else sheet.notes[s.id] = p.value;
        if (sheet.statut === 'attente') { sheet.statut = 'brouillon'; }
        tr.classList.toggle('is-low', typeof p.value === 'number' && p.value < 8);
        drawStats();
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusCell(i + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(i - 1); }
      });
      inputs.push(inp);
      const tr = h('tr', { class: typeof v === 'number' && v < 8 ? 'is-low' : null },
        h('td', { class: 'num muted' }, String(i + 1)),
        h('td', null, h('div', { class: 'row-s' }, UI.avatar(s, 's'), h('span', { class: 'strong' }, s.nom.toUpperCase() + ' ' + s.prenom))),
        h('td', { class: 'muted' }, s.matricule), h('td', null, 'Gr. ' + s.groupe),
        h('td', { class: 'cell' }, inp));
      tbody.appendChild(tr);
    });
    drawStats();

    const exportCsv = () => {
      const rows = [['Matricule', 'Nom', 'Prénom', 'Groupe', ecue.id + ' ' + st.eval]].concat(students.map((s) => [s.matricule, s.nom, s.prenom, s.groupe, sheet.notes[s.id] === undefined ? '' : String(sheet.notes[s.id]).replace('.', ',')]));
      UI.download('notes-' + ecue.id + '-' + st.eval + '.csv', toCSV(rows), 'text/csv;charset=utf-8');
      UI.toast('Fichier CSV exporté.', 'success');
    };
    const importCsv = () => {
      UI.modal({ title: 'Importer un fichier CSV', body: (api) => h('div', { class: 'stack' }, h('p', { class: 'small muted' }, 'Colonnes attendues : Matricule ; Note. Les notes invalides sont signalées et ignorées.'),
        UI.upload({ accept: ['csv'], maxMo: 1, label: 'Fichier CSV', demoName: 'notes-' + ecue.id + '-' + st.eval + '.csv', demoKo: 2, onFile: () => {
          setTimeout(() => {
            let n = 0;
            students.forEach((s) => { if (sheet.notes[s.id] === undefined) { sheet.notes[s.id] = Math.max(0, Math.min(20, Math.round((8 + Math.random() * 9) * 4) / 4)); n += 1; } });
            if (sheet.statut === 'attente') sheet.statut = 'brouillon';
            api.close(); UI.toast(n + ' notes importées, 0 ligne rejetée. Vérifiez la grille avant de soumettre.', 'success', 'Import CSV'); App.refresh();
          }, 500);
        } }))
      });
    };
    const submit = () => {
      if (!App.guard('notes.saisir')) return;
      if (Object.keys(errors).length) { UI.toast('Corrigez les cellules en rouge avant de soumettre.', 'error'); return; }
      const missing = K.promo().filter((s) => sheet.notes[s.id] === undefined);
      if (missing.length) { UI.toast(missing.length + ' note(s) manquante(s) sur la promotion. Saisissez ABS pour un absent ou DISP pour un dispensé.', 'warning'); return; }
      UI.confirm({ title: 'Soumettre à la Scolarité ?', message: 'Les ' + K.promo().length + ' notes de « ' + ecue.nom + ' — ' + EVAL_LABELS[st.eval] + ' » seront envoyées pour validation. Vous ne pourrez plus les modifier.', confirmLabel: 'Soumettre' }).then((ok) => {
        if (!ok) return;
        sheet.statut = 'soumise'; sheet.soumisLe = nowStamp();
        App.audit('Notes soumises', ecue.id + ' · ' + st.eval + ' · L2 Info', 'brouillon', 'soumise', '');
        App.notify('a1', 'note', 'Notes soumises', K.name(me, true) + ' a soumis « ' + ecue.nom + ' — ' + EVAL_LABELS[st.eval] + ' ».', '#/scolarite/validation');
        UI.toast('Notes soumises à la Scolarité.', 'success'); App.refresh();
      });
    };

    const statusKey = sheet.statut === 'validee' ? 'validee_sco' : sheet.statut;
    return h('div', { class: 'stack-l' },
      UI.pageHead({ title: 'Saisie des notes', sub: 'Saisie au clavier : Entrée ou flèches pour changer de ligne. Notes de 0 à 20 au quart de point, ABS ou DISP.',
        actions: [UI.button({ label: 'Importer CSV', icon: 'upload', variant: 'secondary', disabled: !editable, onClick: importCsv }), UI.button({ label: 'Exporter CSV', icon: 'download', variant: 'secondary', onClick: exportCsv })] }),
      UI.card({ ariaLabel: 'Sélection' }, h('div', { class: 'form-grid cols-3' },
        h('div', { class: 'field' }, h('label', { class: 'label', for: 'sel-ecue' }, 'ECUE'), UI.select(ecues.map((e) => ({ value: e.id, label: e.id + ' — ' + e.nom + ' (' + e.ue.semestre + ')' })), st.ecue, (v) => { st.ecue = v; App.refresh(); }, { id: 'sel-ecue' })),
        h('div', { class: 'field' }, h('label', { class: 'label', for: 'sel-grp' }, 'Groupe'), UI.select([{ value: 'all', label: 'Toute la promotion' }, { value: 'A', label: 'Groupe A' }, { value: 'B', label: 'Groupe B' }], st.groupe, (v) => { st.groupe = v; App.refresh(); }, { id: 'sel-grp' })),
        h('div', { class: 'field' }, h('label', { class: 'label', for: 'sel-ev' }, 'Évaluation'), UI.select(evals.map((ev) => ({ value: ev, label: EVAL_LABELS[ev] })), st.eval, (v) => { st.eval = v; App.refresh(); }, { id: 'sel-ev' })))),
      h('div', { class: 'row-between wrap' },
        h('div', { class: 'row-s wrap' }, UI.steps(['Brouillon', 'Soumise', 'Validée par la Scolarité'], sheet.statut === 'validee' ? 3 : sheet.statut === 'soumise' ? 1 : 0)),
        h('div', { class: 'row-s wrap' }, sheet.statut === 'renvoyee' ? UI.status(statusKey) : null, sheet.dateLimite && editable ? UI.badge('Date limite : ' + FMT.date(sheet.dateLimite), DT.diffDays(sheet.dateLimite, DT.rel(0)) <= 4 ? 'warning' : 'neutral', 'clock') : null)),
      sheet.statut === 'renvoyee' ? UI.alert('danger', 'Renvoyée par la Scolarité', sheet.commentaire || 'Corrections demandées.') : null,
      !editable ? UI.alert(sheet.statut === 'validee' ? 'success' : 'info', sheet.statut === 'validee' ? 'Notes validées et verrouillées' : 'En attente de validation', sheet.statut === 'validee' ? 'Publiées le ' + FMT.dateTime(sheet.valideLe) + '. Toute modification passe par la Scolarité et est tracée dans le journal d\'audit.' : 'Soumises le ' + FMT.dateTime(sheet.soumisLe) + '. La Scolarité peut les valider ou vous les renvoyer.') : null,
      h('div', { class: 'grid-main' },
        h('div', { class: 'stack' }, h('div', { class: 'sheet-wrap' }, h('table', { class: 'sheet', 'aria-label': 'Grille de saisie des notes' },
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'N°'), h('th', { scope: 'col' }, 'Étudiant'), h('th', { scope: 'col' }, 'Matricule'), h('th', { scope: 'col' }, 'Groupe'), h('th', { scope: 'col', class: 'right' }, st.eval + ' / 20'))), tbody)), live,
          editable ? h('div', { class: 'form-actions' }, UI.button({ label: 'Enregistrer le brouillon', variant: 'secondary', icon: 'check', onClick: () => UI.toast('Brouillon enregistré (' + Object.keys(sheet.notes).length + ' notes).', 'success') }),
            UI.button({ label: 'Soumettre à la Scolarité', icon: 'send', onClick: submit })) : null),
        UI.card({ title: 'Statistiques en direct' }, statsBox)));
  }
});

/* ---------- 5. Cahier de textes ---------- */
defineScreen('enseignant', 'cahier', {
  title: 'Cahier de textes',
  render(ctx) {
    const me = ctx.me;
    const mine = K.ecuesOfTeacher(me.id).map((e) => e.id);
    const seances = K.sessionsFor(me, DT.rel(-10), DT.rel(0)).filter((c) => c.statut !== 'annule' && c.ecueId && DT.toDate(c.date, c.debut) <= new Date()).reverse();
    const entries = App.store.cahier.filter((c) => mine.includes(c.ecueId)).sort((a, b) => b.date.localeCompare(a.date));
    const form = () => {
      const seance = UI.field({ label: 'Séance', as: 'select', required: true, options: [{ value: '', label: 'Choisir…' }].concat(seances.map((c) => ({ value: c.id, label: sessionLabel(c) }))) });
      const contenu = UI.field({ label: 'Contenu de la séance', as: 'textarea', rows: 4, required: true, maxlength: 1500, placeholder: 'Notions abordées, exercices, chapitres…' });
      const withDevoir = UI.toggle('Donner un devoir', false, (v) => { devBox.hidden = !v; });
      const titre = UI.field({ label: 'Titre du devoir', maxlength: 120 });
      const consignes = UI.field({ label: 'Consignes', as: 'textarea', rows: 3, maxlength: 1500 });
      const limite = UI.datePicker({ label: 'Date limite', min: DT.rel(1), value: DT.rel(7) });
      let piece = null;
      const devBox = h('div', { class: 'stack', hidden: true }, titre.el, consignes.el, limite.el, h('div', { class: 'field' }, h('span', { class: 'label' }, 'Pièce jointe (facultatif)'), UI.upload({ accept: ['pdf', 'docx', 'zip'], maxMo: 10, demoName: 'enonce.pdf', onFile: (f) => { piece = f; } })));
      UI.modal({ title: 'Remplir le cahier de textes', size: 'l', body: h('div', { class: 'stack' }, seance.el, contenu.el, withDevoir, devBox),
        actions: (api) => [UI.button({ label: 'Annuler', variant: 'secondary', onClick: () => api.close() }), UI.button({ label: 'Publier', icon: 'send', onClick: () => {
          let ok = seance.setError(seance.input.value ? null : 'Choisissez la séance.');
          ok = contenu.setError(contenu.input.value.trim().length >= 10 ? null : 'Décrivez la séance (10 caractères minimum).') && ok;
          const dev = !devBox.hidden;
          if (dev) {
            ok = titre.setError(titre.input.value.trim() ? null : 'Indiquez un titre.') && ok;
            ok = consignes.setError(consignes.input.value.trim() ? null : 'Indiquez les consignes.') && ok;
            ok = limite.setError(limite.input.value > DT.rel(0) ? null : 'La date limite doit être future.') && ok;
          }
          if (!ok || !App.guard('cahier.remplir')) return;
          const c = App.store.sessions.find((x) => x.id === seance.input.value);
          let devoirId = null;
          if (dev) {
            devoirId = 'dv' + Date.now();
            App.store.devoirs.push({ id: devoirId, ecueId: c.ecueId, titre: titre.input.value.trim(), consignes: consignes.input.value.trim(), dateLimite: limite.input.value, heureLimite: '23:59', pieces: piece ? [piece.name] : [], rendus: {} });
            studentsOfGroup(c.groupe).forEach((s) => App.notify(s.id, 'devoir', 'Nouveau devoir : ' + titre.input.value.trim(), K.ecueName(c.ecueId) + ' · à rendre le ' + FMT.date(limite.input.value) + '.', '#/etudiant/devoirs'));
          }
          App.store.cahier.unshift({ id: 'ct' + Date.now(), ecueId: c.ecueId, date: c.date, contenu: contenu.input.value.trim(), devoirId });
          api.close(); UI.toast(dev ? 'Séance et devoir publiés. Les étudiants ont été notifiés.' : 'Séance ajoutée au cahier de textes.', 'success'); App.refresh();
        } })] });
    };
    const done = new Set(entries.map((e) => e.ecueId + e.date));
    const missing = seances.filter((c) => !done.has(c.ecueId + c.date));
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Cahier de textes', sub: 'Contenu des séances et devoirs donnés, visibles par les étudiants.', actions: UI.button({ label: 'Remplir une séance', icon: 'plus', onClick: form }) }),
      missing.length ? UI.alert('warning', FMT.plural(missing.length, 'séance') + ' sans contenu', missing.slice(0, 3).map(sessionLabel).join(' · ')) : null,
      UI.card({ title: 'Séances renseignées' }, h('ul', { class: 'timeline' }, entries.map((c) => h('li', null, h('div', { class: 'row-s wrap' }, UI.subject(K.ecue(c.ecueId)), h('span', { class: 'xsmall muted' }, capitalize(FMT.dateShort(c.date)))),
        h('p', { style: { marginTop: '4px' } }, c.contenu), c.devoirId ? UI.badge('Devoir : ' + (App.store.devoirs.find((d) => d.id === c.devoirId) || {}).titre, 'info', 'book') : null)))));
  }
});

/* ---------- 6. Correction des devoirs ---------- */
function gradeModal(d, s, r) {
  const note = UI.field({ label: 'Note sur 20', inputmode: 'decimal', value: r.note !== null && r.note !== undefined ? String(r.note).replace('.', ',') : '', required: true });
  const com = UI.field({ label: 'Commentaire pour l\'étudiant', as: 'textarea', rows: 3, value: r.commentaire || '', maxlength: 800 });
  UI.modal({ title: 'Corriger — ' + s.prenom + ' ' + s.nom, body: h('div', { class: 'stack' },
    h('div', { class: 'file-chip' }, icon('paperclip', 16), h('span', { class: 'grow' }, r.fichier), h('span', { class: 'xsmall muted' }, FMT.size(r.tailleKo)), UI.button({ label: 'Ouvrir', size: 's', variant: 'ghost', onClick: () => UI.toast('Aperçu du fichier (simulation).', 'info') })),
    r.message ? UI.alert('neutral', 'Message de l\'étudiant', r.message) : null, note.el, com.el),
  actions: (api) => [UI.button({ label: 'Annuler', variant: 'secondary', onClick: () => api.close() }), UI.button({ label: 'Enregistrer la note', icon: 'check', onClick: () => {
    const p = Calc.parseNote(note.input.value);
    if (!p.ok || typeof p.value !== 'number') { note.setError(p.ok ? 'Saisissez une note numérique.' : p.error); return; }
    if (!App.guard('devoir.corriger')) return;
    r.note = p.value; r.commentaire = com.input.value.trim();
    App.notify(s.id, 'devoir', 'Devoir corrigé', d.titre + ' : ' + FMT.note(p.value) + ' / 20.', '#/etudiant/devoirs');
    api.close(); UI.toast('Note enregistrée et transmise à l\'étudiant.', 'success'); App.refresh();
  } })] });
}

defineScreen('enseignant', 'corrections', {
  title: 'Correction des devoirs',
  render(ctx) {
    const me = ctx.me;
    const mes = App.store.devoirs.filter((d) => K.ecue(d.ecueId).ens === me.id).sort((a, b) => b.dateLimite.localeCompare(a.dateLimite));
    if (!mes.find((d) => d.id === Ens.devoir)) Ens.devoir = mes[0] && mes[0].id;
    const d = mes.find((x) => x.id === Ens.devoir);
    if (!d) return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Correction des devoirs' }), UI.empty({ title: 'Aucun devoir' }));
    const rows = Object.keys(d.rendus).map((sid) => ({ s: K.user(sid), r: d.rendus[sid], late: d.rendus[sid].date.slice(0, 10) > d.dateLimite }));
    const nonRendus = K.promo().length - rows.length;
    const aCorriger = rows.filter((x) => x.r.note === null || x.r.note === undefined).length;
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Correction des devoirs' }),
      h('div', { class: 'field', style: { maxWidth: '560px' } }, h('label', { class: 'label', for: 'sel-dev' }, 'Devoir'),
        UI.select(mes.map((x) => ({ value: x.id, label: x.titre + ' — ' + K.ecueName(x.ecueId) + ' (limite ' + FMT.date(x.dateLimite) + ')' })), d.id, (v) => { Ens.devoir = v; App.refresh(); }, { id: 'sel-dev' })),
      h('div', { class: 'grid-4' }, UI.kpi({ label: 'Rendus', icon: 'inbox', value: rows.length + ' / ' + K.promo().length }), UI.kpi({ label: 'À corriger', icon: 'edit', value: String(aCorriger) }),
        UI.kpi({ label: 'Rendus en retard', icon: 'alert', value: String(rows.filter((x) => x.late).length) }), UI.kpi({ label: 'Non rendus', icon: 'xCircle', value: String(nonRendus), foot: d.dateLimite < DT.rel(0) ? 'Délai dépassé' : 'Délai en cours' })),
      UI.card({ title: 'Rendus', flush: true }, UI.table({
        searchKeys: [(x) => x.s.prenom + ' ' + x.s.nom], searchPlaceholder: 'Rechercher un étudiant…',
        filters: [{ id: 'st', label: 'Tous les rendus', options: [{ value: 'todo', label: 'À corriger' }, { value: 'done', label: 'Corrigés' }, { value: 'late', label: 'En retard' }],
          test: (x, v) => v === 'todo' ? x.r.note === null || x.r.note === undefined : v === 'done' ? x.r.note !== null && x.r.note !== undefined : x.late }],
        columns: [
          { key: 'n', label: 'Étudiant', sortable: true, sortValue: (x) => x.s.nom, render: (x) => h('div', { class: 'row-s' }, UI.avatar(x.s, 's'), h('span', { class: 'cell-main' }, x.s.prenom + ' ' + x.s.nom)) },
          { key: 'd', label: 'Déposé le', sortable: true, sortValue: (x) => x.r.date, render: (x) => h('div', { class: 'row-s wrap' }, FMT.dateTime(x.r.date), x.late ? UI.status('en_retard') : null) },
          { key: 'f', label: 'Fichier', render: (x) => h('span', { class: 'small' }, x.r.fichier) },
          { key: 'note', label: 'Note', num: true, sortable: true, sortValue: (x) => x.r.note ?? -1, render: (x) => x.r.note === null || x.r.note === undefined ? UI.badge('À corriger', 'warning') : scoreEl(x.r.note) },
          { key: 'a', label: '', render: (x) => UI.button({ label: x.r.note === null || x.r.note === undefined ? 'Corriger' : 'Modifier', size: 's', variant: 'secondary', onClick: () => gradeModal(d, x.s, x.r) }) }
        ], rows, sortKey: 'd', emptyTitle: 'Aucun rendu pour l\'instant' })));
  }
});

/* ---------- 7. Ressources (dépôt et organisation par chapitre) ---------- */
defineScreen('enseignant', 'ressources', {
  title: 'Ressources',
  render(ctx) {
    const me = ctx.me;
    const ecues = K.ecuesOfTeacher(me.id).filter((e) => e.ue.semestre === 'S4');
    const deposer = (ecueId) => {
      const ec = UI.field({ label: 'ECUE', as: 'select', value: ecueId || ecues[0].id, options: ecues.map((e) => ({ value: e.id, label: e.nom })) });
      const titre = UI.field({ label: 'Titre', required: true, maxlength: 120 });
      const chap = UI.field({ label: 'Chapitre', required: true, placeholder: 'Ex. Chapitre 5', value: 'Chapitre 5' });
      const type = UI.field({ label: 'Type', as: 'select', options: [{ value: 'pdf', label: 'PDF' }, { value: 'slides', label: 'Diaporama' }, { value: 'video', label: 'Vidéo' }, { value: 'lien', label: 'Lien' }] });
      let file = null;
      UI.modal({ title: 'Déposer un support de cours', body: h('div', { class: 'stack' }, ec.el, titre.el, h('div', { class: 'form-grid cols-2' }, chap.el, type.el),
        UI.upload({ accept: ['pdf', 'pptx', 'mp4', 'docx'], maxMo: 100, demoName: 'chapitre5.pdf', demoKo: 1250, onFile: (f) => { file = f; } }),
        UI.alert('neutral', null, 'Astuce connexion lente : préférez le PDF au diaporama, et compressez les vidéos (720p maximum).')),
      actions: (api) => [UI.button({ label: 'Annuler', variant: 'secondary', onClick: () => api.close() }), UI.button({ label: 'Publier', icon: 'upload', onClick: () => {
        let ok = titre.setError(titre.input.value.trim() ? null : 'Indiquez un titre.');
        ok = chap.setError(chap.input.value.trim() ? null : 'Indiquez le chapitre.') && ok;
        if (type.input.value !== 'lien' && !file) { UI.toast('Choisissez un fichier à déposer.', 'warning'); ok = false; }
        if (!ok || !App.guard('ressource.deposer')) return;
        App.store.ressources.unshift({ id: 'r' + Date.now(), ecueId: ec.input.value, titre: titre.input.value.trim(), type: type.input.value, tailleKo: type.input.value === 'lien' ? 0 : file.sizeKo, date: DT.rel(0), chapitre: chap.input.value.trim(), auteur: me.id });
        studentsOfGroup('all').forEach((s) => App.notify(s.id, 'ressource', 'Nouvelle ressource', titre.input.value.trim() + ' (' + K.ecueName(ec.input.value) + ').', '#/etudiant/ressources'));
        api.close(); UI.toast('Support publié et visible par les étudiants.', 'success'); App.refresh();
      } })] });
    };
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Mes ressources', sub: 'Supports organisés par chapitre.', actions: UI.button({ label: 'Déposer un support', icon: 'upload', onClick: () => deposer() }) }),
      ecues.map((e) => {
        const res = App.store.ressources.filter((r) => r.ecueId === e.id);
        const chaps = Array.from(new Set(res.map((r) => r.chapitre))).sort();
        return UI.card({ title: e.nom, actions: [h('span', { class: 'xsmall muted' }, FMT.plural(res.length, 'support')), UI.button({ label: 'Ajouter', size: 's', variant: 'ghost', icon: 'plus', onClick: () => deposer(e.id) })] },
          chaps.length ? h('div', { class: 'stack' }, chaps.map((ch) => h('div', null, h('div', { class: 'nav-group-title', style: { padding: '6px 0' } }, ch),
            h('ul', { class: 'list' }, res.filter((r) => r.chapitre === ch).map((r) => h('li', { class: 'list-item wrap' }, Commun.resIcon(r.type),
              h('div', { class: 'grow' }, h('div', { class: 'list-title' }, r.titre), h('div', { class: 'list-meta' }, FMT.size(r.tailleKo) + ' · ' + FMT.date(r.date))),
              UI.select(chaps.concat(['Chapitre 5', 'Révisions']).filter((v, i, a) => a.indexOf(v) === i).map((x) => ({ value: x, label: x })), r.chapitre, (v) => { r.chapitre = v; UI.toast('Déplacé dans « ' + v + ' ».', 'success'); App.refresh(); }, { 'aria-label': 'Chapitre de ' + r.titre, class: 'select select-s', style: { width: 'auto' } }),
              UI.button({ label: 'Supprimer', icon: 'trash', iconOnly: true, size: 's', variant: 'ghost', onClick: () => UI.confirm({ title: 'Supprimer ce support ?', message: '« ' + r.titre + ' » ne sera plus visible par les étudiants.', confirmLabel: 'Supprimer', danger: true }).then((ok) => { if (ok) { App.store.ressources = App.store.ressources.filter((x) => x.id !== r.id); UI.toast('Support supprimé.', 'success'); App.refresh(); } }) })))))))
            : UI.empty({ title: 'Aucun support', text: 'Déposez votre premier support pour cette ECUE.' }));
      }));
  }
});

/* ---------- 8. Statistiques de mes classes ---------- */
defineScreen('enseignant', 'statistiques', {
  title: 'Statistiques',
  render(ctx) {
    const me = ctx.me;
    const ecues = K.ecuesOfTeacher(me.id);
    if (!ecues.find((e) => e.id === Ens.statsEcue)) Ens.statsEcue = ecues[0].id;
    const e = K.ecue(Ens.statsEcue);
    const promo = K.promo();
    const lastSheet = ['EXAM', 'CC2', 'CC1'].map((ev) => K.sheet(e.id, ev)).find((f) => f && f.statut === 'validee');
    const vals = lastSheet ? promo.map((s) => Calc.value(lastSheet.notes[s.id])).filter((v) => v !== null) : [];
    const st = Calc.stats(vals);
    const absByStudent = {};
    App.store.absences.filter((a) => a.ecueId === e.id && a.type === 'absence').forEach((a) => { absByStudent[a.sid] = (absByStudent[a.sid] || 0) + 1; });
    const nbSeances = Math.max(1, App.store.sessions.filter((c) => c.ecueId === e.id && c.date <= DT.rel(0) && c.statut !== 'annule').length) * 2;
    const totalAbs = Object.values(absByStudent).reduce((a, b) => a + b, 0);
    const assiduite = 100 - (totalAbs / (nbSeances * promo.length / 2)) * 100;
    const difficulte = promo.map((s) => {
      const n = K.notesOf(s.id, e.id);
      const cc = Calc.cc(n.cc1, n.cc2);
      const moy = Calc.ecue(n, App.store.parametres, 'normale').moy;
      return { s, ref: moy !== null ? moy : cc, abs: absByStudent[s.id] || 0 };
    }).filter((x) => (x.ref !== null && x.ref < 8) || x.abs >= 2).sort((a, b) => (a.ref ?? 20) - (b.ref ?? 20));
    const bins = [[0, 4], [4, 8], [8, 10], [10, 12], [12, 14], [14, 16], [16, 20.01]];
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Statistiques de mes classes', actions: UI.select(ecues.map((x) => ({ value: x.id, label: x.nom + ' (' + x.ue.semestre + ')' })), e.id, (v) => { Ens.statsEcue = v; App.refresh(); }, { 'aria-label': 'ECUE', class: 'select' }) }),
      h('div', { class: 'grid-4' },
        UI.kpi({ label: 'Assiduité', icon: 'userCheck', value: FMT.pct(Math.max(0, assiduite), 1), foot: totalAbs + ' absence(s) enregistrée(s)' }),
        UI.kpi({ label: 'Moyenne (' + (lastSheet ? EVAL_LABELS[lastSheet.eval] : '—') + ')', icon: 'award', value: FMT.note(st.avg), foot: 'Médiane ' + FMT.note(st.med) }),
        UI.kpi({ label: 'Taux de réussite', icon: 'checkCircle', value: st.n ? FMT.pct(st.above / st.n * 100) : '—', foot: st.above + ' étudiants ≥ 10' }),
        UI.kpi({ label: 'En difficulté', icon: 'alert', value: String(difficulte.length), foot: 'Moyenne < 8 ou ≥ 2 absences' })),
      h('div', { class: 'grid-2' },
        UI.card({ title: 'Distribution des notes', actions: lastSheet ? UI.badge(EVAL_LABELS[lastSheet.eval], 'neutral') : null }, lastSheet ? UI.barChart({ label: 'Distribution des notes', width: 420, height: 220, data: bins.map(([a, b]) => ({ label: a + '–' + Math.floor(b), value: vals.filter((v) => v >= a && v < b).length, tone: a < 8 ? 'danger' : a < 10 ? 'warn' : '' })), axisFormat: (v) => FMT.num(v, 0) }) : UI.empty({ title: 'Aucune note validée' })),
        UI.card({ title: 'Étudiants en difficulté', flush: true }, UI.table({ columns: [
          { key: 'n', label: 'Étudiant', render: (x) => h('div', { class: 'row-s' }, UI.avatar(x.s, 's'), x.s.prenom + ' ' + x.s.nom) },
          { key: 'm', label: 'Moyenne', num: true, render: (x) => scoreEl(x.ref) },
          { key: 'a', label: 'Absences', num: true, render: (x) => x.abs ? UI.badge(String(x.abs), x.abs >= App.store.parametres.seuilAbsences ? 'danger' : 'warning') : '0' },
          { key: 'c', label: '', render: (x) => UI.button({ label: 'Écrire', size: 's', variant: 'ghost', icon: 'message', onClick: () => {
            let c = App.store.conversations.find((cv) => cv.type === 'individuel' && cv.participants.includes(me.id) && cv.participants.includes(x.s.id));
            if (!c) { c = { id: 'cv' + Date.now(), type: 'individuel', titre: null, participants: [me.id, x.s.id], messages: [{ id: 'm' + Date.now(), from: me.id, text: 'Bonjour ' + x.s.prenom + ', pouvons-nous faire un point sur ' + e.nom + ' ?', date: nowStamp(), luPar: [me.id] }] }; App.store.conversations.push(c); }
            Commun.msg.current = c.id; App.go('#/enseignant/messages');
          } }) }
        ], rows: difficulte, emptyTitle: 'Aucun étudiant en difficulté', emptyText: 'Toute la classe est au-dessus des seuils.' }))));
  }
});

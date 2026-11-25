'use strict';
/*
 * Espace Scolarité / Administration — utilisatrice de démo : Mme Mariam Compaoré, cheffe du service.
 */
const Sco = { ficheTab: 'infos', edt: { mode: 'filiere', salle: 's104', ens: 't1', pending: 0 }, delib: { sem: 'S3', session: 'normale' }, fin: 'suivi', relance: {}, formOpen: { info: true, 'info-L2': true, 'info-L2-S3': true } };
const NIVEAUX = ['L1', 'L2', 'L3', 'M1', 'M2'];
const filiereOpts = () => App.store.formation.filieres.map((f) => ({ value: f.id, label: f.nom }));

/* ---------- 1. Tableau de bord ---------- */
function recouvrementParMois() {
  const now = DT.today();
  const months = [];
  for (let i = 3; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ key: d.getFullYear() + '-' + DT.pad(d.getMonth() + 1), label: capitalize(FMT.monthShort(d)).replace('.', ''), value: 0 }); }
  App.store.transactions.forEach((t) => { const m = months.find((x) => x.key === t.date.slice(0, 7)); if (m) m.value += t.montant; });
  return months;
}
function weekConflicts() {
  const m = DT.mondayOf(DT.today());
  return K.conflicts(App.store.sessions.filter((c) => c.date >= DT.iso(m) && c.date <= DT.iso(DT.add(m, 13))));
}

defineScreen('scolarite', 'accueil', {
  title: 'Tableau de bord',
  render(ctx) {
    const eff = App.store.effectifs;
    const total = eff.info + eff.droit + eff.eco;
    const rec = K.recouvrement();
    const promo = K.promo();
    const assid = promo.reduce((a, s) => a + K.absenceStats(s.id).taux, 0) / promo.length;
    const pend = K.pendingValidations();
    const conflicts = weekConflicts();
    const impayes = K.students().filter((s) => s.actif && K.paymentStatus(s.id) === 'impaye');
    const lateSheets = App.store.sheets.filter((f) => f.statut === 'brouillon' && f.dateLimite && DT.diffDays(f.dateLimite, DT.rel(0)) <= 4);
    const alerts = [];
    // Conflits regroupés par salle (ou enseignant) : « 2 conflits — Salle 104 »
    const groups = {};
    conflicts.forEach((c) => { const key = c.type === 'salle' ? K.salle(c.a.salle).nom : K.sessionTeacher(c.a); (groups[key] = groups[key] || []).push(c); });
    Object.keys(groups).forEach((key) => {
      const list = groups[key];
      alerts.push(['danger', 'door', (list.length > 1 ? list.length + ' conflits' : 'Conflit') + ' — ' + key,
        list.map((c) => capitalize(FMT.dateShort(c.a.date)) + ' ' + c.a.debut).join(' · ') + ' : ' + K.sessionTitle(list[0].a) + ' / ' + K.sessionTitle(list[0].b), '#/scolarite/emplois-du-temps']);
    });
    lateSheets.forEach((f) => alerts.push(['warning', 'edit', 'Saisie attendue — ' + K.ecueName(f.ecueId) + ' (' + f.eval + ')', K.name(K.user(f.ens), true) + ' · date limite ' + FMT.date(f.dateLimite), '#/scolarite/validation']));
    if (impayes.length) alerts.push(['danger', 'wallet', impayes.length + ' étudiants avec une tranche en retard', 'Montant exigible : ' + FMT.money(impayes.reduce((a, s) => a + K.paymentSummary(s.id).retard.reduce((b, t) => b + t.reste, 0), 0)), '#/scolarite/finances']);
    if (K.pendingJustifs()) alerts.push(['warning', 'clock', K.pendingJustifs() + ' justificatif(s) d\'absence à valider', 'L2 Informatique', '#/scolarite/absences']);
    if (K.pendingDemandes()) alerts.push(['info', 'inbox', K.pendingDemandes() + ' demande(s) administrative(s) en attente', 'Attestations et certificats', '#/scolarite/demandes']);
    return h('div', { class: 'stack-l' },
      h('div', { class: 'hello' }, h('div', null, h('p', { class: 'date' }, capitalize(FMT.dateLong(DT.rel(0)))), h('h1', null, 'Bonjour, ' + K.name(ctx.me, true))),
        h('div', { class: 'row-s wrap' }, UI.badge('Année ' + App.store.universite.annee, 'accent', 'calendar'), UI.button({ label: 'Nouvelle annonce', icon: 'megaphone', size: 's', variant: 'secondary', href: '#/scolarite/annonces' }))),
      h('div', { class: 'grid-4' },
        UI.kpi({ label: 'Étudiants inscrits', icon: 'users', value: FMT.int(total), countTo: total, foot: [h('span', { class: 'trend-up' }, icon('arrowUp', 12), '+4,2 %'), ' vs ' + '2024-2025'] }),
        UI.kpi({ label: 'Assiduité (L2 Info)', icon: 'userCheck', value: FMT.pct(assid, 1), foot: 'Semestre 4, toutes matières' }),
        UI.kpi({ label: 'Recouvrement des frais', icon: 'wallet', value: FMT.pct(rec.taux, 1), foot: h('span', { class: 'grow' }, UI.progress(rec.taux, 100, rec.taux < 60 ? 'warn' : null, 'Taux de recouvrement'), FMT.money(rec.paye) + ' sur ' + FMT.money(rec.du) + ' exigibles') }),
        UI.kpi({ label: 'Notes à valider', icon: 'checks', value: String(pend), countTo: pend, foot: h('a', { href: '#/scolarite/validation' }, 'Ouvrir la file de validation') })),
      h('div', { class: 'grid-main' },
        h('div', { class: 'stack' },
          h('div', { class: 'grid-2' },
            UI.card({ title: 'Recouvrement par mois' }, UI.barChart({ label: 'Montants encaissés par mois (FCFA)', width: 320, height: 200, padLeft: 30,
              showZero: true, data: recouvrementParMois().map((m, i, arr) => Object.assign(m, { tone: i === arr.length - 1 ? 'current' : '' })), format: (v) => v ? FMT.num(v / 1e6, 1) + ' M' : '0', axisFormat: (v) => FMT.num(v / 1e6, 0) + ' M' })),
            // Trois valeurs seulement : des chiffres et une part, plutôt qu'un graphique.
            UI.card({ title: 'Effectifs par filière' }, h('ul', { class: 'list' }, [['Informatique', eff.info], ['Droit', eff.droit], ['Économie et gestion', eff.eco]].map(([lbl, v]) => h('li', { class: 'list-item' },
              h('div', { class: 'grow stack-s', style: { gap: '6px' } }, h('div', { class: 'row-between' }, h('span', { class: 'small' }, lbl), h('span', { class: 'strong num' }, FMT.int(v))), UI.progress(v, total, null, lbl))))))),
          UI.card({ title: 'Activité récente', actions: UI.button({ label: 'Journal d\'audit', size: 's', variant: 'ghost', href: '#/scolarite/audit' }) }, h('ul', { class: 'list' }, App.store.audit.slice(0, 5).map((a) => h('li', { class: 'list-item' }, UI.avatar(K.user(a.uid), 's'),
            h('div', { class: 'grow' }, h('div', { class: 'list-title' }, a.action + ' — ' + a.cible), h('div', { class: 'list-meta' }, K.name(K.user(a.uid), true) + ' · ' + FMT.relative(a.date)))))))),
        UI.card({ title: 'Alertes', actions: UI.badge(String(alerts.length), 'neutral') }, alerts.length ? h('ul', { class: 'list' }, alerts.map(([tone, ic, t, sub, href]) => h('li', null, h('a', { class: 'list-btn', href },
          h('span', { class: 'list-icon ' + tone }, icon(ic, 18)), h('span', { class: 'grow' }, h('span', { class: 'list-title', style: { display: 'block' } }, t), h('span', { class: 'list-meta' }, sub)), icon('chevronRight', 16))))) : UI.empty({ title: 'Aucune alerte' }))));
  }
});

/* ---------- 2. Étudiants (liste, fiche, ajout) ---------- */
function attestationDoc(s, type) {
  const univ = App.store.universite;
  return h('div', { class: 'doc' }, UI.docHeader(univ, 'N° ' + (type === 'Certificat de scolarité' ? 'CS' : 'AI') + '-' + s.matricule.slice(-5) + '/' + new Date().getFullYear()),
    h('div', { class: 'doc-title' }, type || 'Attestation d\'inscription'),
    h('p', { style: { fontSize: '14px', lineHeight: '1.8', margin: '24px 0' } }, 'Je soussignée, Madame Mariam COMPAORÉ, cheffe du service de la Scolarité de l\'' + univ.nom + ', atteste que ',
      h('strong', null, (s.sexe === 'F' ? 'Mademoiselle ' : 'Monsieur ') + s.prenom + ' ' + s.nom.toUpperCase()), ', né' + (s.sexe === 'F' ? 'e' : '') + ' le ' + FMT.date(s.naissance) + ' à ' + s.lieuNaissance + ', matricule ', h('strong', null, s.matricule),
      ', est régulièrement inscrit' + (s.sexe === 'F' ? 'e' : '') + ' en ', h('strong', null, (s.niveau[0] === 'L' ? 'Licence ' : 'Master ') + s.niveau[1] + ' — ' + K.filiere(s.filiere).nom), ' au titre de l\'année universitaire ' + univ.annee + '.'),
    h('p', { style: { fontSize: '14px' } }, 'En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.'),
    docSignature(s.id + (type || '')), h('div', { class: 'watermark' }, 'Document généré par Kalanso — maquette de démonstration, sans valeur officielle.'));
}

function addStudentWizard() {
  if (!App.guard('etudiant.creer')) return;
  const data = { prenom: '', nom: '', sexe: 'F', naissance: '2005-01-15', lieu: 'Ouagadougou', filiere: 'info', niveau: 'L1', groupe: 'A', boursier: false, tel: '+226 ', email: '' };
  let step = 0;
  const labels = ['Identité', 'Inscription', 'Contact', 'Vérification'];
  const m = UI.modal({ title: 'Ajouter un étudiant', size: 'l', body: h('div') });
  const fields = {};
  const bind = (key, f) => { fields[key] = f; f.input.addEventListener('input', () => { data[key] = f.input.type === 'checkbox' ? f.input.checked : f.input.value; }); f.input.addEventListener('change', () => { data[key] = f.input.value; }); return f.el; };
  function draw() {
    const body = h('div', { class: 'stack' }, UI.steps(labels, step));
    if (step === 0) body.appendChild(h('div', { class: 'form-grid cols-2' },
      bind('prenom', UI.field({ label: 'Prénom(s)', required: true, value: data.prenom, autocomplete: 'off' })), bind('nom', UI.field({ label: 'Nom', required: true, value: data.nom })),
      bind('sexe', UI.field({ label: 'Sexe', as: 'select', value: data.sexe, options: [{ value: 'F', label: 'Féminin' }, { value: 'M', label: 'Masculin' }] })),
      bind('naissance', UI.datePicker({ label: 'Date de naissance', value: data.naissance, max: DT.rel(-365 * 15) })), bind('lieu', UI.field({ label: 'Lieu de naissance', value: data.lieu }))));
    if (step === 1) body.appendChild(h('div', { class: 'form-grid cols-2' },
      bind('filiere', UI.field({ label: 'Filière', as: 'select', value: data.filiere, options: filiereOpts() })), bind('niveau', UI.field({ label: 'Niveau', as: 'select', value: data.niveau, options: NIVEAUX.map((n) => ({ value: n, label: n })) })),
      bind('groupe', UI.field({ label: 'Groupe de TD', as: 'select', value: data.groupe, options: [{ value: 'A', label: 'Groupe A' }, { value: 'B', label: 'Groupe B' }] })),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Bourse'), UI.toggle('Étudiant boursier', data.boursier, (v) => { data.boursier = v; }))));
    if (step === 2) body.appendChild(h('div', { class: 'form-grid cols-2' },
      bind('tel', UI.field({ label: 'Téléphone', type: 'tel', value: data.tel, required: true, hint: 'Pour le code de double authentification et les SMS.' })),
      bind('email', UI.field({ label: 'E-mail personnel (facultatif)', type: 'email', value: data.email }))));
    if (step === 3) body.appendChild(UI.kv([['Nom', data.prenom + ' ' + data.nom.toUpperCase()], ['Naissance', FMT.date(data.naissance) + ' à ' + data.lieu], ['Inscription', K.filiere(data.filiere).nom + ' ' + data.niveau + ' · groupe ' + data.groupe], ['Boursier', data.boursier ? 'Oui' : 'Non'], ['Téléphone', data.tel], ['Matricule attribué', 'UHO-2026-0' + String(6000 + Object.keys(App.store.users).length)], ['Frais', FMT.money(450000) + ' en 3 tranches']]));
    m.setBody(body);
    const valid = () => {
      if (step === 0) { let ok = fields.prenom.setError(data.prenom.trim() ? null : 'Prénom obligatoire.'); ok = fields.nom.setError(data.nom.trim() ? null : 'Nom obligatoire.') && ok; return ok; }
      if (step === 2) { let ok = fields.tel.setError(Calc.phoneOk(data.tel) ? null : 'Format : +226 XX XX XX XX'); if (data.email) ok = fields.email.setError(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ? null : 'E-mail invalide.') && ok; return ok; }
      return true;
    };
    m.setActions([step > 0 ? UI.button({ label: 'Retour', variant: 'secondary', onClick: () => { step -= 1; draw(); } }) : UI.button({ label: 'Annuler', variant: 'secondary', onClick: () => m.close() }),
      UI.button({ label: step < 3 ? 'Continuer' : 'Créer le dossier', iconRight: step < 3 ? 'arrowRight' : null, icon: step === 3 ? 'check' : null, onClick: () => {
        if (!valid()) return;
        if (step < 3) { step += 1; draw(); return; }
        const id = 's' + (Object.keys(App.store.users).length + 100);
        const slugN = (x) => norm(x).replace(/[^a-z]+/g, '.');
        App.store.users[id] = { id, role: 'etudiant', prenom: data.prenom.trim(), nom: data.nom.trim(), sexe: data.sexe, matricule: 'UHO-2026-0' + String(6000 + Object.keys(App.store.users).length), filiere: data.filiere, niveau: data.niveau, groupe: data.groupe,
          email: data.email || slugN(data.prenom) + '.' + slugN(data.nom) + '@etu.uho.bf', tel: data.tel.trim(), naissance: data.naissance, lieuNaissance: data.lieu, statut: 'inscrit', actif: true, boursier: data.boursier, derniereConnexion: nowStamp() };
        App.audit('Étudiant créé', K.name(App.store.users[id]) + ' · ' + App.store.users[id].matricule, '', 'inscrit', '');
        m.close(); UI.toast('Dossier créé. Les identifiants ont été envoyés par SMS.', 'success'); App.go('#/scolarite/etudiants/' + id);
      } })]);
  }
  draw();
}

function studentFiche(s) {
  const tab = Sco.ficheTab;
  const sum = K.paymentSummary(s.id);
  let body;
  if (tab === 'infos') body = UI.card({ title: 'Informations' }, UI.kv([['Matricule', s.matricule], ['Nom et prénom', s.nom.toUpperCase() + ' ' + s.prenom], ['Sexe', s.sexe === 'F' ? 'Féminin' : 'Masculin'], ['Naissance', FMT.date(s.naissance) + ' à ' + s.lieuNaissance],
    ['Inscription', K.filiere(s.filiere).nom + ' ' + s.niveau + ' · groupe ' + s.groupe], ['Boursier', s.boursier ? 'Oui' : 'Non'], ['Téléphone', s.tel], ['E-mail', s.email], ['Statut', s.actif ? 'Inscrit' : 'Abandon déclaré'], ['Dernière connexion', FMT.relative(s.derniereConnexion)]]));
  else if (tab === 'parcours') body = UI.card({ title: 'Parcours' }, h('ul', { class: 'timeline' },
    h('li', null, h('strong', null, App.store.universite.annee + ' — ' + s.niveau + ' ' + K.filiere(s.filiere).nom), h('div', { class: 'small muted' }, 'Inscription en cours')),
    Number(s.niveau[1]) > 1 || s.niveau[0] === 'M' ? h('li', null, h('strong', null, '2024-2025 — niveau précédent'), h('div', { class: 'small muted' }, 'Admis · 60 crédits')) : null,
    h('li', null, h('strong', null, 'Baccalauréat'), h('div', { class: 'small muted' }, 'Série ' + (s.filiere === 'droit' ? 'A4' : s.filiere === 'eco' ? 'G2' : 'C') + ' · Office du Bac'))));
  else if (tab === 'notes') {
    if (s.filiere !== 'info' || s.niveau !== 'L2') body = UI.empty({ title: 'Notes non chargées dans la démo', text: 'Seule la promotion L2 Informatique dispose de notes détaillées.' });
    else {
      const r = K.result(s.id, 'S3');
      body = UI.card({ title: 'Semestre 3 — session normale', actions: [UI.status(r.decision), UI.button({ label: 'Relevé', size: 's', variant: 'secondary', icon: 'file', onClick: () => Commun.showDoc('Relevé de notes', Commun.releveDoc(s.id, 'S3', 'normale')) })] },
        h('ul', { class: 'list' }, r.ues.map((u) => h('li', { class: 'list-item wrap' }, h('div', { class: 'grow' }, h('div', { class: 'list-title' }, u.ue.nom), h('div', { class: 'list-meta' }, u.ue.id + ' · ' + u.credits + ' crédits')), scoreEl(u.moy), UI.status(u.statut))),
          h('li', { class: 'list-item' }, h('div', { class: 'grow strong' }, 'Moyenne du semestre'), scoreEl(r.moy), UI.badge(r.credits + ' / ' + r.total + ' crédits', 'neutral'))));
    }
  } else if (tab === 'absences') {
    const list = K.absencesOf(s.id);
    body = UI.card({ title: 'Absences et retards', flush: true }, UI.table({ columns: [{ key: 'date', label: 'Date', render: (r) => FMT.date(r.date) }, { key: 'e', label: 'Matière', render: (r) => K.ecueName(r.ecueId) }, { key: 't', label: 'Type', render: (r) => r.type }, { key: 's', label: 'Statut', render: (r) => UI.status(r.statut) }], rows: list, emptyTitle: 'Aucune absence' }));
  } else if (tab === 'paiements') {
    body = UI.card({ title: 'Paiements', actions: UI.status(K.paymentStatus(s.id)) }, h('div', { class: 'stack' }, UI.progress(sum.paye, sum.total, sum.retard.length ? 'danger' : null, 'Payé'), h('p', { class: 'small' }, FMT.money(sum.paye) + ' payés sur ' + FMT.money(sum.total) + ' · reste ' + FMT.money(sum.reste)),
      h('ul', { class: 'list' }, sum.tranches.map((t) => h('li', { class: 'list-item wrap' }, h('div', { class: 'grow' }, h('div', { class: 'list-title' }, t.libelle), h('div', { class: 'list-meta' }, 'Échéance ' + FMT.date(t.echeance))), UI.status(t.statut),
        t.tx[0] ? UI.button({ label: 'Reçu', size: 's', variant: 'ghost', icon: 'file', onClick: () => Commun.showDoc('Reçu', Commun.receiptDoc(t.tx[0])) }) : null)))));
  } else {
    body = UI.card({ title: 'Documents' }, h('ul', { class: 'list' }, ['Attestation d\'inscription', 'Certificat de scolarité'].map((d) => h('li', { class: 'list-item wrap' }, h('span', { class: 'list-icon accent' }, icon('file', 18)), h('div', { class: 'grow list-title' }, d),
      UI.button({ label: 'Générer', size: 's', variant: 'secondary', onClick: () => Commun.showDoc(d, attestationDoc(s, d)) }))),
      h('li', { class: 'list-item' }, h('span', { class: 'list-icon' }, icon('paperclip', 18)), h('div', { class: 'grow' }, h('div', { class: 'list-title' }, 'Pièces du dossier'), h('div', { class: 'list-meta' }, 'Acte de naissance, attestation du Bac, photo d\'identité')), UI.badge('Complet', 'success', 'check'))));
  }
  return h('div', { class: 'stack-l' },
    UI.pageHead({ title: s.prenom + ' ' + s.nom, crumbs: [{ label: 'Étudiants', href: '#/scolarite/etudiants' }, { label: s.prenom + ' ' + s.nom }], sub: s.matricule + ' · ' + K.filiere(s.filiere).nom + ' ' + s.niveau,
      actions: [UI.button({ label: 'Écrire', icon: 'message', variant: 'secondary', onClick: () => { let c = App.store.conversations.find((cv) => cv.type === 'individuel' && cv.participants.includes('a1') && cv.participants.includes(s.id)); if (!c) { c = { id: 'cv' + Date.now(), type: 'individuel', titre: null, participants: [App.session.userId, s.id], messages: [{ id: 'm' + Date.now(), from: App.session.userId, text: 'Bonjour ' + s.prenom + ', merci de passer à la Scolarité.', date: nowStamp(), luPar: [App.session.userId] }] }; App.store.conversations.push(c); } Commun.msg.current = c.id; App.go('#/scolarite/messages'); } }),
        UI.button({ label: 'Attestation', icon: 'file', onClick: () => Commun.showDoc('Attestation d\'inscription', attestationDoc(s)) })] }),
    h('div', { class: 'row wrap' }, UI.avatar(s, 'xl'), h('div', { class: 'row-s wrap' }, UI.status(s.actif ? 'actif' : 'inactif'), UI.status(K.paymentStatus(s.id)), s.boursier ? UI.badge('Boursier', 'info') : null, UI.badge('Groupe ' + s.groupe, 'neutral'))),
    h('div', null, UI.tabs([['infos', 'Informations'], ['parcours', 'Parcours'], ['notes', 'Notes'], ['absences', 'Absences'], ['paiements', 'Paiements'], ['documents', 'Documents']].map(([id, label]) => ({ id, label })), tab, (v) => { Sco.ficheTab = v; App.refresh(); }, 'Fiche étudiant'), body));
}

defineScreen('scolarite', 'etudiants', {
  title: (ctx) => ctx.param && App.store.users[ctx.param] ? K.name(App.store.users[ctx.param]) : 'Étudiants',
  render(ctx) {
    if (ctx.param) {
      const s = App.store.users[ctx.param];
      if (!s || s.role !== 'etudiant') return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Étudiant introuvable', crumbs: [{ label: 'Étudiants', href: '#/scolarite/etudiants' }, { label: 'Introuvable' }] }), UI.empty({ title: 'Aucun dossier pour cet identifiant' }));
      return studentFiche(s);
    }
    Sco.ficheTab = 'infos';
    const eff = App.store.effectifs;
    const rows = K.students();
    return h('div', { class: 'stack-l' },
      UI.pageHead({ title: 'Étudiants', sub: FMT.int(eff.info + eff.droit + eff.eco) + ' inscrits · ' + rows.length + ' dossiers chargés dans la démo',
        actions: [UI.button({ label: 'Importer CSV', icon: 'upload', variant: 'secondary', onClick: () => UI.modal({ title: 'Importer des étudiants', body: (api) => h('div', { class: 'stack' }, h('p', { class: 'small muted' }, 'Colonnes : Nom ; Prénom ; Date de naissance ; Filière ; Niveau ; Téléphone.'),
          UI.upload({ accept: ['csv'], maxMo: 2, label: 'Fichier CSV', demoName: 'inscriptions-l1-2026.csv', demoKo: 18, onFile: () => setTimeout(() => { api.close(); UI.toast('128 lignes analysées : 126 dossiers prêts, 2 lignes rejetées (téléphone invalide). Import simulé, aucune donnée créée.', 'info', 'Import CSV'); }, 600) })) }) }),
          UI.button({ label: 'Ajouter un étudiant', icon: 'plus', onClick: addStudentWizard })] }),
      UI.card({ ariaLabel: 'Liste des étudiants', flush: true }, h('div', { class: 'card-body' }, UI.table({
        searchKeys: [(s) => s.prenom + ' ' + s.nom, 'matricule'], searchPlaceholder: 'Nom ou matricule…', pageSize: 10, rowClick: (s) => App.go('#/scolarite/etudiants/' + s.id),
        filters: [
          { id: 'f', label: 'Toutes les filières', options: filiereOpts(), test: (s, v) => s.filiere === v },
          { id: 'n', label: 'Tous les niveaux', options: NIVEAUX.map((n) => ({ value: n, label: n })), test: (s, v) => s.niveau === v },
          { id: 'p', label: 'Tous les paiements', options: [{ value: 'a_jour', label: 'À jour' }, { value: 'impaye', label: 'Impayé' }], test: (s, v) => K.paymentStatus(s.id) === v }
        ],
        columns: [
          { key: 'nom', label: 'Étudiant', sortable: true, sortValue: (s) => s.nom + s.prenom, render: (s) => h('a', { href: '#/scolarite/etudiants/' + s.id, class: 'row-s', style: { color: 'inherit', textDecoration: 'none' } }, UI.avatar(s, 's'), h('span', { class: 'cell-main' }, s.nom.toUpperCase() + ' ' + s.prenom)) },
          { key: 'matricule', label: 'Matricule', sortable: true },
          { key: 'filiere', label: 'Filière', sortable: true, render: (s) => K.filiere(s.filiere).nom },
          { key: 'niveau', label: 'Niveau', sortable: true },
          { key: 'pay', label: 'Paiement', sortable: true, sortValue: (s) => K.paymentStatus(s.id), render: (s) => UI.status(K.paymentStatus(s.id)) },
          { key: 'actif', label: 'Statut', render: (s) => UI.status(s.actif ? 'actif' : 'inactif', s.actif ? 'Inscrit' : 'Abandon') }
        ], rows, sortKey: 'nom' }))));
  }
});

/* ---------- 3. Enseignants et personnel ---------- */
function teacherDrawer(t) {
  const allEcues = K.ues('info', 'L2').flatMap((u) => u.ecues.map((e) => Object.assign({ ue: u }, e)));
  const draw = (api) => {
    const mine = K.ecuesOfTeacher(t.id);
    const sel = UI.select([{ value: '', label: 'Affecter une ECUE…' }].concat(allEcues.filter((e) => e.ens !== t.id).map((e) => ({ value: e.id, label: e.id + ' — ' + e.nom + ' (actuel : ' + K.name(K.user(e.ens)) + ')' }))), '', null, { 'aria-label': 'ECUE à affecter' });
    return h('div', { class: 'stack' }, h('div', { class: 'row' }, UI.avatar(t, 'l'), h('div', null, h('div', { class: 'strong' }, K.name(t, true)), h('div', { class: 'small muted' }, t.grade + ' · ' + t.specialite))),
      UI.kv([['E-mail', t.email], ['Téléphone', t.tel], ['Charge S4', K.sessionsFor(t, DT.iso(DT.mondayOf(DT.today())), DT.iso(DT.add(DT.mondayOf(DT.today()), 5))).length * 2 + ' h cette semaine']]),
      h('h3', { style: { fontSize: '15px' } }, 'ECUE affectées'), h('div', { class: 'chip-row' }, mine.length ? mine.map((e) => UI.subject(e)) : h('span', { class: 'muted small' }, 'Aucune')),
      h('div', { class: 'row-s wrap' }, h('div', { class: 'grow' }, sel), UI.button({ label: 'Affecter', size: 's', onClick: () => {
        if (!sel.value) return;
        const ue = App.store.formation.ues.find((u) => u.ecues.find((e) => e.id === sel.value));
        const e = ue.ecues.find((x) => x.id === sel.value);
        const avant = K.name(K.user(e.ens));
        e.ens = t.id;
        App.store.sheets.filter((f) => f.ecueId === e.id).forEach((f) => { f.ens = t.id; });
        App.store.sessions.filter((c) => c.ecueId === e.id).forEach((c) => { c.ens = t.id; });
        App.audit('Affectation modifiée', e.id + ' — ' + e.nom, avant, K.name(t), '');
        UI.toast(e.nom + ' est désormais affectée à ' + K.name(t, true) + '.', 'success'); api.setBody(draw(api));
      } })));
  };
  UI.drawer({ title: 'Fiche enseignant', body: (api) => draw(api), onClose: () => App.refresh() });
}

defineScreen('scolarite', 'enseignants', {
  title: 'Enseignants et personnel',
  render() {
    const staff = Object.values(App.store.users).filter((u) => u.role === 'scolarite');
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Enseignants et personnel', sub: K.teachers().length + ' enseignants et ' + staff.length + ' agents de la Scolarité dans la démo.' }),
      UI.card({ title: 'Enseignants', flush: true }, UI.table({ searchKeys: [(t) => t.prenom + ' ' + t.nom, 'specialite'], rowClick: teacherDrawer, columns: [
        { key: 'nom', label: 'Enseignant', sortable: true, render: (t) => h('div', { class: 'row-s' }, UI.avatar(t, 's'), h('span', { class: 'cell-main' }, K.name(t, true))) },
        { key: 'grade', label: 'Grade', sortable: true }, { key: 'specialite', label: 'Spécialité' },
        { key: 'ecues', label: 'ECUE', render: (t) => h('div', { class: 'chip-row' }, K.ecuesOfTeacher(t.id).filter((e) => e.ue.semestre === 'S4').map((e) => UI.subject(e, true))) },
        { key: 'a', label: '', render: (t) => UI.button({ label: 'Fiche', size: 's', variant: 'ghost', onClick: () => teacherDrawer(t) }) }
      ], rows: K.teachers(), sortKey: 'nom' })),
      UI.card({ title: 'Service de la Scolarité', flush: true }, UI.table({ columns: [
        { key: 'nom', label: 'Agent', render: (t) => h('div', { class: 'row-s' }, UI.avatar(t, 's'), K.name(t, true)) }, { key: 'fonction', label: 'Fonction' }, { key: 'email', label: 'E-mail' }, { key: 'tel', label: 'Téléphone' }
      ], rows: staff })));
  }
});

/* ---------- 4. Offre de formation ---------- */
function editUe(ue) {
  if (!App.guard('formation.modifier')) return;
  const cr = UI.field({ label: 'Crédits de l\'UE', type: 'number', min: '1', max: '15', value: String(ue.credits) });
  const coefs = ue.ecues.map((e) => ({ e, f: UI.field({ label: 'Coefficient — ' + e.nom, type: 'number', min: '1', max: '5', value: String(e.coef) }) }));
  UI.modal({ title: ue.id + ' — ' + ue.nom, body: h('div', { class: 'stack' }, cr.el, coefs.map((c) => c.f.el), UI.alert('warning', null, 'Les moyennes, compensations et décisions sont recalculées immédiatement. Modification tracée dans le journal d\'audit.')),
    actions: (api) => [UI.button({ label: 'Annuler', variant: 'secondary', onClick: () => api.close() }), UI.button({ label: 'Enregistrer', onClick: () => {
      const c = Number(cr.input.value);
      let ok = cr.setError(Number.isInteger(c) && c >= 1 && c <= 15 ? null : 'Entre 1 et 15 crédits.');
      coefs.forEach((x) => { const v = Number(x.f.input.value); ok = x.f.setError(Number.isInteger(v) && v >= 1 && v <= 5 ? null : 'Entre 1 et 5.') && ok; });
      if (!ok) return;
      if (c !== ue.credits) App.audit('Crédits modifiés', ue.id, ue.credits, c, '');
      ue.credits = c;
      coefs.forEach((x) => { const v = Number(x.f.input.value); if (v !== x.e.coef) App.audit('Coefficient modifié', x.e.id, x.e.coef, v, ''); x.e.coef = v; });
      api.close(); UI.toast('Maquette mise à jour.', 'success'); App.refresh();
    } })] });
}

defineScreen('scolarite', 'formation', {
  title: 'Offre de formation',
  render() {
    const open = Sco.formOpen;
    const node = (key, label, meta, children, lvl) => {
      const isOpen = !!open[key];
      return h('li', null, h('button', { type: 'button', class: 'tree-node', 'aria-expanded': String(isOpen), onClick: () => { open[key] = !isOpen; App.refresh(); } },
        icon('chevronDown', 16, 'chev'), icon(lvl === 0 ? 'building' : lvl === 1 ? 'graduation' : 'layers', 18), h('span', { class: 'grow strong' }, label), meta ? h('span', { class: 'xsmall muted' }, meta) : null),
      isOpen ? h('ul', null, children()) : null);
    };
    const tree = h('div', { class: 'tree' }, h('ul', null, App.store.formation.filieres.map((f) => node(f.id, f.nom, f.niveaux.length + ' niveaux', () => f.niveaux.map((niv) => {
      const ues = K.ues(f.id, niv);
      const sems = Array.from(new Set(ues.map((u) => u.semestre)));
      return node(f.id + '-' + niv, (niv[0] === 'L' ? 'Licence ' : 'Master ') + niv[1] + ' (' + niv + ')', sems.join(' · '), () => sems.map((sem) => {
        const list = ues.filter((u) => u.semestre === sem);
        const total = list.reduce((a, u) => a + u.credits, 0);
        return node(f.id + '-' + niv + '-' + sem, 'Semestre ' + sem.slice(1), total + ' crédits' + (total !== 30 ? ' ⚠' : ''), () => [
          total !== 30 ? h('li', null, UI.alert('warning', null, 'Total de ' + total + ' crédits : un semestre doit totaliser 30 crédits.')) : null,
          h('li', null, h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', null, h('tr', null, ['Code', 'UE / ECUE', 'Crédits', 'Coef.', 'Enseignant', ''].map((t, i) => h('th', { class: i === 2 || i === 3 ? 'num' : null }, t)))),
            h('tbody', null, list.flatMap((u) => [h('tr', null, h('td', { class: 'strong' }, u.id), h('td', { class: 'strong' }, u.nom), h('td', { class: 'num strong' }, String(u.credits)), h('td'), h('td'),
              h('td', null, UI.button({ label: 'Modifier ' + u.nom, icon: 'edit', iconOnly: true, size: 's', variant: 'ghost', onClick: () => editUe(u) })))].concat(u.ecues.map((e) => h('tr', null, h('td', { class: 'muted' }, e.id), h('td', null, UI.subject(e)), h('td'), h('td', { class: 'num' }, String(e.coef)), h('td', { class: 'small' }, e.ens ? K.name(K.user(e.ens), true) : h('span', { class: 'muted' }, 'À affecter')), h('td'))))))))) ], 2);
      }), 1);
    }), 0))));
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Offre de formation', sub: 'Filières → niveaux → semestres → UE → ECUE. Crédits et coefficients modifiables.' }),
      UI.alert('info', 'Système LMD', '30 crédits par semestre. Moyenne d\'UE pondérée par les coefficients des ECUE ; moyenne de semestre pondérée par les crédits des UE.'),
      UI.card({ ariaLabel: 'Arborescence de l\'offre' }, tree));
  }
});

/* ---------- 5. Emplois du temps (filière, salle, enseignant) + conflits ---------- */
function slotForm(prefill) {
  if (!App.guard('edt.modifier')) return;
  const ecues = K.ues('info', 'L2', 'S4').flatMap((u) => u.ecues);
  const p = prefill || {};
  const ecue = UI.field({ label: 'ECUE', as: 'select', value: p.ecueId || ecues[0].id, options: ecues.map((e) => ({ value: e.id, label: e.nom })) });
  const type = UI.field({ label: 'Type', as: 'select', value: p.type || 'TD', options: ['CM', 'TD', 'TP'].map((x) => ({ value: x, label: x })) });
  const groupe = UI.field({ label: 'Groupe', as: 'select', value: p.groupe || 'all', options: [{ value: 'all', label: 'Promotion' }, { value: 'A', label: 'Groupe A' }, { value: 'B', label: 'Groupe B' }] });
  const date = UI.datePicker({ label: 'Date', value: p.date || DT.rel(1), min: DT.rel(0) });
  const debut = UI.field({ label: 'Début', type: 'time', value: p.debut || '15:00', step: '900' });
  const fin = UI.field({ label: 'Fin', type: 'time', value: p.fin || '17:00', step: '900' });
  const salle = UI.field({ label: 'Salle', as: 'select', value: p.salle || 's104', options: App.store.salles.map((x) => ({ value: x.id, label: x.nom + ' (' + x.capacite + ' places)' })) });
  const conflictBox = h('div', { 'aria-live': 'polite' });
  const candidate = () => ({ id: 'new', ecueId: ecue.input.value, type: type.input.value, date: date.input.value, debut: debut.input.value, fin: fin.input.value, salle: salle.input.value, ens: K.ecue(ecue.input.value).ens, groupe: groupe.input.value, filiere: 'info', niveau: 'L2', statut: 'normal', remarque: '' });
  const check = () => {
    clear(conflictBox);
    const c = candidate();
    if (!c.date || !c.debut || !c.fin || c.fin <= c.debut) { conflictBox.appendChild(UI.alert('neutral', null, 'Renseignez une date et un horaire valides.')); return null; }
    const found = K.conflicts(App.store.sessions.filter((x) => x.date === c.date).concat([c])).filter((x) => x.a.id === 'new' || x.b.id === 'new');
    if (found.length) found.forEach((x) => { const other = x.a.id === 'new' ? x.b : x.a; conflictBox.appendChild(UI.alert('danger', 'Conflit de ' + (x.type === 'salle' ? 'salle' : 'enseignant'), (x.type === 'salle' ? K.salle(c.salle).nom + ' est déjà occupée' : K.sessionTeacher(c) + ' a déjà cours') + ' : ' + K.sessionTitle(other) + ' de ' + other.debut + ' à ' + other.fin + '.')); });
    else conflictBox.appendChild(UI.alert('success', null, 'Aucun conflit de salle ni d\'enseignant.'));
    return found.length;
  };
  [ecue, date, debut, fin, salle].forEach((f) => f.input.addEventListener('change', check));
  UI.modal({ title: 'Créer un créneau', size: 'l', body: h('div', { class: 'stack' }, h('div', { class: 'form-grid cols-3' }, ecue.el, type.el, groupe.el, date.el, debut.el, fin.el), salle.el, conflictBox),
    actions: (api) => [UI.button({ label: 'Annuler', variant: 'secondary', onClick: () => api.close() }), UI.button({ label: 'Enregistrer le créneau', icon: 'check', onClick: () => {
      const n = check();
      if (n === null) return;
      if (n) { UI.toast('Résolvez le conflit (autre salle ou autre horaire) avant d\'enregistrer.', 'error'); return; }
      const c = candidate(); c.id = 'n' + Date.now();
      App.store.sessions.push(c); Sco.edt.pending += 1;
      api.close(); UI.toast('Créneau ajouté. Publiez les modifications pour prévenir les étudiants.', 'success'); App.refresh();
    } })] });
  setTimeout(check, 0);
}

function scoSessionDrawer(c, conflictsSet) {
  const sel = UI.select(App.store.salles.map((x) => ({ value: x.id, label: x.nom })), c.salle, null, { 'aria-label': 'Nouvelle salle' });
  Commun.sessionDrawer(c, h('div', { class: 'stack-s' }, conflictsSet.has(c.id) ? UI.alert('danger', 'Ce créneau est en conflit', 'Changez de salle pour le résoudre.') : null,
    h('h3', { style: { fontSize: '15px' } }, 'Modifier la séance'), h('div', { class: 'row-s wrap' }, h('div', { class: 'grow' }, sel),
      UI.button({ label: 'Changer de salle', size: 's', variant: 'secondary', onClick: () => {
        if (sel.value === c.salle || !App.guard('edt.modifier')) return;
        c.ancienneSalle = c.ancienneSalle || c.salle; c.salle = sel.value; c.statut = 'salle'; c.remarque = 'Changement de salle décidé par la Scolarité.';
        Sco.edt.pending += 1; UI.closeAllOverlays(); UI.toast('Salle modifiée. Pensez à publier.', 'success'); App.refresh();
      } }),
      c.statut !== 'annule' ? UI.button({ label: 'Annuler la séance', size: 's', variant: 'danger', onClick: () => { if (!App.guard('edt.modifier')) return; c.statut = 'annule'; c.remarque = 'Séance annulée par la Scolarité.'; Sco.edt.pending += 1; UI.closeAllOverlays(); UI.toast('Séance annulée. Pensez à publier.', 'warning'); App.refresh(); } }) : null)));
}

defineScreen('scolarite', 'emplois-du-temps', {
  title: 'Emplois du temps',
  render() {
    const st = Sco.edt;
    const conflicts = weekConflicts();
    const set = new Set(conflicts.flatMap((c) => [c.a.id, c.b.id]));
    const filter = (f, t) => App.store.sessions.filter((c) => c.date >= f && c.date <= t && (st.mode === 'filiere' ? c.filiere === 'info' && c.niveau === 'L2' : st.mode === 'salle' ? c.salle === st.salle : c.ens === st.ens)).sort((a, b) => (a.date + a.debut).localeCompare(b.date + b.debut));
    const sub = st.mode === 'salle' ? UI.select(App.store.salles.map((x) => ({ value: x.id, label: x.nom })), st.salle, (v) => { st.salle = v; App.refresh(); }, { 'aria-label': 'Salle', class: 'select select-s', style: { width: 'auto' } })
      : st.mode === 'enseignant' ? UI.select(K.teachers().map((x) => ({ value: x.id, label: K.name(x, true) })), st.ens, (v) => { st.ens = v; App.refresh(); }, { 'aria-label': 'Enseignant', class: 'select select-s', style: { width: 'auto' } }) : UI.badge('L2 Informatique', 'neutral');
    return h('div', { class: 'stack-l' },
      UI.pageHead({ title: 'Emplois du temps', sub: 'Vue par filière, par salle ou par enseignant. Les conflits sont détectés automatiquement.',
        actions: [UI.button({ label: 'Créer un créneau', icon: 'plus', variant: 'secondary', onClick: () => slotForm() }),
          UI.button({ label: st.pending ? 'Publier ' + st.pending + ' modification(s)' : 'Publier les modifications', icon: 'send', disabled: !st.pending, onClick: () => {
            K.promo().forEach((s) => App.notify(s.id, 'cours', 'Emploi du temps modifié', st.pending + ' changement(s) cette semaine. Consultez votre emploi du temps.', '#/etudiant/emploi-du-temps'));
            K.teachers().forEach((t) => App.notify(t.id, 'cours', 'Emploi du temps modifié', 'La Scolarité a publié des changements.', '#/enseignant/emploi-du-temps'));
            UI.toast('Modifications publiées : ' + K.promo().length + ' étudiants et ' + K.teachers().length + ' enseignants notifiés (application + SMS).', 'success');
            st.pending = 0; App.refresh();
          } })] }),
      conflicts.length ? conflicts.map((c) => UI.alert('danger', 'Conflit de ' + (c.type === 'salle' ? 'salle' : 'enseignant') + ' : ' + (c.type === 'salle' ? K.salle(c.a.salle).nom : K.sessionTeacher(c.a)),
        capitalize(FMT.dateLong(c.a.date)) + ', ' + c.a.debut + ' : « ' + K.sessionTitle(c.a) + ' » (' + K.filiere(c.a.filiere).nom + ' ' + c.a.niveau + ') et « ' + K.sessionTitle(c.b) + ' » (' + K.filiere(c.b.filiere).nom + ' ' + c.b.niveau + ').',
        UI.button({ label: 'Résoudre', size: 's', variant: 'secondary', onClick: () => scoSessionDrawer(c.a.ecueId ? c.a : c.b, set) }))) : UI.alert('success', null, 'Aucun conflit sur les deux prochaines semaines.'),
      Commun.timetable({ key: 'sco-' + st.mode, getSessions: filter, conflicts: set, onOpen: (c) => scoSessionDrawer(c, set),
        toolbar: h('div', { class: 'row-s wrap' }, UI.segmented([{ id: 'filiere', label: 'Filière' }, { id: 'salle', label: 'Salle' }, { id: 'enseignant', label: 'Enseignant' }], st.mode, (v) => { st.mode = v; App.refresh(); }, 'Mode d\'affichage'), sub) }));
  }
});

/* ---------- 6. Salles ---------- */
defineScreen('scolarite', 'salles', {
  title: 'Salles',
  render() {
    const m = DT.mondayOf(DT.today());
    const from = DT.iso(m); const to = DT.iso(DT.add(m, 5));
    const dispo = 6 * 11;
    const rows = App.store.salles.map((sa) => {
      const used = App.store.sessions.filter((c) => c.salle === sa.id && c.date >= from && c.date <= to && c.statut !== 'annule');
      const hours = used.reduce((a, c) => { const [h1, m1] = c.debut.split(':').map(Number); const [h2, m2] = c.fin.split(':').map(Number); return a + (h2 + m2 / 60) - (h1 + m1 / 60); }, 0);
      return Object.assign({ taux: Math.min(100, (hours / dispo) * 100), seances: used.length, hours }, sa);
    });
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Salles', sub: 'Capacité, équipements et taux d\'occupation de la semaine (lundi à samedi, 8h–19h).' }),
      UI.card({ title: 'Occupation de la semaine' }, UI.barChart({ label: 'Taux d\'occupation par salle', data: rows.map((r) => ({ label: r.nom.replace('Labo Info ', 'Labo ').replace('Salle du conseil', 'Conseil').replace('Salle ', 'S'), value: Math.round(r.taux), tone: r.taux > 90 ? 'warn' : '' })), format: (v) => v + ' %', max: 100, axisFormat: (v) => Math.round(v) + ' %' })),
      UI.card({ title: 'Liste des salles', flush: true }, UI.table({ searchKeys: ['nom', (r) => r.equipements.join(' ')], columns: [
        { key: 'nom', label: 'Salle', sortable: true, render: (r) => h('span', { class: 'cell-main' }, r.nom) },
        { key: 'capacite', label: 'Capacité', sortable: true, num: true, render: (r) => FMT.int(r.capacite) + ' places' },
        { key: 'eq', label: 'Équipements', render: (r) => h('div', { class: 'chip-row' }, r.equipements.map((e) => UI.badge(e, 'neutral'))) },
        { key: 'seances', label: 'Séances', sortable: true, num: true },
        { key: 'taux', label: 'Occupation', sortable: true, render: (r) => h('div', { class: 'row-s', style: { minWidth: '160px' } }, h('div', { class: 'grow' }, UI.progress(r.taux, 100, r.taux > 90 ? 'warn' : null, 'Occupation')), h('span', { class: 'num small' }, FMT.pct(r.taux))) },
        { key: 'a', label: '', render: (r) => UI.button({ label: 'Planning', size: 's', variant: 'ghost', onClick: () => { Sco.edt.mode = 'salle'; Sco.edt.salle = r.id; App.go('#/scolarite/emplois-du-temps'); } }) }
      ], rows, sortKey: 'taux', sortDir: 'desc' })));
  }
});

/* ---------- 7. Validation des notes ---------- */
function validateSheet(f, api) {
  if (!App.guard('notes.valider')) return;
  f.statut = 'validee'; f.valideLe = nowStamp();
  const e = K.ecue(f.ecueId);
  App.audit('Notes validées', f.ecueId + ' · ' + f.eval + ' · L2 Info', 'soumise', 'validée', '');
  K.promo().forEach((s) => { if (f.notes[s.id] !== undefined) App.notify(s.id, 'note', 'Nouvelle note : ' + e.nom, EVAL_LABELS[f.eval] + ' : ' + FMT.note(f.notes[s.id]) + (typeof f.notes[s.id] === 'number' ? ' / 20' : '') + '.', '#/etudiant/notes'); });
  const parent = Object.values(App.store.users).find((u) => u.role === 'parent');
  if (parent && f.notes[parent.enfant] !== undefined) App.notify(parent.id, 'note', 'Nouvelle note d\'Awa', e.nom + ' — ' + EVAL_LABELS[f.eval] + ' : ' + FMT.note(f.notes[parent.enfant]) + '.', '#/parent/notes');
  App.notify(f.ens, 'note', 'Notes validées', e.nom + ' — ' + EVAL_LABELS[f.eval] + ' publiées aux étudiants.', '#/enseignant/notes');
  if (api) api.close();
  UI.toast('Notes validées et publiées : ' + Object.keys(f.notes).length + ' étudiants notifiés (application + SMS).', 'success');
  App.refresh();
}
function returnSheet(f, parentApi) {
  const com = UI.field({ label: 'Commentaire pour l\'enseignant', as: 'textarea', rows: 3, required: true, placeholder: 'Ex. notes manquantes, incohérence avec le PV de correction…' });
  UI.modal({ title: 'Renvoyer à l\'enseignant', body: com.el, actions: (api) => [UI.button({ label: 'Annuler', variant: 'secondary', onClick: () => api.close() }), UI.button({ label: 'Renvoyer', variant: 'danger', icon: 'arrowLeft', onClick: () => {
    if (!com.setError(com.input.value.trim().length >= 5 ? null : 'Expliquez le motif du renvoi.') || !App.guard('notes.valider')) return;
    f.statut = 'renvoyee'; f.commentaire = com.input.value.trim();
    App.audit('Notes renvoyées', f.ecueId + ' · ' + f.eval, 'soumise', 'renvoyée', f.commentaire);
    App.notify(f.ens, 'note', 'Notes renvoyées par la Scolarité', K.ecueName(f.ecueId) + ' — ' + f.commentaire, '#/enseignant/notes');
    api.close(); if (parentApi) parentApi.close(); UI.toast('Feuille renvoyée à l\'enseignant.', 'warning'); App.refresh();
  } })] });
}
function previewSheet(f) {
  const vals = Object.values(f.notes).map(Calc.value);
  const st = Calc.stats(vals);
  UI.drawer({ title: K.ecueName(f.ecueId) + ' — ' + EVAL_LABELS[f.eval], body: h('div', { class: 'stack' },
    h('div', { class: 'grid-2' }, h('div', { class: 'mini-stat' }, h('b', null, FMT.note(st.avg)), h('span', null, 'Moyenne')), h('div', { class: 'mini-stat' }, h('b', null, st.above + ' / ' + st.n), h('span', null, '≥ 10'))),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', null, 'Étudiant'), h('th', { class: 'num' }, 'Note'))),
      h('tbody', null, K.promo().map((s) => h('tr', null, h('td', null, s.nom.toUpperCase() + ' ' + s.prenom), h('td', { class: 'num' }, f.notes[s.id] === undefined ? UI.badge('Manquante', 'danger') : scoreEl(f.notes[s.id])))))))),
  actions: (api) => f.statut === 'soumise' ? [UI.button({ label: 'Renvoyer', variant: 'secondary', icon: 'arrowLeft', onClick: () => returnSheet(f, api) }), UI.button({ label: 'Valider et publier', icon: 'check', onClick: () => validateSheet(f, api) })] : [UI.button({ label: 'Fermer', variant: 'secondary', onClick: () => api.close() })] });
}

defineScreen('scolarite', 'validation', {
  title: 'Validation des notes',
  render() {
    const soumises = App.store.sheets.filter((f) => f.statut === 'soumise');
    const enCours = App.store.sheets.filter((f) => ['brouillon', 'renvoyee'].includes(f.statut));
    const recent = App.store.sheets.filter((f) => f.statut === 'validee' && f.valideLe).sort((a, b) => b.valideLe.localeCompare(a.valideLe)).slice(0, 6);
    const row = (f) => ({ f, ecue: K.ecueName(f.ecueId), ens: K.name(K.user(f.ens), true), n: Object.keys(f.notes).length, avg: Calc.stats(Object.values(f.notes).map(Calc.value)).avg });
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Validation des notes', sub: 'Les notes ne sont visibles des étudiants qu\'après validation. Chaque action est tracée.' }),
      UI.card({ title: 'Soumises par les enseignants', actions: UI.badge(String(soumises.length), soumises.length ? 'warning' : 'success'), flush: true }, UI.table({ columns: [
        { key: 'ecue', label: 'ECUE', render: (r) => h('div', null, UI.subject(K.ecue(r.f.ecueId)), h('div', { class: 'xsmall muted', style: { marginTop: '4px' } }, EVAL_LABELS[r.f.eval])) },
        { key: 'ens', label: 'Enseignant' },
        { key: 'date', label: 'Soumise', render: (r) => FMT.relative(r.f.soumisLe) },
        { key: 'n', label: 'Notes', num: true, render: (r) => r.n + ' / ' + K.promo().length },
        { key: 'avg', label: 'Moyenne', num: true, render: (r) => scoreEl(r.avg) },
        { key: 'a', label: '', render: (r) => h('div', { class: 'row-s' }, UI.button({ label: 'Aperçu', size: 's', variant: 'ghost', icon: 'eye', onClick: () => previewSheet(r.f) }), UI.button({ label: 'Renvoyer', size: 's', variant: 'secondary', onClick: () => returnSheet(r.f) }), UI.button({ label: 'Valider', size: 's', icon: 'check', onClick: () => validateSheet(r.f) })) }
      ], rows: soumises.map(row), emptyTitle: 'Aucune feuille en attente', emptyText: 'Toutes les notes soumises ont été traitées.' })),
      h('div', { class: 'grid-2' },
        UI.card({ title: 'Saisies en cours chez les enseignants' }, enCours.length ? h('ul', { class: 'list' }, enCours.map((f) => h('li', { class: 'list-item wrap' }, h('div', { class: 'grow' }, h('div', { class: 'list-title' }, K.ecueName(f.ecueId) + ' — ' + f.eval), h('div', { class: 'list-meta' }, K.name(K.user(f.ens), true) + (f.dateLimite ? ' · limite ' + FMT.date(f.dateLimite) : ''))), UI.status(f.statut),
          UI.button({ label: 'Relancer', size: 's', variant: 'ghost', icon: 'bell', onClick: () => { App.notify(f.ens, 'note', 'Rappel de la Scolarité', 'Saisie attendue : ' + K.ecueName(f.ecueId) + ' — ' + f.eval + '.', '#/enseignant/notes'); UI.toast('Rappel envoyé.', 'success'); } })))) : UI.empty({ title: 'Aucune saisie en cours' })),
        UI.card({ title: 'Validées récemment' }, h('ul', { class: 'list' }, recent.map((f) => h('li', { class: 'list-item wrap' }, h('div', { class: 'grow' }, h('div', { class: 'list-title' }, K.ecueName(f.ecueId) + ' — ' + f.eval), h('div', { class: 'list-meta' }, 'Validée ' + FMT.relative(f.valideLe))), UI.status('validee_sco'),
          UI.button({ label: 'Aperçu', size: 's', variant: 'ghost', onClick: () => previewSheet(f) })))))));
  }
});

/* ---------- 8. Délibérations et PV ---------- */
function juryModal(s, sem, session, r) {
  if (!App.guard('deliberation.jury')) return;
  const key = s.id + '-' + sem + '-' + session;
  const cur = App.store.jury[key] || { pts: 0, motif: '' };
  const pts = UI.field({ label: 'Points de jury (ajoutés à la moyenne du semestre)', inputmode: 'decimal', value: String(cur.pts).replace('.', ','), hint: 'De 0 à 1 point, par pas de 0,25.' });
  const motif = UI.field({ label: 'Motif (obligatoire, tracé dans le journal d\'audit)', as: 'textarea', rows: 2, value: cur.motif });
  const base = Calc.round2((r.moy || 0) - (r.jury || 0));
  UI.modal({ title: 'Points de jury — ' + s.prenom + ' ' + s.nom, body: h('div', { class: 'stack' }, UI.kv([['Moyenne sans points', FMT.note(base)], ['Crédits actuels', r.credits + ' / ' + r.total], ['Décision actuelle', STATUS[r.decision][0]]]), pts.el, motif.el),
    actions: (api) => [UI.button({ label: 'Annuler', variant: 'secondary', onClick: () => api.close() }), UI.button({ label: 'Appliquer', icon: 'scale', onClick: () => {
      const v = Number(pts.input.value.replace(',', '.'));
      let ok = pts.setError(!Number.isNaN(v) && v >= 0 && v <= 1 && Math.round(v * 4) === v * 4 ? null : 'Entre 0 et 1, par pas de 0,25.');
      ok = motif.setError(motif.input.value.trim().length >= 5 ? null : 'Le motif est obligatoire.') && ok;
      if (!ok) return;
      App.store.jury[key] = { pts: v, motif: motif.input.value.trim() };
      const after = K.result(s.id, sem, session);
      App.audit('Points de jury', sem + ' · ' + s.prenom + ' ' + s.nom, FMT.note(base), FMT.note(after.moy) + ' (+' + FMT.num(v, 2) + ')', motif.input.value.trim());
      api.close(); UI.toast('Points de jury appliqués : ' + STATUS[after.decision][0] + ', ' + after.credits + ' crédits.', 'success'); App.refresh();
    } })] });
}

function pvDoc(rows, sem, session) {
  const univ = App.store.universite;
  const ues = K.ues('info', 'L2', sem);
  const count = (d) => rows.filter((r) => r.r.decision === d).length;
  return h('div', { class: 'doc' }, UI.docHeader(univ, 'PV n° ' + sem + '-' + session.toUpperCase().slice(0, 4) + '-L2INFO'),
    h('div', { class: 'doc-title' }, 'Procès-verbal de délibération'),
    h('div', { class: 'doc-info' }, h('div', null, h('b', null, 'Filière : '), 'Informatique — Licence 2'), h('div', null, h('b', null, 'Semestre : '), sem + ' · session ' + session),
      h('div', null, h('b', null, 'Année : '), univ.annee), h('div', null, h('b', null, 'Date du jury : '), FMT.date(DT.rel(0)))),
    h('table', null, h('thead', null, h('tr', null, h('th', null, 'Matricule'), h('th', null, 'Nom et prénom'), ues.map((u) => h('th', { class: 'num' }, u.id)), h('th', { class: 'num' }, 'Moy.'), h('th', { class: 'num' }, 'Créd.'), h('th', null, 'Décision'))),
      h('tbody', null, rows.map((x) => h('tr', null, h('td', null, x.s.matricule), h('td', null, x.s.nom.toUpperCase() + ' ' + x.s.prenom), x.r.ues.map((u) => h('td', { class: 'num' }, FMT.note(u.moy) + (u.statut === 'compensee' ? '*' : ''))),
        h('td', { class: 'num' }, FMT.note(x.r.moy) + (x.r.jury ? ' (J)' : '')), h('td', { class: 'num' }, String(x.r.credits)), h('td', null, x.r.decision ? STATUS[x.r.decision][0] : '—'))))),
    h('p', { style: { fontSize: '11px', marginTop: '8px' } }, '* UE validée par compensation · (J) points de jury attribués. Admis : ' + count('admis') + ' · Rattrapage : ' + count('rattrapage') + ' · Ajournés : ' + count('ajourne') + ' · Effectif : ' + rows.length + '.'),
    h('div', { class: 'doc-foot' }, ['Le président du jury', 'Les membres du jury', 'La cheffe de la Scolarité'].map((t) => h('div', { class: 'center', style: { minWidth: '160px' } }, h('div', null, t), h('div', { style: { height: '56px' } }), h('div', { class: 'xsmall' }, '(signature)')))),
    h('div', { class: 'watermark' }, 'PV généré par Kalanso — maquette de démonstration.'));
}

defineScreen('scolarite', 'deliberations', {
  title: 'Délibérations et PV',
  render() {
    const st = Sco.delib;
    const rows = K.promo().map((s) => ({ s, r: K.result(s.id, st.sem, st.session) })).sort((a, b) => (b.r.moy ?? -1) - (a.r.moy ?? -1));
    const complete = rows.every((x) => x.r.complete);
    const ues = K.ues('info', 'L2', st.sem);
    const count = (d) => rows.filter((x) => x.r.decision === d).length;
    const pubKey = st.sem + '-' + st.session;
    const published = !!App.store.publications[pubKey];
    return h('div', { class: 'stack-l' },
      UI.pageHead({ title: 'Délibérations et PV', sub: 'Tableau calculé automatiquement : moyennes, compensation, crédits et décisions.',
        actions: [UI.button({ label: 'Générer le PV', icon: 'printer', variant: published ? 'primary' : 'secondary', disabled: !complete, onClick: () => Commun.showDoc('Procès-verbal de délibération', pvDoc(rows, st.sem, st.session)) }),
          published ? UI.badge('Résultats publiés · verrouillés', 'success', 'lock') : UI.button({ label: 'Publier les résultats', icon: 'send', disabled: !complete, onClick: () => {
            if (!App.guard('deliberation.publier')) return;
            UI.confirm({ title: 'Publier les résultats ?', message: 'Les ' + rows.length + ' étudiants recevront leur décision par l\'application et par SMS. Les modifications ultérieures seront tracées.', confirmLabel: 'Publier' }).then((ok) => {
              if (!ok) return;
              App.store.publications[pubKey] = true;
              rows.forEach((x) => App.notify(x.s.id, 'note', 'Résultats du ' + st.sem + ' publiés', STATUS[x.r.decision][0] + ' · ' + x.r.credits + ' crédits sur ' + x.r.total + '.', '#/etudiant/notes'));
              App.audit('Résultats publiés', st.sem + ' · session ' + st.session + ' · L2 Info', 'non publiés', 'publiés', '');
              UI.toast('Résultats publiés.', 'success'); App.refresh();
            });
          } })] }),
      UI.card({ ariaLabel: 'Paramètres de délibération' }, h('div', { class: 'form-grid cols-3' },
        UI.field({ label: 'Filière', as: 'select', options: [{ value: 'info', label: 'Informatique' }], value: 'info', hint: 'Seule la L2 Informatique est chargée dans la démo.' }).el,
        UI.field({ label: 'Niveau', as: 'select', options: [{ value: 'L2', label: 'Licence 2' }], value: 'L2' }).el,
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Semestre et session'), h('div', { class: 'row-s wrap' },
          UI.segmented([{ id: 'S3', label: 'S3' }, { id: 'S4', label: 'S4' }], st.sem, (v) => { st.sem = v; App.refresh(); }, 'Semestre'),
          UI.segmented([{ id: 'normale', label: 'Normale' }, { id: 'rattrapage', label: 'Rattrapage' }], st.session, (v) => { st.session = v; App.refresh(); }, 'Session'))))),
      !complete ? UI.alert('warning', 'Délibération impossible pour l\'instant', 'Toutes les notes de ' + st.sem + ' (' + st.session + ') ne sont pas encore validées. Le tableau affiche les résultats provisoires.') : null,
      h('div', { class: 'grid-4' }, UI.kpi({ label: 'Admis', icon: 'checkCircle', value: String(count('admis')) }), UI.kpi({ label: 'Rattrapage', icon: 'refresh', value: String(count('rattrapage')) }),
        UI.kpi({ label: 'Ajournés', icon: 'xCircle', value: String(count('ajourne')) }), UI.kpi({ label: 'Taux de réussite', icon: 'award', value: complete ? FMT.pct(count('admis') / rows.length * 100) : '—', foot: published ? 'Résultats publiés' : 'Non publiés' })),
      UI.card({ title: 'Tableau de délibération', flush: true }, UI.table({ searchKeys: [(x) => x.s.prenom + ' ' + x.s.nom, (x) => x.s.matricule],
        filters: [{ id: 'd', label: 'Toutes les décisions', options: ['admis', 'rattrapage', 'ajourne'].map((d) => ({ value: d, label: STATUS[d][0] })), test: (x, v) => x.r.decision === v }],
        columns: [{ key: 'n', label: 'Étudiant', sortable: true, sortValue: (x) => x.s.nom, render: (x) => h('div', null, h('div', { class: 'cell-main' }, x.s.nom.toUpperCase() + ' ' + x.s.prenom), h('div', { class: 'xsmall muted' }, x.s.matricule)) }]
          .concat(ues.map((u) => ({ key: u.id, label: u.id, num: true, sortable: true, sortValue: (x) => x.r.ues.find((y) => y.ue.id === u.id).moy ?? -1, render: (x) => { const y = x.r.ues.find((z) => z.ue.id === u.id); return h('span', { title: STATUS[y.statut] ? STATUS[y.statut][0] : '' }, h('span', { class: 'score ' + (y.moy !== null && y.moy < 10 ? 'low' : 'ok') }, FMT.note(y.moy)), y.statut === 'compensee' ? h('span', { class: 'xsmall', 'aria-label': ' compensée' }, '*') : null); } })))
          .concat([
            { key: 'moy', label: 'Moyenne', num: true, sortable: true, sortValue: (x) => x.r.moy ?? -1, render: (x) => h('span', { class: 'row-s', style: { justifyContent: 'flex-end' } }, scoreEl(x.r.moy), x.r.jury ? UI.badge('+' + FMT.num(x.r.jury, 2), 'info', 'scale') : null) },
            { key: 'cr', label: 'Crédits', num: true, sortable: true, sortValue: (x) => x.r.credits, render: (x) => x.r.complete ? x.r.credits + '/' + x.r.total : '—' },
            { key: 'dec', label: 'Décision', render: (x) => x.r.decision ? UI.status(x.r.decision) : UI.status('en_cours') },
            { key: 'j', label: '', render: (x) => x.r.complete && x.r.decision !== 'admis' || x.r.jury ? UI.button({ label: 'Points de jury', size: 's', variant: 'ghost', icon: 'scale', onClick: () => juryModal(x.s, st.sem, st.session, x.r) }) : null }
          ]), rows, pageSize: 15 })),
      h('p', { class: 'xsmall muted' }, '* UE validée par compensation (moyenne du semestre ≥ ' + App.store.parametres.seuilValidation + ' et UE ≥ ' + App.store.parametres.notePlancher + '). Les points de jury sont tracés dans le journal d\'audit.'));
  }
});

/* ---------- 9. Absences ---------- */
function justifPreview(a) {
  const s = K.user(a.sid);
  UI.modal({ title: 'Justificatif — ' + s.prenom + ' ' + s.nom, size: 'l', body: h('div', { class: 'grid-2' },
    h('div', { class: 'card card-pad stack', style: { alignItems: 'center', justifyContent: 'center', minHeight: '260px', background: 'var(--surface-2)' } }, icon(a.piece.endsWith('.pdf') ? 'file' : 'eye', 48), h('div', { class: 'strong' }, a.piece), h('div', { class: 'xsmall muted' }, 'Aperçu du document (simulation)')),
    h('div', { class: 'stack' }, UI.kv([['Étudiant', s.prenom + ' ' + s.nom + ' (' + s.matricule + ')'], ['Séance', K.ecueName(a.ecueId) + ' — ' + FMT.date(a.date)], ['Type', a.type === 'retard' ? 'Retard de ' + a.minutes + ' min' : 'Absence'], ['Motif', a.motif], ['Commentaire', a.commentaire || '—']]))),
  actions: (api) => [UI.button({ label: 'Refuser', variant: 'danger', icon: 'x', onClick: () => decideJustif(a, false, api) }), UI.button({ label: 'Valider le justificatif', icon: 'check', onClick: () => decideJustif(a, true, api) })] });
}
function decideJustif(a, ok, api) {
  if (!App.guard('absence.valider')) return;
  const avant = STATUS[a.statut][0];
  a.statut = ok ? 'justifiee' : 'refusee';
  App.audit(ok ? 'Justificatif validé' : 'Justificatif refusé', 'Absence · ' + K.name(K.user(a.sid)) + ' · ' + FMT.date(a.date), avant, STATUS[a.statut][0], a.motif);
  App.notify(a.sid, 'absence', ok ? 'Justificatif accepté' : 'Justificatif refusé', K.ecueName(a.ecueId) + ' du ' + FMT.date(a.date) + (ok ? ' : absence justifiée.' : ' : merci de contacter la Scolarité.'), '#/etudiant/absences');
  if (api) api.close();
  UI.toast(ok ? 'Absence justifiée. L\'étudiant est notifié.' : 'Justificatif refusé. L\'étudiant est notifié.', ok ? 'success' : 'warning');
  App.refresh();
}

defineScreen('scolarite', 'absences', {
  title: 'Absences',
  render() {
    const all = App.store.absences.slice().sort((a, b) => b.date.localeCompare(a.date));
    const pending = all.filter((a) => a.statut === 'en_attente');
    const risks = K.promo().flatMap((s) => K.absenceRisks(s.id).map((r) => Object.assign({ s }, r))).sort((a, b) => b.count - a.count);
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Absences', sub: 'Vue globale, justificatifs à valider et étudiants au-dessus du seuil.' }),
      h('div', { class: 'grid-4' }, UI.kpi({ label: 'Absences enregistrées', icon: 'clock', value: String(all.filter((a) => a.type === 'absence').length) }), UI.kpi({ label: 'Retards', icon: 'alert', value: String(all.filter((a) => a.type === 'retard').length) }),
        UI.kpi({ label: 'Justificatifs à valider', icon: 'inbox', value: String(pending.length) }), UI.kpi({ label: 'Étudiants à risque', icon: 'userCheck', value: String(risks.length), foot: 'Seuil : ' + App.store.parametres.seuilAbsences + ' absences non justifiées' })),
      h('div', { class: 'grid-2' },
        UI.card({ title: 'Justificatifs en attente' }, pending.length ? h('ul', { class: 'list' }, pending.map((a) => h('li', { class: 'list-item wrap' }, UI.avatar(K.user(a.sid)),
          h('div', { class: 'grow' }, h('div', { class: 'list-title' }, K.name(K.user(a.sid)) + ' — ' + a.motif), h('div', { class: 'list-meta' }, K.ecueName(a.ecueId) + ' · ' + FMT.date(a.date) + ' · ' + a.piece)),
          UI.button({ label: 'Examiner', size: 's', variant: 'secondary', icon: 'eye', onClick: () => justifPreview(a) })))) : UI.empty({ title: 'Aucun justificatif en attente' })),
        UI.card({ title: 'Au-dessus ou proche du seuil' }, risks.length ? h('ul', { class: 'list' }, risks.map((r) => h('li', { class: 'list-item wrap' }, UI.avatar(r.s),
          h('div', { class: 'grow' }, h('div', { class: 'list-title' }, r.s.prenom + ' ' + r.s.nom), h('div', { class: 'list-meta' }, K.ecueName(r.ecueId))),
          UI.badge(r.count + ' / ' + r.seuil, r.depasse ? 'danger' : 'warning', r.depasse ? 'alert' : 'clock'),
          UI.button({ label: 'Prévenir', size: 's', variant: 'ghost', icon: 'sms', onClick: () => { App.notify(r.s.id, 'absence', 'Alerte assiduité', 'Vous avez ' + r.count + ' absences non justifiées en ' + K.ecueName(r.ecueId) + '.', '#/etudiant/absences'); UI.toast('SMS d\'alerte envoyé à ' + r.s.prenom + ' (simulation).', 'success'); } })))) : UI.empty({ title: 'Aucun étudiant à risque' }))),
      UI.card({ title: 'Toutes les absences', flush: true }, UI.table({ searchKeys: [(a) => K.name(K.user(a.sid)), (a) => K.ecueName(a.ecueId)], pageSize: 10,
        filters: [{ id: 's', label: 'Tous les statuts', options: ['justifiee', 'non_justifiee', 'en_attente', 'refusee'].map((k) => ({ value: k, label: STATUS[k][0] })), test: (a, v) => a.statut === v }],
        columns: [{ key: 'date', label: 'Date', sortable: true, render: (a) => FMT.date(a.date) }, { key: 'sid', label: 'Étudiant', render: (a) => K.name(K.user(a.sid)) }, { key: 'e', label: 'Matière', render: (a) => K.ecueName(a.ecueId) },
          { key: 'type', label: 'Type', render: (a) => a.type === 'retard' ? 'Retard (' + a.minutes + ' min)' : 'Absence' }, { key: 'statut', label: 'Statut', render: (a) => UI.status(a.statut) }], rows: all, sortKey: 'date', sortDir: 'desc' })));
  }
});

/* ---------- 10. Finances ---------- */
defineScreen('scolarite', 'finances', {
  title: 'Finances',
  render() {
    const rec = K.recouvrement();
    const students = K.students().filter((s) => s.actif);
    const rows = students.map((s) => Object.assign({ s }, K.paymentSummary(s.id)));
    const impayes = rows.filter((r) => r.retard.length);
    const montantRetard = impayes.reduce((a, r) => a + r.retard.reduce((b, t) => b + t.reste, 0), 0);
    const today = App.store.transactions.filter((t) => t.date.slice(0, 10) === DT.rel(0));
    const tab = Sco.fin;
    let body;
    if (tab === 'suivi') {
      body = UI.table({ searchKeys: [(r) => r.s.prenom + ' ' + r.s.nom, (r) => r.s.matricule], pageSize: 10,
        filters: [{ id: 'st', label: 'Tous', options: [{ value: 'retard', label: 'En retard' }, { value: 'ok', label: 'À jour' }, { value: 'solde', label: 'Soldé' }], test: (r, v) => v === 'retard' ? r.retard.length > 0 : v === 'solde' ? r.reste === 0 : r.retard.length === 0 },
          { id: 'f', label: 'Toutes les filières', options: filiereOpts(), test: (r, v) => r.s.filiere === v }],
        columns: [{ key: 'n', label: 'Étudiant', sortable: true, sortValue: (r) => r.s.nom, render: (r) => h('a', { href: '#/scolarite/etudiants/' + r.s.id, style: { color: 'inherit' } }, r.s.nom.toUpperCase() + ' ' + r.s.prenom) },
          { key: 'f', label: 'Filière', render: (r) => K.filiere(r.s.filiere).nom + ' ' + r.s.niveau },
          { key: 'paye', label: 'Payé', num: true, sortable: true, render: (r) => FMT.money(r.paye) },
          { key: 'reste', label: 'Reste', num: true, sortable: true, render: (r) => FMT.money(r.reste) },
          { key: 'st', label: 'Statut', sortable: true, sortValue: (r) => r.retard.length, render: (r) => r.retard.length ? UI.status('retard', r.retard.length + ' tranche(s) en retard') : r.reste === 0 ? UI.status('payee', 'Soldé') : UI.status('a_jour') }], rows, sortKey: 'st', sortDir: 'desc' });
    } else if (tab === 'relances') {
      impayes.forEach((r) => { if (Sco.relance[r.s.id] === undefined) Sco.relance[r.s.id] = true; });
      const preview = h('div', { class: 'sms-preview', 'aria-live': 'polite' });
      const sel = () => impayes.filter((r) => Sco.relance[r.s.id]);
      const txt = (r) => 'UHO Scolarité : ' + r.s.prenom + ', votre ' + r.retard[0].libelle + ' (' + FMT.money(r.retard[0].reste) + ') est en retard depuis le ' + FMT.date(r.retard[0].echeance) + '. Payez par Orange Money ou Moov Money dans Kalanso.';
      const counter = h('div', { class: 'xsmall muted' });
      const update = () => { const first = sel()[0] || impayes[0]; preview.textContent = first ? txt(first) : '—'; const n = first ? txt(first).length : 0; counter.textContent = n + ' caractères · ' + Math.ceil(n / 160) + ' SMS par destinataire · ' + sel().length + ' destinataire(s)'; };
      update();
      body = h('div', { class: 'grid-main' },
        UI.card({ title: 'Impayés (' + impayes.length + ')', flush: true }, UI.table({ columns: [
          { key: 'c', label: 'Relancer', render: (r) => UI.checkbox('', Sco.relance[r.s.id], (v) => { Sco.relance[r.s.id] = v; update(); }, { 'aria-label': 'Relancer ' + r.s.prenom + ' ' + r.s.nom }) },
          { key: 'n', label: 'Étudiant', render: (r) => r.s.prenom + ' ' + r.s.nom },
          { key: 'm', label: 'Montant en retard', num: true, render: (r) => FMT.money(r.retard.reduce((a, t) => a + t.reste, 0)) },
          { key: 't', label: 'Téléphone', render: (r) => r.s.tel }], rows: impayes, pageSize: 8, emptyTitle: 'Aucun impayé' })),
        UI.card({ title: 'Aperçu du SMS' }, h('div', { class: 'stack' }, preview, counter, UI.alert('neutral', null, 'Envoi via la passerelle SMS de l\'opérateur. Coût estimé : 15 FCFA par SMS.'),
          UI.button({ label: 'Envoyer les relances', icon: 'send', block: true, onClick: () => {
            if (!App.guard('finances.relancer') || !App.requireOnline('L\'envoi des SMS')) return;
            const list = sel();
            if (!list.length) { UI.toast('Sélectionnez au moins un destinataire.', 'warning'); return; }
            list.forEach((r) => App.notify(r.s.id, 'paiement', 'Relance de paiement', txt(r), '#/etudiant/paiements'));
            const parent = Object.values(App.store.users).find((u) => u.role === 'parent');
            if (parent && list.find((r) => r.s.id === parent.enfant)) App.notify(parent.id, 'paiement', 'Relance de paiement', 'La ' + K.paymentSummary(parent.enfant).retard[0].libelle + ' d\'Awa est en retard.', '#/parent/paiements');
            App.audit('Relances envoyées', list.length + ' étudiants · SMS', '', 'envoyées', '');
            UI.toast(list.length + ' SMS de relance envoyés (simulation).', 'success');
          } }))));
    } else {
      const txs = App.store.transactions.filter((t) => t.moyen === 'orange' || t.moyen === 'moov').sort((a, b) => b.date.localeCompare(a.date));
      const todo = txs.filter((t) => !t.rapproche);
      body = h('div', { class: 'stack' }, h('div', { class: 'row-between wrap' }, h('p', { class: 'small muted' }, todo.length + ' transaction(s) à vérifier sur ' + txs.length + ' reçues des opérateurs.'),
        UI.button({ label: 'Rapprocher automatiquement', icon: 'checks', disabled: !todo.length, onClick: () => {
          if (!App.guard('finances.rapprocher')) return;
          todo.forEach((t) => { t.rapproche = true; });
          App.audit('Paiement rapproché', 'Orange Money / Moov Money · ' + todo.length + ' transactions', 'à vérifier', 'rapproché', '');
          UI.toast(todo.length + ' transactions rapprochées avec les relevés opérateurs.', 'success'); App.refresh();
        } })),
      UI.table({ searchKeys: ['reference', (t) => K.name(K.user(t.sid))], pageSize: 10,
        filters: [{ id: 'm', label: 'Tous les opérateurs', options: [{ value: 'orange', label: 'Orange Money' }, { value: 'moov', label: 'Moov Money' }], test: (t, v) => t.moyen === v },
          { id: 'r', label: 'Tous les statuts', options: [{ value: '1', label: 'Rapprochées' }, { value: '0', label: 'À vérifier' }], test: (t, v) => String(Number(t.rapproche)) === v }],
        columns: [{ key: 'date', label: 'Date', sortable: true, render: (t) => FMT.dateTime(t.date) }, { key: 'reference', label: 'Référence opérateur' },
          { key: 'moyen', label: 'Opérateur', render: (t) => MOYENS[t.moyen].label }, { key: 's', label: 'Étudiant', render: (t) => K.name(K.user(t.sid)) },
          { key: 'montant', label: 'Montant', num: true, render: (t) => FMT.money(t.montant) }, { key: 'r', label: 'Statut', render: (t) => UI.status(t.rapproche ? 'rapproche' : 'a_verifier') },
          { key: 'a', label: '', render: (t) => t.rapproche ? null : UI.button({ label: 'Rapprocher', size: 's', variant: 'secondary', onClick: () => { if (!App.guard('finances.rapprocher')) return; t.rapproche = true; App.audit('Paiement rapproché', t.reference, 'à vérifier', 'rapproché', ''); UI.toast('Transaction rapprochée.', 'success'); App.refresh(); } }) }],
        rows: txs, sortKey: 'date', sortDir: 'desc' }));
    }
    const exportCsv = () => {
      const lines = [['Date', 'Référence', 'Reçu', 'Moyen', 'Matricule', 'Étudiant', 'Tranche', 'Montant (FCFA)', 'Rapproché']].concat(App.store.transactions.map((t) => [FMT.dateTime(t.date), t.reference, t.recu, MOYENS[t.moyen].label, K.user(t.sid).matricule, K.name(K.user(t.sid)), t.tranche, t.montant, t.rapproche ? 'oui' : 'non']));
      UI.download('paiements-' + DT.rel(0) + '.csv', toCSV(lines), 'text/csv;charset=utf-8');
      UI.toast('Export CSV des ' + App.store.transactions.length + ' transactions.', 'success');
    };
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Finances', sub: 'Frais : ' + FMT.money(450000) + ' par étudiant en 3 tranches.', actions: UI.button({ label: 'Exporter (CSV)', icon: 'download', variant: 'secondary', onClick: exportCsv }) }),
      h('div', { class: 'grid-4' },
        UI.kpi({ label: 'Encaissé', icon: 'wallet', value: FMT.money(App.store.transactions.reduce((a, t) => a + t.montant, 0)), foot: App.store.transactions.length + ' paiements' }),
        UI.kpi({ label: 'Taux de recouvrement', icon: 'chart', value: FMT.pct(rec.taux, 1), foot: h('span', { class: 'grow' }, UI.progress(rec.taux, 100, rec.taux < 80 ? 'warn' : null, 'Recouvrement')) }),
        UI.kpi({ label: 'Impayés', icon: 'alert', value: FMT.money(montantRetard), foot: impayes.length + ' étudiants en retard' }),
        UI.kpi({ label: 'Paiements du jour', icon: 'smartphone', value: String(today.length), foot: today.length ? FMT.money(today.reduce((a, t) => a + t.montant, 0)) : 'Aucun pour l\'instant' })),
      h('div', null, UI.tabs([{ id: 'suivi', label: 'Suivi des paiements' }, { id: 'relances', label: 'Relances SMS', count: impayes.length }, { id: 'rapprochement', label: 'Rapprochement mobile money', count: App.store.transactions.filter((t) => !t.rapproche && (t.moyen === 'orange' || t.moyen === 'moov')).length }], tab, (v) => { Sco.fin = v; App.refresh(); }, 'Finances'),
        tab === 'relances' ? body : UI.card({ ariaLabel: 'Contenu' }, body)));
  }
});

/* ---------- 11. Demandes administratives ---------- */
defineScreen('scolarite', 'demandes', {
  title: 'Demandes',
  render() {
    const list = App.store.demandes.slice().sort((a, b) => DEMANDE_STEPS.indexOf(a.statut) - DEMANDE_STEPS.indexOf(b.statut) || a.date.localeCompare(b.date));
    const advance = (d) => {
      if (!App.guard('demande.traiter')) return;
      const next = DEMANDE_STEPS[DEMANDE_STEPS.indexOf(d.statut) + 1];
      d.statut = next; d.historique.push([next, nowStamp()]);
      if (next === 'prete') App.notify(d.sid, 'annonce', 'Document prêt', d.type + ' : à retirer au guichet 2.', '#/etudiant/demandes');
      UI.toast(next === 'prete' ? 'Demande marquée « prête ». L\'étudiant est notifié par SMS.' : 'Demande en traitement.', 'success'); App.refresh();
    };
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Demandes administratives', sub: 'File des demandes des étudiants.' }),
      UI.card({ ariaLabel: 'File des demandes', flush: true }, UI.table({ searchKeys: [(d) => K.name(K.user(d.sid)), 'type'],
        filters: [{ id: 's', label: 'Tous les statuts', options: DEMANDE_STEPS.map((k) => ({ value: k, label: STATUS[k][0] })), test: (d, v) => d.statut === v }],
        columns: [{ key: 'date', label: 'Reçue', sortable: true, render: (d) => FMT.relative(d.date) }, { key: 'sid', label: 'Étudiant', render: (d) => h('div', null, h('div', { class: 'cell-main' }, K.name(K.user(d.sid))), h('div', { class: 'xsmall muted' }, K.user(d.sid).matricule)) },
          { key: 'type', label: 'Document', sortable: true }, { key: 'motif', label: 'Motif' }, { key: 'statut', label: 'Statut', render: (d) => UI.status(d.statut) },
          { key: 'a', label: '', render: (d) => h('div', { class: 'row-s' },
            d.type !== 'Relevé de notes officiel' && d.type !== 'Duplicata de carte d\'étudiant' ? UI.button({ label: 'Générer', size: 's', variant: 'ghost', icon: 'file', onClick: () => Commun.showDoc(d.type, attestationDoc(K.user(d.sid), d.type)) })
              : (K.user(d.sid).filiere === 'info' && K.user(d.sid).niveau === 'L2' ? UI.button({ label: 'Générer', size: 's', variant: 'ghost', icon: 'file', onClick: () => Commun.showDoc('Relevé de notes', Commun.releveDoc(d.sid, 'S3', 'normale')) }) : null),
            d.statut !== 'prete' ? UI.button({ label: d.statut === 'soumise' ? 'Prendre en charge' : 'Marquer prête', size: 's', variant: 'secondary', onClick: () => advance(d) }) : null) }],
        rows: list })));
  }
});

/* ---------- 12. Annonces (création ciblée + canaux) ---------- */
defineScreen('scolarite', 'annonces', {
  title: 'Annonces',
  render(ctx) {
    const titre = UI.field({ label: 'Titre', required: true, maxlength: 100 });
    const texte = UI.field({ label: 'Message', as: 'textarea', rows: 5, required: true, maxlength: 1200 });
    const cible = UI.field({ label: 'Destinataires', as: 'select', options: [{ value: 'tous', label: 'Toute l\'université' }].concat(filiereOpts().map((f) => ({ value: f.value, label: 'Filière ' + f.label }))).concat(NIVEAUX.map((n) => ({ value: n, label: 'Niveau ' + n }))).concat([{ value: 'enseignants', label: 'Les enseignants' }]) });
    const cat = UI.field({ label: 'Catégorie', as: 'select', options: ['Scolarité', 'Examens', 'Pédagogie', 'Vie de campus', 'Logistique', 'Santé'].map((x) => ({ value: x, label: x })) });
    const canaux = { appli: true, sms: false, email: false };
    let epingle = false;
    const smsInfo = h('div', { class: 'xsmall muted', 'aria-live': 'polite' });
    const updSms = () => { const n = (titre.input.value + ' : ' + texte.input.value).length; smsInfo.textContent = canaux.sms ? 'SMS : ' + n + ' caractères, soit ' + Math.max(1, Math.ceil(n / 160)) + ' SMS par destinataire.' : ''; };
    titre.input.addEventListener('input', updSms); texte.input.addEventListener('input', updSms);
    const publish = () => {
      let ok = titre.setError(titre.input.value.trim() ? null : 'Titre obligatoire.');
      ok = texte.setError(texte.input.value.trim().length >= 10 ? null : 'Message trop court.') && ok;
      if (!canaux.appli && !canaux.sms && !canaux.email) { UI.toast('Choisissez au moins un canal.', 'warning'); ok = false; }
      if (!ok || !App.guard('annonce.creer')) return;
      const a = { id: 'an' + Date.now(), titre: titre.input.value.trim(), texte: texte.input.value.trim(), date: nowStamp(), auteur: ctx.me.id, cible: cible.input.value, canaux: Object.keys(canaux).filter((k) => canaux[k]), categorie: cat.input.value, epingle };
      App.store.annonces.unshift(a);
      const targets = Object.values(App.store.users).filter((u) => u.id !== ctx.me.id && u.role !== 'scolarite' && K.annoncesFor(u).includes(a));
      targets.forEach((u) => App.notify(u.id, 'annonce', 'Nouvelle annonce', a.titre, '#/' + u.role + '/annonces'));
      UI.toast('Annonce publiée auprès de ' + targets.length + ' comptes de la démo (' + a.canaux.map((c) => ({ appli: 'application', sms: 'SMS', email: 'e-mail' }[c])).join(', ') + ').', 'success');
      App.refresh();
    };
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Annonces', sub: 'Communication ciblée par l\'application, le SMS et l\'e-mail.' }),
      h('div', { class: 'grid-main' },
        UI.card({ title: 'Nouvelle annonce' }, h('div', { class: 'stack' }, titre.el, texte.el, h('div', { class: 'form-grid cols-2' }, cible.el, cat.el),
          h('div', { class: 'field' }, h('span', { class: 'label' }, 'Canaux de diffusion'), h('div', { class: 'row wrap' },
            UI.checkbox('Application', true, (v) => { canaux.appli = v; }), UI.checkbox('SMS', false, (v) => { canaux.sms = v; updSms(); }), UI.checkbox('E-mail', false, (v) => { canaux.email = v; })), smsInfo),
          UI.toggle('Épingler en haut de la liste', false, (v) => { epingle = v; }),
          h('div', { class: 'form-actions' }, UI.button({ label: 'Publier l\'annonce', icon: 'send', onClick: publish })))),
        UI.card({ title: 'Annonces publiées' }, h('div', { class: 'stack-s' }, App.store.annonces.slice().sort((a, b) => b.date.localeCompare(a.date)).map((a) => h('div', { class: 'list-item wrap' },
          h('div', { class: 'grow' }, h('div', { class: 'list-title' }, a.titre), h('div', { class: 'list-meta' }, FMT.relative(a.date) + ' · ' + (a.cible === 'tous' ? 'Toute l\'université' : a.cible === 'enseignants' ? 'Enseignants' : K.filiere(a.cible) ? K.filiere(a.cible).nom : 'Niveau ' + a.cible))),
          h('div', { class: 'row-s' }, a.canaux.map((c) => UI.badge({ appli: 'Appli', sms: 'SMS', email: 'E-mail' }[c], 'neutral')), a.epingle ? UI.badge('Épinglée', 'warning', 'pin') : null)))))));
  }
});

/* ---------- 13. Utilisateurs et rôles ---------- */
defineScreen('scolarite', 'utilisateurs', {
  title: 'Utilisateurs et rôles',
  render(ctx) {
    const users = Object.values(App.store.users);
    const roles = ['etudiant', 'enseignant', 'scolarite', 'parent'];
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Utilisateurs et rôles', sub: users.length + ' comptes. Les permissions sont vérifiées par le routeur et par chaque action.' }),
      UI.card({ title: 'Comptes', flush: true }, UI.table({ searchKeys: [(u) => u.prenom + ' ' + u.nom, 'email', (u) => u.matricule || ''], pageSize: 10,
        filters: [{ id: 'r', label: 'Tous les rôles', options: roles.map((r) => ({ value: r, label: ROLE_LABELS[r] })), test: (u, v) => u.role === v }, { id: 'a', label: 'Tous les statuts', options: [{ value: '1', label: 'Actifs' }, { value: '0', label: 'Désactivés' }], test: (u, v) => String(Number(u.actif)) === v }],
        columns: [{ key: 'n', label: 'Utilisateur', sortable: true, sortValue: (u) => u.nom, render: (u) => h('div', { class: 'row-s' }, UI.avatar(u, 's'), h('div', null, h('div', { class: 'cell-main' }, K.name(u, true)), h('div', { class: 'xsmall muted' }, u.email))) },
          { key: 'role', label: 'Rôle', sortable: true, render: (u) => UI.badge(ROLE_LABELS[u.role], u.role === 'scolarite' ? 'accent' : 'neutral') },
          { key: 'last', label: 'Dernière connexion', sortable: true, sortValue: (u) => u.derniereConnexion, render: (u) => FMT.relative(u.derniereConnexion) },
          { key: 'actif', label: 'Statut', render: (u) => UI.status(u.actif ? 'actif' : 'inactif') },
          { key: 'a', label: '', render: (u) => u.id === ctx.me.id ? UI.badge('Vous', 'accent') : UI.dropdown(UI.button({ label: 'Actions pour ' + K.name(u), icon: 'more', iconOnly: true, size: 's', variant: 'ghost' }), [
            { label: 'Réinitialiser le mot de passe', icon: 'key', onClick: () => UI.confirm({ title: 'Réinitialiser le mot de passe ?', message: 'Un lien de réinitialisation valable 15 minutes sera envoyé par SMS au ' + u.tel + '.', confirmLabel: 'Envoyer le lien' }).then((ok) => { if (!ok || !App.guard('users.gerer')) return; App.audit('Mot de passe réinitialisé', 'Compte de ' + K.name(u), '', 'lien envoyé', ''); UI.toast('Lien de réinitialisation envoyé à ' + u.prenom + '.', 'success'); }) },
            { label: u.actif ? 'Désactiver le compte' : 'Réactiver le compte', icon: u.actif ? 'lock' : 'check', danger: u.actif, onClick: () => UI.confirm({ title: (u.actif ? 'Désactiver' : 'Réactiver') + ' le compte de ' + K.name(u) + ' ?', message: u.actif ? 'La personne ne pourra plus se connecter. Ses données sont conservées.' : 'La personne pourra de nouveau se connecter.', confirmLabel: u.actif ? 'Désactiver' : 'Réactiver', danger: u.actif }).then((ok) => { if (!ok || !App.guard('users.gerer')) return; App.audit(u.actif ? 'Compte désactivé' : 'Compte réactivé', 'Compte de ' + K.name(u), u.actif ? 'actif' : 'désactivé', u.actif ? 'désactivé' : 'actif', ''); u.actif = !u.actif; UI.toast('Compte ' + (u.actif ? 'réactivé' : 'désactivé') + '.', 'success'); App.refresh(); }) }
          ]) }], rows: users, sortKey: 'n' })),
      UI.card({ title: 'Matrice des permissions (lecture seule)', flush: true }, h('div', { class: 'table-wrap' }, h('table', { class: 'table perm-matrix' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Permission'), roles.map((r) => h('th', { scope: 'col' }, ROLE_LABELS[r])))),
        h('tbody', null, PERMISSION_LABELS.map(([label, allowed]) => h('tr', null, h('td', null, label), roles.map((r) => h('td', null, allowed.includes(r) ? h('span', { class: 'perm-yes' }, icon('check', 18), h('span', { class: 'sr-only' }, 'Autorisé')) : h('span', { class: 'perm-no' }, icon('minus', 18), h('span', { class: 'sr-only' }, 'Refusé')))))))))));
  }
});

/* ---------- 14. Journal d'audit ---------- */
defineScreen('scolarite', 'audit', {
  title: 'Journal d\'audit',
  render() {
    const rows = App.store.audit.slice().sort((a, b) => b.date.localeCompare(a.date));
    const actions = Array.from(new Set(rows.map((a) => a.action))).sort();
    const authors = Array.from(new Set(rows.map((a) => a.uid)));
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Journal d\'audit', sub: 'Qui a modifié quoi et quand. Lecture seule : aucune entrée ne peut être modifiée ni supprimée.',
      actions: UI.button({ label: 'Exporter (CSV)', icon: 'download', variant: 'secondary', onClick: () => { UI.download('journal-audit-' + DT.rel(0) + '.csv', toCSV([['Date', 'Utilisateur', 'Action', 'Cible', 'Avant', 'Après', 'Motif', 'Adresse IP']].concat(rows.map((a) => [FMT.dateTime(a.date), K.name(K.user(a.uid)), a.action, a.cible, a.avant, a.apres, a.motif, a.ip]))), 'text/csv;charset=utf-8'); UI.toast('Journal exporté.', 'success'); } }) }),
      UI.alert('info', 'Transparence des notes', 'Chaque modification de note, point de jury ou changement de rôle est horodaté avec son auteur, l\'ancienne et la nouvelle valeur. Dans la version réelle, ce journal est immuable (chaînage des entrées).'),
      UI.card({ ariaLabel: 'Entrées du journal', flush: true }, UI.table({ searchKeys: ['cible', 'motif', (a) => K.name(K.user(a.uid))], pageSize: 12,
        filters: [{ id: 'a', label: 'Toutes les actions', options: actions.map((x) => ({ value: x, label: x })), test: (a, v) => a.action === v },
          { id: 'u', label: 'Tous les utilisateurs', options: authors.map((x) => ({ value: x, label: K.name(K.user(x), true) })), test: (a, v) => a.uid === v },
          { id: 'p', label: 'Toute la période', options: [{ value: '1', label: 'Aujourd\'hui' }, { value: '7', label: '7 derniers jours' }, { value: '30', label: '30 derniers jours' }], test: (a, v) => DT.diffDays(DT.rel(0), a.date.slice(0, 10)) < Number(v) }],
        columns: [{ key: 'date', label: 'Date', sortable: true, render: (a) => h('span', { class: 'nowrap' }, FMT.dateTime(a.date)) },
          { key: 'uid', label: 'Utilisateur', render: (a) => h('div', { class: 'row-s' }, UI.avatar(K.user(a.uid), 's'), K.name(K.user(a.uid), true)) },
          { key: 'action', label: 'Action', sortable: true, render: (a) => UI.badge(a.action, /Note|jury/i.test(a.action) ? 'warning' : /Compte|Rôle|Mot de passe/.test(a.action) ? 'info' : 'neutral') },
          { key: 'cible', label: 'Cible' },
          { key: 'chg', label: 'Avant → après', render: (a) => a.avant || a.apres ? h('span', { class: 'nowrap' }, h('s', { class: 'muted' }, a.avant || '—'), ' → ', h('strong', null, a.apres || '—')) : '—' },
          { key: 'motif', label: 'Motif', render: (a) => a.motif || h('span', { class: 'muted' }, '—') },
          { key: 'ip', label: 'IP', render: (a) => h('span', { class: 'xsmall muted num' }, a.ip) }], rows, sortKey: 'date', sortDir: 'desc' })));
  }
});

/* ---------- 15. Paramètres de l'établissement ---------- */
defineScreen('scolarite', 'parametres', {
  title: 'Paramètres',
  render() {
    const p = App.store.parametres;
    const u = App.store.universite;
    const nom = UI.field({ label: 'Nom de l\'établissement', value: u.nom, required: true });
    const sigle = UI.field({ label: 'Sigle', value: u.sigle, maxlength: 10 });
    const annee = UI.field({ label: 'Année universitaire', value: u.annee, hint: 'Format AAAA-AAAA' });
    const per = p.periodes.map((x) => ({ x, d: UI.datePicker({ label: x.nom + ' — début', value: x.debut }), f: UI.datePicker({ label: x.nom + ' — fin', value: x.fin }) }));
    const pcc = UI.field({ label: 'Pondération du contrôle continu (%)', type: 'number', min: '0', max: '100', value: String(p.ponderationCC) });
    const pex = UI.field({ label: 'Pondération de l\'examen (%)', type: 'number', min: '0', max: '100', value: String(p.ponderationExam) });
    pcc.input.addEventListener('input', () => { const v = Number(pcc.input.value); if (v >= 0 && v <= 100) pex.input.value = String(100 - v); });
    const seuil = UI.field({ label: 'Seuil de validation d\'une UE', type: 'number', step: '0.25', value: String(p.seuilValidation) });
    const plancher = UI.field({ label: 'Note plancher pour la compensation', type: 'number', step: '0.25', value: String(p.notePlancher), hint: 'En dessous, une UE n\'est jamais compensée.' });
    const abs = UI.field({ label: 'Seuil d\'absences non justifiées par matière', type: 'number', min: '1', max: '10', value: String(p.seuilAbsences) });
    const moyens = Object.assign({}, p.moyens);
    const save = () => {
      if (!App.guard('parametres.modifier')) return;
      const vcc = Number(pcc.input.value); const vex = Number(pex.input.value);
      let ok = nom.setError(nom.input.value.trim() ? null : 'Nom obligatoire.');
      ok = annee.setError(/^\d{4}-\d{4}$/.test(annee.input.value.trim()) ? null : 'Format AAAA-AAAA.') && ok;
      ok = pcc.setError(vcc + vex === 100 && vcc >= 0 ? null : 'Les pondérations doivent totaliser 100 %.') && ok;
      ok = seuil.setError(Number(seuil.input.value) > 0 && Number(seuil.input.value) <= 20 ? null : 'Entre 0 et 20.') && ok;
      ok = plancher.setError(Number(plancher.input.value) >= 0 && Number(plancher.input.value) < Number(seuil.input.value) ? null : 'Doit être inférieure au seuil de validation.') && ok;
      ok = abs.setError(Number.isInteger(Number(abs.input.value)) && Number(abs.input.value) >= 1 ? null : 'Nombre entier ≥ 1.') && ok;
      per.forEach((x) => { ok = x.f.setError(x.f.input.value > x.d.input.value ? null : 'La fin doit suivre le début.') && ok; });
      if (!Object.values(moyens).some(Boolean)) { UI.toast('Activez au moins un moyen de paiement.', 'warning'); ok = false; }
      if (!ok) return;
      const changes = [['Pondération CC', p.ponderationCC, vcc], ['Seuil de validation', p.seuilValidation, Number(seuil.input.value)], ['Note plancher', p.notePlancher, Number(plancher.input.value)], ['Seuil d\'absences', p.seuilAbsences, Number(abs.input.value)]];
      changes.forEach(([label, avant, apres]) => { if (avant !== apres) App.audit('Paramètre modifié', label, avant, apres, ''); });
      Object.assign(p, { ponderationCC: vcc, ponderationExam: vex, seuilValidation: Number(seuil.input.value), notePlancher: Number(plancher.input.value), seuilAbsences: Number(abs.input.value), moyens });
      per.forEach((x) => { x.x.debut = x.d.input.value; x.x.fin = x.f.input.value; });
      Object.assign(u, { nom: nom.input.value.trim(), sigle: sigle.input.value.trim(), annee: annee.input.value.trim() });
      UI.toast('Paramètres enregistrés. Moyennes et décisions recalculées.', 'success'); App.shellRole = null; App.refresh();
    };
    return h('div', { class: 'stack-l' }, UI.pageHead({ title: 'Paramètres de l\'établissement', actions: UI.button({ label: 'Enregistrer', icon: 'check', onClick: save }) }),
      UI.card({ title: 'Identité' }, h('div', { class: 'stack' }, h('div', { class: 'row wrap' }, UI.logo(64), h('div', { class: 'grow' }, UI.upload({ accept: ['png', 'jpg', 'jpeg'], maxMo: 1, label: 'Logo de l\'établissement', demoName: 'logo-uho.png', demoKo: 48, onFile: () => UI.toast('Logo prêt : il apparaîtra sur les documents officiels (simulation).', 'info') }))),
        h('div', { class: 'form-grid cols-3' }, nom.el, sigle.el, annee.el))),
      UI.card({ title: 'Périodes' }, h('div', { class: 'form-grid cols-2' }, per.flatMap((x) => [x.d.el, x.f.el]))),
      UI.card({ title: 'Règles de calcul' }, h('div', { class: 'stack' }, h('div', { class: 'form-grid cols-2' }, pcc.el, pex.el, seuil.el, plancher.el, abs.el),
        UI.alert('warning', null, 'Toute modification recalcule immédiatement les moyennes, compensations, crédits et décisions de tous les étudiants, et est tracée dans le journal d\'audit.'))),
      UI.card({ title: 'Moyens de paiement' }, h('div', { class: 'stack-s' }, Object.keys(MOYENS).map((k) => h('div', { class: 'row' }, h('span', { class: 'provider-logo ' + MOYENS[k].cls, 'aria-hidden': 'true' }, MOYENS[k].short), h('div', { class: 'grow' }, UI.toggle(MOYENS[k].label, moyens[k], (v) => { moyens[k] = v; })))))));
  }
});

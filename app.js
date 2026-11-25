'use strict';
/*
 * Cœur de la maquette : store, calculs LMD, contrôle d'accès (RBAC),
 * routeur par hash, coquille responsive, barre de démo, tests de calcul.
 */

/* ======================================================================
   1. Calculs LMD (fonctions pures, testées plus bas avec console.assert)
   ====================================================================== */
const Calc = {
  round2(n) { return Math.round(n * 100) / 100; },
  /** Valeur exploitable d'une note : ABS = 0, DISP = dispensé (ignoré), vide = null. */
  value(v) {
    if (v === 'ABS') return 0;
    if (v === 'DISP' || v === '' || v === null || v === undefined) return null;
    return Number(v);
  },
  /** Contrôle continu = moyenne des CC disponibles. */
  cc(cc1, cc2) {
    const vals = [cc1, cc2].map(Calc.value).filter((v) => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  },
  /**
   * Moyenne d'ECUE = CC × pondération + examen × pondération (40/60 par défaut).
   * En session de rattrapage, la meilleure des deux notes d'examen est retenue.
   */
  ecue(n, params, session) {
    const p = params || { ponderationCC: 40, ponderationExam: 60 };
    const cc = Calc.cc(n.cc1, n.cc2);
    let exam = Calc.value(n.exam);
    const ratt = Calc.value(n.ratt);
    if (session === 'rattrapage' && ratt !== null) exam = exam === null ? ratt : Math.max(exam, ratt);
    if (exam === null) return { cc, exam: null, moy: null };
    const moy = cc === null ? exam : (cc * p.ponderationCC + exam * p.ponderationExam) / 100;
    return { cc, exam, moy: Calc.round2(moy) };
  },
  /** Moyenne d'UE pondérée par les coefficients des ECUE. */
  ue(ecues) {
    if (!ecues.length || ecues.some((e) => e.moy === null)) return null;
    const tc = ecues.reduce((a, e) => a + e.coef, 0);
    return Calc.round2(ecues.reduce((a, e) => a + e.moy * e.coef, 0) / tc);
  },
  /**
   * Résultat du semestre : moyenne pondérée par les crédits, statut de chaque UE
   * (validée / compensée / non validée) et crédits acquis.
   * Compensation : UE < 10 compensée si moyenne du semestre ≥ 10 et UE ≥ note plancher.
   * Les points de jury s'ajoutent à la moyenne du semestre.
   */
  semester(ues, params, juryPts) {
    const p = params;
    const total = ues.reduce((a, u) => a + u.credits, 0);
    const complete = ues.every((u) => u.moy !== null);
    let moy = complete ? Calc.round2(ues.reduce((a, u) => a + u.moy * u.credits, 0) / total) : null;
    if (moy !== null && juryPts) moy = Calc.round2(moy + juryPts);
    const statuts = ues.map((u) => {
      if (u.moy === null) return 'en_cours';
      if (u.moy >= p.seuilValidation) return 'validee';
      if (moy === null) return 'en_cours';
      if (moy >= p.seuilValidation && u.moy >= p.notePlancher) return 'compensee';
      return 'non_validee';
    });
    const credits = ues.reduce((a, u, i) => a + (statuts[i] === 'validee' || statuts[i] === 'compensee' ? u.credits : 0), 0);
    return { moy, statuts, credits, total, complete };
  },
  decision(credits, total, session, complete) {
    if (!complete) return null;
    if (credits >= total) return 'admis';
    return session === 'rattrapage' ? 'ajourne' : 'rattrapage';
  },
  mention(moy) {
    if (moy === null || moy < 10) return null;
    if (moy < 12) return 'Passable';
    if (moy < 14) return 'Assez bien';
    if (moy < 16) return 'Bien';
    return 'Très bien';
  },
  stats(values) {
    const v = values.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b);
    if (!v.length) return { n: 0, avg: null, med: null, min: null, max: null, above: 0 };
    const avg = v.reduce((a, b) => a + b, 0) / v.length;
    const med = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
    return { n: v.length, avg: Calc.round2(avg), med, min: v[0], max: v[v.length - 1], above: v.filter((x) => x >= 10).length };
  },
  /** Validation stricte d'une saisie de note : 0 à 20, au quart de point, ou ABS / DISP. */
  parseNote(raw) {
    const t = String(raw).trim().toUpperCase().replace(',', '.');
    if (t === '') return { ok: true, value: undefined };
    if (t === 'ABS' || t === 'DISP') return { ok: true, value: t };
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return { ok: false, error: 'Nombre attendu (ex. 12,5), ABS ou DISP' };
    const n = Number(t);
    if (n < 0 || n > 20) return { ok: false, error: 'La note doit être comprise entre 0 et 20' };
    if (Math.round(n * 4) !== n * 4) return { ok: false, error: 'Précision au quart de point (0,25)' };
    return { ok: true, value: n };
  },
  /** Téléphone burkinabè : +226 XX XX XX XX */
  phoneOk(str) { return /^\+226 ?[0-7]\d ?\d{2} ?\d{2} ?\d{2}$/.test(String(str).trim()); }
};

/* ======================================================================
   2. État global et requêtes sur les données
   ====================================================================== */
const App = {
  store: null,
  session: null,           // { role, userId }
  pendingLogin: null,      // connexion en cours (avant l'OTP)
  ui: { theme: 'light', offline: false, offlineSince: null, dataSaver: false, demoCollapsed: false },
  shellRole: null
};

const ROLE_LABELS = { etudiant: 'Étudiant', enseignant: 'Enseignant', scolarite: 'Scolarité (admin)', parent: 'Parent' };
const DEMO_USERS = { etudiant: 's1', enseignant: 't1', scolarite: 'a1', parent: 'p1' };

const K = {
  user(id) { return App.store.users[id]; },
  me() { return App.session ? App.store.users[App.session.userId] : null; },
  name(u, withTitle) { if (!u) return '—'; return (withTitle && u.titre ? u.titre + ' ' : '') + u.prenom + ' ' + u.nom; },
  /** Étudiant concerné par l'écran : soi-même ou l'enfant du parent. */
  student() { const me = K.me(); return me.role === 'parent' ? K.user(me.enfant) : me; },
  ues(filiere = 'info', niveau = 'L2', sem) { return App.store.formation.ues.filter((u) => u.filiere === filiere && u.niveau === niveau && (!sem || u.semestre === sem)); },
  ue(id) { return App.store.formation.ues.find((u) => u.id === id); },
  ecue(id) {
    for (const u of App.store.formation.ues) { const e = u.ecues.find((x) => x.id === id); if (e) return Object.assign({ ue: u }, e); }
    return null;
  },
  ecueName(id) { const e = K.ecue(id); return e ? e.nom : id; },
  salle(id) { return App.store.salles.find((x) => x.id === id) || { id, nom: id, capacite: 0, equipements: [] }; },
  promo() { return Object.values(App.store.users).filter((u) => u.role === 'etudiant' && u.filiere === 'info' && u.niveau === 'L2'); },
  students() { return Object.values(App.store.users).filter((u) => u.role === 'etudiant'); },
  teachers() { return Object.values(App.store.users).filter((u) => u.role === 'enseignant'); },
  filiere(id) { return App.store.formation.filieres.find((f) => f.id === id); },
  sheet(ecueId, ev) { return App.store.sheets.find((f) => f.ecueId === ecueId && f.eval === ev); },
  /** Note publiée (visible par l'étudiant) : uniquement si la feuille est validée par la Scolarité. */
  note(sid, ecueId, ev) { const f = K.sheet(ecueId, ev); return f && f.statut === 'validee' ? f.notes[sid] : undefined; },
  notesOf(sid, ecueId) { return { cc1: K.note(sid, ecueId, 'CC1'), cc2: K.note(sid, ecueId, 'CC2'), exam: K.note(sid, ecueId, 'EXAM'), ratt: K.note(sid, ecueId, 'RATT') }; },
  /**
   * Résultat complet d'un étudiant pour un semestre (calculé, jamais codé en dur).
   * overrides : { ecueId: { exam, ratt } } — utilisé par le simulateur de moyenne.
   */
  result(sid, sem, session = 'normale', overrides) {
    const params = App.store.parametres;
    const student = K.user(sid);
    const ues = K.ues(student.filiere, student.niveau, sem).map((ue) => {
      const ecues = ue.ecues.map((e) => {
        const n = Object.assign(K.notesOf(sid, e.id), (overrides && overrides[e.id]) || {});
        return Object.assign({ ecue: e, coef: e.coef, notes: n }, Calc.ecue(n, params, session));
      });
      return { ue, ecues, credits: ue.credits, moy: Calc.ue(ecues) };
    });
    const jury = (App.store.jury[sid + '-' + sem + '-' + session] || {}).pts || 0;
    const r = Calc.semester(ues, params, jury);
    ues.forEach((u, i) => { u.statut = r.statuts[i]; });
    return { sid, sem, session, ues, moy: r.moy, credits: r.credits, total: r.total, complete: r.complete, jury,
      decision: Calc.decision(r.credits, r.total, session, r.complete), mention: Calc.mention(r.moy) };
  },
  /** Statistiques de la classe pour une ECUE (moyennes d'ECUE des étudiants). */
  classEcue(ecueId, session = 'normale') {
    const params = App.store.parametres;
    return Calc.stats(K.promo().map((s) => Calc.ecue(K.notesOf(s.id, ecueId), params, session).moy));
  },
  classEval(ecueId, ev) { const f = K.sheet(ecueId, ev); if (!f || f.statut !== 'validee') return Calc.stats([]); return Calc.stats(Object.values(f.notes).map(Calc.value)); },
  rank(sid, sem) {
    const list = K.promo().map((s) => ({ id: s.id, moy: K.result(s.id, sem).moy })).filter((x) => x.moy !== null).sort((a, b) => b.moy - a.moy);
    const i = list.findIndex((x) => x.id === sid);
    return i === -1 ? null : { rang: i + 1, sur: list.length };
  },
  ecuesOfTeacher(tid) { const out = []; App.store.formation.ues.forEach((u) => u.ecues.forEach((e) => { if (e.ens === tid) out.push(Object.assign({ ue: u }, e)); })); return out; },

  /* ----- Emploi du temps ----- */
  sessionsFor(user, from, to) {
    return App.store.sessions.filter((c) => {
      if (from && c.date < from) return false;
      if (to && c.date > to) return false;
      if (!user) return true;
      if (user.role === 'enseignant') return c.ens === user.id;
      if (user.role === 'etudiant' || user.role === 'parent') {
        const st = user.role === 'parent' ? K.user(user.enfant) : user;
        return c.filiere === st.filiere && c.niveau === st.niveau && (c.groupe === 'all' || c.groupe === st.groupe);
      }
      return true;
    }).sort((a, b) => (a.date + a.debut).localeCompare(b.date + b.debut));
  },
  sessionTitle(c) { return c.ecueId ? K.ecueName(c.ecueId) : c.titre; },
  sessionColor(c) { const e = c.ecueId ? K.ecue(c.ecueId) : null; return e ? e.couleur : 7; },
  sessionTeacher(c) { return c.ens ? K.name(K.user(c.ens), true) : (c.ensNom || '—'); },
  nextSession(user) {
    const now = new Date();
    return K.sessionsFor(user, DT.iso(now)).find((c) => c.statut !== 'annule' && DT.toDate(c.date, c.fin) > now) || null;
  },
  /** Conflits : même salle ou même enseignant sur des créneaux qui se chevauchent. */
  conflicts(list) {
    const src = (list || App.store.sessions).filter((c) => c.statut !== 'annule');
    const out = [];
    for (let i = 0; i < src.length; i++) {
      for (let j = i + 1; j < src.length; j++) {
        const a = src[i]; const b = src[j];
        if (a.date !== b.date || !(a.debut < b.fin && b.debut < a.fin)) continue;
        if (a.salle === b.salle) out.push({ type: 'salle', a, b });
        else if (a.ens && a.ens === b.ens) out.push({ type: 'enseignant', a, b });
      }
    }
    return out;
  },

  /* ----- Paiements ----- */
  tranchesOf(sid) {
    const today = DT.rel(0);
    return App.store.tranches.map((t) => {
      const tx = App.store.transactions.filter((x) => x.sid === sid && x.tranche === t.n);
      const paye = tx.reduce((a, x) => a + x.montant, 0);
      const statut = paye >= t.montant ? 'payee' : t.echeance < today ? 'retard' : 'avenir';
      return Object.assign({}, t, { paye, reste: t.montant - paye, statut, tx });
    });
  },
  paymentSummary(sid) {
    const tr = K.tranchesOf(sid);
    const total = tr.reduce((a, t) => a + t.montant, 0);
    const paye = tr.reduce((a, t) => a + t.paye, 0);
    return { tranches: tr, total, paye, reste: total - paye, retard: tr.filter((t) => t.statut === 'retard'), prochaine: tr.find((t) => t.statut !== 'payee') || null };
  },
  paymentStatus(sid) { return K.paymentSummary(sid).retard.length ? 'impaye' : 'a_jour'; },
  /** Taux de recouvrement : montants encaissés / montants exigibles à ce jour. */
  recouvrement() {
    const today = DT.rel(0);
    let du = 0; let paye = 0;
    K.students().filter((s) => s.actif).forEach((s) => K.tranchesOf(s.id).forEach((t) => { if (t.echeance <= today) { du += t.montant; paye += Math.min(t.paye, t.montant); } }));
    return { du, paye, taux: du ? Math.min(100, (paye / du) * 100) : 100 };
  },

  /* ----- Absences ----- */
  absencesOf(sid) { return App.store.absences.filter((a) => a.sid === sid).sort((a, b) => b.date.localeCompare(a.date)); },
  absenceStats(sid) {
    const list = K.absencesOf(sid);
    const abs = list.filter((a) => a.type === 'absence');
    const debut = App.store.parametres.periodes[1].debut;
    const weeks = Math.max(1, DT.diffDays(DT.rel(0), debut) / 7);
    const user = K.user(sid);
    const perWeek = App.store.sessions.filter((c) => c.id.startsWith('c1-') && c.filiere === user.filiere && c.niveau === user.niveau && (c.groupe === 'all' || c.groupe === user.groupe)).length || 16;
    const prevues = Math.round(weeks * perWeek);
    return {
      justifiees: abs.filter((a) => a.statut === 'justifiee').length,
      nonJustifiees: abs.filter((a) => a.statut === 'non_justifiee' || a.statut === 'refusee').length,
      enAttente: abs.filter((a) => a.statut === 'en_attente').length,
      retards: list.filter((a) => a.type === 'retard').length,
      prevues,
      taux: Math.max(0, 100 - (abs.length / prevues) * 100)
    };
  },
  /** ECUE où l'étudiant approche (ou atteint) le seuil d'absences non justifiées. */
  absenceRisks(sid) {
    const seuil = App.store.parametres.seuilAbsences;
    const counts = {};
    K.absencesOf(sid).filter((a) => a.type === 'absence' && a.statut !== 'justifiee').forEach((a) => { counts[a.ecueId] = (counts[a.ecueId] || 0) + 1; });
    return Object.keys(counts).filter((k) => counts[k] >= seuil - 1).map((k) => ({ ecueId: k, count: counts[k], seuil, depasse: counts[k] >= seuil }));
  },

  /* ----- Devoirs ----- */
  devoirStatus(d, sid) {
    const r = d.rendus[sid];
    if (r) {
      if (r.note !== null && r.note !== undefined) return 'corrige';
      return r.date.slice(0, 10) > d.dateLimite ? 'en_retard' : 'rendu';
    }
    return d.dateLimite < DT.rel(0) ? 'non_rendu' : 'a_faire';
  },

  /* ----- Messagerie et notifications ----- */
  conversationsOf(uidv) {
    return App.store.conversations.filter((c) => c.participants.includes(uidv))
      .sort((a, b) => b.messages[b.messages.length - 1].date.localeCompare(a.messages[a.messages.length - 1].date));
  },
  unreadIn(c, uidv) { return c.messages.filter((m) => m.from !== uidv && !m.luPar.includes(uidv)).length; },
  unreadMessages(uidv) { return K.conversationsOf(uidv).reduce((a, c) => a + K.unreadIn(c, uidv), 0); },
  notifsOf(uidv) { return App.store.notifications.filter((n) => n.uid === uidv).sort((a, b) => b.date.localeCompare(a.date)); },
  unreadNotifs(uidv) { return K.notifsOf(uidv).filter((n) => !n.lu).length; },
  pendingValidations() { return App.store.sheets.filter((f) => f.statut === 'soumise').length; },
  pendingJustifs() { return App.store.absences.filter((a) => a.statut === 'en_attente').length; },
  pendingDemandes() { return App.store.demandes.filter((d) => d.statut === 'soumise').length; },
  annoncesFor(user) {
    const st = user.role === 'parent' ? K.user(user.enfant) : user;
    return App.store.annonces.filter((a) => {
      if (user.role === 'scolarite') return true;
      if (a.cible === 'tous') return true;
      if (a.cible === 'enseignants') return user.role === 'enseignant';
      if (user.role === 'enseignant') return a.cible === 'info';
      return a.cible === st.filiere || a.cible === st.niveau || a.cible === st.filiere + '-' + st.niveau;
    }).sort((a, b) => (Number(b.epingle) - Number(a.epingle)) || b.date.localeCompare(a.date));
  }
};

/* Horodatage « maintenant » au format interne */
function nowStamp() { const d = new Date(); return DT.iso(d) + 'T' + DT.pad(d.getHours()) + ':' + DT.pad(d.getMinutes()); }

/** Ajoute une notification à un utilisateur (centre de notifications + badge). */
App.notify = function (uidv, type, titre, texte, lien) {
  App.store.notifications.unshift({ id: 'n' + Date.now() + Math.floor(Math.random() * 1000), uid: uidv, type, titre, texte, date: nowStamp(), lu: false, lien });
  App.updateBadges();
};

/** Trace une action sensible dans le journal d'audit (lecture seule pour tous). */
App.audit = function (action, cible, avant, apres, motif) {
  App.store.audit.unshift({ id: 'au' + Date.now() + Math.floor(Math.random() * 1000), date: nowStamp(), uid: App.session.userId, action, cible, avant: String(avant ?? ''), apres: String(apres ?? ''), motif: motif || '', ip: '10.12.0.7' });
};

/* ======================================================================
   3. Contrôle d'accès (RBAC simulé)
   ====================================================================== */
const PERMISSIONS = {
  etudiant: ['etudiant/*', 'paiement.payer', 'absence.justifier', 'devoir.rendre', 'demande.creer', 'message.individuel', 'evenement.inscrire'],
  enseignant: ['enseignant/*', 'appel.faire', 'notes.saisir', 'cahier.remplir', 'devoir.corriger', 'devoir.creer', 'ressource.deposer', 'message.individuel', 'message.groupe', 'cours.report'],
  scolarite: ['scolarite/*', 'notes.valider', 'deliberation.jury', 'deliberation.publier', 'absence.valider', 'finances.relancer', 'finances.rapprocher', 'annonce.creer',
    'users.gerer', 'audit.lire', 'edt.modifier', 'parametres.modifier', 'etudiant.creer', 'formation.modifier', 'demande.traiter', 'message.individuel', 'message.groupe'],
  parent: ['parent/*', 'paiement.payer', 'message.scolarite']
};
/** Libellés lisibles pour la matrice RBAC (lecture seule). */
const PERMISSION_LABELS = [
  ['Consulter notes, absences et emploi du temps', ['etudiant', 'enseignant', 'scolarite', 'parent']],
  ['Payer une tranche (Orange Money, Moov Money)', ['etudiant', 'parent']],
  ['Justifier une absence', ['etudiant']],
  ['Faire l\'appel', ['enseignant']],
  ['Saisir et soumettre des notes', ['enseignant']],
  ['Valider les notes', ['scolarite']],
  ['Attribuer des points de jury', ['scolarite']],
  ['Publier les résultats', ['scolarite']],
  ['Écrire à un groupe ou une promotion', ['enseignant', 'scolarite']],
  ['Relancer les impayés (SMS)', ['scolarite']],
  ['Gérer les comptes et les rôles', ['scolarite']],
  ['Consulter le journal d\'audit', ['scolarite']]
];

function can(perm, role) {
  const r = role || (App.session && App.session.role);
  if (!r) return false;
  const list = PERMISSIONS[r] || [];
  return list.includes(perm) || (perm.includes('/') && list.includes(perm.split('/')[0] + '/*'));
}
/** Vérifie une permission côté logique (même si le bouton est déjà masqué). */
App.guard = function (perm) {
  if (can(perm)) return true;
  UI.toast('Votre rôle ne permet pas cette action.', 'error', 'Action refusée');
  return false;
};
/** Bloque les actions qui exigent le réseau en mode hors ligne. */
App.requireOnline = function (what) {
  if (!App.ui.offline) return true;
  UI.toast(what + ' nécessite une connexion. Réessayez au retour du réseau.', 'warning', 'Vous êtes hors ligne');
  return false;
};

/* ======================================================================
   4. Navigation par rôle : [id, libellé, icône, entrée de la barre du bas]
   ====================================================================== */
const NAV = {
  etudiant: [
    { group: 'Ma scolarité', items: [
      ['accueil', 'Accueil', 'home', true], ['emploi-du-temps', 'Emploi du temps', 'calendar', true], ['notes', 'Notes', 'award', true], ['releve', 'Relevé de notes', 'file'],
      ['absences', 'Absences', 'clock'], ['devoirs', 'Devoirs', 'book'], ['ressources', 'Ressources', 'folder'], ['examens', 'Examens', 'exam']] },
    { group: 'Administratif', items: [['paiements', 'Paiements', 'wallet'], ['demandes', 'Demandes', 'inbox'], ['campus', 'Vie de campus', 'flag']] },
    { group: 'Communication', items: [['messages', 'Messages', 'message', true], ['notifications', 'Notifications', 'bell'], ['annonces', 'Annonces', 'megaphone'], ['profil', 'Profil et paramètres', 'settings']] }
  ],
  enseignant: [
    { group: 'Enseignement', items: [
      ['accueil', 'Accueil', 'home', true], ['emploi-du-temps', 'Mon emploi du temps', 'calendar', true], ['appel', 'Faire l\'appel', 'userCheck', true], ['notes', 'Saisie des notes', 'edit', true],
      ['cahier', 'Cahier de textes', 'pen'], ['corrections', 'Correction des devoirs', 'checks'], ['ressources', 'Ressources', 'folder'], ['statistiques', 'Statistiques', 'bars']] },
    { group: 'Communication', items: [['messages', 'Messages', 'message'], ['notifications', 'Notifications', 'bell'], ['annonces', 'Annonces', 'megaphone'], ['profil', 'Profil et paramètres', 'settings']] }
  ],
  scolarite: [
    { group: 'Pilotage', items: [['accueil', 'Tableau de bord', 'home', true], ['etudiants', 'Étudiants', 'users', true], ['enseignants', 'Enseignants et personnel', 'briefcase']] },
    { group: 'Pédagogie', items: [['formation', 'Offre de formation', 'layers'], ['emplois-du-temps', 'Emplois du temps', 'calendar'], ['salles', 'Salles', 'door'],
      ['validation', 'Validation des notes', 'checks', true], ['deliberations', 'Délibérations et PV', 'scale'], ['absences', 'Absences', 'clock']] },
    { group: 'Gestion', items: [['finances', 'Finances', 'wallet', true], ['demandes', 'Demandes', 'inbox'], ['annonces', 'Annonces', 'megaphone']] },
    { group: 'Administration', items: [['utilisateurs', 'Utilisateurs et rôles', 'key'], ['audit', 'Journal d\'audit', 'history'], ['parametres', 'Paramètres', 'settings']] },
    { group: 'Communication', items: [['messages', 'Messages', 'message'], ['notifications', 'Notifications', 'bell'], ['profil', 'Mon profil', 'user']] }
  ],
  parent: [
    { group: 'Suivi d\'Awa', items: [['accueil', 'Synthèse', 'home', true], ['notes', 'Notes', 'award', true], ['absences', 'Absences', 'clock', true], ['paiements', 'Paiements', 'wallet', true]] },
    { group: 'Communication', items: [['messages', 'Messagerie', 'message'], ['notifications', 'Notifications', 'bell'], ['annonces', 'Annonces', 'megaphone'], ['profil', 'Profil et paramètres', 'settings']] }
  ]
};
const SHORT_LABELS = { 'emploi-du-temps': 'Planning', appel: 'Appel', notes: 'Notes', accueil: 'Accueil', validation: 'Validation' };

function navCount(role, id) {
  const me = App.session.userId;
  if (id === 'messages') return K.unreadMessages(me);
  if (id === 'notifications') return 0; // compteur porté uniquement par la cloche (évite le doublon)
  if (role === 'scolarite' && id === 'validation') return K.pendingValidations();
  if (role === 'scolarite' && id === 'absences') return K.pendingJustifs();
  if (role === 'scolarite' && id === 'demandes') return K.pendingDemandes();
  if (role === 'enseignant' && id === 'notes') return App.store.sheets.filter((f) => f.ens === me && (f.statut === 'brouillon' || f.statut === 'renvoyee')).length;
  return 0;
}

/* ======================================================================
   5. Coquille : barre latérale, barre du haut, navigation du bas
   ====================================================================== */
function buildShell(role) {
  const app = clear(document.getElementById('app'));
  const me = K.me();
  const navEl = h('nav', { 'aria-label': 'Navigation principale' });
  NAV[role].forEach((g) => {
    navEl.appendChild(h('div', { class: 'nav-group' }, h('div', { class: 'nav-group-title' }, g.group),
      g.items.map(([id, label, ic]) => h('a', { class: 'nav-link', href: '#/' + role + '/' + id, 'data-nav': id }, icon(ic, 20), h('span', null, label), h('span', { class: 'count', 'data-count': id, hidden: true })))));
  });
  const themeBtn = h('button', { class: 'nav-link', type: 'button', onClick: () => App.setTheme(App.ui.theme === 'dark' ? 'light' : 'dark'), 'data-theme-btn': '' });
  const sidebar = h('aside', { class: 'sidebar', 'aria-label': 'Barre latérale' },
    h('a', { class: 'sidebar-brand', href: '#/' + role + '/accueil', 'aria-label': 'Kalanso, accueil' }, UI.logo(36), h('div', null, h('div', { class: 'brand-name' }, 'Kalanso'), h('div', { class: 'brand-sub' }, App.store.universite.nom))),
    h('div', { class: 'sidebar-role' }, UI.avatar(me), h('div', { class: 'grow' }, h('div', { class: 'small strong truncate' }, K.name(me, true)), h('div', { class: 'xsmall muted' }, 'Rôle actif : ' + ROLE_LABELS[role]))),
    navEl,
    h('div', { class: 'sidebar-foot' }, themeBtn, h('button', { class: 'nav-link', type: 'button', onClick: () => App.logout() }, icon('logout', 20), h('span', null, 'Se déconnecter'))));

  const gs = UI.search({ placeholder: 'Rechercher un cours, une ressource, une personne…', kbd: '/', label: 'Recherche globale' });
  const results = h('div', { class: 'search-results', hidden: true, role: 'listbox', 'aria-label': 'Résultats de recherche' });
  gs.el.appendChild(results);
  gs.input.setAttribute('role', 'combobox');
  gs.input.setAttribute('aria-expanded', 'false');
  wireGlobalSearch(gs.input, results);

  const avatarBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Menu du compte' }, UI.avatar(me, 's'));
  const topbar = h('header', { class: 'topbar' },
    h('a', { href: '#/' + role + '/accueil', class: 'only-mobile', 'aria-label': 'Accueil' }, UI.logo(30)),
    h('div', { class: 'topbar-title truncate', id: 'topbar-title' }, ''),
    h('div', { class: 'global-search' }, gs.el),
    h('div', { class: 'topbar-actions' },
      h('span', { class: 'badge badge-accent only-desktop', id: 'saver-badge', hidden: !App.ui.dataSaver }, icon('leaf', 13), 'Économie de données'),
      h('a', { class: 'icon-btn only-mobile', href: '#/' + role + '/recherche', 'aria-label': 'Rechercher', title: 'Rechercher' }, icon('search', 22)),
      h('a', { class: 'icon-btn', href: '#/' + role + '/notifications', 'aria-label': 'Notifications', title: 'Notifications', id: 'bell' }, icon('bell', 22), h('span', { class: 'dot', hidden: true })),
      UI.dropdown(avatarBtn, [
        { label: 'Mon profil', icon: 'user', onClick: () => App.go('#/' + role + '/profil') },
        { label: 'Changer de thème', icon: 'moon', onClick: () => App.setTheme(App.ui.theme === 'dark' ? 'light' : 'dark') },
        { label: 'Se déconnecter', icon: 'logout', danger: true, onClick: () => App.logout() }
      ])));

  const mainItems = [];
  NAV[role].forEach((g) => g.items.forEach((it) => { if (it[3] && mainItems.length < 4) mainItems.push(it); }));
  const bottom = h('nav', { class: 'bottom-nav', 'aria-label': 'Navigation mobile' },
    mainItems.map(([id, label, ic]) => h('a', { href: '#/' + role + '/' + id, 'data-nav': id }, icon(ic, 22), h('span', null, SHORT_LABELS[id] || label), h('span', { class: 'dot', 'data-count': id, hidden: true }))),
    h('button', { type: 'button', onClick: () => openMoreMenu(role), 'aria-label': 'Plus de rubriques' }, icon('menu', 22), h('span', null, 'Plus')));

  const main = h('main', { id: 'main', class: 'content', tabindex: '-1' });
  app.appendChild(h('div', { class: 'shell' }, sidebar, h('div', { class: 'main-col' }, topbar, main)));
  app.appendChild(bottom);
  App.shellRole = role;
  updateThemeButton();
  App.updateBadges();
}

function updateThemeButton() {
  document.querySelectorAll('[data-theme-btn]').forEach((b) => {
    clear(b);
    const dark = App.ui.theme === 'dark';
    appendChildren(b, [icon(dark ? 'sun' : 'moon', 20), h('span', null, dark ? 'Thème clair' : 'Thème sombre')]);
  });
}

/** Menu « Plus » (mobile) : toute la navigation dans un tiroir. */
function openMoreMenu(role) {
  UI.drawer({
    title: 'Toutes les rubriques',
    body: (api) => h('div', { class: 'stack' },
      h('div', { class: 'row' }, UI.avatar(K.me(), 'l'), h('div', null, h('div', { class: 'strong' }, K.name(K.me(), true)), h('div', { class: 'small muted' }, ROLE_LABELS[role]))),
      NAV[role].map((g) => h('div', null, h('div', { class: 'nav-group-title' }, g.group),
        g.items.map(([id, label, ic]) => {
          const c = navCount(role, id);
          return h('a', { class: 'nav-link', href: '#/' + role + '/' + id, onClick: () => api.close() }, icon(ic, 20), h('span', null, label), c ? h('span', { class: 'count' }, String(c)) : null);
        }))),
      h('div', { class: 'stack-s' },
        UI.button({ label: App.ui.theme === 'dark' ? 'Thème clair' : 'Thème sombre', icon: App.ui.theme === 'dark' ? 'sun' : 'moon', variant: 'secondary', block: true, onClick: () => { App.setTheme(App.ui.theme === 'dark' ? 'light' : 'dark'); api.close(); } }),
        UI.button({ label: 'Se déconnecter', icon: 'logout', variant: 'ghost', block: true, onClick: () => { api.close(); App.logout(); } })))
  });
}

/** Met à jour les compteurs (navigation, cloche). */
App.updateBadges = function () {
  if (!App.session || !App.shellRole) return;
  document.querySelectorAll('[data-count]').forEach((el) => {
    const c = navCount(App.session.role, el.getAttribute('data-count'));
    el.textContent = c > 99 ? '99+' : String(c);
    el.hidden = !c;
    el.setAttribute('aria-label', c + ' en attente');
  });
  const bell = document.getElementById('bell');
  if (bell) {
    const c = K.unreadNotifs(App.session.userId);
    const dot = bell.querySelector('.dot');
    dot.textContent = String(c); dot.hidden = !c;
    bell.setAttribute('aria-label', 'Notifications' + (c ? ', ' + c + ' non lues' : ''));
  }
};

/** Recherche globale de la barre du haut (résultats groupés, navigation au clavier). */
function wireGlobalSearch(input, results) {
  let active = -1;
  const close = () => { results.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; };
  const render = () => {
    const q = input.value.trim();
    clear(results);
    if (q.length < 2) { close(); return; }
    let count = 0;
    Commun.searchIndex(q).forEach((g) => {
      if (!g.items.length) return;
      results.appendChild(h('div', { class: 'search-group' }, g.label));
      g.items.slice(0, 4).forEach((it) => {
        count += 1;
        results.appendChild(h('a', { class: 'search-hit', href: it.href, role: 'option', onMousedown: (e) => e.preventDefault(), onClick: () => { close(); input.value = ''; } },
          icon(it.icon, 18), h('span', { class: 'grow truncate' }, it.title), h('span', { class: 'xsmall muted' }, it.meta || '')));
      });
    });
    results.appendChild(h('a', { class: 'search-hit', href: '#/' + App.session.role + '/recherche?q=' + encodeURIComponent(q), onMousedown: (e) => e.preventDefault(), onClick: close },
      icon('search', 18), h('span', null, count ? 'Voir tous les résultats pour « ' + q + ' »' : 'Aucun résultat rapide — lancer la recherche complète')));
    results.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };
  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    const hits = Array.from(results.querySelectorAll('.search-hit'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!hits.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
      hits.forEach((x, i) => x.classList.toggle('is-active', i === active));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = active >= 0 && hits[active] ? hits[active].getAttribute('href') : (input.value.trim() ? '#/' + App.session.role + '/recherche?q=' + encodeURIComponent(input.value.trim()) : null);
      close(); input.value = '';
      if (target) App.go(target);
    } else if (e.key === 'Escape') { close(); }
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
}

/* ======================================================================
   6. Routeur par hash (#/role/ecran/parametre?requête)
   ====================================================================== */
const PUBLIC = ['bienvenue', 'connexion', 'otp', 'mot-de-passe-oublie', 'premier-acces'];

function parseHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch (e) { return p; } });
  return { parts, query: new URLSearchParams(query || ''), raw };
}

App.go = function (hash) { if (location.hash === hash) App.render(); else location.hash = hash; };
App.refresh = function () { App.render({ refresh: true }); };

App.render = function (opts) {
  const o = opts || {};
  const { parts, query, raw } = parseHash();
  if (!o.refresh) UI.closeAllOverlays();
  if (!parts.length) { App.go(App.session ? '#/' + App.session.role + '/accueil' : '#/bienvenue'); return; }

  // Page cachée de démonstration des composants
  if (parts[0] === 'demo' && parts[1] === 'composants') { App.shellRole = null; mount(ROUTES['public/composants'], { query }, o, true); return; }
  // Écrans publics (authentification)
  if (PUBLIC.includes(parts[0])) { App.shellRole = null; mount(ROUTES['public/' + parts[0]], { query }, o, true); return; }
  if (!App.session) { App.go('#/bienvenue'); return; }

  const role = App.session.role;
  if (App.shellRole !== role) buildShell(role);
  const key = parts[0] + '/' + (parts[1] || 'accueil');
  let def = ROUTES[key];
  const ctx = { role, param: parts[2] || null, query, me: K.me() };
  // Contrôle d'accès : une route d'un autre rôle (ou sans permission) affiche « Accès refusé »
  if (def && (parts[0] !== role || !can(key))) { def = ROUTES['commun/acces-refuse']; ctx.denied = key; }
  else if (!def) {
    const exists = Object.keys(ROUTES).some((k) => k.endsWith('/' + (parts[1] || '')) && k.split('/')[0] === parts[0]);
    def = ROUTES[exists ? 'commun/acces-refuse' : 'commun/404']; ctx.path = raw; ctx.denied = key;
  }
  mount(def, ctx, o, false);
};

/** Affiche un écran : titre de page, focus sur le h1, animation d'entrée. */
function mount(def, ctx, o, standalone) {
  const container = standalone ? clear(document.getElementById('app')) : document.getElementById('main');
  if (!standalone) {
    document.querySelectorAll('[data-nav]').forEach((a) => {
      if (a.getAttribute('data-nav') === (def.navId || def.id) && def.role === App.session.role) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }
  const title = typeof def.title === 'function' ? def.title(ctx) : def.title;
  document.title = title + ' · Kalanso';
  const tt = document.getElementById('topbar-title');
  if (tt) tt.textContent = title;
  const scrollY = window.scrollY;
  const draw = () => {
    let node;
    try { node = def.render(ctx); }
    catch (err) {
      console.error(err);
      node = h('div', { class: 'state-page' }, UI.empty({ title: 'Cet écran n\'a pas pu s\'afficher', text: 'Réinitialisez la démo depuis la barre du haut.' }));
    }
    clear(container);
    if (!o.refresh) node.classList.add('view-enter');
    container.appendChild(node);
    if (o.refresh) window.scrollTo(0, scrollY);
    else {
      window.scrollTo(0, 0);
      const h1 = container.querySelector('h1');
      if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    }
    App.updateBadges();
  };
  if (o.skeleton && !standalone) {
    clear(container).appendChild(UI.skeleton('page'));
    setTimeout(draw, App.ui.dataSaver ? 650 : 380);
  } else draw();
}

/* ======================================================================
   7. Session, thème, modes hors ligne et économie de données
   ====================================================================== */
App.login = function (userId) {
  const u = App.store.users[userId];
  App.session = { role: u.role, userId };
  App.pendingLogin = null;
  App.shellRole = null;
  App.store.sessionsActives[0].derniere = nowStamp();
  history.replaceState(null, '', '#/' + u.role + '/accueil');
  App.render({ skeleton: true });
  syncDemoBar();
};
App.logout = function () {
  App.session = null;
  App.shellRole = null;
  syncDemoBar();
  App.go('#/bienvenue');
  UI.toast('Vous êtes déconnecté·e. À bientôt sur Kalanso.', 'info');
};
App.setTheme = function (theme) {
  App.ui.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('kalanso-theme', theme); } catch (e) { /* stockage indisponible */ }
  updateThemeButton();
  syncDemoBar();
};
App.setOffline = function (on) {
  App.ui.offline = on;
  App.ui.offlineSince = on ? nowStamp() : null;
  const b = clear(document.getElementById('offline-banner'));
  if (on) appendChildren(b, [icon('wifiOff', 18), h('span', null, 'Vous êtes hors ligne — données de la dernière synchronisation (aujourd\'hui à ' + FMT.time(App.ui.offlineSince) + '). La consultation reste possible.')]);
  b.hidden = !on;
  if (!on) UI.toast('Connexion rétablie, données synchronisées.', 'success');
  syncDemoBar();
};
App.setDataSaver = function (on) {
  App.ui.dataSaver = on;
  document.documentElement.classList.toggle('data-saver', on);
  const badge = document.getElementById('saver-badge');
  if (badge) badge.hidden = !on;
  syncDemoBar();
  if (App.session) App.refresh();
};
App.reset = function () {
  App.store = buildInitialData();
  App.shellRole = null;
  App.render({ skeleton: !!App.session });
  UI.toast('Les données de départ ont été restaurées.', 'success', 'Démo réinitialisée');
};

/* ======================================================================
   8. Barre de démo
   ====================================================================== */
function buildDemoBar() {
  const bar = clear(document.getElementById('demo-bar'));
  const roleSel = UI.select([{ value: '', label: '— Non connecté —' }].concat(Object.keys(ROLE_LABELS).map((r) => ({ value: r, label: ROLE_LABELS[r] + ' · ' + K.name(K.user(DEMO_USERS[r])) }))),
    '', (v) => { if (v) App.login(DEMO_USERS[v]); else App.logout(); }, { id: 'demo-role' });
  roleSel.className = '';
  const btn = (id, ic, label, onClick) => h('button', { class: 'demo-btn', type: 'button', id, onClick, 'aria-label': label, title: label }, icon(ic, 16), h('span', { class: 'lbl-txt', 'aria-hidden': 'true' }, label));
  bar.appendChild(h('span', { class: 'demo-tag' }, 'Démo'));
  bar.appendChild(h('label', { for: 'demo-role' }, h('span', { class: 'lbl-txt' }, 'Rôle'), h('span', { class: 'sr-only' }, 'Changer de rôle'), roleSel));
  bar.appendChild(btn('demo-theme', 'moon', 'Thème sombre', () => App.setTheme(App.ui.theme === 'dark' ? 'light' : 'dark')));
  bar.appendChild(btn('demo-offline', 'wifiOff', 'Hors ligne', () => App.setOffline(!App.ui.offline)));
  bar.appendChild(btn('demo-saver', 'leaf', 'Économie de données', () => App.setDataSaver(!App.ui.dataSaver)));
  bar.appendChild(btn('demo-reset', 'refresh', 'Réinitialiser la démo', () => App.reset()));
  bar.appendChild(h('span', { class: 'demo-spacer' }));
  bar.appendChild(h('span', { class: 'demo-note' }, 'Données fictives — maquette'));
  bar.appendChild(h('button', { class: 'demo-btn demo-toggle', type: 'button', id: 'demo-collapse', 'aria-expanded': 'true', 'aria-label': 'Replier la barre de démo', onClick: () => toggleDemoBar() }, icon('chevronUp', 16), h('span', { class: 'lbl-txt' }, 'Replier')));
  syncDemoBar();
}
function syncDemoBar() {
  const set = (id, on) => { const b = document.getElementById(id); if (b) b.setAttribute('aria-pressed', String(on)); };
  set('demo-theme', App.ui.theme === 'dark');
  set('demo-offline', App.ui.offline);
  set('demo-saver', App.ui.dataSaver);
  const sel = document.getElementById('demo-role');
  if (sel) sel.value = App.session ? App.session.role : '';
}
function toggleDemoBar(force) {
  App.ui.demoCollapsed = force !== undefined ? force : !App.ui.demoCollapsed;
  const bar = document.getElementById('demo-bar');
  bar.classList.toggle('is-collapsed', App.ui.demoCollapsed);
  document.documentElement.classList.toggle('demo-collapsed', App.ui.demoCollapsed);
  const t = clear(document.getElementById('demo-collapse'));
  appendChildren(t, App.ui.demoCollapsed ? [icon('chevronDown', 16), h('span', null, 'Démo')] : [icon('chevronUp', 16), h('span', { class: 'lbl-txt' }, 'Replier')]);
  t.setAttribute('aria-expanded', String(!App.ui.demoCollapsed));
  t.setAttribute('aria-label', App.ui.demoCollapsed ? 'Déplier la barre de démo' : 'Replier la barre de démo');
  try { localStorage.setItem('kalanso-demobar', App.ui.demoCollapsed ? '1' : '0'); } catch (e) { /* stockage indisponible */ }
}

/* ======================================================================
   9. Tests des calculs (console.assert : n'affiche rien en cas de succès)
   ====================================================================== */
function runCalcTests() {
  const p = { ponderationCC: 40, ponderationExam: 60, seuilValidation: 10, notePlancher: 8 };
  const results = [];
  const check = (cond, msg) => { console.assert(cond, msg); results.push(cond); };
  check(Calc.ecue({ cc1: 14, cc2: 15.5, exam: 13.5 }, p).moy === 14, 'ECUE : 14,75 × 0,4 + 13,5 × 0,6 = 14');
  check(Calc.ecue({ cc1: 'ABS', exam: 10 }, p).moy === 6, 'ABS compte pour 0');
  check(Calc.ecue({ cc1: 8, exam: 6, ratt: 12 }, p, 'rattrapage').moy === 10.4, 'Rattrapage : meilleure note d\'examen retenue');
  check(Calc.ue([{ moy: 14, coef: 2 }, { moy: 12.5, coef: 1 }]) === 13.5, 'UE pondérée par les coefficients');
  const sem = Calc.semester([{ moy: 12, credits: 20 }, { moy: 8.5, credits: 5 }, { moy: 7, credits: 5 }], p);
  check(sem.statuts[1] === 'compensee' && sem.statuts[2] === 'non_validee' && sem.credits === 25, 'Compensation avec note plancher');
  const jury = Calc.semester([{ moy: 10.5, credits: 15 }, { moy: 9, credits: 15 }], p, 0.25);
  check(jury.moy === 10 && jury.credits === 30, 'Points de jury : 9,75 + 0,25 = 10, compensation déclenchée');
  check(Calc.parseNote('12,75').value === 12.75 && !Calc.parseNote('21').ok && !Calc.parseNote('12,3').ok && Calc.parseNote('abs').value === 'ABS', 'Validation des saisies de notes');
  const awa = K.result('s1', 'S3');
  check(awa.moy === 11.84 && awa.credits === 24 && awa.decision === 'rattrapage', 'S3 d\'Awa : 11,84 / 20, 24 crédits, rattrapage');
  check(awa.ues.find((u) => u.ue.id === 'INF234').statut === 'compensee' && awa.ues.find((u) => u.ue.id === 'MAT231').statut === 'non_validee', 'Awa : Systèmes compensée, Maths non validée');
  check(Calc.phoneOk('+226 70 12 45 12') && !Calc.phoneOk('70 12'), 'Format de téléphone +226');
  if (results.every(Boolean)) console.info('[Kalanso] ' + results.length + ' tests de calcul réussis.');
}

/* ======================================================================
   10. Initialisation
   ====================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  App.store = buildInitialData();
  let theme = null;
  try { theme = localStorage.getItem('kalanso-theme'); } catch (e) { theme = null; }
  if (theme !== 'dark' && theme !== 'light') theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  App.setTheme(theme);
  buildDemoBar();
  try { if (localStorage.getItem('kalanso-demobar') === '1') toggleDemoBar(true); } catch (e) { /* stockage indisponible */ }
  runCalcTests();
  window.addEventListener('hashchange', () => App.render());
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.target.closest('input, textarea, select, [contenteditable]')) {
      const gs = document.querySelector('.global-search input');
      if (gs && gs.offsetParent !== null) { e.preventDefault(); gs.focus(); }
    }
  });
  App.render();
});

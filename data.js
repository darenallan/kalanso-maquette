'use strict';
/*
 * Données fictives de la maquette Kalanso.
 * Toutes les dates sont calculées par rapport à la date du jour,
 * pour que « aujourd'hui » et « cette semaine » aient toujours du contenu.
 * buildInitialData() renvoie un objet neuf : c'est ce qui permet de
 * « Réinitialiser la démo ».
 */

/* ---------- Outils de dates (format interne : 'AAAA-MM-JJ' et 'HH:MM') ---------- */
const DT = {
  pad(n) { return String(n).padStart(2, '0'); },
  today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; },
  iso(d) { return d.getFullYear() + '-' + DT.pad(d.getMonth() + 1) + '-' + DT.pad(d.getDate()); },
  parse(s) { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); },
  add(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
  rel(n) { return DT.iso(DT.add(DT.today(), n)); },
  /** Horodatage local 'AAAA-MM-JJTHH:MM' décalé de n jours. */
  stamp(n, hh = 9, mm = 0) { return DT.rel(n) + 'T' + DT.pad(hh) + ':' + DT.pad(mm); },
  mondayOf(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; },
  toDate(isoDate, hhmm) { const d = DT.parse(isoDate); const [h, m] = (hhmm || '00:00').split(':').map(Number); d.setHours(h, m, 0, 0); return d; },
  diffDays(a, b) { return Math.round((DT.parse(a) - DT.parse(b)) / 86400000); }
};

/* Générateur pseudo-aléatoire déterministe (mêmes données à chaque réinitialisation). */
function seededRandom(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* Arrondi au quart de point, borné entre 0 et 20. */
function quarter(n) { return Math.max(0, Math.min(20, Math.round(n * 4) / 4)); }

/* ---------- Référentiels ---------- */
const STUDENT_NAMES = [
  ['Awa', 'Ouédraogo', 'F'], ['Ibrahim', 'Sawadogo', 'M'], ['Mariam', 'Kaboré', 'F'], ['Rasmané', 'Kaboré', 'M'],
  ['Salimata', 'Traoré', 'F'], ['Boris', 'Zongo', 'M'], ['Fatoumata', 'Ilboudo', 'F'], ['Wendkouni', 'Nikiéma', 'F'],
  ['Ousmane', 'Ouattara', 'M'], ['Aïcha', 'Sanou', 'F'], ['Moussa', 'Bationo', 'M'], ['Bintou', 'Yaméogo', 'F'],
  ['Abdoul Aziz', 'Tapsoba', 'M'], ['Rokia', 'Zoungrana', 'F'], ['Serge', 'Somé', 'M'], ['Edwige', 'Kambou', 'F'],
  ['Arnaud', 'Dabiré', 'M'], ['Kadidia', 'Coulibaly', 'F'], ['Hamado', 'Diallo', 'M'], ['Safiatou', 'Barry', 'F'],
  ['Issaka', 'Kinda', 'M'], ['Clémence', 'Bélem', 'F'], ['Lassané', 'Tiendrébéogo', 'M'], ['Nafissatou', 'Nana', 'F'],
  ['Adama', 'Sana', 'M'], ['Pélagie', 'Zida', 'F'], ['Souleymane', 'Konaté', 'M'], ['Inès', 'Simporé', 'F'],
  ['Yacouba', 'Ouoba', 'M'], ['Djénéba', 'Lompo', 'F'], ['Fabrice', 'Hien', 'M'], ['Larissa', 'Palm', 'F'],
  ['Noufou', 'Bado', 'M'], ['Ramatou', 'Kafando', 'F'], ['Christian', 'Rouamba', 'M'], ['Zénabo', 'Guiro', 'F'],
  ['Hervé', 'Sorgho', 'M'], ['Alimata', 'Kouraogo', 'F'], ['Seydou', 'Compaoré', 'M'], ['Évelyne', 'Kiemtoré', 'F']
];
const OTHER_NAMES = [
  ['Aminata', 'Zerbo'], ['Paul', 'Kaboré'], ['Sita', 'Ouédraogo'], ['Joël', 'Sawadogo'], ['Haoua', 'Traoré'],
  ['Brice', 'Yaméogo'], ['Mamounata', 'Ilboudo'], ['Didier', 'Zongo'], ['Kady', 'Bonkoungou'], ['Gaston', 'Nikiéma'],
  ['Assétou', 'Sankara'], ['Jérôme', 'Ouattara'], ['Habibou', 'Diallo'], ['Lucie', 'Somda'], ['Oumarou', 'Bambara'],
  ['Florence', 'Kando'], ['Ali', 'Derra'], ['Odile', 'Tiendrébéogo'], ['Patrice', 'Kafando'], ['Nadège', 'Ouangraoua'],
  ['Saïdou', 'Guigma'], ['Martine', 'Zoungrana'], ['Issouf', 'Kologo'], ['Raïssa', 'Sanou'], ['Tiga', 'Rouamba'], ['Sophie', 'Bazié']
];
const SALLES = [
  { id: 'amphiA', nom: 'Amphi A', capacite: 600, equipements: ['Vidéoprojecteur', 'Sonorisation', 'Climatisation'] },
  { id: 'amphiB', nom: 'Amphi B', capacite: 350, equipements: ['Vidéoprojecteur', 'Sonorisation'] },
  { id: 's101', nom: 'Salle 101', capacite: 60, equipements: ['Tableau blanc', 'Ventilateurs'] },
  { id: 's102', nom: 'Salle 102', capacite: 60, equipements: ['Tableau blanc', 'Vidéoprojecteur'] },
  { id: 's103', nom: 'Salle 103', capacite: 50, equipements: ['Tableau blanc'] },
  { id: 's104', nom: 'Salle 104', capacite: 50, equipements: ['Tableau blanc', 'Ventilateurs'] },
  { id: 's108', nom: 'Salle 108', capacite: 40, equipements: ['Tableau blanc', 'Vidéoprojecteur'] },
  { id: 'labo1', nom: 'Labo Info 1', capacite: 30, equipements: ['30 postes', 'Vidéoprojecteur', 'Onduleur'] },
  { id: 'labo2', nom: 'Labo Info 2', capacite: 30, equipements: ['28 postes', 'Onduleur'] },
  { id: 'reunion', nom: 'Salle du conseil', capacite: 20, equipements: ['Écran', 'Visioconférence'] }
];

/* Maquette de la L2 Informatique (S3 complet, S4 en cours). couleur = index de pastel matière. */
const UES_L2_INFO = [
  { id: 'INF231', semestre: 'S3', nom: 'Algorithmique et structures de données', credits: 6, ecues: [
    { id: 'INF2311', nom: 'Algorithmique avancée', coef: 2, ens: 't1', couleur: 0 },
    { id: 'INF2312', nom: 'Structures de données', coef: 1, ens: 't1', couleur: 0 }] },
  { id: 'INF232', semestre: 'S3', nom: 'Bases de données', credits: 6, ecues: [
    { id: 'INF2321', nom: 'Modélisation (Merise / UML)', coef: 1, ens: 't1', couleur: 2 },
    { id: 'INF2322', nom: 'Langage SQL', coef: 2, ens: 't1', couleur: 2 }] },
  { id: 'INF233', semestre: 'S3', nom: 'Programmation web', credits: 5, ecues: [
    { id: 'INF2331', nom: 'HTML et CSS', coef: 1, ens: 't3', couleur: 3 },
    { id: 'INF2332', nom: 'JavaScript', coef: 1, ens: 't3', couleur: 3 }] },
  { id: 'MAT231', semestre: 'S3', nom: 'Mathématiques pour l\'informatique', credits: 6, ecues: [
    { id: 'MAT2311', nom: 'Probabilités et statistiques', coef: 1, ens: 't2', couleur: 6 },
    { id: 'MAT2312', nom: 'Algèbre linéaire', coef: 1, ens: 't2', couleur: 6 }] },
  { id: 'INF234', semestre: 'S3', nom: 'Systèmes et réseaux', credits: 4, ecues: [
    { id: 'INF2341', nom: 'Systèmes d\'exploitation', coef: 1, ens: 't4', couleur: 4 },
    { id: 'INF2342', nom: 'Introduction aux réseaux', coef: 1, ens: 't4', couleur: 4 }] },
  { id: 'TRA231', semestre: 'S3', nom: 'Langues et communication', credits: 3, ecues: [
    { id: 'TRA2311', nom: 'Anglais technique', coef: 1, ens: 't5', couleur: 7 },
    { id: 'TRA2312', nom: 'Expression écrite et orale', coef: 1, ens: 't5', couleur: 7 }] },
  { id: 'INF241', semestre: 'S4', nom: 'Algorithmique et programmation objet', credits: 6, ecues: [
    { id: 'INF2411', nom: 'Complexité algorithmique', coef: 1, ens: 't1', couleur: 0 },
    { id: 'INF2412', nom: 'Programmation Java', coef: 2, ens: 't6', couleur: 1 }] },
  { id: 'INF242', semestre: 'S4', nom: 'Bases de données avancées et génie logiciel', credits: 5, ecues: [
    { id: 'INF2421', nom: 'Bases de données avancées', coef: 1, ens: 't1', couleur: 2 },
    { id: 'INF2422', nom: 'Génie logiciel', coef: 1, ens: 't6', couleur: 3 }] },
  { id: 'INF243', semestre: 'S4', nom: 'Réseaux et sécurité', credits: 5, ecues: [
    { id: 'INF2431', nom: 'Administration réseaux', coef: 1, ens: 't4', couleur: 4 },
    { id: 'INF2432', nom: 'Sécurité informatique', coef: 1, ens: 't4', couleur: 5 }] },
  { id: 'MAT241', semestre: 'S4', nom: 'Recherche opérationnelle', credits: 5, ecues: [
    { id: 'MAT2411', nom: 'Programmation linéaire', coef: 1, ens: 't7', couleur: 6 },
    { id: 'MAT2412', nom: 'Théorie des graphes', coef: 1, ens: 't2', couleur: 7 }] },
  { id: 'INF244', semestre: 'S4', nom: 'Développement mobile', credits: 5, ecues: [
    { id: 'INF2441', nom: 'Développement Android', coef: 2, ens: 't8', couleur: 1 },
    { id: 'INF2442', nom: 'Ergonomie des interfaces', coef: 1, ens: 't3', couleur: 3 }] },
  { id: 'TRA241', semestre: 'S4', nom: 'Entrepreneuriat et communication', credits: 4, ecues: [
    { id: 'TRA2411', nom: 'Entrepreneuriat', coef: 1, ens: 't8', couleur: 5 },
    { id: 'TRA2412', nom: 'Anglais professionnel', coef: 1, ens: 't5', couleur: 7 }] }
];

/* Notes d'Awa pour le S3 : [CC1, CC2, examen]. Maths non validée, Systèmes compensée. */
const AWA_S3 = {
  INF2311: [14, 15.5, 13.5], INF2312: [12, 13, 12.5], INF2321: [11, 12.5, 13], INF2322: [15, 14, 16],
  INF2331: [16, 15, 15.5], INF2332: [13, 14, 12], MAT2311: [7, 8.5, 6], MAT2312: [8, 7, 7],
  INF2341: [9, 8.5, 8], INF2342: [9.5, 9, 9], TRA2311: [14, 15, 14.5], TRA2312: [12, 13, 13]
};
/* Notes d'Awa pour le S4 (contrôle continu en cours). */
const AWA_S4 = { INF2411: [13], INF2412: [12.5, 14], INF2421: [15], INF2422: [11.5], INF2431: [10], INF2432: [12],
  MAT2411: [9.5], MAT2412: [11], INF2441: [14.5], INF2442: [15], TRA2411: [13], TRA2412: [14] };

/* ---------- Construction du jeu de données ---------- */
function buildInitialData() {
  const rnd = seededRandom(20261125);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const phone = () => '+226 ' + pick(['70', '71', '72', '75', '76', '78', '64', '65', '66']) + ' ' + DT.pad(Math.floor(rnd() * 100)) + ' ' + DT.pad(Math.floor(rnd() * 100)) + ' ' + DT.pad(Math.floor(rnd() * 100));
  const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '.');
  const fr = (iso) => iso.split('-').reverse().join('/');

  const users = {};
  /* Étudiants de la promotion de démo (L2 Informatique) */
  STUDENT_NAMES.forEach(([prenom, nom, sexe], i) => {
    const id = 's' + (i + 1);
    users[id] = {
      id, role: 'etudiant', prenom, nom, sexe,
      matricule: i === 0 ? 'UHO-2025-04817' : 'UHO-2025-0' + String(4100 + i * 37).padStart(4, '0'),
      filiere: 'info', niveau: 'L2', groupe: i % 2 === 0 ? 'A' : 'B',
      email: slug(prenom) + '.' + slug(nom) + '@etu.uho.bf',
      tel: i === 0 ? '+226 70 12 45 12' : phone(),
      naissance: (2003 + (i % 3)) + '-' + DT.pad(1 + (i % 12)) + '-' + DT.pad(3 + (i % 25)),
      lieuNaissance: pick(['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou', 'Ouahigouya', 'Kaya', 'Banfora', 'Fada N\'Gourma', 'Tenkodogo']),
      statut: 'inscrit', actif: true, boursier: rnd() < 0.3, derniereConnexion: DT.stamp(-Math.floor(rnd() * 4), 8 + Math.floor(rnd() * 10), 10)
    };
  });
  users.s1.naissance = '2004-03-14'; users.s1.lieuNaissance = 'Ouagadougou'; users.s1.boursier = false;
  /* Quelques étudiants d'autres filières, pour les listes de la Scolarité */
  const autres = [['droit', 'L1'], ['droit', 'L2'], ['droit', 'L3'], ['droit', 'M1'], ['eco', 'L1'], ['eco', 'L2'], ['eco', 'L3'], ['eco', 'M2'], ['info', 'L1'], ['info', 'L3'], ['info', 'M1'], ['info', 'M2']];
  OTHER_NAMES.forEach(([prenom, nom], i) => {
    const id = 's' + (41 + i);
    const [filiere, niveau] = autres[i % autres.length];
    const annees = { L1: 0, L2: 1, L3: 2, M1: 3, M2: 4 }[niveau];
    users[id] = {
      id, role: 'etudiant', prenom, nom, sexe: i % 2 ? 'M' : 'F',
      matricule: 'UHO-' + (2026 - annees) + '-0' + String(5200 + i * 53).padStart(4, '0'),
      filiere, niveau, groupe: 'A', email: slug(prenom) + '.' + slug(nom) + '@etu.uho.bf', tel: phone(),
      naissance: (2001 + (i % 4)) + '-0' + (1 + (i % 9)) + '-1' + (i % 9), lieuNaissance: pick(['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou', 'Dédougou']),
      statut: 'inscrit', actif: true, boursier: rnd() < 0.3, derniereConnexion: DT.stamp(-Math.floor(rnd() * 9), 11, 30)
    };
  });
  users.s45.actif = false; users.s45.statut = 'abandon';
  /* Enseignants */
  [
    ['t1', 'Issouf', 'Sawadogo', 'Dr', 'Maître-assistant', 'Algorithmique et bases de données'],
    ['t2', 'Aminata', 'Traoré', 'Pr', 'Professeure titulaire', 'Mathématiques appliquées'],
    ['t3', 'Boukary', 'Zongo', 'Dr', 'Maître-assistant', 'Développement web et IHM'],
    ['t4', 'Salif', 'Kaboré', 'M.', 'Assistant', 'Systèmes et réseaux'],
    ['t5', 'Rasmata', 'Ilboudo', 'Mme', 'Chargée de cours', 'Langues et communication'],
    ['t6', 'Hamidou', 'Ouattara', 'Dr', 'Maître de conférences', 'Génie logiciel'],
    ['t7', 'Fatimata', 'Nikiéma', 'Dr', 'Maître-assistante', 'Recherche opérationnelle'],
    ['t8', 'Yacouba', 'Sanou', 'M.', 'Vacataire', 'Mobile et entrepreneuriat']
  ].forEach(([id, prenom, nom, titre, grade, specialite]) => {
    users[id] = { id, role: 'enseignant', prenom, nom, titre, grade, specialite, email: slug(prenom) + '.' + slug(nom) + '@uho.bf', tel: phone(), actif: true, derniereConnexion: DT.stamp(-Math.floor(rnd() * 3), 7, 45) };
  });
  /* Personnel de la Scolarité */
  [
    ['a1', 'Mariam', 'Compaoré', 'Mme', 'Cheffe du service de la Scolarité'],
    ['a2', 'Adama', 'Bélem', 'M.', 'Agent de scolarité'],
    ['a3', 'Clarisse', 'Yaméogo', 'Mlle', 'Agente comptable (caisse)']
  ].forEach(([id, prenom, nom, titre, fonction]) => {
    users[id] = { id, role: 'scolarite', prenom, nom, titre, fonction, email: slug(prenom) + '.' + slug(nom) + '@uho.bf', tel: phone(), actif: true, derniereConnexion: DT.stamp(0, 7, 58) };
  });
  /* Parent */
  users.p1 = { id: 'p1', role: 'parent', prenom: 'Karim', nom: 'Ouédraogo', titre: 'M.', email: 'karim.ouedraogo@exemple.bf', tel: '+226 76 88 21 09', enfant: 's1', actif: true, derniereConnexion: DT.stamp(-2, 20, 15) };

  /* ---------- Offre de formation ---------- */
  const formation = {
    filieres: [
      { id: 'info', nom: 'Informatique', responsable: 't6', niveaux: ['L1', 'L2', 'L3', 'M1', 'M2'] },
      { id: 'droit', nom: 'Droit', responsable: null, niveaux: ['L1', 'L2', 'L3', 'M1', 'M2'] },
      { id: 'eco', nom: 'Économie et gestion', responsable: null, niveaux: ['L1', 'L2', 'L3', 'M1', 'M2'] }
    ],
    ues: JSON.parse(JSON.stringify(UES_L2_INFO)).map((u) => Object.assign(u, { filiere: 'info', niveau: 'L2' }))
  };
  /* UE résumées des autres parcours (2 semestres chacun) */
  const gabarits = {
    info: ['Algorithmique', 'Architecture des ordinateurs', 'Mathématiques discrètes', 'Programmation', 'Systèmes', 'Anglais'],
    droit: ['Droit constitutionnel', 'Droit civil', 'Histoire du droit', 'Institutions administratives', 'Méthodologie juridique', 'Anglais juridique'],
    eco: ['Microéconomie', 'Macroéconomie', 'Comptabilité générale', 'Statistiques', 'Gestion des entreprises', 'Anglais des affaires']
  };
  const creditsGabarit = [6, 6, 5, 5, 5, 3];
  formation.filieres.forEach((f) => {
    f.niveaux.forEach((niv, ni) => {
      if (f.id === 'info' && niv === 'L2') return;
      [1, 2].forEach((k) => {
        const sem = 'S' + (ni * 2 + k);
        gabarits[f.id].forEach((nomUe, ui) => {
          const code = f.id.slice(0, 3).toUpperCase() + (ni + 1) + k + (ui + 1);
          formation.ues.push({ id: code, filiere: f.id, niveau: niv, semestre: sem, nom: nomUe + (ni > 0 ? ' ' + (ni + 1) : ''), credits: creditsGabarit[ui], ecues: [
            { id: code + '1', nom: nomUe + ' — cours magistral', coef: 2, ens: null, couleur: ui % 8 },
            { id: code + '2', nom: nomUe + ' — travaux dirigés', coef: 1, ens: null, couleur: ui % 8 }] });
        });
      });
    });
  });

  /* ---------- Feuilles de notes (source de vérité des notes) ---------- */
  const promo = Object.values(users).filter((u) => u.role === 'etudiant' && u.filiere === 'info' && u.niveau === 'L2');
  const niveauEtudiant = {};
  promo.forEach((s) => { niveauEtudiant[s.id] = 7 + rnd() * 9; });
  niveauEtudiant.s4 = 6.2;
  const gen = (sid) => quarter(niveauEtudiant[sid] + (rnd() - 0.5) * 6);
  const sheets = [];
  const ueS3 = formation.ues.filter((u) => u.filiere === 'info' && u.niveau === 'L2' && u.semestre === 'S3');
  const ueS4 = formation.ues.filter((u) => u.filiere === 'info' && u.niveau === 'L2' && u.semestre === 'S4');
  const sheet = (ecue, evalType, statut, fill, extra) => {
    const notes = {};
    if (fill) promo.forEach((s) => { notes[s.id] = fill(s); });
    sheets.push(Object.assign({ id: 'f-' + ecue.id + '-' + evalType, ecueId: ecue.id, eval: evalType, statut, notes, ens: ecue.ens,
      dateLimite: null, soumisLe: null, valideLe: null, commentaire: '' }, extra || {}));
  };
  ueS3.forEach((ue) => ue.ecues.forEach((e) => {
    ['CC1', 'CC2', 'EXAM'].forEach((ev, k) => sheet(e, ev, 'validee', (s) => {
      if (s.id === 's1') return AWA_S3[e.id][k];
      if (ev === 'EXAM' && rnd() < 0.02) return 'ABS';
      return gen(s.id);
    }, { soumisLe: DT.stamp(-70 + k * 12, 10), valideLe: DT.stamp(-68 + k * 12, 15) }));
    sheet(e, 'RATT', 'attente', null);
  }));
  ueS4.forEach((ue) => ue.ecues.forEach((e) => {
    const awa = AWA_S4[e.id];
    const cc1Statut = e.id === 'INF2421' || e.id === 'INF2431' ? 'soumise' : 'validee';
    sheet(e, 'CC1', cc1Statut, (s) => (s.id === 's1' ? awa[0] : (rnd() < 0.03 ? 'ABS' : gen(s.id))),
      cc1Statut === 'soumise' ? { soumisLe: DT.stamp(-1, 18, 20), dateLimite: DT.rel(3) } : { soumisLe: DT.stamp(-21, 17), valideLe: DT.stamp(-19, 11) });
    if (e.id === 'INF2412') sheet(e, 'CC2', 'validee', (s) => (s.id === 's1' ? awa[1] : gen(s.id)), { soumisLe: DT.stamp(-6, 16), valideLe: DT.stamp(-5, 10) });
    else if (e.id === 'INF2411') sheet(e, 'CC2', 'brouillon', null, { dateLimite: DT.rel(4) });
    else if (e.id === 'INF2421') sheet(e, 'CC2', 'brouillon', null, { dateLimite: DT.rel(12) });
    sheet(e, 'EXAM', 'attente', null);
  }));
  /* Brouillon partiellement saisi pour le CC2 de Complexité (Dr Sawadogo) */
  const brouillon = sheets.find((f) => f.id === 'f-INF2411-CC2');
  promo.slice(0, 14).forEach((s) => { brouillon.notes[s.id] = s.id === 's1' ? 14 : gen(s.id); });

  /* ---------- Emploi du temps (semaine passée, en cours et suivante) ---------- */
  const SLOTS = [['08:00', '10:00'], ['10:15', '12:15'], ['15:00', '17:00'], ['17:15', '19:15']];
  // [jour (0 = lundi), créneau, ECUE, type, salle, groupe]
  const TEMPLATE = [
    [0, 0, 'INF2411', 'CM', 'amphiB', 'all'], [0, 1, 'INF2412', 'CM', 'amphiB', 'all'], [0, 2, 'INF2431', 'TD', 's104', 'A'], [0, 3, 'INF2431', 'TD', 's104', 'B'],
    [1, 0, 'MAT2411', 'CM', 'amphiB', 'all'], [1, 1, 'INF2421', 'TD', 's102', 'A'], [1, 2, 'INF2412', 'TP', 'labo1', 'A'], [1, 3, 'INF2412', 'TP', 'labo1', 'B'],
    [2, 0, 'INF2421', 'CM', 'amphiB', 'all'], [2, 1, 'INF2422', 'CM', 'amphiB', 'all'], [2, 2, 'INF2411', 'TD', 's103', 'A'], [2, 3, 'INF2411', 'TD', 's103', 'B'],
    [3, 0, 'INF2432', 'CM', 'amphiB', 'all'], [3, 1, 'MAT2412', 'CM', 'amphiB', 'all'], [3, 2, 'INF2441', 'TP', 'labo2', 'A'], [3, 3, 'INF2421', 'TD', 's102', 'B'],
    [4, 0, 'INF2411', 'TP', 'labo1', 'A'], [4, 1, 'TRA2411', 'CM', 'amphiB', 'all'], [4, 2, 'TRA2412', 'TD', 's101', 'all'], [4, 3, 'INF2442', 'TD', 's108', 'all'],
    [5, 0, 'MAT2412', 'TD', 's103', 'all'], [5, 1, 'INF2421', 'TP', 'labo1', 'A']
  ];
  const ecueById = {};
  formation.ues.forEach((u) => u.ecues.forEach((e) => { ecueById[e.id] = Object.assign({ ueId: u.id }, e); }));
  const monday = DT.mondayOf(DT.today());
  const sessions = [];
  [-1, 0, 1].forEach((w) => {
    TEMPLATE.forEach(([day, slot, ecueId, type, salle, groupe], i) => {
      const date = DT.iso(DT.add(monday, w * 7 + day));
      sessions.push({ id: 'c' + (w + 1) + '-' + i, ecueId, type, date, debut: SLOTS[slot][0], fin: SLOTS[slot][1], salle,
        ens: ecueById[ecueId].ens, groupe, filiere: 'info', niveau: 'L2', statut: 'normal', remarque: '' });
    });
  });
  const cur = (i) => sessions.find((s) => s.id === 'c1-' + i);
  /* Cours annulé, cours déplacé, changement de salle (semaine en cours) */
  Object.assign(cur(12), { statut: 'annule', remarque: 'Enseignant en mission à Bobo-Dioulasso. Séance rattrapée la semaine prochaine.' });
  Object.assign(cur(17), { statut: 'deplace', remarque: 'Déplacé du vendredi 10:15 au samedi 15:00.', date: DT.iso(DT.add(monday, 5)), debut: '15:00', fin: '17:00', ancienneDate: DT.iso(DT.add(monday, 4)) });
  Object.assign(cur(10), { statut: 'salle', remarque: 'Salle 103 indisponible (travaux électriques).', salle: 's108', ancienneSalle: 's103' });
  /* Cours d'autres filières (occupation des salles et détection de conflits) */
  [[0, 2, 's104', 'Droit des obligations', 'TD', 'droit', 'L2', 'M. Ousséni Bancé'],
    [1, 0, 'amphiA', 'Microéconomie', 'CM', 'eco', 'L1', 'Dr Pascal Zagré'],
    [2, 1, 'amphiA', 'Droit constitutionnel', 'CM', 'droit', 'L1', 'Pr Augustin Kiélem'],
    [3, 2, 's101', 'Comptabilité générale', 'TD', 'eco', 'L2', 'Mme Awa Thiombiano'],
    [4, 0, 'amphiA', 'Histoire du droit', 'CM', 'droit', 'L1', 'Dr Lazare Yonli']].forEach(([day, slot, salle, titre, type, filiere, niveau, ensNom], i) => {
    [0, 1].forEach((w) => sessions.push({ id: 'x' + w + '-' + i, titre, type, date: DT.iso(DT.add(monday, w * 7 + day)), debut: SLOTS[slot][0], fin: SLOTS[slot][1],
      salle, ens: null, ensNom, groupe: 'all', filiere, niveau, statut: 'normal', remarque: '' }));
  });

  /* ---------- Absences et retards (12) ---------- */
  const A = (id, sid, off, ecueId, type, minutes, statut, motif, piece, commentaire) => ({ id, sid, date: DT.rel(off), ecueId, type, minutes, statut, motif, piece, commentaire });
  const absences = [
    A('ab1', 's1', -16, 'MAT2411', 'absence', 0, 'justifiee', 'Maladie', 'certificat-medical.pdf', 'Paludisme, certificat du CMA de Pissy.'),
    A('ab2', 's1', -9, 'MAT2411', 'absence', 0, 'non_justifiee', '', '', ''),
    A('ab3', 's1', -4, 'MAT2411', 'absence', 0, 'en_attente', 'Problème de transport', 'attestation-sotraco.jpg', 'Panne du bus de la ligne 5, attestation jointe.'),
    A('ab4', 's1', -2, 'INF2412', 'retard', 15, 'non_justifiee', '', '', ''),
    A('ab5', 's1', -12, 'TRA2411', 'absence', 0, 'justifiee', 'Décès dans la famille', 'avis-de-deces.pdf', ''),
    A('ab6', 's2', -3, 'INF2421', 'absence', 0, 'en_attente', 'Maladie', 'ordonnance.jpg', 'Consultation au CHU Yalgado-Ouédraogo.'),
    A('ab7', 's4', -8, 'INF2411', 'absence', 0, 'non_justifiee', '', '', ''),
    A('ab8', 's4', -1, 'INF2411', 'absence', 0, 'non_justifiee', '', '', ''),
    A('ab9', 's4', -15, 'INF2411', 'absence', 0, 'non_justifiee', '', '', ''),
    A('ab10', 's9', -6, 'INF2412', 'retard', 25, 'non_justifiee', '', '', ''),
    A('ab11', 's17', -10, 'MAT2412', 'absence', 0, 'justifiee', 'Compétition sportive universitaire', 'convocation-fasu.pdf', ''),
    A('ab12', 's23', -5, 'INF2432', 'retard', 10, 'non_justifiee', '', '', '')
  ];

  /* ---------- Frais et paiements ---------- */
  const tranches = [
    { n: 1, montant: 150000, echeance: DT.rel(-50), libelle: 'Inscription et 1re tranche' },
    { n: 2, montant: 150000, echeance: DT.rel(-10), libelle: '2e tranche' },
    { n: 3, montant: 150000, echeance: DT.rel(60), libelle: '3e tranche' }
  ];
  const transactions = [];
  let refSeq = 7310;
  const moyens = ['orange', 'orange', 'orange', 'moov', 'moov', 'especes', 'virement', 'carte'];
  const addTx = (sid, num, offset, moyen) => {
    refSeq += 17;
    const prefix = { orange: 'OM', moov: 'MM', especes: 'CS', virement: 'VR', carte: 'CB' }[moyen];
    transactions.push({ id: 'tx' + refSeq, sid, tranche: num, montant: 150000, date: DT.stamp(offset, 9 + (refSeq % 9), refSeq % 60), moyen,
      reference: prefix + DT.rel(offset).replace(/-/g, '').slice(2) + '.' + String(refSeq).padStart(5, '0'), recu: 'R-2026-' + String(refSeq).padStart(5, '0'),
      tel: moyen === 'orange' || moyen === 'moov' ? users[sid].tel : '', rapproche: moyen === 'especes' || offset < -3 || rnd() < 0.5, par: 'a3' });
  };
  addTx('s1', 1, -55, 'orange');
  Object.values(users).filter((u) => u.role === 'etudiant' && u.id !== 's1').forEach((s) => {
    const r = rnd();
    const nb = r < 0.06 ? 0 : r < 0.32 ? 1 : r < 0.88 ? 2 : 3;
    for (let k = 1; k <= nb; k++) addTx(s.id, k, k === 1 ? -80 + Math.floor(rnd() * 32) : k === 2 ? -22 + Math.floor(rnd() * 21) : -6 + Math.floor(rnd() * 5), pick(moyens));
  });

  /* ---------- Messagerie (15 conversations) ---------- */
  let mid = 0;
  const m = (from, text, offset, hh, mm, extra) => Object.assign({ id: 'm' + (++mid), from, text, date: DT.stamp(offset, hh, mm), luPar: [] }, extra || {});
  const conversations = [
    { id: 'cv1', type: 'individuel', titre: null, participants: ['s1', 't1'], messages: [
      m('s1', 'Bonjour Docteur, pour le mini-projet d\'optimisation, peut-on travailler sur notre propre base MySQL ?', -1, 19, 4),
      m('t1', 'Bonjour Awa. Oui, à condition de fournir le script de création et un jeu de données d\'au moins 10 000 lignes.', -1, 20, 12),
      m('t1', 'Pensez à joindre les plans d\'exécution (EXPLAIN) avant et après vos index.', 0, 7, 41)] },
    { id: 'cv2', type: 'individuel', titre: null, participants: ['s1', 'a1'], messages: [
      m('s1', 'Bonjour Madame, j\'ai demandé une attestation d\'inscription pour mon dossier de stage. Est-elle prête ?', -3, 10, 20),
      m('a1', 'Bonjour. Votre attestation est signée, vous pouvez la retirer au guichet 2 avec votre carte d\'étudiante.', -2, 9, 5)] },
    { id: 'cv3', type: 'groupe', titre: 'L2 Info — Groupe A', participants: ['t1'].concat(promo.filter((s) => s.groupe === 'A').map((s) => s.id)), admins: ['t1'], messages: [
      m('t1', 'Rappel : le TD de Complexité de mercredi se tient en Salle 108 (travaux en Salle 103).', -1, 17, 30),
      m('s5', 'Merci Docteur. Faut-il apporter les exercices de la série 3 ?', -1, 17, 52),
      m('t1', 'Oui, au moins les exercices 1 à 4.', -1, 18, 3),
      m('s11', 'Quelqu\'un a le corrigé de l\'exercice 2 de la série 2 ?', 0, 6, 58)] },
    { id: 'cv4', type: 'groupe', titre: 'L2 Informatique — Promotion', annonce: true, participants: ['t1', 'a1', 't6'].concat(promo.map((s) => s.id)), admins: ['a1', 't1', 't6'], messages: [
      m('a1', 'Les résultats de la session normale du S3 sont publiés. Les convocations au rattrapage sont disponibles dans l\'onglet Examens.', -6, 16, 0),
      m('t6', 'Le TP noté de Java aura lieu en Labo Info 1. Venez avec vos identifiants de session.', -2, 12, 30)] },
    { id: 'cv5', type: 'individuel', titre: null, participants: ['s1', 's2'], messages: [
      m('s2', 'Awa, tu as compris la méthode du simplexe ? Je bloque sur la phase 1.', -1, 21, 10),
      m('s1', 'Oui, on peut réviser demain à la bibliothèque après le cours de 10h.', -1, 21, 26),
      m('s2', 'Parfait, merci !', -1, 21, 27)] },
    { id: 'cv6', type: 'individuel', titre: null, participants: ['s1', 't2'], messages: [
      m('s1', 'Bonjour Professeure, le rattrapage d\'algèbre portera-t-il sur tout le programme ?', -4, 11, 0),
      m('t2', 'Bonjour. Oui, chapitres 1 à 5. Révisez particulièrement la diagonalisation.', -4, 15, 40)] },
    { id: 'cv7', type: 'groupe', titre: 'Projet Java — Équipe 4', participants: ['s1', 's5', 's9', 's13'], admins: ['s1'], messages: [
      m('s9', 'J\'ai poussé la classe Compte sur le dépôt.', -2, 22, 15),
      m('s13', 'Je m\'occupe des tests unitaires ce week-end.', -1, 9, 3),
      m('s5', 'On se retrouve jeudi pour la démo ?', 0, 8, 12)] },
    { id: 'cv8', type: 'individuel', titre: null, participants: ['t1', 'a1'], messages: [
      m('a1', 'Docteur, la saisie du CC2 de Complexité est attendue avant le ' + fr(DT.rel(4)) + '.', -1, 11, 0),
      m('t1', 'Bien noté, je termine la saisie cette semaine.', -1, 12, 34)] },
    { id: 'cv9', type: 'individuel', titre: null, participants: ['t1', 't6'], messages: [
      m('t6', 'Issouf, peux-tu me remplacer pour la surveillance du 12 ?', -2, 14, 0),
      m('t1', 'Oui, sans problème. Envoie-moi la liste des salles.', -2, 14, 22),
      m('t6', 'Merci, c\'est l\'Amphi B, de 8h à 10h.', 0, 8, 2)] },
    { id: 'cv10', type: 'groupe', titre: 'Enseignants — Informatique', participants: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 'a1'], admins: ['t6', 'a1'], messages: [
      m('t6', 'Réunion pédagogique jeudi à 12h30 en Salle du conseil.', -3, 9, 0),
      m('a1', 'Ordre du jour : calendrier des examens du S4 et délibérations du rattrapage S3.', -3, 9, 45)] },
    { id: 'cv11', type: 'individuel', titre: null, participants: ['t1', 's4'], messages: [
      m('s4', 'Docteur, j\'étais malade lundi et je n\'ai pas pu venir. Que dois-je faire ?', -1, 10, 0),
      m('t1', 'Déposez un justificatif depuis l\'onglet Absences, la Scolarité le validera.', -1, 10, 47)] },
    { id: 'cv12', type: 'individuel', titre: null, participants: ['p1', 'a1'], messages: [
      m('p1', 'Bonjour Madame, je souhaite savoir si la 2e tranche de ma fille Awa peut être payée en deux fois.', -2, 19, 10),
      m('a1', 'Bonjour Monsieur. Un échelonnement est possible sur demande écrite. Vous pouvez aussi régler directement par Orange Money depuis Kalanso.', -1, 8, 30),
      m('a1', 'Les pénalités de retard ne s\'appliquent qu\'après le 30 du mois.', -1, 8, 31)] },
    { id: 'cv13', type: 'individuel', titre: null, participants: ['p1', 'a3'], messages: [
      m('a3', 'Bonjour, le reçu de la 1re tranche d\'Awa est disponible dans l\'espace Paiements.', -50, 10, 0),
      m('p1', 'Merci beaucoup.', -50, 12, 15)] },
    { id: 'cv14', type: 'groupe', titre: 'Service de la Scolarité', participants: ['a1', 'a2', 'a3'], admins: ['a1'], messages: [
      m('a2', 'Les 2 justificatifs en attente de la L2 Info sont à valider avant vendredi.', 0, 7, 50),
      m('a3', 'Rapprochement Orange Money du jour terminé, quelques transactions sont à vérifier.', 0, 8, 5)] },
    { id: 'cv15', type: 'individuel', titre: null, participants: ['a1', 't4'], messages: [
      m('a1', 'Monsieur Kaboré, votre TD de lundi 15h en Salle 104 est en conflit avec un TD de Droit.', 0, 8, 15),
      m('t4', 'Je peux passer en Salle 102 si elle est libre.', 0, 8, 40)] }
  ];
  /* Marque comme lus tous les messages, sauf le dernier de certaines conversations */
  const nonLus = { cv1: 1, cv3: 1, cv7: 1, cv9: 1, cv12: 2, cv14: 2, cv15: 1 };
  conversations.forEach((c) => c.messages.forEach((msg, i) => {
    const restant = nonLus[c.id] || 0;
    msg.luPar = i < c.messages.length - restant ? c.participants.slice() : [msg.from];
  }));

  /* ---------- Notifications (25) ---------- */
  let nid = 0;
  const n = (uid, type, titre, texte, offset, hh, lu, lien) => ({ id: 'n' + (++nid), uid, type, titre, texte, date: DT.stamp(offset, hh, 10 + nid), lu, lien });
  const notifications = [
    n('s1', 'note', 'Nouvelle note : Programmation Java', 'CC2 publié : 14/20.', -5, 10, false, '#/etudiant/notes'),
    n('s1', 'cours', 'Cours annulé : Sécurité informatique', 'Le CM de cette semaine est annulé. Rattrapage annoncé.', -1, 18, false, '#/etudiant/emploi-du-temps'),
    n('s1', 'cours', 'Changement de salle', 'TD de Complexité algorithmique : Salle 108 au lieu de la Salle 103.', -1, 17, false, '#/etudiant/emploi-du-temps'),
    n('s1', 'paiement', 'Tranche 2 en retard', 'La 2e tranche (150 000 FCFA) était attendue il y a 10 jours.', -2, 8, false, '#/etudiant/paiements'),
    n('s1', 'message', 'Message de Dr Sawadogo', 'Pensez à joindre les plans d\'exécution (EXPLAIN)…', 0, 7, false, '#/etudiant/messages'),
    n('s1', 'devoir', 'Devoir à rendre dans 2 jours', 'Analyse de complexité — série 3.', 0, 6, true, '#/etudiant/devoirs'),
    n('s1', 'absence', 'Justificatif reçu', 'Votre justificatif du ' + fr(DT.rel(-4)) + ' est en cours d\'examen.', -3, 14, true, '#/etudiant/absences'),
    n('s1', 'annonce', 'Nouvelle annonce', 'Journée portes ouvertes de l\'Incubateur Horizon.', -3, 9, true, '#/etudiant/annonces'),
    n('s1', 'note', 'Résultats du S3 publiés', 'Session normale : 24 crédits sur 30. Rattrapage en Mathématiques.', -6, 16, true, '#/etudiant/notes'),
    n('s1', 'examen', 'Convocation au rattrapage', 'Probabilités et Algèbre linéaire. Convocation disponible.', -6, 16, true, '#/etudiant/examens'),
    n('s1', 'absence', 'Absence enregistrée', 'Programmation linéaire, le ' + fr(DT.rel(-9)) + '.', -9, 12, true, '#/etudiant/absences'),
    n('s1', 'ressource', 'Nouvelle ressource', 'Chapitre 4 — Index et plans d\'exécution (PDF, 1,8 Mo).', -2, 15, true, '#/etudiant/ressources'),
    n('t1', 'note', 'Date limite de saisie', 'CC2 de Complexité algorithmique à saisir avant le ' + fr(DT.rel(4)) + '.', -1, 11, false, '#/enseignant/notes'),
    n('t1', 'message', 'Message de Dr Ouattara', 'Merci, c\'est l\'Amphi B, de 8h à 10h.', 0, 8, false, '#/enseignant/messages'),
    n('t1', 'devoir', '24 rendus reçus', 'TD 2 : transactions et verrous.', -5, 20, false, '#/enseignant/corrections'),
    n('t1', 'cours', 'Changement de salle validé', 'Votre TD du mercredi passe en Salle 108.', -1, 16, true, '#/enseignant/emploi-du-temps'),
    n('t1', 'absence', 'Étudiant au-dessus du seuil', 'Rasmané Kaboré a 3 absences non justifiées en Complexité.', -1, 9, true, '#/enseignant/statistiques'),
    n('a1', 'note', 'Notes soumises', 'Dr Sawadogo a soumis le CC1 de Bases de données avancées.', -1, 18, false, '#/scolarite/validation'),
    n('a1', 'note', 'Notes soumises', 'M. Kaboré a soumis le CC1 d\'Administration réseaux.', -1, 19, false, '#/scolarite/validation'),
    n('a1', 'cours', 'Conflit de salle détecté', 'Salle 104, lundi 15:00 : L2 Info et L2 Droit.', 0, 7, false, '#/scolarite/emplois-du-temps'),
    n('a1', 'absence', '2 justificatifs en attente', 'L2 Informatique.', 0, 7, true, '#/scolarite/absences'),
    n('a1', 'paiement', 'Paiements reçus', 'Nouveaux paiements Orange Money et Moov Money depuis hier.', 0, 8, true, '#/scolarite/finances'),
    n('p1', 'paiement', 'Tranche 2 en retard', 'La 2e tranche d\'Awa (150 000 FCFA) est en retard.', -2, 8, false, '#/parent/paiements'),
    n('p1', 'note', 'Résultats du S3', 'Awa a obtenu 24 crédits sur 30.', -6, 17, true, '#/parent/notes'),
    n('p1', 'absence', 'Absence d\'Awa', 'Programmation linéaire, le ' + fr(DT.rel(-9)) + '.', -9, 13, true, '#/parent/absences')
  ];

  /* ---------- Annonces (8) ---------- */
  const annonces = [
    { id: 'an1', titre: 'Calendrier des examens du second semestre', texte: 'Les examens de la session normale du S4 débuteront dans trois semaines. Le calendrier détaillé par filière est disponible dans l\'onglet Examens. Aucune modification ne sera acceptée après publication.', date: DT.stamp(-1, 10), auteur: 'a1', cible: 'tous', canaux: ['appli', 'sms'], categorie: 'Examens', epingle: true },
    { id: 'an2', titre: 'Coupure d\'électricité programmée — bâtiment B', texte: 'La SONABEL annonce une coupure jeudi de 8h à 12h. Les TP en Labo Info 2 sont déplacés en Labo Info 1.', date: DT.stamp(-2, 15), auteur: 'a2', cible: 'info', canaux: ['appli', 'sms'], categorie: 'Logistique', epingle: false },
    { id: 'an3', titre: 'Journée portes ouvertes de l\'Incubateur Horizon', texte: 'Venez présenter vos projets d\'entreprise. Inscriptions auprès du club Entrepreneuriat avant vendredi.', date: DT.stamp(-3, 9), auteur: 'a1', cible: 'tous', canaux: ['appli'], categorie: 'Vie de campus', epingle: false },
    { id: 'an4', titre: 'Paiement de la 2e tranche', texte: 'Le paiement de la 2e tranche est désormais possible par Orange Money et Moov Money depuis Kalanso. Un reçu est délivré immédiatement.', date: DT.stamp(-12, 8), auteur: 'a3', cible: 'tous', canaux: ['appli', 'sms', 'email'], categorie: 'Scolarité', epingle: false },
    { id: 'an5', titre: 'Résultats de la session normale du S3', texte: 'Les résultats de la L2 Informatique sont publiés. Les étudiants concernés par le rattrapage trouveront leur convocation dans l\'onglet Examens.', date: DT.stamp(-6, 16), auteur: 'a1', cible: 'info', canaux: ['appli', 'sms'], categorie: 'Examens', epingle: false },
    { id: 'an6', titre: 'Bibliothèque universitaire : nouveaux horaires', texte: 'La BU est ouverte de 7h30 à 21h du lundi au vendredi et de 8h à 13h le samedi pendant la période des examens.', date: DT.stamp(-8, 11), auteur: 'a2', cible: 'tous', canaux: ['appli'], categorie: 'Vie de campus', epingle: false },
    { id: 'an7', titre: 'Réunion pédagogique des enseignants', texte: 'Jeudi à 12h30 en Salle du conseil : calendrier des examens et délibérations du rattrapage.', date: DT.stamp(-3, 9), auteur: 'a1', cible: 'enseignants', canaux: ['appli', 'email'], categorie: 'Pédagogie', epingle: false },
    { id: 'an8', titre: 'Visite médicale obligatoire des L1', texte: 'Les étudiants de L1 doivent passer la visite médicale au service de santé universitaire avant la fin du mois.', date: DT.stamp(-15, 10), auteur: 'a2', cible: 'L1', canaux: ['appli', 'sms'], categorie: 'Santé', epingle: false }
  ];

  /* ---------- Ressources de cours (20) ---------- */
  const R = (id, ecueId, titre, type, tailleKo, offset, chapitre) => ({ id, ecueId, titre, type, tailleKo, date: DT.rel(offset), chapitre, auteur: ecueById[ecueId].ens });
  const ressources = [
    R('r1', 'INF2421', 'Chapitre 4 — Index et plans d\'exécution', 'pdf', 1840, -2, 'Chapitre 4'),
    R('r2', 'INF2421', 'Chapitre 3 — Transactions et concurrence', 'pdf', 2210, -12, 'Chapitre 3'),
    R('r3', 'INF2421', 'Diaporama — Normalisation avancée', 'slides', 3560, -20, 'Chapitre 2'),
    R('r4', 'INF2421', 'Script de la base « Bibliothèque »', 'lien', 0, -9, 'Travaux pratiques'),
    R('r5', 'INF2411', 'Série 3 — Analyse de complexité', 'pdf', 420, -4, 'Chapitre 3'),
    R('r6', 'INF2411', 'Cours — Notation de Landau', 'pdf', 980, -18, 'Chapitre 1'),
    R('r7', 'INF2411', 'Vidéo — Tri fusion pas à pas', 'video', 48200, -10, 'Chapitre 2'),
    R('r8', 'INF2411', 'Diaporama — Récurrences et théorème maître', 'slides', 2740, -11, 'Chapitre 2'),
    R('r9', 'INF2412', 'Support — Héritage et polymorphisme', 'slides', 4120, -3, 'Chapitre 3'),
    R('r10', 'INF2412', 'Documentation Java SE 21', 'lien', 0, -30, 'Références'),
    R('r11', 'INF2412', 'TP 4 — Collections', 'pdf', 650, -7, 'Chapitre 4'),
    R('r12', 'MAT2411', 'Méthode du simplexe — exercices corrigés', 'pdf', 1320, -5, 'Chapitre 2'),
    R('r13', 'MAT2411', 'Vidéo — Dualité en programmation linéaire', 'video', 61500, -14, 'Chapitre 3'),
    R('r14', 'MAT2412', 'Algorithmes de Dijkstra et Bellman-Ford', 'pdf', 890, -8, 'Chapitre 2'),
    R('r15', 'INF2432', 'Cryptographie symétrique et asymétrique', 'slides', 5230, -13, 'Chapitre 2'),
    R('r16', 'INF2431', 'Configuration d\'un routeur — TP guidé', 'pdf', 1510, -6, 'Chapitre 3'),
    R('r17', 'INF2441', 'Projet Android de départ', 'lien', 0, -1, 'Projet'),
    R('r18', 'INF2422', 'Méthodes agiles : Scrum en pratique', 'slides', 2890, -16, 'Chapitre 2'),
    R('r19', 'TRA2411', 'Modèle de plan d\'affaires', 'pdf', 740, -21, 'Chapitre 1'),
    R('r20', 'MAT2311', 'Annales du rattrapage de probabilités', 'pdf', 1120, -5, 'Révisions')
  ];

  /* ---------- Devoirs (6) ---------- */
  const rendu = (date, fichier, note, commentaire) => ({ date, fichier, tailleKo: 200 + Math.floor(rnd() * 1800), note, commentaire });
  const devoirs = [
    { id: 'dv1', ecueId: 'INF2411', titre: 'Analyse de complexité — série 3', consignes: 'Résoudre les exercices 1 à 6. Justifier chaque borne asymptotique. Rendu manuscrit scanné ou PDF.', dateLimite: DT.rel(2), heureLimite: '23:59', pieces: ['serie3-complexite.pdf'], rendus: {} },
    { id: 'dv2', ecueId: 'INF2421', titre: 'Mini-projet : optimisation de requêtes', consignes: 'Sur une base d\'au moins 10 000 lignes, proposez trois index et comparez les plans d\'exécution avant et après. Rapport de 5 pages maximum.', dateLimite: DT.rel(5), heureLimite: '18:00', pieces: ['sujet-mini-projet.pdf', 'base-bibliotheque.sql'], rendus: {} },
    { id: 'dv3', ecueId: 'INF2412', titre: 'TP noté : héritage et polymorphisme', consignes: 'Implémenter la hiérarchie Compte / CompteEpargne / CompteCourant avec tests JUnit. Archive .zip du projet.', dateLimite: DT.rel(9), heureLimite: '23:59', pieces: ['enonce-tp-note.pdf'], rendus: {} },
    { id: 'dv4', ecueId: 'INF2421', titre: 'TD 2 : transactions et verrous', consignes: 'Exercices 1 à 4 du TD 2. Expliquez les anomalies de concurrence rencontrées.', dateLimite: DT.rel(-6), heureLimite: '23:59', pieces: ['td2-transactions.pdf'], rendus: {} },
    { id: 'dv5', ecueId: 'MAT2411', titre: 'Exercices sur le simplexe', consignes: 'Exercices 3, 5 et 7 de la feuille 2.', dateLimite: DT.rel(-3), heureLimite: '12:00', pieces: ['feuille2-simplexe.pdf'], rendus: {} },
    { id: 'dv6', ecueId: 'INF2411', titre: 'Série 2 : récurrences', consignes: 'Résoudre les récurrences par la méthode de substitution et le théorème maître.', dateLimite: DT.rel(-10), heureLimite: '23:59', pieces: ['serie2-recurrences.pdf'], rendus: {} }
  ];
  const dv = (id) => devoirs.find((d) => d.id === id);
  dv('dv4').rendus.s1 = rendu(DT.stamp(-7, 21, 40), 'td2-ouedraogo-awa.pdf', 15, 'Très bonne analyse des verrous mortels. Soignez la présentation des ordonnancements.');
  dv('dv5').rendus.s1 = rendu(DT.stamp(-4, 22, 5), 'simplexe-awa-ouedraogo.pdf', null, '');
  dv('dv6').rendus.s1 = rendu(DT.stamp(-11, 18, 30), 'serie2-awa.pdf', 13.5, 'Bon travail. L\'exercice 4 manque de rigueur sur le cas de base.');
  promo.slice(1, 25).forEach((s, i) => {
    const late = i % 8 === 3;
    dv('dv4').rendus[s.id] = rendu(DT.stamp(late ? -5 : -7, late ? 9 : 20, 10 + i), 'td2-' + slug(s.nom) + '-' + slug(s.prenom) + '.pdf', i < 5 ? quarter(niveauEtudiant[s.id] + 1) : null, i < 5 ? 'Travail correct, raisonnement à détailler.' : '');
    dv('dv6').rendus[s.id] = rendu(DT.stamp(-11, 15, i), 'serie2-' + slug(s.nom) + '-' + slug(s.prenom) + '.pdf', quarter(niveauEtudiant[s.id] + (rnd() - 0.5) * 4), 'Vu.');
  });
  promo.slice(1, 6).forEach((s) => { dv('dv2').rendus[s.id] = rendu(DT.stamp(-1, 22, 0), 'projet-' + slug(s.nom) + '.zip', null, ''); });

  /* ---------- Cahier de textes ---------- */
  const cahier = [
    { id: 'ct1', ecueId: 'INF2421', date: DT.rel(-7), contenu: 'Chapitre 3 : niveaux d\'isolation (READ COMMITTED, SERIALIZABLE). Démonstration de lectures fantômes sur PostgreSQL.', devoirId: 'dv4' },
    { id: 'ct2', ecueId: 'INF2421', date: DT.rel(-1), contenu: 'Chapitre 4 : index B-arbre et index de hachage. Lecture d\'un plan EXPLAIN ANALYZE.', devoirId: 'dv2' },
    { id: 'ct3', ecueId: 'INF2411', date: DT.rel(-9), contenu: 'Récurrences linéaires, méthode de l\'arbre des appels, théorème maître (trois cas).', devoirId: 'dv6' },
    { id: 'ct4', ecueId: 'INF2411', date: DT.rel(-2), contenu: 'Complexité en moyenne : analyse du tri rapide. Introduction aux bornes inférieures.', devoirId: 'dv1' },
    { id: 'ct5', ecueId: 'INF2412', date: DT.rel(-2), contenu: 'Classes abstraites et interfaces. Exemple d\'un système de gestion bancaire.', devoirId: 'dv3' },
    { id: 'ct6', ecueId: 'MAT2411', date: DT.rel(-6), contenu: 'Méthode du simplexe : tableau initial, critères d\'entrée et de sortie.', devoirId: 'dv5' },
    { id: 'ct7', ecueId: 'MAT2412', date: DT.rel(-5), contenu: 'Plus courts chemins : Dijkstra (preuve de correction) et Bellman-Ford.', devoirId: null },
    { id: 'ct8', ecueId: 'INF2432', date: DT.rel(-8), contenu: 'Chiffrement symétrique : AES, modes ECB et CBC. Pourquoi ECB est dangereux.', devoirId: null },
    { id: 'ct9', ecueId: 'INF2422', date: DT.rel(-7), contenu: 'Scrum : rôles, cérémonies, artefacts. Atelier de rédaction de récits utilisateurs.', devoirId: null },
    { id: 'ct10', ecueId: 'TRA2411', date: DT.rel(-12), contenu: 'Le business model canvas appliqué à une jeune entreprise ouagalaise de livraison.', devoirId: null }
  ];

  /* ---------- Examens ---------- */
  const examens = [];
  [['MAT2311', 8, '08:00', 2, 'amphiB'], ['MAT2312', 9, '08:00', 2, 'amphiB']].forEach(([ecueId, off, heure, duree, salle], i) => {
    examens.push({ id: 'ex-r' + i, ecueId, session: 'rattrapage', semestre: 'S3', date: DT.rel(off), heure, duree, salle, places: { s1: 'B-' + (41 + i * 7) } });
  });
  ueS4.forEach((ue, ui) => ue.ecues.forEach((e, ei) => {
    examens.push({ id: 'ex-' + e.id, ecueId: e.id, session: 'normale', semestre: 'S4', date: DT.rel(21 + ui * 2 + ei), heure: ei === 0 ? '08:00' : '15:00', duree: 2 + (ei === 0 ? 1 : 0), salle: ui % 2 ? 'amphiA' : 'amphiB', places: { s1: (ui % 2 ? 'A-' : 'B-') + (112 + ui * 3 + ei) } });
  }));

  /* ---------- Demandes administratives ---------- */
  const demandes = [
    { id: 'dm1', sid: 's1', type: 'Attestation d\'inscription', date: DT.stamp(-5, 9), statut: 'prete', motif: 'Dossier de stage', historique: [['soumise', DT.stamp(-5, 9)], ['traitement', DT.stamp(-4, 10)], ['prete', DT.stamp(-2, 9)]] },
    { id: 'dm2', sid: 's1', type: 'Relevé de notes officiel', date: DT.stamp(-2, 14), statut: 'traitement', motif: 'Candidature à une bourse', historique: [['soumise', DT.stamp(-2, 14)], ['traitement', DT.stamp(-1, 8)]] },
    { id: 'dm3', sid: 's7', type: 'Certificat de scolarité', date: DT.stamp(-1, 10), statut: 'soumise', motif: 'Allocations familiales', historique: [['soumise', DT.stamp(-1, 10)]] },
    { id: 'dm4', sid: 's12', type: 'Attestation d\'inscription', date: DT.stamp(-1, 16), statut: 'soumise', motif: 'Demande de visa', historique: [['soumise', DT.stamp(-1, 16)]] },
    { id: 'dm5', sid: 's43', type: 'Relevé de notes officiel', date: DT.stamp(-3, 11), statut: 'traitement', motif: 'Inscription en master', historique: [['soumise', DT.stamp(-3, 11)], ['traitement', DT.stamp(-2, 15)]] },
    { id: 'dm6', sid: 's20', type: 'Certificat de scolarité', date: DT.stamp(0, 8), statut: 'soumise', motif: 'Dossier de bourse', historique: [['soumise', DT.stamp(0, 8)]] }
  ];
  const rendezvous = [{ id: 'rv1', sid: 's1', objet: 'Retrait de l\'attestation d\'inscription', date: DT.rel(1), heure: '10:30', guichet: 'Guichet 2' }];

  /* ---------- Vie de campus ---------- */
  const evenements = [
    { id: 'ev1', titre: 'Hackathon « Faso Digital »', date: DT.rel(10), lieu: 'Labo Info 1 et 2', organisateur: 'Club Informatique', inscrit: false, places: 60, inscrits: 41 },
    { id: 'ev2', titre: 'Conférence : la cybersécurité au Sahel', date: DT.rel(4), lieu: 'Amphi A', organisateur: 'Département Informatique', inscrit: true, places: 600, inscrits: 233 },
    { id: 'ev3', titre: 'Tournoi inter-filières de football', date: DT.rel(13), lieu: 'Terrain universitaire', organisateur: 'Association sportive', inscrit: false, places: 160, inscrits: 120 },
    { id: 'ev4', titre: 'Don de sang avec le CNTS', date: DT.rel(6), lieu: 'Hall du bâtiment A', organisateur: 'Club Santé', inscrit: false, places: 200, inscrits: 87 }
  ];
  const clubs = [
    { id: 'cl1', nom: 'Club Informatique', membres: 84, description: 'Ateliers de programmation, hackathons et préparation aux concours.', membre: true },
    { id: 'cl2', nom: 'Club Entrepreneuriat', membres: 52, description: 'Incubation de projets étudiants et rencontres avec des entrepreneurs.', membre: false },
    { id: 'cl3', nom: 'Club de débat', membres: 37, description: 'Joutes oratoires en français et en anglais, tous les jeudis.', membre: false },
    { id: 'cl4', nom: 'Association sportive', membres: 210, description: 'Football, basket, athlétisme et compétitions universitaires.', membre: false }
  ];

  /* ---------- Journal d'audit (30) ---------- */
  const auditTpl = [
    ['t1', 'Note modifiée', 'INF2322 · Examen · Boris Zongo', '9,50', '11,50', 'Erreur de report de la copie n° 17'],
    ['a1', 'Notes validées', 'INF2412 · CC2 · L2 Info', 'soumise', 'validée', ''],
    ['a1', 'Points de jury', 'S3 · Serge Somé', '9,82', '10,00', 'Délibération du jury du S3'],
    ['a2', 'Justificatif validé', 'Absence · Awa Ouédraogo', 'en attente', 'justifiée', 'Certificat médical'],
    ['a1', 'Rôle modifié', 'Compte de M. Adama Bélem', 'Lecture seule', 'Agent de scolarité', ''],
    ['a3', 'Paiement rapproché', 'Orange Money · 14 transactions', 'à vérifier', 'rapproché', ''],
    ['t6', 'Notes soumises', 'INF2412 · CC2 · L2 Info', 'brouillon', 'soumise', ''],
    ['a1', 'Paramètre modifié', 'Seuil d\'absences', '4', '3', 'Décision du conseil pédagogique'],
    ['t2', 'Note modifiée', 'MAT2311 · CC2 · Aïcha Sanou', '6,00', '8,50', 'Exercice 3 non corrigé'],
    ['a1', 'Compte désactivé', 'Compte de Haoua Traoré', 'actif', 'désactivé', 'Abandon déclaré']
  ];
  const audit = [];
  for (let i = 0; i < 30; i++) {
    const t = auditTpl[i % auditTpl.length];
    audit.push({ id: 'au' + (i + 1), date: DT.stamp(-Math.floor(i * 1.6) - 1, 8 + (i * 3) % 10, (i * 13) % 60), uid: t[0], action: t[1], cible: t[2], avant: t[3], apres: t[4], motif: t[5], ip: '10.12.' + (i % 7) + '.' + (20 + i) });
  }

  return {
    universite: { nom: 'Université Horizon de Ouagadougou', sigle: 'UHO', ville: 'Ouagadougou', annee: '2025-2026', adresse: '01 BP 7021 Ouagadougou 01, Burkina Faso', tel: '+226 25 30 70 64' },
    parametres: { ponderationCC: 40, ponderationExam: 60, seuilValidation: 10, notePlancher: 8, seuilAbsences: 3, rangVisible: true,
      periodes: [{ nom: 'Semestre 3', debut: DT.rel(-140), fin: DT.rel(-40) }, { nom: 'Semestre 4', debut: DT.rel(-35), fin: DT.rel(45) }],
      moyens: { orange: true, moov: true, carte: true, especes: true, virement: true } },
    effectifs: { info: 1284, droit: 2105, eco: 1690 },
    users, formation, sheets, sessions, salles: SALLES, absences, tranches, transactions, conversations, notifications, annonces, ressources,
    devoirs, cahier, examens, appels: [], demandes, rendezvous, evenements, clubs, audit,
    jury: {}, publications: { 'S3-normale': true },
    consentement: { s1: { parent: 'p1', date: DT.rel(-60), portee: ['notes', 'absences', 'paiements'] } },
    sessionsActives: [
      { id: 'se1', appareil: 'Chrome sur Windows', lieu: 'Ouagadougou', derniere: null, courante: true },
      { id: 'se2', appareil: 'Application Android (Tecno Spark 10)', lieu: 'Ouagadougou', derniere: DT.stamp(-1, 21, 40), courante: false },
      { id: 'se3', appareil: 'Firefox sur Linux — Labo Info 1', lieu: 'Campus UHO', derniere: DT.stamp(-4, 15, 2), courante: false }
    ],
    prefsNotif: {
      note: { appli: true, sms: true, email: false }, cours: { appli: true, sms: true, email: false }, paiement: { appli: true, sms: true, email: true },
      message: { appli: true, sms: false, email: false }, absence: { appli: true, sms: false, email: true }, annonce: { appli: true, sms: false, email: false }
    }
  };
}

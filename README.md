# Kalanso — maquette interactive

**Kalanso** (« école » en dioula) est une plateforme de vie universitaire pensée pour le système LMD et les universités du Burkina Faso. Cette maquette cliquable sert à présenter le produit aux établissements. Toutes les données sont **fictives** (Université Horizon de Ouagadougou).

## Lancer la maquette

1. Double-cliquez sur `index.html`. Aucun serveur, aucune installation et aucune connexion Internet ne sont nécessaires.
2. **Entrez dans un espace en un clic** : les cartes « Entrer dans la démo » en haut des écrans Bienvenue et Connexion connectent directement (sans mot de passe ni code SMS). Ensuite, utilisez la **barre de démo** en haut de l’écran :
   - **Voir en tant que** : 4 boutons Étudiant (Awa Ouédraogo), Enseignant (Dr Issouf Sawadogo), Scolarité (Mme Mariam Compaoré) et Parent (M. Karim Ouédraogo). Le changement est immédiat ; « Se déconnecter » revient à l’accueil.
   - **Thème sombre**, **Hors ligne** (bandeau « données de la dernière synchronisation ») et **Économie de données**.
   - **Réinitialiser la démo** : restaure les données de départ.
   - **Replier** : réduit la barre pendant une présentation.

Parcours de connexion complet : mot de passe de démo `Kalanso2026!` (des boutons remplissent les comptes), puis code SMS `123456`.

Page cachée de vérification du design system : `index.html#/demo/composants`.

Navigateurs testés : Chrome et Edge récents, en `file://` et en local. Sous Firefox, si les scripts sont bloqués en `file://`, servez le dossier avec `python -m http.server`.

## Parcours de démo de 5 minutes

| Temps | Rôle | À montrer |
|---|---|---|
| 0:00 | — | **Connexion** : choix de l'établissement, matricule, double authentification par SMS (`123456`). |
| 0:40 | Étudiant | **Tableau de bord** : prochain cours avec compte à rebours, alerte de paiement en retard, seuil d'absences proche, résultats du S3 (11,84 / 20, 24 crédits sur 30). |
| 1:20 | Étudiant | **Notes** : UE en accordéon → ECUE ; Systèmes et réseaux « validée par compensation », Maths « non validée ». En bas, le **simulateur de moyenne** : bouton « Remplir avec mes moyennes de CC », puis modifier une note. |
| 2:00 | Étudiant | **Paiements** → Payer la 2e tranche → Orange Money → confirmation sur le téléphone → reçu imprimable. |
| 2:40 | Enseignant | **Faire l'appel** : « Tous présents », marquer un absent, puis valider et verrouiller. |
| 3:15 | Enseignant | **Saisie des notes** (CC2 de Complexité) : saisie au clavier, cellule invalide en rouge (essayer `21`), statistiques et histogramme en direct, import CSV, puis soumission. |
| 3:50 | Scolarité | **Validation des notes** → Valider : l'étudiante reçoit la note et une notification. **Délibérations** : décisions calculées, points de jury, PV imprimable. |
| 4:30 | Scolarité | **Emplois du temps** : conflit de salle détecté en rouge, avec un bouton « Résoudre ». **Journal d'audit** : toutes les actions précédentes y sont tracées. |
| 4:50 | Parent | **Synthèse** avec mention du consentement de l'étudiante majeure. Possibilité de payer une tranche. |

Bascules à montrer pendant le parcours : **Économie de données**, **Hors ligne** et **Thème sombre**.

## Ce qui différencie Kalanso de Pronote

1. Pensé pour le **LMD** : UE, ECUE, crédits, compensation, rattrapage, délibérations et PV.
2. **Paiement mobile intégré** (Orange Money, Moov Money) : reçus, relances SMS et rapprochement.
3. **Notifications SMS** pour les étudiants peu connectés.
4. **Économie de données** et **mode hors ligne**. La taille des fichiers est affichée.
5. **Appel en un tap** (verrouillé après validation) et **simulateur de moyenne**.
6. Interface sobre, pensée d'abord pour le mobile (barre de navigation en bas).
7. **Journal d'audit** des notes, des points de jury et des rôles.

## Structure

```
index.html       coquille, CSP, ordre de chargement des scripts
styles.css       design system (variables, thème sombre, composants, impression A4)
icons.js         icônes SVG maison (trait 1,75 px)
data.js          données fictives, calculées à partir de la date du jour
components.js    composants UI + registre des écrans
screens/         auth, etudiant, enseignant, scolarite, commun (dont l'espace Parent)
app.js           calculs LMD, store, RBAC, routeur, coquille, barre de démo, tests
```

- **Calculs** (`Calc` dans `app.js`) :
  - Moyenne d'ECUE = CC × 40 % + examen × 60 %.
  - Moyenne d'UE pondérée par les coefficients, moyenne de semestre pondérée par les crédits.
  - Une UE est validée si sa moyenne est ≥ 10. En dessous, elle est **compensée** si la moyenne du semestre est ≥ 10 et l'UE ≥ la note plancher (8 par défaut).
  - Au rattrapage, la meilleure des deux notes d'examen est retenue.
  - Les points de jury s'ajoutent à la moyenne du semestre.
  - Tous ces paramètres se règlent dans *Scolarité → Paramètres*.
- **Tests** : 10 `console.assert` s'exécutent au chargement. La console affiche « 10 tests de calcul réussis ».
- **Notes publiées** : une note n'est visible de l'étudiant qu'une fois sa feuille validée par la Scolarité.

## Sécurité « by design » (dans la maquette)

- Le DOM est construit avec `createElement` et `textContent`. Aucun `innerHTML` avec des données, ni `eval`, ni `new Function`, ni `document.write`.
- La **Content Security Policy** est stricte : aucun script ni style en ligne, aucun gestionnaire `onclick=""`.
- **RBAC simulé** : la table `PERMISSIONS` est vérifiée par le routeur (une route d'un autre rôle affiche « Accès refusé » ; essayez `#/scolarite/audit` en étudiant) et par chaque action (`App.guard`).
- Les saisies sont validées : notes de 0 à 20 au quart de point (ou ABS / DISP), téléphone au format `+226 XX XX XX XX`, type et taille des fichiers.
- Les exports CSV neutralisent les injections de formules (`=`, `+`, `-`, `@`).
- Aucun mot de passe n'est stocké ni journalisé. Le `localStorage` ne sert qu'au thème et à l'état de la barre de démo (dans un `try/catch`).

## Pour la vraie version

- **Authentification côté serveur**, avec double authentification (SMS ou application TOTP) et **limitation du débit** des tentatives de connexion (verrouillage progressif, journalisation).
- Mots de passe hachés avec **Argon2id** (sel unique, paramètres mémoire et temps adaptés).
- **Sessions** dans des cookies `HttpOnly; Secure; SameSite=Strict`, renouvelées à la connexion, révocables à distance.
- **Protection CSRF** (jeton synchronisé ou double soumission) sur toutes les requêtes qui modifient des données.
- **RBAC appliqué côté API** : le masquage des boutons n'est qu'un confort. Prévoir des contrôles par ressource (un enseignant ne voit que ses ECUE, un parent seulement avec consentement).
- **Requêtes SQL paramétrées** ou ORM, et validation des schémas en entrée (types, bornes, formats).
- **Chiffrement** en transit (TLS 1.2+, HSTS) et **au repos** (base et sauvegardes). Gestion des secrets hors du code.
- **Journal d'audit immuable** (ajout seul, entrées chaînées par empreinte, horodatage serveur), consultable mais jamais modifiable.
- **Sauvegardes** automatiques chiffrées, testées régulièrement, avec une copie hors site.
- Paiements : intégration aux API officielles Orange Money et Moov Money, vérification des notifications de paiement (signature, idempotence) et rapprochement automatique.
- **Données personnelles** : conformité à la loi burkinabè sur la protection des données personnelles, avec déclaration auprès de la **CIL** (Commission de l'informatique et des libertés). Il faut aussi :
  - limiter les données à ce qui est nécessaire ;
  - fixer des durées de conservation ;
  - garantir les droits d'accès et de rectification ;
  - recueillir et tracer le consentement de l'étudiant majeur pour l'accès des parents.
- Mode hors ligne réel : *service worker*, cache des données consultées et file de synchronisation pour les actions.

# Studio Marketing IA — Spécification produit

## Vision

Un **pilote automatique des réseaux sociaux** : l'application crée les publications, les publie seule sur les
principaux réseaux, analyse leurs résultats et améliore les suivantes.

Le produit s'adresse à tout le monde (indépendants, commerces, PME, créateurs, agences). Les commerçants de proximité
sont la **première cible commerciale**, pas une limite du produit.

La boucle centrale, qui fait la différence avec les outils existants :

```
Décrire sa marque → Créer → Publier → Analyser → Améliorer → (boucle)
```

## Principes non négociables

- Aucune fausse donnée : pas de statistique inventée, pas de publication simulée présentée comme réelle.
- L'IA n'invente jamais de prix, de promotion, de coordonnée ni de résultat : elle s'appuie sur « Ma marque ».
- Une intégration n'est déclarée « disponible » qu'après un test réussi sur un vrai compte.
- Les données de chaque espace de travail sont strictement isolées.
- L'utilisateur est informé avant tout envoi de ses données à un fournisseur IA externe.

## Découpage en versions

### V1 — la boucle complète, dans le cloud

| Étape | Contenu | État |
|---|---|---|
| 1. Fondations | Monorepo, MongoDB, authentification, espaces de travail, « Ma marque », tableau de bord, paramètres (export, suppression) | **Fait** |
| 2. Création de contenu | Fournisseur IA texte (interface indépendante du modèle), génération de publications adaptées à chaque réseau, éditeur, variantes, brouillons | **Fait** |
| 3. Visuels | Stockage objet, médiathèque, logo, gabarits avec incrustation du logo et des couleurs, images jointes aux publications | **Fait** (génération d'images par IA : fournisseur à choisir) |
| 4. Campagnes et calendrier | Assistant de campagne en 9 étapes, stratégie proposée par l'IA et modifiable, rédaction par lots, calendrier (mois, semaine, liste) avec filtres, programmation, fuseaux horaires et changements d'heure | **Fait** |
| 5a. Moteur de publication | File d'envoi (réservation atomique, reprises avec délai, verrous abandonnés), jetons chiffrés, notifications d'échec (application + e-mail), comptes de test en simulation | **Fait** |
| 5b. Connecteurs réels | OAuth et publication Meta (Facebook, Instagram, Threads), LinkedIn, puis TikTok, YouTube, Pinterest, X | **Écrits** : les 9 connecteurs (Facebook, Instagram, Threads, LinkedIn, TikTok, YouTube, Pinterest, X, Google Business Profile) testés sans réseau réel, « en test » jusqu'au premier essai sur un vrai compte |
| 6. Analyse | Récupération des statistiques disponibles via les API, page de statistiques, premières recommandations | **Fait** : relevés automatiques (Facebook, Instagram, Threads ; LinkedIn non disponible), page Statistiques, conseils fondés sur les résultats réels, meilleures publications transmises à l'IA comme exemples |
| 7. Abonnements | Stripe (paiement, portail client, webhooks vérifiés et idempotents), 4 offres configurables en base, crédits mensuels avec journal immuable, remboursement des échecs | **Fait** (prix à créer dans Stripe) |

### Après la V1 (fait)

- Pages légales, guide de création des applications réseaux, préparation du lancement (`/api/sante`, CSP,
  référencement), images par IA (OpenAI), témoignages réels avec validation.

### Site public

Accueil (`/`), Fonctionnalités, Tarifs (offres lues en base, prix lus chez Stripe, actualisés toutes les heures) et
pages d'accès restylées. Thème « pilote automatique » : signalétique d'aéroport, tableau des départs à palettes
(exemple signalé comme tel), cartes d'embarquement. L'état de chaque réseau affiché sur le site vient du catalogue
`SOCIAL_NETWORKS` : il ne peut pas être en avance sur la réalité. **Pages légales : à faire avant l'ouverture.**

### À ne pas oublier

- **Compléter les informations légales** dans `apps/web/src/lib/legal.ts` dès l'immatriculation (raison sociale,
  forme, SIRET, RCS, TVA, adresse, directeur de la publication, e-mail de contact) et **désigner un médiateur de la
  consommation** (obligatoire pour vendre aux particuliers). Faire relire les textes par un professionnel du droit.

- **Images par IA** : branchées (OpenAI, interface `ImageGenerationProvider`), actives dès que `OPENAI_API_KEY` est
  renseignée. L'IA ne produit que l'image ; texte et logo restent ajoutés par les modèles de visuels.
- **Avant l'ouverture commerciale : `SOCIAL_SIMULATION_ENABLED=false`** pour retirer les comptes de test.
- **Créer les applications Meta et LinkedIn** puis tester chaque connecteur sur un vrai compte (voir
  `docs/SOCIAL_NETWORKS.md`) ; les pages légales (confidentialité, conditions) sont exigées par Meta pour l'App Review.
- **Pages LinkedIn entreprise** : nécessitent la Community Management API (demande d'accès).
- **Contenu des offres** (noms, textes, limites, crédits) : provisoire, modifiable dans la collection `plans`.

**Réseaux visés en V1** : Facebook, Instagram, LinkedIn, TikTok, YouTube, X, Pinterest, Threads.
Chaque réseau est branché dès que sa validation officielle est obtenue (voir `docs/SOCIAL_NETWORKS.md`).

### V2

Recommandations avancées (apprentissage anonymisé entre clients), vidéos à partir de gabarits,
voix off, sous-titres, gestion d'équipe et multi-marques pour les agences, Google Business Profile.

État de la V2 :
- **Vidéos courtes — fait.** Montage dans le navigateur à partir des images de la médiathèque (jusqu'à 8 diapositives,
  60 s, 3 transitions, carte de fin), MP4 H.264 ; publication sur Facebook (vidéo de Page), Instagram (Reels) et
  Threads et LinkedIn (Videos API, envoi en plusieurs parties).
- **Voix off, sous-titres, musique — fait.** Voix de synthèse (OpenAI, après accord, 1 crédit par vidéo) lue sur chaque
  diapositive, sous-titres incrustés synchronisés, musique fournie par l'utilisateur (jamais envoyée au serveur), baissée
  sous la voix ; son AAC.
- **TikTok, YouTube, Pinterest, X, Google Business Profile — écrits.** Connexion (PKCE pour X, jetons courts renouvelés
  automatiquement), publication texte / images / vidéo selon le réseau, statistiques (sauf Google Business Profile).
  Audits et accès à demander côté réseaux (voir `docs/GUIDE_RESEAUX.md`).
- **Équipes et agences — fait.** Invitations par e-mail (lien unique de 7 jours, adresse vérifiée), rôles propriétaire,
  administrateur, rédacteur, lecteur et client (validation) ; validation des publications avant envoi (activable par
  espace, toute modification d'une publication validée la renvoie en validation) ; espaces clients (offre Agence)
  rattachés à l'abonnement de l'agence, crédits partagés, accès séparés ; sélecteur d'espace. Limites par offre :
  `maxMembers`, `maxClientSpaces` (migration 012, modifiables en base).
- **Recommandations anonymisées entre clients — fait.** Chaque publication est comparée à l'habitude de son compte ;
  écarts regroupés par réseau × horaire / jour / format ; repère publié à partir de 5 comptes et 30 publications,
  conseil à partir d'un écart de 20 %. Agrégats seuls conservés (collection `benchmarks`), recalcul quotidien par le
  planificateur ; participation par défaut avec retrait possible (et alors pas d'accès aux repères).

### V3

Application de bureau (Tauri 2) avec moteur IA local pour la génération illimitée sans coût cloud, vidéo générée par IA.
L'architecture des fournisseurs IA est conçue dès la V1 pour accueillir ce mode local.

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
| 5b. Connecteurs réels | OAuth et publication Meta (Facebook, Instagram, Threads), LinkedIn, puis TikTok, YouTube, Pinterest, X | À faire (nécessite les applications validées par chaque réseau) |
| 6. Analyse | Récupération des statistiques disponibles via les API, page de statistiques, premières recommandations | À faire |
| 7. Abonnements | Stripe (paiement, portail client, webhooks vérifiés et idempotents), 4 offres configurables en base, crédits mensuels avec journal immuable, remboursement des échecs | **Fait** (prix à créer dans Stripe) |

### À ne pas oublier

- **Brancher un fournisseur d'images IA** (OpenAI gpt-image recommandé ; Google ou fal.ai possibles) derrière une
  interface `ImageGenerationProvider`. L'IA produit uniquement l'image de fond ; texte, logo et couleurs restent
  incrustés par les gabarits. Décision reportée par le porteur du projet le 14/10/2026.
- **Avant l'ouverture commerciale : `SOCIAL_SIMULATION_ENABLED=false`** pour retirer les comptes de test.
- **Limite de comptes sociaux par offre** (`maxSocialAccounts`) : à appliquer à la connexion des comptes réels (étape 5b).
- **Contenu des offres** (noms, textes, limites, crédits) : provisoire, modifiable dans la collection `plans`.

**Réseaux visés en V1** : Facebook, Instagram, LinkedIn, TikTok, YouTube, X, Pinterest, Threads.
Chaque réseau est branché dès que sa validation officielle est obtenue (voir `docs/SOCIAL_NETWORKS.md`).

### V2

Recommandations avancées (apprentissage anonymisé entre clients), vidéos à partir de gabarits (FFmpeg sur worker),
voix off, sous-titres, gestion d'équipe et multi-marques pour les agences, Google Business Profile.

### V3

Application de bureau (Tauri 2) avec moteur IA local pour la génération illimitée sans coût cloud, vidéo générée par IA.
L'architecture des fournisseurs IA est conçue dès la V1 pour accueillir ce mode local.

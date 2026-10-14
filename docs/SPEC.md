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
| 3. Visuels | Stockage objet (S3/R2), médiathèque, logo, génération d'images cloud + gabarits avec incrustation du logo et des couleurs | À faire |
| 4. Campagnes et calendrier | Assistant de campagne, calendrier (mois, semaine, liste), fuseaux horaires | À faire |
| 5. Publication automatique | File de tâches, OAuth et jetons chiffrés, publication programmée, reprises, idempotence, notifications d'échec | À faire |
| 6. Analyse | Récupération des statistiques disponibles via les API, page de statistiques, premières recommandations | À faire |
| 7. Abonnements | Stripe, offres configurables, crédits avec journal immuable | À faire |

**Réseaux visés en V1** : Facebook, Instagram, LinkedIn, TikTok, YouTube, X, Pinterest, Threads.
Chaque réseau est branché dès que sa validation officielle est obtenue (voir `docs/SOCIAL_NETWORKS.md`).

### V2

Recommandations avancées (apprentissage anonymisé entre clients), vidéos à partir de gabarits (FFmpeg sur worker),
voix off, sous-titres, gestion d'équipe et multi-marques pour les agences, Google Business Profile.

### V3

Application de bureau (Tauri 2) avec moteur IA local pour la génération illimitée sans coût cloud, vidéo générée par IA.
L'architecture des fournisseurs IA est conçue dès la V1 pour accueillir ce mode local.

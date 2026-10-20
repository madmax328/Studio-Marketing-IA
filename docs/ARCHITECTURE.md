# Architecture technique

## Vue d'ensemble

```
apps/
  web/                 Application Next.js (interface + API), déployée sur Vercel
packages/
  shared/              Types, schémas Zod, catalogue des réseaux, rôles, statuts (sans dépendance serveur)
docs/                  Spécification, architecture, réseaux sociaux
```

Les dossiers `apps/desktop`, `packages/ai-core`, `packages/social-integrations` et `workers/` seront créés quand
leur étape commencera, pour ne pas maintenir de code vide.

## Décisions

| Sujet | Choix | Raison |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Compatible Vercel (Root Directory = `apps/web`), cache des tâches |
| Web | Next.js 16 (App Router), React 19, TypeScript strict | Imposé par le cahier des charges |
| Styles | Tailwind CSS 4, composants maison accessibles | Peu de dépendances ; shadcn/ui pourra être ajouté si besoin |
| Base de données | MongoDB Atlas, pilote officiel | Imposé ; client réutilisé entre invocations serverless |
| Authentification | Better Auth + adaptateur MongoDB | E-mail/mot de passe, vérification, réinitialisation, sessions, suppression de compte, limitation de débit en base |
| E-mails | SMTP (boîte Hostinger pendant les tests) ou Resend | Le premier configuré est utilisé ; en développement sans configuration, les e-mails s'affichent dans la console |
| Migrations | Appliquées automatiquement au premier accès de chaque instance | Aucune commande à lancer après un déploiement Vercel |
| Validation | Zod 4, schémas partagés dans `@smia/shared` | Même règles côté formulaire et côté serveur |
| Migrations | Scripts versionnés (`apps/web/src/server/db/migrations`), table `migrations` | Index et changements de structure traçables |
| IA texte | Interface `TextGenerationProvider` (`src/server/ai`), premier fournisseur : Claude (SDK officiel Anthropic, sortie structurée validée par Zod, repli automatique en cas de refus) | Interface prête pour d'autres fournisseurs et le mode local |
| Garde-fous IA | Accord RGPD par espace avant tout envoi, quota mensuel configurable (`limits.monthlyTextGenerations`), une génération par `requestId` | Coûts maîtrisés, pas de double facturation |
| Médias | Vercel Blob en mode privé derrière l'interface `MediaStorage` (`src/server/media/storage.ts`), fichiers sous `ws/<workspaceId>/`, servis par `/api/medias/<id>/fichier` après contrôle d'accès | Simple à brancher sur Vercel ; passage à un stockage S3/R2 possible sans toucher au reste |
| Envoi de fichiers | Envoi direct du navigateur vers le stockage (jeton limité : emplacement, type, 15 Mo), puis vérification du contenu réel par sharp avant inscription en base | Pas de limite de taille des fonctions Vercel ; pas de faux fichiers |
| Visuels | Gabarits rendus par `next/og` (Satori), convertis en JPEG par sharp ; police Montserrat (licence OFL, `apps/web/assets/fonts`) | Texte, logo et couleurs exacts ; JPEG accepté par toutes les API sociales |
| Dates | UTC en base, fuseau IANA de la marque stocké sur chaque publication ; conversions par `@smia/shared/time` (Intl, sans dépendance) ; heure inexistante refusée, heure ambiguë = première occurrence | Changements d'heure gérés et testés |
| Campagnes | Dates des créneaux calculées par l'application, sujets proposés par l'IA ; rédaction par lots de 4 créneaux (un appel IA court par lot, relançable sans doublon) | Respecte les limites de durée de Vercel ; aucun doublon en cas de nouvelle tentative |
| Publication automatique | Route `/api/cron/publier` (secret `CRON_SECRET`) appelée chaque minute par un planificateur ; chaque publication due est réservée atomiquement (statut `processing` + verrou), envoyée par le connecteur du réseau (`SocialPublisher`), puis marquée publiée ou en échec | Sans service supplémentaire ; deux passages simultanés ne peuvent pas envoyer la même publication |
| Échecs d'envoi | Temporaire → nouvel essai à +5, +15 min (3 tentatives) ; contenu refusé → échec ; jeton refusé → compte « à reconnecter » ; résultat inconnu ou traitement interrompu → échec sans nouvel essai (« vérifiez sur le réseau ») | Aucun doublon publié |
| Jetons des réseaux | Chiffrés AES-256-GCM (`SOCIAL_TOKEN_ENCRYPTION_KEY`), jamais renvoyés au navigateur ni journalisés | Protection au repos |
| Images vers les réseaux | Liens temporaires signés (HMAC, 2 h) `/api/medias/public/<id>` | Instagram et Threads téléchargent eux-mêmes l'image |
| Mode test | Comptes « simulation » : toute la chaîne s'exécute sans rien envoyer ; statut affiché « Simulée », exclu des statistiques | Tester sans compte réel, sans jamais faire passer une simulation pour une vraie publication |
| Connexion des réseaux | OAuth par fournisseur (`src/server/social/oauth.ts` : Meta, Threads, LinkedIn) ; état à usage unique lié à l'utilisateur, à l'espace et au navigateur ; comptes proposés gardés chiffrés 15 min le temps du choix ; limite de l'offre vérifiée à la validation | Aucun mot de passe demandé ; aucun jeton exposé ; pas de compte connecté sans choix explicite |
| Connecteurs réels | `src/server/publishing/publishers/*` (Meta, Threads, LinkedIn), `fetch` injectable et testé sans réseau ; erreurs classées (autorisation, temporaire, définitive, incertaine) | Même file d'envoi que la simulation |
| Entretien des autorisations | À chaque passage du planificateur : jetons Threads renouvelés 10 jours avant expiration, alerte 7 jours avant pour les autres, comptes expirés marqués et signalés | L'utilisateur n'est jamais surpris par une publication bloquée |
| Images par IA | Interface `ImageGenerationProvider`, premier fournisseur OpenAI (API Images, appel HTTP direct) ; même garde-fous que le texte (accord par fournisseur, crédits débités puis remboursés si échec, une exécution par demande) ; image sans texte recadrée au format choisi et rangée dans la médiathèque | Le texte et le logo restent exacts car ajoutés par les modèles de visuels |
| Statistiques | Relevés par le planificateur (même appel que l'envoi, avec le temps restant) : 1 h après parution, puis toutes les 3 h (2 jours), 12 h (7 jours), 2 jours, arrêt à 30 jours ; publication réservée pendant le relevé ; historique dans `analyticsSnapshots`, dernier état sur la publication (`metrics`) | Aucun chiffre estimé : un indicateur non fourni reste absent ; simulations jamais mesurées |
| Recommandations | Règles simples sur les résultats réels (réseau, créneau horaire, jour, images) ; au moins 6 publications mesurées, 3 par groupe et un écart de 30 % | Pas de conseil fondé sur le hasard |
| Boucle d'amélioration | Les 3 publications réelles de la marque ayant le plus d'interactions (6 mois) sont transmises à l'IA comme exemples de style, balisées comme données | Les suivantes s'inspirent de ce qui marche, sans recopier ni reprendre de faits |
| Offres | Collection `plans` (insérée par la migration 006 puis modifiable sans code) ; prix lus chez Stripe, jamais codés ; offre effective = abonnement actif, sinon gratuite ; dérogations possibles par espace (`limitOverrides`) | Tarifs et limites ajustables sans déploiement |
| Abonnements | Stripe Checkout + portail client ; webhooks à signature vérifiée, idempotents (`stripeEvents`), état toujours relu chez Stripe (ordre des événements sans importance) ; résiliation automatique avant suppression d'un compte | Aucun prélèvement après suppression |
| Crédits | Compte par espace et par mois (`creditAccounts`) débité de façon conditionnelle (jamais négatif, même en concurrence) ; journal immuable `creditTransactions` à clé unique ; débit avant l'appel IA, remboursement si échec ; visuels par gabarit et publication gratuits | Coûts cloud maîtrisés, aucune double facturation |
| Tests | Vitest ; tests d'intégration sur MongoDB réel en CI (`TEST_MONGODB_URI`) | Vérifie l'isolation des données sur une vraie base |

## Décisions à prendre aux étapes suivantes

| Sujet | Recommandation | Étape |
|---|---|---|
| Workers vidéo (V2) | Service hors Vercel (Railway, Fly.io…) ou service de rendu externe | V2 |

## Règles de sécurité appliquées

- **Contrôle d'accès centralisé** : `requireWorkspace()` (`src/server/session.ts`) vérifie l'adhésion en base à
  chaque requête. Le cookie d'espace actif n'est qu'une préférence.
- **Services filtrés par espace** : chaque fonction de `src/server/services` reçoit un accès vérifié et filtre par
  `workspaceId`. Une ressource d'un autre espace renvoie « introuvable », sans révéler son existence.
- **Permissions par rôle** (`owner`, `admin`, `editor`, `viewer`) définies dans `@smia/shared`.
- **Secrets** uniquement côté serveur (`src/server/env.ts`, importable seulement côté serveur via `server-only`).
- **Mots de passe** hachés par Better Auth ; 10 caractères minimum ; sessions révoquées après réinitialisation.
- **Limitation de débit** sur la connexion, l'inscription et les e-mails (stockée en base pour le serverless).
- **En-têtes de sécurité** dans `next.config.ts`. À ajouter : Content-Security-Policy avec nonce.
- **Journal d'audit** (`auditLogs`) sans secret ni contenu privé.
- **RGPD** : export JSON des données (`/api/compte/export`), suppression complète du compte.

## Collections MongoDB

| Collection | Rôle |
|---|---|
| `user`, `session`, `account`, `verification`, `rateLimit` | Gérées par Better Auth |
| `workspaces` | Espace de travail, limites de l'offre |
| `workspaceMembers` | Adhésion et rôle d'un utilisateur dans un espace |
| `brands` | Mémoire de marque |
| `posts` | Publications (statut, date UTC, fuseau horaire) |
| `socialAccounts` | Comptes sociaux connectés (jetons chiffrés) |
| `oauthStates` | États OAuth à usage unique (expiration automatique) |
| `notifications` | Alertes affichées dans l'application |
| `auditLogs` | Événements sensibles |
| `migrations` | Migrations appliquées |

| `generationJobs` | Générations IA : demande, résultat, statut, consommation |

| `mediaAssets` | Médiathèque : type réel, dimensions, emplacement de stockage |

| `campaigns` | Campagnes : paramètres de l'assistant, stratégie et plan |

| `plans`, `subscriptions` | Offres et abonnement de chaque espace |
| `creditAccounts`, `creditTransactions` | Solde mensuel et journal immuable des crédits |
| `stripeEvents` | Événements Stripe déjà traités |
| `analyticsSnapshots` | Historique des chiffres relevés pour chaque publication |

Collections prévues : aucune pour l'instant.

## Particularités de Next.js 16

- `middleware` s'appelle désormais `proxy` ; l'authentification n'en a pas besoin ici (vérifiée dans les layouts
  et les services).
- `params`, `searchParams`, `cookies()` et `headers()` sont asynchrones.
- La documentation de la version installée se trouve dans `apps/web/node_modules/next/dist/docs/`.

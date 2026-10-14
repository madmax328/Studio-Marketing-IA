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
| Tests | Vitest ; tests d'intégration sur MongoDB réel en CI (`TEST_MONGODB_URI`) | Vérifie l'isolation des données sur une vraie base |

## Décisions à prendre aux étapes suivantes

| Sujet | Recommandation | Étape |
|---|---|---|
| File de tâches et programmation | **Inngest** (fonctionne sur Vercel, `sleepUntil`, reprises, idempotence) ; alternative : Upstash QStash | 5 |
| Génération d'images par IA | Interface `ImageGenerationProvider` à ajouter ; fournisseur à choisir (coût, qualité, conditions commerciales) | 3 bis |
| Fournisseur IA image | Interface `ImageGenerationProvider` ; logo et texte incrustés par gabarit, jamais générés par le modèle | 3 |
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
| `socialAccounts` | Comptes sociaux connectés (jetons chiffrés à l'étape 5) |
| `auditLogs` | Événements sensibles |
| `migrations` | Migrations appliquées |

| `generationJobs` | Générations IA : demande, résultat, statut, consommation |

| `mediaAssets` | Médiathèque : type réel, dimensions, emplacement de stockage |

Collections prévues : `campaigns`, `creditAccounts`, `creditTransactions`,
`subscriptions`, `analyticsSnapshots`, `notifications`.

## Particularités de Next.js 16

- `middleware` s'appelle désormais `proxy` ; l'authentification n'en a pas besoin ici (vérifiée dans les layouts
  et les services).
- `params`, `searchParams`, `cookies()` et `headers()` sont asynchrones.
- La documentation de la version installée se trouve dans `apps/web/node_modules/next/dist/docs/`.

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
| Tests | Vitest ; tests d'intégration sur MongoDB réel en CI (`TEST_MONGODB_URI`) | Vérifie l'isolation des données sur une vraie base |

## Décisions à prendre aux étapes suivantes

| Sujet | Recommandation | Étape |
|---|---|---|
| File de tâches et programmation | **Inngest** (fonctionne sur Vercel, `sleepUntil`, reprises, idempotence) ; alternative : Upstash QStash | 5 |
| Stockage des médias | **Cloudflare R2** (compatible S3, pas de frais de sortie) | 3 |
| Fournisseur IA texte | Interface `TextGenerationProvider`, premier fournisseur à choisir selon coût/qualité en français | 2 |
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

Collections prévues : `campaigns`, `mediaAssets`, `generationJobs`, `creditAccounts`, `creditTransactions`,
`subscriptions`, `analyticsSnapshots`, `notifications`.

## Particularités de Next.js 16

- `middleware` s'appelle désormais `proxy` ; l'authentification n'en a pas besoin ici (vérifiée dans les layouts
  et les services).
- `params`, `searchParams`, `cookies()` et `headers()` sont asynchrones.
- La documentation de la version installée se trouve dans `apps/web/node_modules/next/dist/docs/`.

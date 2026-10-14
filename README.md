# Studio Marketing IA

Le pilote automatique des réseaux sociaux : l'application crée vos publications, les publie, analyse leurs résultats
et améliore les suivantes.

- Spécification et feuille de route : [docs/SPEC.md](docs/SPEC.md)
- Architecture : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Réseaux sociaux et démarches : [docs/SOCIAL_NETWORKS.md](docs/SOCIAL_NETWORKS.md)

## Prérequis

- Node.js 22 ou plus récent
- pnpm 10 (`corepack enable` l'active automatiquement)
- Un cluster MongoDB Atlas (l'offre gratuite suffit pour développer)

## Installation (Windows PowerShell)

```powershell
corepack enable
pnpm install

# Créer le fichier de configuration local
Copy-Item .env.example apps/web/.env.local

# Générer un secret pour AUTH_SECRET, puis le coller dans apps/web/.env.local
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Créer les index MongoDB
pnpm db:migrate

# Lancer l'application sur http://localhost:3000
pnpm dev
```

Sous macOS ou Linux, remplacer `Copy-Item` par `cp` et générer le secret avec `openssl rand -base64 32`.

Sans `RESEND_API_KEY`, les e-mails (confirmation, mot de passe oublié) s'affichent dans le terminal de `pnpm dev` :
copiez le lien affiché pour confirmer votre compte.

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm dev` | Lancer l'application en développement |
| `pnpm build` | Construire pour la production |
| `pnpm typecheck` | Vérifier les types TypeScript |
| `pnpm test` | Lancer les tests (les tests MongoDB nécessitent `TEST_MONGODB_URI`) |
| `pnpm db:migrate` | Appliquer les migrations MongoDB en attente |

## Déploiement sur Vercel

1. Importer le dépôt dans Vercel.
2. **Root Directory** : `apps/web` (Vercel détecte pnpm et le monorepo).
3. Renseigner les variables d'environnement de `.env.example` (Production et Preview).
4. Dans MongoDB Atlas, autoriser l'accès réseau depuis Vercel.
5. Exécuter `pnpm db:migrate` avec l'URI de production avant le premier déploiement.

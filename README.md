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

Sans configuration SMTP ni Resend, les e-mails (confirmation, mot de passe oublié) s'affichent dans le terminal de `pnpm dev` :
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
   Pour les e-mails, la boîte Hostinger suffit : `SMTP_HOST=smtp.hostinger.com`, `SMTP_PORT=465`,
   `SMTP_USER` et `SMTP_PASSWORD` = adresse et mot de passe de la boîte, `EMAIL_FROM` avec la même adresse.
4. Dans MongoDB Atlas, autoriser l'accès réseau depuis Vercel (`0.0.0.0/0`).
5. Les index MongoDB sont créés automatiquement au premier accès (`pnpm db:migrate` reste disponible).

## Activer la publication automatique

L'envoi des publications programmées est déclenché par un appel à `/api/cron/publier`, chaque minute.

1. Dans Vercel, ajouter la variable `CRON_SECRET` (une longue chaîne aléatoire), puis redéployer.
2. Créer une tâche planifiée qui appelle chaque minute :
   - URL : `https://<votre-domaine>/api/cron/publier`
   - En-tête : `Authorization: Bearer <CRON_SECRET>`

   Avec l'offre Vercel Pro, Vercel Cron peut s'en charger (il envoie l'en-tête automatiquement).
   Avec l'offre gratuite (Hobby), Vercel Cron est limité à une exécution par jour : utiliser un service
   externe gratuit comme cron-job.org.
3. Pour essayer sans compte réel : page « Réseaux sociaux » → « Connecter un compte de test (simulation) ».
   Les publications sont marquées « Simulée » et rien n'est envoyé.

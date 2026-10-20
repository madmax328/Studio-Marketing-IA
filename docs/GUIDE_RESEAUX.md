# Guide : brancher Facebook, Instagram, Threads et LinkedIn

Ce guide se suit dans l'ordre. Les écrans des réseaux changent souvent : si un libellé diffère, cherchez l'équivalent
le plus proche. Remplacez partout `https://VOTRE-DOMAINE` par l'adresse de votre site (par exemple
`https://studio-marketing-ia.vercel.app`, puis votre propre domaine plus tard : il faudra alors mettre à jour ces
adresses dans chaque application).

## 0. Avant de commencer (une seule fois)

1. Dans Vercel → votre projet → Settings → Environment Variables, vérifiez que `SOCIAL_TOKEN_ENCRYPTION_KEY` existe.
   Sinon, générez-la (PowerShell) et ajoutez-la, puis redéployez :
   ```powershell
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
   ```
   Ne la changez plus jamais ensuite (les comptes connectés deviendraient inutilisables).
2. Gardez ces adresses sous la main, les réseaux vous les demanderont :

| Champ demandé | Adresse |
|---|---|
| Politique de confidentialité | `https://VOTRE-DOMAINE/confidentialite` |
| Conditions d'utilisation | `https://VOTRE-DOMAINE/conditions` |
| Suppression des données (instructions) | `https://VOTRE-DOMAINE/suppression-des-donnees` |
| Retour Meta (Facebook + Instagram) | `https://VOTRE-DOMAINE/api/reseaux/retour/meta` |
| Retour Threads | `https://VOTRE-DOMAINE/api/reseaux/retour/threads` |
| Désinstallation Threads | `https://VOTRE-DOMAINE/api/reseaux/threads/desinstallation` |
| Suppression des données Threads | `https://VOTRE-DOMAINE/api/reseaux/threads/suppression` |
| Retour LinkedIn | `https://VOTRE-DOMAINE/api/reseaux/retour/linkedin` |

## 1. Meta : Facebook et Instagram

**Ce qu'il vous faut** : un compte Facebook, une Page Facebook, et un compte Instagram **professionnel** (Business
ou Créateur) **relié à cette Page** (dans l'application Instagram : Paramètres → Compte professionnel → Page liée).

1. Allez sur **developers.facebook.com**, connectez-vous et acceptez de devenir développeur.
2. **Créer une application** → type « Entreprise » (ou, selon l'écran, choisissez les cas d'usage) :
   - « Gérer tout sur votre Page » (publication sur les Pages) ;
   - « Gérer les messages et le contenu sur Instagram », **avec la connexion Facebook** (Instagram API with Facebook Login).
3. **Paramètres de l'application → Général** : renseignez les adresses de confidentialité, de conditions et de
   suppression des données (tableau ci-dessus), une icône (1024 × 1024) et une catégorie (« Entreprise et pages »).
4. **Facebook Login (ou « Facebook Login for Business ») → Paramètres** :
   « URI de redirection OAuth valides » = l'adresse « Retour Meta ».
5. **Autorisations** à ajouter : `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `read_insights`,
   `business_management`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`.
6. **Paramètres → Général** : copiez l'**identifiant de l'application** et la **clé secrète** dans Vercel :
   `META_APP_ID` et `META_APP_SECRET`. Redéployez.
7. **Premier essai** (l'application est en « mode développement » : seuls les comptes ayant un rôle sur
   l'application peuvent se connecter, c'est votre cas) :
   - dans le studio → Réseaux sociaux → « Connecter Facebook / Instagram » ;
   - cochez votre Page et votre compte Instagram ;
   - programmez une publication texte sur Facebook, puis une image sur Instagram, à quelques minutes ;
   - vérifiez qu'elles apparaissent sur les réseaux, et que le lien « Voir sur… » fonctionne.
8. **Prévenez-moi du résultat** : je passe alors Facebook et Instagram en « Disponible ».
9. **Pour ouvrir à tous les utilisateurs** (après l'immatriculation) :
   - **Vérification de l'entreprise** (Paramètres → Vérification) : documents officiels de la société ;
   - **App Review** : pour chaque autorisation, expliquez l'usage et joignez une courte vidéo du parcours
     (connexion, choix de la Page, programmation, publication). Comptez plusieurs semaines ;
   - passez l'application en mode « En ligne » (Live).

## 2. Threads

Threads fait partie de la même application Meta, avec **ses propres identifiants**.

1. Dans votre application Meta → **Ajouter un cas d'usage** → « Accéder à l'API Threads ».
2. Autorisations : `threads_basic`, `threads_content_publish`, `threads_manage_insights`.
3. **Paramètres du cas d'usage Threads** :
   - URL de rappel de redirection = « Retour Threads » ;
   - URL de rappel de désinstallation = « Désinstallation Threads » ;
   - URL de rappel de suppression = « Suppression des données Threads ».
4. Rôles → **Testeurs Threads** : ajoutez votre compte Threads, puis acceptez l'invitation dans l'application
   Threads (Paramètres → Compte → Sites web autorisés → Invitations).
5. Copiez l'**identifiant de l'application Threads** et sa **clé secrète** dans Vercel : `THREADS_APP_ID` et
   `THREADS_APP_SECRET`. Redéployez.
6. Essai : Réseaux sociaux → « Connecter Threads », puis une publication texte et une publication avec image.
7. Prévenez-moi du résultat. L'ouverture à tous passe par l'App Review, comme pour Facebook.

## 3. LinkedIn (profil personnel)

**Ce qu'il vous faut** : un compte LinkedIn et une **page LinkedIn de l'entreprise** (LinkedIn exige qu'une
application soit rattachée à une page ; vous pouvez la créer en quelques minutes depuis LinkedIn → « Pour les
entreprises » → « Créer une page »).

1. Allez sur **linkedin.com/developers** → **Create app** : nom, page LinkedIn de l'entreprise, adresse de la
   politique de confidentialité, logo.
2. Onglet **Products** : demandez « **Share on LinkedIn** » et « **Sign In with LinkedIn using OpenID Connect** »
   (accordés en général immédiatement).
3. Onglet **Auth** :
   - « Authorized redirect URLs » = « Retour LinkedIn » ;
   - copiez le **Client ID** et le **Client Secret** dans Vercel : `LINKEDIN_CLIENT_ID` et `LINKEDIN_CLIENT_SECRET`.
     Redéployez.
4. Essai : Réseaux sociaux → « Connecter LinkedIn », puis une publication texte et une avec image.
5. Prévenez-moi du résultat.

À savoir : l'autorisation LinkedIn dure 60 jours ; le studio prévient 7 jours avant pour la renouveler en un clic.
LinkedIn ne transmet pas les statistiques des profils personnels aux applications comme la nôtre : ces publications
apparaissent « non mesurées ». La publication sur les **pages entreprise** demande un accès supplémentaire
(Community Management API), à solliciter plus tard.

## 4. En cas de problème

- « Connexion réelle bientôt disponible » reste affiché : les variables ne sont pas toutes renseignées dans Vercel,
  ou le site n'a pas été redéployé.
- « La demande de connexion a expiré » : recommencez en moins de 10 minutes, dans le même navigateur.
- « Aucune Page Facebook n'a été partagée » : à l'étape de choix sur Facebook, cochez la Page (et le compte Instagram).
- Une publication Instagram refusée : le format de l'image doit être carré, portrait 4:5 ou paysage (pas 9:16).
- Envoyez-moi le message d'erreur exact affiché dans la publication ou dans les alertes : je saurai où chercher.

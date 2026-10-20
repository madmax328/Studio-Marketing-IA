# Guide : brancher vos réseaux sociaux

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
| Retour TikTok | `https://VOTRE-DOMAINE/api/reseaux/retour/tiktok` |
| Retour YouTube | `https://VOTRE-DOMAINE/api/reseaux/retour/youtube` |
| Retour Google Business Profile | `https://VOTRE-DOMAINE/api/reseaux/retour/google_business` |
| Retour Pinterest | `https://VOTRE-DOMAINE/api/reseaux/retour/pinterest` |
| Retour X | `https://VOTRE-DOMAINE/api/reseaux/retour/x` |

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

## 4. TikTok

**Ce qu'il vous faut** : un compte TikTok (de préférence professionnel) et un compte développeur.

1. **developers.tiktok.com** → Manage apps → **Connect an app** : nom, icône, catégorie, description, adresses de
   conditions et de confidentialité.
2. Ajoutez les produits **Login Kit** et **Content Posting API** ; dans Content Posting API, activez **Direct Post**.
3. Login Kit → « Redirect URI » = « Retour TikTok ».
4. Scopes demandés : `user.info.basic`, `user.info.profile`, `video.publish`, `video.upload`, `video.list`.
5. **URL properties → Verify** : vérifiez votre domaine (fichier ou enregistrement DNS fourni par TikTok). C'est
   obligatoire pour publier des **photos** (TikTok vient les chercher sur votre site).
6. Copiez le **Client key** et le **Client secret** dans Vercel : `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`. Redéployez.
7. Essai avec votre propre compte : tant que l'application n'a pas passé **l'audit TikTok**, les vidéos publiées sont
   **privées** (visibles par vous seul). C'est normal.
8. Demande d'audit (« Submit for review ») : TikTok demande une vidéo de démonstration du parcours. Prévenez-moi avant :
   leurs règles d'interface (choix de la visibilité par l'utilisateur, aperçu, mention de la musique) peuvent demander
   des ajustements de l'écran de programmation.

## 5. Google : YouTube et Google Business Profile

Un seul « client OAuth » Google sert aux deux.

1. **console.cloud.google.com** → créez un projet (« Studio Marketing IA »).
2. **API et services → Bibliothèque** : activez **YouTube Data API v3**. Pour Google Business Profile, activez aussi
   **My Business Account Management API**, **My Business Business Information API** et **Google My Business API**
   (ces trois-là n'apparaissent qu'après l'accord de Google, étape 7).
3. **Écran de consentement OAuth** : type « Externe », nom, logo, adresses de confidentialité et de conditions, domaine
   autorisé = votre domaine. Ajoutez les scopes `youtube.upload`, `youtube.readonly` et `business.manage`.
   En mode « Test », ajoutez votre adresse Gmail comme utilisateur de test.
4. **Identifiants → Créer → ID client OAuth** → « Application Web » ; « URI de redirection autorisés » = « Retour
   YouTube » **et** « Retour Google Business Profile ».
5. Copiez l'ID client et le code secret dans Vercel : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Redéployez.
6. **YouTube** : essai avec votre chaîne. Tant que le projet n'a pas passé **l'audit YouTube** (formulaire « YouTube
   API Services – Audit and Quota Extension »), les vidéos envoyées sont **privées**, et le quota gratuit permet
   environ 6 envois de vidéo par jour pour toute l'application.
7. **Google Business Profile** : l'accès aux API est sur demande (formulaire « GBP API access request », réservé aux
   fiches vérifiées depuis plus de 60 jours). Une fois l'accès accordé : essai avec votre fiche.
8. Publication de l'application (« Publier l'application » sur l'écran de consentement) : Google vérifie les scopes
   sensibles (`youtube.upload`, `business.manage`) ; comptez quelques semaines.

## 6. Pinterest

1. **developers.pinterest.com** → **My apps → Connect app** : nom, description, adresse du site, confidentialité.
2. « Redirect URIs » = « Retour Pinterest ».
3. Copiez l'**App ID** et l'**App secret key** dans Vercel : `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`. Redéployez.
4. Essai : Réseaux sociaux → « Connecter Pinterest », puis choisissez le ou les **tableaux** où publier (chaque tableau
   compte comme un compte connecté dans la limite de l'offre).
5. L'accès « Trial » ne publie que des épingles visibles par vous ; demandez ensuite l'accès **Standard** (vidéo de
   démonstration demandée).

## 7. X (Twitter)

**Attention au coût** : l'API X est payante (formule à l'usage ou abonnement). Vérifiez le tarif avant d'activer.

1. **developer.x.com** → créez un projet et une application.
2. **User authentication settings** : OAuth 2.0, type « Web App, Automated App or Bot », permissions « Read and
   write », « Callback URI » = « Retour X », « Website URL » = votre site.
3. Copiez le **Client ID** et le **Client Secret** (OAuth 2.0) dans Vercel : `X_CLIENT_ID`, `X_CLIENT_SECRET`. Redéployez.
4. Essai : texte seul, puis une image, puis une vidéo.
5. Les statistiques sont lues une dizaine de fois par publication pendant 30 jours : avec la formule à l'usage, ces
   lectures sont facturées par X.

## 8. En cas de problème

- « Connexion réelle bientôt disponible » reste affiché : les variables ne sont pas toutes renseignées dans Vercel,
  ou le site n'a pas été redéployé.
- « La demande de connexion a expiré » : recommencez en moins de 10 minutes, dans le même navigateur.
- « Aucune Page Facebook n'a été partagée » : à l'étape de choix sur Facebook, cochez la Page (et le compte Instagram).
- Une publication Instagram refusée : le format de l'image doit être carré, portrait 4:5 ou paysage (pas 9:16).
- TikTok : « n'accepte que les comptes privés » → l'application n'a pas encore passé l'audit (voir section 4).
- YouTube : « quota journalier » → les envois reprennent automatiquement le lendemain.
- Envoyez-moi le message d'erreur exact affiché dans la publication ou dans les alertes : je saurai où chercher.

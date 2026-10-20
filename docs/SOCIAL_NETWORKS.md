# Réseaux sociaux — démarches et état des intégrations

Les validations officielles prennent souvent **plusieurs semaines**. Elles sont sur le chemin critique de la V1 :
il faut les lancer **maintenant**, en parallèle du développement.

> Les informations ci-dessous doivent être revérifiées dans la documentation officielle de chaque plateforme avant
> la mise en production : les conditions d'accès aux API changent régulièrement.

| Réseau | API | Démarches à lancer | Point d'attention | État |
|---|---|---|---|---|
| Facebook | Graph API (Pages) | Application Meta, vérification d'entreprise, App Review des permissions de publication | Publication sur des Pages uniquement (pas les profils personnels) | Code écrit, en test |
| Instagram | Instagram Graph API (via Facebook Login) | Même application Meta, App Review de la permission de publication | Compte professionnel lié à une Page ; image obligatoire (JPEG, format 4:5 à 1,91:1) ; quota de publications par 24 h | Code écrit, en test |
| Threads | Threads API (Meta) | Même application Meta (cas d'usage Threads), App Review | Limite de 500 caractères ; jeton de 60 jours renouvelé automatiquement | Code écrit, en test |
| LinkedIn | Posts API | « Share on LinkedIn » + « Sign In with LinkedIn using OpenID Connect » (profil, libre accès) ; Community Management API (pages entreprise, sur demande) | Jeton de 60 jours non renouvelable : l'utilisateur est prévenu 7 jours avant | Code écrit (profil), en test |
| TikTok | Content Posting API | Application TikTok for Developers + **audit** | Sans audit, les publications restent privées | Prévu |
| YouTube | YouTube Data API v3 | Projet Google Cloud, écran de consentement OAuth vérifié, **audit** | Sans audit, vidéos privées ; quota journalier faible | Prévu |
| Pinterest | API v5 | Application Pinterest, passage en accès standard | Image ou vidéo obligatoire | Prévu |
| X | API X | Abonnement à l'API | Accès payant selon le volume : coût à intégrer au prix des offres | Prévu |

## Ordre recommandé

1. **Meta (Facebook, Instagram, Threads)** : une seule application, trois réseaux, la plus grosse audience.
2. **LinkedIn** : le profil personnel est accessible tout de suite.
3. **TikTok et YouTube** : lancer les audits tôt, ils sont longs.
4. **Google Business Profile** : demande d'accès aux API (fiche vérifiée depuis 60 jours).
5. **Pinterest**.
6. **X** : décider selon le coût de l'API.

## Ce dont l'application aura besoin pour chaque réseau

- Une URL de redirection OAuth : `https://<domaine>/api/reseaux/retour/<fournisseur>` (`meta`, `threads`, `linkedin`, `tiktok`, `youtube`,
  `google_business`, `pinterest`, `x`).
- Une politique de confidentialité et des conditions d'utilisation publiques (exigées par Meta, TikTok, Google).
- Une vidéo de démonstration du parcours (exigée lors des App Review).

## Fonctionnement des connecteurs écrits

- **Connexion** : « Réseaux sociaux » → bouton du réseau → page officielle du réseau → retour sur
  `/api/reseaux/retour/<fournisseur>` → l'utilisateur coche les comptes à connecter (`/reseaux/choisir`).
  L'état OAuth est à usage unique, lié à l'utilisateur, à l'espace et au navigateur (cookie), et expire en 10 minutes.
- **Limite de l'offre** (`maxSocialAccounts`) vérifiée à la validation ; les comptes de test ne comptent pas, la
  reconnexion d'un compte existant non plus.
- **Jetons** chiffrés dès leur réception, jamais affichés ni journalisés.
- **Plusieurs comptes d'un même réseau** : la publication indique lequel utiliser ; sans choix, l'envoi est refusé
  plutôt que de deviner.
- **Facebook** : texte seul (`/feed`), une image (`/photos`), plusieurs images (photos non publiées puis `/feed`).
- **Instagram** : conteneur(s) → attente du traitement → `media_publish`. Les images non JPEG sont converties par le
  lien signé (`&format=jpeg`). Les formats hors 4:5 – 1,91:1 (stories 9:16) sont refusés avant tout envoi.
- **Threads** : conteneur texte, image ou carrousel → attente → `threads_publish`.
- **LinkedIn** : envoi des images (`initializeUpload` + PUT) puis `POST /rest/posts`. Le texte est converti au format
  « little text » (caractères réservés échappés, mots-dièse conservés).
- **Vidéo** : Facebook (`/videos` avec lien signé), Instagram (Reels), Threads, LinkedIn (Videos API, envoi en parties),
  TikTok (envoi par morceaux, publication directe), YouTube (envoi « resumable »), Pinterest (`/media` puis épingle
  `video_id`), X (envoi par morceaux puis traitement). Un traitement long chez le réseau est repris au passage suivant
  (`publishing.resume`) sans renvoyer le fichier.
- **TikTok** : niveau de visibilité lu dans `creator_info` (public si permis, privé avant l'audit) ; photos récupérées
  par TikTok via le lien signé (domaine à vérifier chez TikTok).
- **Pinterest** : chaque tableau choisi est un « compte » ; épingle image, multi-images (2 à 5) ou vidéo.
- **Google Business Profile** : « Nouveauté » (`localPosts`) avec une photo facultative.
- **Jetons courts** (TikTok 24 h, Google 1 h, Pinterest 30 j, X 2 h) : renouvelés automatiquement par le planificateur
  dans le quart d'heure qui précède l'expiration ; X remplace le jeton de renouvellement à chaque fois. Un refus
  définitif (accès retiré) marque le compte « à reconnecter » et prévient l'utilisateur. X utilise PKCE (vérificateur
  gardé côté serveur dans l'état OAuth).
- **Statistiques** : Facebook, Instagram, Threads, YouTube, TikTok (vidéos publiques), Pinterest, X. Pas de chiffres
  par publication pour LinkedIn (profils) ni Google Business Profile.
- **Résultat incertain** (coupure ou erreur serveur au moment de publier) : pas de nouvel essai automatique, pour ne
  jamais publier deux fois.

### Premier test sur un vrai compte (avant de passer un réseau en « disponible »)

1. Créer l'application du réseau, déclarer l'adresse de retour, renseigner les variables dans Vercel.
2. En mode développement de l'application, se connecter avec un compte qui a un rôle sur l'application.
3. Publier un texte, une image, plusieurs images, puis une vidéo (selon ce que le réseau accepte) ; vérifier sur le réseau et le lien « Voir sur … ».
4. Seulement ensuite, passer `integrationStatus` à `"available"` dans `packages/shared/src/social/networks.ts`.

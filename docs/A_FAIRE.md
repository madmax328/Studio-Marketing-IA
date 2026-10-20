# Ce qu'il vous reste à faire

Tout le code des V1, V2 et V3 est écrit, testé et envoyé sur GitHub (branche `claude/zen-mayer-bqr4fg`). Ce qui
suit ne peut être fait que par vous : créer des comptes, signer des conditions, payer des services, tester sur vos
vrais comptes. Faites-le dans l'ordre ; chaque étape indique le guide détaillé à suivre.

Vérification à tout moment de l'installation (PowerShell) :

```powershell
Invoke-RestMethod -Uri "https://VOTRE-DOMAINE/api/sante" -Headers @{ Authorization = "Bearer VOTRE_CRON_SECRET" } | ConvertTo-Json -Depth 5
```

---

## 1. Mise en ligne (à faire tout de suite)

- [ ] **Vercel → Settings → Git** : vérifier que la branche de production est `claude/zen-mayer-bqr4fg` (c'est la
      seule branche du dépôt). Sinon, demandez-moi de préparer une fusion vers une branche `main`.
- [ ] **Planificateur** : une tâche sur cron-job.org, chaque minute, vers `https://VOTRE-DOMAINE/api/cron/publier`
      avec l'en-tête `Authorization: Bearer VOTRE_CRON_SECRET`. Sans elle, rien ne part. C'est elle aussi qui :
  - relève les statistiques ;
  - renouvelle les autorisations des réseaux ;
  - termine les vidéos IA ;
  - efface les voix off temporaires ;
  - calcule les repères anonymes.
- [ ] Redéployer après chaque ajout de variable dans Vercel (Deployments → ⋯ → Redeploy).

## 2. Entreprise et textes légaux (bloquant avant de vendre)

- [ ] Dès l'immatriculation (dans une quinzaine de jours) : compléter `apps/web/src/lib/legal.ts` :
  - raison sociale ;
  - forme et capital ;
  - SIRET, RCS, TVA ;
  - adresse ;
  - directeur de la publication ;
  - e-mail de contact.

  Envoyez-moi ces informations, je fais la modification.
- [ ] Adhérer à un **médiateur de la consommation** (obligatoire pour vendre aux particuliers) et me donner ses
      coordonnées.
- [ ] Faire relire par un professionnel :
  - les mentions légales ;
  - les conditions générales ;
  - la politique de confidentialité, qui mentionne désormais la voix off, les vidéos IA, les équipes et les repères
    anonymes.

## 3. Variables à renseigner dans Vercel

Déjà nécessaires (V1) : `MONGODB_URI`, `AUTH_SECRET`, `APP_URL`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`,
`SOCIAL_TOKEN_ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, e-mails (`SMTP_…` ou `RESEND_API_KEY`, `EMAIL_FROM`).

| Variable | Valeur | Pourquoi |
|---|---|---|
| `SOCIAL_SIMULATION_ENABLED` | `false` | Retirer les comptes de test avant l'ouverture |
| `ADMIN_EMAILS` | votre adresse e-mail | Valider les avis clients sur `/admin/avis` |
| `OPENAI_API_KEY` | clé de platform.openai.com | Images IA, **voix off** et **vidéos IA** (sans clé, ces fonctions restent masquées) |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | application TikTok | Connecteur TikTok |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | projet Google Cloud | YouTube et Google Business Profile |
| `PINTEREST_APP_ID` / `PINTEREST_APP_SECRET` | application Pinterest | Connecteur Pinterest |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | application X | Connecteur X (API payante) |
| `DESKTOP_DOWNLOAD_URL` | lien de la version publiée (étape 6) | Proposer l'application de bureau sur le site |

Les autres variables (`AI_VIDEO_MODEL`, `AI_SPEECH_MODEL`…) ont des valeurs par défaut : ne les touchez pas.

## 4. Réseaux sociaux (au moins un avant d'ouvrir)

Guide pas à pas : **`docs/GUIDE_RESEAUX.md`** (une section par réseau, avec les adresses à copier).

| Réseau | Ce que vous devez faire | Délai côté réseau |
|---|---|---|
| Facebook, Instagram | Application Meta, vérification d'entreprise, App Review | 1 à 4 semaines |
| Threads | Cas d'usage Threads dans la même application Meta, App Review | 1 à 4 semaines |
| LinkedIn | Application LinkedIn (produits accordés tout de suite) | Immédiat |
| TikTok | Application TikTok, vérification du domaine, **audit** (sans audit : vidéos privées) | 2 à 6 semaines |
| YouTube | Projet Google Cloud, **audit** YouTube (sans audit : vidéos privées, quota réduit) | 2 à 6 semaines |
| Google Business Profile | Demande d'accès aux API (fiche vérifiée depuis 60 jours) | 1 à 3 semaines |
| Pinterest | Application Pinterest, passage en accès « Standard » | 1 à 2 semaines |
| X | Application X, **abonnement à l'API payant** (vérifiez le tarif) | Immédiat |

- [ ] Pour chaque réseau : un essai sur votre propre compte (un texte, une image, une vidéo), puis envoyez-moi le
      résultat. **Je ne passe un réseau en « Disponible » qu'après cet essai réussi** (règle du produit).
- [ ] Lancer tôt les démarches longues : audits TikTok et YouTube, accès Google Business Profile.

## 5. Paiement (Stripe)

- [ ] Activer le compte Stripe avec les informations de l'entreprise.
- [ ] Créer les 3 prix récurrents (Solo, Business, Agence) et les mettre dans Vercel : `STRIPE_PRICE_SOLO`,
      `STRIPE_PRICE_BUSINESS`, `STRIPE_PRICE_AGENCY`.
- [ ] Passer en clés de production (`STRIPE_SECRET_KEY` en `sk_live_…`) et recréer le webhook (`STRIPE_WEBHOOK_SECRET`).
- [ ] Vérifier vos marges, car certaines fonctions coûtent cher chez OpenAI :
  - une vidéo IA de 8 secondes coûte environ 0,80 $ et consomme 24 crédits ;
  - ajustez si besoin les crédits par offre (collection `plans`) ou le coût des vidéos (je peux le changer).
- [ ] Un vrai paiement de test, puis remboursement depuis Stripe.

## 6. Application de bureau (V3)

Guide : **`docs/BUREAU.md`**.

- [ ] GitHub → Settings → Secrets and variables → Actions → **Variables** : `SMIA_APP_URL` = l'adresse exacte du site.
- [ ] Publier une version :
  ```powershell
  git tag desktop-v0.1.0
  git push origin desktop-v0.1.0
  ```
  Puis GitHub → Releases → relire le brouillon → « Publish release ».
- [ ] Mettre le lien de la version dans Vercel : `DESKTOP_DOWNLOAD_URL`.
- [ ] Essayer sur votre PC : installer l'application et **Ollama** (ollama.com), puis :
  - dans le Studio, « Télécharger le modèle » ;
  - choisir « Sur cet ordinateur » ;
  - générer une publication.
- [ ] Facultatif, plus tard : acheter un certificat de signature de code (environ 100 à 300 € par an), pour retirer
      l'avertissement de Windows à l'installation.

## 7. Essais que je n'ai pas pu faire ici (à faire sur votre PC)

Mon navigateur de test ne sait pas produire les formats exigés par les réseaux (H.264 pour l'image, AAC pour le son).
J'ai donc testé avec d'autres formats, et le serveur a été vérifié avec un vrai fichier H.264/AAC.

- [ ] Dans Chrome ou Edge sous Windows : Médiathèque → « Créer une vidéo » :
  - ajouter deux photos ;
  - ajouter une musique (MP3) ;
  - si `OPENAI_API_KEY` est renseignée, une voix off ;
  - exporter et vérifier que la vidéo arrive dans la médiathèque avec le son.
- [ ] Si la clé OpenAI est renseignée : créer une vidéo IA de 4 secondes, attendre qu'elle arrive, la publier.
- [ ] Équipe :
  - inviter une deuxième adresse e-mail et accepter l'invitation ;
  - activer « Valider les publications » ;
  - programmer avec le compte rédacteur, valider avec l'autre compte.
- [ ] Parcours complet :
  - inscription, fiche « Ma marque », studio, visuel ;
  - programmation et publication réelle ;
  - statistiques le lendemain.
- [ ] Affichage sur téléphone.

---

## Récapitulatif de ce qui est livré

- **V1** : site, compte, marque, studio IA, visuels, campagnes, calendrier, publication automatique,
  statistiques et conseils, abonnements, avis clients, pages légales.
- **V2** :
  - **vidéos** : montage dans le navigateur, voix off, sous-titres et musique ; publication sur les 8 réseaux qui
    acceptent la vidéo ;
  - **connecteurs** TikTok, YouTube, Pinterest, X et Google Business Profile ;
  - **équipes et agences** : invitations, rôles, validation des publications, espaces clients ;
  - **repères anonymes** entre comptes.
- **V3** :
  - **application de bureau Windows** avec IA locale illimitée (Ollama) ;
  - **vidéos créées par IA** (OpenAI Sora), signalées comme telles sur TikTok et YouTube.

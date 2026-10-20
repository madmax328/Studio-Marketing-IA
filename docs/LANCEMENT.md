# Check-list avant l'ouverture commerciale

L'état de l'installation se vérifie à tout moment (PowerShell) :

```powershell
Invoke-RestMethod -Uri "https://VOTRE-DOMAINE/api/sante" -Headers @{ Authorization = "Bearer VOTRE_CRON_SECRET" } | ConvertTo-Json -Depth 5
```

`ready: true` signifie que tous les points bloquants sont réglés. Aucune clé n'est jamais affichée.

## 1. Entreprise et textes légaux (bloquant)

- [ ] Immatriculation obtenue : compléter `apps/web/src/lib/legal.ts` (raison sociale, forme et capital, SIRET, RCS,
      TVA, adresse, directeur de la publication, e-mail de contact).
- [ ] Désigner un médiateur de la consommation (adhésion payante, obligatoire pour vendre aux particuliers) et le
      renseigner dans `legal.ts`.
- [ ] Faire relire mentions légales, conditions générales et politique de confidentialité par un professionnel.

## 2. Réseaux sociaux (bloquant : au moins un réseau)

- [ ] Suivre `docs/GUIDE_RESEAUX.md` : applications Meta, Threads, LinkedIn ; premier essai sur vos comptes.
- [ ] Me transmettre le résultat des essais : je passe chaque réseau testé en « Disponible ».
- [ ] Vérification d'entreprise Meta et App Review (après immatriculation).

## 3. Paiement

- [ ] Stripe : activer le compte (informations de l'entreprise), créer les 3 prix récurrents (Solo, Business,
      Agence), passer en clés de production (`sk_live_…`), recréer le webhook en production.
- [ ] Vercel : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_BUSINESS`,
      `STRIPE_PRICE_AGENCY`.
- [ ] Ajuster si besoin le contenu des offres (noms, textes, limites, crédits) dans la collection `plans`.
- [ ] Faire un vrai paiement de test, puis le rembourser depuis Stripe.

## 4. Configuration Vercel (bloquant)

- [ ] `APP_URL` = l'adresse définitive en `https://` (domaine personnalisé conseillé).
- [ ] E-mails : SMTP (ou Resend) et `EMAIL_FROM` avec votre propre adresse ; vérifier la réception (inscription,
      mot de passe oublié) et les dossiers de courrier indésirable.
- [ ] `SOCIAL_SIMULATION_ENABLED=false`.
- [ ] `ADMIN_EMAILS` = votre adresse e-mail, pour valider les avis sur `/admin/avis`.
- [ ] Facultatif : `OPENAI_API_KEY` pour proposer la création d'images par IA.
- [ ] Tâche cron-job.org active chaque minute sur `/api/cron/publier`.

## 5. Dernier essai complet

- [ ] Inscription → e-mail de confirmation → fiche « Ma marque » → studio → visuel → programmation → publication
      réelle → statistiques le lendemain.
- [ ] Export des données et suppression d'un compte de test.
- [ ] Affichage sur téléphone.

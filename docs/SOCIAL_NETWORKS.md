# Réseaux sociaux — démarches et état des intégrations

Les validations officielles prennent souvent **plusieurs semaines**. Elles sont sur le chemin critique de la V1 :
il faut les lancer **maintenant**, en parallèle du développement.

> Les informations ci-dessous doivent être revérifiées dans la documentation officielle de chaque plateforme avant
> la mise en production : les conditions d'accès aux API changent régulièrement.

| Réseau | API | Démarches à lancer | Point d'attention | État |
|---|---|---|---|---|
| Facebook | Graph API (Pages) | Application Meta, vérification d'entreprise, App Review des permissions de publication | Publication sur des Pages uniquement (pas les profils personnels) | Prévu |
| Instagram | Instagram Graph API | Même application Meta, App Review de la permission de publication | Compte professionnel obligatoire ; image ou vidéo obligatoire ; quota de publications par 24 h | Prévu |
| Threads | Threads API (Meta) | Même application Meta, App Review | Limite de 500 caractères | Prévu |
| LinkedIn | Posts API | « Share on LinkedIn » (profil, libre accès) ; Community Management API (pages entreprise, sur demande) | L'accès pages entreprise est sélectif | Prévu |
| TikTok | Content Posting API | Application TikTok for Developers + **audit** | Sans audit, les publications restent privées | Prévu |
| YouTube | YouTube Data API v3 | Projet Google Cloud, écran de consentement OAuth vérifié, **audit** | Sans audit, vidéos privées ; quota journalier faible | Prévu |
| Pinterest | API v5 | Application Pinterest, passage en accès standard | Image ou vidéo obligatoire | Prévu |
| X | API X | Abonnement à l'API | Accès payant selon le volume : coût à intégrer au prix des offres | Prévu |

## Ordre recommandé

1. **Meta (Facebook, Instagram, Threads)** : une seule application, trois réseaux, la plus grosse audience.
2. **LinkedIn** : le profil personnel est accessible tout de suite.
3. **TikTok et YouTube** : lancer les audits tôt, ils sont longs.
4. **Pinterest**.
5. **X** : décider selon le coût de l'API.

## Ce dont l'application aura besoin pour chaque réseau

- Une URL de redirection OAuth : `https://<domaine>/api/social/<reseau>/callback`.
- Une politique de confidentialité et des conditions d'utilisation publiques (exigées par Meta, TikTok, Google).
- Une vidéo de démonstration du parcours (exigée lors des App Review).

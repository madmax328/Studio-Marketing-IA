# Consignes pour les sessions de développement

Lire `docs/SPEC.md` et `docs/ARCHITECTURE.md` avant toute modification importante.

## Règles du produit

- Ne jamais présenter comme fonctionnel ce qui ne l'est pas : pas de fausses statistiques, pas de publication
  simulée présentée comme réelle, pas de bouton sans action (un module à venir s'affiche « bientôt », désactivé).
- Une intégration sociale passe à `integrationStatus: "available"` uniquement après un test sur un vrai compte.
- L'IA n'invente jamais prix, promotions, coordonnées ou résultats : elle utilise la marque (`brands`).
- Interface en français ; textes destinés à des non-spécialistes.

## Règles techniques

- TypeScript strict, pas de `any` sans justification.
- Tout accès aux données passe par `src/server/services/*` avec un `WorkspaceAccess` obtenu via
  `requireWorkspace()` ; toujours filtrer par `workspaceId`. Ne jamais faire confiance à un identifiant venu du
  navigateur sans cette vérification.
- Validation avec les schémas Zod de `@smia/shared`, côté serveur.
- Dates en UTC dans MongoDB ; fuseau IANA stocké à côté pour l'affichage.
- Changement de structure ou d'index → nouvelle migration dans `apps/web/src/server/db/migrations` (ne jamais
  modifier une migration existante).
- Secrets uniquement dans `src/server/env.ts` ; jamais de secret dans les journaux ni dans le code client.
- Next.js 16 : lire la documentation de la version installée dans `apps/web/node_modules/next/dist/docs/`.

## Vérifications avant chaque commit

```
pnpm typecheck && pnpm test && pnpm build
```

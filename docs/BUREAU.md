# Application de bureau (V3) — IA locale

L'application de bureau ouvre le studio dans une fenêtre Windows et permet d'écrire les publications avec un modèle
d'IA qui tourne **sur l'ordinateur** (Ollama) : pas de crédits consommés, et les textes ne partent chez aucun service
d'IA. Tout le reste (marques, publications, réseaux, programmation) reste celui du site.

## Fonctionnement

- `apps/desktop/src-tauri` (Tauri 2, Rust) : la fenêtre charge l'adresse du site (`SMIA_APP_URL`, fixée à la
  compilation) et expose trois commandes : `local_ai_status`, `local_ai_pull` (téléchargement d'un modèle avec
  progression), `local_ai_generate` (réponse structurée selon un schéma JSON).
- **Seul le site du studio** peut appeler ces commandes : la capacité Tauri est générée à la compilation à partir de
  `SMIA_APP_URL` (`build.rs`). Testé : une autre adresse ouverte dans la fenêtre est refusée.
- Dans le Studio, un sélecteur « Sur cet ordinateur (illimité) / Dans le cloud (crédits) » apparaît uniquement dans
  l'application. Le serveur prépare les consignes (comme pour le cloud, à partir de la marque vérifiée), l'ordinateur
  écrit, puis le serveur valide la réponse avec le même schéma que le cloud avant de l'afficher.
- Modèle conseillé : `qwen2.5:7b` (≈ 4,7 Go, 8 Go de mémoire vive au minimum). L'utilisateur peut choisir tout autre
  modèle installé dans Ollama.
- Les connexions aux réseaux se font depuis le navigateur (Google refuse les connexions depuis une application) ; les
  comptes connectés sont ensuite disponibles dans l'application.

## Publier une version (à faire par vous)

1. GitHub → votre dépôt → **Settings → Secrets and variables → Actions → Variables** : créez `SMIA_APP_URL` avec
   l'adresse exacte de votre site (ex. `https://studio-marketing-ia.vercel.app`, ou votre domaine). Sans elle,
   l'adresse par défaut ci-dessus est utilisée.
2. Créez une étiquette de version (PowerShell, dans le dossier du projet) :
   ```powershell
   git tag desktop-v0.1.0
   git push origin desktop-v0.1.0
   ```
3. Le workflow « Application de bureau » compile l'installateur Windows (≈ 15 min) et crée un **brouillon de
   version** sur GitHub (onglet Releases). Relisez-le, puis cliquez sur « Publish release ».
4. Copiez le lien de la page de la version et ajoutez-le dans Vercel : `DESKTOP_DOWNLOAD_URL`. Le site propose alors
   le téléchargement (page Fonctionnalités et Studio).

À savoir : l'installateur n'est pas signé numériquement. Windows affichera « Windows a protégé votre ordinateur » :
« Informations complémentaires » → « Exécuter quand même ». Pour supprimer cet avertissement, il faut un certificat
de signature de code (≈ 100 à 300 € par an), à ajouter plus tard au workflow.

## Utilisation (vos clients)

1. Installer l'application, puis **Ollama** (ollama.com, gratuit) et le lancer.
2. Dans le Studio de l'application : « Télécharger le modèle » (une seule fois).
3. Choisir « Sur cet ordinateur (illimité) » puis générer comme d'habitude.

## Vérifications

- `cargo clippy --all-targets -- -D warnings` et `cargo test` dans `apps/desktop/src-tauri` (Linux : paquets
  `libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libsoup-3.0-dev`).
- Le workflow vérifie ces deux commandes avant chaque compilation Windows.

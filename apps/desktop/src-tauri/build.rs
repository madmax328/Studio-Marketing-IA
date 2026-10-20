//! Prépare la compilation : la capacité « site distant » est générée à partir de l'adresse du site
//! (SMIA_APP_URL), pour que seul ce site puisse appeler l'IA locale.

use std::fs;

const DEFAULT_APP_URL: &str = "https://studio-marketing-ia.vercel.app";

fn main() {
    println!("cargo:rerun-if-env-changed=SMIA_APP_URL");
    let app_url = std::env::var("SMIA_APP_URL").unwrap_or_else(|_| DEFAULT_APP_URL.to_string());
    let origin = app_url.trim_end_matches('/');
    assert!(
        origin.starts_with("https://") || origin.starts_with("http://localhost"),
        "SMIA_APP_URL doit être une adresse https (ou http://localhost pour le développement)"
    );
    let capability = serde_json::json!({
        "identifier": "site-distant",
        "description": "Le site du studio (et lui seul) peut utiliser l'IA locale de l'ordinateur.",
        "windows": ["main"],
        "remote": { "urls": [format!("{origin}/*")] },
        "permissions": [
            "core:event:default",
            "allow-local-ai-status",
            "allow-local-ai-pull",
            "allow-local-ai-generate"
        ]
    });
    fs::write(
        "capabilities/site-distant.json",
        serde_json::to_string_pretty(&capability).expect("capacité") + "\n",
    )
    .expect("écriture de la capacité");

    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&["local_ai_status", "local_ai_pull", "local_ai_generate"]),
        ),
    )
    .expect("compilation Tauri");
}

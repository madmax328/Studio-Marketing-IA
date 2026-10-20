//! Application de bureau de Studio Marketing IA.
//!
//! La fenêtre affiche le site du studio. Le site peut demander à l'ordinateur d'écrire avec un modèle d'IA local
//! (Ollama, http://127.0.0.1:11434) : génération illimitée, sans coût cloud, sans que les textes ne quittent la machine.
//! Seul le site du studio (adresse fixée à la compilation) a accès à ces commandes.

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Emitter, WebviewUrl, WebviewWindowBuilder};

const OLLAMA_URL: &str = "http://127.0.0.1:11434";
const DEFAULT_APP_URL: &str = "https://studio-marketing-ia.vercel.app";
/// Taille maximale des consignes transmises au modèle (protège la machine d'une demande démesurée).
const MAX_PROMPT_BYTES: usize = 200_000;

fn app_url() -> &'static str {
    option_env!("SMIA_APP_URL").unwrap_or(DEFAULT_APP_URL)
}

/// Nom de modèle Ollama raisonnable (ex. « qwen2.5:7b », « mistral-nemo:latest »).
fn valid_model(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 100
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | ':' | '/' | '-'))
}

fn client(timeout: Duration) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|_| "Initialisation impossible.".to_string())
}

#[derive(Serialize)]
struct LocalAiStatus {
    running: bool,
    models: Vec<String>,
}

#[derive(Deserialize)]
struct TagsResponse {
    models: Vec<TagModel>,
}

#[derive(Deserialize)]
struct TagModel {
    name: String,
}

/// Ollama est-il lancé, et quels modèles sont installés ?
#[tauri::command]
async fn local_ai_status() -> LocalAiStatus {
    let offline = LocalAiStatus { running: false, models: vec![] };
    let Ok(http) = client(Duration::from_secs(3)) else { return offline };
    let Ok(response) = http.get(format!("{OLLAMA_URL}/api/tags")).send().await else { return offline };
    match response.json::<TagsResponse>().await {
        Ok(tags) => LocalAiStatus { running: true, models: tags.models.into_iter().map(|m| m.name).collect() },
        Err(_) => LocalAiStatus { running: true, models: vec![] },
    }
}

#[derive(Clone, Serialize, Deserialize, Default)]
struct PullProgress {
    #[serde(default)]
    status: String,
    completed: Option<u64>,
    total: Option<u64>,
    #[serde(skip_serializing)]
    error: Option<String>,
}

/// Télécharge un modèle ; la progression est envoyée au site (événement « local-ai-pull »).
#[tauri::command]
async fn local_ai_pull(app: AppHandle, model: String) -> Result<(), String> {
    if !valid_model(&model) {
        return Err("Nom de modèle invalide.".into());
    }
    let http = client(Duration::from_secs(4 * 3600))?;
    let response = http
        .post(format!("{OLLAMA_URL}/api/pull"))
        .json(&serde_json::json!({ "model": model, "stream": true }))
        .send()
        .await
        .map_err(|_| "Ollama ne répond pas : vérifiez qu'il est lancé.".to_string())?;
    if !response.status().is_success() {
        return Err(format!("Ollama a refusé le téléchargement ({}).", response.status()));
    }
    // Réponse ligne par ligne (NDJSON).
    let mut stream = response.bytes_stream();
    let mut buffer: Vec<u8> = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| "Téléchargement interrompu.".to_string())?;
        buffer.extend_from_slice(&chunk);
        while let Some(end) = buffer.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = buffer.drain(..=end).collect();
            let Ok(progress) = serde_json::from_slice::<PullProgress>(&line) else { continue };
            if let Some(error) = progress.error {
                return Err(format!("Téléchargement impossible : {error}"));
            }
            let _ = app.emit("local-ai-pull", progress);
        }
    }
    Ok(())
}

#[derive(Deserialize)]
struct GenerateRequest {
    model: String,
    system: String,
    user: String,
    /// Schéma JSON imposé à la réponse (sortie structurée d'Ollama).
    schema: serde_json::Value,
}

#[derive(Deserialize)]
struct ChatResponse {
    message: ChatMessage,
}

#[derive(Deserialize)]
struct ChatMessage {
    content: String,
}

/// Fait écrire le modèle local et renvoie sa réponse (JSON), validée ensuite par le serveur du studio.
#[tauri::command]
async fn local_ai_generate(request: GenerateRequest) -> Result<String, String> {
    if !valid_model(&request.model) {
        return Err("Nom de modèle invalide.".into());
    }
    if request.system.len() + request.user.len() > MAX_PROMPT_BYTES {
        return Err("Demande trop longue pour l'IA locale.".into());
    }
    let http = client(Duration::from_secs(15 * 60))?;
    let body = serde_json::json!({
        "model": request.model,
        "stream": false,
        "format": request.schema,
        "messages": [
            { "role": "system", "content": request.system },
            { "role": "user", "content": request.user }
        ],
        "options": { "temperature": 0.7, "num_ctx": 8192 }
    });
    let response = http
        .post(format!("{OLLAMA_URL}/api/chat"))
        .json(&body)
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                "L'IA locale a mis trop de temps à répondre. Essayez un modèle plus léger.".to_string()
            } else {
                "Ollama ne répond pas : vérifiez qu'il est lancé.".to_string()
            }
        })?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Err("Ce modèle n'est pas installé sur l'ordinateur.".into());
    }
    if !response.status().is_success() {
        return Err(format!("L'IA locale a rencontré une erreur ({}).", response.status()));
    }
    let chat: ChatResponse = response
        .json()
        .await
        .map_err(|_| "Réponse de l'IA locale illisible.".to_string())?;
    Ok(chat.message.content)
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![local_ai_status, local_ai_pull, local_ai_generate])
        .setup(|app| {
            let url: url::Url = app_url().parse().expect("SMIA_APP_URL invalide");
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("Studio Marketing IA")
                .inner_size(1320.0, 880.0)
                .min_inner_size(960.0, 640.0)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Impossible de lancer Studio Marketing IA");
}

#[cfg(test)]
mod tests {
    use super::valid_model;

    #[test]
    fn noms_de_modele() {
        assert!(valid_model("qwen2.5:7b"));
        assert!(valid_model("hf.co/org/model:Q4_K_M"));
        assert!(!valid_model(""));
        assert!(!valid_model("a b"));
        assert!(!valid_model("x;rm -rf"));
        assert!(!valid_model(&"a".repeat(101)));
    }
}

//! The AI backend: what this Mac offers, a server's models, the Test
//! button, and the subscription's last reported usage.

use crate::runner::{Args, Script};
use crate::settings::Settings;
use crate::{blocking, App};
use serde_json::Value;
use tauri::{AppHandle, Manager};

/// CLI agents and local model servers on this machine (the agent's
/// `detect`)
#[tauri::command]
pub async fn ai_detect(handle: AppHandle) -> Result<Value, String> {
    blocking(move || handle.state::<App>().queue.call(Script::Agent, Args::new(["detect"]))).await
}

/// The models an OpenAI-compatible server offers
#[tauri::command]
pub async fn ai_models(handle: AppHandle, url: String, key: String, protocol: Option<String>) -> Result<Value, String> {
    blocking(move || {
        let protocol = protocol.unwrap_or_else(|| "openai".into());
        let args = Args::new(["models", "--url", &url, "--protocol", &protocol]).opt("--key", Some(key).filter(|k| !k.is_empty()));
        handle.state::<App>().queue.call(Script::Agent, args)
    })
    .await
}

/// The Test button: one tiny request through the backend as Settings
/// shows it now, saved or not
#[tauri::command]
pub async fn ai_test(handle: AppHandle, settings: Settings) -> Result<Value, String> {
    blocking(move || {
        let app = handle.state::<App>();
        app.queue.call_as(&app.launch_for(&settings), Script::Agent, Args::new(["test"]))
    })
    .await
}

/// The AI subscription's last reported usage (see queue::load_usage)
#[tauri::command]
pub fn ai_usage(handle: AppHandle) -> Option<Value> {
    crate::queue::load_usage(&handle)
}

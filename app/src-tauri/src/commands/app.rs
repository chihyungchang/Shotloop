//! The app itself: its setup check and build, the settings, the queue,
//! and the anonymous usage counts.

use crate::queue::{Job, Spec};
use crate::runner::Args;
use crate::settings::{self, Settings};
use crate::{blocking, engine, env, telemetry, App};
use serde_json::Value;
use tauri::{AppHandle, Manager, State};

#[tauri::command]
pub async fn doctor(handle: AppHandle) -> Result<Value, String> {
    blocking(move || {
        let app = handle.state::<App>();
        let mut v = engine(&handle, Args::new(["doctor"]))?;
        let launch = app.queue.launch();
        v["root"] = Value::String(launch.root.display().to_string());
        v["nodePath"] = launch.node.as_ref().map(|n| Value::String(n.display().to_string())).unwrap_or(Value::Null);
        v["apiKey"] = Value::Bool(!launch.api_key.is_empty());
        v["bundled"] = serde_json::json!({
            "node": launch.node.is_some() && launch.node == env::bundled("node"),
            "ffmpeg": env::bundled("ffmpeg").is_some(),
        });
        Ok(v)
    })
    .await
}

/// Settings → About: what this build is and where it runs
#[tauri::command]
pub fn about(handle: AppHandle) -> Value {
    let root = handle.state::<App>().root.clone();
    let bundled = handle.path().resource_dir().ok().is_some_and(|d| d == root);
    serde_json::json!({
        "version": handle.package_info().version.to_string(),
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "bundled": bundled,
        "root": root.display().to_string(),
        "data": handle.path().app_data_dir().ok().map(|d| d.display().to_string()),
    })
}

/// This Mac's cores and memory, and how many shots it builds at once
#[tauri::command]
pub async fn machine() -> Result<settings::Machine, String> {
    blocking(|| Ok(settings::machine())).await
}

/// The saved settings; an error (and settings.json.bad kept) when the
/// file was damaged, until the settings are saved again
#[tauri::command]
pub fn get_settings(app: State<'_, App>) -> Result<Settings, String> {
    settings::load(&app.config_dir)
}

/// The settings saved whole (Settings' form)
#[tauri::command]
pub async fn save_settings(handle: AppHandle, settings: Settings) -> Result<(), String> {
    blocking(move || {
        let app = handle.state::<App>();
        settings::save(&app.config_dir, &settings)?;
        app.relaunch(&settings);
        Ok(())
    })
    .await
}

/// A few fields changed on the settings as saved now, never on a copy read
/// earlier (which would undo what another part of the app saved since)
#[tauri::command]
pub async fn update_settings(handle: AppHandle, patch: Value) -> Result<Settings, String> {
    blocking(move || {
        let app = handle.state::<App>();
        let saved = settings::update(&app.config_dir, &patch)?;
        app.relaunch(&saved);
        Ok(saved)
    })
    .await
}

#[tauri::command]
pub fn enqueue(handle: AppHandle, app: State<'_, App>, spec: Spec) -> u64 {
    app.queue.enqueue(&handle, spec)
}

#[tauri::command]
pub fn jobs(app: State<'_, App>) -> Vec<Job> {
    app.queue.list()
}

#[tauri::command]
pub fn cancel_job(handle: AppHandle, app: State<'_, App>, id: u64) {
    app.queue.cancel(&handle, id)
}

#[tauri::command]
pub fn clear_jobs(handle: AppHandle, app: State<'_, App>) {
    app.queue.clear_finished(&handle)
}

/// The anonymous usage report due now, if one is (telemetry.rs)
#[tauri::command]
pub async fn telemetry_due(handle: AppHandle) -> Result<Option<telemetry::Report>, String> {
    blocking(move || {
        let app = handle.state::<App>();
        // Only once the person has seen the first-launch notice; settings
        // that can't be read say nothing of it
        let on = settings::load(&app.config_dir).is_ok_and(|s| s.telemetry_told && !s.telemetry_off);
        Ok(telemetry::due(&app.config_dir, on, &handle.package_info().version.to_string()))
    })
    .await
}

/// A telemetry report arrived: its counts are taken off
#[tauri::command]
pub async fn telemetry_sent(handle: AppHandle, counts: telemetry::Counts) -> Result<(), String> {
    blocking(move || {
        telemetry::sent(&handle.state::<App>().config_dir, &counts);
        Ok(())
    })
    .await
}

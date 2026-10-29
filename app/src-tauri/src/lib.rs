//! Shotloop desktop app shell (docs/PRD.md §9): windows, file access,
//! process supervision for the engine and the agent, the render queue.

mod env;
mod queue;
mod settings;

use queue::{Job, Launch, Queue, Spec};
use serde_json::Value;
use settings::Settings;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

struct App {
    queue: Arc<Queue>,
    config_dir: PathBuf,
}

fn launch_for(root: PathBuf, settings: &Settings) -> Launch {
    Launch {
        root,
        node: env::node().ok(),
        path: env::child_path(),
        env: settings.env(),
        api_key: settings.api_key.clone(),
    }
}

/// Runs an engine command to completion and returns its `result` event
fn engine(app: &State<'_, App>, args: &[&str]) -> Result<Value, String> {
    let launch = app.queue.launch.lock().unwrap().clone();
    let node = launch.node.clone().ok_or_else(|| env::node().unwrap_err())?;
    let out = Command::new(node)
        .arg(launch.root.join("engine/shotloop/cli.mjs"))
        .args(args)
        .arg("--json")
        .env("PATH", &launch.path)
        .envs(launch.env.iter().cloned())
        .output()
        .map_err(|e| e.to_string())?;
    let mut error = None;
    for line in String::from_utf8_lossy(&out.stdout).lines() {
        if let Ok(ev) = serde_json::from_str::<Value>(line) {
            match ev["type"].as_str() {
                Some("result") => return Ok(ev["value"].clone()),
                Some("error") => error = ev["message"].as_str().map(String::from),
                _ => {}
            }
        }
    }
    Err(error.unwrap_or_else(|| String::from_utf8_lossy(&out.stderr).trim().to_string()))
}

async fn blocking<T: Send + 'static>(f: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|e| e.to_string())?
}

/// A path inside an opened project, never in its cache folder
fn project_file(project: &str, rel: &str) -> Result<PathBuf, String> {
    let root = Path::new(project).canonicalize().map_err(|e| e.to_string())?;
    if !root.join("shotloop.json").exists() {
        return Err(format!("{} is not a Shotloop project", project));
    }
    let path = root.join(rel);
    let parent = path.parent().ok_or("bad path")?.canonicalize().map_err(|e| e.to_string())?;
    if !parent.starts_with(&root) || rel.split('/').any(|p| p == ".." || p == ".shotloop") {
        return Err(format!("{} is outside the project", rel));
    }
    Ok(path)
}

#[tauri::command]
async fn doctor(handle: AppHandle) -> Result<Value, String> {
    blocking(move || {
        let app = handle.state::<App>();
        let mut v = engine(&app, &["doctor"])?;
        let launch = app.queue.launch.lock().unwrap().clone();
        v["root"] = Value::String(launch.root.display().to_string());
        v["nodePath"] = launch.node.map(|n| Value::String(n.display().to_string())).unwrap_or(Value::Null);
        v["apiKey"] = Value::Bool(!launch.api_key.is_empty());
        Ok(v)
    })
    .await
}

#[tauri::command]
async fn open_project(handle: AppHandle, path: String) -> Result<Value, String> {
    // Stills and clips of this project may now be shown by the webview
    handle
        .asset_protocol_scope()
        .allow_directory(&path, true)
        .map_err(|e| e.to_string())?;
    project_status(handle, path).await
}

#[tauri::command]
async fn project_status(handle: AppHandle, path: String) -> Result<Value, String> {
    blocking(move || engine(&handle.state::<App>(), &["status", &path])).await
}

#[tauri::command]
async fn convert_episode(handle: AppHandle, src: String, dst: String) -> Result<Value, String> {
    blocking(move || engine(&handle.state::<App>(), &["convert", &src, &dst])).await
}

#[tauri::command]
fn read_text(project: String, path: String) -> Result<String, String> {
    std::fs::read_to_string(project_file(&project, &path)?).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text(project: String, path: String, content: String) -> Result<(), String> {
    std::fs::write(project_file(&project, &path)?, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn enqueue(handle: AppHandle, app: State<'_, App>, spec: Spec) -> u64 {
    app.queue.enqueue(&handle, spec)
}

#[tauri::command]
fn jobs(app: State<'_, App>) -> Vec<Job> {
    app.queue.list()
}

#[tauri::command]
fn cancel_job(handle: AppHandle, app: State<'_, App>, id: u64) {
    app.queue.cancel(&handle, id)
}

#[tauri::command]
fn clear_jobs(handle: AppHandle, app: State<'_, App>) {
    app.queue.clear_finished(&handle)
}

#[tauri::command]
fn get_settings(app: State<'_, App>) -> Settings {
    settings::load(&app.config_dir)
}

#[tauri::command]
fn save_settings(app: State<'_, App>, settings: Settings) -> Result<(), String> {
    settings::save(&app.config_dir, &settings)?;
    let mut launch = app.queue.launch.lock().unwrap();
    *launch = launch_for(launch.root.clone(), &settings);
    Ok(())
}

/// A project to open at launch: `shotloop <project dir>` or $SHOTLOOP_OPEN
#[tauri::command]
fn initial_project() -> Option<String> {
    std::env::args()
        .skip(1)
        .find(|a| !a.starts_with('-') && Path::new(a).join("shotloop.json").exists())
        .or_else(|| std::env::var("SHOTLOOP_OPEN").ok())
}

#[tauri::command]
fn reveal(path: String) -> Result<(), String> {
    tauri_plugin_opener::reveal_item_in_dir(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let config_dir = app.path().app_config_dir()?;
            let settings = settings::load(&config_dir);
            let root = env::repo_root(app.path().resource_dir().ok());
            let queue = Queue::new();
            *queue.launch.lock().unwrap() = launch_for(root, &settings);
            queue.start(app.handle().clone());
            app.manage(App { queue, config_dir });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            doctor,
            open_project,
            project_status,
            convert_episode,
            read_text,
            write_text,
            enqueue,
            jobs,
            cancel_job,
            clear_jobs,
            get_settings,
            save_settings,
            initial_project,
            reveal,
            open_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running Shotloop");
}

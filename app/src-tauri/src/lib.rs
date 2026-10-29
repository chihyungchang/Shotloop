//! Shotloop desktop app shell (docs/PRD.md §9): windows, file access,
//! process supervision for the engine and the agent, the render queue.

mod env;
mod queue;
mod settings;
mod tray;

use queue::{Job, Launch, Queue, Spec};
use serde_json::Value;
use settings::Settings;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

pub(crate) struct App {
    pub(crate) queue: Arc<Queue>,
    config_dir: PathBuf,
}

fn launch_for(root: PathBuf, settings: &Settings) -> Launch {
    Launch {
        root,
        node: env::node().ok(),
        path: env::child_path(),
        env: settings.env(),
        api_key: settings.api_key(),
        needs_key: settings.needs_key(),
        notify_sound: settings.notify_sound,
        notify_desktop: settings.notify_desktop,
    }
}

/// Runs an engine command to completion and returns its `result` event
fn engine(app: &State<'_, App>, args: &[&str]) -> Result<Value, String> {
    run_script(app, "engine/shotloop/cli.mjs", args)
}

/// Runs a sidecar script (engine or agent) with --json and returns its
/// `result` event
fn run_script(app: &State<'_, App>, script: &str, args: &[&str]) -> Result<Value, String> {
    let env = app.queue.launch.lock().unwrap().env.clone();
    run_script_with(app, script, args, env)
}

/// run_script with the given settings' environment instead of the saved one
fn run_script_with(app: &State<'_, App>, script: &str, args: &[&str], env: Vec<(String, String)>) -> Result<Value, String> {
    let launch = app.queue.launch.lock().unwrap().clone();
    let node = launch.node.clone().ok_or_else(|| env::node().unwrap_err())?;
    let out = Command::new(node)
        .arg(launch.root.join(script))
        .args(args)
        .arg("--json")
        .env("PATH", &launch.path)
        .envs(env)
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

/// Creates a starter project from an idea (`shotloop new`)
#[tauri::command]
async fn create_project(
    handle: AppHandle,
    dir: String,
    idea: String,
    title: String,
    track: String,
    aspect: String,
    duration: u32,
) -> Result<Value, String> {
    let duration = duration.to_string();
    blocking(move || {
        engine(
            &handle.state::<App>(),
            &["new", &dir, "--idea", &idea, "--title", &title, "--track", &track, "--aspect", &aspect, "--duration", &duration],
        )
    })
    .await
}

/// Summaries for project cards; `examples` adds the repository's examples
#[tauri::command]
async fn list_projects(handle: AppHandle, paths: Vec<String>, examples: bool) -> Result<Value, String> {
    // Posters live in each project's cache folder
    for p in &paths {
        let _ = handle.asset_protocol_scope().allow_directory(p, true);
    }
    blocking(move || {
        let app = handle.state::<App>();
        let mut args: Vec<&str> = vec!["list"];
        args.extend(paths.iter().map(String::as_str));
        if examples {
            args.push("--examples");
        }
        let list = engine(&app, &args)?;
        for p in list.as_array().into_iter().flatten() {
            if let Some(root) = p["root"].as_str() {
                let _ = handle.asset_protocol_scope().allow_directory(root, true);
            }
        }
        Ok(list)
    })
    .await
}

/// CLI agents and local model servers on this machine (the agent's
/// `detect`)
#[tauri::command]
async fn ai_detect(handle: AppHandle) -> Result<Value, String> {
    blocking(move || run_script(&handle.state::<App>(), "agent/src/main.ts", &["detect"])).await
}

/// The models an OpenAI-compatible server offers
#[tauri::command]
async fn ai_models(handle: AppHandle, url: String, key: String, protocol: Option<String>) -> Result<Value, String> {
    blocking(move || {
        let protocol = protocol.unwrap_or_else(|| "openai".into());
        let mut args = vec!["models", "--url", url.as_str(), "--protocol", protocol.as_str()];
        if !key.is_empty() {
            args.extend(["--key", key.as_str()]);
        }
        run_script(&handle.state::<App>(), "agent/src/main.ts", &args)
    })
    .await
}

/// The Test button: one tiny request through the backend as Settings
/// shows it now, saved or not
#[tauri::command]
async fn ai_test(handle: AppHandle, settings: Settings) -> Result<Value, String> {
    blocking(move || {
        let mut env = settings.env();
        let key = settings.api_key();
        if !key.is_empty() {
            env.push(("SHOTLOOP_API_KEY".into(), key));
        }
        run_script_with(&handle.state::<App>(), "agent/src/main.ts", &["test"], env)
    })
    .await
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

/// Blender's download page, for 3D projects (the only URL the app opens)
#[tauri::command]
fn open_blender_download() -> Result<(), String> {
    tauri_plugin_opener::open_url("https://www.blender.org/download/", None::<&str>).map_err(|e| e.to_string())
}

/// The whole film to watch: the shots' clips joined, with music (cached)
#[tauri::command]
async fn film_preview(handle: AppHandle, path: String, final_mode: bool) -> Result<Value, String> {
    blocking(move || {
        let mut args = vec!["preview", path.as_str()];
        if final_mode {
            args.push("--final");
        }
        engine(&handle.state::<App>(), &args)
    })
    .await
}

/// The planning page's storyboard.json into the project: shot list,
/// notes, copy.md, starter code for new shots
#[tauri::command]
async fn apply_storyboard(handle: AppHandle, path: String) -> Result<Value, String> {
    blocking(move || engine(&handle.state::<App>(), &["storyboard", &path])).await
}

/// A copy of a project (an example) in the person's folder, to change
#[tauri::command]
async fn fork_project(handle: AppHandle, path: String, to: String) -> Result<Value, String> {
    blocking(move || {
        let app = handle.state::<App>();
        let out = engine(&app, &["fork", &path, "--to", &to])?;
        if let Some(root) = out["root"].as_str() {
            let _ = handle.asset_protocol_scope().allow_directory(root, true);
        }
        Ok(out)
    })
    .await
}

/// The plan of a project that has shots, read back from them (null when
/// they are still starters)
#[tauri::command]
async fn derive_storyboard(handle: AppHandle, path: String) -> Result<Value, String> {
    blocking(move || engine(&handle.state::<App>(), &["storyboard", &path, "--derive"])).await
}

/// Asset library: search a source with the person's key
#[tauri::command]
async fn library_search(handle: AppHandle, source: String, query: String, cursor: Option<String>, all: bool, category: Option<String>) -> Result<Value, String> {
    blocking(move || {
        let app = handle.state::<App>();
        let saved = settings::load(&app.config_dir);
        let key = if source == "polypizza" { saved.polypizza_key } else { saved.smithsonian_key };
        let mut args = vec!["library", "search", "--source", source.as_str(), "--query", query.as_str()];
        if !key.is_empty() {
            args.extend(["--key", key.as_str()]);
        }
        if let Some(c) = cursor.as_deref() {
            args.extend(["--cursor", c]);
        }
        if all {
            args.push("--all");
        }
        if let Some(c) = category.as_deref() {
            args.extend(["--category", c]);
        }
        engine(&app, &args)
    })
    .await
}

/// Asset library: download a search result, list, remove, use in a project
#[tauri::command]
async fn library(handle: AppHandle, action: String, item: Option<Value>, id: Option<String>, project: Option<String>) -> Result<Value, String> {
    blocking(move || {
        let app = handle.state::<App>();
        // Poly Pizza's files need the person's key too
        let poly = item.as_ref().is_some_and(|i| i["source"] == "polypizza");
        let key = if poly { settings::load(&app.config_dir).polypizza_key } else { String::new() };
        let item = item.map(|i| i.to_string());
        let mut args = vec!["library", action.as_str()];
        match action.as_str() {
            "get" => {
                args.extend(["--item", item.as_deref().unwrap_or("null")]);
                if !key.is_empty() {
                    args.extend(["--key", key.as_str()]);
                }
            }
            "list" => args.extend(project.as_deref()),
            "remove" | "import" => args.extend(id.as_deref()),
            "use" | "unuse" => args.extend(project.as_deref().into_iter().chain(id.as_deref())),
            _ => return Err(format!("unknown library action {action}")),
        }
        engine(&app, &args)
    })
    .await
}

/// Rename the project (shotloop.json title)
#[tauri::command]
async fn set_title(handle: AppHandle, path: String, title: String) -> Result<Value, String> {
    blocking(move || engine(&handle.state::<App>(), &["title", &path, &title])).await
}

/// The project's music bed: read it, or set a preset, an audio file, none,
/// and the volume
#[tauri::command]
async fn music(handle: AppHandle, path: String, preset: Option<String>, file: Option<String>, none: Option<bool>, gain: Option<f64>) -> Result<Value, String> {
    blocking(move || {
        let gain = gain.map(|g| g.to_string());
        let mut args = vec!["music", path.as_str()];
        if let Some(p) = preset.as_deref() {
            args.extend(["--preset", p]);
        }
        if let Some(f) = file.as_deref() {
            args.extend(["--file", f]);
        }
        if none == Some(true) {
            args.push("--none");
        }
        if let Some(g) = gain.as_deref() {
            args.extend(["--gain", g]);
        }
        engine(&handle.state::<App>(), &args)
    })
    .await
}

/// Settings → About: what this build is and where it runs
#[tauri::command]
fn about(handle: AppHandle) -> Value {
    let launch = handle.state::<App>().queue.launch.lock().unwrap().clone();
    let bundled = handle.path().resource_dir().ok().is_some_and(|d| d == launch.root);
    serde_json::json!({
        "version": handle.package_info().version.to_string(),
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "bundled": bundled,
        "root": launch.root.display().to_string(),
        "data": handle.path().app_data_dir().ok().map(|d| d.display().to_string()),
    })
}

/// A provider's key page: https links only
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("only https links can be opened".into());
    }
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|e| e.to_string())
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
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let config_dir = app.path().app_config_dir()?;
            let settings = settings::load(&config_dir);
            let resource_dir = app.path().resource_dir().ok();
            let root = env::repo_root(resource_dir.clone());
            // A bundled app runs its examples from a writable copy
            if resource_dir.as_deref() == Some(root.as_path()) {
                let examples = app.path().app_data_dir()?.join("examples");
                env::seed_examples(&root.join("examples"), &examples);
                std::env::set_var("SHOTLOOP_EXAMPLES", &examples);
            }
            let queue = Queue::new();
            *queue.launch.lock().unwrap() = launch_for(root, &settings);
            queue.start(app.handle().clone());
            app.manage(App { queue, config_dir });
            // The asset library: one folder for every project, readable by the UI
            let library = app.path().app_data_dir()?.join("library");
            std::fs::create_dir_all(&library)?;
            std::env::set_var("SHOTLOOP_LIBRARY", &library);
            let _ = app.asset_protocol_scope().allow_directory(&library, true);
            let tray = tray::create(app.handle())?;
            app.manage(tray);
            Ok(())
        })
        // Closing the window keeps Shotloop in the menu bar, so renders go
        // on; Quit (the app menu or the tray) ends it
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            doctor,
            open_project,
            project_status,
            create_project,
            list_projects,
            ai_detect,
            ai_models,
            ai_test,
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
            open_path,
            open_blender_download,
            open_url,
            about,
            film_preview,
            set_title,
            apply_storyboard,
            derive_storyboard,
            fork_project,
            library_search,
            library,
            music,
            tray::set_tray_text,
            tray::test_alert
        ])
        .build(tauri::generate_context!())
        .expect("error while building Shotloop")
        .run(|app, event| {
            // Clicking the Dock icon brings the hidden window back
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                tray::show_main(app);
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}

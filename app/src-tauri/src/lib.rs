//! Shotloop desktop app shell (docs/PRD.md §9): windows, file access,
//! process supervision for the engine and the agent, the render queue.
//! The commands the UI calls live in commands/, by domain.

mod commands;
mod env;
mod files;
mod queue;
mod runner;
mod settings;
mod telemetry;
mod tray;

use queue::{Launch, Queue};
use serde_json::Value;
use settings::Settings;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Manager};

pub(crate) struct App {
    pub(crate) queue: Arc<Queue>,
    pub(crate) config_dir: PathBuf,
    root: PathBuf,
    dirs: Dirs,
}

/// The app's own folders the engine works in, passed to every child
pub(crate) struct Dirs {
    /// The example projects: a writable copy in a bundled app, the
    /// repository's in development
    examples: PathBuf,
    /// Examples opened and not saved yet; they last one session
    drafts: PathBuf,
    /// The asset library, one for every project
    library: PathBuf,
    /// Speech models for the voice-over, downloaded on first use
    voices: PathBuf,
    /// Cover templates
    covers: PathBuf,
    /// The AI's memory: the person's notes and its lessons
    memory: PathBuf,
}

impl Dirs {
    fn env(&self) -> Vec<(String, String)> {
        [
            ("SHOTLOOP_EXAMPLES", &self.examples),
            ("SHOTLOOP_DRAFTS", &self.drafts),
            ("SHOTLOOP_LIBRARY", &self.library),
            ("SHOTLOOP_VOICES", &self.voices),
            ("SHOTLOOP_COVERS", &self.covers),
            ("SHOTLOOP_MEMORY", &self.memory),
        ]
        .into_iter()
        .map(|(k, v)| (k.to_string(), v.display().to_string()))
        .collect()
    }
}

fn launch_for(root: &Path, dirs: &Dirs, settings: &Settings) -> Launch {
    let mut env = settings.env();
    env.extend(dirs.env());
    Launch {
        root: root.to_path_buf(),
        node: env::node().ok(),
        path: env::child_path(),
        env,
        api_key: settings.api_key(),
        needs_key: settings.needs_key(),
        notify_sound: settings.notify_sound,
        notify_desktop: settings.notify_desktop,
        telemetry: !settings.telemetry_off,
    }
}

impl App {
    /// How children start, after the settings changed (or would, for a test)
    fn launch_for(&self, settings: &Settings) -> Launch {
        launch_for(&self.root, &self.dirs, settings)
    }

    fn relaunch(&self, settings: &Settings) {
        let launch = self.launch_for(settings);
        *self.queue.launch.lock().unwrap() = launch;
    }
}

/// An engine command run for the app (Queue::call): its result
fn engine(handle: &AppHandle, args: runner::Args) -> Result<Value, String> {
    handle.state::<App>().queue.call(runner::Script::Engine, args)
}

async fn blocking<T: Send + 'static>(f: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|e| e.to_string())?
}

/// A folder the webview may show files from (stills, clips, posters, an
/// export's files). A failed grant only hides those images, so it is
/// logged rather than failing what the person asked for
fn allow_dir(handle: &AppHandle, dir: &Path) {
    if let Err(e) = handle.asset_protocol_scope().allow_directory(dir, true) {
        eprintln!("shotloop: could not show files of {}: {e}", dir.display());
    }
}

/// The project an engine command answered about (its `root`), once it is
/// confirmed to be one: a real folder with a shotloop.json
fn allow_root(handle: &AppHandle, out: &Value) {
    let Some(root) = out["root"].as_str() else { return };
    match Path::new(root).canonicalize() {
        Ok(dir) if dir.join("shotloop.json").is_file() => allow_dir(handle, &dir),
        _ => eprintln!("shotloop: {root} is not a project; its files stay hidden"),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // One Shotloop at a time (a second would clear the first's drafts):
        // opening it again shows the running one
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| tray::show_main(app)))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let config_dir = app.path().app_config_dir()?;
            // Damaged settings were set aside; the UI hears of it from
            // get_settings, and the children start with the defaults
            let settings = settings::load(&config_dir).unwrap_or_else(|e| {
                eprintln!("shotloop: {e}");
                settings::first_run()
            });
            let resource_dir = app.path().resource_dir().ok();
            let root = env::repo_root(resource_dir.clone());
            let data = app.path().app_data_dir()?;
            // A bundled app runs its examples from a writable copy
            let examples = if resource_dir.as_deref() == Some(root.as_path()) {
                let examples = data.join("examples");
                env::seed_examples(&root.join("examples"), &examples);
                examples
            } else {
                root.join("examples")
            };
            let dirs = Dirs { examples, drafts: data.join("drafts"), library: data.join("library"), voices: data.join("voices"), covers: data.join("covers"), memory: data.join("memory") };
            // Drafts left from the last session are thrown away
            if let Err(e) = std::fs::remove_dir_all(&dirs.drafts) {
                if e.kind() != std::io::ErrorKind::NotFound {
                    eprintln!("shotloop: could not clear the old drafts: {e}");
                }
            }
            // Without these folders, opening an example or the library fails
            for dir in [&dirs.drafts, &dirs.library, &dirs.covers] {
                std::fs::create_dir_all(dir)?;
            }
            // The library and the cover templates are shown by the UI
            allow_dir(app.handle(), &dirs.library);
            allow_dir(app.handle(), &dirs.covers);
            let queue = Queue::new(launch_for(&root, &dirs, &settings));
            queue.start(app.handle().clone());
            app.manage(App { queue, config_dir, root, dirs });
            let tray = tray::create(app.handle())?;
            app.manage(tray);
            Ok(())
        })
        // Closing the window keeps Shotloop in the menu bar, so renders go
        // on; Quit (the app menu or the tray) ends it
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if let Err(e) = window.hide() {
                    eprintln!("shotloop: could not hide the window: {e}");
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::doctor,
            commands::app::about,
            commands::app::machine,
            commands::app::get_settings,
            commands::app::update_settings,
            commands::app::enqueue,
            commands::app::jobs,
            commands::app::cancel_job,
            commands::app::clear_jobs,
            commands::app::telemetry_due,
            commands::app::telemetry_sent,
            commands::projects::open_project,
            commands::projects::project_status,
            commands::projects::create_project,
            commands::projects::list_projects,
            commands::projects::read_text,
            commands::projects::write_text,
            commands::projects::trash_project,
            commands::projects::initial_project,
            commands::projects::default_workspace,
            commands::projects::open_example,
            commands::projects::save_draft,
            commands::projects::discard_draft,
            commands::projects::set_title,
            commands::projects::set_style,
            commands::projects::apply_storyboard,
            commands::projects::derive_storyboard,
            commands::projects::quality,
            commands::projects::pick_map,
            commands::media::covers,
            commands::media::deliver_copy,
            commands::media::music,
            commands::media::voice,
            commands::media::voice_models,
            commands::memory::memory,
            commands::library::library_search,
            commands::library::library,
            commands::ai::ai_detect,
            commands::ai::ai_models,
            commands::ai::ai_test,
            commands::ai::ai_usage,
            commands::os::reveal,
            commands::os::open_path,
            commands::os::open_url,
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
            // Quitting stops the jobs' and calls' processes too
            if let tauri::RunEvent::Exit = event {
                app.state::<App>().queue.kill_all();
            }
        });
}

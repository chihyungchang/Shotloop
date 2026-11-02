//! Projects: opening, creating and listing them, their text files, the
//! examples and drafts, the plan, and the project's own settings.

use crate::runner::Args;
use crate::{allow_root, blocking, engine, App};
use serde::Deserialize;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager, State};

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
pub async fn open_project(handle: AppHandle, path: String) -> Result<Value, String> {
    blocking(move || {
        // Stills and clips of this project may now be shown by the webview
        engine_project(&handle, Args::new(["status", &path]))
    })
    .await
}

#[tauri::command]
pub async fn project_status(handle: AppHandle, path: String) -> Result<Value, String> {
    blocking(move || engine(&handle, Args::new(["status", &path]))).await
}

/// What the new-project form sends (`shotloop new`)
#[derive(Deserialize)]
pub struct NewProject {
    dir: String,
    idea: String,
    title: String,
    track: String,
    aspect: String,
    /// Seconds, or "auto" for the planner to choose
    duration: String,
    look: Option<String>,
    style: Option<String>,
    /// The voice-over: on unless the person turned it off
    voice: Option<bool>,
}

/// Creates a starter project from an idea (`shotloop new`)
#[tauri::command]
pub async fn create_project(handle: AppHandle, project: NewProject) -> Result<Value, String> {
    blocking(move || {
        let p = project;
        let given = |v: Option<String>| v.filter(|s| !s.is_empty());
        let args = Args::new(["new", &p.dir, "--idea", &p.idea, "--title", &p.title, "--track", &p.track, "--aspect", &p.aspect, "--duration", &p.duration])
            .flag(p.voice == Some(false), "--no-voice")
            .opt("--look", given(p.look))
            .opt("--style", given(p.style));
        engine(&handle, args)
    })
    .await
}

/// Summaries for project cards; `examples` adds the repository's examples
#[tauri::command]
pub async fn list_projects(handle: AppHandle, paths: Vec<String>, examples: bool) -> Result<Value, String> {
    blocking(move || {
        let list = engine(&handle, Args::new(["list"]).args(paths).flag(examples, "--examples"))?;
        // Posters live in each project's cache folder
        for p in list.as_array().into_iter().flatten() {
            allow_root(&handle, p);
        }
        Ok(list)
    })
    .await
}

#[tauri::command]
pub fn read_text(project: String, path: String) -> Result<String, String> {
    std::fs::read_to_string(project_file(&project, &path)?).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_text(project: String, path: String, content: String) -> Result<(), String> {
    let file = project_file(&project, &path)?;
    // A link would let a project's file point anywhere on the Mac
    if std::fs::symlink_metadata(&file).is_ok_and(|m| m.file_type().is_symlink()) {
        return Err(format!("{path} is a link; only the project's own files can be written"));
    }
    crate::files::write_atomic(&file, content.as_bytes(), false).map_err(|e| e.to_string())
}

/// A project to the Trash (recoverable from there). Not an example or a
/// draft, and not while a job of it is queued or running
#[tauri::command]
pub async fn trash_project(handle: AppHandle, path: String) -> Result<(), String> {
    blocking(move || {
        let app = handle.state::<App>();
        let dir = Path::new(&path).canonicalize().map_err(|e| e.to_string())?;
        if !dir.join("shotloop.json").is_file() {
            return Err(format!("{path} is not a Shotloop project"));
        }
        // Canonical on both sides: the examples run from a copy in a bundled app
        let inside = |folder: &Path| folder.canonicalize().is_ok_and(|f| dir.starts_with(f));
        if inside(&app.dirs.examples) || inside(&app.dirs.drafts) {
            return Err("examples can't be deleted".into());
        }
        let same = |p: &str| Path::new(p).canonicalize().is_ok_and(|p| p == dir);
        if app.queue.list().iter().any(|j| matches!(j.state.as_str(), "queued" | "running") && same(&j.project)) {
            return Err("busy".into());
        }
        // macOS 15+ has /usr/bin/trash; before that, Finder does it
        let ok = if Path::new("/usr/bin/trash").exists() {
            Command::new("/usr/bin/trash").arg(&dir).status()
        } else {
            let script = format!("tell application \"Finder\" to delete (POSIX file {:?} as alias)", dir.display().to_string());
            Command::new("/usr/bin/osascript").args(["-e", &script]).status()
        }
        .map_err(|e| e.to_string())?
        .success();
        if ok {
            Ok(())
        } else {
            Err(format!("couldn't move {path} to the Trash"))
        }
    })
    .await
}

/// A project to open at launch: `shotloop <project dir>` or $SHOTLOOP_OPEN
#[tauri::command]
pub fn initial_project() -> Option<String> {
    let path = std::env::args()
        .skip(1)
        .find(|a| !a.starts_with('-') && Path::new(a).join("shotloop.json").exists())
        .or_else(|| std::env::var("SHOTLOOP_OPEN").ok())?;
    // Absolute: the engine runs in the app's folder, not where `shotloop .` was typed
    Some(Path::new(&path).canonicalize().map_or(path, |p| p.display().to_string()))
}

/// Where projects go when the person picks no folder: ~/Documents/Shotloop
#[tauri::command]
pub fn default_workspace(handle: AppHandle) -> Result<String, String> {
    let dir = handle.path().document_dir().map_err(|e| e.to_string())?.join("Shotloop");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().into_owned())
}

/// An engine command whose answer is a project (`root`) the UI shows next
fn engine_project(handle: &AppHandle, args: Args) -> Result<Value, String> {
    let out = engine(handle, args)?;
    allow_root(handle, &out);
    Ok(out)
}

/// An example opened as a draft: a copy in the drafts folder, kept only
/// if the person saves it
#[tauri::command]
pub async fn open_example(handle: AppHandle, app: State<'_, App>, path: String) -> Result<Value, String> {
    let drafts = app.dirs.drafts.display().to_string();
    blocking(move || engine_project(&handle, Args::new(["fork", &path, "--to", &drafts]))).await
}

/// A draft saved into the person's folder
#[tauri::command]
pub async fn save_draft(handle: AppHandle, path: String, to: String) -> Result<Value, String> {
    blocking(move || engine_project(&handle, Args::new(["move", &path, "--to", &to]))).await
}

/// A draft thrown away (the engine refuses anything outside the drafts)
#[tauri::command]
pub async fn discard_draft(handle: AppHandle, path: String) -> Result<Value, String> {
    blocking(move || engine(&handle, Args::new(["discard", &path]))).await
}

/// Rename the project (shotloop.json title)
#[tauri::command]
pub async fn set_title(handle: AppHandle, path: String, title: String) -> Result<Value, String> {
    blocking(move || engine(&handle, Args::new(["title", &path, "--", &title]))).await
}

/// The visual style the person picked on the plan (shotloop.json style)
#[tauri::command]
pub async fn set_style(handle: AppHandle, path: String, style: String) -> Result<Value, String> {
    blocking(move || engine(&handle, Args::new(["style", &path, &style]))).await
}

/// The planning page's storyboard.json into the project: shot list,
/// notes, copy.md, starter code for new shots
#[tauri::command]
pub async fn apply_storyboard(handle: AppHandle, path: String) -> Result<Value, String> {
    blocking(move || engine(&handle, Args::new(["storyboard", &path]))).await
}

/// The plan of a project that has shots, read back from them (null when
/// they are still starters)
#[tauri::command]
pub async fn derive_storyboard(handle: AppHandle, path: String) -> Result<Value, String> {
    blocking(move || engine(&handle, Args::new(["storyboard", &path, "--derive"]))).await
}



/// What is where on a 2D shot's three stills, for the element picker
#[tauri::command]
pub async fn pick_map(handle: AppHandle, path: String, shot: String) -> Result<Value, String> {
    blocking(move || engine(&handle, Args::new(["pick", &path, "--shot", &shot]))).await
}

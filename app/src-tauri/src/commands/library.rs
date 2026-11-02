//! The asset library: 3D models and sounds found on free sources (Poly
//! Pizza and the Smithsonian with the person's own keys, Openverse with
//! none), kept once on this Mac.

use crate::runner::Args;
use crate::settings::{self, Settings};
use crate::{blocking, engine, App};
use serde_json::Value;
use tauri::{AppHandle, Manager};

/// The saved settings' keys for the sources. Settings that can't be read
/// (get_settings reports why) have none: a search goes on without one
fn saved(handle: &AppHandle) -> Settings {
    settings::load(&handle.state::<App>().config_dir).unwrap_or_default()
}

fn given(key: String) -> Option<String> {
    Some(key).filter(|k| !k.is_empty())
}

/// Search a source with the person's key
#[tauri::command]
pub async fn library_search(handle: AppHandle, source: String, query: String, cursor: Option<String>, all: bool, category: Option<String>) -> Result<Value, String> {
    blocking(move || {
        let s = saved(&handle);
        let key = match source.as_str() {
            "polypizza" => s.polypizza_key,
            "smithsonian" => s.smithsonian_key,
            _ => String::new(),
        };
        let args = Args::new(["library", "search", "--source", &source, "--query", &query])
            .opt("--key", given(key))
            .opt("--cursor", cursor)
            .flag(all, "--all")
            .opt("--category", category);
        engine(&handle, args)
    })
    .await
}

/// Download a search result, hear a sound first, list, remove, use in a project
#[tauri::command]
pub async fn library(handle: AppHandle, action: String, item: Option<Value>, id: Option<String>, project: Option<String>) -> Result<Value, String> {
    blocking(move || {
        let base = Args::new(["library", action.as_str()]);
        let args = match action.as_str() {
            "get" => {
                // Poly Pizza's files need the person's key too
                let poly = item.as_ref().is_some_and(|i| i["source"] == "polypizza");
                let key = if poly { given(saved(&handle).polypizza_key) } else { None };
                base.arg("--item").arg(item.map_or("null".into(), |i| i.to_string())).opt("--key", key)
            }
            "preview" => base.arg("--item").arg(item.map_or("null".into(), |i| i.to_string())),
            "list" => base.args(project),
            "remove" | "import" => base.args(id),
            "use" | "unuse" => base.args(project).args(id),
            _ => return Err(format!("unknown library action {action}")),
        };
        engine(&handle, args)
    })
    .await
}

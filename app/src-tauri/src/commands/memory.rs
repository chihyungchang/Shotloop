//! The AI's memory (engine/shotloop/memory.mjs): the person's notes and the
//! lessons the AI kept, which every agent task reads.

use crate::runner::Args;
use crate::{blocking, engine};
use serde_json::Value;
use tauri::AppHandle;

/// List the memory, add a note of the person's, remove an entry
#[tauri::command]
pub async fn memory(handle: AppHandle, action: String, text: Option<String>, id: Option<String>) -> Result<Value, String> {
    blocking(move || {
        let args = match action.as_str() {
            "list" => Args::new(["memory", "list"]),
            "add" => Args::new(["memory", "add"]).opt("--text", text),
            "remove" => Args::new(["memory", "remove"]).arg(id.unwrap_or_default()),
            _ => return Err(format!("unknown memory action {action}")),
        };
        engine(&handle, args)
    })
    .await
}

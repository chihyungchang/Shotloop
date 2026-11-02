//! The video rules (engine/shotloop/rules.mjs): the fixed rules, the
//! person's taste, which they reword, switch off or add to, and the
//! toolbox, to which they add their own tools with a picture.

use crate::runner::Args;
use crate::{blocking, engine};
use serde_json::Value;
use tauri::AppHandle;

/// List the rules, change the person's taste, add or remove their tools
#[tauri::command]
pub async fn rules(handle: AppHandle, action: String, id: Option<String>, text: Option<String>, name: Option<String>, file: Option<String>, track: Option<String>, on: Option<bool>) -> Result<Value, String> {
    blocking(move || {
        let id = id.unwrap_or_default();
        let args = match action.as_str() {
            "list" => Args::new(["rules", "list"]),
            "edit" => Args::new(["rules", "edit"]).arg(id).opt("--text", text),
            "remove" => Args::new(["rules", "remove"]).arg(id),
            "reset" => Args::new(["rules", "reset"]).arg(id),
            "switch" => Args::new(["rules", "switch"]).arg(id).flag(on == Some(false), "--off"),
            "add" => Args::new(["rules", "add"]).opt("--text", text).opt("--track", track),
            "add-tool" => Args::new(["rules", "add-tool"]).opt("--name", name).opt("--text", text).opt("--file", file).opt("--track", track),
            "remove-tool" => Args::new(["rules", "remove-tool"]).arg(id),
            _ => return Err(format!("unknown rules action {action}")),
        };
        engine(&handle, args)
    })
    .await
}

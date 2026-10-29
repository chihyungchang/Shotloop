//! User settings, stored as JSON in the app's config folder. The API key
//! is the user's own and is passed only to the agent sidecar.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub api_key: String,
    /// Blender binary, if not in /Applications
    pub blender: String,
    /// Chrome or headless shell binary, if not in /Applications
    pub chrome: String,
}

pub fn load(dir: &PathBuf) -> Settings {
    std::fs::read_to_string(dir.join("settings.json"))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(dir: &PathBuf, settings: &Settings) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let file = dir.join("settings.json");
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(&file, json).map_err(|e| e.to_string())?;
    // The file holds an API key: readable by the user only
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

impl Settings {
    /// Environment variables for child processes
    pub fn env(&self) -> Vec<(String, String)> {
        let mut env = Vec::new();
        if !self.blender.is_empty() {
            env.push(("BLENDER".into(), self.blender.clone()));
        }
        if !self.chrome.is_empty() {
            env.push(("CHROME".into(), self.chrome.clone()));
        }
        env
    }
}

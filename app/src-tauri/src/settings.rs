//! User settings, stored as JSON in the app's config folder. The agent's
//! backend (Anthropic API, a local CLI agent or a local model) and its
//! keys are the user's own and are passed only to the agent sidecar.

use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// Agent backend: "anthropic" (default), "cli" or "local"
    pub provider: String,
    pub api_key: String,
    /// cli: "claude", "codex" or "gemini"
    pub cli: String,
    /// anthropic or cli: a model name; empty for the default
    pub model: String,
    /// local: OpenAI-compatible base URL (…/v1), model, optional key
    pub local_url: String,
    pub local_model: String,
    pub local_key: String,
    /// Blender binary, if not in /Applications
    pub blender: String,
    /// Chrome or headless shell binary, if not in /Applications
    pub chrome: String,
}

pub fn load(dir: &Path) -> Settings {
    std::fs::read_to_string(dir.join("settings.json"))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(dir: &Path, settings: &Settings) -> Result<(), String> {
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
    /// Only the Anthropic backend needs an API key
    pub fn needs_key(&self) -> bool {
        self.provider.is_empty() || self.provider == "anthropic"
    }

    /// Environment variables for child processes
    pub fn env(&self) -> Vec<(String, String)> {
        let mut env = Vec::new();
        let provider = if self.provider.is_empty() { "anthropic" } else { &self.provider };
        env.push(("SHOTLOOP_PROVIDER".into(), provider.into()));
        for (k, v) in [
            ("SHOTLOOP_CLI", &self.cli),
            ("SHOTLOOP_MODEL", &self.model),
            ("SHOTLOOP_LOCAL_URL", &self.local_url),
            ("SHOTLOOP_LOCAL_MODEL", &self.local_model),
            ("SHOTLOOP_LOCAL_KEY", &self.local_key),
        ] {
            if !v.is_empty() {
                env.push((k.into(), v.clone()));
            }
        }
        if !self.blender.is_empty() {
            env.push(("BLENDER".into(), self.blender.clone()));
        }
        if !self.chrome.is_empty() {
            env.push(("CHROME".into(), self.chrome.clone()));
        }
        env
    }
}

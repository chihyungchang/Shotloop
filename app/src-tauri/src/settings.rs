//! User settings, stored as JSON in the app's config folder. The agent's
//! backend (Anthropic API, a local CLI agent or a local model) and its
//! keys are the user's own and are passed only to the agent sidecar.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// Agent backend: "api" (default), "cli" or "local"
    pub provider: String,
    /// api: the preset (anthropic, openai, deepseek…, custom), its
    /// protocol ("anthropic" or "openai") and base URL (empty: Anthropic's)
    pub api_preset: String,
    pub api_protocol: String,
    pub api_url: String,
    /// api: the user's key for each preset, so switching keeps them
    pub api_keys: BTreeMap<String, String>,
    /// The Anthropic key of older settings; moved into api_keys on load
    #[serde(skip_serializing)]
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
    /// A sound and a desktop notification when the queue runs dry
    pub notify_sound: bool,
    pub notify_desktop: bool,
}

pub fn load(dir: &Path) -> Settings {
    let mut s: Settings = std::fs::read_to_string(dir.join("settings.json"))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    // Older settings: "anthropic" with one key is the Anthropic preset
    if s.provider.is_empty() || s.provider == "anthropic" {
        s.provider = "api".into();
    }
    if s.api_preset.is_empty() {
        s.api_preset = "anthropic".into();
        s.api_protocol = "anthropic".into();
    }
    if !s.api_key.is_empty() {
        s.api_keys.entry("anthropic".into()).or_insert(std::mem::take(&mut s.api_key));
    }
    s
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
    fn is_api(&self) -> bool {
        !matches!(self.provider.as_str(), "cli" | "local")
    }

    /// The key for the chosen API preset; only the agent gets it
    pub fn api_key(&self) -> String {
        if !self.is_api() {
            return String::new();
        }
        self.api_keys.get(&self.api_preset).cloned().unwrap_or_default()
    }

    /// Hosted APIs need a key; a server on this machine does not
    pub fn needs_key(&self) -> bool {
        let loopback = ["://localhost", "://127.0.0.1", "://[::1]"].iter().any(|h| self.api_url.contains(h));
        self.is_api() && !loopback
    }

    /// Environment variables for child processes
    pub fn env(&self) -> Vec<(String, String)> {
        let mut env = Vec::new();
        let provider = if self.is_api() { "api" } else { &self.provider };
        env.push(("SHOTLOOP_PROVIDER".into(), provider.into()));
        let api = |v: &String| if self.is_api() { v.clone() } else { String::new() };
        for (k, v) in [
            ("SHOTLOOP_API_PROTOCOL", &api(&self.api_protocol)),
            ("SHOTLOOP_API_URL", &api(&self.api_url)),
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

#[cfg(test)]
mod tests {
    use super::*;

    fn temp() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("shotloop-settings-{}-{:?}", std::process::id(), std::thread::current().id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn older_anthropic_settings_become_the_anthropic_preset() {
        let dir = temp();
        std::fs::write(dir.join("settings.json"), r#"{"provider":"anthropic","apiKey":"sk-ant-1"}"#).unwrap();
        let s = load(&dir);
        assert_eq!(s.provider, "api");
        assert_eq!(s.api_preset, "anthropic");
        assert_eq!(s.api_key(), "sk-ant-1");
        assert!(s.needs_key());
        let env = s.env();
        assert!(env.contains(&("SHOTLOOP_PROVIDER".into(), "api".into())));
        assert!(env.contains(&("SHOTLOOP_API_PROTOCOL".into(), "anthropic".into())));
        // Saved again, the old field is gone and the key lives under the preset
        save(&dir, &s).unwrap();
        let json = std::fs::read_to_string(dir.join("settings.json")).unwrap();
        assert!(!json.contains("\"apiKey\""));
        assert!(json.contains("\"anthropic\": \"sk-ant-1\""));
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn keys_stay_per_preset_and_local_servers_need_none() {
        let mut s = Settings { provider: "api".into(), api_preset: "deepseek".into(), api_protocol: "openai".into(), ..Default::default() };
        s.api_keys.insert("anthropic".into(), "a".into());
        s.api_keys.insert("deepseek".into(), "d".into());
        assert_eq!(s.api_key(), "d");
        s.api_url = "http://localhost:8000/v1".into();
        assert!(!s.needs_key());
        s.provider = "cli".into();
        assert_eq!(s.api_key(), "");
        assert!(!s.env().iter().any(|(k, _)| k == "SHOTLOOP_API_URL"));
    }
}

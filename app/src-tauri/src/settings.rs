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
    /// Asset library sources: the person's own keys
    pub polypizza_key: String,
    pub smithsonian_key: String,
    /// Shots the AI builds at the same time, 1–5; 0 picks by the machine
    pub parallel: u32,
}

/// This Mac: logical cores and memory, and the shots to build at once
/// that it handles well (each is a CLI agent, its tool server and, while
/// it renders, a headless Chrome: about 0.6 GB)
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Machine {
    pub cores: u32,
    pub memory_gb: u32,
    pub auto_parallel: u32,
}

pub fn machine() -> Machine {
    let cores = std::thread::available_parallelism().map(|n| n.get() as u32).unwrap_or(4);
    let memory_gb = std::process::Command::new("/usr/sbin/sysctl")
        .args(["-n", "hw.memsize"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.trim().parse::<u64>().ok())
        .map(|b| (b / (1 << 30)) as u32)
        .unwrap_or(8);
    let auto_parallel = match (cores, memory_gb) {
        (c, m) if c >= 10 && m >= 16 => 5,
        (c, m) if c >= 8 && m >= 16 => 4,
        (_, m) if m >= 8 => 3,
        _ => 2,
    };
    Machine { cores, memory_gb, auto_parallel }
}

pub fn load(dir: &Path) -> Settings {
    let Some(text) = std::fs::read_to_string(dir.join("settings.json")).ok() else {
        return first_run();
    };
    let mut s: Settings = serde_json::from_str(&text).unwrap_or_default();
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
    // The file holds API keys: readable by the user only, from the start
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
        let mut f = std::fs::OpenOptions::new().write(true).create(true).truncate(true).mode(0o600).open(&file).map_err(|e| e.to_string())?;
        let _ = std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o600));
        f.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
    }
    #[cfg(not(unix))]
    std::fs::write(&file, json).map_err(|e| e.to_string())?;
    Ok(())
}

/// No settings yet: Claude Code if this Mac has it (it works without a
/// key), else the Anthropic preset waiting for one
fn first_run() -> Settings {
    if crate::env::find_tool("claude").is_some() {
        return Settings { provider: "cli".into(), cli: "claude".into(), ..Default::default() };
    }
    Settings { provider: "api".into(), api_preset: "anthropic".into(), api_protocol: "anthropic".into(), ..Default::default() }
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
        // A custom endpoint may need no key (a gateway on the network)
        self.is_api() && !loopback && self.api_preset != "custom"
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
        let parallel = if (1..=5).contains(&self.parallel) { self.parallel } else { machine().auto_parallel };
        env.push(("SHOTLOOP_PARALLEL".into(), parallel.to_string()));
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

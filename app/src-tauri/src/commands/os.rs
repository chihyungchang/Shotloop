//! Handing things to macOS: a file shown in Finder, a file opened in its
//! app, a web page opened in the browser. Each only for what the app
//! shows, so a page in the webview can't use them to start anything else.

use std::collections::HashSet;
use std::path::Path;
use std::sync::OnceLock;

#[tauri::command]
pub fn reveal(path: String) -> Result<(), String> {
    tauri_plugin_opener::reveal_item_in_dir(path).map_err(|e| e.to_string())
}

/// What the app hands to other apps: folders, and the media and documents
/// it makes or shows (films, sound, images, the publish copy)
const OPENABLE: [&str; 14] = ["mp4", "mov", "m4a", "wav", "mp3", "png", "jpg", "jpeg", "webp", "gif", "pdf", "txt", "md", "json"];

fn openable(path: &Path) -> bool {
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
    path.is_dir() || (OPENABLE.contains(&ext.as_str()) && path.is_file())
}

#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    if !openable(Path::new(&path)) {
        return Err("only folders, media and documents can be opened".into());
    }
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|e| e.to_string())
}

/// The sites the app links to, with their subdomains: the AI providers'
/// key pages (src/ai/presets.ts) and the CLI agents' (agent/src/cli.ts),
/// the asset sources and their key pages, Blender's download page, the
/// project's own pages. The licenses page adds its links' sites
/// (licenses_hosts)
const SITES: [&str; 23] = [
    "anthropic.com",
    "platform.openai.com",
    "aistudio.google.com",
    "openrouter.ai",
    "console.x.ai",
    "console.mistral.ai",
    "api.together.ai",
    "platform.deepseek.com",
    "bailian.console.aliyun.com",
    "platform.moonshot.cn",
    "open.bigmodel.cn",
    "platform.minimaxi.com",
    "console.volcengine.com",
    "cloud.siliconflow.cn",
    "poly.pizza",
    "api.data.gov",
    // Smithsonian records link to their pages and persistent ids
    "si.edu",
    "n2t.net",
    "blender.org",
    "github.com",
    "oliverz.dev",
    "huggingface.co",
    "modelscope.cn",
];

/// The sites of the links on Settings → About's licenses, read from the
/// same file the page shows (src/licenses.json, made by scripts/licenses.mjs)
fn licenses_hosts() -> &'static HashSet<String> {
    static HOSTS: OnceLock<HashSet<String>> = OnceLock::new();
    HOSTS.get_or_init(|| {
        let licenses: serde_json::Value = serde_json::from_str(include_str!("../../../src/licenses.json")).unwrap_or_default();
        licenses["groups"]
            .as_array()
            .into_iter()
            .flatten()
            .flat_map(|g| g["items"].as_array().into_iter().flatten())
            .filter_map(|i| i["url"].as_str().and_then(https_host))
            .collect()
    })
}

/// The host of an https link; none for anything else, or a link with a
/// user name in it (`https://site@elsewhere`)
fn https_host(url: &str) -> Option<String> {
    let rest = url.strip_prefix("https://")?;
    let authority = rest.split(['/', '?', '#']).next()?;
    if authority.contains('@') {
        return None;
    }
    let host = authority.split(':').next()?.to_ascii_lowercase();
    (!host.is_empty()).then_some(host)
}

fn linkable(url: &str) -> bool {
    let Some(host) = https_host(url) else { return false };
    let on = |site: &str| host == site || host.ends_with(&format!(".{site}"));
    SITES.iter().any(|s| on(s)) || licenses_hosts().contains(&host)
}

/// A web page the app links to (a provider's key page, a license, an
/// asset's source page, Blender's download page)
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    if !linkable(&url) {
        return Err(format!("{url} is not a page Shotloop links to"));
    }
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_only_folders_media_and_documents() {
        let dir = std::env::temp_dir().join(format!("shotloop-open-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        for f in ["film.MP4", "copy.md", "run.sh", "Tool.app", "x.command", "noext"] {
            std::fs::write(dir.join(f), "").unwrap();
        }
        assert!(openable(&dir));
        assert!(openable(&dir.join("film.MP4")));
        assert!(openable(&dir.join("copy.md")));
        for f in ["run.sh", "Tool.app", "x.command", "noext", "missing.mp4"] {
            assert!(!openable(&dir.join(f)), "{f}");
        }
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn links_only_to_the_sites_the_app_names() {
        assert!(linkable("https://www.blender.org/download/"));
        assert!(linkable("https://console.anthropic.com/settings/keys"));
        assert!(linkable("https://github.com/chihyungchang/Shotloop/releases"));
        assert!(linkable("https://collections.si.edu/search/detail/x"));
        assert!(!linkable("http://www.blender.org/"));
        assert!(!linkable("https://evil.example/"));
        assert!(!linkable("https://github.com.evil.example/"));
        assert!(!linkable("https://github.com@evil.example/"));
        assert!(!linkable("file:///etc/passwd"));
        assert_eq!(https_host("https://Poly.Pizza:443/m/1"), Some("poly.pizza".into()));
        // A license's site, from licenses.json
        assert!(licenses_hosts().iter().all(|h| linkable(&format!("https://{h}/"))));
        assert!(!licenses_hosts().is_empty());
    }
}

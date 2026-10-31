//! Where the engine, the agent and their tools live, and the environment
//! child processes run in. Apps started from Finder get a minimal PATH,
//! so Node, ffmpeg and Homebrew tools are looked up explicitly.

use std::path::{Path, PathBuf};
use std::process::Command;

/// The Shotloop checkout holding `engine/` and `agent/`: $SHOTLOOP_ROOT,
/// the bundled resources, or the repository this app was built from.
pub fn repo_root(resource_dir: Option<PathBuf>) -> PathBuf {
    if let Ok(root) = std::env::var("SHOTLOOP_ROOT") {
        return PathBuf::from(root);
    }
    if let Some(dir) = resource_dir {
        if dir.join("engine/shotloop/cli.mjs").exists() {
            return dir;
        }
    }
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.."))
}

fn home() -> PathBuf {
    std::env::var("HOME").map(PathBuf::from).unwrap_or_default()
}

/// `<dir>/<version><suffix>` for each installed version, newest first
fn versions(dir: PathBuf, suffix: &str) -> Vec<PathBuf> {
    let key = |p: &PathBuf| -> Vec<u32> {
        let name = p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        name.trim_start_matches('v').split('.').map(|n| n.parse().unwrap_or(0)).collect()
    };
    let mut found: Vec<PathBuf> = std::fs::read_dir(dir).map(|e| e.flatten().map(|e| e.path()).collect()).unwrap_or_default();
    found.sort_by_key(|p| std::cmp::Reverse(key(p)));
    found.into_iter().map(|p| p.join(suffix)).collect()
}

/// Extra folders searched for tools, before the inherited PATH: Homebrew,
/// then Node version managers (fnm, nvm, Volta, mise, asdf)
fn tool_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![home().join(".local/bin"), PathBuf::from("/opt/homebrew/bin"), PathBuf::from("/usr/local/bin")];
    let fnm = std::env::var("FNM_DIR").map(PathBuf::from).ok().into_iter().chain([
        home().join(".local/share/fnm"),
        home().join("Library/Application Support/fnm"),
        home().join(".fnm"),
    ]);
    for dir in fnm {
        dirs.push(dir.join("aliases/default/bin"));
        dirs.extend(versions(dir.join("node-versions"), "installation/bin"));
    }
    dirs.extend(versions(home().join(".nvm/versions/node"), "bin"));
    dirs.push(home().join(".volta/bin"));
    dirs.extend(versions(home().join(".local/share/mise/installs/node"), "bin"));
    dirs.extend(versions(home().join(".asdf/installs/nodejs"), "bin"));
    dirs
}

/// A tool on this Mac: the tool folders, then PATH
pub fn find_tool(name: &str) -> Option<PathBuf> {
    let path = std::env::var("PATH").unwrap_or_default();
    tool_dirs().into_iter().chain(path.split(':').map(PathBuf::from)).map(|d| d.join(name)).find(|p| p.is_file())
}

/// One of the app's own binaries (Tauri sidecars sit next to the main
/// executable): Node and ffmpeg in a bundled build, none in dev
pub fn bundled(name: &str) -> Option<PathBuf> {
    let path = std::env::current_exe().ok()?.parent()?.join(name);
    path.is_file().then_some(path)
}

/// PATH for child processes: the bundled ffmpeg's folder, the tool
/// folders, then the inherited PATH
pub fn child_path() -> String {
    let mut parts: Vec<String> = bundled("ffmpeg").and_then(|f| f.parent().map(|d| d.display().to_string())).into_iter().collect();
    parts.extend(tool_dirs().iter().map(|d| d.display().to_string()));
    if let Ok(path) = std::env::var("PATH") {
        parts.push(path);
    }
    parts.join(":")
}

fn node_version(node: &Path) -> Option<u32> {
    let out = Command::new(node).arg("--version").output().ok()?;
    let v = String::from_utf8_lossy(&out.stdout);
    v.trim().trim_start_matches('v').split('.').next()?.parse().ok()
}

/// A Node.js new enough for the engine (23+) and the agent's TypeScript
/// (type stripping, 22.18+ / 23.6+): $SHOTLOOP_NODE, the bundled one, or
/// the first match
pub fn node() -> Result<PathBuf, String> {
    if let Ok(node) = std::env::var("SHOTLOOP_NODE") {
        return Ok(PathBuf::from(node));
    }
    if let Some(node) = bundled("node") {
        return Ok(node);
    }
    let mut candidates: Vec<PathBuf> = tool_dirs().iter().map(|d| d.join("node")).collect();
    if let Ok(path) = std::env::var("PATH") {
        candidates.extend(path.split(':').map(|d| Path::new(d).join("node")));
    }
    // Last, whatever the user's own shell finds (any other version manager)
    candidates.extend(shell_node());
    candidates
        .into_iter()
        .filter(|c| c.exists())
        .find(|c| node_version(c).is_some_and(|v| v >= 23))
        .ok_or_else(|| "Node.js 23 or newer not found (brew install node, or set SHOTLOOP_NODE)".into())
}

/// `node` as the user's interactive login shell resolves it
fn shell_node() -> Option<PathBuf> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let out = Command::new(shell)
        .args(["-ilc", "command -v node"])
        .stdin(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    text.lines().map(str::trim).rev().find(|l| l.starts_with('/')).map(PathBuf::from)
}

fn copy_dir(from: &Path, to: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(to)?;
    for entry in std::fs::read_dir(from)? {
        let entry = entry?;
        let dest = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &dest)?;
        } else {
            std::fs::copy(entry.path(), dest)?;
        }
    }
    Ok(())
}

/// An example's files, render cache and exports aside, as one hash
fn example_hash(dir: &Path) -> Option<u64> {
    use std::hash::{Hash, Hasher};
    fn walk(dir: &Path, base: &Path, h: &mut std::collections::hash_map::DefaultHasher) -> std::io::Result<()> {
        let mut entries: Vec<_> = std::fs::read_dir(dir)?.flatten().collect();
        entries.sort_by_key(|e| e.file_name());
        for e in entries {
            let name = e.file_name();
            if name == ".shotloop" || name == "out" {
                continue;
            }
            let path = e.path();
            if e.file_type()?.is_dir() {
                walk(&path, base, h)?;
            } else {
                path.strip_prefix(base).unwrap_or(&path).hash(h);
                std::fs::read(&path)?.hash(h);
            }
        }
        Ok(())
    }
    let mut h = std::collections::hash_map::DefaultHasher::new();
    walk(dir, dir, &mut h).ok()?;
    Some(h.finish())
}

/// The bundled examples, copied to a writable folder: opening a project
/// writes its render cache into it, and the app bundle is read-only.
/// The folder follows the bundle: new examples are added, ones the bundle
/// changed (any file but the render cache) are copied again, and ones it
/// no longer has go. An unchanged example keeps the renders made in it.
pub fn seed_examples(bundled: &Path, dest: &Path) {
    let Ok(entries) = std::fs::read_dir(bundled) else { return };
    let config = |dir: &Path| example_hash(dir);
    let mut kept = std::collections::HashSet::new();
    for entry in entries.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        kept.insert(entry.file_name());
        let to = dest.join(entry.file_name());
        if to.exists() && config(&entry.path()) == config(&to) {
            continue;
        }
        let _ = std::fs::remove_dir_all(&to);
        if let Err(e) = copy_dir(&entry.path(), &to) {
            eprintln!("shotloop: could not copy example {}: {e}", entry.path().display());
            let _ = std::fs::remove_dir_all(&to);
        }
    }
    // Examples the bundle no longer has
    let Ok(old) = std::fs::read_dir(dest) else { return };
    for entry in old.flatten() {
        let path = entry.path();
        if path.is_dir() && !kept.contains(&entry.file_name()) && path.join("shotloop.json").exists() {
            let _ = std::fs::remove_dir_all(&path);
        }
    }
}

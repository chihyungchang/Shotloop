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

/// Extra folders searched for tools, before the inherited PATH
fn tool_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![
        home().join(".local/bin"),
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
        home().join(".volta/bin"),
    ];
    // nvm installs, newest version first
    if let Ok(entries) = std::fs::read_dir(home().join(".nvm/versions/node")) {
        let mut versions: Vec<PathBuf> = entries.flatten().map(|e| e.path().join("bin")).collect();
        versions.sort();
        versions.reverse();
        dirs.extend(versions);
    }
    dirs
}

/// PATH for child processes: the tool folders, then the inherited PATH
pub fn child_path() -> String {
    let mut parts: Vec<String> = tool_dirs().iter().map(|d| d.display().to_string()).collect();
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

/// A Node.js new enough for the engine (22+) and the agent's TypeScript
/// (type stripping, 22.18+ / 23.6+): $SHOTLOOP_NODE or the first match
pub fn node() -> Result<PathBuf, String> {
    if let Ok(node) = std::env::var("SHOTLOOP_NODE") {
        return Ok(PathBuf::from(node));
    }
    let mut candidates: Vec<PathBuf> = tool_dirs().iter().map(|d| d.join("node")).collect();
    if let Ok(path) = std::env::var("PATH") {
        candidates.extend(path.split(':').map(|d| Path::new(d).join("node")));
    }
    candidates
        .into_iter()
        .filter(|c| c.exists())
        .find(|c| node_version(c).is_some_and(|v| v >= 23))
        .ok_or_else(|| "Node.js 23 or newer not found (brew install node, or set SHOTLOOP_NODE)".into())
}

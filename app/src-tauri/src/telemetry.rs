//! Anonymous usage counts (on by default, told on first launch, off in
//! Settings): how many films were planned, built, fixed and exported
//! since the last report, and the styles of the exported ones. Kept in
//! telemetry.json next to the settings with a random install id
//! (usage.json there is the AI subscription's limits, queue.rs); the UI sends
//! a report about once a day (every 20 hours at most, src/telemetry.ts). Nothing about a project's
//! content, names, paths or keys is ever counted.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// The jobs worth counting: a film planned, its shots built, a shot fixed,
/// a film exported
const COUNTED: [&str; 4] = ["plan", "build", "fix", "export"];
/// A report at most this often (seconds)
const EVERY: u64 = 20 * 3600;
const FILE: &str = "telemetry.json";

#[derive(Serialize, Deserialize, Default, Clone, PartialEq, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Counts {
    pub jobs: BTreeMap<String, u32>,
    /// Exported films by visual style ("3d" for the 3D track)
    pub styles: BTreeMap<String, u32>,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct Usage {
    id: String,
    /// When the last report was sent (Unix seconds)
    sent: u64,
    counts: Counts,
}

/// What the UI sends: the install id, this build and Mac, and the counts
#[derive(Serialize, PartialEq, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub id: String,
    pub version: String,
    pub arch: String,
    pub counts: Counts,
}

// The queue's threads and the UI's commands both write the file
static LOCK: Mutex<()> = Mutex::new(());

fn secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

/// A random install id: 128 bits from the standard library's randomly
/// keyed hashers; it identifies this install only, never the person
fn new_id() -> String {
    use std::hash::{BuildHasher, Hasher};
    let half = || std::collections::hash_map::RandomState::new().build_hasher().finish();
    format!("{:016x}{:016x}", half(), half())
}

fn load(dir: &Path) -> Usage {
    let mut u: Usage = std::fs::read_to_string(dir.join(FILE)).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
    if u.id.len() != 32 {
        u.id = new_id();
    }
    u
}

// Written under a temporary name and renamed, so a crash never leaves half a file
fn save(dir: &Path, u: &Usage) {
    let tmp = dir.join(format!("{FILE}.tmp"));
    let ok = std::fs::create_dir_all(dir).is_ok()
        && serde_json::to_vec_pretty(u).ok().is_some_and(|json| std::fs::write(&tmp, json).is_ok());
    if ok {
        let _ = std::fs::rename(&tmp, dir.join(FILE));
    }
}

/// The style a project's film is made in, from its shotloop.json
fn style_of(project: &Path) -> String {
    let config: serde_json::Value = std::fs::read_to_string(project.join("shotloop.json")).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
    if config["track"] == "3d" {
        return "3d".into();
    }
    config["style"].as_str().filter(|s| s.len() <= 20).unwrap_or("infographic").into()
}

/// A finished job: counted when the counts are on and it is one of
/// COUNTED (a lost count is harmless, so a write that fails is let go)
pub fn count(dir: &Path, on: bool, kind: &str, project: &Path) {
    if !on || !COUNTED.contains(&kind) {
        return;
    }
    let _guard = LOCK.lock().unwrap();
    let mut u = load(dir);
    *u.counts.jobs.entry(kind.into()).or_default() += 1;
    if kind == "export" {
        *u.counts.styles.entry(style_of(project)).or_default() += 1;
    }
    save(dir, &u);
}

/// The report due now, if one is: none while the counts are off, in a
/// development build, or within a day of the last
pub fn due(dir: &Path, on: bool, version: &str) -> Option<Report> {
    if !on || cfg!(debug_assertions) || std::env::var("SHOTLOOP_USAGE").as_deref() == Ok("0") {
        return None;
    }
    let _guard = LOCK.lock().unwrap();
    let u = load(dir);
    // The first launch stores the id, so even an idle install reports
    save(dir, &u);
    (secs().saturating_sub(u.sent) >= EVERY).then(|| Report {
        id: u.id.clone(),
        version: version.into(),
        arch: std::env::consts::ARCH.into(),
        counts: u.counts.clone(),
    })
}

/// A report arrived: its counts are taken off (jobs that finished while
/// it was on its way stay for the next one)
pub fn sent(dir: &Path, counts: &Counts) {
    let _guard = LOCK.lock().unwrap();
    let mut u = load(dir);
    for (map, done) in [(&mut u.counts.jobs, &counts.jobs), (&mut u.counts.styles, &counts.styles)] {
        for (k, n) in done {
            if let Some(v) = map.get_mut(k) {
                *v = v.saturating_sub(*n);
            }
        }
        map.retain(|_, v| *v > 0);
    }
    u.sent = secs();
    save(dir, &u);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("shotloop-telemetry-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn counts_jobs_and_export_styles_and_takes_off_what_was_sent() {
        let dir = temp("counts");
        let project = dir.join("film");
        std::fs::create_dir_all(&project).unwrap();
        std::fs::write(project.join("shotloop.json"), r#"{"track":"2d","style":"news"}"#).unwrap();
        count(&dir, true, "render", &project);
        count(&dir, true, "export", &project);
        count(&dir, true, "export", &project);
        count(&dir, true, "plan", &project);
        // Off: nothing is counted
        count(&dir, false, "export", &project);
        let u = load(&dir);
        assert_eq!(u.counts.jobs.get("export"), Some(&2));
        assert_eq!(u.counts.jobs.get("render"), None);
        assert_eq!(u.counts.styles.get("news"), Some(&2));
        // One export was in the report; one more finished on the way
        let mut reported = u.counts.clone();
        reported.jobs.insert("export".into(), 1);
        reported.styles.insert("news".into(), 1);
        sent(&dir, &reported);
        let after = load(&dir);
        assert_eq!(after.id, u.id);
        assert_eq!(after.id.len(), 32);
        assert_ne!(new_id(), new_id());
        assert_eq!(after.counts.jobs.get("export"), Some(&1));
        assert_eq!(after.counts.jobs.get("plan"), None);
        assert!(after.sent > 0);
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn no_report_in_a_development_build_or_when_off() {
        let dir = temp("due");
        assert_eq!(due(&dir, false, "1.0.0"), None);
        // Tests are a development build: never a report
        assert_eq!(due(&dir, true, "1.0.0"), None);
        std::fs::remove_dir_all(dir).ok();
    }
}

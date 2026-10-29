//! The render queue (docs/PRD.md §7.7). Jobs run in lanes, one job at a
//! time per lane: `render` for shot renders and exports (one shot at a
//! time, so a final render runs in the background while the person keeps
//! working) and `agent` for fixes, checks and publish copy.
//!
//! Every job is a child process (the engine CLI or the agent sidecar)
//! that prints one JSON event per line; the queue keeps the latest
//! progress, a log tail and the result, and emits `queue` to the UI on
//! every change.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use std::path::PathBuf;
use std::os::unix::process::CommandExt;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Condvar, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

pub const LANES: [&str; 2] = ["render", "agent"];
const LOG_LINES: usize = 80;

/// What the UI asks for
#[derive(Deserialize, Clone, Debug)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Spec {
    Render { project: String, shot: String, mode: String, stills: bool },
    Export { project: String, mode: String, aspects: Vec<String> },
    Fix { project: String, shot: String, request: String, lang: Option<String> },
    Check { project: String, shot: String, lang: Option<String> },
    Publish { project: String, lang: Option<String> },
    /// Copy and storyboard (storyboard.json), or a revision of them
    Plan { project: String, request: Option<String>, lang: Option<String> },
    /// The world and every shot, from the applied storyboard
    Build { project: String, lang: Option<String> },
}

impl Spec {
    fn lane(&self) -> &'static str {
        match self {
            Spec::Render { .. } | Spec::Export { .. } => "render",
            _ => "agent",
        }
    }

    fn project(&self) -> &str {
        match self {
            Spec::Render { project, .. }
            | Spec::Export { project, .. }
            | Spec::Fix { project, .. }
            | Spec::Check { project, .. }
            | Spec::Publish { project, .. }
            | Spec::Plan { project, .. }
            | Spec::Build { project, .. } => project,
        }
    }

    fn shot(&self) -> Option<String> {
        match self {
            Spec::Render { shot, .. } | Spec::Fix { shot, .. } | Spec::Check { shot, .. } => Some(shot.clone()),
            _ => None,
        }
    }

    fn label(&self) -> String {
        match self {
            Spec::Render { shot, mode, stills, .. } => {
                format!("{} {} {}", if *stills { "Stills" } else { "Render" }, shot, mode)
            }
            Spec::Export { mode, aspects, .. } => format!("Export {} ({})", mode, aspects.join(", ")),
            Spec::Fix { shot, request, .. } => format!("Fix {}: {}", shot, request),
            Spec::Check { shot, .. } => format!("Check {}", shot),
            Spec::Publish { .. } => "Write publish copy".into(),
            Spec::Plan { request: Some(r), .. } => format!("Plan: {}", r),
            Spec::Plan { .. } => "Plan the copy and storyboard".into(),
            Spec::Build { .. } => "Build the shots".into(),
        }
    }

    /// (script relative to the repo root, arguments)
    fn command(&self) -> (&'static str, Vec<String>) {
        let s = |x: &str| x.to_string();
        match self {
            Spec::Render { project, shot, mode, stills } => {
                let mut a = vec![s("render"), project.clone(), s("--shot"), shot.clone()];
                if mode == "final" {
                    a.push(s("--final"));
                }
                if *stills {
                    a.push(s("--stills"));
                }
                ("engine/shotloop/cli.mjs", a)
            }
            Spec::Export { project, mode, aspects } => {
                let mut a = vec![s("export"), project.clone(), s("--aspect"), aspects.join(",")];
                if mode == "draft" {
                    a.push(s("--draft"));
                }
                ("engine/shotloop/cli.mjs", a)
            }
            Spec::Fix { project, shot, request, lang } => {
                let mut a = vec![s("fix"), project.clone(), s("--shot"), shot.clone(), s("--request"), request.clone()];
                if let Some(l) = lang {
                    a.extend([s("--lang"), l.clone()]);
                }
                ("agent/src/main.ts", a)
            }
            Spec::Check { project, shot, lang } => {
                let mut a = vec![s("check"), project.clone(), s("--shot"), shot.clone()];
                if let Some(l) = lang {
                    a.extend([s("--lang"), l.clone()]);
                }
                ("agent/src/main.ts", a)
            }
            Spec::Publish { project, lang } => {
                let mut a = vec![s("publish"), project.clone()];
                if let Some(l) = lang {
                    a.extend([s("--lang"), l.clone()]);
                }
                ("agent/src/main.ts", a)
            }
            Spec::Plan { project, request, lang } => {
                let mut a = vec![s("plan"), project.clone()];
                if let Some(r) = request {
                    a.extend([s("--request"), r.clone()]);
                }
                if let Some(l) = lang {
                    a.extend([s("--lang"), l.clone()]);
                }
                ("agent/src/main.ts", a)
            }
            Spec::Build { project, lang } => {
                let mut a = vec![s("build"), project.clone()];
                if let Some(l) = lang {
                    a.extend([s("--lang"), l.clone()]);
                }
                ("agent/src/main.ts", a)
            }
        }
    }

    fn same_as(&self, other: &Spec) -> bool {
        match (self, other) {
            (
                Spec::Render { project: p1, shot: s1, mode: m1, stills: x1 },
                Spec::Render { project: p2, shot: s2, mode: m2, stills: x2 },
            ) => p1 == p2 && s1 == s2 && m1 == m2 && x1 == x2,
            _ => false,
        }
    }
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub stage: String,
    pub done: u64,
    pub total: u64,
    pub eta: Option<f64>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: u64,
    pub kind: String,
    pub lane: String,
    pub label: String,
    pub project: String,
    pub shot: Option<String>,
    pub mode: Option<String>,
    pub state: String,
    pub progress: Option<Progress>,
    pub log: Vec<String>,
    /// When the last log line came in: a long silence is the AI thinking
    pub log_at: Option<u64>,
    pub result: Option<Value>,
    pub error: Option<String>,
    pub created_at: u64,
    pub started_at: Option<u64>,
    pub finished_at: Option<u64>,
    #[serde(skip)]
    spec: Option<Spec>,
}

/// How child processes are started; set by the app at launch and on
/// settings changes
#[derive(Clone, Default)]
pub struct Launch {
    pub root: PathBuf,
    pub node: Option<PathBuf>,
    pub path: String,
    pub env: Vec<(String, String)>,
    pub api_key: String,
    pub needs_key: bool,
    /// Alerts when the queue runs dry (Settings → General)
    pub notify_sound: bool,
    pub notify_desktop: bool,
}

#[derive(Default)]
struct Inner {
    jobs: Vec<Job>,
    next_id: u64,
    children: HashMap<u64, Arc<Mutex<Child>>>,
    pids: HashMap<u64, u32>,
    // When the queue last went from idle to busy: the batch the
    // finished alert sums up
    batch_start: Option<u64>,
}

pub struct Queue {
    inner: Mutex<Inner>,
    wake: Condvar,
    pub launch: Mutex<Launch>,
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

impl Queue {
    pub fn new() -> Arc<Self> {
        Arc::new(Queue {
            inner: Mutex::new(Inner { next_id: 1, ..Default::default() }),
            wake: Condvar::new(),
            launch: Mutex::new(Launch::default()),
        })
    }

    pub fn start(self: &Arc<Self>, app: AppHandle) {
        for lane in LANES {
            let q = self.clone();
            let app = app.clone();
            std::thread::spawn(move || q.worker(lane, app));
        }
    }

    pub fn list(&self) -> Vec<Job> {
        self.inner.lock().unwrap().jobs.clone()
    }

    fn notify(&self, app: &AppHandle) {
        let jobs = self.list();
        let active = jobs.iter().filter(|j| matches!(j.state.as_str(), "queued" | "running")).count();
        crate::tray::set_count(app, active);
        let _ = app.emit("queue", jobs);
    }

    /// Adds a job; a render already queued or running is not added twice
    pub fn enqueue(&self, app: &AppHandle, spec: Spec) -> u64 {
        let id = {
            let mut inner = self.inner.lock().unwrap();
            if let Some(j) = inner.jobs.iter().find(|j| {
                matches!(j.state.as_str(), "queued" | "running")
                    && j.spec.as_ref().is_some_and(|s| s.same_as(&spec))
            }) {
                return j.id;
            }
            let id = inner.next_id;
            inner.next_id += 1;
            let mode = match &spec {
                Spec::Render { mode, .. } | Spec::Export { mode, .. } => Some(mode.clone()),
                _ => None,
            };
            let kind = match &spec {
                Spec::Render { .. } => "render",
                Spec::Export { .. } => "export",
                Spec::Fix { .. } => "fix",
                Spec::Check { .. } => "check",
                Spec::Publish { .. } => "publish",
                Spec::Plan { .. } => "plan",
                Spec::Build { .. } => "build",
            };
            inner.jobs.push(Job {
                id,
                kind: kind.into(),
                lane: spec.lane().into(),
                label: spec.label(),
                project: spec.project().into(),
                shot: spec.shot(),
                mode,
                state: "queued".into(),
                progress: None,
                log: vec![],
                log_at: None,
                result: None,
                error: None,
                created_at: now(),
                started_at: None,
                finished_at: None,
                spec: Some(spec),
            });
            id
        };
        self.wake.notify_all();
        self.notify(app);
        id
    }

    /// Cancels a queued job, or stops a running one
    pub fn cancel(&self, app: &AppHandle, id: u64) {
        {
            let mut inner = self.inner.lock().unwrap();
            // The job's whole process group: node and what it started
            // (Blender, ffmpeg, Chrome, a CLI agent); not the child's lock,
            // which the runner holds while it waits
            if let Some(pid) = inner.pids.get(&id) {
                kill_group(*pid);
            }
            if let Some(j) = inner.jobs.iter_mut().find(|j| j.id == id) {
                if j.state == "queued" || j.state == "running" {
                    j.state = "cancelled".into();
                    j.finished_at = Some(now());
                }
            }
        }
        self.notify(app);
    }

    /// Every running job's processes, when the app quits
    pub fn kill_all(&self) {
        for pid in self.inner.lock().unwrap().pids.values() {
            kill_group(*pid);
        }
    }

    pub fn clear_finished(&self, app: &AppHandle) {
        self.inner
            .lock()
            .unwrap()
            .jobs
            .retain(|j| matches!(j.state.as_str(), "queued" | "running"));
        self.notify(app);
    }

    fn update(&self, app: &AppHandle, id: u64, f: impl FnOnce(&mut Job)) {
        {
            let mut inner = self.inner.lock().unwrap();
            if let Some(j) = inner.jobs.iter_mut().find(|j| j.id == id) {
                f(j);
            }
        }
        self.notify(app);
    }

    fn worker(self: Arc<Self>, lane: &'static str, app: AppHandle) {
        loop {
            // Wait for the oldest queued job of this lane
            let (id, spec) = {
                let mut inner = self.inner.lock().unwrap();
                loop {
                    if let Some(j) = inner.jobs.iter_mut().find(|j| j.lane == lane && j.state == "queued") {
                        j.state = "running".into();
                        j.started_at = Some(now());
                        let job = (j.id, j.spec.clone().unwrap());
                        inner.batch_start.get_or_insert_with(now);
                        break job;
                    }
                    inner = self.wake.wait(inner).unwrap();
                }
            };
            self.notify(&app);
            let outcome = self.run(&app, id, &spec);
            self.update(&app, id, |j| {
                j.finished_at = Some(now());
                if j.state == "cancelled" {
                    return;
                }
                match outcome {
                    Ok(result) => {
                        j.state = "done".into();
                        j.result = result;
                    }
                    Err(e) => {
                        j.state = "failed".into();
                        j.error = Some(e);
                    }
                }
            });
            // The queue ran dry: one alert for the whole batch
            let batch = {
                let mut inner = self.inner.lock().unwrap();
                if inner.jobs.iter().any(|j| matches!(j.state.as_str(), "queued" | "running")) {
                    None
                } else {
                    let since = inner.batch_start.take().unwrap_or(0);
                    let done: Vec<&Job> = inner.jobs.iter().filter(|j| j.finished_at.is_some_and(|t| t >= since) && j.state != "cancelled").collect();
                    Some((done.len(), done.iter().filter(|j| j.state == "failed").count()))
                }
            };
            if let Some((n, failed)) = batch {
                let launch = self.launch.lock().unwrap().clone();
                crate::tray::batch_finished(&app, &launch, n, failed);
            }
        }
    }

    fn run(&self, app: &AppHandle, id: u64, spec: &Spec) -> Result<Option<Value>, String> {
        let launch = self.launch.lock().unwrap().clone();
        let node = launch.node.clone().ok_or("Node.js not found (see Setup)")?;
        let (script, args) = spec.command();
        let mut cmd = Command::new(node);
        // --json first: an argument after "--" would swallow it. Each job
        // leads its own process group, so stopping it stops its children
        cmd.arg(launch.root.join(script))
            .arg("--json")
            .args(args)
            .process_group(0)
            .current_dir(&launch.root)
            .env("PATH", &launch.path)
            .envs(launch.env.iter().cloned())
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if spec.lane() == "agent" {
            if launch.needs_key && launch.api_key.is_empty() {
                return Err("No API key: add yours in Settings, or choose a local CLI or a local model".into());
            }
            if !launch.api_key.is_empty() {
                cmd.env("SHOTLOOP_API_KEY", &launch.api_key);
            }
        }
        let mut child = cmd.spawn().map_err(|e| format!("could not start {}: {}", script, e))?;
        let stdout = child.stdout.take().unwrap();
        let mut stderr = child.stderr.take().unwrap();
        let pid = child.id();
        let child = Arc::new(Mutex::new(child));
        {
            let mut inner = self.inner.lock().unwrap();
            inner.children.insert(id, child.clone());
            inner.pids.insert(id, pid);
        }

        let err_thread = std::thread::spawn(move || {
            let mut s = String::new();
            let _ = stderr.read_to_string(&mut s);
            s
        });

        let mut result = None;
        let mut error = None;
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let Ok(ev) = serde_json::from_str::<Value>(&line) else { continue };
            let kind = ev["type"].as_str().unwrap_or("");
            match kind {
                "result" => result = Some(ev["value"].clone()),
                "error" => error = ev["message"].as_str().map(String::from),
                _ => {}
            }
            self.update(app, id, |j| match kind {
                "progress" => {
                    j.progress = Some(Progress {
                        stage: ev["stage"].as_str().unwrap_or("").into(),
                        done: ev["done"].as_u64().unwrap_or(0),
                        total: ev["total"].as_u64().unwrap_or(0),
                        eta: ev["eta"].as_f64(),
                    })
                }
                "result" => {}
                _ => {
                    let text = ev["message"]
                        .as_str()
                        .or(ev["text"].as_str())
                        .map(String::from)
                        .or_else(|| ev["summary"].as_str().map(|s| format!("{} {}", ev["name"].as_str().unwrap_or(""), s)))
                        .unwrap_or_else(|| kind.to_string());
                    j.log.push(text);
                    j.log_at = Some(now());
                    if j.log.len() > LOG_LINES {
                        j.log.remove(0);
                    }
                }
            });
            // Shot status changed (a render, or the AI's test stills or
            // shot code mid-build): let the UI refresh it right away
            if kind == "done" || (kind == "tool" && matches!(ev["name"].as_str(), Some("render_stills" | "write_file" | "edit_file"))) {
                let _ = app.emit("project-changed", spec.project());
            }
        }

        let status = child.lock().unwrap().wait().map_err(|e| e.to_string())?;
        {
            let mut inner = self.inner.lock().unwrap();
            inner.children.remove(&id);
            inner.pids.remove(&id);
        }
        let stderr = err_thread.join().unwrap_or_default();
        let _ = app.emit("project-changed", spec.project());
        if status.success() {
            Ok(result)
        } else {
            let tail: String = stderr.lines().rev().take(6).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("\n");
            Err(error.unwrap_or(if tail.is_empty() { format!("exited with {}", status) } else { tail }))
        }
    }
}

/// SIGKILL to a process group (a job's node and everything it started)
fn kill_group(pid: u32) {
    let _ = Command::new("/bin/kill").args(["-KILL", &format!("-{pid}")]).status();
}

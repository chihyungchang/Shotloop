//! The render queue (docs/PRD.md §7.7). Jobs run in lanes, one job at a
//! time per lane: `render` for shot renders and exports (one shot at a
//! time, so a final render runs in the background while the person keeps
//! working), `agent` for fixes, checks, publish copy and the cover,
//! `voice` for the voice-over's model downloads and line fitting,
//! `download` for assets fetched into the library, and `preview` for the
//! whole film joined to watch (never behind a render).
//!
//! A library download waits for the person's approval (state `approval`)
//! before it starts. A speech model downloads as soon as it is asked for;
//! until it has landed, the jobs of the project that asked for it that
//! speak the lines wait rather than fetch the model themselves.
//!
//! Every job is a child process (the engine CLI or the agent sidecar, see
//! runner.rs) that prints one JSON event per line; the queue keeps the
//! latest progress, a log tail and the result. It emits `queue` (every
//! job) when jobs are added, removed or change state, and `job` (that one
//! job) when a running job reports progress or a log line.
//!
//! The queue also supervises the app's direct calls to the engine and the
//! agent (`call`): their processes are stopped when the app quits.

use crate::runner::{self, Args, Event, Script};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

pub const LANES: [&str; 5] = ["render", "agent", "voice", "download", "preview"];
const LOG_LINES: usize = 240;
/// Progress reaches the UI at most this often per job
const PROGRESS_EVERY: Duration = Duration::from_millis(100);

/// What the UI asks for
#[derive(Deserialize, Clone, Debug)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Spec {
    Render { project: String, shot: String, mode: String, stills: bool },
    /// The film and its kit; each part can be left out, and `to` delivers
    /// the files into a new folder there named after the work (`name`)
    Export {
        project: String,
        mode: String,
        aspects: Vec<String>,
        video: Option<bool>,
        cover: Option<bool>,
        publish: Option<bool>,
        to: Option<String>,
        name: Option<String>,
        lang: Option<String>,
    },
    /// `element`: what the person picked in the frame (engine pick)
    Fix { project: String, shot: String, request: String, element: Option<Value>, lang: Option<String> },
    Check { project: String, shot: String, lang: Option<String> },
    Publish { project: String, lang: Option<String> },
    /// The cover page (thumb.html), designed in the video's look, filled
    /// from a saved cover template, or after an uploaded image
    Cover { project: String, request: Option<String>, template: Option<String>, reference: Option<bool>, lang: Option<String> },
    /// Copy and storyboard (storyboard.json), or a revision of them
    Plan { project: String, request: Option<String>, lang: Option<String> },
    /// The world and every shot, from the applied storyboard
    Build { project: String, lang: Option<String> },
    /// The film's sound once its shots are approved: the `parts` chosen of
    /// effects, ambience and narration (fitting the finished shots), with
    /// the person's wish for it
    Sound { project: String, parts: Vec<String>, request: Option<String>, lang: Option<String> },
    /// A speech model for the voice-over, downloaded with progress (its own
    /// lane: it never waits behind renders or the agent); `project`: the
    /// one that asked for it, whose speaking jobs wait for it
    VoiceModel {
        model: String,
        #[serde(default)]
        project: Option<String>,
    },
    /// A search result fetched into the asset library (engine library
    /// get); `key`: Poly Pizza's, added from the settings when queued
    Download { item: Value, #[serde(default)] key: Option<String> },
    /// Every line spoken and the shots fitted to them (a plan's lines
    /// edited without a build)
    VoiceFit { project: String },
    /// The whole film to watch: the shots' clips joined, with music (cached)
    Preview { project: String, mode: String },
}

impl Spec {
    fn kind(&self) -> &'static str {
        match self {
            Spec::Render { .. } => "render",
            Spec::Export { .. } => "export",
            Spec::Fix { .. } => "fix",
            Spec::Check { .. } => "check",
            Spec::Publish { .. } => "publish",
            Spec::Cover { .. } => "cover",
            Spec::Plan { .. } => "plan",
            Spec::Build { .. } => "build",
            Spec::Sound { .. } => "sound",
            Spec::VoiceModel { .. } => "voiceModel",
            Spec::Download { .. } => "download",
            Spec::VoiceFit { .. } => "voiceFit",
            Spec::Preview { .. } => "preview",
        }
    }

    fn lane(&self) -> &'static str {
        match self {
            Spec::Render { .. } | Spec::Export { .. } => "render",
            Spec::VoiceModel { .. } | Spec::VoiceFit { .. } => "voice",
            Spec::Download { .. } => "download",
            Spec::Preview { .. } => "preview",
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
            | Spec::Cover { project, .. }
            | Spec::Plan { project, .. }
            | Spec::Build { project, .. }
            | Spec::Sound { project, .. }
            | Spec::Preview { project, .. }
            | Spec::VoiceFit { project } => project,
            Spec::VoiceModel { project, .. } => project.as_deref().unwrap_or(""),
            Spec::Download { .. } => "",
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
            Spec::Cover { .. } => "Design the cover".into(),
            Spec::Plan { request: Some(r), .. } => format!("Plan: {}", r),
            Spec::Plan { .. } => "Plan the copy and storyboard".into(),
            Spec::Build { .. } => "Build the shots".into(),
            Spec::Sound { .. } => "Sound for the film".into(),
            Spec::VoiceModel { model, .. } => format!("Download voice {}", model),
            Spec::Download { item, .. } => format!("Download {}", item["name"].as_str().unwrap_or("an asset")),
            Spec::VoiceFit { .. } => "Speak the lines".into(),
            Spec::Preview { mode, .. } => format!("Preview the film {}", mode),
        }
    }

    fn command(&self) -> (Script, Vec<String>) {
        let (script, args) = match self {
            Spec::Render { project, shot, mode, stills } => (
                Script::Engine,
                Args::new(["render", project, "--shot", shot]).flag(mode == "final", "--final").flag(*stills, "--stills"),
            ),
            Spec::Export { project, mode, aspects, video, cover, publish, to, name, lang } => (
                Script::Engine,
                Args::new(["export", project, "--aspect", &aspects.join(",")])
                    .flag(*video == Some(false), "--no-video")
                    .flag(*cover == Some(false), "--no-cover")
                    .flag(*publish == Some(false), "--no-publish")
                    .opt("--to", to.as_ref())
                    .opt("--name", name.as_ref())
                    .opt("--lang", lang.as_ref())
                    .flag(mode == "draft", "--draft"),
            ),
            Spec::Fix { project, shot, request, element, lang } => (
                Script::Agent,
                Args::new(["fix", project, "--shot", shot, "--request", request])
                    .opt("--element", element.as_ref())
                    .opt("--lang", lang.as_ref()),
            ),
            Spec::Check { project, shot, lang } => (Script::Agent, Args::new(["check", project, "--shot", shot]).opt("--lang", lang.as_ref())),
            Spec::Publish { project, lang } => (Script::Agent, Args::new(["publish", project]).opt("--lang", lang.as_ref())),
            Spec::Cover { project, request, template, reference, lang } => (
                Script::Agent,
                Args::new(["cover", project])
                    .opt("--request", request.as_ref())
                    .opt("--template", template.as_ref())
                    // A template already says what the cover looks like
                    .flag(template.is_none() && *reference == Some(true), "--reference")
                    .opt("--lang", lang.as_ref()),
            ),
            Spec::Plan { project, request, lang } => {
                (Script::Agent, Args::new(["plan", project]).opt("--request", request.as_ref()).opt("--lang", lang.as_ref()))
            }
            Spec::Build { project, lang } => (Script::Agent, Args::new(["build", project]).opt("--lang", lang.as_ref())),
            Spec::Sound { project, parts, request, lang } => (
                Script::Agent,
                Args::new(["sound", project])
                    .opt("--parts", Some(parts.join(",")))
                    .opt("--request", request.as_ref())
                    .opt("--lang", lang.as_ref()),
            ),
            Spec::VoiceModel { model, .. } => (Script::Engine, Args::new(["voice-models", "--download", model])),
            Spec::Download { item, key } => {
                (Script::Engine, Args::new(["library", "get", "--item"]).arg(item.to_string()).opt("--key", key.as_ref()))
            }
            Spec::VoiceFit { project } => (Script::Engine, Args::new(["voice", project, "--fit"])),
            Spec::Preview { project, mode } => {
                (Script::Engine, Args::new(["preview", project]).arg(if mode == "final" { "--final" } else { "--draft" }))
            }
        };
        (script, args.into_vec())
    }

    fn same_as(&self, other: &Spec) -> bool {
        match (self, other) {
            (
                Spec::Render { project: p1, shot: s1, mode: m1, stills: x1 },
                Spec::Render { project: p2, shot: s2, mode: m2, stills: x2 },
            ) => p1 == p2 && s1 == s2 && m1 == m2 && x1 == x2,
            // One download of a model at a time
            (Spec::VoiceModel { model: a, .. }, Spec::VoiceModel { model: b, .. }) => a == b,
            (Spec::VoiceFit { project: a }, Spec::VoiceFit { project: b }) => a == b,
            (Spec::Download { item: a, .. }, Spec::Download { item: b, .. }) => a["id"] == b["id"],
            (Spec::Preview { project: p1, mode: m1 }, Spec::Preview { project: p2, mode: m2 }) => p1 == p2 && m1 == m2,
            _ => false,
        }
    }

    /// Fetches assets from the network: the person approves it first (a
    /// speech model, asked for by turning the voice on, does not wait)
    fn downloads(&self) -> bool {
        matches!(self, Spec::Download { .. })
    }

    /// Speaks the voice-over's lines (or may: a build, a sound pass with
    /// narration, the film joined), so needs the speech model on this Mac
    fn speaks(&self) -> bool {
        matches!(self, Spec::Build { .. } | Spec::Sound { .. } | Spec::VoiceFit { .. } | Spec::Preview { .. } | Spec::Export { .. })
    }
}

#[derive(Serialize, Clone, Default, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub stage: String,
    pub done: u64,
    pub total: u64,
    /// The shot the engine is on, when it works through several
    pub shot: Option<String>,
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
    /// The speech model a voiceModel job downloads
    pub model: Option<String>,
    /// The search result a download job fetches (name, source, license)
    pub item: Option<Value>,
    pub mode: Option<String>,
    /// A render of the shot's stills, not its clip
    pub stills: bool,
    /// The aspect ratios an export makes
    pub aspects: Vec<String>,
    /// What the person asked for (a fix, a plan's or a cover's request)
    pub request: Option<String>,
    /// The element a fix is about, picked in the frame
    pub element: Option<Value>,
    pub state: String,
    pub progress: Option<Progress>,
    /// The agent's step, as it last reported it
    pub phase: Option<String>,
    /// The shots the agent works on, each at its latest state (start,
    /// written, done)
    pub shots: BTreeMap<String, String>,
    pub log: VecDeque<String>,
    /// When the last log line came in: a long silence is the AI thinking
    pub log_at: Option<u64>,
    pub result: Option<Value>,
    pub error: Option<String>,
    pub created_at: u64,
    pub started_at: Option<u64>,
    pub finished_at: Option<u64>,
    #[serde(skip)]
    spec: Spec,
}

impl Job {
    fn new(id: u64, spec: Spec) -> Job {
        let (shot, mode, stills) = match &spec {
            Spec::Render { shot, mode, stills, .. } => (Some(shot.clone()), Some(mode.clone()), *stills),
            Spec::Fix { shot, .. } | Spec::Check { shot, .. } => (Some(shot.clone()), None, false),
            Spec::Export { mode, .. } | Spec::Preview { mode, .. } => (None, Some(mode.clone()), false),
            _ => (None, None, false),
        };
        Job {
            id,
            kind: spec.kind().into(),
            lane: spec.lane().into(),
            label: spec.label(),
            project: spec.project().into(),
            shot,
            model: match &spec {
                Spec::VoiceModel { model, .. } => Some(model.clone()),
                _ => None,
            },
            item: match &spec {
                Spec::Download { item, .. } => Some(item.clone()),
                _ => None,
            },
            mode,
            stills,
            aspects: match &spec {
                Spec::Export { aspects, .. } => aspects.clone(),
                _ => vec![],
            },
            request: match &spec {
                Spec::Fix { request, .. } => Some(request.clone()),
                Spec::Plan { request, .. } | Spec::Cover { request, .. } => request.clone(),
                _ => None,
            },
            element: match &spec {
                Spec::Fix { element, .. } => element.clone(),
                _ => None,
            },
            state: if spec.downloads() { "approval" } else { "queued" }.into(),
            progress: None,
            phase: None,
            shots: BTreeMap::new(),
            log: VecDeque::new(),
            log_at: None,
            result: None,
            error: None,
            created_at: now(),
            started_at: None,
            finished_at: None,
            spec,
        }
    }

    /// In the queue: waiting for approval, queued or running
    fn active(&self) -> bool {
        matches!(self.state.as_str(), "approval" | "queued" | "running")
    }

    /// Working or about to: what the queue's batch alert waits for
    fn busy(&self) -> bool {
        matches!(self.state.as_str(), "queued" | "running")
    }

    /// A line of the job's output into the job; false when nothing the UI
    /// shows changed
    fn apply(&mut self, event: &Event) -> bool {
        match event {
            Event::Progress(p) => self.progress = Some(p.clone()),
            Event::Phase(p) => self.phase = Some(p.clone()),
            Event::Shot { id, state } => {
                self.shots.insert(id.clone(), state.clone());
            }
            Event::Log { text: Some(text), .. } => {
                self.log.push_back(text.clone());
                self.log_at = Some(now());
                if self.log.len() > LOG_LINES {
                    self.log.pop_front();
                }
            }
            Event::Log { text: None, .. } | Event::Result(_) | Event::Usage(_) => return false,
        }
        true
    }
}

/// How child processes are started; set by the app at launch and on
/// settings changes
#[derive(Clone, Default)]
pub struct Launch {
    pub root: PathBuf,
    pub node: Option<PathBuf>,
    pub path: String,
    /// The settings' variables and the app's folders (examples, drafts,
    /// library, voices, covers, memory)
    pub env: Vec<(String, String)>,
    pub api_key: String,
    pub needs_key: bool,
    /// Alerts when the queue runs dry (Settings → General)
    pub notify_sound: bool,
    pub notify_desktop: bool,
    /// Anonymous usage counts (telemetry.rs), unless turned off
    pub telemetry: bool,
}

#[derive(Default)]
struct Inner {
    jobs: Vec<Job>,
    next_id: u64,
    /// Each running job's process group, to stop it
    pids: HashMap<u64, u32>,
    /// The process groups of direct calls (`call`), stopped on quit
    calls: HashSet<u32>,
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
    pub fn new(launch: Launch) -> Arc<Self> {
        Arc::new(Queue {
            inner: Mutex::new(Inner { next_id: 1, ..Default::default() }),
            wake: Condvar::new(),
            launch: Mutex::new(launch),
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

    pub fn launch(&self) -> Launch {
        self.launch.lock().unwrap().clone()
    }

    /// Every job to the UI, and the count beside the menu bar icon
    fn notify(&self, app: &AppHandle) {
        let jobs = self.list();
        crate::tray::set_count(app, jobs.iter().filter(|j| j.active()).count());
        emit(app, "queue", jobs);
    }

    /// Adds a job; a render already queued or running is not added twice
    pub fn enqueue(&self, app: &AppHandle, spec: Spec) -> u64 {
        let id = {
            let mut inner = self.inner.lock().unwrap();
            if let Some(j) = inner.jobs.iter().find(|j| j.active() && j.spec.same_as(&spec)) {
                return j.id;
            }
            let id = inner.next_id;
            inner.next_id += 1;
            inner.jobs.push(Job::new(id, spec));
            id
        };
        self.wake.notify_all();
        self.notify(app);
        id
    }

    /// A download the person approved: it joins its lane
    pub fn approve(&self, app: &AppHandle, id: u64) {
        if let Some(j) = self.inner.lock().unwrap().jobs.iter_mut().find(|j| j.id == id && j.state == "approval") {
            j.state = "queued".into();
        }
        self.wake.notify_all();
        self.notify(app);
    }

    /// Cancels a queued job (declines a download), or stops a running one
    pub fn cancel(&self, app: &AppHandle, id: u64) {
        let pid = {
            let mut inner = self.inner.lock().unwrap();
            if let Some(j) = inner.jobs.iter_mut().find(|j| j.id == id) {
                if j.active() {
                    j.state = "cancelled".into();
                    j.finished_at = Some(now());
                }
            }
            inner.pids.get(&id).copied()
        };
        // The job's whole process group: node and what it started. Not
        // under the lock: the other lanes keep going meanwhile
        if let Some(pid) = pid {
            kill_group(pid);
        }
        // A declined speech model: the jobs waiting on it go on (and say
        // the voice is missing)
        self.wake.notify_all();
        self.notify(app);
    }

    /// Every running job's and call's processes, when the app quits
    pub fn kill_all(&self) {
        let pids: Vec<u32> = {
            let inner = self.inner.lock().unwrap();
            inner.pids.values().chain(inner.calls.iter()).copied().collect()
        };
        for pid in pids {
            kill_group(pid);
        }
    }

    pub fn clear_finished(&self, app: &AppHandle) {
        self.inner.lock().unwrap().jobs.retain(Job::active);
        self.notify(app);
    }

    /// Changes a job; `f` says whether the UI should hear of it, as that
    /// one job (`job`)
    fn update_job(&self, app: &AppHandle, id: u64, f: impl FnOnce(&mut Job) -> bool) {
        let changed = {
            let mut inner = self.inner.lock().unwrap();
            inner.jobs.iter_mut().find(|j| j.id == id).and_then(|j| f(j).then(|| j.clone()))
        };
        if let Some(job) = changed {
            emit(app, "job", job);
        }
    }

    fn worker(self: Arc<Self>, lane: &'static str, app: AppHandle) {
        loop {
            // Wait for the oldest queued job of this lane; one that speaks
            // waits while its project's speech model is still to be
            // approved or fetched
            let (id, spec) = {
                let mut inner = self.inner.lock().unwrap();
                loop {
                    let fetching: HashSet<String> =
                        inner.jobs.iter().filter(|j| j.kind == "voiceModel" && j.active() && !j.project.is_empty()).map(|j| j.project.clone()).collect();
                    if let Some(j) = inner
                        .jobs
                        .iter_mut()
                        .find(|j| j.lane == lane && j.state == "queued" && !(j.spec.speaks() && fetching.contains(&j.project)))
                    {
                        j.state = "running".into();
                        j.started_at = Some(now());
                        let job = (j.id, j.spec.clone());
                        inner.batch_start.get_or_insert_with(now);
                        break job;
                    }
                    inner = self.wake.wait(inner).unwrap();
                }
            };
            self.notify(&app);
            let outcome = self.run(&app, id, &spec);
            self.finish(&app, id, &spec, outcome);
        }
    }

    /// A job's end: its state and result, what the person may now see of
    /// it, the usage count, and the alert when the queue ran dry
    fn finish(&self, app: &AppHandle, id: u64, spec: &Spec, outcome: Result<Option<Value>, String>) {
        let finished = {
            let mut inner = self.inner.lock().unwrap();
            inner.jobs.iter_mut().find(|j| j.id == id).and_then(|j| {
                j.finished_at = Some(now());
                if j.state == "cancelled" {
                    return None;
                }
                match outcome {
                    Ok(result) => {
                        j.state = "done".into();
                        j.result = result;
                        Some(j.result.clone().unwrap_or_default())
                    }
                    Err(e) => {
                        j.state = "failed".into();
                        j.error = Some(e);
                        None
                    }
                }
            })
        };
        if let Some(result) = &finished {
            // An export delivered into a folder of the person's: the UI shows its files
            if let Some(folder) = result["folder"].as_str() {
                crate::allow_dir(app, Path::new(folder));
            }
            let on = self.launch.lock().unwrap().telemetry;
            crate::telemetry::count(&app.state::<crate::App>().config_dir, on, spec.kind(), Path::new(spec.project()), result["style"].as_str());
        }
        // A speech model landed: the jobs that waited for it go on
        self.wake.notify_all();
        self.notify(app);
        // The queue ran dry: one alert for the whole batch (a preview
        // asked for to watch now is no news)
        let batch = {
            let mut inner = self.inner.lock().unwrap();
            if inner.jobs.iter().any(Job::busy) {
                None
            } else {
                let since = inner.batch_start.take().unwrap_or(0);
                let done: Vec<&Job> =
                    inner.jobs.iter().filter(|j| j.finished_at.is_some_and(|t| t >= since) && j.state != "cancelled" && j.kind != "preview").collect();
                Some((done.len(), done.iter().filter(|j| j.state == "failed").count()))
            }
        };
        if let Some((n, failed)) = batch {
            crate::tray::batch_finished(app, &self.launch(), n, failed);
        }
    }

    fn run(&self, app: &AppHandle, id: u64, spec: &Spec) -> Result<Option<Value>, String> {
        let launch = self.launch();
        let (script, args) = spec.command();
        if script == Script::Agent && launch.needs_key && launch.api_key.is_empty() {
            return Err("No API key: add yours in Settings, or choose a local CLI or a local model".into());
        }
        let mut cmd = runner::node_command(&launch, script, &args)?;
        let mut progress_at: Option<Instant> = None;
        let outcome = runner::run(
            &mut cmd,
            |pid| {
                let cancelled = {
                    let mut inner = self.inner.lock().unwrap();
                    inner.pids.insert(id, pid);
                    inner.jobs.iter().any(|j| j.id == id && j.state == "cancelled")
                };
                // Cancelled while it started: stopped at once
                if cancelled {
                    kill_group(pid);
                }
            },
            |line| {
                if let Event::Usage(u) = &line.event {
                    save_usage(app, u.clone());
                }
                // Progress at most every PROGRESS_EVERY, and always its end
                let send = match &line.event {
                    Event::Progress(p) => {
                        let due = p.done >= p.total || progress_at.is_none_or(|t| t.elapsed() >= PROGRESS_EVERY);
                        if due {
                            progress_at = Some(Instant::now());
                        }
                        due
                    }
                    _ => true,
                };
                self.update_job(app, id, |j| j.apply(&line.event) && send);
                if line.changed {
                    emit(app, "project-changed", spec.project());
                }
            },
        );
        self.inner.lock().unwrap().pids.remove(&id);
        emit(app, "project-changed", spec.project());
        outcome
    }

    /// Runs an engine or agent command to its end for the app (not a job)
    /// and returns its result
    pub fn call(&self, script: Script, args: Args) -> Result<Value, String> {
        self.call_as(&self.launch(), script, args)
    }

    /// `call` started as `launch` says (settings not saved yet)
    pub fn call_as(&self, launch: &Launch, script: Script, args: Args) -> Result<Value, String> {
        let mut cmd = runner::node_command(launch, script, &args.into_vec())?;
        let mut pid = None;
        let outcome = runner::run(
            &mut cmd,
            |p| {
                pid = Some(p);
                self.inner.lock().unwrap().calls.insert(p);
            },
            |_| {},
        );
        if let Some(p) = pid {
            self.inner.lock().unwrap().calls.remove(&p);
        }
        outcome?.ok_or_else(|| format!("{} gave no result", script.path()))
    }
}

/// An event to the UI. It only fails once the app is shutting down, when
/// no window is left to hear it
fn emit(app: &AppHandle, event: &str, payload: impl Serialize + Clone) {
    let _ = app.emit(event, payload);
}

/// The last usage a CLI agent reported (Claude Code's 5-hour and weekly
/// windows), with when: kept across launches, sent to the UI
fn usage_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("usage.json"))
}

fn save_usage(app: &AppHandle, mut ev: Value) {
    ev["at"] = Value::from(now());
    // Only the sidebar's meter reads it: a failed write is logged, the run goes on
    if let Some(f) = usage_file(app) {
        if let Err(e) = crate::files::write_atomic(&f, ev.to_string().as_bytes(), false) {
            eprintln!("shotloop: could not save the AI usage: {e}");
        }
    }
    emit(app, "ai-usage", ev);
}

pub fn load_usage(app: &AppHandle) -> Option<Value> {
    serde_json::from_str(&std::fs::read_to_string(usage_file(app)?).ok()?).ok()
}

/// SIGKILL to a process group (a job's node and everything it started)
fn kill_group(pid: u32) {
    let status = Command::new("/bin/kill").args(["-KILL", &format!("-{pid}")]).stderr(std::process::Stdio::null()).status();
    // kill fails when the group has already exited, which is what was wanted
    if let Err(e) = status {
        eprintln!("shotloop: could not stop process group {pid}: {e}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spec(json: Value) -> Spec {
        serde_json::from_value(json).unwrap()
    }

    #[test]
    fn downloads_wait_for_approval() {
        let item = serde_json::json!({ "id": "openverse:1", "name": "Rain", "source": "openverse" });
        let d = Job::new(1, spec(serde_json::json!({ "kind": "download", "item": item })));
        assert_eq!((d.state.as_str(), d.lane.as_str(), d.active()), ("approval", "download", true));
        assert!(!d.busy());
        let m = Job::new(2, spec(serde_json::json!({ "kind": "voiceModel", "model": "kokoro" })));
        assert_eq!(m.state, "queued");
        let r = Job::new(3, spec(serde_json::json!({ "kind": "render", "project": "/p", "shot": "s1", "mode": "draft", "stills": false })));
        assert_eq!(r.state, "queued");
        // What speaks waits for the speech model; a render doesn't
        assert!(spec(serde_json::json!({ "kind": "voiceFit", "project": "/p" })).speaks());
        assert!(!r.spec.speaks());
    }

    #[test]
    fn commands_carry_only_the_flags_asked_for() {
        let (script, args) = spec(serde_json::json!({ "kind": "render", "project": "/p", "shot": "s1", "mode": "final", "stills": true })).command();
        assert_eq!(script, Script::Engine);
        assert_eq!(args, ["render", "/p", "--shot", "s1", "--final", "--stills"]);
        let (_, args) = spec(serde_json::json!({ "kind": "render", "project": "/p", "shot": "s1", "mode": "draft", "stills": false })).command();
        assert_eq!(args, ["render", "/p", "--shot", "s1"]);
        let (_, args) = spec(serde_json::json!({
            "kind": "export", "project": "/p", "mode": "draft", "aspects": ["9:16", "16:9"],
            "video": true, "cover": false, "to": "/out", "lang": "en"
        }))
        .command();
        assert_eq!(args, ["export", "/p", "--aspect", "9:16,16:9", "--no-cover", "--to", "/out", "--lang", "en", "--draft"]);
        let (script, args) = spec(serde_json::json!({ "kind": "cover", "project": "/p", "template": "t1", "reference": true })).command();
        assert_eq!(script, Script::Agent);
        assert_eq!(args, ["cover", "/p", "--template", "t1"]);
        let (_, args) = spec(serde_json::json!({ "kind": "cover", "project": "/p", "reference": true, "request": "bold" })).command();
        assert_eq!(args, ["cover", "/p", "--request", "bold", "--reference"]);
        let (_, args) = spec(serde_json::json!({ "kind": "fix", "project": "/p", "shot": "s2", "request": "slower", "lang": "zh-CN" })).command();
        assert_eq!(args, ["fix", "/p", "--shot", "s2", "--request", "slower", "--lang", "zh-CN"]);
        let (_, args) = spec(serde_json::json!({ "kind": "fix", "project": "/p", "shot": "s2", "request": "slower", "element": { "kind": "three" } })).command();
        assert_eq!(args, ["fix", "/p", "--shot", "s2", "--request", "slower", "--element", r#"{"kind":"three"}"#]);
        let (_, args) = spec(serde_json::json!({ "kind": "preview", "project": "/p", "mode": "final" })).command();
        assert_eq!(args, ["preview", "/p", "--final"]);
    }

    #[test]
    fn jobs_carry_what_the_ui_shows_and_take_in_events() {
        let mut j = Job::new(1, spec(serde_json::json!({ "kind": "fix", "project": "/p", "shot": "s2", "request": "slower" })));
        assert_eq!((j.kind.as_str(), j.lane.as_str(), j.request.as_deref(), j.shot.as_deref()), ("fix", "agent", Some("slower"), Some("s2")));
        assert!(j.apply(&Event::Phase("building".into())));
        assert!(j.apply(&Event::Shot { id: "s2".into(), state: "start".into() }));
        assert!(j.apply(&Event::Shot { id: "s2".into(), state: "written".into() }));
        assert!(!j.apply(&Event::Log { text: None, error: false }));
        assert!(j.log.is_empty());
        for n in 0..LOG_LINES + 5 {
            j.apply(&Event::Log { text: Some(n.to_string()), error: false });
        }
        assert_eq!(j.log.len(), LOG_LINES);
        assert_eq!(j.log.front().map(String::as_str), Some("5"));
        let json = serde_json::to_value(&j).unwrap();
        assert_eq!(json["phase"], "building");
        assert_eq!(json["shots"], serde_json::json!({ "s2": "written" }));
        assert_eq!(json["stills"], false);
        let e = Job::new(2, spec(serde_json::json!({ "kind": "export", "project": "/p", "mode": "final", "aspects": ["9:16"] })));
        assert_eq!(serde_json::to_value(&e).unwrap()["aspects"], serde_json::json!(["9:16"]));
        let p = Job::new(3, spec(serde_json::json!({ "kind": "preview", "project": "/p", "mode": "draft" })));
        assert_eq!((p.lane.as_str(), p.mode.as_deref()), ("preview", Some("draft")));
    }
}

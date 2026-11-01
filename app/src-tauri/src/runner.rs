//! How the shell runs the engine CLI and the agent sidecar: one Node
//! command line, and one reading of the JSON events they print (one per
//! line), for queue jobs and direct calls alike.

use crate::queue::{Launch, Progress};
use serde_json::Value;
use std::io::{BufRead, BufReader, Read};
use std::os::unix::process::CommandExt;
use std::process::{Command, Stdio};

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Script {
    Engine,
    Agent,
}

impl Script {
    /// Relative to the repository (or the bundle's resources)
    pub fn path(self) -> &'static str {
        match self {
            Script::Engine => "engine/shotloop/cli.mjs",
            Script::Agent => "agent/src/main.ts",
        }
    }
}

/// A command line: the arguments always given, then options and flags
/// added only when they have a value or are on
#[derive(Default, Debug, PartialEq)]
pub struct Args(Vec<String>);

impl Args {
    pub fn new<S: Into<String>>(base: impl IntoIterator<Item = S>) -> Self {
        Args(base.into_iter().map(Into::into).collect())
    }

    pub fn arg(mut self, a: impl Into<String>) -> Self {
        self.0.push(a.into());
        self
    }

    pub fn args<S: Into<String>>(mut self, more: impl IntoIterator<Item = S>) -> Self {
        self.0.extend(more.into_iter().map(Into::into));
        self
    }

    /// `name value`, when there is a value
    pub fn opt(mut self, name: &str, value: Option<impl ToString>) -> Self {
        if let Some(v) = value {
            self.0.extend([name.to_string(), v.to_string()]);
        }
        self
    }

    /// `name`, when on
    pub fn flag(mut self, on: bool, name: &str) -> Self {
        if on {
            self.0.push(name.into());
        }
        self
    }

    pub fn into_vec(self) -> Vec<String> {
        self.0
    }
}

/// Node running `script` with `--json` first (an argument after "--"
/// would swallow it), in its own process group so stopping it stops what
/// it started (Blender, ffmpeg, Chrome, a CLI agent)
pub fn node_command(launch: &Launch, script: Script, args: &[String]) -> Result<Command, String> {
    // Node found at launch, or now (installed since)
    let node = match &launch.node {
        Some(n) => n.clone(),
        None => crate::env::node()?,
    };
    let mut cmd = Command::new(node);
    cmd.arg(launch.root.join(script.path()))
        .arg("--json")
        .args(args)
        .process_group(0)
        .current_dir(&launch.root)
        .env("PATH", &launch.path)
        .envs(launch.env.iter().cloned())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    // The person's key goes to the agent only
    if script == Script::Agent && !launch.api_key.is_empty() {
        cmd.env("SHOTLOOP_API_KEY", &launch.api_key);
    }
    Ok(cmd)
}

/// What one line of a child's output says
#[derive(Debug, PartialEq)]
pub enum Event {
    /// The command's answer
    Result(Value),
    /// The AI subscription's limits (kept for the sidebar)
    Usage(Value),
    Progress(Progress),
    /// The agent's step (planning, building, checking…)
    Phase(String),
    /// A shot the agent is building: started, written or done
    Shot { id: String, state: String },
    /// A line for the job's log; `error` when the command failed with it.
    /// No text (a render's start or done): nothing to log
    Log { text: Option<String>, error: bool },
}

#[derive(Debug, PartialEq)]
pub struct Line {
    pub event: Event,
    /// The project's shots changed (a render, or the AI's test stills or
    /// shot code mid-build): the UI refreshes it right away
    pub changed: bool,
}

pub fn parse_line(line: &str) -> Option<Line> {
    let ev: Value = serde_json::from_str(line).ok()?;
    let kind = ev["type"].as_str().unwrap_or("");
    let text = |key: &str| ev[key].as_str().map(String::from);
    let mut changed = kind == "done" || (kind == "tool" && matches!(ev["name"].as_str(), Some("render_stills" | "write_file" | "edit_file")));
    let event = match kind {
        "result" => Event::Result(ev["value"].clone()),
        "usage" => Event::Usage(ev),
        "progress" => Event::Progress(Progress {
            stage: ev["stage"].as_str().unwrap_or("").into(),
            done: ev["done"].as_u64().unwrap_or(0),
            total: ev["total"].as_u64().unwrap_or(0),
            shot: text("shot"),
            eta: ev["eta"].as_f64(),
        }),
        "phase" => Event::Phase(text("phase")?),
        "shot" => {
            let state = text("state")?;
            changed = matches!(state.as_str(), "written" | "done");
            Event::Shot { id: text("id")?, state }
        }
        _ => Event::Log {
            text: text("message")
                .or_else(|| text("text"))
                .or_else(|| ev["summary"].as_str().map(|s| format!("{} {}", ev["name"].as_str().unwrap_or(""), s))),
            error: kind == "error",
        },
    };
    Some(Line { event, changed })
}

/// Runs a command to its end: `started` gets the child's pid once it runs
/// (to stop it on cancel or quit), `each` every line as it comes. The
/// result event's value, or the error: the last error event, else the end
/// of stderr
pub fn run(cmd: &mut Command, started: impl FnOnce(u32), mut each: impl FnMut(&Line)) -> Result<Option<Value>, String> {
    let mut child = cmd.spawn().map_err(|e| format!("could not start {:?}: {e}", cmd.get_args().next().unwrap_or_default()))?;
    started(child.id());
    let stdout = child.stdout.take().ok_or("no output from the child")?;
    let mut stderr = child.stderr.take().ok_or("no error output from the child")?;
    let err_thread = std::thread::spawn(move || {
        let mut s = String::new();
        // Undecodable stderr only loses the error's wording, not the run
        let _ = stderr.read_to_string(&mut s);
        s
    });
    let mut result = None;
    let mut error = None;
    for line in BufReader::new(stdout).lines().map_while(Result::ok) {
        let Some(line) = parse_line(&line) else { continue };
        match &line.event {
            Event::Result(v) => result = Some(v.clone()),
            Event::Log { text, error: true } => error = text.clone(),
            _ => {}
        }
        each(&line);
    }
    let status = child.wait().map_err(|e| e.to_string())?;
    let stderr = err_thread.join().unwrap_or_default();
    if status.success() {
        return Ok(result);
    }
    let tail = stderr.lines().rev().take(6).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("\n");
    Err(error.unwrap_or(if tail.is_empty() { format!("exited with {status}") } else { tail }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn args_add_options_and_flags_only_when_given() {
        let lang: Option<&str> = None;
        let a = Args::new(["voice", "/p"]).opt("--voice", Some("af_heart")).opt("--lang", lang).flag(true, "--sample").flag(false, "--off").opt("--gain", Some(0.5)).arg("--");
        assert_eq!(a.into_vec(), ["voice", "/p", "--voice", "af_heart", "--sample", "--gain", "0.5", "--"]);
    }

    #[test]
    fn progress_keeps_the_shot() {
        let l = parse_line(r#"{"type":"progress","stage":"frames","done":3,"total":10,"shot":"s2","eta":4.5}"#).unwrap();
        assert_eq!(l.event, Event::Progress(Progress { stage: "frames".into(), done: 3, total: 10, shot: Some("s2".into()), eta: Some(4.5) }));
        assert!(!l.changed);
        let l = parse_line(r#"{"type":"progress","stage":"join","done":1,"total":2}"#).unwrap();
        assert!(matches!(l.event, Event::Progress(Progress { shot: None, eta: None, .. })));
    }

    #[test]
    fn agent_phases_and_shots() {
        assert_eq!(parse_line(r#"{"type":"phase","phase":"building"}"#).unwrap().event, Event::Phase("building".into()));
        let start = parse_line(r#"{"type":"shot","id":"s1","state":"start"}"#).unwrap();
        assert_eq!(start.event, Event::Shot { id: "s1".into(), state: "start".into() });
        assert!(!start.changed);
        assert!(parse_line(r#"{"type":"shot","id":"s1","state":"written"}"#).unwrap().changed);
        // Incomplete ones are skipped
        assert_eq!(parse_line(r#"{"type":"shot","state":"done"}"#), None);
        assert_eq!(parse_line(r#"{"type":"phase"}"#), None);
    }

    #[test]
    fn events_without_text_log_nothing() {
        let done = parse_line(r#"{"type":"done","shot":"s1","mode":"draft"}"#).unwrap();
        assert_eq!(done.event, Event::Log { text: None, error: false });
        assert!(done.changed);
        assert_eq!(parse_line(r#"{"type":"start","shot":"s1"}"#).unwrap().event, Event::Log { text: None, error: false });
        assert_eq!(parse_line(r#"{"type":"log","message":"hi"}"#).unwrap().event, Event::Log { text: Some("hi".into()), error: false });
        assert_eq!(parse_line(r#"{"type":"error","message":"no"}"#).unwrap().event, Event::Log { text: Some("no".into()), error: true });
        let tool = parse_line(r#"{"type":"tool","name":"write_file","summary":"shots/s1.mjs"}"#).unwrap();
        assert_eq!(tool.event, Event::Log { text: Some("write_file shots/s1.mjs".into()), error: false });
        assert!(tool.changed);
        assert_eq!(parse_line("not json"), None);
        assert_eq!(parse_line(r#"{"type":"result","value":{"ok":1}}"#).unwrap().event, Event::Result(serde_json::json!({ "ok": 1 })));
    }

    #[test]
    fn runs_to_the_result_or_the_error() {
        let mut ok = Command::new("/bin/sh");
        ok.args(["-c", r#"echo '{"type":"log","message":"a"}'; echo '{"type":"result","value":7}'"#]).stdout(Stdio::piped()).stderr(Stdio::piped());
        let mut pid = 0;
        let mut lines = 0;
        assert_eq!(run(&mut ok, |p| pid = p, |_| lines += 1), Ok(Some(serde_json::json!(7))));
        assert!(pid > 0);
        assert_eq!(lines, 2);
        let mut bad = Command::new("/bin/sh");
        bad.args(["-c", r#"echo '{"type":"error","message":"broken"}'; echo oops >&2; exit 3"#]).stdout(Stdio::piped()).stderr(Stdio::piped());
        assert_eq!(run(&mut bad, |_| {}, |_| {}), Err("broken".into()));
        let mut quiet = Command::new("/bin/sh");
        quiet.args(["-c", "echo oops >&2; exit 3"]).stdout(Stdio::piped()).stderr(Stdio::piped());
        assert_eq!(run(&mut quiet, |_| {}, |_| {}), Err("oops".into()));
    }
}

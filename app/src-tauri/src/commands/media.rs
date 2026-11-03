//! What a film carries besides its shots: the cover and its templates,
//! the publish copy, the music bed and the voice-over.

use crate::runner::Args;
use crate::{blocking, engine};
use serde::Deserialize;
use serde_json::Value;
use tauri::AppHandle;

/// Cover templates: list them, save a project's cover as one, remove one;
/// an image into the project for the AI to design the cover after; the
/// cover rendered as a preview (.shotloop/cover.png)
#[tauri::command]
pub async fn covers(handle: AppHandle, action: String, project: Option<String>, id: Option<String>, name: Option<String>, file: Option<String>) -> Result<Value, String> {
    blocking(move || {
        let p = project.unwrap_or_default();
        let args = match action.as_str() {
            "list" => Args::new(["covers", "list"]),
            "save" => Args::new(["covers", "save", &p]).opt("--title", name),
            "remove" => Args::new(["covers", "remove"]).arg(id.unwrap_or_default()),
            "reference" => Args::new(["covers", "reference", &p, "--file"]).arg(file.unwrap_or_default()),
            "preview" => Args::new(["cover", &p, "--preview"]),
            _ => return Err(format!("unknown covers action {action}")),
        };
        engine(&handle, args)
    })
    .await
}

/// The publish copy into an export's folder, when the AI finished it after
/// the export
#[tauri::command]
pub async fn deliver_copy(handle: AppHandle, path: String, folder: String, name: Option<String>, lang: Option<String>) -> Result<Value, String> {
    blocking(move || engine(&handle, Args::new(["deliver-copy", &path, "--to", &folder]).opt("--name", name).opt("--lang", lang))).await
}

/// A change to the music bed; nothing set reads it
#[derive(Deserialize, Default)]
#[serde(default)]
pub struct MusicChange {
    preset: Option<String>,
    shuffle: Option<bool>,
    file: Option<String>,
    none: Option<bool>,
    gain: Option<f64>,
}

/// The project's music bed: read it, or set a preset, an audio file, none,
/// and the volume
#[tauri::command]
pub async fn music(handle: AppHandle, path: String, change: Option<MusicChange>) -> Result<Value, String> {
    blocking(move || {
        let c = change.unwrap_or_default();
        let args = Args::new(["music", &path])
            .opt("--preset", c.preset)
            .flag(c.shuffle == Some(true), "--shuffle")
            .opt("--file", c.file)
            .flag(c.none == Some(true), "--none")
            .opt("--gain", c.gain);
        engine(&handle, args)
    })
    .await
}

/// A change to the ambience or the sound effects; nothing set reads them
#[derive(Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct SoundChange {
    /// An ambience by name, or "none"
    ambience: Option<String>,
    ambience_gain: Option<f64>,
    effects: Option<bool>,
    effects_gain: Option<f64>,
    /// One effect (its key) or every effect of a kind, switched on or off
    cue: Option<String>,
    kind: Option<String>,
    on: Option<bool>,
}

/// The film's ambience and sound effects: read them, or change which play
#[tauri::command]
pub async fn sound(handle: AppHandle, path: String, change: Option<SoundChange>) -> Result<Value, String> {
    blocking(move || {
        let c = change.unwrap_or_default();
        let args = Args::new(["sound", &path])
            .opt("--ambience", c.ambience)
            .opt("--ambience-gain", c.ambience_gain)
            .opt("--effects", c.effects.map(|on| if on { "on" } else { "off" }))
            .opt("--effects-gain", c.effects_gain)
            .opt("--cue", c.cue)
            .opt("--kind", c.kind)
            .flag(c.on == Some(false), "--off");
        engine(&handle, args)
    })
    .await
}

/// The film's sound as the studio's timeline shows it: each track's
/// waveform, the voice's lines, the effects' cues and the mix to play
#[tauri::command]
pub async fn sound_timeline(handle: AppHandle, path: String) -> Result<Value, String> {
    blocking(move || engine(&handle, Args::new(["timeline", &path]))).await
}

/// The voice-over: read it (with the voices of the project's language), or
/// turn it on or off and pick the voice (each speaks the lines again and
/// fits the shots to them), or set its volume or the subtitles' look;
/// sample: a WAV of the voice to listen to
#[tauri::command]
pub async fn voice(
    handle: AppHandle,
    path: String,
    on: Option<bool>,
    voice: Option<String>,
    gain: Option<f64>,
    subtitles: Option<String>,
    sample: Option<bool>,
) -> Result<Value, String> {
    blocking(move || {
        let args = Args::new(["voice", &path])
            .flag(on == Some(true), "--on")
            .flag(on == Some(false), "--off")
            .opt("--voice", voice)
            .opt("--gain", gain)
            .opt("--subtitles", subtitles)
            .flag(sample == Some(true), "--sample")
            // Speaking every line again is a queue job the app shows (voiceFit)
            .arg("--no-fit");
        engine(&handle, args)
    })
    .await
}

/// The speech models: languages, size, license, downloaded or not, and
/// where they live (Settings → Dependencies)
#[tauri::command]
pub async fn voice_models(handle: AppHandle) -> Result<Value, String> {
    blocking(move || engine(&handle, Args::new(["voice-models"]))).await
}

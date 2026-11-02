<h1 align="center">
  <img src="docs/screenshots/logo.png" alt="" width="72" /><br/>
  Shotloop
</h1>

<p align="center"><b>Kurze Erklärvideos aus Code, Shot für Shot.</b><br/>
Aus einer Idee werden Text, Storyboard und ein Film aus Shots. Jeder Shot hat seine eigene Schleife: Die KI schreibt ihn, Shotloop rendert ihn, du prüfst ihn, die KI korrigiert ihn. Eine Korrektur rendert nur diesen Shot neu, nicht den ganzen Film.</p>

<p align="center">
  <img src="docs/screenshots/hero.jpg" alt="Shotloop-Studio: ein 3D-Smartphone-Teardown, der Explosionsansicht-Shot als Start-, Mittel- und Endbild, darunter der Filmstreifen, links der KI-Assistent" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/chihyungchang/Shotloop/releases/latest"><b>Für macOS herunterladen</b></a> ·
  <a href="https://github.com/chihyungchang/Shotloop/releases">Releases</a> ·
  <a href="#aus-dem-quellcode-bauen">Aus dem Quellcode bauen</a>
</p>

<p align="center">
  <a href="https://github.com/chihyungchang/Shotloop/releases/latest"><img alt="release" src="https://img.shields.io/github/v/release/chihyungchang/Shotloop?style=flat&color=14b8a6&label=release" /></a>
  <img alt="platform" src="https://img.shields.io/badge/macOS-Apple%20silicon-111?style=flat&logo=apple" />
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat" /></a>
  <img alt="built with" src="https://img.shields.io/badge/Tauri%202-React-24c8db?style=flat&logo=tauri&logoColor=white" />
</p>

<p align="center"><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <b>Deutsch</b> · <a href="README.it.md">Italiano</a> · <a href="README.ru.md">Русский</a> · <a href="README.tr.md">Türkçe</a> · <a href="README.vi.md">Tiếng Việt</a> · <a href="README.id.md">Bahasa Indonesia</a></p>

---

## Was ist Shotloop

Shotloop ist eine Desktop-App für kurze Videos, die mit Code gezeichnet werden: Produktvideos, Wissenschaftserklärungen, Datengeschichten und Animationen im Folienstil – in 2D (Webseiten, Bild für Bild gerendert) oder 3D (three.js-Welten, gerendert wie mit einem Offline-Renderer), in acht visuellen Stilen.

Du beginnst mit einem Satz. Die KI wählt, wie er gezeigt wird (filmische Szene, Infografik, Karte, Interface-Demo, Blaupause, Kinetic Type, Nachrichtenstory oder 3D), und ein Theme – außer du wählst selbst. Sie schreibt Hook, Skript und Fakten mit Quellen und teilt alles in ein Storyboard auf, mit dem Satz, den ein Sprecher über jeden Shot spricht. Du bearbeitest das Storyboard, die KI baut jeden Shot. Im Studio siehst du dir jeden Shot an und sagst in einfachen Worten, was nicht stimmt, etwa „die Schrift ist zu klein“ oder „zu statisch: bring etwas Bewegung rein“. Die KI ändert diesen Shot, rendert ihn, prüft ihn anhand der Notizen und zeigt dir einen Vorher-Nachher-Vergleich. Wenn der Film passt, fügt „Exportieren“ die Shots zusammen und legt den Sprecher mit seinen Untertiteln und darunter die Musik an. Die KI gestaltet ein Cover im Look des Films (oder füllt die Vorlage deiner Serie) und schreibt den Post für jede Plattform – alles in einem eigenen Ordner.

Die KI ist die, die du schon nutzt: Claude Code oder ein anderer Coding-Agent, bei dem du angemeldet bist, eine Modell-API mit eigenem Schlüssel oder ein lokales Modell.

Die App spricht 14 Sprachen: English, 简体中文, 繁體中文, 日本語, 한국어, Español, Português, Français, Deutsch, Italiano, Русский, Türkçe, Tiếng Việt und Bahasa Indonesia. Sie folgt der Sprache deines Macs; die KI antwortet und schreibt die Posts in der Sprache, die du wählst.

## Gemacht mit Shotloop

Jedes Bild unten hat Shotloop aus den mitgelieferten [Beispielen](examples/) gerendert.

<table>
<tr>
<td width="25%" valign="top"><img src="docs/screenshots/film-3d.gif" alt="Eine mechanische Uhr dreht sich und öffnet sich dann zu einer Explosionsansicht ihres Uhrwerks" /><br/><sub><b>3D</b>: eine mechanische Uhr in WebGL.</sub></td>
<td width="25%" valign="top"><img src="docs/screenshots/film-2d.gif" alt="Ein Lichtimpuls wandert mit einem Timer von der Sonne zur Erde" /><br/><sub><b>2D</b>: wie lange Sonnenlicht bis zur Erde braucht.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/film-chart.gif" alt="Ein Diagramm von 0,99 hoch 365, das auf 0,027 fällt" /><br/><sub><b>2D-Daten</b>: jeden Tag 1 % besser, in Diagrammen (16:9).</sub></td>
</tr>
</table>

## Acht Arten, eine Idee zu zeigen

Die KI wählt den Stil, der zum Thema passt, und begründet ihn; du kannst im Plan wechseln oder auf der Startseite selbst einen wählen. Jedes Bild ist ein Frame aus dem verlinkten Beispiel.

<table>
<tr>
<td width="25%" valign="top"><a href="examples/sunlight-en/"><img src="engine/shotloop/styles/scene/1.jpg" alt="Filmische Szene" /></a><br/><sub><b>Filmische Szene</b>: Licht, Tiefe und eine bewegte Kamera, für alles, was man filmen könnte: Weltall, Natur, Physik.</sub></td>
<td width="25%" valign="top"><a href="examples/solar-share-en/"><img src="engine/shotloop/styles/infographic/1.jpg" alt="Infografik" /></a><br/><sub><b>Infografik</b>: Diagramme und bewegte Zahlen, für Statistik, Vergleiche, Geld.</sub></td>
<td width="25%" valign="top"><a href="examples/coffee-map-en/"><img src="engine/shotloop/styles/map/1.jpg" alt="Karte" /></a><br/><sub><b>Karte</b>: Weltkarte, Routen und aufleuchtende Länder, für Orte und Verbreitung.</sub></td>
<td width="25%" valign="top"><a href="examples/fake-parcel-text-en/"><img src="engine/shotloop/styles/ui/1.jpg" alt="Interface-Demo" /></a><br/><sub><b>Interface-Demo</b>: ein Smartphone oder Browser, Schritt für Schritt, für Apps, Einstellungen und Betrugsmaschen.</sub></td>
</tr>
<tr>
<td width="25%" valign="top"><a href="examples/zipper-blueprint-en/"><img src="engine/shotloop/styles/blueprint/1.jpg" alt="Blaupause" /></a><br/><sub><b>Blaupause</b>: Strichzeichnung auf Raster, Explosionsansichten und Beschriftungen, dafür, wie eine Maschine funktioniert.</sub></td>
<td width="25%" valign="top"><a href="examples/chinese-words-en/"><img src="engine/shotloop/styles/kinetic/1.jpg" alt="Kinetic Type" /></a><br/><sub><b>Kinetic Type</b>: riesige, bewegte Schrift, für Zitate, Wörter und Mythen.</sub></td>
<td width="25%" valign="top"><a href="examples/bybit-heist-en/"><img src="engine/shotloop/styles/news/1.jpg" alt="Nachrichtenstory" /></a><br/><sub><b>Nachrichtenstory</b>: Eilmeldungen mit Spannung erzählt: laufende Uhr, Geldspur, Zeitleiste, wer was gesagt hat.</sub></td>
<td width="25%" valign="top"><a href="examples/watch-3d-en/"><img src="engine/shotloop/styles/3d/1.jpg" alt="3D" /></a><br/><sub><b>3D</b>: three.js-Welten mit Studiolicht, weichen Schatten und einer Kamera, die durch den Raum fliegt.</sub></td>
</tr>
</table>

2D-Videos folgen einem Satz von Regeln: festen Regeln, die jedes Bild sauber und das Video wahr halten (nichts verdeckt, keine kaputten Frames, Zeit zum Lesen jeder Zeile, ehrlich, mit Quellen), und einem Hausgeschmack, den du unter Einstellungen → Regeln umformulieren, abschalten oder ergänzen kannst, dazu einer Werkzeugkiste mit Animationsmitteln, die du um eigene erweitern kannst. Sie stehen in [engine/shotloop/rules.mjs](engine/shotloop/rules.mjs) und gehen in jeden 2D-Prompt ein.

## Rundgang

<table>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/home.jpg"><img src="docs/screenshots/home.jpg" alt="Startseite: Eingabe für die Idee mit 2D/3D, Format, Länge, Stil und Theme, darunter die nach Stil filterbare Beispielgalerie" /></a><br/>
<sub><b>Start</b>: ein Satz. 2D oder 3D, Länge, Stil und Theme können auf „Auto“ bleiben. Oder starte mit einem Beispiel aus der Galerie.</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/plan.jpg"><img src="docs/screenshots/plan.jpg" alt="Planungsseite: Text, Hook, Skript und Fakten mit Quellen links, das Storyboard rechts" /></a><br/>
<sub><b>Text &amp; Storyboard</b>: Hook, Skript und Fakten mit Quellen sowie die Shots mit ihrem Inhalt – alles bearbeitbar, bevor etwas gerendert wird.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/studio.jpg"><img src="docs/screenshots/studio.jpg" alt="Studio mit einem 2D-Shot auf der Bühne und dem Filmstreifen" /></a><br/>
<sub><b>Studio</b>: der Shot auf dunkler Bühne, der Filmstreifen sowie Notizen und Prüfungen zu jedem Shot.</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/agent.jpg"><img src="docs/screenshots/agent.jpg" alt="Antwort des KI-Assistenten mit Vorher-Nachher-Vergleich" /></a><br/>
<sub><b>KI-Assistent</b>: sag, was nicht stimmt, und die KI korrigiert diesen Shot. Zieh den Trenner, um Vorher und Nachher zu vergleichen.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/export.jpg"><img src="docs/screenshots/export.jpg" alt="Export-Dialog: Cover, Name und Ordner, Video mit Formaten und Musik sowie der Post-Text" /></a><br/>
<sub><b>Exportieren</b>: Video (hoch, quer), Cover und Post-Text ankreuzen; Cover und Text vorher bearbeiten. Jeder Export landet in einem eigenen Ordner.</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/settings.jpg"><img src="docs/screenshots/settings.jpg" alt="Einstellungen: Modelle und Anbieter, Claude Code erkannt" /></a><br/>
<sub><b>Modelle und Anbieter</b>: ein CLI-Agent, bei dem du angemeldet bist, eine Modell-API mit deinem Schlüssel oder ein lokales Modell.</sub>
</td>
</tr>
</table>

## So funktioniert es

```mermaid
flowchart LR
  A[Idee] --> B[Text &amp; Storyboard]
  B --> C[Jeden Shot bauen]
  C --> D{Shot prüfen}
  D -- "sagen, was nicht stimmt" --> E[KI korrigiert diesen Shot] --> F[Rendern + prüfen] --> D
  D -- passt --> G[Export: zusammenfügen, Sprecher, Musik, Post-Text]
```

- **Shots statt eines langen Renders.** Ein Film ist eine Liste von Shots. Jeder Shot ist ein kleines Programm, `shot.js`, das seine Seite zu einem Zeitpunkt t zeichnet: eine 2D-Seite oder eine three.js-Welt für 3D. Jeder wird über einen Hash seiner Eingaben gecacht, sodass eine Korrektur einen Shot in Sekunden neu rendert und der Export nur noch Clips zusammenfügt.
- **Korrekturen in einfachen Worten.** Die KI ändert nur den aktuellen Shot, außer die Korrektur betrifft die gemeinsame Welt. Sie rendert Standbilder, prüft sie anhand einer Checkliste (lesbar, nichts verdeckt, außerhalb der Untertitelzone usw.) und berichtet, was sie geändert hat.
- **Acht visuelle Stile.** Filmische Szene, Infografik, Karte, Interface-Demo, Blaupause, Kinetic Type, Nachrichtenstory oder 3D, jeder mit eigenem Kit und Referenzbildern, die die KI ansieht, bevor sie wählt und baut ([`engine/shotloop/styles.mjs`](engine/shotloop/styles.mjs)). Ein Theme legt nur Hintergrund und Schrift fest; Bilder und Daten behalten die Farben, die ihr Thema braucht.
- **Regeln, an denen ein Plan gemessen wird.** Untertitel werden auf Länge und Standzeit geprüft, bevor etwas gebaut wird. Ein Bild, das in mehreren Shots vorkommt, wird einmal gezeichnet und geteilt, damit es überall gleich aussieht.
- **Fakten mit Quellen.** Der Text hält jede Tatsache neben ihrer Quelle, und der Post-Text darf nur Fakten aus dem Text verwenden.
- **Cover.** Die KI gestaltet ein Cover im Look des Films und prüft ihre eigenen Renders. Speichere eines als Vorlage, damit eine Serie einheitlich bleibt, oder lade ein Cover hoch, das dir gefällt, und die KI folgt seinem Design.
- **Ein Sprecher, gesprochen auf deinem Mac.** Jeder Shot hat einen Sprechtext, und die Stimme führt den Schnitt: Ein Shot dauert so lange wie sein Text, und das Bild trifft die Worte. Kokoro spricht Englisch, CosyVoice 2 Chinesisch und Supertonic die übrigen Sprachen, alles offline. Untertitel der gesprochenen Worte kommen automatisch dazu, und eine Prüfung listet alles auf, was sie verdecken würden (Text und das markierte Motiv), sodass ein verdeckter Film nie exportiert wird. Für einen Film nur mit Texteinblendungen schaltest du den Sprecher aus.
- **Musik passend zum Schnitt.** Der synthetisierte Klangteppich ist so abgestimmt, dass die Schnitte auf seine Beats fallen; er läuft bis zum letzten Frame und blendet aus. Unter einem Sprecher liegt er leiser und duckt sich, während ein Satz gesprochen wird.
- **3D, das rendert wie ein Offline-Renderer, in Minuten.** Jedes 3D-Bild mittelt mehrere Teilbilder (Kantenglättung, weiche Schatten, Ambient Occlusion, Tiefenschärfe, Bewegungsunschärfe) in etwa einer halben Sekunde, sodass ein 30-Sekunden-Film in wenigen Minuten gerendert ist, ohne dass du etwas installieren musst.
- **Asset-Bibliothek: Modelle und Sounds.** Suche CC0-Modelle auf [Poly Pizza](https://poly.pizza) und [Smithsonian Open Access](https://www.si.edu/openaccess) mit deinem eigenen Schlüssel, und Soundeffekte, Atmos und Musik auf [Openverse](https://openverse.org) (Freesound, Wikimedia, Jamendo) ohne Schlüssel; vor dem Download kannst du reinhören. Alles wird einmal geladen und lässt sich in jedes Projekt einfügen: ein Modell in eine 3D-Welt, ein Sound auf einen Beat im Bild oder als Atmo unter den Film.

## Die KI dahinter

| Modus | Was du brauchst |
| --- | --- |
| **Lokaler CLI-Agent** | [Claude Code](https://docs.anthropic.com/en/docs/claude-code), auf diesem Mac angemeldet (Codex CLI und Gemini CLI sind experimentell). Läuft headless mit abgeschalteten eigenen Tools und arbeitet nur über die Tools von Shotloop. |
| **Modell-API** | Dein eigener Schlüssel. Voreinstellungen für Anthropic, OpenAI, Google Gemini, OpenRouter, xAI, Mistral, Together, DeepSeek, Qwen, Kimi, GLM, MiniMax, Doubao und SiliconFlow oder jeden Anthropic- bzw. OpenAI-kompatiblen Endpunkt. Schlüssel bleiben auf deinem Mac. |
| **Lokales Modell** | Ollama, LM Studio, vLLM, llama.cpp oder ein beliebiger OpenAI-kompatibler Server. |

Das Modell braucht Tool-Calling, für Prüfungen eines, das Bilder sehen kann. Der Agent arbeitet mit einem schmalen Satz an Tools: Er kann die Dateien des Shots lesen und schreiben, Standbilder rendern und Prüfungen melden. Shell-Befehle kann er nicht ausführen.

## Installation

1. Lade `Shotloop_<version>_aarch64.dmg` vom [neuesten Release](https://github.com/chihyungchang/Shotloop/releases/latest), öffne es und zieh Shotloop in „Programme“.
2. Installiere **Google Chrome** (2D-Shots werden darin gerendert).
3. Wähle die KI unter Einstellungen → Modelle und Anbieter. Ist Claude Code schon auf deinem Mac, wird es automatisch gewählt.

> **Erster Start:** Shotloop ist noch nicht von Apple notarisiert, daher meldet macOS, dass der Entwickler nicht überprüft werden kann. Öffne die App einmal über **Systemeinstellungen → Datenschutz & Sicherheit → Dennoch öffnen** oder führe im Terminal `xattr -dr com.apple.quarantine /Applications/Shotloop.app` aus. Danach öffnet sie sich normal, und Updates installieren sich ohne erneute Nachfrage.

Node.js, ffmpeg und die Sprach-Engines des Sprechers sind in der App enthalten. Die Stimmmodelle nicht: Jedes wird geladen, wenn ein Film zum ersten Mal seine Sprachen spricht (Kokoro für Englisch 132 MB; CosyVoice 2 für Chinesisch etwa 5 GB, samt dem Python, auf dem es läuft; Supertonic für die übrigen Sprachen 400 MB), mit Fortschrittsbalken, oder vorab unter Einstellungen → Abhängigkeiten. Einstellungen → Über listet jede Fremdkomponente mit ihrer Lizenz. Shotloop sucht auf GitHub nach Updates und installiert sie direkt. Läuft auf Macs mit Apple Silicon (M1 und neuer).

## Aus dem Quellcode bauen

```bash
nvm use                      # Node 22.18+ (der Agent führt TypeScript direkt aus)
corepack enable              # einmalig: liefert das festgelegte pnpm
pnpm install
pnpm app                     # tauri dev; braucht die Rust-Toolchain
pnpm app:build               # Shotloop.app und ein dmg, mit Node und ffmpeg darin
```

`pnpm app` nutzt Node und ffmpeg deines Macs und führt alles direkt aus dem Checkout aus. Releases werden für den Updater signiert und mit [`app/scripts/release.mjs`](app/scripts/release.mjs) veröffentlicht.

<details>
<summary><b>Die Engine im Terminal</b></summary>

```bash
pnpm shotloop status   fixtures/ep01-password-crack-time
pnpm shotloop render   fixtures/ep01-password-crack-time --shot 02-stack-16-gpu --stills   # Start/Mitte/Ende
pnpm shotloop render   fixtures/ep01-password-crack-time --shot 02-stack-16-gpu            # ein Clip
pnpm shotloop export   fixtures/ep01-password-crack-time                                   # nur geänderte Shots werden gerendert
pnpm shotloop new      my-short --idea "Warum altert dein Handy-Akku?" --track auto --duration auto
pnpm shotloop new      coffee --idea "Woher kommt Kaffee?" --track 2d --style map --duration 30
pnpm shotloop export   fixtures/ep01-password-crack-time --to ~/Movies/Shotloop --name "Hello"   # in einen neuen Ordner dort
pnpm shotloop covers   list                                         # Cover-Vorlagen
pnpm shotloop voice    my-short --on --voice af_heart --fit        # der Sprecher: Texte sprechen, Shots anpassen
pnpm shotloop check-subtitles my-short                              # was die Untertitel verdecken würden (schlägt fehl, wenn etwas)
pnpm shotloop voice-models --download kokoro-en                     # ein Sprachmodell, vorab
pnpm shotloop doctor
```

Mit `--json` gibt es zeilenweise Events (das liest die App). Der Agent läuft genauso:

```bash
node agent/src/main.ts detect                                         # CLI-Agenten und lokale Server auf diesem Mac
SHOTLOOP_PROVIDER=cli SHOTLOOP_CLI=claude node agent/src/main.ts check fixtures/ep01-password-crack-time --shot 01-password-field-dots
pnpm test                                                             # jedes Backend gegen gescriptete Platzhalter
```

</details>

<details>
<summary><b>Projektformat</b></summary>

```
my-video/
  shotloop.json        Titel, Track (2d|3d), Stil, Größe, fps, Sprache, Sprecher { on, voice, speed },
                       Shots [{ id, title, duration, say (der gesprochene Text), cues (die Zeiten seiner Sätze) }]
  storyboard.json      der Plan: Text (Hook, Skript, Fakten mit Quellen) und Shots
  world/               page.html (2D: Kit des Stils; 3D: das WebGL-Kit), 2D: parts.js (wiederkehrende
                       Bilder, einmal gezeichnet), geo.data.js (Länder des Kartenstils); 3D: *.js (Sets, Maschinen)
  shots/<id>/          shot.js, notes.md (muss zeigen, im Bild, Bewegung, Ton), sounds.json (seine Soundeffekte)
  assets/<id>/         Modelle und Sounds aus der Asset-Bibliothek
  copy.md  script.md  music.json  thumb.html  publish.json
  .shotloop/           Cache: pro Shot und Eingabe-Hash, Takes, Prüfungen, Korrekturen; voice/: gesprochene Texte, Untertitel
  out/                 Exporte der Engine (mit Zeitstempel); die App kopiert jeden in einen neuen Ordner deiner Wahl
```

- **3D**: `world/page.html` ist das WebGL-Kit der Engine ([`engine/shotloop/webgl.mjs`](engine/shotloop/webgl.mjs)): eine three.js-Bühne mit Studiolicht, Materialien, Formen, glTF-Modellen, objektivbasierten Kameras und Schrift darüber. Sets und Maschinen, die die Shots teilen, liegen in `world/*.js`; ein Shot baut in `setup(ctx)` auf, was er zeigt, und stellt es in `render(t)` für `t` ein.
- **2D**: `shot.js` exportiert standardmäßig `render(t, ctx)`, das `world/page.html` zur Shot-lokalen Zeit `t` zeichnet. `ctx.voice` enthält die gesprochenen Sätze des Shots mit ihren Zeiten, damit das Bild die Worte trifft; markiere das Motiv mit `data-keep` (oder `subtitles.keep()` auf einem Canvas), damit die Untertitel-Prüfung es frei hält.
- **Cache**: Der Schlüssel eines Shots hasht Welt, Code, Modelle, Renderer und Einstellungen. Unveränderte Shots werden wiederverwendet.

</details>

<details>
<summary><b>Aufbau des Repositorys</b></summary>

| Pfad | Inhalt |
| --- | --- |
| [`app/`](app/) | Die Desktop-App: eine Tauri-2-Shell (Rust) mit Render-Warteschlange, Updater und Prozessüberwachung sowie die UI in React + TypeScript. |
| [`engine/shotloop/`](engine/shotloop/) | Die Shot-Engine: Projektformat, Render-Cache pro Shot, 2D- und 3D-Renders (three.js) in Chrome, Filmmontage, MP4-Export, Timing des Sprechers, Untertitel und ihre Prüfung, Musik, Asset-Bibliothek. Eine CLI, die die App aufruft. |
| [`voice/`](voice/) | Die Sprachausgabe des Sprechers, auf diesem Mac: Kokoro über sherpa-onnx, Supertonic auf ONNX Runtime und CosyVoice 2 in einem lokalen Python-Server, mit den Downloads der Modelle. |
| [`agent/`](agent/) | Der Agent: Planung, Aufbau, Korrekturen in einfachen Worten, Prüfung anhand der Checkliste, Post-Text. Unterstützt API, CLI (über MCP) und lokale Modelle. |
| [`examples/`](examples/) | Die Beispiele auf der Startseite, auf Englisch: mindestens eines pro visuellem Stil (2D und 3D, 9:16 und 16:9). |
| [`fixtures/`](fixtures/) | Projekte für die Tests und Terminal-Walkthroughs. |

</details>

## Danksagung

Shotloop baut auf Open-Source-Arbeit auf. Danke an die Menschen hinter:

- **Der Sprecher:** [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) von hexgrad und [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (Englisch); [CosyVoice 2](https://github.com/FunAudioLLM/CosyVoice) von FunAudioLLM mit [Matcha-TTS](https://github.com/shivammehta25/Matcha-TTS), [WeTextProcessing](https://github.com/wenet-e2e/WeTextProcessing), [Whisper](https://github.com/openai/whisper), [PyTorch](https://pytorch.org) und [Transformers](https://github.com/huggingface/transformers) (Chinesisch); [Supertonic](https://huggingface.co/Supertone/supertonic-3) von Supertone (die übrigen Sprachen); [ONNX Runtime](https://onnxruntime.ai); [uv](https://github.com/astral-sh/uv) und [Python](https://www.python.org), die die chinesische Stimme ausführen.
- **Rendering und Film:** [FFmpeg](https://ffmpeg.org), [Google Chrome](https://www.google.com/chrome/) über das DevTools-Protokoll, [three.js](https://threejs.org) und [Node.js](https://nodejs.org).
- **Die App:** [Tauri](https://tauri.app), [React](https://react.dev), das [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) und das [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk).
- **Assets und Daten:** [Kenney](https://kenney.nl), [Poly Haven](https://polyhaven.com), [Quaternius](https://quaternius.com), [Poly Pizza](https://poly.pizza), [Smithsonian Open Access](https://www.si.edu/openaccess), [Openverse](https://openverse.org) und [Natural Earth](https://www.naturalearthdata.com) über [world-atlas](https://github.com/topojson/world-atlas).

Einstellungen → Über listet jede Komponente mit Version und Lizenz, und [NOTICE](NOTICE) enthält die Details.

## Datenschutz

Einmal am Tag sendet Shotloop anonyme Zahlen an den Entwickler: Version, Chip, Sprache der Oberfläche und wie viele Filme geplant, gebaut, korrigiert und exportiert wurden (Exporte nach visuellem Stil), mit einer zufälligen Installations-ID. Nie deine Projekte, ihre Namen oder Texte, deine Dateien oder API-Schlüssel, und keine IP-Adresse wird gespeichert. Der erste Start weist darauf hin; ausschalten unter **Einstellungen → Allgemein**. Aus dem Quellcode gebaute Versionen senden nie ([`app/src-tauri/src/telemetry.rs`](app/src-tauri/src/telemetry.rs)). Der vollständige [Datenschutzhinweis](https://oliverz.dev/de/products/shotloop/privacy) listet alles, was Shotloop speichert und sendet.

## Lizenz

[Apache License 2.0](LICENSE); siehe [NOTICE](NOTICE). Modelle und Sounds aus der Asset-Bibliothek behalten ihre eigenen Lizenzen (CC0 oder CC-BY, mit Namensnennung im Projekt), ebenso die Stimmmodelle (Kokoro und CosyVoice 2: Apache-2.0; Supertonic: OpenRAIL-M).

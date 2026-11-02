<h1 align="center">
  <img src="docs/screenshots/logo.png" alt="" width="72" /><br/>
  Shotloop
</h1>

<p align="center"><b>Des vidéos explicatives courtes faites avec du code, un plan à la fois.</b><br/>
Une idée devient un texte, un storyboard et un film composé de plans. Chaque plan a sa propre boucle : l’IA l’écrit, Shotloop en fait le rendu, vous le relisez et l’IA le corrige. Une correction ne refait le rendu que de ce plan, pas du film entier.</p>

<p align="center">
  <img src="docs/screenshots/hero.jpg" alt="Le Studio de Shotloop : un démontage de téléphone en 3D, son plan en vue éclatée en images de début, de milieu et de fin, la pellicule en dessous et l’assistant IA à gauche" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/chihyungchang/Shotloop/releases/latest"><b>Télécharger pour macOS</b></a> ·
  <a href="https://github.com/chihyungchang/Shotloop/releases">Versions</a> ·
  <a href="#compiler-depuis-les-sources">Compiler depuis les sources</a>
</p>

<p align="center">
  <a href="https://github.com/chihyungchang/Shotloop/releases/latest"><img alt="release" src="https://img.shields.io/github/v/release/chihyungchang/Shotloop?style=flat&color=14b8a6&label=release" /></a>
  <img alt="platform" src="https://img.shields.io/badge/macOS-Apple%20silicon-111?style=flat&logo=apple" />
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat" /></a>
  <img alt="built with" src="https://img.shields.io/badge/Tauri%202-React-24c8db?style=flat&logo=tauri&logoColor=white" />
</p>

<p align="center"><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <b>Français</b> · <a href="README.de.md">Deutsch</a> · <a href="README.it.md">Italiano</a> · <a href="README.ru.md">Русский</a> · <a href="README.tr.md">Türkçe</a> · <a href="README.vi.md">Tiếng Việt</a> · <a href="README.id.md">Bahasa Indonesia</a></p>

---

## Qu’est-ce que Shotloop

Shotloop est une application de bureau pour les vidéos courtes dessinées avec du code : promos produit, vulgarisation scientifique, récits de données et animations façon diapos, en 2D (des pages web rendues image par image) ou en 3D (des scènes Blender), dans huit styles visuels.

Vous partez d’une phrase. L’IA choisit comment la montrer (scène cinématique, infographie, carte, démo d’interface, plan technique, typo animée, récit d’actualité ou 3D) et un thème, sauf si vous les choisissez. Elle écrit l’accroche, le script et les faits avec leurs sources, puis les découpe en storyboard, avec la réplique qu’une voix off dit sur chaque plan. Vous modifiez le storyboard, et l’IA construit chaque plan. Dans le Studio, vous regardez chaque plan et dites ce qui ne va pas avec vos mots, par exemple « le texte est trop petit » ou « c’est trop statique : ajoute du mouvement ». L’IA modifie ce plan, en fait le rendu, le vérifie par rapport aux notes et vous montre un avant/après. Quand le film tient la route, l’Export assemble les plans, pose la voix off avec ses sous-titres et la musique en dessous ; l’IA conçoit une couverture dans le style du film (ou remplit le modèle de votre série) et rédige le post pour chaque plateforme, le tout dans un dossier dédié.

L’IA est celle que vous utilisez déjà : Claude Code ou un autre agent de code auquel vous êtes connecté, une API de modèle avec votre propre clé, ou un modèle local.

L’application parle 14 langues : English, 简体中文, 繁體中文, 日本語, 한국어, Español, Português, Français, Deutsch, Italiano, Русский, Türkçe, Tiếng Việt et Bahasa Indonesia. Elle suit la langue de votre Mac, et l’IA répond et rédige les posts de publication dans celle que vous choisissez.

## Fait avec Shotloop

Chaque image ci-dessous a été rendue par Shotloop à partir des [exemples](examples/) fournis avec l’application.

<table>
<tr>
<td width="25%" valign="top"><img src="docs/screenshots/film-3d.gif" alt="Un téléphone qui s’ouvre en vue éclatée de ses couches" /><br/><sub><b>3D</b> : un démontage de téléphone dans Blender.</sub></td>
<td width="25%" valign="top"><img src="docs/screenshots/film-2d.gif" alt="Une impulsion de lumière qui voyage du Soleil à la Terre, avec un chronomètre" /><br/><sub><b>2D</b> : combien de temps la lumière du Soleil met pour atteindre la Terre.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/film-chart.gif" alt="Un graphique de 0,99 puissance 365 qui tombe à 0,027" /><br/><sub><b>Données 2D</b> : 1 % de mieux chaque jour, en graphiques (16:9).</sub></td>
</tr>
</table>

## Huit façons de montrer une idée

L’IA choisit le style adapté au sujet et vous explique pourquoi ; vous pouvez en changer sur le plan, ou en choisir un sur l’Accueil. Chaque image est tirée de l’exemple vers lequel elle pointe.

<table>
<tr>
<td width="25%" valign="top"><a href="examples/sunlight-en/"><img src="engine/shotloop/styles/scene/1.jpg" alt="Scène cinématique" /></a><br/><sub><b>Scène cinématique</b> : lumière, profondeur et caméra en mouvement, pour ce qu’on pourrait filmer : l’espace, la nature, la physique.</sub></td>
<td width="25%" valign="top"><a href="examples/solar-share-en/"><img src="engine/shotloop/styles/infographic/1.jpg" alt="Infographie" /></a><br/><sub><b>Infographie</b> : graphiques et chiffres animés, pour les statistiques, les comparaisons, l’argent.</sub></td>
<td width="25%" valign="top"><a href="examples/coffee-map-en/"><img src="engine/shotloop/styles/map/1.jpg" alt="Carte" /></a><br/><sub><b>Carte</b> : la carte du monde, des itinéraires et des pays qui s’allument, pour les lieux et la façon dont les choses se répandent.</sub></td>
<td width="25%" valign="top"><a href="examples/fake-parcel-text-en/"><img src="engine/shotloop/styles/ui/1.jpg" alt="Démo d’interface" /></a><br/><sub><b>Démo d’interface</b> : un téléphone ou un navigateur, étape par étape, pour les applis, les réglages et les arnaques.</sub></td>
</tr>
<tr>
<td width="25%" valign="top"><a href="examples/zipper-blueprint-en/"><img src="engine/shotloop/styles/blueprint/1.jpg" alt="Plan technique" /></a><br/><sub><b>Plan technique</b> : dessin au trait sur une grille, vues éclatées et légendes, pour le fonctionnement d’une machine.</sub></td>
<td width="25%" valign="top"><a href="examples/chinese-words-en/"><img src="engine/shotloop/styles/kinetic/1.jpg" alt="Typo animée" /></a><br/><sub><b>Typo animée</b> : d’énormes caractères en mouvement, pour les citations, les mots et les idées reçues.</sub></td>
<td width="25%" valign="top"><a href="examples/bybit-heist-en/"><img src="engine/shotloop/styles/news/1.jpg" alt="Récit d’actualité" /></a><br/><sub><b>Récit d’actualité</b> : l’actualité racontée avec tension : une horloge qui tourne, la piste de l’argent, la chronologie, qui a dit quoi.</sub></td>
<td width="25%" valign="top"><a href="examples/watch-3d-en/"><img src="engine/shotloop/styles/3d/1.jpg" alt="3D" /></a><br/><sub><b>3D</b> : des scènes Blender avec une vraie lumière et une caméra qui traverse l’espace.</sub></td>
</tr>
</table>

Les vidéos 2D suivent un ensemble de règles : des règles fixes qui gardent chaque image propre et la vidéo fidèle (rien de masqué, aucune image ratée, le temps de lire chaque ligne, honnêteté, sources citées), et un goût maison que vous pouvez reformuler, désactiver ou compléter dans Réglages → Règles, avec une boîte à outils de procédés d’animation que vous pouvez enrichir des vôtres. Elles sont décrites dans [engine/shotloop/rules.mjs](engine/shotloop/rules.mjs) et reprises dans chaque prompt 2D.

## Visite guidée

<table>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/home.jpg"><img src="docs/screenshots/home.jpg" alt="Accueil : un champ pour l’idée avec 2D/3D, format, durée, style et thème, et la galerie d’exemples filtrée par style" /></a><br/>
<sub><b>Accueil</b> : une phrase. 2D ou 3D, la durée, le style et le thème peuvent rester sur Auto. Ou partez d’un exemple de la galerie.</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/plan.jpg"><img src="docs/screenshots/plan.jpg" alt="Page de planification : texte, accroche, script et faits sourcés à gauche, le storyboard à droite" /></a><br/>
<sub><b>Texte et storyboard</b> : l’accroche, le script et les faits sourcés, et les plans avec ce que chacun montre, tout modifiable avant le moindre rendu.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/studio.jpg"><img src="docs/screenshots/studio.jpg" alt="Le Studio avec un plan 2D sur la scène et la pellicule" /></a><br/>
<sub><b>Studio</b> : le plan sur une scène sombre, la pellicule, et les notes et vérifications de chaque plan.</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/agent.jpg"><img src="docs/screenshots/agent.jpg" alt="La réponse de l’assistant IA avec une vue de comparaison avant/après" /></a><br/>
<sub><b>Assistant IA</b> : dites ce qui ne va pas et l’IA corrige ce plan. Faites glisser le séparateur pour comparer avant et après.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/export.jpg"><img src="docs/screenshots/export.jpg" alt="Fenêtre d’export : la couverture, le nom et le dossier, la vidéo avec ses formats et sa musique, et le texte de publication" /></a><br/>
<sub><b>Export</b> : cochez la vidéo (verticale, horizontale), la couverture et le texte de publication ; modifiez d’abord la couverture et le texte. Chaque export va dans son propre dossier.</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/settings.jpg"><img src="docs/screenshots/settings.jpg" alt="Réglages : modèles et fournisseurs, avec Claude Code détecté" /></a><br/>
<sub><b>Modèles et fournisseurs</b> : un agent CLI auquel vous êtes connecté, une API de modèle avec votre clé, ou un modèle local.</sub>
</td>
</tr>
</table>

## Comment ça marche

```mermaid
flowchart LR
  A[Idée] --> B[Texte et storyboard]
  B --> C[Construire chaque plan]
  C --> D{Relire un plan}
  D -- "dire ce qui ne va pas" --> E[L’IA corrige ce plan] --> F[Rendu + vérification] --> D
  D -- c’est bon --> G[Export : assemblage, voix off, musique, texte de publication]
```

- **Des plans, pas un seul long rendu.** Un film est une liste de plans. Chaque plan est un petit programme : `shot.js` pour une page 2D, `shot.py` pour un mouvement de caméra Blender. Chacun est mis en cache selon un hash de ses entrées, si bien qu’une correction refait le rendu d’un seul plan en quelques secondes (2D) ou une minute (3D), et l’Export ne fait qu’assembler les clips.
- **Des corrections en langage courant.** L’IA ne touche qu’au plan sur lequel vous êtes, sauf si la correction exige de modifier le monde partagé. Elle rend des images fixes, les vérifie selon une checklist (lisible, rien de masqué, hors de la zone des légendes, etc.) et indique ce qu’elle a changé.
- **Huit styles visuels.** Scène cinématique, infographie, carte, démo d’interface, plan technique, typo animée, récit d’actualité ou 3D, chacun avec son kit et ses images de référence, que l’IA consulte avant de choisir et de construire ([`engine/shotloop/styles.mjs`](engine/shotloop/styles.mjs)). Un thème ne définit que le fond et la typo ; les images et les données gardent les couleurs que leur sujet exige.
- **Des règles pour évaluer un plan.** La longueur des légendes et leur durée d’affichage sont vérifiées avant toute construction. Une image qui revient dans plusieurs plans est dessinée une seule fois et partagée, pour rester identique partout.
- **Des faits sourcés.** Le texte garde chaque fait à côté de sa source, et le texte de publication ne peut utiliser que les faits du texte.
- **Couvertures.** L’IA conçoit une couverture dans le style du film et vérifie ses propres rendus. Enregistrez-en une comme modèle pour garder une série cohérente, ou importez une couverture qui vous plaît et l’IA suit sa mise en page.
- **Une voix off, générée sur votre Mac.** Chaque plan a sa réplique, et la voix mène le montage : un plan dure le temps de sa réplique, et l’image tombe sur les mots. Kokoro parle anglais, CosyVoice 2 chinois et Supertonic les autres langues, le tout hors ligne. Les sous-titres des mots prononcés sont ajoutés automatiquement, et une vérification liste tout ce qu’ils masqueraient (le texte et le sujet marqué), si bien qu’un film masqué n’est jamais exporté. Désactivez la voix off pour un film avec des légendes seulement.
- **Une musique calée sur le montage.** La nappe synthétisée est réglée pour que les coupes tombent sur ses temps ; elle dure jusqu’à la dernière image puis s’estompe. Sous une voix off, elle est plus basse et s’efface pendant chaque réplique.
- **Rapide en édition, pleine qualité à l’export.** La 3D affiche des aperçus rapides pendant l’édition et ne rend les images en pleine qualité qu’à l’export. La 2D reste en pleine qualité tout du long.
- **Bibliothèque d’assets 3D.** Cherchez des modèles CC0 sur [Poly Pizza](https://poly.pizza) et [Smithsonian Open Access](https://www.si.edu/openaccess) avec votre propre clé. Chaque modèle n’est téléchargé qu’une fois et peut être ajouté à n’importe quel projet 3D.

## L’IA aux commandes

| Mode | Ce qu’il faut |
| --- | --- |
| **Agent CLI local** | [Claude Code](https://docs.anthropic.com/en/docs/claude-code), connecté sur ce Mac (Codex CLI et Gemini CLI sont expérimentaux). Il tourne sans interface, avec ses propres outils désactivés, et n’agit que par les outils de Shotloop. |
| **API de modèle** | Votre propre clé. Préréglages pour Anthropic, OpenAI, Google Gemini, OpenRouter, xAI, Mistral, Together, DeepSeek, Qwen, Kimi, GLM, MiniMax, Doubao et SiliconFlow, ou tout endpoint compatible Anthropic ou OpenAI. Les clés restent sur votre Mac. |
| **Modèle local** | Ollama, LM Studio, vLLM, llama.cpp ou tout serveur compatible OpenAI. |

Le modèle doit gérer l’appel d’outils, et les vérifications demandent un modèle qui voit les images. L’agent travaille avec un jeu d’outils restreint : il peut lire et écrire les fichiers du plan, rendre des images fixes et rapporter les vérifications. Il ne peut pas lancer de commandes shell.

## Installation

1. Téléchargez `Shotloop_<version>_aarch64.dmg` depuis la [dernière version](https://github.com/chihyungchang/Shotloop/releases/latest), ouvrez-le et glissez Shotloop dans Applications.
2. Installez **Google Chrome** (les plans 2D y sont rendus). Pour les projets 3D, Shotloop vous demande **Blender** la première fois que vous en créez un.
3. Choisissez l’IA dans Réglages → Modèles et fournisseurs. Claude Code est sélectionné d’office s’il est déjà sur votre Mac.

> **Premier lancement :** Shotloop n’est pas encore notarié par Apple, donc macOS indique qu’il ne peut pas vérifier le développeur. Ouvrez-le une fois via **Réglages Système → Confidentialité et sécurité → Ouvrir quand même**, ou lancez `xattr -dr com.apple.quarantine /Applications/Shotloop.app` dans le Terminal. Ensuite, il s’ouvre normalement et les mises à jour s’installent sans redemander.

Node.js, ffmpeg et les moteurs de synthèse vocale de la voix off sont inclus dans l’application. Les modèles de voix ne le sont pas : chacun se télécharge la première fois qu’un film parle ses langues (Kokoro pour l’anglais 132 MB ; CosyVoice 2 pour le chinois environ 5 GB, avec le Python sur lequel il tourne ; Supertonic pour les autres langues 400 MB), avec une barre de progression, ou à l’avance dans Réglages → Dépendances. Réglages → À propos liste chaque composant tiers avec sa licence. Shotloop cherche les mises à jour sur GitHub et les installe sur place. Il fonctionne sur les Mac avec puce Apple (M1 et suivants).

## Compiler depuis les sources

```bash
nvm use                      # Node 22.18+ (l’agent exécute directement le TypeScript)
corepack enable              # une seule fois : fournit la version épinglée de pnpm
pnpm install
pnpm app                     # tauri dev ; nécessite la chaîne d’outils Rust
pnpm app:build               # Shotloop.app et un dmg, avec Node et ffmpeg inclus
```

`pnpm app` utilise le Node et le ffmpeg de votre Mac et exécute tout depuis le dépôt cloné. Les versions sont signées pour le système de mise à jour et publiées avec [`app/scripts/release.mjs`](app/scripts/release.mjs).

<details>
<summary><b>Le moteur depuis un terminal</b></summary>

```bash
pnpm shotloop status   fixtures/hello-3d
pnpm shotloop render   fixtures/hello-3d --shot 02-close --stills   # début/milieu/fin
pnpm shotloop render   fixtures/hello-3d --shot 02-close            # un clip, en qualité d’édition
pnpm shotloop export   fixtures/hello-3d                            # seuls les plans modifiés sont rendus
pnpm shotloop new      my-short --idea "Pourquoi la batterie de votre téléphone vieillit-elle ?" --track auto --duration auto
pnpm shotloop new      coffee --idea "D’où vient le café ?" --track 2d --style map --duration 30
pnpm shotloop export   fixtures/hello-3d --to ~/Movies/Shotloop --name "Hello"   # dans un nouveau dossier à cet endroit
pnpm shotloop covers   list                                         # modèles de couverture
pnpm shotloop voice    my-short --on --voice af_heart --fit        # la voix off : dire les répliques, ajuster les plans
pnpm shotloop check-subtitles my-short                              # ce que les sous-titres masqueraient (échoue s’il y a quoi que ce soit)
pnpm shotloop voice-models --download kokoro-en                     # un modèle vocal, à l’avance
pnpm shotloop doctor
```

Ajoutez `--json` pour obtenir des événements ligne par ligne (ce que lit l’application). L’agent se lance de la même façon :

```bash
node agent/src/main.ts detect                                         # agents CLI et serveurs locaux sur ce Mac
SHOTLOOP_PROVIDER=cli SHOTLOOP_CLI=claude node agent/src/main.ts check fixtures/hello-3d --shot 01-wide
pnpm test                                                             # chaque backend face à des doublures scriptées
```

</details>

<details>
<summary><b>Format de projet</b></summary>

```
my-video/
  shotloop.json        titre, piste (2d|3d), style, taille, fps, langue, voix { on, voice, speed },
                       plans [{ id, title, duration, say (la réplique dite), cues (les temps de ses phrases) }]
  storyboard.json      le plan : texte (accroche, script, faits sourcés) et plans
  world/               3D : world.py (+ screen.html) ; 2D : page.html (le kit du style), parts.js (images
                       récurrentes, dessinées une fois), geo.data.js (les pays du style carte)
  shots/<id>/          shot.py | shot.js, notes.md (à montrer, à l’écran, mouvement)
  assets/<id>/         modèles 3D de la bibliothèque d’assets
  copy.md  script.md  captions.html  music.json  thumb.html  publish.json
  .shotloop/           cache : par plan et hash d’entrée, prises, vérifications, corrections ; voice/ : répliques dites, sous-titres
  out/                 les exports du moteur (horodatés) ; l’application copie chacun dans un nouveau dossier à l’endroit choisi
```

- **3D** : `world.py` construit le monde partagé avec `kit` ([`engine/shotloop/blender/kit/kit.py`](engine/shotloop/blender/kit/kit.py)). `shot.py` s’exécute dans l’espace de noms du monde et crée une caméra ; `at(t)` convertit les secondes locales du plan en temps du film.
- **2D** : `shot.js` exporte par défaut `render(t, ctx)`, qui dessine `world/page.html` au temps local `t` du plan. `ctx.voice` contient les phrases dites dans le plan avec leurs temps, pour que l’image tombe sur les mots ; marquez le sujet avec `data-keep` (ou `subtitles.keep()` sur un canvas) pour que la vérification des sous-titres le laisse dégagé.
- **Cache** : la clé d’un plan est un hash du monde, de son code, des légendes, des assets, du moteur de rendu et des réglages. Les plans inchangés sont réutilisés.

</details>

<details>
<summary><b>Structure du dépôt</b></summary>

| Chemin | Contenu |
| --- | --- |
| [`app/`](app/) | L’application de bureau : un shell Tauri 2 (Rust) avec la file de rendu, le système de mise à jour et la supervision des processus, et l’interface React + TypeScript. |
| [`engine/shotloop/`](engine/shotloop/) | Le moteur de plans : format de projet, cache de rendu par plan, rendus 2D (Chrome) et 3D (Blender), assemblage du film, export MP4, minutage de la voix off, sous-titres et leur vérification, musique, bibliothèque d’assets. Une CLI appelée par l’application. |
| [`voice/`](voice/) | La synthèse vocale de la voix off, sur ce Mac : Kokoro via sherpa-onnx, Supertonic sur ONNX Runtime et CosyVoice 2 dans un serveur Python local, avec le téléchargement des modèles. |
| [`agent/`](agent/) | L’agent : planification, construction, corrections en langage courant, vérifications selon la checklist, texte de publication. Il prend en charge les API, les CLI (via MCP) et les modèles locaux. |
| [`examples/`](examples/) | Les exemples proposés sur l’Accueil, en anglais : au moins un par style visuel (2D et 3D, 9:16 et 16:9). |
| [`fixtures/`](fixtures/) | Des projets pour les tests et les démonstrations en terminal. |

</details>

## Remerciements

Shotloop repose sur le travail de l’open source. Merci aux personnes derrière :

- **La voix off :** [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) par hexgrad et [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (anglais) ; [CosyVoice 2](https://github.com/FunAudioLLM/CosyVoice) par FunAudioLLM avec [Matcha-TTS](https://github.com/shivammehta25/Matcha-TTS), [WeTextProcessing](https://github.com/wenet-e2e/WeTextProcessing), [Whisper](https://github.com/openai/whisper), [PyTorch](https://pytorch.org) et [Transformers](https://github.com/huggingface/transformers) (chinois) ; [Supertonic](https://huggingface.co/Supertone/supertonic-3) par Supertone (les autres langues) ; [ONNX Runtime](https://onnxruntime.ai) ; [uv](https://github.com/astral-sh/uv) et [Python](https://www.python.org), qui font tourner la voix chinoise.
- **Le rendu et le film :** [FFmpeg](https://ffmpeg.org), [Google Chrome](https://www.google.com/chrome/) via le protocole DevTools, [Blender](https://www.blender.org) et [Node.js](https://nodejs.org).
- **L’application :** [Tauri](https://tauri.app), [React](https://react.dev), [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) et [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk).
- **Assets et données :** [Kenney](https://kenney.nl), [Poly Haven](https://polyhaven.com), [Quaternius](https://quaternius.com), [Poly Pizza](https://poly.pizza), [Smithsonian Open Access](https://www.si.edu/openaccess) et [Natural Earth](https://www.naturalearthdata.com) via [world-atlas](https://github.com/topojson/world-atlas).

Réglages → À propos liste chaque composant avec sa version et sa licence, et [NOTICE](NOTICE) donne les détails.

## Confidentialité

Une fois par jour, Shotloop envoie à son auteur des comptes anonymes : la version, la puce, la langue de l’interface et le nombre de films planifiés, construits, corrigés et exportés (les exports par style visuel), avec un identifiant d’installation aléatoire. Jamais vos projets, leurs noms ou leurs textes, vos fichiers ni vos clés d’API, et aucune adresse IP n’est conservée. Le premier lancement le signale ; désactivez-le dans **Réglages → Général**. Les versions compilées depuis les sources n’envoient jamais rien ([`app/src-tauri/src/telemetry.rs`](app/src-tauri/src/telemetry.rs)). La [note de confidentialité](https://oliverz.dev/fr/products/shotloop/privacy) complète liste tout ce que Shotloop conserve et envoie.

## Licence

[Apache License 2.0](LICENSE) ; voir [NOTICE](NOTICE). Les modèles de la bibliothèque d’assets gardent leur propre licence (CC0 ou CC-BY, avec le crédit inscrit dans le projet), tout comme les modèles de voix (Kokoro et CosyVoice 2 : Apache-2.0 ; Supertonic : OpenRAIL-M).

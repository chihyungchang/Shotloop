<h1 align="center">
  <img src="docs/screenshots/logo.png" alt="" width="72" /><br/>
  Shotloop
</h1>

<p align="center"><b>Làm video giải thích ngắn bằng code, từng cảnh một.</b><br/>
Một ý tưởng trở thành lời văn, phân cảnh và một video gồm nhiều cảnh. Mỗi cảnh có vòng lặp riêng: AI viết, Shotloop render, bạn xem lại và AI sửa. Sửa một cảnh chỉ render lại cảnh đó, không phải cả video.</p>

<p align="center">
  <img src="docs/screenshots/hero.jpg" alt="Trình chỉnh sửa Shotloop: dự án 3D đồng hồ cơ, khung hình đầu, giữa và cuối của cảnh bánh lắc, dải phim bên dưới và Trợ lý AI bên trái" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/chihyungchang/Shotloop/releases/latest"><b>Tải cho macOS</b></a> ·
  <a href="https://github.com/chihyungchang/Shotloop/releases">Các phiên bản</a> ·
  <a href="#build-từ-mã-nguồn">Build từ mã nguồn</a>
</p>

<p align="center">
  <a href="https://github.com/chihyungchang/Shotloop/releases/latest"><img alt="release" src="https://img.shields.io/github/v/release/chihyungchang/Shotloop?style=flat&color=14b8a6&label=release" /></a>
  <img alt="platform" src="https://img.shields.io/badge/macOS-Apple%20silicon-111?style=flat&logo=apple" />
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat" /></a>
  <img alt="built with" src="https://img.shields.io/badge/Tauri%202-React-24c8db?style=flat&logo=tauri&logoColor=white" />
</p>

<p align="center"><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.it.md">Italiano</a> · <a href="README.ru.md">Русский</a> · <a href="README.tr.md">Türkçe</a> · <b>Tiếng Việt</b> · <a href="README.id.md">Bahasa Indonesia</a></p>

---

## Shotloop là gì

Shotloop là ứng dụng desktop để làm video ngắn được vẽ bằng code: quảng bá sản phẩm, giải thích khoa học, kể chuyện bằng dữ liệu và hoạt ảnh kiểu slide, ở dạng 2D (trang web render từng khung hình) hoặc 3D (thế giới three.js được render như bằng trình render offline), với tám phong cách hình ảnh.

Bạn bắt đầu bằng một câu. Nếu bạn không tự chọn, AI sẽ chọn cách thể hiện (cảnh điện ảnh, infographic, bản đồ, demo giao diện, bản vẽ kỹ thuật, chữ chuyển động, kể chuyện tin tức hoặc 3D) và chủ đề màu. AI viết câu mở đầu, kịch bản và các dữ kiện kèm nguồn, rồi chia thành phân cảnh, kèm lời thoại mà giọng lồng tiếng đọc trên từng cảnh. Bạn chỉnh phân cảnh, AI dựng từng cảnh. Trong trình chỉnh sửa, bạn xem từng cảnh và nói điều chưa ổn bằng lời thường, ví dụ "chữ nhỏ quá" hay "tĩnh quá, thêm chút chuyển động đi". AI sửa cảnh đó, render, đối chiếu với ghi chú và cho bạn xem trước/sau. Khi video đã ổn, Xuất sẽ ghép các cảnh, đặt lồng tiếng cùng phụ đề và nhạc nằm bên dưới; AI thiết kế ảnh bìa theo phong cách của video (hoặc điền vào mẫu của series) và viết bài đăng cho từng nền tảng, tất cả trong một thư mục riêng.

AI là cái bạn đang dùng: Claude Code hoặc một coding agent khác đã đăng nhập, API mô hình với khóa của bạn, hoặc mô hình chạy cục bộ.

Ứng dụng có 14 ngôn ngữ: English, 简体中文, 繁體中文, 日本語, 한국어, Español, Português, Français, Deutsch, Italiano, Русский, Türkçe, Tiếng Việt và Bahasa Indonesia. Mặc định theo ngôn ngữ của Mac; AI trả lời và viết bài đăng bằng ngôn ngữ bạn chọn.

## Làm bằng Shotloop

Mọi khung hình dưới đây đều do Shotloop render từ các [ví dụ](examples/) đi kèm.

<table>
<tr>
<td width="25%" valign="top"><img src="docs/screenshots/film-3d.gif" alt="Một chiếc đồng hồ cơ xoay rồi mở ra thành hình nổ tách bộ máy của nó" /><br/><sub><b>3D</b>: đồng hồ cơ trong WebGL.</sub></td>
<td width="25%" valign="top"><img src="docs/screenshots/film-2d.gif" alt="Một xung ánh sáng đi từ Mặt Trời đến Trái Đất cùng đồng hồ đếm" /><br/><sub><b>2D</b>: ánh nắng mất bao lâu để tới Trái Đất.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/film-chart.gif" alt="Biểu đồ 0,99 mũ 365 giảm xuống 0,027" /><br/><sub><b>2D dữ liệu</b>: mỗi ngày tốt hơn 1%, qua biểu đồ (16:9).</sub></td>
</tr>
</table>

## Tám cách thể hiện một ý tưởng

AI chọn phong cách hợp với chủ đề và giải thích lý do; bạn có thể đổi trong bản kế hoạch, hoặc chọn sẵn ở Trang chủ. Mỗi ảnh là một khung hình của ví dụ được liên kết.

<table>
<tr>
<td width="25%" valign="top"><a href="examples/sunlight-en/"><img src="engine/shotloop/styles/scene/1.jpg" alt="Cảnh điện ảnh" /></a><br/><sub><b>Cảnh điện ảnh</b>: ánh sáng, chiều sâu và máy quay chuyển động, cho những thứ quay được: vũ trụ, thiên nhiên, vật lý.</sub></td>
<td width="25%" valign="top"><a href="examples/solar-share-en/"><img src="engine/shotloop/styles/infographic/1.jpg" alt="Infographic" /></a><br/><sub><b>Infographic</b>: biểu đồ và con số chuyển động, cho thống kê, so sánh, tiền bạc.</sub></td>
<td width="25%" valign="top"><a href="examples/coffee-map-en/"><img src="engine/shotloop/styles/map/1.jpg" alt="Bản đồ" /></a><br/><sub><b>Bản đồ</b>: bản đồ thế giới, tuyến đường và quốc gia sáng lên, cho địa điểm và sự lan tỏa.</sub></td>
<td width="25%" valign="top"><a href="examples/fake-parcel-text-en/"><img src="engine/shotloop/styles/ui/1.jpg" alt="Demo giao diện" /></a><br/><sub><b>Demo giao diện</b>: điện thoại hoặc trình duyệt, từng bước, cho ứng dụng, cài đặt và chiêu lừa đảo.</sub></td>
</tr>
<tr>
<td width="25%" valign="top"><a href="examples/zipper-blueprint-en/"><img src="engine/shotloop/styles/blueprint/1.jpg" alt="Bản vẽ kỹ thuật" /></a><br/><sub><b>Bản vẽ kỹ thuật</b>: nét vẽ trên lưới, hình tách lớp và chú thích, cho cách một cỗ máy hoạt động.</sub></td>
<td width="25%" valign="top"><a href="examples/chinese-words-en/"><img src="engine/shotloop/styles/kinetic/1.jpg" alt="Chữ chuyển động" /></a><br/><sub><b>Chữ chuyển động</b>: chữ cỡ lớn chuyển động, cho trích dẫn, từ ngữ và ngộ nhận.</sub></td>
<td width="25%" valign="top"><a href="examples/bybit-heist-en/"><img src="engine/shotloop/styles/news/1.jpg" alt="Kể chuyện tin tức" /></a><br/><sub><b>Kể chuyện tin tức</b>: sự kiện nóng kể đầy kịch tính: đồng hồ chạy không ngừng, dấu vết dòng tiền, dòng thời gian, ai nói gì.</sub></td>
<td width="25%" valign="top"><a href="examples/watch-3d-en/"><img src="engine/shotloop/styles/3d/1.jpg" alt="3D" /></a><br/><sub><b>3D</b>: thế giới three.js với ánh sáng studio, bóng đổ mềm và máy quay bay trong không gian.</sub></td>
</tr>
</table>

Video 2D tuân theo một bộ quy tắc: các quy tắc cố định giữ mọi khung hình sạch sẽ và video trung thực (không che khuất, không có khung hình lỗi, đủ thời gian đọc mọi dòng, trung thực, ghi nguồn), và một gu mặc định mà bạn có thể viết lại, tắt hoặc thêm vào trong Cài đặt → Quy tắc, cùng một hộp công cụ gồm các thủ pháp hoạt hình mà bạn có thể bổ sung thủ pháp của riêng mình. Chúng nằm trong [engine/shotloop/rules.mjs](engine/shotloop/rules.mjs) và có mặt trong mọi prompt 2D.

## Tham quan sản phẩm

<table>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/home.jpg"><img src="docs/screenshots/home.jpg" alt="Trang chủ: ô nhập ý tưởng với 2D/3D, tỉ lệ khung hình, độ dài, phong cách và chủ đề, cùng thư viện ví dụ lọc theo phong cách" /></a><br/>
<sub><b>Trang chủ</b>: một câu là đủ. 2D hay 3D, độ dài, phong cách và chủ đề có thể để Tự động. Hoặc bắt đầu từ một ví dụ trong thư viện.</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/plan.jpg"><img src="docs/screenshots/plan.jpg" alt="Trang kế hoạch: lời văn, câu mở đầu, kịch bản và dữ kiện có nguồn bên trái, phân cảnh bên phải" /></a><br/>
<sub><b>Lời văn &amp; phân cảnh</b>: câu mở đầu, kịch bản, dữ kiện có nguồn, và nội dung từng cảnh, tất cả đều sửa được trước khi render.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/studio.jpg"><img src="docs/screenshots/studio.jpg" alt="Trình chỉnh sửa với một cảnh 2D trên sân khấu và dải phim" /></a><br/>
<sub><b>Trình chỉnh sửa</b>: cảnh trên sân khấu tối, dải phim, ghi chú và kết quả kiểm tra của từng cảnh.</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/agent.jpg"><img src="docs/screenshots/agent.jpg" alt="Câu trả lời của Trợ lý AI với khung so sánh trước/sau" /></a><br/>
<sub><b>Trợ lý AI</b>: nói điều chưa ổn và AI sửa cảnh đó. Kéo thanh chia để so sánh trước và sau.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/export.jpg"><img src="docs/screenshots/export.jpg" alt="Hộp thoại Xuất: ảnh bìa, tên và thư mục, video với tỉ lệ khung hình và nhạc, và bài đăng" /></a><br/>
<sub><b>Xuất</b>: chọn video (dọc, ngang), ảnh bìa và bài đăng; có thể sửa ảnh bìa và bài đăng trước. Mỗi lần xuất vào một thư mục riêng.</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/settings.jpg"><img src="docs/screenshots/settings.jpg" alt="Cài đặt: mô hình và nhà cung cấp, đã phát hiện Claude Code" /></a><br/>
<sub><b>Mô hình và nhà cung cấp</b>: CLI agent bạn đã đăng nhập, API mô hình với khóa của bạn, hoặc mô hình cục bộ.</sub>
</td>
</tr>
</table>

## Cách hoạt động

```mermaid
flowchart LR
  A[Ý tưởng] --> B[Lời văn &amp; phân cảnh]
  B --> C[Dựng mọi cảnh]
  C --> D{Xem lại một cảnh}
  D -- "nói điều chưa ổn" --> E[AI sửa cảnh đó] --> F[Render + kiểm tra] --> D
  D -- ổn rồi --> G[Xuất: ghép, lồng tiếng, nhạc, bài đăng]
```

- **Theo từng cảnh, không phải một lần render dài.** Video là một danh sách cảnh. Mỗi cảnh là một chương trình nhỏ, `shot.js`, vẽ trang của nó tại thời điểm t: một trang 2D, hoặc một thế giới three.js cho 3D. Mỗi cảnh được cache theo hash của đầu vào, nên sửa một cảnh chỉ render lại cảnh đó trong vài giây, và Xuất chỉ ghép các clip.
- **Sửa bằng lời thường.** AI chỉ đụng vào cảnh bạn đang xem, trừ khi cần sửa thế giới dùng chung. AI render khung hình tĩnh, đối chiếu với danh sách kiểm tra (đọc được, không bị che, không lấn vùng phụ đề…) và báo lại đã thay đổi gì.
- **Tám phong cách hình ảnh.** Cảnh điện ảnh, infographic, bản đồ, demo giao diện, bản vẽ kỹ thuật, chữ chuyển động, kể chuyện tin tức hoặc 3D, mỗi phong cách có bộ kit và khung hình tham khảo riêng mà AI xem trước khi chọn và dựng ([`engine/shotloop/styles.mjs`](engine/shotloop/styles.mjs)). Chủ đề chỉ quyết định nền và chữ; hình ảnh và dữ liệu giữ màu mà nội dung cần.
- **Kế hoạch được đo theo quy tắc.** Trước khi dựng, phụ đề được kiểm tra độ dài và thời gian hiển thị. Hình xuất hiện lặp lại qua nhiều cảnh chỉ vẽ một lần và dùng chung, nên trông giống nhau ở mọi cảnh.
- **Dữ kiện có nguồn.** Lời văn giữ mỗi dữ kiện cạnh nguồn của nó, và bài đăng chỉ được dùng dữ kiện có trong lời văn.
- **Ảnh bìa.** AI thiết kế ảnh bìa theo phong cách video và tự kiểm tra bản render. Lưu một ảnh làm mẫu để giữ series đồng nhất, hoặc tải lên ảnh bìa bạn thích để AI làm theo bố cục đó.
- **Lồng tiếng, đọc ngay trên Mac của bạn, khi bạn cần.** Mặc định tắt: hình ảnh quyết định nhịp, kèm chữ trên màn hình. Bật lên thì mỗi cảnh có một lời thoại dẫn nhịp dựng: cảnh dài đúng bằng lời thoại của nó, hình ảnh khớp với từng chữ. Hoặc thêm lời dẫn khi các cảnh đã xong: lời thoại được viết vừa với các cảnh, cảnh giữ nguyên độ dài, và câu hơi dài một chút sẽ kéo qua điểm cắt. Kokoro đọc tiếng Anh, CosyVoice 2 đọc tiếng Trung và Supertonic đọc các ngôn ngữ khác, tất cả đều offline. Phụ đề của lời đọc được thêm tự động, và một bước kiểm tra liệt kê mọi thứ phụ đề sẽ che (chữ và chủ thể được đánh dấu), nên video bị che sẽ không bao giờ được xuất.
- **Âm thanh khi hình đã ổn.** Bấm Âm thanh trong trình chỉnh sửa, AI sẽ xem qua cả video, đặt hiệu ứng âm thanh vào các nhịp của hình (đọc từ code của từng cảnh) và chọn một âm thanh nền. Nghe từng track quanh cảnh đang chọn (lồng tiếng, nhạc, âm thanh nền, hiệu ứng hoặc tất cả cùng lúc), chỉnh ngay tại đó và tắt bất kỳ hiệu ứng nào.
- **Nhạc khớp nhịp cắt.** Nhạc nền tổng hợp được chỉnh để điểm cắt rơi đúng nhịp, chạy đến khung hình cuối rồi nhỏ dần. Khi có lồng tiếng, nhạc nhỏ hơn và hạ xuống mỗi khi một lời thoại được đọc.
- **3D render như trình render offline, chỉ trong vài phút.** Mỗi khung hình 3D lấy trung bình nhiều khung con (khử răng cưa, bóng đổ mềm, ambient occlusion, độ sâu trường ảnh, nhòe chuyển động) trong khoảng nửa giây, nên một video 30 giây render xong trong vài phút, không cần cài gì thêm.
- **Thư viện tài nguyên: mô hình và âm thanh.** Tìm mô hình CC0 trên [Poly Pizza](https://poly.pizza) và [Smithsonian Open Access](https://www.si.edu/openaccess) bằng khóa của bạn, cùng hiệu ứng âm thanh, âm thanh nền và nhạc trên [Openverse](https://openverse.org) (Freesound, Wikimedia, Jamendo) mà không cần khóa; nghe thử trước khi tải. Mỗi tài nguyên chỉ tải một lần và thêm được vào bất kỳ dự án nào: mô hình vào thế giới 3D, âm thanh vào một nhịp của hình ảnh hoặc làm âm thanh nền cho cả phim.

## AI điều khiển

| Chế độ | Bạn cần gì |
| --- | --- |
| **CLI agent cục bộ** | [Claude Code](https://docs.anthropic.com/en/docs/claude-code) đã đăng nhập trên Mac này (Codex CLI và Gemini CLI đang thử nghiệm). Chạy headless, tắt công cụ riêng của nó và chỉ làm việc qua công cụ của Shotloop. |
| **API mô hình** | Khóa của bạn. Có sẵn cấu hình cho Anthropic, OpenAI, Google Gemini, OpenRouter, xAI, Mistral, Together, DeepSeek, Qwen, Kimi, GLM, MiniMax, Doubao và SiliconFlow, hoặc bất kỳ endpoint tương thích Anthropic hay OpenAI. Khóa chỉ lưu trên Mac của bạn. |
| **Mô hình cục bộ** | Ollama, LM Studio, vLLM, llama.cpp hoặc bất kỳ server tương thích OpenAI. |

Mô hình cần hỗ trợ gọi công cụ (tool calling), và việc kiểm tra cần mô hình xem được ảnh. Agent làm việc qua một bộ công cụ hẹp: đọc và ghi file của cảnh, render khung hình tĩnh và báo cáo kết quả kiểm tra. Nó không chạy được lệnh shell.

## Cài đặt

1. Tải `Shotloop_<version>_aarch64.dmg` từ [bản phát hành mới nhất](https://github.com/chihyungchang/Shotloop/releases/latest), mở ra và kéo Shotloop vào Applications.
2. Cần cài **Google Chrome** (cảnh 2D được render bằng nó).
3. Chọn AI trong Cài đặt → Mô hình và nhà cung cấp. Nếu Mac đã có Claude Code, nó sẽ được chọn sẵn.

> **Lần mở đầu tiên:** Shotloop chưa được Apple công chứng (notarize), nên macOS báo không thể xác minh nhà phát triển. Hãy mở một lần từ **Cài đặt hệ thống → Quyền riêng tư & Bảo mật → Vẫn mở**, hoặc chạy `xattr -dr com.apple.quarantine /Applications/Shotloop.app` trong Terminal. Sau đó ứng dụng mở bình thường và các bản cập nhật cài đặt mà không hỏi lại.

Node.js, ffmpeg và các engine đọc giọng của phần lồng tiếng có sẵn trong ứng dụng. Mô hình giọng thì không: mỗi mô hình được tải về, kèm thanh tiến trình, vào lần đầu một video dùng ngôn ngữ của nó (Kokoro cho tiếng Anh 132 MB; CosyVoice 2 cho tiếng Trung khoảng 5 GB, kèm Python để chạy nó; Supertonic cho các ngôn ngữ khác 400 MB), hoặc tải trước trong Cài đặt → Thành phần phụ thuộc. Cài đặt → Giới thiệu liệt kê mọi thành phần bên thứ ba cùng giấy phép của chúng. Shotloop kiểm tra bản cập nhật trên GitHub và cài tại chỗ. Chạy trên Mac dùng Apple silicon (M1 trở lên).

## Build từ mã nguồn

```bash
nvm use                      # Node 22.18+ (the agent runs TypeScript directly)
corepack enable              # once: provides the pinned pnpm
pnpm install
pnpm app                     # tauri dev; needs the Rust toolchain
pnpm app:build               # Shotloop.app and a dmg, with Node and ffmpeg inside
```

`pnpm app` dùng Node và ffmpeg có trên Mac của bạn và chạy mọi thứ từ bản checkout. Các bản phát hành được ký cho trình cập nhật và phát hành bằng [`app/scripts/release.mjs`](app/scripts/release.mjs).

<details>
<summary><b>Dùng engine từ terminal</b></summary>

```bash
pnpm shotloop status   fixtures/ep01-password-crack-time
pnpm shotloop render   fixtures/ep01-password-crack-time --shot 02-stack-16-gpu --stills   # start/middle/end
pnpm shotloop render   fixtures/ep01-password-crack-time --shot 02-stack-16-gpu            # a clip
pnpm shotloop export   fixtures/ep01-password-crack-time                                   # only changed shots render
pnpm shotloop new      my-short --idea "Vì sao pin điện thoại bị chai?" --track auto --duration auto
pnpm shotloop new      coffee --idea "Cà phê đến từ đâu?" --track 2d --style map --duration 30
pnpm shotloop export   fixtures/ep01-password-crack-time --to ~/Movies/Shotloop --name "Hello"   # into a new folder there
pnpm shotloop covers   list                                         # cover templates
pnpm shotloop voice    my-short --on --voice af_heart --fit        # the voice-over: speak the lines, fit the shots
pnpm shotloop check-subtitles my-short                              # what the subtitles would cover (fails if anything)
pnpm shotloop voice-models --download kokoro-en                     # a speech model, ahead of time
pnpm shotloop doctor
```

Thêm `--json` để nhận sự kiện theo từng dòng (thứ ứng dụng đọc). Agent chạy theo cách tương tự:

```bash
node agent/src/main.ts detect                                         # CLI agents and local servers on this Mac
SHOTLOOP_PROVIDER=cli SHOTLOOP_CLI=claude node agent/src/main.ts check fixtures/ep01-password-crack-time --shot 01-password-field-dots
pnpm test                                                             # every backend against scripted stand-ins
```

</details>

<details>
<summary><b>Định dạng dự án</b></summary>

```
my-video/
  shotloop.json        title, track (2d|3d), style, size, fps, lang, voice { on, voice, speed },
                       shots [{ id, title, duration, say (the spoken line), cues (its sentences' times) }]
  storyboard.json      the plan: copy (hook, script, facts with sources) and shots
  world/               page.html (2D: the style's kit; 3D: the WebGL kit), 2D: parts.js (pictures that
                       recur, drawn once), geo.data.js (the map style's countries); 3D: *.js (sets, machines)
  shots/<id>/          shot.js, notes.md (must show, on screen, motion, sound), sounds.json (its sound effects)
  assets/<id>/         models and sounds from the asset library
  copy.md  script.md  music.json  thumb.html  publish.json
  .shotloop/           cache: per shot and input hash, takes, checks, fixes; voice/: spoken lines, subtitles
  out/                 the engine's exports (timestamped); the app copies each into a new folder where you choose
```

- **3D**: `world/page.html` là bộ kit WebGL của engine ([`engine/shotloop/webgl.mjs`](engine/shotloop/webgl.mjs)): một sân khấu three.js với ánh sáng studio, vật liệu, hình khối, mô hình glTF, máy quay mô phỏng ống kính và chữ phía trên. Bối cảnh và cỗ máy mà các cảnh dùng chung nằm trong `world/*.js`; mỗi cảnh dựng những gì nó hiển thị trong `setup(ctx)` và đặt tư thế cho `t` trong `render(t)`.
- **2D**: `shot.js` default-export `render(t, ctx)`, hàm vẽ `world/page.html` tại thời điểm `t` tính theo cảnh. `ctx.voice` chứa các câu được đọc trong cảnh cùng thời điểm của chúng, để hình ảnh khớp với lời; đánh dấu chủ thể bằng `data-keep` (hoặc `subtitles.keep()` trên canvas) để bước kiểm tra phụ đề giữ nó không bị che.
- **Cache**: khóa của một cảnh là hash của thế giới, code của cảnh, mô hình của cảnh, renderer và cài đặt. Cảnh không đổi sẽ được dùng lại.

</details>

<details>
<summary><b>Cấu trúc repository</b></summary>

| Đường dẫn | Nội dung |
| --- | --- |
| [`app/`](app/) | Ứng dụng desktop: vỏ Tauri 2 (Rust) lo hàng đợi render, trình cập nhật và giám sát tiến trình, cùng giao diện React + TypeScript. |
| [`engine/shotloop/`](engine/shotloop/) | Engine cảnh: định dạng dự án, cache render theo cảnh, render 2D và 3D (three.js) trong Chrome, ghép video, xuất MP4, canh thời gian lồng tiếng, phụ đề và bước kiểm tra phụ đề, nhạc, thư viện tài nguyên. Là một CLI mà ứng dụng gọi. |
| [`voice/`](voice/) | Chuyển văn bản thành giọng nói cho phần lồng tiếng, ngay trên Mac này: Kokoro qua sherpa-onnx, Supertonic trên ONNX Runtime và CosyVoice 2 trong một máy chủ Python cục bộ, kèm phần tải mô hình. |
| [`agent/`](agent/) | Agent: lập kế hoạch, dựng cảnh, sửa bằng lời thường, kiểm tra theo danh sách, viết bài đăng. Hỗ trợ API, CLI (qua MCP) và mô hình cục bộ. |
| [`examples/`](examples/) | Các ví dụ Trang chủ cung cấp, bằng tiếng Anh: ít nhất một cho mỗi phong cách (2D và 3D, 9:16 và 16:9). |
| [`fixtures/`](fixtures/) | Dự án cho kiểm thử và hướng dẫn trên terminal. |

</details>

## Lời cảm ơn

Shotloop được xây trên công sức của cộng đồng mã nguồn mở. Cảm ơn những người đứng sau:

- **Lồng tiếng:** [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) của hexgrad và [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (tiếng Anh); [CosyVoice 2](https://github.com/FunAudioLLM/CosyVoice) của FunAudioLLM cùng [Matcha-TTS](https://github.com/shivammehta25/Matcha-TTS), [WeTextProcessing](https://github.com/wenet-e2e/WeTextProcessing), [Whisper](https://github.com/openai/whisper), [PyTorch](https://pytorch.org) và [Transformers](https://github.com/huggingface/transformers) (tiếng Trung); [Supertonic](https://huggingface.co/Supertone/supertonic-3) của Supertone (các ngôn ngữ khác); [ONNX Runtime](https://onnxruntime.ai); [uv](https://github.com/astral-sh/uv) và [Python](https://www.python.org), dùng để chạy giọng tiếng Trung.
- **Kết xuất và video:** [FFmpeg](https://ffmpeg.org), [Google Chrome](https://www.google.com/chrome/) qua giao thức DevTools, [three.js](https://threejs.org) và [Node.js](https://nodejs.org).
- **Ứng dụng:** [Tauri](https://tauri.app), [React](https://react.dev), [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) và [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk).
- **Tài nguyên và dữ liệu:** [Kenney](https://kenney.nl), [Poly Haven](https://polyhaven.com), [Quaternius](https://quaternius.com), [Poly Pizza](https://poly.pizza), [Smithsonian Open Access](https://www.si.edu/openaccess), [Openverse](https://openverse.org), và [Natural Earth](https://www.naturalearthdata.com) qua [world-atlas](https://github.com/topojson/world-atlas).

Cài đặt → Giới thiệu liệt kê mọi thành phần cùng phiên bản và giấy phép, còn [NOTICE](NOTICE) có đầy đủ chi tiết.

## Quyền riêng tư

Mỗi ngày tối đa một lần, Shotloop gửi cho tác giả các số đếm ẩn danh: phiên bản, chip, ngôn ngữ giao diện và số video đã được lên kế hoạch, tạo, sửa và xuất (lượt xuất theo phong cách hình ảnh), kèm một ID cài đặt ngẫu nhiên. Không bao giờ gửi dự án, tên hay chữ trong đó, tệp hoặc khóa API của bạn, và không lưu địa chỉ IP. Lần mở đầu tiên sẽ báo cho bạn; tắt trong **Cài đặt → Chung**. Bản dựng từ mã nguồn không bao giờ gửi ([`app/src-tauri/src/telemetry.rs`](app/src-tauri/src/telemetry.rs)). [Thông báo quyền riêng tư](https://oliverz.dev/products/shotloop/privacy) đầy đủ (tiếng Anh) liệt kê mọi thứ Shotloop lưu và gửi.

## Giấy phép

[Apache License 2.0](LICENSE); xem thêm [NOTICE](NOTICE). Mô hình và âm thanh từ thư viện tài nguyên giữ giấy phép riêng (CC0 hoặc CC-BY, ghi công được lưu trong dự án), mô hình giọng cũng vậy (Kokoro và CosyVoice 2: Apache-2.0; Supertonic: OpenRAIL-M).

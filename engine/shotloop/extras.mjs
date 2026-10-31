// What the infographic page gains in the other 2D styles (styles.mjs):
// each style's kit helpers (doc for the page's first comment, CSS, JS), on
// top of the infographic kit. The JS is plain page code (no template
// placeholders): it runs after the kit and extends window.kit.

const KINETIC = {
  doc: `
  Kinetic type (this style): the words are the picture. Big type on a
  #type layer above the stage, revealed word by word; a marker sweeps
  under the word that matters, a word is struck through or rolls into
  another. Keep each line short; let the type fill the frame. Call
  stage() first in every frame: it clears the #type layer.
    say({ text, t, at = 0, each = 0.08, enter = 'rise', x = PAD, y, w, size = 64,
          weight = 800, color, align = 'left', hl = [], hlColor, mark = 0,
          strike = [], strikeP = 0, font })
                                    one block of words revealed in turn from at; enter:
                                    rise | pop | blur | slide; hl: words in the accent
                                    (or hlColor); mark 0→1 sweeps a marker under them;
                                    strike: words struck through with strikeP 0→1
    roll(t, at, from, to, { x, y, size, color, d = 0.5 })  a word rolling into another
    stamp(text, p, { x, y, size = 40, color = C.hue.red, rotate = -8 })
                                    a stamp landing (SUSPECTED, FAKE, TRUE…)`,
  css: `
      #type { position: absolute; inset: 0; pointer-events: none; }
      #type .blk { position: absolute; line-height: 1.08; letter-spacing: -0.01em; }
      #type .w { display: inline-block; white-space: pre; position: relative; }
      #type .mk { position: absolute; left: -0.06em; right: -0.06em; bottom: 0.08em; height: 0.36em; border-radius: 0.08em; z-index: -1; transform-origin: left; }
      #type .st { position: absolute; left: -0.04em; right: -0.04em; top: 52%; height: 0.08em; transform-origin: left; }
      #type .stamp { position: absolute; padding: 6px 14px; border: 4px solid currentColor; border-radius: 8px; font-weight: 900; letter-spacing: 0.08em; }`,
  js: `
      const typeLayer = document.createElement('div')
      typeLayer.id = 'type'
      document.body.appendChild(typeLayer)
      let typeParts = []
      const typeAdd = html => { typeParts.push(html); typeLayer.innerHTML = typeParts.join('') }
      const baseStage = stage
      stage = markup => { typeParts = []; typeLayer.innerHTML = ''; return baseStage(markup) }
      function say({ text, t, at = 0, each = 0.08, enter = 'rise', x = PAD, y, w = SAFE_RIGHT - PAD, size = 64, weight = 800, color = C.text,
        align = 'left', hl = [], hlColor = C.accent, mark = 0, strike = [], strikeP = 0, font = HEAD_FONT } = {}) {
        const words = String(text).split(/(\\s+)/)
        let i = 0
        const html = words.map(word => {
          if (/^\\s+$/.test(word)) return word
          const p = rise(t, at + i++ * each, 0.45)
          const bare = word.replace(/[.,!?;:]+$/, '')
          const on = hl.includes(bare), off = strike.includes(bare)
          const tf = enter === 'pop' ? 'scale(' + (0.4 + 0.6 * pop(t, at + (i - 1) * each, 0.5)) + ')'
            : enter === 'slide' ? 'translateX(' + (1 - p) * 40 + 'px)'
            : enter === 'blur' ? 'none' : 'translateY(' + (1 - p) * 0.5 + 'em)'
          const fx = enter === 'blur' ? ';filter:blur(' + (1 - p) * 10 + 'px)' : ''
          const mk = on && mark > 0 ? '<i class="mk" style="background:' + hlColor + ';opacity:0.32;transform:scaleX(' + clamp(mark) + ')"></i>' : ''
          const st = off && strikeP > 0 ? '<i class="st" style="background:' + C.hue.red + ';transform:scaleX(' + clamp(strikeP) + ')"></i>' : ''
          return '<span class="w" style="opacity:' + p + ';transform:' + tf + fx + (on ? ';color:' + hlColor : '') + (off ? ';opacity:' + p * (1 - 0.45 * clamp(strikeP)) : '') + '">' + mk + st + esc(word) + '</span>'
        }).join('')
        typeAdd('<div class="blk" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;text-align:' + align + ';font:' + weight + ' ' + size + 'px/1.08 ' + font + ';color:' + color + '">' + html + '</div>')
      }
      function roll(t, at, from, to, { x = PAD, y, size = 64, color = C.accent, d = 0.5 } = {}) {
        const p = ease((t - at) / d)
        typeAdd('<div class="blk" style="left:' + x + 'px;top:' + y + 'px;height:' + size * 1.1 + 'px;overflow:hidden;font:800 ' + size + 'px/1.1 ' + HEAD_FONT + ';color:' + color + '">' +
          '<div style="transform:translateY(' + -p * size * 1.1 + 'px)"><div>' + esc(from) + '</div><div>' + esc(to) + '</div></div></div>')
      }
      function stamp(text, p, { x = PAD, y, size = 40, color = C.hue.red, rotate = -8 } = {}) {
        if (p <= 0) return
        const s = 1 + 1.4 * (1 - clamp(p))
        typeAdd('<div class="stamp" style="left:' + x + 'px;top:' + y + 'px;font-size:' + size + 'px;color:' + color + ';opacity:' + clamp(p * 1.5) + ';transform:rotate(' + rotate + 'deg) scale(' + s + ')">' + esc(text) + '</div>')
      }
      Object.assign(window.kit, { stage, say, roll, stamp })`
}

const BLUEPRINT = {
  doc: `
  Blueprint (this style): how a thing works, drawn as technical line art
  on a grid: outlines, hatched sections, parts that separate (exploded
  view), dimension lines and callouts. Draw strokes on with drawOn; move
  parts apart with exploded(); label every part with callout().
    part({ x, y, w, h, rx = 6, label, hatch = false, color = C.text, fill })  SVG markup
    gear(cx, cy, r, { teeth = 12, angle = 0, color = C.text, hole = 0.3 })    SVG markup
    spring(x1, y1, x2, y2, { coils = 8, amp = 12, color = C.text })            SVG markup
    dim(x1, y1, x2, y2, label, { off = 24, color = C.muted })                   SVG markup:
                                    a dimension line with ticks and its label
    callout(x, y, label, { dx = 60, dy = -40, color = C.text, p = 1 })          SVG markup:
                                    a leader line from (x, y) to its label
    exploded(i, p, { gap = 60, axis = 'y' }) → offset   part i's offset in an exploded view`,
  css: `
      /* The grid over the look's ground (a layer of its own: the ground stays) */
      body::before { content: ''; position: absolute; inset: 0; pointer-events: none;
        background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px),
        linear-gradient(var(--grid2) 1px, transparent 1px), linear-gradient(90deg, var(--grid2) 1px, transparent 1px);
        background-size: 120px 120px, 120px 120px, 24px 24px, 24px 24px; }`,
  js: `
      document.documentElement.style.setProperty('--grid', C.line)
      document.documentElement.style.setProperty('--grid2', C.panel)
      const svgDefs = '<defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="' + C.muted + '" stroke-width="1.4"/></pattern></defs>'
      const baseStage = stage
      stage = markup => baseStage(svgDefs + markup)
      const lbl = (x, y, text, color, anchor = 'start') => '<text x="' + x + '" y="' + y + '" font-size="15" font-weight="600" fill="' + color + '" text-anchor="' + anchor + '" font-family="' + FONT.replace(/"/g, '') + '">' + esc(text) + '</text>'
      function part({ x, y, w, h, rx = 6, label, hatch = false, color = C.text, fill = 'none' } = {}) {
        return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + rx + '" fill="' + (hatch ? 'url(#hatch)' : fill) + '" stroke="' + color + '" stroke-width="2"/>' +
          (label ? lbl(x + w / 2, y + h / 2 + 5, label, color, 'middle') : '')
      }
      function gear(cx, cy, r, { teeth = 12, angle = 0, color = C.text, hole = 0.3 } = {}) {
        const pts = []
        for (let i = 0; i < teeth * 2; i++) {
          const a = angle + (i / (teeth * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.82 : r
          pts.push([cx + Math.cos(a - 0.08) * rr, cy + Math.sin(a - 0.08) * rr], [cx + Math.cos(a + 0.08) * rr, cy + Math.sin(a + 0.08) * rr])
        }
        return '<path d="M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + 'Z" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round"/>' +
          '<circle cx="' + cx + '" cy="' + cy + '" r="' + r * hole + '" fill="none" stroke="' + color + '" stroke-width="2"/>'
      }
      function spring(x1, y1, x2, y2, { coils = 8, amp = 12, color = C.text } = {}) {
        const n = coils * 2, dx = (x2 - x1) / n, dy = (y2 - y1) / n, len = Math.hypot(x2 - x1, y2 - y1) || 1
        const nx = -(y2 - y1) / len, ny = (x2 - x1) / len
        let d = 'M' + x1 + ',' + y1
        for (let i = 1; i < n; i++) d += 'L' + (x1 + dx * i + nx * amp * (i % 2 ? 1 : -1)).toFixed(1) + ',' + (y1 + dy * i + ny * amp * (i % 2 ? 1 : -1)).toFixed(1)
        return '<path d="' + d + 'L' + x2 + ',' + y2 + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round"/>'
      }
      function dim(x1, y1, x2, y2, label, { off = 24, color = C.muted } = {}) {
        const len = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / len * off, ny = (x2 - x1) / len * off
        const a = [x1 + nx, y1 + ny], b = [x2 + nx, y2 + ny]
        return '<g stroke="' + color + '" stroke-width="1.5">' +
          '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + a[0] + '" y2="' + a[1] + '"/><line x1="' + x2 + '" y1="' + y2 + '" x2="' + b[0] + '" y2="' + b[1] + '"/>' +
          '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/></g>' + lbl((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 8, label, color, 'middle')
      }
      function callout(x, y, label, { dx = 60, dy = -40, color = C.text, p = 1 } = {}) {
        if (p <= 0) return ''
        const ex = x + dx * clamp(p), ey = y + dy * clamp(p)
        return '<circle cx="' + x + '" cy="' + y + '" r="4" fill="' + color + '"/><line x1="' + x + '" y1="' + y + '" x2="' + ex + '" y2="' + ey + '" stroke="' + color + '" stroke-width="1.5"/>' +
          '<g opacity="' + clamp(p * 2 - 1) + '">' + lbl(ex + (dx >= 0 ? 8 : -8), ey + 5, label, color, dx >= 0 ? 'start' : 'end') + '</g>'
      }
      const exploded = (i, p, { gap = 60, axis = 'y' } = {}) => i * gap * ease(p)
      Object.assign(window.kit, { stage, part, gear, spring, dim, callout, exploded })`
}

const UI = {
  doc: `
  Interface demo (this style): a phone or a browser on the stage, its
  screen showing what happens (messages arrive, a link is tapped, a field
  fills in). Screens use a neutral light or dark system UI, not the look;
  the look frames them. Keep one device per shot, large, inside the safe
  area; point at what matters with tap(). Call stage() first in every
  frame: it clears the #ui layer.
    phone({ x, y, w = 300, screen, dark = false, p = 1, tilt = 0 })   the device on the #ui
                                    layer; screen is HTML from the parts below
    browser({ x, y, w = 600, h = 400, url, screen, dark = false, p = 1 })
    appBar(title, { back = false })     msg({ text, me = false, p = 1, time })
    notif({ app, title, body, p = 1 })  button(label, { primary = true, pressed = 0 })
    field(label, value, { typed = 1 })  row({ title, sub, icon })   toast(text, p)
                                    screen parts, HTML strings to join
    tap(x, y, p, { color })         a finger tap with a ripple at (x, y) on the frame`,
  css: `
      #ui { position: absolute; inset: 0; pointer-events: none; }
      .dev { position: absolute; border-radius: 42px; padding: 12px; background: #0b0d12; box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45), 0 0 0 2px rgba(255, 255, 255, 0.08); }
      .dev .scr { position: relative; border-radius: 32px; overflow: hidden; height: 100%; font: 500 15px/1.35 -apple-system, 'PingFang SC', sans-serif; }
      .dev .scr.l { background: #f2f3f7; color: #111; } .dev .scr.d { background: #101114; color: #f2f2f5; }
      .dev .notch { position: absolute; top: 20px; left: 50%; width: 92px; height: 26px; margin-left: -46px; border-radius: 14px; background: #000; z-index: 2; }
      .dev .sb { height: 46px; display: flex; align-items: flex-end; justify-content: space-between; padding: 0 26px 6px; font-size: 13px; font-weight: 700; }
      .win { position: absolute; border-radius: 12px; overflow: hidden; box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1); }
      .win .bar { height: 38px; display: flex; align-items: center; gap: 8px; padding: 0 14px; background: #e6e7eb; color: #555; font: 500 13px -apple-system, sans-serif; }
      .win .bar i { width: 11px; height: 11px; border-radius: 50%; background: #ff5f57; } .win .bar i + i { background: #febc2e; } .win .bar i + i + i { background: #28c840; }
      .win .bar span { flex: 1; margin-left: 10px; padding: 5px 10px; border-radius: 6px; background: #fff; }
      .win .scr { height: calc(100% - 38px); }
      .ab { display: flex; align-items: center; gap: 8px; padding: 10px 16px; font-weight: 700; font-size: 17px; border-bottom: 1px solid rgba(128, 128, 128, 0.2); }
      .bub { max-width: 76%; margin: 6px 12px; padding: 9px 13px; border-radius: 18px; background: #e5e5ea; color: #111; }
      .bub.me { margin-left: auto; background: #0a84ff; color: #fff; }
      .scr.d .bub { background: #2c2c2e; color: #f2f2f5; } .scr.d .bub.me { background: #0a84ff; }
      .ntf { margin: 8px 10px; padding: 11px 13px; border-radius: 18px; background: rgba(250, 250, 252, 0.92); color: #111; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18); }
      .ntf b { display: block; font-size: 13px; } .ntf small { color: #666; font-size: 12px; }
      .btn { margin: 10px 16px; padding: 13px; border-radius: 14px; text-align: center; font-weight: 700; background: #e5e5ea; color: #111; }
      .btn.pri { background: #0a84ff; color: #fff; }
      .fld { margin: 8px 16px; padding: 10px 12px; border-radius: 12px; background: rgba(128, 128, 128, 0.14); }
      .fld small { display: block; opacity: 0.6; font-size: 12px; }
      .row { display: flex; gap: 12px; align-items: center; padding: 10px 16px; border-bottom: 1px solid rgba(128, 128, 128, 0.15); }
      .row .ic { width: 36px; height: 36px; border-radius: 10px; background: rgba(128, 128, 128, 0.2); display: grid; place-items: center; }
      .row small { display: block; opacity: 0.6; }
      .tst { position: absolute; left: 50%; bottom: 40px; transform: translateX(-50%); padding: 10px 16px; border-radius: 12px; background: rgba(20, 20, 24, 0.9); color: #fff; white-space: nowrap; }
      .tap { position: absolute; border-radius: 50%; pointer-events: none; }`,
  js: `
      const uiLayer = document.createElement('div')
      uiLayer.id = 'ui'
      document.body.appendChild(uiLayer)
      let uiParts = []
      const uiAdd = html => { uiParts.push(html); uiLayer.innerHTML = uiParts.join('') }
      const baseStage = stage
      stage = markup => { uiParts = []; uiLayer.innerHTML = ''; return baseStage(markup) }
      const time = '9:41'
      function phone({ x, y, w = 300, screen = '', dark = false, p = 1, tilt = 0 } = {}) {
        const h = w * 2.05
        uiAdd('<div class="dev" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;opacity:' + clamp(p * 1.5) +
          ';transform:translateY(' + (1 - ease(p)) * 60 + 'px) rotate(' + tilt + 'deg)"><div class="notch"></div><div class="scr ' + (dark ? 'd' : 'l') + '"><div class="sb"><span>' + time + '</span><span>●●● ▮</span></div>' + screen + '</div></div>')
      }
      function browser({ x, y, w = 600, h = 400, url = '', screen = '', dark = false, p = 1 } = {}) {
        uiAdd('<div class="win" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;opacity:' + clamp(p * 1.5) + ';transform:translateY(' + (1 - ease(p)) * 40 + 'px)">' +
          '<div class="bar"><i></i><i></i><i></i><span>' + esc(url) + '</span></div><div class="scr ' + (dark ? 'd' : 'l') + '" style="background:' + (dark ? '#101114' : '#fff') + '">' + screen + '</div></div>')
      }
      const appBar = (title, { back = false } = {}) => '<div class="ab">' + (back ? '‹ ' : '') + esc(title) + '</div>'
      const msg = ({ text, me = false, p = 1, time: tm } = {}) => p <= 0 ? '' : '<div class="bub' + (me ? ' me' : '') + '" style="opacity:' + clamp(p * 2) + ';transform:translateY(' + (1 - ease(p)) * 14 + 'px) scale(' + (0.9 + 0.1 * ease(p)) + ')">' + esc(text) + (tm ? '<div style="font-size:11px;opacity:.6;margin-top:3px">' + esc(tm) + '</div>' : '') + '</div>'
      const notif = ({ app, title, body, p = 1 } = {}) => p <= 0 ? '' : '<div class="ntf" style="opacity:' + clamp(p * 2) + ';transform:translateY(' + (ease(p) - 1) * 60 + 'px)"><small>' + esc(app) + ' · now</small><b>' + esc(title) + '</b>' + esc(body) + '</div>'
      const button = (label, { primary = true, pressed = 0 } = {}) => '<div class="btn' + (primary ? ' pri' : '') + '" style="transform:scale(' + (1 - 0.05 * clamp(pressed)) + ')">' + esc(label) + '</div>'
      const field = (label, value, { typed = 1 } = {}) => '<div class="fld"><small>' + esc(label) + '</small>' + esc(String(value).slice(0, Math.round(String(value).length * clamp(typed)))) + (typed < 1 ? '|' : '') + '</div>'
      const row = ({ title, sub = '', icon = '' } = {}) => '<div class="row"><div class="ic">' + esc(icon) + '</div><div>' + esc(title) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div></div>'
      const toast = (text, p = 1) => p <= 0 ? '' : '<div class="tst" style="opacity:' + clamp(p * 2) + '">' + esc(text) + '</div>'
      function tap(x, y, p, { color = C.accent } = {}) {
        if (p <= 0 || p >= 1.6) return
        const r = 14 + 40 * clamp(p)
        uiAdd('<div class="tap" style="left:' + (x - r) + 'px;top:' + (y - r) + 'px;width:' + r * 2 + 'px;height:' + r * 2 + 'px;border:3px solid ' + color + ';opacity:' + (1 - clamp(p)) + '"></div>' +
          '<div class="tap" style="left:' + (x - 16) + 'px;top:' + (y - 16) + 'px;width:32px;height:32px;background:' + color + ';opacity:' + 0.55 * (1 - clamp(p - 0.6)) + '"></div>')
      }
      Object.assign(window.kit, { stage, phone, browser, appBar, msg, notif, button, field, row, toast, tap })`
}

const MAP = {
  doc: `
  Map (this style): the world (Natural Earth 1:110m countries, in
  world/geo.data.js) on the stage, the camera moving from the globe to the
  region that matters, countries lighting up, routes drawing on, pins
  dropping. Use real-world or meaning colors from C.hue for what is
  shown; the land and sea come from the look.
    map({ center = [lon, lat], zoom = 1, highlight = { 'China': C.hue.red, … }, p = 1, borders = true })
                                    SVG markup of the land at that view (zoom 1: the
                                    world across the frame's width); highlight by the
                                    country's Natural Earth name, p fades them in
    at(lon, lat) → [x, y]           where a place is on the frame at the last map() view
    pin(lon, lat, { label, color = C.hue.red, p = 1 })          SVG markup, drops in with p
    route(from, to, p, { color = C.hue.yellow, lift = 0.25, width = 3 })
                                    SVG markup: an arc from [lon, lat] to [lon, lat] drawn on
    countries()                     the names that map() can highlight`,
  css: '',
  js: `
      const GEO = window.GEO || []
      let mapView = { center: [10, 20], zoom: 1 }
      function at(lon, lat) {
        const k = (W / 360) * mapView.zoom
        return [W / 2 + (lon - mapView.center[0]) * k, H / 2 - (lat - mapView.center[1]) * k]
      }
      function map({ center = [10, 20], zoom = 1, highlight = {}, p = 1, borders = true } = {}) {
        mapView = { center, zoom }
        const land = C.panel, edge = borders ? C.line : 'none'
        return GEO.map(cn => {
          const fill = highlight[cn.name]
          const d = cn.rings.map(r => 'M' + r.map(([x, y]) => { const q = at(x, y); return q[0].toFixed(1) + ',' + q[1].toFixed(1) }).join('L') + 'Z').join('')
          return '<path d="' + d + '" fill="' + land + '" stroke="' + edge + '" stroke-width="0.7"/>' +
            (fill ? '<path d="' + d + '" fill="' + fill + '" opacity="' + clamp(p) + '" stroke="' + fill + '" stroke-width="1"/>' : '')
        }).join('')
      }
      function pin(lon, lat, { label, color = C.hue.red, p = 1 } = {}) {
        if (p <= 0) return ''
        const [x, y] = at(lon, lat), dy = (1 - pop(p, 0, 1)) * -30
        return '<g transform="translate(' + x + ',' + (y + dy) + ')" opacity="' + clamp(p * 2) + '"><circle r="16" fill="' + color + '" opacity="0.25"/><circle r="7" fill="' + color + '" stroke="#fff" stroke-width="2"/></g>' +
          (label ? '<text x="' + (x + 14) + '" y="' + (y - 12) + '" font-size="18" font-weight="700" fill="' + C.text + '" opacity="' + clamp(p * 2 - 0.5) + '" font-family="' + FONT.replace(/"/g, '') + '">' + esc(label) + '</text>' : '')
      }
      function route(from, to, p, { color = C.hue.yellow, lift = 0.25, width = 3 } = {}) {
        const a = at(from[0], from[1]), b = at(to[0], to[1])
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - Math.hypot(b[0] - a[0], b[1] - a[1]) * lift
        const n = 40, q = clamp(p), pts = []
        for (let i = 0; i <= n * q; i++) {
          const s = i / n
          pts.push([(1 - s) * (1 - s) * a[0] + 2 * (1 - s) * s * mx + s * s * b[0], (1 - s) * (1 - s) * a[1] + 2 * (1 - s) * s * my + s * s * b[1]])
        }
        if (pts.length < 2) return ''
        const d = 'M' + pts.map(v => v[0].toFixed(1) + ',' + v[1].toFixed(1)).join('L'), e = pts[pts.length - 1]
        return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + width + '" stroke-linecap="round" opacity="0.95"/>' +
          (q < 1 ? '<circle cx="' + e[0] + '" cy="' + e[1] + '" r="' + width * 2 + '" fill="' + color + '"/>' : '')
      }
      const countries = () => GEO.map(cn => cn.name)
      Object.assign(window.kit, { map, at, pin, route, countries })`,
  // The map's data, beside the page (world/geo.data.js)
  scripts: ['geo.data.js']
}

export const EXTRAS = { kinetic: KINETIC, blueprint: BLUEPRINT, ui: UI, map: MAP }

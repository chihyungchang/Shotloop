// What the infographic page gains in the other 2D styles (styles.mjs):
// each style's kit helpers (about and tools for the page's first comment,
// CSS, JS), on top of the infographic kit. The JS is plain page code (no template
// placeholders): it runs after the kit and extends window.kit.

const KINETIC = {
  about: `
  Kinetic type (this style): the words are the picture. Big type on a
  #type layer above the stage, revealed word by word; a marker sweeps
  under the word that matters, a word is struck through or rolls into
  another. Keep each line short; let the type fill the frame. Call
  stage() first in every frame: it clears the #type layer.`,
  tools: `
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
  about: `
  Blueprint (this style): how a thing works, drawn as technical line art
  on a grid: outlines, hatched sections, parts that separate (exploded
  view), dimension lines and callouts. Draw strokes on with drawOn; move
  parts apart with exploded(); label every part with callout().`,
  tools: `
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
  about: `
  Interface demo (this style): a phone or a browser on the stage, its
  screen showing what happens (messages arrive, a link is tapped, a field
  fills in). Screens use a neutral light or dark system UI, not the look;
  the look frames them. Keep one device per shot, large, inside the safe
  area; point at what matters with tap(). Call stage() first in every
  frame: it clears the #ui layer.`,
  tools: `
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
  about: `
  Map (this style): the world (Natural Earth 1:110m countries, in
  world/geo.data.js) on the stage, the camera moving from the globe to the
  region that matters, countries lighting up, routes drawing on, pins
  dropping. Use real-world or meaning colors from C.hue for what is
  shown; the land and sea come from the look.`,
  tools: `
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

// The news narrative's own parts; the style also carries kinetic type's
// big words and stamps and the map's places (NEWS below)
const NEWS_KIT = {
  about: `
  News narrative (this style): a breaking event told as it unfolded (a
  hack, a heist, a crash, a raid, a ruling). The tension comes from time
  and stakes: a clock that keeps running, a timestamp on every beat, red
  that means danger, things that land hard (pop, shake, an alarm flash)
  and a beat of quiet before the reveal. Every claim is attributed: who
  says it and when (badge, quote, clip); alleged and confirmed are told
  apart (stamp). Flows that show how something works (trail, mixer,
  ledger rows, hashes) are labelled illustrative. Broadcast chrome
  (breaking, ticker, live) frames a shot; it never is the shot. With a
  voice-over, keep the ticker and every text out of the subtitle band.`,
  tools: `
    COIN                            the coins' own colors: btc, eth, usdt, usdc, sol, xmr
    icon(name, x, y, size = 64, { color, p = 1 })   SVG markup centered at (x, y), pops in
                                    with p. Names: btc eth usdt usd coin wallet hacker skull
                                    lock unlock key shield star bank exchange server laptop
                                    phone chain warning siren gavel cuffs doc eye globe pin
                                    clock fire plane up down flag person building
    badge(x, y, size, { label = 'FBI', sub, color = C.hue.blue, p = 1 })
                                    an agency's shield with its initials (a generic
                                    shield, never the agency's real seal)
    breaking({ text, label = 'BREAKING', y, p = 1, color = C.hue.red })
                                    the red banner wiping in across the frame
    ticker(t, items, { y, label = 'LATEST', speed = 70, color = C.hue.red })
                                    a crawl of short lines along a bar
    live(t, { x = PAD, y, label = 'LIVE', time })   a pulsing LIVE chip, a timestamp beside it
    timer(t, { x, y, from = 0, rate = 1, size = 56, color, anchor = 'start', label })
                                    a clock running from from seconds at rate seconds
                                    per shot second (rate 3600: an hour a second)
    alarm(t, a, { color = C.hue.red, d = 0.7 })      a red flash from a and the frame's
                                    edge pulsing; put it last on the stage
    shake(t, a, { amp = 10, d = 0.5 }) → [dx, dy]    a hit's shake, dying out after a
    timeline({ x, y, len, events: [{ date, label, color, icon }], p = 1, focus = -1,
               dir = 'down' })      an axis drawing on, events landing in turn with p;
                                    focus: the event that glows ('down' or 'right')
    chart({ x, y, w, h, values, p = 1, color = C.hue.green, last, min, max })
                                    a price line drawing on with its area; last: the
                                    label at its tip; y is the chart's top
    candles({ x, y, w, h, data: [[open, high, low, close]], p = 1 })
    price({ x, y, coin, name, value, change, p = 1 })   a quote chip: BTC $84,210 ▼ 4.1%
    ledger({ x, y, w, rows: [{ time, from, to, amount, flag }], t, at = 0, step = 0.2,
             rowH = 46, max = 8 })  transaction rows arriving in turn, scrolling past
                                    max; flag paints a row red
    txid(i, n = 4)                  a made-up hash like 0x3f9a…c21e (label it illustrative)
    wallet(x, y, { label, amount, coin = 'eth', p = 1, color, w = 190 })
                                    a wallet card centered at (x, y)
    trail({ x, y, w, h, levels = [1, 4, 16], t, p = 1, coin = 'eth', fade = 0 })
                                    money splitting into ever more wallets, coins
                                    running down the branches; fade dims the last
                                    level (gone dark)
    mixer(x, y, r, t, { p = 1, from = COIN.eth, to = C.hue.gray, label })
                                    a vortex: coins swirl in colored, leave gray
    paper({ x, y, w, h, title, lines: [{ text, redact }], p = 1, reveal = 0, tilt = 0 })
                                    a document; redacted lines are black bars that
                                    lift with reveal
    quote({ x, y, w, text, who, p = 1, size = 34, color = C.text })
                                    a statement typed in with p, its attribution under it
    clip({ x, y, w, outlet, title, date, p = 1, tilt = -2 })
                                    a headline card (keep the outlet's exact words)
    wrap(text, n) → lines           text broken into lines of about n characters`,
  js: `
      const COIN = { btc: '#f7931a', eth: '#627eea', usdt: '#26a17b', usdc: '#2775ca', sol: '#9945ff', xmr: '#ff6600' }
      const NF = FONT.replace(/"/g, ''), NH = HEAD_FONT.replace(/"/g, '')
      const txt = (x, y, s, { size = 16, weight = 700, color = C.text, anchor = 'start', font = NF, extra = '' } = {}) =>
        '<text x="' + x + '" y="' + y + '" font-size="' + size + '" font-weight="' + weight + '" fill="' + color + '" text-anchor="' + anchor +
        '" font-family="' + font + '" ' + extra + '>' + esc(s) + '</text>'
      const tabular = 'style="font-variant-numeric: tabular-nums"'

      // Text in lines of about n characters: by word, or by character for
      // Chinese, Japanese and Korean
      function wrap(text, n) {
        const s = String(text), cjk = [...s].some(ch => ch.charCodeAt(0) > 0x2e80)
        const parts = cjk ? [...s] : s.split(' ')
        const lines = []
        let line = ''
        for (const w of parts) {
          const next = line ? line + (cjk ? '' : ' ') + w : w
          if (next.length > n && line) { lines.push(line); line = w } else line = next
        }
        if (line) lines.push(line)
        return lines
      }

      // Icons drawn in a 100 × 100 box
      const coinFace = (fill, inner) => '<circle cx="50" cy="50" r="48" fill="' + fill + '"/>' + inner
      const ICONS = {
        btc: () => coinFace(COIN.btc, '<g transform="rotate(14 50 50)" fill="#fff"><rect x="41" y="14" width="6" height="14"/><rect x="53" y="14" width="6" height="14"/>' +
          '<rect x="41" y="72" width="6" height="14"/><rect x="53" y="72" width="6" height="14"/>' +
          '<path d="M32 24h24c11 0 17 6 17 13 0 6-3 10-8 12 7 2 11 7 11 14 0 9-7 15-19 15H32v-9h6V33h-6z M48 33v13h8c5 0 7-3 7-6.5S61 33 56 33z M48 55v14h10c5 0 8-3 8-7s-3-7-8-7z" fill-rule="evenodd"/></g>'),
        eth: () => coinFace(COIN.eth, '<polygon points="50,12 27,51 50,64" fill="#fff" opacity=".75"/><polygon points="50,12 73,51 50,64" fill="#fff"/>' +
          '<polygon points="50,69 27,56 50,89" fill="#fff" opacity=".75"/><polygon points="50,69 73,56 50,89" fill="#fff"/>'),
        usdt: () => coinFace(COIN.usdt, '<rect x="24" y="22" width="52" height="12" fill="#fff"/><rect x="44" y="22" width="12" height="56" fill="#fff"/>' +
          '<ellipse cx="50" cy="48" rx="30" ry="8" fill="none" stroke="#fff" stroke-width="5"/>'),
        usd: c => coinFace(c || C.hue.green, '<text x="50" y="70" text-anchor="middle" font-size="58" font-weight="900" fill="#fff" font-family="' + NF + '">$</text>'),
        coin: c => coinFace(c, '<circle cx="50" cy="50" r="34" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="5"/>'),
        wallet: c => '<rect x="8" y="26" width="84" height="62" rx="12" fill="' + c + '"/><path d="M18 26 L66 10 L72 26" fill="none" stroke="' + c + '" stroke-width="7" stroke-linejoin="round"/>' +
          '<rect x="60" y="46" width="32" height="22" rx="6" fill="#000" opacity=".25"/><circle cx="72" cy="57" r="5" fill="#fff"/>',
        hacker: c => '<path d="M50 6C25 6 14 28 14 50v44h72V50C86 28 75 6 50 6z" fill="' + c + '"/><ellipse cx="50" cy="50" rx="21" ry="25" fill="#05070b"/>' +
          '<rect x="37" y="45" width="9" height="4" rx="2" fill="' + C.hue.green + '"/><rect x="54" y="45" width="9" height="4" rx="2" fill="' + C.hue.green + '"/>',
        skull: c => '<path d="M50 8C27 8 14 24 14 44c0 12 6 20 14 25v15h44V69c8-5 14-13 14-25C86 24 73 8 50 8z" fill="' + c + '"/>' +
          '<circle cx="36" cy="46" r="10" fill="#05070b"/><circle cx="64" cy="46" r="10" fill="#05070b"/><path d="M50 58l-6 10h12z" fill="#05070b"/>' +
          '<rect x="40" y="76" width="4" height="8" fill="#05070b"/><rect x="48" y="76" width="4" height="8" fill="#05070b"/><rect x="56" y="76" width="4" height="8" fill="#05070b"/>',
        lock: c => '<path d="M30 46V32a20 20 0 0 1 40 0v14" fill="none" stroke="' + c + '" stroke-width="9"/><rect x="18" y="44" width="64" height="48" rx="9" fill="' + c + '"/><circle cx="50" cy="66" r="7" fill="#05070b"/>',
        unlock: c => '<path d="M30 46V32a20 20 0 0 1 39-6" fill="none" stroke="' + c + '" stroke-width="9"/><rect x="18" y="44" width="64" height="48" rx="9" fill="' + c + '"/><circle cx="50" cy="66" r="7" fill="#05070b"/>',
        key: c => '<circle cx="30" cy="50" r="18" fill="none" stroke="' + c + '" stroke-width="9"/><path d="M48 50h42M76 50v14M88 50v10" stroke="' + c + '" stroke-width="9" stroke-linecap="round"/>',
        shield: c => '<path d="M50 6l38 14v26c0 24-16 40-38 48C28 86 12 70 12 46V20z" fill="' + c + '"/>',
        star: c => '<polygon points="50,6 61,38 95,38 67,58 78,92 50,71 22,92 33,58 5,38 39,38" fill="' + c + '"/>',
        bank: c => '<polygon points="50,6 94,30 6,30" fill="' + c + '"/><rect x="10" y="84" width="80" height="10" fill="' + c + '"/>' +
          [18, 36, 54, 72].map(x => '<rect x="' + x + '" y="36" width="10" height="44" fill="' + c + '"/>').join(''),
        exchange: c => '<path d="M14 36h62l-14-14M86 64H24l14 14" fill="none" stroke="' + c + '" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>',
        server: c => [8, 38, 68].map(y => '<rect x="12" y="' + y + '" width="76" height="24" rx="5" fill="' + c + '"/><circle cx="26" cy="' + (y + 12) + '" r="4" fill="#05070b"/><rect x="40" y="' + (y + 10) + '" width="36" height="4" fill="#05070b" opacity=".5"/>').join(''),
        laptop: c => '<rect x="16" y="16" width="68" height="48" rx="5" fill="none" stroke="' + c + '" stroke-width="8"/><path d="M4 76h92l-6 10H10z" fill="' + c + '"/>',
        phone: c => '<rect x="26" y="4" width="48" height="92" rx="10" fill="none" stroke="' + c + '" stroke-width="8"/><rect x="42" y="82" width="16" height="5" rx="2" fill="' + c + '"/>',
        chain: c => '<rect x="6" y="32" width="50" height="36" rx="18" fill="none" stroke="' + c + '" stroke-width="9"/><rect x="44" y="32" width="50" height="36" rx="18" fill="none" stroke="' + c + '" stroke-width="9"/>',
        warning: c => '<path d="M50 8L94 88H6z" fill="' + c + '" stroke="' + c + '" stroke-width="6" stroke-linejoin="round"/><rect x="45" y="34" width="10" height="30" rx="4" fill="#05070b"/><circle cx="50" cy="74" r="6" fill="#05070b"/>',
        siren: c => '<path d="M26 74V50a24 24 0 0 1 48 0v24z" fill="' + c + '"/><rect x="16" y="74" width="68" height="14" rx="4" fill="' + c + '"/>' +
          '<path d="M50 6v10M16 20l8 8M84 20l-8 8M4 50h10M86 50h10" stroke="' + c + '" stroke-width="6" stroke-linecap="round"/>',
        gavel: c => '<g transform="rotate(-40 50 50)"><rect x="22" y="22" width="56" height="26" rx="6" fill="' + c + '"/><rect x="45" y="46" width="10" height="46" rx="4" fill="' + c + '"/></g><rect x="52" y="84" width="42" height="10" rx="4" fill="' + c + '"/>',
        cuffs: c => '<circle cx="28" cy="58" r="20" fill="none" stroke="' + c + '" stroke-width="9"/><circle cx="72" cy="58" r="20" fill="none" stroke="' + c + '" stroke-width="9"/>' +
          '<path d="M40 30q10-14 20 0" fill="none" stroke="' + c + '" stroke-width="6"/>',
        doc: c => '<path d="M18 6h44l20 20v68H18z" fill="' + c + '"/><path d="M62 6v20h20" fill="#000" opacity=".2"/>' +
          [40, 54, 68].map(y => '<rect x="30" y="' + y + '" width="40" height="5" fill="#05070b" opacity=".45"/>').join(''),
        eye: c => '<path d="M4 50Q50 2 96 50Q50 98 4 50z" fill="' + c + '"/><circle cx="50" cy="50" r="17" fill="#05070b"/><circle cx="56" cy="44" r="5" fill="#fff"/>',
        globe: c => '<circle cx="50" cy="50" r="42" fill="none" stroke="' + c + '" stroke-width="7"/><ellipse cx="50" cy="50" rx="18" ry="42" fill="none" stroke="' + c + '" stroke-width="5"/>' +
          '<path d="M8 50h84M16 28h68M16 72h68" stroke="' + c + '" stroke-width="5"/>',
        pin: c => '<path d="M50 96C30 66 18 52 18 36a32 32 0 0 1 64 0c0 16-12 30-32 60z" fill="' + c + '"/><circle cx="50" cy="36" r="12" fill="#05070b"/>',
        clock: c => '<circle cx="50" cy="50" r="42" fill="none" stroke="' + c + '" stroke-width="8"/><path d="M50 24v28l18 12" fill="none" stroke="' + c + '" stroke-width="8" stroke-linecap="round"/>',
        fire: c => '<path d="M50 4c4 22 30 30 30 58a30 30 0 0 1-60 0c0-16 10-24 14-36 4 10 10 14 14 14C52 30 46 18 50 4z" fill="' + c + '"/>',
        plane: c => '<path d="M46 6h8l6 36 34 18v10l-34-8-2 22 10 8v6l-18-4-18 4v-6l10-8-2-22-34 8V60l34-18z" fill="' + c + '"/>',
        up: c => '<path d="M8 84L36 52l18 16L90 24" fill="none" stroke="' + c + '" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M66 22h26v26" fill="none" stroke="' + c + '" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>',
        down: c => '<path d="M8 18l28 32 18-16 36 44" fill="none" stroke="' + c + '" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M66 80h26V54" fill="none" stroke="' + c + '" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>',
        flag: c => '<rect x="14" y="6" width="7" height="90" rx="3" fill="' + c + '"/><path d="M21 10h64l-12 18 12 18H21z" fill="' + c + '"/>',
        person: c => '<circle cx="50" cy="28" r="20" fill="' + c + '"/><path d="M12 96c0-24 16-40 38-40s38 16 38 40z" fill="' + c + '"/>',
        building: c => '<rect x="20" y="8" width="60" height="88" fill="' + c + '"/>' +
          [20, 38, 56, 74].map(y => '<rect x="32" y="' + y + '" width="12" height="10" fill="#05070b" opacity=".45"/><rect x="56" y="' + y + '" width="12" height="10" fill="#05070b" opacity=".45"/>').join('')
      }
      function icon(name, x, y, size = 64, { color = C.text, p = 1 } = {}) {
        if (p <= 0) return ''
        const draw = ICONS[name]
        if (!draw) throw new Error('no news icon ' + name)
        const s = (size / 100) * pop(p, 0, 1)
        return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ') translate(-50 -50)" opacity="' + clamp(p * 2) + '">' + draw(color) + '</g>'
      }

      function badge(x, y, size, { label = 'FBI', sub = '', color = C.hue.blue, p = 1 } = {}) {
        if (p <= 0) return ''
        const s = (size / 100) * pop(p, 0, 0.8)
        return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ') translate(-50 -50)" opacity="' + clamp(p * 2) + '">' +
          '<path d="M50 2l44 14v30c0 28-19 46-44 54C25 92 6 74 6 46V16z" fill="' + color + '"/>' +
          '<path d="M50 10l36 11v25c0 23-15 38-36 45C29 84 14 69 14 46V21z" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2"/>' +
          '<polygon points="50,18 53,26 61,26 55,31 57,39 50,34 43,39 45,31 39,26 47,26" fill="#fff"/>' +
          '<text x="50" y="64" text-anchor="middle" font-size="' + (label.length > 3 ? 20 : 26) + '" font-weight="900" fill="#fff" letter-spacing="1" font-family="' + NF + '">' + esc(label) + '</text>' +
          (sub ? '<text x="50" y="78" text-anchor="middle" font-size="' + Math.min(7, 110 / sub.length) + '" font-weight="700" fill="#fff" opacity=".85" letter-spacing="1" font-family="' + NF + '">' + esc(sub) + '</text>' : '') + '</g>'
      }

      function breaking({ text = '', label = 'BREAKING', y = SAFE_TOP + 150, p = 1, color = C.hue.red } = {}) {
        if (p <= 0) return ''
        const h = 58, lw = 30 + label.length * 15, bw = (W - lw) * ease(clamp(p * 1.6 - 0.3)), lx = -lw + lw * ease(clamp(p * 2.2))
        return '<rect x="0" y="' + (y + h) + '" width="' + W * ease(clamp(p * 1.4)) + '" height="4" fill="' + color + '"/>' +
          '<rect x="' + (lx + lw) + '" y="' + y + '" width="' + bw + '" height="' + h + '" fill="#fff"/>' +
          '<g opacity="' + clamp(p * 3 - 1.6) + '">' + txt(lx + lw + 18, y + h / 2 + 9, text, { size: 25, weight: 800, color: '#111' }) + '</g>' +
          '<rect x="' + lx + '" y="' + y + '" width="' + lw + '" height="' + h + '" fill="' + color + '"/>' +
          txt(lx + lw / 2, y + h / 2 + 9, label, { size: 24, weight: 900, color: '#fff', anchor: 'middle', extra: 'letter-spacing="2"' })
      }

      function ticker(t, items, { y = SAFE_BOTTOM - 40, label = 'LATEST', speed = 70, color = C.hue.red } = {}) {
        const h = 38, line = items.join('   •   ') + '   •   ', size = 18
        const cycle = Math.max(1, line.length * size * 0.55), off = -((t * speed) % cycle), lw = 24 + label.length * 13
        return '<rect x="0" y="' + y + '" width="' + W + '" height="' + h + '" fill="#000" opacity=".72"/>' +
          '<g>' + [0, 1, 2, 3].map(k => txt(lw + 14 + off + k * cycle, y + h / 2 + 6, line, { size, weight: 600, color: '#fff' })).join('') + '</g>' +
          '<rect x="0" y="' + y + '" width="' + lw + '" height="' + h + '" fill="' + color + '"/>' +
          txt(lw / 2, y + h / 2 + 6, label, { size: 16, weight: 900, color: '#fff', anchor: 'middle', extra: 'letter-spacing="1.5"' })
      }

      function live(t, { x = PAD, y = SAFE_TOP, label = 'LIVE', time = '' } = {}) {
        const dot = 0.35 + 0.65 * Math.abs(Math.cos(t * Math.PI * 1.2)), lw = 44 + label.length * 12
        return '<rect x="' + x + '" y="' + y + '" width="' + lw + '" height="30" rx="5" fill="' + C.hue.red + '"/>' +
          '<circle cx="' + (x + 16) + '" cy="' + (y + 15) + '" r="6" fill="#fff" opacity="' + dot + '"/>' +
          txt(x + 28, y + 21, label, { size: 16, weight: 900, color: '#fff', extra: 'letter-spacing="1.5"' }) +
          (time ? txt(x + lw + 12, y + 21, time, { size: 16, weight: 700, color: C.text, extra: tabular }) : '')
      }

      const pad2 = n => String(Math.floor(n)).padStart(2, '0')
      function timer(t, { x, y, from = 0, rate = 1, size = 56, color = C.text, anchor = 'start', label = '' } = {}) {
        const s = Math.max(0, from + t * rate)
        const value = pad2(s / 3600) + ':' + pad2((s / 60) % 60) + ':' + pad2(s % 60)
        return txt(x, y, value, { size, weight: 800, color, anchor, font: NH, extra: tabular + ' letter-spacing="1"' }) +
          (label ? txt(x, y + size * 0.45, label, { size: Math.round(size * 0.3), weight: 600, color: C.muted, anchor }) : '')
      }

      function alarm(t, a, { color = C.hue.red, d = 0.7 } = {}) {
        if (t < a) return ''
        const flash = Math.exp(-(t - a) / (d * 0.35)) * 0.45, edge = 0.25 + 0.2 * Math.abs(Math.sin((t - a) * Math.PI * 1.6))
        return '<defs><radialGradient id="alarm-edge" cx="50%" cy="50%" r="75%"><stop offset=".55" stop-color="' + color + '" stop-opacity="0"/><stop offset="1" stop-color="' + color + '" stop-opacity="' + edge + '"/></radialGradient></defs>' +
          '<rect width="' + W + '" height="' + H + '" fill="url(#alarm-edge)"/>' +
          (flash > 0.01 ? '<rect width="' + W + '" height="' + H + '" fill="' + color + '" opacity="' + flash + '"/>' : '')
      }
      function shake(t, a, { amp = 10, d = 0.5 } = {}) {
        if (t < a || t > a + d * 2) return [0, 0]
        const k = amp * Math.exp(-(t - a) / (d * 0.4))
        return [Math.sin(t * 97) * k, Math.cos(t * 83) * k * 0.6]
      }

      function timeline({ x, y, len, events = [], p = 1, focus = -1, dir = 'down' } = {}) {
        const n = events.length, down = dir === 'down', step = n > 1 ? len / (n - 1) : 0
        const axis = ease(clamp(p * 1.3))
        let out = '<line x1="' + x + '" y1="' + y + '" x2="' + (down ? x : x + len * axis) + '" y2="' + (down ? y + len * axis : y) + '" stroke="' + C.line + '" stroke-width="4" stroke-linecap="round"/>'
        events.forEach((e, i) => {
          const q = clamp(p * (n + 1) - i - 0.6)
          if (q <= 0) return
          const ex = down ? x : x + i * step, ey = down ? y + i * step : y, on = i === focus, col = e.color || (on ? C.hue.red : C.text)
          const r = (on ? 13 : 9) * pop(q, 0, 1)
          out += (on ? '<circle cx="' + ex + '" cy="' + ey + '" r="' + r * 2.4 + '" fill="' + col + '" opacity=".22"/>' : '') +
            '<circle cx="' + ex + '" cy="' + ey + '" r="' + r + '" fill="' + col + '" stroke="' + C.panel + '" stroke-width="3"/>'
          const g = '<g opacity="' + clamp(q * 2) + '" transform="translate(' + (down ? (1 - ease(q)) * 20 : 0) + ' ' + (down ? 0 : (1 - ease(q)) * 14) + ')">'
          const iconAt = e.icon ? (down ? icon(e.icon, ex - 52, ey, 44, { color: col, p: q }) : icon(e.icon, ex, ey - 92, 40, { color: col, p: q })) : ''
          out += iconAt + g + (down
            ? txt(ex + 30, ey - 4, e.date, { size: 18, weight: 800, color: on ? C.hue.red : C.muted, extra: tabular }) + txt(ex + 30, ey + 24, e.label, { size: on ? 26 : 22, weight: 700, color: C.text })
            : txt(ex, ey - 26, e.date, { size: 17, weight: 800, color: on ? C.hue.red : C.muted, anchor: 'middle', extra: tabular }) + txt(ex, ey + 40, e.label, { size: on ? 22 : 19, weight: 700, color: C.text, anchor: 'middle' })) + '</g>'
        })
        return out
      }

      function chart({ x, y, w, h, values = [], p = 1, color = C.hue.green, last = '', min, max } = {}) {
        if (values.length < 2) return ''
        const lo = min ?? Math.min(...values), hi = max ?? Math.max(...values), span = hi - lo || 1, n = values.length
        const pt = i => [x + (i / (n - 1)) * w, y + h - ((values[i] - lo) / span) * h]
        const upto = clamp(p) * (n - 1), k = Math.floor(upto), pts = []
        for (let i = 0; i <= k; i++) pts.push(pt(i))
        if (k < n - 1) { const a = pt(k), b = pt(k + 1), f = upto - k; pts.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f)]) }
        const d = 'M' + pts.map(v => v[0].toFixed(1) + ',' + v[1].toFixed(1)).join('L'), e = pts[pts.length - 1]
        const gid = 'area-' + Math.round(x) + '-' + Math.round(y)
        let grid = ''
        for (let g = 0; g <= 4; g++) grid += '<line x1="' + x + '" y1="' + (y + (g / 4) * h) + '" x2="' + (x + w) + '" y2="' + (y + (g / 4) * h) + '" stroke="' + C.line + '" stroke-dasharray="3 6"/>'
        return grid + '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".35"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
          '<path d="' + d + 'L' + e[0].toFixed(1) + ',' + (y + h) + 'L' + x + ',' + (y + h) + 'Z" fill="url(#' + gid + ')"/>' +
          '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>' +
          '<circle cx="' + e[0] + '" cy="' + e[1] + '" r="14" fill="' + color + '" opacity=".25"/><circle cx="' + e[0] + '" cy="' + e[1] + '" r="6" fill="' + color + '"/>' +
          (last ? txt(Math.min(e[0], x + w - 4), e[1] - 22, last, { size: 22, weight: 800, color, anchor: e[0] > x + w * 0.7 ? 'end' : 'middle', extra: tabular }) : '')
      }

      function candles({ x, y, w, h, data = [], p = 1 } = {}) {
        const all = data.flat(), lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1, n = data.length, cw = w / n
        const Y = v => y + h - ((v - lo) / span) * h
        return data.map(([o, hh, l, c], i) => {
          const q = clamp(p * n - i)
          if (q <= 0) return ''
          const col = c >= o ? C.hue.green : C.hue.red, cx = x + (i + 0.5) * cw, top = Y(Math.max(o, c)), bot = Y(Math.min(o, c))
          return '<g opacity="' + q + '"><line x1="' + cx + '" y1="' + Y(hh) + '" x2="' + cx + '" y2="' + Y(l) + '" stroke="' + col + '" stroke-width="2"/>' +
            '<rect x="' + (cx - cw * 0.32) + '" y="' + top + '" width="' + cw * 0.64 + '" height="' + Math.max(2, bot - top) + '" rx="2" fill="' + col + '"/></g>'
        }).join('')
      }

      function price({ x, y, coin, name = '', value = '', change = 0, p = 1 } = {}) {
        if (p <= 0) return ''
        const up = change >= 0, col = up ? C.hue.green : C.hue.red
        return '<g opacity="' + clamp(p * 2) + '" transform="translate(' + (1 - ease(p)) * -24 + ' 0)">' +
          '<rect x="' + x + '" y="' + y + '" width="300" height="64" rx="14" fill="' + C.panel + '" stroke="' + C.line + '"/>' +
          (coin ? icon(coin, x + 34, y + 32, 40) : '') +
          txt(x + 62, y + 27, name, { size: 16, weight: 800, color: C.muted, extra: 'letter-spacing="1"' }) +
          txt(x + 62, y + 52, value, { size: 24, weight: 800, extra: tabular }) +
          txt(x + 286, y + 40, (up ? '▲ ' : '▼ ') + Math.abs(change).toFixed(1) + '%', { size: 20, weight: 800, color: col, anchor: 'end', extra: tabular }) + '</g>'
      }

      const hex = (i, k, n) => Array.from({ length: n }, (_, j) => Math.floor(hash(i, k * 31 + j) * 16).toString(16)).join('')
      const txid = (i, n = 4) => '0x' + hex(i, 1, n) + '…' + hex(i, 2, n)

      function ledger({ x, y, w, rows = [], t, at = 0, step = 0.2, rowH = 46, max = 8 } = {}) {
        const shown = rows.filter((r, i) => t >= at + i * step).length
        const scroll = Math.max(0, shown - max)
        let out = ''
        rows.forEach((r, i) => {
          const q = rise(t, at + i * step, 0.25)
          if (q <= 0 || i < scroll - 1) return
          const ry = y + (i - scroll) * rowH, gone = i < scroll ? 0 : 1
          const col = r.flag ? C.hue.red : C.text
          out += '<g opacity="' + q * gone + '" transform="translate(' + (1 - q) * 30 + ' 0)">' +
            '<rect x="' + x + '" y="' + ry + '" width="' + w + '" height="' + (rowH - 6) + '" rx="8" fill="' + (r.flag ? C.hue.red : C.panel) + '" opacity="' + (r.flag ? 0.16 : 1) + '"/>' +
            txt(x + 14, ry + rowH / 2 + 3, r.time || '', { size: 15, weight: 600, color: C.muted, extra: tabular }) +
            txt(x + w * 0.24, ry + rowH / 2 + 3, (r.from || '') + '  →  ' + (r.to || ''), { size: 16, weight: 600, color: C.text, font: 'Menlo, monospace' }) +
            txt(x + w - 14, ry + rowH / 2 + 3, r.amount || '', { size: 17, weight: 800, color: col, anchor: 'end', extra: tabular }) + '</g>'
        })
        return out
      }

      function wallet(x, y, { label = '', amount = '', coin = 'eth', p = 1, color = C.line, w = 190 } = {}) {
        if (p <= 0) return ''
        const h = 74, s = 0.8 + 0.2 * pop(p, 0, 1)
        return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" opacity="' + clamp(p * 2) + '">' +
          '<rect x="' + -w / 2 + '" y="' + -h / 2 + '" width="' + w + '" height="' + h + '" rx="14" fill="' + C.panel + '" stroke="' + color + '" stroke-width="3"/>' +
          icon(coin, -w / 2 + 34, 0, 40) +
          txt(-w / 2 + 62, -6, label, { size: 15, weight: 700, color: C.muted }) +
          txt(-w / 2 + 62, 20, amount, { size: 22, weight: 800, extra: tabular }) + '</g>'
      }

      function trail({ x, y, w, h, levels = [1, 4, 16], t = 0, p = 1, coin = 'eth', fade = 0 } = {}) {
        const L = levels.length, col = COIN[coin] || C.hue.red
        const pos = (k, i) => [x + ((i + 0.5) / levels[k]) * w, y + (L > 1 ? (k / (L - 1)) * h : 0)]
        let edges = '', nodes = '', coins = ''
        for (let k = 0; k < L; k++) {
          const q = clamp(p * L - k + (k ? 0.3 : 1)), r = Math.max(3, 16 - k * 4), dim = k === L - 1 ? 1 - 0.8 * clamp(fade) : 1
          for (let i = 0; i < levels[k]; i++) {
            const [nx, ny] = pos(k, i)
            if (k > 0) {
              const [px, py] = pos(k - 1, Math.floor((i * levels[k - 1]) / levels[k]))
              const e = clamp(q * 1.4)
              if (e > 0) {
                edges += '<line x1="' + px + '" y1="' + py + '" x2="' + lerp(px, nx, e) + '" y2="' + lerp(py, ny, e) + '" stroke="' + col + '" stroke-opacity="' + 0.45 * dim + '" stroke-width="' + Math.max(1, 3 - k * 0.6) + '"/>'
                if (e >= 1) {
                  const f = (t * 0.9 + hash(k, i)) % 1
                  coins += '<circle cx="' + lerp(px, nx, f) + '" cy="' + lerp(py, ny, f) + '" r="' + Math.max(2, 5 - k) + '" fill="' + col + '" opacity="' + dim + '"/>'
                }
              }
            }
            const nq = clamp(q * 1.4 - 0.6)
            if (nq > 0) nodes += '<circle cx="' + nx + '" cy="' + ny + '" r="' + r * pop(nq, 0, 1) + '" fill="' + C.panel + '" stroke="' + col + '" stroke-width="' + (k ? 2 : 4) + '" opacity="' + dim + '"/>'
          }
        }
        return edges + coins + nodes
      }

      function mixer(x, y, r, t, { p = 1, from = COIN.eth, to = C.hue.gray, label = '' } = {}) {
        if (p <= 0) return ''
        let out = '<g opacity="' + clamp(p * 1.5) + '">'
        for (let k = 0; k < 4; k++) {
          const rr = r * (0.35 + k * 0.22), dir = k % 2 ? -1 : 1
          out += '<circle cx="' + x + '" cy="' + y + '" r="' + rr + '" fill="none" stroke="' + C.text + '" stroke-opacity="' + (0.12 + k * 0.05) + '" stroke-width="3" stroke-dasharray="' + rr * 0.5 + ' ' + rr * 0.3 + '" transform="rotate(' + t * 90 * dir / (k + 1) + ' ' + x + ' ' + y + ')"/>'
        }
        out += '<circle cx="' + x + '" cy="' + y + '" r="' + r * 0.18 + '" fill="' + C.text + '" opacity=".15"/>'
        for (let k = 0; k < 28; k++) {
          const f = (t * 0.35 + hash(k, 5)) % 1
          let px, py, c
          if (f < 0.65) {
            const s = f / 0.65, a = hash(k, 6) * Math.PI * 2 + s * Math.PI * 3, rr = r * 1.5 * (1 - s)
            px = x + Math.cos(a) * rr; py = y + Math.sin(a) * rr; c = from
          } else {
            const s = (f - 0.65) / 0.35, a = 0.3 + (hash(k, 7) - 0.5) * 0.8
            px = x + Math.cos(a) * r * 1.8 * s; py = y + Math.sin(a) * r * 1.8 * s; c = to
          }
          out += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="5" fill="' + c + '"/>'
        }
        return out + (label ? txt(x, y + r * 1.25 + 24, label, { size: 20, weight: 800, color: C.muted, anchor: 'middle', extra: 'letter-spacing="1.5"' }) : '') + '</g>'
      }

      function paper({ x, y, w, h, title = '', lines = [], p = 1, reveal = 0, tilt = 0 } = {}) {
        if (p <= 0) return ''
        const lh = 30
        let body = ''
        lines.forEach((l, i) => {
          const ly = y + 92 + i * lh
          if (ly > y + h - 24) return
          const tw = Math.min(w - 64, String(l.text).length * 8.6)
          body += txt(x + 32, ly, l.text, { size: 16, weight: 500, color: '#1a1a1a', font: 'Georgia, serif' })
          if (l.redact) {
            const k = 1 - ease(clamp(reveal * lines.length - i * 0.6))
            if (k > 0) body += '<rect x="' + (x + 30) + '" y="' + (ly - 17) + '" width="' + tw * k + '" height="22" fill="#0a0a0a"/>'
          }
        })
        return '<g opacity="' + clamp(p * 2) + '" transform="rotate(' + tilt + ' ' + (x + w / 2) + ' ' + (y + h / 2) + ') translate(0 ' + (1 - ease(p)) * 50 + ')">' +
          '<rect x="' + (x + 8) + '" y="' + (y + 10) + '" width="' + w + '" height="' + h + '" fill="#000" opacity=".3"/>' +
          '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#f3efe6"/>' +
          txt(x + 32, y + 50, title, { size: 20, weight: 800, color: '#111', extra: 'letter-spacing="2"' }) +
          '<line x1="' + (x + 32) + '" y1="' + (y + 64) + '" x2="' + (x + w - 32) + '" y2="' + (y + 64) + '" stroke="#111" stroke-width="2"/>' + body + '</g>'
      }

      function quote({ x, y, w, text = '', who = '', p = 1, size = 34, color = C.text } = {}) {
        if (p <= 0) return ''
        const lines = wrap(text, Math.max(8, Math.round(w / (size * 0.52))))
        const total = lines.reduce((n, l) => n + l.length, 0)
        let left = Math.round(clamp(p * 1.25) * total), body = ''
        lines.forEach((l, i) => {
          const n = Math.min(left, l.length)
          left -= n
          body += txt(x, y + 70 + i * size * 1.25, l.slice(0, n), { size, weight: 700, color, font: NH })
        })
        return '<g opacity="' + clamp(p * 3) + '">' + txt(x - 6, y + 40, '“', { size: 110, weight: 900, color: C.accent, font: 'Georgia, serif' }) + body +
          '<g opacity="' + clamp(p * 4 - 3) + '">' + txt(x, y + 70 + lines.length * size * 1.25 + 14, '— ' + who, { size: 19, weight: 700, color: C.muted }) + '</g></g>'
      }

      function clip({ x, y, w, outlet = '', title = '', date = '', p = 1, tilt = -2 } = {}) {
        if (p <= 0) return ''
        const lines = wrap(title, Math.round(w / 15)), h = 96 + lines.length * 34, s = 1 + 0.25 * (1 - pop(p, 0, 0.6))
        return '<g opacity="' + clamp(p * 2.5) + '" transform="translate(' + (x + w / 2) + ' ' + (y + h / 2) + ') rotate(' + tilt + ') scale(' + s + ') translate(' + -w / 2 + ' ' + -h / 2 + ')">' +
          '<rect x="6" y="10" width="' + w + '" height="' + h + '" rx="6" fill="#000" opacity=".35"/>' +
          '<rect width="' + w + '" height="' + h + '" rx="6" fill="#fbfaf7"/>' +
          '<rect width="' + w + '" height="6" rx="3" fill="' + C.hue.red + '"/>' +
          txt(24, 40, outlet.toUpperCase(), { size: 15, weight: 900, color: '#555', extra: 'letter-spacing="2"' }) +
          lines.map((l, i) => txt(24, 78 + i * 34, l, { size: 27, weight: 800, color: '#111', font: 'Georgia, serif' })).join('') +
          txt(24, h - 18, date, { size: 14, weight: 600, color: '#777' }) + '</g>'
      }

      Object.assign(window.kit, { COIN, icon, badge, breaking, ticker, live, timer, alarm, shake, timeline, chart, candles, price, ledger, txid, wallet, trail, mixer, paper, quote, clip, wrap })`
}

// News narrative: its own parts on top of kinetic type's words and the
// map's places (the scripts are the map's countries)
const NEWS = {
  about: NEWS_KIT.about,
  tools: `${NEWS_KIT.tools}

  Big words and stamps (as in kinetic type; stage() clears their #type layer):${KINETIC.tools}

  Places (as in the map style):${MAP.tools}`,
  css: KINETIC.css,
  js: KINETIC.js + MAP.js + NEWS_KIT.js,
  scripts: MAP.scripts
}

export const EXTRAS = { kinetic: KINETIC, blueprint: BLUEPRINT, ui: UI, map: MAP, news: NEWS }

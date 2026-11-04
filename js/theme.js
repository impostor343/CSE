// Appearance: palette, three card colours, font, light/dark mode and text size. Saved in localStorage.
// Every colour the app uses is DERIVED from the three chosen colours plus light/dark, so any colour works:
// text on a coloured card is picked for contrast, and link/bar colours are adjusted to stay readable.
(function () {
  'use strict';
  var KEY = 'cse-roadmap-appearance';
  var PALETTES = [
    { id: 'default', name: 'Neon', colors: ['#D2F8A0', '#C8BBF6', '#FFC3F0'] },
    { id: 'ocean', name: 'Ocean', colors: ['#A9D4FF', '#B9C2FF', '#9EF0E4'] },
    { id: 'violet', name: 'Violet', colors: ['#C9B8FF', '#A8C4FF', '#FFC0E8'] },
    { id: 'sunset', name: 'Sunset', colors: ['#FFD39A', '#FFB8A0', '#F6E58E'] },
    { id: 'rose', name: 'Rose', colors: ['#FFB9D4', '#E2B9FF', '#FFD6B3'] },
    { id: 'teal', name: 'Teal', colors: ['#9BE8DC', '#B6F0A8', '#A5D8F5'] },
    { id: 'slate', name: 'Graphite', colors: ['#C5CDD9', '#AEB8C8', '#D9D2C5'] },
    { id: 'citrus', name: 'Citrus', colors: ['#F7E86A', '#FFB36B', '#B6EC8A'] },
    { id: 'coral', name: 'Coral Reef', colors: ['#FF9C8F', '#FFCB85', '#7FE0D0'] },
    { id: 'skypop', name: 'Sky Pop', colors: ['#79C8FF', '#C3B5FF', '#FFE27A'] },
    { id: 'indigo', name: 'Indigo', colors: ['#A4ABFF', '#7DD3FF', '#FFB9EE'] },
    { id: 'moss', name: 'Moss', colors: ['#B0E08A', '#F3DE8A', '#86E0C2'] }
  ];
  PALETTES.forEach(function (p) { p.color = p.colors[0]; });
  var FONTS = [
    { id: 'default', name: 'Default', note: 'Poppins headings, Inter text' }, { id: 'inter', name: 'Inter', note: 'Clean and neutral' }, { id: 'poppins', name: 'Poppins', note: 'Rounded and friendly' },
    { id: 'lora', name: 'Lora', note: 'Bookish serif' }, { id: 'classic', name: 'Classic serif', note: 'Georgia style' }, { id: 'mono', name: 'Monospace', note: 'Code look' },
    { id: 'studio', name: 'Studio', note: 'Bricolage headings, Instrument Sans text' }, { id: 'outfit', name: 'Outfit', note: 'Geometric and friendly' },
    { id: 'editorial', name: 'Editorial', note: 'Instrument Serif headings, easy reading' }, { id: 'dev', name: 'Dev', note: 'JetBrains Mono headings, Work Sans text' }
  ];
  var MODES = [{ id: 'auto', name: 'Match phone' }, { id: 'light', name: 'Light' }, { id: 'dark', name: 'Dark' }];
  var SIZES = [{ id: 'small', name: 'Small' }, { id: 'normal', name: 'Normal' }, { id: 'large', name: 'Large' }, { id: 'xlarge', name: 'Extra large' }];
  var DEFAULTS = { palette: 'default', font: 'default', mode: 'dark', size: 'normal', primary: PALETTES[0].colors[0], secondary: PALETTES[0].colors[1], tertiary: PALETTES[0].colors[2] };
  var HEX = /^#[0-9a-fA-F]{6}$/;

  // ---- colour maths ----
  function rgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function hex(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function lum(h) { var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); }
  function on(bg) { return ratio(bg, '#0D0D10') >= ratio(bg, '#FFFFFF') ? '#0D0D10' : '#FFFFFF'; }
  // move colour c toward white/black just far enough to reach the contrast ratio against bg
  function readable(c, bg, min) {
    if (ratio(c, bg) >= min) { return c; }
    var toward = lum(bg) < 0.4 ? '#FFFFFF' : '#000000';
    for (var t = 0.05; t <= 1.0001; t += 0.05) { var m = mix(c, toward, t); if (ratio(m, bg) >= min) { return m; } }
    return toward;
  }

  function ids(list) { return list.map(function (x) { return x.id; }); }
  function load() {
    var s = {}; try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
    function col(k) { return HEX.test(s[k] || '') ? s[k] : DEFAULTS[k]; }
    return {
      palette: ids(PALETTES).indexOf(s.palette) !== -1 || s.palette === 'custom' ? s.palette : DEFAULTS.palette,
      font: ids(FONTS).indexOf(s.font) !== -1 ? s.font : DEFAULTS.font, mode: ids(MODES).indexOf(s.mode) !== -1 ? s.mode : DEFAULTS.mode,
      size: ids(SIZES).indexOf(s.size) !== -1 ? s.size : DEFAULTS.size, primary: col('primary'), secondary: col('secondary'), tertiary: col('tertiary')
    };
  }
  function resolvedMode(m) { return m === 'auto' ? (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : m; }

  var BASE = {
    dark: { bg: '#050507', surface: '#121216', surface2: '#1B1B21', line: '#2A2A32', ink: '#F5F4F8', muted: '#A09EAC' },
    light: { bg: '#F2F0F6', surface: '#FFFFFF', surface2: '#EFECF4', line: '#E1DDE8', ink: '#141218', muted: '#6E6A78' }
  };
  function apply(s) {
    var r = document.documentElement, mode = resolvedMode(s.mode), b = BASE[mode], st = r.style;
    r.setAttribute('data-mode', mode);
    if (s.font === 'default') { r.removeAttribute('data-font'); } else { r.setAttribute('data-font', s.font); }
    if (s.size === 'normal') { r.removeAttribute('data-size'); } else { r.setAttribute('data-size', s.size); }
    r.removeAttribute('data-palette');
    var p = s.primary, q = s.secondary, t = s.tertiary;
    var text = readable(p, b.bg, 4.5), deep = readable(p, '#FFFFFF', 4.5);
    var set = function (k, v) { st.setProperty(k, v); };
    set('--bg', b.bg); set('--surface', b.surface); set('--surface-2', b.surface2); set('--line', b.line); set('--ink', b.ink); set('--muted', b.muted);
    set('--accent', p); set('--accent-strong', text); set('--accent-text', text); set('--deep', mode === 'dark' ? p : deep);
    set('--on-accent', on(p)); set('--secondary', q); set('--on-secondary', on(q)); set('--tertiary', t); set('--on-tertiary', on(t));
    set('--tint', mix(b.bg, p, mode === 'dark' ? 0.14 : 0.18)); set('--soft-1', mix(b.surface, p, 0.05)); set('--soft-2', mix(b.surface, p, 0.1));
    set('--soft-line', mix(b.line, p, 0.35)); set('--pill', mix(b.surface, p, mode === 'dark' ? 0.24 : 0.3));
    set('--pill-ink', readable(p, mix(b.surface, p, mode === 'dark' ? 0.24 : 0.3), 4.5)); set('--deep-ink', b.ink); set('--soft-ink', b.muted); set('--chip-plain', b.surface2);
    var m = document.querySelector('meta[name="theme-color"]') || document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'theme-color' }));
    m.setAttribute('content', b.bg);
  }

  // Contrast report for the three card colours: text on each card, and the accent used as text on the page and on the other cards.
  function checks(s) {
    var mode = resolvedMode(s.mode), b = BASE[mode], out = [];
    [['Card 1', s.primary], ['Card 2', s.secondary], ['Card 3', s.tertiary]].forEach(function (c) {
      var r = ratio(c[1], on(c[1])); out.push({ label: c[0] + ' text', ratio: r, ok: r >= 4.5 });
    });
    var rp = ratio(s.primary, b.bg); out.push({ label: 'Card 1 colour on the page background', ratio: rp, ok: rp >= 3 });
    return out;
  }
  // Colours the home-screen widget copies from the app (same derivation as the Home card).
  function widgetColors(s) {
    var p = s.primary, q = s.secondary, ink = on(p), dark = '#17171C';
    return { card: p, ink: ink, muted: mix(ink, p, 0.38), pill: mix(p, ink, 0.12), done: mix(p, '#FFFFFF', 0.55), doneInk: on(mix(p, '#FFFFFF', 0.55)),
      prev: mix(p, ink, 0.28), prevInk: on(mix(p, ink, 0.28)), info: q, infoInk: on(q), next: dark, nextInk: '#FFFFFF' };
  }
  var cur = load();
  window.Theme = {
    checks: function () { return checks(cur); }, widgetColors: function () { return widgetColors(cur); }, fixContrast: function () {
      // nudge any card colour that cannot carry readable text toward a lighter tone until it can
      var patch = {}; ['primary', 'secondary', 'tertiary'].forEach(function (k) { var c = cur[k]; if (ratio(c, on(c)) < 4.5) { var t = 0.05, n = c; while (t <= 0.8 && ratio(n, on(n)) < 4.5) { n = mix(c, lum(c) > 0.3 ? '#FFFFFF' : '#000000', t); t += 0.05; } patch[k] = n; } });
      if (Object.keys(patch).length) { this.set(patch); } return Object.keys(patch).length; },
    PALETTES: PALETTES, FONTS: FONTS, MODES: MODES, SIZES: SIZES, DEFAULTS: DEFAULTS,
    get: function () { return { palette: cur.palette, font: cur.font, mode: cur.mode, size: cur.size, primary: cur.primary, secondary: cur.secondary, tertiary: cur.tertiary }; },
    set: function (patch) {
      Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; });
      if (patch.palette && patch.palette !== 'custom') { var pal = PALETTES.filter(function (x) { return x.id === patch.palette; })[0]; if (pal) { cur.primary = pal.colors[0]; cur.secondary = pal.colors[1]; cur.tertiary = pal.colors[2]; } }
      else if (patch.primary || patch.secondary || patch.tertiary) { cur.palette = 'custom'; }
      try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) {} apply(cur);
    },
    reset: function () { cur = { palette: DEFAULTS.palette, font: DEFAULTS.font, mode: DEFAULTS.mode, size: DEFAULTS.size, primary: DEFAULTS.primary, secondary: DEFAULTS.secondary, tertiary: DEFAULTS.tertiary }; try { localStorage.removeItem(KEY); } catch (e) {} apply(cur); }
  };
  apply(cur);
  if (window.matchMedia) { var mq = matchMedia('(prefers-color-scheme: dark)'); var ch = function () { if (cur.mode === 'auto') { apply(cur); } }; if (mq.addEventListener) { mq.addEventListener('change', ch); } }
})();

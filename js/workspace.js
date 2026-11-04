// Modules: one list of pastel cards. Tap the > button and the module opens downwards on the same page (several can stay open);
// inside it is a swipeable deck of its sessions. Next / Previous / swipe change the card in place. #modules/<id> opens and scrolls to that module.
// Search finds single sessions and shows nothing until you type. Uses the existing Curriculum and IndexedDB-backed State.
(function () {
  'use strict';
  var C = window.Curriculum, A = window.State, V = window.SessionView, I = window.Icons, h = U.h, root = document.getElementById('modules-root');
  var legacy = document.getElementById('manual-root'); if (legacy) { legacy.remove(); }
  var query = '', hay = null, memo = {}, sheet = null;
  var SCRIBBLES = [
    'M18 150 L78 34 L108 138 L176 20 L204 126 L278 8',
    'M14 120 C70 20 96 170 150 70 S230 130 286 24',
    'M20 160 L96 60 L60 56 L150 12 L128 100 L246 28 L226 120 L292 70'
  ];
  var TONES = ['a', 'b', 'c'];
  function scribble(i) {
    var s = h('span', { class: 'scribble', 'aria-hidden': 'true' });
    s.innerHTML = '<svg viewBox="0 0 300 180" preserveAspectRatio="xMaxYMax meet"><path d="' + SCRIBBLES[i % SCRIBBLES.length] + '"/></svg>';
    return s;
  }
  function arrowBtn(cls) { return h('span', { class: 'pc-go ' + (cls || ''), 'aria-hidden': 'true', text: '↗' }); }
  function stats(m) { return A.topicStats(m); }
  function currentIn(m) { for (var d = m.startDay; d <= m.endDay; d++) { var s = A.status(d); if (s !== 'completed' && s !== 'skipped') { return d; } } return m.endDay; }
  function statusSelect(current, onChange, label) {
    var s = h('select', { class: 'sel', 'aria-label': label });
    [['not-started', 'Not started'], ['in-progress', 'In progress'], ['completed', 'Completed'], ['needs-revision', 'Needs revision']].forEach(function (x) { var o = h('option', { value: x[0], text: x[1] }); o.selected = x[0] === current; s.appendChild(o); });
    s.addEventListener('change', function () { onChange(s.value); }); return s;
  }

  // ---------- list of modules ----------
  var openSet = {}, mounts = {};
  function moduleCard(m, n) {
    var st = stats(m), status = A.topicStatus(m), tone = TONES[n % 3], isOpen = !!openSet[m.id];
    var go = h('button', { type: 'button', class: 'pc-go', 'aria-expanded': isOpen ? 'true' : 'false', 'aria-label': 'Open ' + m.name, text: '›' });
    var head = h('div', { class: 'pcard pc-' + tone, role: 'group', 'aria-label': m.name + ', ' + st.percent + '% done' },
      h('span', { class: 'pc-top' }, h('span', { class: 'pc-tag', text: U.STATUS[status] }), go),
      h('span', { class: 'pc-meta' }, (function () { var i = h('span', { class: 'pc-ic', 'aria-hidden': 'true' }); i.appendChild(I.make(C.moduleIcon(m.id))); return i; })(), st.done + '/' + st.total + ' sessions'),
      U.tapFull(h('strong', { class: 'pc-title' }), U.shortModule(m), m.name),
      h('span', { class: 'pc-bar', role: 'progressbar', 'aria-valuenow': st.percent, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: 'width:' + st.percent + '%' })));
    head.appendChild(scribble(n));
    var body = h('div', { class: 'acc-body', hidden: isOpen ? null : 'hidden' }), wrap = h('div', { class: 'acc' + (isOpen ? ' is-open' : ''), 'data-id': m.id }, head, body);
    function fillBody() { if (!body.firstChild) { var v = moduleBody(m); body.appendChild(v); mounts[m.id] = v._mount; } }
    function toggle() {
      var now = body.hidden; openSet[m.id] = now; body.hidden = !now; wrap.classList.toggle('is-open', now); go.setAttribute('aria-expanded', now ? 'true' : 'false');
      if (now) { fillBody(); if (mounts[m.id]) { mounts[m.id](); } }
    }
    go.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    head.addEventListener('click', function (e) { if (!e.target.closest('button, a')) { toggle(); } });
    if (isOpen) { fillBody(); }
    return wrap;
  }
  function searchResults(q) {
    if (!hay) { hay = C.sessions.map(function (s) { return (s.title + ' ' + s.topic + ' ' + s.module + ' ' + (s.domain || '')).toLowerCase(); }); }
    var words = q.toLowerCase().split(/\s+/).filter(Boolean), out = [], more = false;
    for (var i = 0; i < hay.length; i++) {
      var ok = true; for (var w = 0; w < words.length; w++) { if (hay[i].indexOf(words[w]) < 0) { ok = false; break; } }
      if (ok) { if (out.length >= 30) { more = true; break; } out.push(C.sessions[i]); }
    }
    var box = h('div', { class: 'srch-results', role: 'list' });
    out.forEach(function (s, n) {
      box.appendChild(h('a', { class: 'srch-row', role: 'listitem', href: '#modules/' + s.moduleId, onclick: function () { memo[s.moduleId] = s.moduleDay - 1; query = ''; } },
        h('span', { class: 'srch-dot pc-' + TONES[n % 3] }),
        h('span', { class: 'srch-main' }, h('strong', { text: s.title }), h('span', { class: 'muted small', text: s.module + ' · Day ' + s.moduleDay + ' of ' + s.moduleTotal })),
        V.chip(s.day)));
    });
    if (!out.length) { box.appendChild(h('p', { class: 'muted srch-empty', text: 'No session matches “' + q + '”. Try a shorter word.' })); }
    else if (more) { box.appendChild(h('p', { class: 'muted small srch-empty', text: 'Showing the first 30. Add another word to narrow it down.' })); }
    return box;
  }
  function list() {
    var w = h('div', { class: 'mod-list' });
    w.appendChild(h('h2', { class: 'screen-h', text: 'Modules' }));
    var input = h('input', { class: 'searchbar', type: 'search', placeholder: 'Search any session', 'aria-label': 'Search sessions', autocomplete: 'off', enterkeyhint: 'search' }); input.value = query;
    var results = h('div'), cards = h('div');
    function fill() {
      var q = query.trim();
      results.textContent = ''; cards.hidden = q.length >= 2;
      if (q.length >= 2) { results.appendChild(searchResults(q)); }
      else if (q.length === 1) { results.appendChild(h('p', { class: 'muted small srch-empty', text: 'Type at least 2 letters.' })); }
    }
    input.addEventListener('input', function () { query = input.value; fill(); });
    w.appendChild(h('label', { class: 'searchwrap' }, (function () { var i = h('span', { class: 'sw-ic', 'aria-hidden': 'true' }); i.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>'; return i; })(), input));
    w.appendChild(results);
    var started = C.modules.filter(function (m) { return A.topicStatus(m) !== 'not-started'; }), idle = C.modules.filter(function (m) { return A.topicStatus(m) === 'not-started'; }), n = 0;
    if (started.length) { cards.appendChild(h('h3', { class: 'ph', text: 'My modules' })); started.forEach(function (m) { cards.appendChild(moduleCard(m, n++)); }); }
    cards.appendChild(h('h3', { class: 'ph', text: started.length ? 'Not started yet' : 'All modules' }));
    idle.forEach(function (m) { cards.appendChild(moduleCard(m, n++)); });
    w.appendChild(cards); fill(); return w;
  }

  // ---------- one module: a deck of sessions ----------
  function closeSheet() { if (sheet) { var s = sheet; sheet = null; if (s.open) { s.close(); } s.remove(); } }
  function openSheet(day) {
    closeSheet();
    var d = h('dialog', { class: 'sheet', 'aria-label': 'Session details' }), inner = h('div', { class: 'sheet-inner' });
    var body = h('div', { class: 'cur' });
    function paint() { body.replaceChildren(V.detail(day)); }
    inner.appendChild(h('div', { class: 'sheet-handle', 'aria-hidden': 'true' }));
    inner.appendChild(h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Close', text: '✕', onclick: closeSheet }));
    inner.appendChild(body); paint(); d.appendChild(inner);
    d.addEventListener('click', function (e) { if (e.target === d) { closeSheet(); } });
    var again = function () { if (sheet === d) { paint(); } }; window.addEventListener('cur-changed', again);
    d.addEventListener('close', function () { window.removeEventListener('cur-changed', again); if (sheet === d) { sheet = null; } d.remove(); });
    window.addEventListener('hashchange', closeSheet, { once: true });
    document.body.appendChild(d); sheet = d; d.showModal();
    if (window.Gestures) { Gestures.dragDismiss(d, inner, closeSheet); }
  }
  function sessionCard(m, day, k, total) {
    var s = C.session(day), status = A.status(day), tone = TONES[k % 3];
    var card = h('div', { class: 'pcard pc-' + tone + ' sess-card' + (status === 'completed' ? ' is-done' : '') },
      h('span', { class: 'pc-top' }, h('span', { class: 'pc-pill', text: s.time || 'Time not set' }), h('span', { class: 'pc-tag', text: U.STATUS[status] })),
      h('span', { class: 'pc-meta', text: s.topic || s.module }),
      U.tapFull(h('strong', { class: 'pc-title' }), U.shortSession(s.title), s.title),
      h('span', { class: 'sess-foot', text: 'Session ' + (k + 1) + ' of ' + total + '  ·  Roadmap day ' + day }));
    card.appendChild(scribble(k)); return card;
  }
  function moduleBody(m) {
    var st = stats(m), status = A.topicStatus(m), total = st.total, w = h('div', { class: 'acc-inner' });
    var k0 = memo[m.id] !== undefined ? memo[m.id] : currentIn(m) - m.startDay;
    k0 = Math.max(0, Math.min(total - 1, k0)); memo[m.id] = k0;
    var ring = h('div', { class: 'pc-a prog-card' }, h('span', { class: 'ring', style: '--p:' + st.percent }, h('b', { text: st.percent + '%' })),
      h('span', { class: 'prog-text' }, h('strong', { text: st.done + ' of ' + total + ' sessions done' }), h('span', { text: U.STATUS[status] })));
    w.appendChild(ring);
    var tools = h('div', { class: 'mod-tools' }, statusSelect(status, function (v) { A.saveTopic(m.id, { status: v }).then(refresh); }, m.name + ' status'));
    if (status === 'not-started') { tools.appendChild(h('button', { class: 'btn primary', type: 'button', text: 'Start module', onclick: function () { A.saveTopic(m.id, { status: 'in-progress' }).then(refresh); } })); }
    w.appendChild(tools);

    var slides = []; for (var d = m.startDay; d <= m.endDay; d++) { slides.push(sessionCard(m, d, d - m.startDay, total)); }
    var counter = h('span', { class: 'deck-count' }), prev = h('button', { type: 'button', class: 'circ-btn', 'aria-label': 'Previous session', text: '←' }), next = h('button', { type: 'button', class: 'circ-btn', 'aria-label': 'Next session', text: '→' });
    var done = h('button', { type: 'button', class: 'btn primary done-btn' }), more = h('button', { type: 'button', class: 'btn ghost', text: 'Details' });
    var deck = Deck.create({ slides: slides, index: k0, onChange: function (i) { memo[m.id] = i; sync(); } });
    function dayNow() { return m.startDay + deck.index(); }
    function sync() {
      var i = deck.index(), day = m.startDay + i;
      counter.textContent = (i + 1) + ' / ' + total;
      prev.disabled = i <= 0; next.disabled = i >= total - 1;
      done.textContent = A.isDone(day) ? '✓ Done · tap to undo' : 'Mark done';
      done.classList.toggle('is-on', A.isDone(day));
    }
    prev.addEventListener('click', function () { deck.go(deck.index() - 1); });
    next.addEventListener('click', function () { deck.go(deck.index() + 1); });
    more.addEventListener('click', function () { openSheet(dayNow()); });
    done.addEventListener('click', function () {
      var day = dayNow(), p = A.isDone(day) ? A.reopen(day) : A.markDone(day);
      p.then(function () { if (A.isDone(day) && A.topicStatus(m) === 'not-started') { return A.saveTopic(m.id, { status: 'in-progress' }); } }).then(function () { window.dispatchEvent(new Event('cur-changed')); });
    });
    w.appendChild(h('div', { class: 'deck-head' }, h('strong', { text: 'Sessions' }), counter));
    w.appendChild(deck.el);
    w.appendChild(h('div', { class: 'deck-actions' }, prev, done, next));
    w.appendChild(h('div', { class: 'deck-sub' }, more, h('span', { class: 'muted small', text: 'Swipe the card or use the arrows' })));
    sync(); w._mount = deck.mount;

    var topics = C.topicsOf(m.id);
    if (topics.length) {
      w.appendChild(h('p', { class: 'acc-sub', text: 'Topics in this module' }));
      topics.forEach(function (tp, n) { var ts = A.conceptStats(tp);
        w.appendChild(h('a', { class: 'mini-card pc-' + TONES[n % 3], href: '#progress/topic/' + tp.id }, h('strong', { text: tp.name }), h('span', { text: U.STATUS[A.conceptStatus(tp)] + ' · ' + ts.done + '/' + ts.total + ' sessions' }))); });
    }
    return w;
  }

  function render(focusId) {
    if (U.route('modules') === null) { return; }
    var view = list(); mounts = {}; root.replaceChildren(view);
    [].slice.call(root.querySelectorAll('.acc.is-open')).forEach(function (el) { var f = mounts[el.getAttribute('data-id')]; if (f) { f(); } });
    if (focusId) { var t = root.querySelector('.acc[data-id="' + focusId + '"]'); if (t) { t.scrollIntoView({ block: 'start' }); } }
  }
  function fromHash() {
    var r = U.route('modules'); if (r === null) { return; }
    closeSheet(); var id = r[0] && C.module(r[0]) ? r[0] : '';
    if (id) { openSet[id] = true; if (history.replaceState) { history.replaceState(null, '', '#modules'); } }
    render(id);
  }
  function refresh() { if (U.route('modules') !== null) { render(); } }
  Promise.all([C.ready, A.ready]).then(function () { fromHash(); window.addEventListener('hashchange', fromHash); window.addEventListener('cur-changed', refresh); })
    .catch(function (e) { root.textContent = 'Could not load: ' + e.message; });
})();

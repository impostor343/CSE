// Home search with categories: All | Questions | Sessions | Modules. Shows nothing until you type; a chosen category searches only that.
(function () {
  'use strict';
  var h = U.h, C = window.Curriculum, host = document.getElementById('home-search'), cat = 'all', q = '', out, input;
  if (!host) { return; }
  var CATS = [['all', 'All'], ['questions', 'Questions'], ['sessions', 'Sessions'], ['modules', 'Modules']];
  function norm(s) { return String(s || '').toLowerCase(); }
  function hit(text, words) { var t = norm(text); return words.every(function (w) { return t.indexOf(w) !== -1; }); }
  function search() {
    var words = norm(q).split(/\s+/).filter(Boolean), lim = cat === 'all' ? 5 : 25, res = [];
    function pack(kind, label, items) { if ((cat === 'all' || cat === kind) && items.length) { res.push({ kind: kind, label: label, items: items }); } }
    function first(arr, mk) { var o = []; for (var i = 0; i < arr.length && o.length < lim + 1; i++) { var r = mk(arr[i]); if (r) { o.push(r); } } return o; }
    var mods = first(C.modules, function (m) { return hit(m.name + ' ' + U.shortModule(m), words) ? { title: U.shortModule(m), sub: m.name, href: '#modules/' + m.id } : null; });
    var sess = first(C.sessions, function (s) { return hit(s.title + ' ' + (s.topic || '') + ' ' + s.module, words) ? { title: U.shortSession(s.title), sub: 'Day ' + s.day + ' · ' + U.shortModule(C.module(s.moduleId)), href: '#today/' + s.day } : null; });
    var qs = first(C.practice, function (p) { return hit(p.id + ' ' + (p.title || p.question || p.name || '') + ' ' + (p.topic || ''), words) ? { title: String(p.title || p.question || p.name || p.id).slice(0, 80), sub: p.id + (p.moduleId ? ' · ' + U.shortModule(C.module(p.moduleId)) : ''), href: '#questions/' + encodeURIComponent(p.id) } : null; });
    pack('modules', 'Modules', mods); pack('sessions', 'Sessions', sess); pack('questions', 'Questions', qs);
    return { res: res, lim: lim };
  }
  function paint() {
    out.textContent = '';
    if (norm(q).trim().length < 2) { return; }
    var r = search(), any = false;
    r.res.forEach(function (g) {
      any = true; var more = g.items.length > r.lim;
      out.appendChild(h('h4', { class: 'hs-h', text: g.label }));
      g.items.slice(0, r.lim).forEach(function (it) {
        out.appendChild(h('a', { class: 'hs-row', href: it.href, onclick: function () { q = ''; input.value = ''; setTimeout(paint, 0); } }, h('strong', { text: it.title }), h('span', { text: it.sub })));
      });
      if (more) { out.appendChild(h('button', { type: 'button', class: 'hs-more', text: 'See more in ' + g.label, onclick: function () { setCat(g.kind); } })); }
    });
    if (!any) { out.appendChild(h('p', { class: 'muted small hs-none', text: 'Nothing found' + (cat === 'all' ? '.' : ' in ' + CATS.filter(function (c) { return c[0] === cat; })[0][1] + '. Try All.') })); }
  }
  var chips = h('div', { class: 'hs-chips', role: 'group', 'aria-label': 'Search in' });
  function setCat(k) { cat = k; [].slice.call(chips.children).forEach(function (b, i) { b.setAttribute('aria-pressed', CATS[i][0] === k ? 'true' : 'false'); }); input.placeholder = k === 'all' ? 'Search sessions, modules, questions…' : 'Search ' + k + ' only…'; paint(); }
  function build() {
    input = h('input', { type: 'search', class: 'hs-input', 'aria-label': 'Search Home', autocomplete: 'off' });
    input.addEventListener('input', function () { q = input.value; paint(); });
    CATS.forEach(function (c) { chips.appendChild(h('button', { type: 'button', class: 'hs-chip', text: c[1], onclick: function () { setCat(c[0]); } })); });
    out = h('div', { class: 'hs-out', 'aria-live': 'polite' });
    host.appendChild(input); host.appendChild(chips); host.appendChild(out); setCat('all');
  }
  C.ready.then(build).catch(function () {});
})();

// Learning Library (tab "Library", route #resources): free books and sites grouped by topic.
// Home = topic cards. #resources/<topic> = that topic's free books (PDF links) and websites.
// Every book can also carry an offline PDF you attach on this phone (kept in IndexedDB; not part of the JSON backup).
(function () {
  'use strict';
  var S = window.Store, h = U.h, root = document.getElementById('resources-root');
  var lib = null, sites = [], state = {}, files = {}, q = '', areaSel = 'All', hideDone = false, blobUrl = null;
  var SCRIBBLES = ['M18 150 L78 34 L108 138 L176 20 L204 126 L278 8', 'M14 120 C70 20 96 170 150 70 S230 130 286 24', 'M20 160 L96 60 L60 56 L150 12 L128 100 L246 28 L226 120 L292 70'];
  var TONES = ['a', 'b', 'c'];
  var AREA_ICON = { 'Git/GitHub': 'branch', Java: 'cup', DSA: 'sitemap', SQL: 'database', JDBC: 'database', DBMS: 'database', Spring: 'link', Testing: 'task', Web: 'globe', JavaScript: 'code', React: 'monitor', TypeScript: 'code',
    C: 'cpu', Python: 'code', OS: 'cpu', Networks: 'network', 'Software Engineering': 'layers', 'Design Patterns': 'layers', Security: 'shield', DevOps: 'server', Cloud: 'cloud', 'System Design': 'sitemap', 'Distributed Systems': 'network', 'Data/ML': 'chart', Android: 'phone' };
  var KIND = { book: 'Book', docs: 'Official docs', course: 'Course', guide: 'Guide' };

  function ic(n) { return window.Icons.make(n); }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }
  function scribble(i) { var s = h('span', { class: 'scribble', 'aria-hidden': 'true' }); s.innerHTML = '<svg viewBox="0 0 300 180" preserveAspectRatio="xMaxYMax meet"><path d="' + SCRIBBLES[i % 3] + '"/></svg>'; return s; }
  function isDone(id) { return !!(state[id] && state[id].done); }
  function say(t) { var s = document.getElementById('lib-status'); if (s) { s.textContent = t; } }
  function size(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function cat(id) { return lib.categories.filter(function (c) { return c.id === id; })[0]; }
  function booksOf(c) { return lib.books.filter(function (b) { return b.areas.some(function (a) { return c.areas.indexOf(a) !== -1; }); }); }
  function sitesOf(c) { return sites.filter(function (s) { return c.areas.indexOf(s.area) !== -1; }); }
  function catDone(c) { var all = booksOf(c); return { done: all.filter(function (b) { return isDone(b.id); }).length, total: all.length }; }
  function offlineCount() { return Object.keys(files).length; }

  // ---- state actions
  function toggleDone(it) { var rec = state[it.id] || { id: it.id }; rec.done = !rec.done; rec.updatedAt = new Date().toISOString(); state[it.id] = rec; return S.put('resourceState', rec).then(render); }
  function attach(it, file) {
    if (!file) { return; }
    if (file.type && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) { say('Please choose a PDF file.'); return; }
    S.put('resourceFiles', { id: it.id, name: file.name, size: file.size, savedAt: new Date().toISOString(), blob: file }).then(function () { files[it.id] = { name: file.name, size: file.size }; render(); say('Saved “' + file.name + '” for offline use on this phone.'); })
      .catch(function (e) { say('Could not save the PDF: ' + (e && e.message || e)); });
  }
  function openFile(it) {
    S.one('resourceFiles', it.id).then(function (r) {
      if (!r || !r.blob) { say('No PDF found for this item.'); return; }
      if (window.NativeFiles && NativeFiles.isNative()) { NativeFiles.shareFile(it.id + '.pdf', r.blob, it.title || it.name).catch(function (e) { if (!/cancel/i.test(String(e && e.message))) { say('Could not open the PDF: ' + (e && e.message || e)); } }); return; }
      if (blobUrl) { URL.revokeObjectURL(blobUrl); } blobUrl = URL.createObjectURL(r.blob);
      var w = window.open(blobUrl, '_blank'); if (!w) { location.href = blobUrl; }
    }).catch(function (e) { say('Could not open the PDF: ' + (e && e.message || e)); });
  }
  function removeFile(it) { if (!confirm('Remove the offline PDF for “' + (it.title || it.name) + '” from this phone?')) { return; } S.del('resourceFiles', it.id).then(function () { delete files[it.id]; render(); }); }
  function find(id) { return lib.books.concat(sites).filter(function (x) { return x.id === id; })[0]; }

  // ---- pieces
  function check(it) { var d = isDone(it.id), t = it.title || it.name; return h('button', { type: 'button', class: 'lib-check', 'aria-pressed': d ? 'true' : 'false', 'aria-label': (d ? 'Unmark ' : 'Mark ') + t + ' as done', onclick: function () { toggleDone(it); } }, ic('check')); }
  function actions(it, isBook) {
    var f = files[it.id], input = h('input', { type: 'file', accept: 'application/pdf,.pdf', hidden: true, onchange: function () { attach(it, this.files[0]); this.value = ''; } }), row = h('div', { class: 'lib-actions' });
    if (isBook && it.pdf) { row.appendChild(h('a', { class: 'lib-btn solid', href: it.pdf, target: '_blank', rel: 'noopener' }, ic('file'), ' Free PDF')); }
    row.appendChild(h('a', { class: 'lib-btn' + (isBook && it.pdf ? '' : ' solid'), href: it.url, target: '_blank', rel: 'noopener' }, isBook ? (it.pdf ? 'Book page ' : 'Read free ') : 'Open ', ic('external')));
    if (f) { row.appendChild(h('button', { type: 'button', class: 'lib-btn offline', onclick: function () { openFile(it); } }, ic('save'), ' Offline PDF')); }
    row.appendChild(h('label', { class: 'lib-btn ghost' }, ic(f ? 'refresh' : 'plus'), f ? ' Replace' : ' Attach PDF', input));
    if (f) { row.appendChild(h('button', { type: 'button', class: 'lib-btn ghost danger', 'aria-label': 'Remove offline PDF', onclick: function () { removeFile(it); } }, ic('trash'))); }
    return row;
  }
  function bookCard(b, i, showArea) {
    var f = files[b.id];
    return h('article', { class: 'lib-card' + (isDone(b.id) ? ' is-done' : ''), style: '--i:' + Math.min(i, 14) },
      h('div', { class: 'lib-card-top' },
        h('span', { class: 'lib-ic' }, ic(AREA_ICON[b.areas[0]] || 'book')),
        h('div', { class: 'lib-main' }, h('h3', { class: 'lib-title', text: b.title }), h('p', { class: 'lib-by', text: b.author })),
        check(b)),
      h('p', { class: 'lib-note', text: b.note }),
      h('div', { class: 'lib-tags' }, h('span', { class: 'lib-tag k-' + b.kind, text: KIND[b.kind] || 'Book' }), h('span', { class: 'lib-tag', text: b.level }), h('span', { class: 'lib-tag lic', text: b.license }),
        showArea ? h('span', { class: 'lib-tag', text: b.areas[0] }) : null, f ? h('span', { class: 'lib-tag on', text: 'Offline ✓' }) : null),
      actions(b, true), f ? h('p', { class: 'lib-file', text: f.name + ' · ' + size(f.size) }) : null);
  }
  function siteCard(s, i, showArea) {
    var f = files[s.id];
    return h('article', { class: 'lib-card lib-site' + (isDone(s.id) ? ' is-done' : ''), style: '--i:' + Math.min(i, 14) },
      h('div', { class: 'lib-card-top' }, h('span', { class: 'lib-ic' }, ic(AREA_ICON[s.area] || 'globe')),
        h('div', { class: 'lib-main' }, h('h3', { class: 'lib-title', text: s.name }), h('p', { class: 'lib-by' }, showArea ? s.area + ' · ' : '', host(s.url))), check(s)),
      actions(s, false), f ? h('p', { class: 'lib-file', text: f.name + ' · ' + size(f.size) }) : null);
  }
  function statusLine() { return h('p', { id: 'lib-status', class: 'lib-status', role: 'status' }); }
  function matches(x) { var t = q.trim().toLowerCase(); return !t || [x.title || x.name, x.author || '', (x.areas || [x.area]).join(' '), x.note || '', x.url].join(' ').toLowerCase().indexOf(t) !== -1; }

  function searchBox() {
    var input = h('input', { type: 'search', class: 'lib-search', placeholder: 'Search books and sites…', 'aria-label': 'Search the library', value: q, autocomplete: 'off', enterkeyhint: 'search' });
    input.addEventListener('input', function () { q = input.value; var pos = input.selectionStart; render(); var n = document.querySelector('.lib-search'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } });
    return h('label', { class: 'lib-searchwrap' }, h('span', { class: 'lib-sic' }, ic('search')), input);
  }

  // ---- views
  function home() {
    var w = h('div', { class: 'lib' }), tb = lib.books.length, ts = sites.length, done = lib.books.filter(function (b) { return isDone(b.id); }).length;
    var hero = h('section', { class: 'lib-hero pc-a' }, scribble(1),
      h('p', { class: 'lib-eyebrow', text: 'Free · legal · offline-ready' }), h('h2', { text: 'Learning Library' }),
      h('p', { class: 'lib-sub', text: tb + ' free books and ' + ts + ' sites across ' + lib.categories.reduce(function (n, c) { return n + c.areas.length; }, 0) + ' topics.' }),
      h('div', { class: 'lib-stats' }, h('span', {}, h('b', { text: done + '/' + tb }), ' books read'), h('span', {}, h('b', { text: String(offlineCount()) }), ' offline PDFs')));
    w.appendChild(hero); w.appendChild(searchBox()); w.appendChild(statusLine());
    if (q.trim().length > 1) { return searchResults(w); }
    w.appendChild(h('h3', { class: 'lib-h', text: 'Topics' }));
    var grid = h('div', { class: 'lib-grid' });
    lib.categories.forEach(function (c, i) {
      var cd = catDone(c), nb = booksOf(c).length, ns = sitesOf(c).length, pct = cd.total ? Math.round(cd.done * 100 / cd.total) : 0;
      grid.appendChild(h('a', { class: 'lib-cat pc-' + TONES[i % 3], href: '#resources/' + c.id, style: '--i:' + i, 'aria-label': c.name + ', ' + nb + ' books, ' + ns + ' sites' },
        scribble(i), h('span', { class: 'lib-cat-ic' }, ic(c.icon)), h('span', { class: 'lib-go', 'aria-hidden': 'true', text: '↗' }),
        h('strong', { class: 'lib-cat-name', text: c.name }), h('span', { class: 'lib-cat-sub', text: c.sub }),
        h('span', { class: 'lib-cat-count', text: nb + ' books · ' + ns + ' sites' }),
        h('span', { class: 'pc-bar' }, h('i', { style: 'width:' + pct + '%' }))));
    });
    w.appendChild(grid);
    var mine = Object.keys(files).map(find).filter(Boolean);
    if (mine.length) {
      w.appendChild(h('h3', { class: 'lib-h', text: 'On this phone (' + mine.length + ')' }));
      mine.forEach(function (it, i) { w.appendChild(it.title ? bookCard(it, i, true) : siteCard(it, i, true)); });
    }
    w.appendChild(h('p', { class: 'lib-foot', text: 'Attached PDFs stay on this phone only and are not in the JSON backup, so keep the originals too. Only legally free books are listed.' }));
    return w;
  }
  function searchResults(w) {
    var b = lib.books.filter(matches), s = sites.filter(matches), n = 0;
    w.appendChild(h('h3', { class: 'lib-h', text: b.length + s.length + ' results' }));
    if (!b.length && !s.length) { w.appendChild(h('p', { class: 'lib-empty', text: 'Nothing matches. Try a shorter word.' })); return w; }
    b.slice(0, 30).forEach(function (x) { w.appendChild(bookCard(x, n++, true)); }); s.slice(0, 30).forEach(function (x) { w.appendChild(siteCard(x, n++, true)); });
    return w;
  }
  function category(c) {
    var w = h('div', { class: 'lib' }), idx = lib.categories.indexOf(c), cd = catDone(c), pct = cd.total ? Math.round(cd.done * 100 / cd.total) : 0;
    w.appendChild(h('a', { class: 'circ-btn lib-back', href: '#resources', 'aria-label': 'Back to Library' }, ic('left')));
    w.appendChild(h('section', { class: 'lib-hero pc-' + TONES[idx % 3] }, scribble(idx), h('span', { class: 'lib-cat-ic big' }, ic(c.icon)), h('h2', { text: c.name }), h('p', { class: 'lib-sub', text: c.sub }),
      h('p', { class: 'lib-stats' }, h('span', {}, h('b', { text: String(booksOf(c).length) }), ' books'), h('span', {}, h('b', { text: String(sitesOf(c).length) }), ' sites'), h('span', {}, h('b', { text: cd.done + '/' + cd.total }), ' read')),
      h('span', { class: 'pc-bar' }, h('i', { style: 'width:' + pct + '%' }))));
    w.appendChild(searchBox()); w.appendChild(statusLine());
    var chips = h('div', { class: 'lib-chips', role: 'group', 'aria-label': 'Filter by topic' });
    ['All'].concat(c.areas).forEach(function (a) { chips.appendChild(h('button', { type: 'button', class: 'lib-chip', 'aria-pressed': a === areaSel ? 'true' : 'false', text: a, onclick: function () { areaSel = a; render(); } })); });
    chips.appendChild(h('button', { type: 'button', class: 'lib-chip toggle', 'aria-pressed': hideDone ? 'true' : 'false', text: 'Hide done', onclick: function () { hideDone = !hideDone; render(); } }));
    w.appendChild(chips);
    function keep(x) { var ar = x.areas || [x.area]; return (areaSel === 'All' || ar.indexOf(areaSel) !== -1) && !(hideDone && isDone(x.id)) && matches(x); }
    var b = booksOf(c).filter(keep), s = sitesOf(c).filter(keep), n = 0;
    w.appendChild(h('h3', { class: 'lib-h', text: 'Free books (' + b.length + ')' }));
    if (!b.length) { w.appendChild(h('p', { class: 'lib-empty', text: 'No books here with these filters.' })); }
    b.forEach(function (x) { w.appendChild(bookCard(x, n++, areaSel === 'All')); });
    w.appendChild(h('h3', { class: 'lib-h', text: 'Websites and courses (' + s.length + ')' }));
    if (!s.length) { w.appendChild(h('p', { class: 'lib-empty', text: 'No sites here with these filters.' })); }
    s.forEach(function (x) { w.appendChild(siteCard(x, n++, areaSel === 'All')); });
    return w;
  }

  function render() {
    if (!lib) { return; }
    var r = U.route('resources'), c = r && r[0] ? cat(r[0]) : null;
    root.textContent = ''; root.appendChild(c ? category(c) : home());
  }
  var last = '';
  function onRoute() { var r = U.route('resources'); if (r === null) { return; } var key = r.join('/'); if (key !== last) { last = key; q = ''; areaSel = 'All'; } render(); }

  Promise.all([fetch('data/library.json').then(function (r) { return r.json(); }), fetch('data/free-resources.json').then(function (r) { return r.json(); }), S.all('resourceState').catch(function () { return []; }), S.all('resourceFiles').catch(function () { return []; })]).then(function (r) {
    lib = r[0]; sites = (r[1].items || []); r[2].forEach(function (x) { state[x.id] = x; }); r[3].forEach(function (x) { files[x.id] = { name: x.name, size: x.size }; });
    onRoute(); window.addEventListener('hashchange', onRoute);
  }).catch(function (e) { root.textContent = 'Could not load the library: ' + e.message; });
})();

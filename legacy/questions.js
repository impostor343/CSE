// Question Bank: your curated practice problems from the workbook, grouped by topic.
// You can search, filter, open a problem, set your own status and keep notes (saved on this phone).

(function () {
  'use strict';

  var D = window.RoadmapData;
  var ST = window.RoadmapStatus;
  var I = window.Icons;
  var root = document.getElementById('questions-root');
  var sheet = document.getElementById('q-sheet');
  var inner = document.getElementById('q-inner');
  var STATUS = [['not-started', 'Not started'], ['in-progress', 'In progress'], ['solved', 'Solved']];
  var MARK = { 'not-started': '○', 'in-progress': '◐', solved: '✓' };
  var STATUS_FILTERS = [['all', 'All'], ['assigned', 'Assigned'], ['unassigned', 'Not assigned'],
                        ['not-started', 'Not started'], ['in-progress', 'In progress'], ['solved', 'Solved']];

  var questions = [];
  var groups = [];
  var filters = { text: '', status: 'all', platform: 'all' };
  var expanded = {};
  var listEl, summaryEl, chipRows = {};
  var pending = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  }
  function shortPlatform(p) { return p.split(' (')[0]; }
  function isPlaceholder(q) { return !q.url && q.platform.indexOf('Codex') === 0; }
  function isAssigned(q) { return q.status === 'Assigned (suggested)'; }
  function stateOf(q) { return isPlaceholder(q) ? null : ST.question(q.id).status; }

  function topicOf(q) {
    var m = /Learn\/practise:\s*([^;]+);/.exec(q.prerequisites || '');
    if (m) { var t = m[1].trim(); return t.charAt(0).toUpperCase() + t.slice(1); }
    return isPlaceholder(q) ? 'Codex slots (platform not confirmed)' : 'Other';
  }

  function matches(q) {
    if (filters.platform !== 'all' && shortPlatform(q.platform) !== filters.platform) { return false; }
    var f = filters.status;
    if (f === 'assigned' && !isAssigned(q)) { return false; }
    if (f === 'unassigned' && isAssigned(q)) { return false; }
    if ((f === 'not-started' || f === 'in-progress' || f === 'solved') && stateOf(q) !== f) { return false; }
    var t = filters.text.trim().toLowerCase();
    if (t && (q.title + ' ' + topicOf(q) + ' ' + q.platform + ' ' + (q.purpose || '')).toLowerCase().indexOf(t) === -1) { return false; }
    return true;
  }

  // ---------- list ----------
  function renderList() {
    var total = questions.filter(function (q) { return !isPlaceholder(q); });
    var solved = total.filter(function (q) { return stateOf(q) === 'solved'; }).length;
    var shown = 0;
    var filtering = filters.text.trim() || filters.status !== 'all' || filters.platform !== 'all';
    listEl.textContent = '';
    groups.forEach(function (g) {
      var items = g.items.filter(matches);
      if (!items.length) { return; }
      shown += items.length;
      var open = filtering || expanded[g.name];
      var trackable = g.items.filter(function (q) { return !isPlaceholder(q); });
      var done = trackable.filter(function (q) { return stateOf(q) === 'solved'; }).length;
      var head = el('button', 'q-group-head');
      head.type = 'button';
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
      head.appendChild(el('span', 'q-group-name', g.name));
      head.appendChild(el('span', 'q-group-count', trackable.length ? done + ' / ' + trackable.length + ' solved' : items.length + ' slots'));
      var ch = I.make('right', 'chev');
      head.appendChild(ch);
      head.addEventListener('click', function () { expanded[g.name] = !open; if (filtering) { expanded[g.name] = true; } renderList(); });
      var wrap = el('section', 'q-group');
      wrap.appendChild(head);
      if (open) {
        var body = el('div', 'q-items');
        items.forEach(function (q) { body.appendChild(questionRow(q)); });
        wrap.appendChild(body);
      }
      listEl.appendChild(wrap);
    });
    if (!shown) { listEl.appendChild(el('p', 'empty-note', 'No problems match.')); }
    summaryEl.textContent = 'Showing ' + shown + ' of ' + questions.length + ' entries. Solved: ' + solved + ' of ' + total.length + ' problems.';
  }

  function questionRow(q) {
    var s = stateOf(q);
    var b = el('button', 'q-row' + (s ? ' q-' + s : ' q-placeholder'));
    b.type = 'button';
    var body = el('span', 'q-body');
    body.appendChild(el('span', 'q-title', q.title));
    var meta = el('span', 'q-meta');
    meta.appendChild(el('span', 'tag', shortPlatform(q.platform)));
    if (q.difficulty && q.difficulty !== 'TBD') { meta.appendChild(el('span', 'tag', q.difficulty)); }
    if (isAssigned(q)) { meta.appendChild(el('span', 'tag tag-green', 'Assigned ' + D.shortDate(q.recommendedDate))); }
    if (isPlaceholder(q)) { meta.appendChild(el('span', 'tag tag-warn', 'Needs clarification')); }
    body.appendChild(meta);
    b.appendChild(body);
    if (s) {
      var st = el('span', 'q-state');
      var m = el('span', '', MARK[s]); m.setAttribute('aria-hidden', 'true');
      st.appendChild(m);
      st.appendChild(document.createTextNode(' ' + STATUS.filter(function (x) { return x[0] === s; })[0][1]));
      b.appendChild(st);
    }
    b.addEventListener('click', function () { openQuestion(q); });
    return b;
  }

  // ---------- detail sheet ----------
  function flush() { if (pending) { clearTimeout(pending.t); var run = pending.run; pending = null; run(); } }
  sheet.addEventListener('close', function () { flush(); renderList(); });
  sheet.addEventListener('click', function (ev) { if (ev.target === sheet) { sheet.close(); } });

  function card(iconName, heading) {
    var s = el('section', 'info-card');
    var h = el('div', 'info-card-head');
    var ic = el('span', 'info-ic'); ic.appendChild(I.make(iconName));
    h.appendChild(ic); h.appendChild(el('h3', '', heading));
    s.appendChild(h);
    return s;
  }
  function line(sec, label, value) {
    if (!value) { return; }
    var r = el('div', 'info-row');
    r.appendChild(el('span', 'info-label', label));
    r.appendChild(el('span', 'info-value', value));
    sec.appendChild(r);
  }

  function openQuestion(q) {
    flush();
    inner.textContent = '';
    inner.appendChild(el('div', 'sheet-handle'));
    var top = el('div', 'sheet-top');
    var chip = el('span', 'chip-tag');
    chip.appendChild(I.make('code'));
    chip.appendChild(document.createTextNode(' ' + shortPlatform(q.platform)));
    top.appendChild(chip);
    var close = el('button', 'close-btn');
    close.type = 'button'; close.setAttribute('aria-label', 'Close');
    close.appendChild(I.make('close'));
    close.addEventListener('click', function () { sheet.close(); });
    top.appendChild(close);
    inner.appendChild(top);
    var title = el('h2', 'sheet-title', q.title);
    title.id = 'q-title';
    sheet.setAttribute('aria-labelledby', 'q-title');
    inner.appendChild(title);
    var meta = el('p', 'sheet-meta', topicOf(q) + (q.difficulty && q.difficulty !== 'TBD' ? ', ' + q.difficulty : ''));
    inner.appendChild(meta);

    if (isPlaceholder(q)) {
      var ph = card('info', 'Placeholder');
      line(ph, 'Note', 'The Codex platform name and link have not been confirmed yet, so no problem is listed. Nothing here is invented.');
      inner.appendChild(ph);
      sheet.showModal();
      return;
    }

    var pr = card('code', 'Problem');
    if (q.url) {
      var a = el('a', 'info-link');
      a.href = q.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.appendChild(I.make('external'));
      a.appendChild(el('span', '', 'Open on ' + shortPlatform(q.platform)));
      a.appendChild(I.make('right'));
      pr.appendChild(a);
    }
    line(pr, 'Why', q.purpose);
    line(pr, 'Topic', topicOf(q));
    inner.appendChild(pr);

    var as = card('calendar', 'Assignment');
    if (isAssigned(q)) {
      var entry = D.entries.filter(function (e) { return e.day === q.recommendedDay; })[0];
      line(as, 'Suggested', D.formatDate(q.recommendedDate) + (entry ? ' (' + D.titleOf(entry) + ')' : ''));
      var open = el('button', 'btn outline');
      open.type = 'button';
      open.appendChild(I.make('calendar'));
      open.appendChild(el('span', '', 'Open that day'));
      open.addEventListener('click', function () {
        sheet.close();
        if (window.TodayView && entry) { window.TodayView.showDay(entry.day); }
        window.location.hash = '#today';
      });
      as.appendChild(open);
    } else {
      line(as, 'Suggested', 'Not scheduled. This is a catalogue entry, not a missing assignment.');
    }
    line(as, 'Rule', q.assignmentRule);
    inner.appendChild(as);

    var mine = card('task', 'My progress');
    var seg = el('div', 'segmented');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', 'Status');
    function paint() {
      var cur = ST.question(q.id).status;
      Array.prototype.forEach.call(seg.children, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-v') === cur ? 'true' : 'false'); });
    }
    STATUS.forEach(function (st) {
      var b = el('button', 'seg-btn', st[1]);
      b.type = 'button'; b.setAttribute('data-v', st[0]);
      b.addEventListener('click', function () { ST.saveQuestion(q.id, { status: st[0] }).then(paint, paint); });
      seg.appendChild(b);
    });
    mine.appendChild(seg);
    var label = el('label', 'notes-label', 'My notes (hints, mistakes, what to revisit)');
    label.htmlFor = 'q-notes';
    var ta = el('textarea', 'notes-input');
    ta.id = 'q-notes'; ta.rows = 4; ta.placeholder = 'Write your notes here…';
    ta.value = ST.question(q.id).notes || '';
    ta.addEventListener('input', function () {
      if (pending) { clearTimeout(pending.t); }
      pending = { run: function () { ST.saveQuestion(q.id, { notes: ta.value }); }, t: setTimeout(flush, 700) };
    });
    mine.appendChild(label);
    mine.appendChild(ta);
    mine.appendChild(el('p', 'notes-status', 'Saved on this phone only.'));
    inner.appendChild(mine);
    paint();
    if (q.notes) { var wn = card('info', 'From the workbook'); line(wn, 'Note', q.notes); inner.appendChild(wn); }
    sheet.showModal();
  }

  // ---------- screen shell ----------
  function chipRow(kind, options) {
    var row = el('div', 'chip-row');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', kind === 'status' ? 'Filter by status' : 'Filter by platform');
    chipRows[kind] = row;
    options.forEach(function (o) {
      var b = el('button', 'filter-chip', o[1]);
      b.type = 'button';
      b.setAttribute('data-v', o[0]);
      b.addEventListener('click', function () { filters[kind] = o[0]; paintChips(); renderList(); });
      row.appendChild(b);
    });
    return row;
  }
  function paintChips() {
    Object.keys(chipRows).forEach(function (k) {
      Array.prototype.forEach.call(chipRows[k].children, function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-v') === filters[k] ? 'true' : 'false');
      });
    });
  }

  function build() {
    root.textContent = '';
    root.appendChild(el('p', 'subtitle', 'Practice problems from your workbook. Optional, not deadlines.'));
    var search = el('div', 'search-box');
    search.appendChild(I.make('search'));
    var input = el('input');
    input.type = 'search'; input.placeholder = 'Search problems or topics'; input.setAttribute('aria-label', 'Search problems');
    input.addEventListener('input', function () { filters.text = input.value; renderList(); });
    search.appendChild(input);
    root.appendChild(search);
    root.appendChild(chipRow('status', STATUS_FILTERS));
    var plats = [['all', 'All platforms']];
    questions.forEach(function (q) { var p = shortPlatform(q.platform); if (!plats.some(function (x) { return x[0] === p; })) { plats.push([p, p]); } });
    root.appendChild(chipRow('platform', plats));
    summaryEl = el('p', 'note-small');
    summaryEl.setAttribute('aria-live', 'polite');
    root.appendChild(summaryEl);
    listEl = el('div', 'q-list');
    root.appendChild(listEl);
    paintChips();
    renderList();
  }

  Promise.all([D.ready, ST.ready]).then(function () {
    questions = D.questions;
    var seen = {};
    groups = [];
    questions.forEach(function (q) {
      var t = topicOf(q);
      if (!seen[t]) { seen[t] = { name: t, items: [] }; groups.push(seen[t]); }
      seen[t].items.push(q);
    });
    build();
    window.addEventListener('hashchange', function () {
      if (window.location.hash === '#questions') { ST.load().then(renderList); }
    });
  }).catch(function (err) {
    root.textContent = '';
    root.appendChild(el('p', 'empty', 'Could not load the Question Bank: ' + err.message));
  });
})();

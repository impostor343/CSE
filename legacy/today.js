// Home: the day card, Done/Skipped, Previous/Next, Jump to date, notes, and the Info sheet.

(function () {
  'use strict';

  var D = window.RoadmapData;
  var ST = window.RoadmapStatus;
  var I = window.Icons;
  var box = document.getElementById('today-card');
  var sheet = document.getElementById('info-sheet');
  var sheetInner = document.getElementById('info-inner');
  var index = 0;
  var LABELS = { pending: ['○', 'Pending'], done: ['✓', 'Done'], skipped: ['→', 'Skipped, catch-up waiting'], caughtup: ['↻', 'Caught up'] };
  var Q_LABELS = { 'not-started': 'Not started', 'in-progress': 'In progress', solved: 'Solved' };

  window.TodayView = { showDay: showDay };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  }

  // Button with an optional line icon before (or after) the label.
  function button(label, cls, onClick, disabled, iconName, iconAfter) {
    var b = el('button', 'btn ' + cls);
    b.type = 'button';
    if (iconName && !iconAfter) { b.appendChild(I.make(iconName)); }
    b.appendChild(el('span', '', label));
    if (iconName && iconAfter) { b.appendChild(I.make(iconName)); }
    b.disabled = !!disabled;
    b.addEventListener('click', onClick);
    return b;
  }

  function todayIndex() {
    var iso = D.todayIso();
    var i = D.indexOfDate(iso);
    if (i >= 0) { return i; }
    return iso < D.entries[0].date ? 0 : D.entries.length - 1;
  }

  // ---------- the card ----------
  function render() {
    var e = D.entries[index];
    var learning = ST.isLearning(e);
    box.textContent = '';
    if (ST.error) { box.appendChild(el('p', 'warn', 'Your saved progress could not be loaded. ' + ST.error)); }
    box.appendChild(makeStrip());

    var card = el('article', 'day-card');
    var top = el('div', 'card-top');
    var left = el('div', 'card-left');
    var date = el('p', 'card-date');
    date.appendChild(I.make('calendar'));
    date.appendChild(document.createTextNode(' ' + D.formatDate(e.date) + (e.date === D.todayIso() ? ' (today)' : '')));
    left.appendChild(date);
    var chip = el('h2', 'chip-tag');
    chip.appendChild(I.make(learning ? 'code' : 'calendar'));
    chip.appendChild(document.createTextNode(' ' + e.group));
    left.appendChild(chip);
    top.appendChild(left);
    var sym = el('span', 'card-symbol', e.symbol);
    sym.setAttribute('aria-hidden', 'true');
    top.appendChild(sym);
    card.appendChild(top);

    card.appendChild(el('p', 'card-title', D.titleOf(e)));
    card.appendChild(el('p', 'card-meta', 'Day ' + e.seq + ' of ' + D.entries.length));
    if (e.time) {
      var t = el('p', 'card-meta');
      t.appendChild(I.make('clock'));
      t.appendChild(document.createTextNode(' ' + e.time));
      card.appendChild(t);
    }
    card.appendChild(statusChip(e));
    box.appendChild(card);

    var controls = makeStatusControls(e);
    if (controls) { box.appendChild(controls); }

    var row = el('div', 'actions');
    row.appendChild(button('Previous', '', function () { go(-1); }, index === 0, 'left'));
    row.appendChild(button('Info', 'outline', openInfo, false, 'info'));
    row.appendChild(button('Next', '', function () { go(1); }, index === D.entries.length - 1, 'right', true));
    box.appendChild(row);
    box.appendChild(makeJump(e));

    var notesHost = el('div');
    box.appendChild(notesHost);
    window.DayNotes.mount(notesHost, e, 'today');
  }

  function statusChip(e) {
    var st = el('p', 'status');
    if (!ST.isLearning(e)) { st.textContent = e.added ? 'Pause day' : 'Exam buffer'; return st; }
    var s = ST.state(e.day);
    st.setAttribute('data-state', s);
    var mark = el('span', '', LABELS[s][0]);
    mark.setAttribute('aria-hidden', 'true');
    st.appendChild(mark);
    st.appendChild(document.createTextNode(' ' + LABELS[s][1]));
    return st;
  }

  function makeStatusControls(e) {
    if (!ST.isLearning(e)) { return null; }
    var s = ST.state(e.day);
    var wrap = el('div', 'status-controls');
    function act(fn) { return function () { fn(e.day).then(render, render); }; }
    var row = el('div', 'actions two');
    if (s === 'pending') {
      row.appendChild(button('Done', 'primary', act(ST.markDone), false, 'check'));
      row.appendChild(button('Skipped', '', act(ST.markSkipped), false, 'skip'));
    } else if (s === 'skipped') {
      row.appendChild(button('Mark caught up', 'primary', act(ST.markCaughtUp), false, 'check'));
      row.appendChild(button('Undo', '', act(ST.reset), false, 'undo'));
    } else {
      row.appendChild(button('Undo', '', act(ST.reset), false, 'undo'));
    }
    wrap.appendChild(row);
    if (s === 'done') {
      wrap.appendChild(button('Add a remark', 'link', function () {
        var ta = box.querySelector('textarea[id$="-remarks"]');
        if (ta) { ta.focus(); }
      }));
    }
    return wrap;
  }

  function makeStrip() {
    var strip = el('div', 'day-strip');
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', 'Yesterday, today and tomorrow');
    var names = ['Yesterday', 'Today', 'Tomorrow'];
    [-1, 0, 1].forEach(function (off, k) {
      var iso = D.shiftIso(D.todayIso(), off);
      var i = D.indexOfDate(iso);
      var b = el('button', 'strip-btn');
      b.type = 'button';
      b.appendChild(el('span', '', names[k]));
      b.appendChild(el('small', '', D.shortDate(iso)));
      b.disabled = i < 0;
      if (i === index) { b.setAttribute('aria-current', 'true'); }
      b.addEventListener('click', function () { index = i; render(); window.scrollTo(0, 0); });
      strip.appendChild(b);
    });
    return strip;
  }

  function makeJump(e) {
    var row = el('div', 'jump');
    var label = el('label');
    label.appendChild(I.make('calendar'));
    label.appendChild(document.createTextNode(' Jump to date'));
    label.htmlFor = 'jump-date';
    var input = el('input');
    input.type = 'date';
    input.id = 'jump-date';
    input.min = D.entries[0].date;
    input.max = D.entries[D.entries.length - 1].date;
    input.value = e.date;
    input.addEventListener('change', function () {
      var i = D.indexOfDate(input.value);
      if (i >= 0) { index = i; render(); window.scrollTo(0, 0); }
    });
    row.appendChild(label);
    row.appendChild(input);
    return row;
  }

  function go(step) {
    var next = index + step;
    if (next < 0 || next >= D.entries.length) { return; }
    index = next;
    render();
    window.scrollTo(0, 0);
  }

  function showDay(day) {
    for (var i = 0; i < D.entries.length; i++) {
      if (D.entries[i].day === day) { index = i; render(); return; }
    }
  }

  // ---------- Info sheet ----------
  function section(iconName, heading) {
    var s = el('section', 'info-card');
    var h = el('div', 'info-card-head');
    var ic = el('span', 'info-ic');
    ic.appendChild(I.make(iconName));
    h.appendChild(ic);
    h.appendChild(el('h3', '', heading));
    s.appendChild(h);
    return s;
  }

  function row(sec, label, value) {
    if (!value) { return; }
    var r = el('div', 'info-row');
    r.appendChild(el('span', 'info-label', label));
    var v = el('span', 'info-value');
    if (typeof value === 'string') { v.textContent = value; } else { v.appendChild(value); }
    r.appendChild(v);
    sec.appendChild(r);
  }

  function linkRow(r) {
    var a = el('a', 'info-link');
    a.href = r.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.appendChild(I.make('external'));
    a.appendChild(el('span', '', r.name || r.url));
    a.appendChild(I.make('right'));
    return a;
  }

  function copyRow(sec, text) {
    var r = el('div', 'info-row copy-row');
    r.appendChild(el('span', 'info-value path', text));
    var b = el('button', 'icon-chip');
    b.type = 'button';
    b.setAttribute('aria-label', 'Copy folder path');
    b.appendChild(I.make('copy'));
    b.addEventListener('click', function () {
      function done() { b.textContent = ''; b.appendChild(I.make('check')); setTimeout(function () { b.textContent = ''; b.appendChild(I.make('copy')); }, 1500); }
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () {}); }
    });
    r.appendChild(b);
    sec.appendChild(r);
  }

  function problemBlock(q) {
    var b = el('div', 'problem');
    var line = el('p', 'problem-title');
    if (q.url) {
      var a = el('a', '', q.title);
      a.href = q.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      line.appendChild(a);
    } else { line.textContent = q.title; }
    b.appendChild(line);
    var meta = q.platform.split(' (')[0] + (q.difficulty && q.difficulty !== 'TBD' ? ', ' + q.difficulty : '');
    b.appendChild(el('p', 'entry-meta', meta + '. ' + Q_LABELS[ST.question(q.id).status]));
    if (q.purpose) { b.appendChild(el('p', 'entry-meta', 'Why: ' + q.purpose)); }
    return b;
  }

  function openInfo() {
    var e = D.entries[index];
    sheetInner.textContent = '';
    sheetInner.appendChild(el('div', 'sheet-handle'));
    var top = el('div', 'sheet-top');
    var chip = el('span', 'chip-tag');
    chip.appendChild(I.make(ST.isLearning(e) ? 'code' : 'calendar'));
    chip.appendChild(document.createTextNode(' ' + e.group));
    top.appendChild(chip);
    var close = el('button', 'close-btn');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.appendChild(I.make('close'));
    close.addEventListener('click', function () { sheet.close(); });
    top.appendChild(close);
    sheetInner.appendChild(top);

    var title = el('h2', 'sheet-title', D.titleOf(e));
    title.id = 'info-title';
    sheet.setAttribute('aria-labelledby', 'info-title');
    sheetInner.appendChild(title);
    var meta = el('p', 'sheet-meta');
    meta.appendChild(document.createTextNode('Day ' + e.seq + ' of ' + D.entries.length));
    if (e.time) {
      meta.appendChild(document.createTextNode('   '));
      meta.appendChild(I.make('clock'));
      meta.appendChild(document.createTextNode(' ' + e.time));
    }
    sheetInner.appendChild(meta);

    var ov = section('info', 'Overview');
    row(ov, 'Overall day', e.seq + ' of ' + D.entries.length);
    row(ov, 'Topic day', D.two(e.topicDay));
    row(ov, 'Topic group', e.group);
    row(ov, 'Phase', e.phase);
    row(ov, 'Time', e.time);
    sheetInner.appendChild(ov);

    if (e.topics) { var lr = section('book', 'Learning'); row(lr, 'Topics', e.topics); sheetInner.appendChild(lr); }
    if (e.task) { var tk = section('task', 'Task'); row(tk, 'Task', e.task); sheetInner.appendChild(tk); }

    if (e.resource && e.resource.text) {
      var rs = section('external', 'Resource');
      if (e.resource.url) { rs.appendChild(linkRow(e.resource)); } else { row(rs, 'Resource', e.resource.text); }
      sheetInner.appendChild(rs);
    }

    var assigned = D.questions.filter(function (q) { return q.recommendedDay === e.day && q.status === 'Assigned (suggested)'; });
    if (e.practice || assigned.length) {
      var pr = section('code', 'Practice');
      row(pr, 'Practice', e.practice);
      assigned.forEach(function (q) { pr.appendChild(problemBlock(q)); });
      sheetInner.appendChild(pr);
    }

    if (e.project || e.publish || e.projectNotes) {
      var pj = section('layers', 'Project');
      row(pj, 'Project', e.project);
      row(pj, 'Publish', e.publish);
      row(pj, 'Notes', e.projectNotes);
      sheetInner.appendChild(pj);
    }
    if (e.folder) { var fd = section('folder', 'Folder'); copyRow(fd, e.folder); sheetInner.appendChild(fd); }

    sheet.showModal();
  }

  sheet.addEventListener('click', function (ev) { if (ev.target === sheet) { sheet.close(); } });

  Promise.all([D.ready, ST.ready]).then(function () {
    index = todayIndex();
    render();
  }).catch(function (err) {
    box.textContent = '';
    box.appendChild(el('p', 'empty', 'Could not load the roadmap: ' + err.message));
  });
})();

// Progress dashboard plus project pages, topic pages, status lists and the catch-up queue.
// Routes (all inside the Progress tab): #progress, #progress/project/<key>,
// #progress/topic/<slug>, #progress/topics, #progress/list/<completed|skipped|pending>, #progress/catchup

(function () {
  'use strict';

  var D = window.RoadmapData;
  var ST = window.RoadmapStatus;
  var root = document.getElementById('progress-root');
  var NS = 'http://www.w3.org/2000/svg';
  var PROJECT_GROUP = { 'guessing-game': 'Guessing Game', 'banking': 'Banking', 'smart-library': 'Smart Library',
    'inventory': 'Inventory', 'task-api': 'Backend / API', 'semester-planner': 'Semester Planner' };
  var ICONS = {
    check: ['M20 6L9 17l-5-5'], arrow: ['M5 12h14M12 5l7 7-7 7'], clock: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v6l4 2'],
    loop: ['M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15'], chevron: ['M9 18l6-6-6-6'],
    back: ['M15 18l-6-6 6-6'], target: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z']
  };
  var STATE_TEXT = { pending: ['○', 'Pending'], done: ['✓', 'Done'], skipped: ['→', 'Skipped'], caughtup: ['↻', 'Caught up'] };

  var projects = [];       // from data/projects.json (only those with roadmap entries)
  var learn = [];          // learning entries, schedule order
  var groups = [];         // [{name, slug, symbol, entries}]

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  }
  function icon(name) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    ICONS[name].forEach(function (d) { var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); svg.appendChild(p); });
    return svg;
  }
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function shortName(n) { return n.replace(/\s*\(.*\)\s*$/, ''); }
  function go(hash) { window.location.hash = hash; }

  function bar(pct, colour) {
    var track = el('div', 'bar');
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    track.setAttribute('aria-valuenow', String(pct));
    var fill = el('div', 'bar-fill');
    fill.style.width = pct + '%';
    if (colour) { fill.style.background = colour; }
    track.appendChild(fill);
    return track;
  }

  function ring(pct) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('class', 'ring');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', pct + ' percent complete');
    var C = 2 * Math.PI * 50;
    [['ring-track', 0], ['ring-fill', C * (1 - pct / 100)]].forEach(function (c) {
      var k = document.createElementNS(NS, 'circle');
      k.setAttribute('cx', '60'); k.setAttribute('cy', '60'); k.setAttribute('r', '50');
      k.setAttribute('class', c[0]);
      if (c[0] === 'ring-fill') {
        k.setAttribute('stroke-dasharray', String(C));
        k.setAttribute('stroke-dashoffset', String(c[1]));
        k.setAttribute('transform', 'rotate(-90 60 60)');
      }
      svg.appendChild(k);
    });
    var t = document.createElementNS(NS, 'text');
    t.setAttribute('x', '60'); t.setAttribute('y', '68'); t.setAttribute('text-anchor', 'middle'); t.setAttribute('class', 'ring-text');
    t.textContent = pct + '%';
    svg.appendChild(t);
    return svg;
  }

  function openEntry(e) {
    if (window.TodayView) { window.TodayView.showDay(e.day); }
    go('#today');
  }

  function backLink(label) {
    var b = el('a', 'back-link');
    b.href = '#progress';
    b.appendChild(icon('back'));
    b.appendChild(document.createTextNode(' ' + (label || 'Back to Progress')));
    return b;
  }

  // ---------- one row for a roadmap entry ----------
  function entryRow(e, opts) {
    opts = opts || {};
    var s = ST.isLearning(e) ? ST.state(e.day) : 'pending';
    var b = el('button', 'entry-row state-' + s);
    b.type = 'button';
    var mark = el('span', 'entry-mark', STATE_TEXT[s][0]);
    mark.setAttribute('aria-hidden', 'true');
    var body = el('span', 'entry-body');
    body.appendChild(el('span', 'entry-title', opts.title || D.titleOf(e)));
    var meta = D.formatDate(e.date) + (e.workbookDate && e.workbookDate !== e.date ? ' (workbook: ' + D.shortDate(e.workbookDate) + ')' : '');
    body.appendChild(el('span', 'entry-meta', meta));
    if (opts.sub) { body.appendChild(el('span', 'entry-meta', opts.sub)); }
    var res = e.resource && e.resource.text ? (e.resource.name || e.resource.text) : null;
    if (opts.details && res) { body.appendChild(el('span', 'entry-meta', 'Resource: ' + res)); }
    if (opts.details && e.practice) { body.appendChild(el('span', 'entry-meta', 'Practice: ' + e.practice)); }
    if (opts.details && e.folder) { body.appendChild(el('span', 'entry-meta', 'Folder: ' + e.folder)); }
    var r = ST.record(e.day);
    var label = s === 'skipped' ? 'Skipped, catch-up waiting' : STATE_TEXT[s][1];
    if (s === 'caughtup') { label = 'Caught up (original day skipped)'; }
    body.appendChild(el('span', 'entry-status', label));
    b.appendChild(mark);
    b.appendChild(body);
    b.addEventListener('click', function () { openEntry(e); });
    return b;
  }

  // ---------- dashboard ----------
  function nextUp() {
    var today = D.todayIso();
    var pending = learn.filter(function (e) { return ST.state(e.day) === 'pending'; });
    var ahead = pending.filter(function (e) { return e.date >= today; });
    return ahead[0] || pending[0] || null;
  }

  function statCard(kind, label, value, sub, iconName, hash) {
    var b = el('button', 'stat-card');
    b.type = 'button';
    b.setAttribute('data-kind', kind);
    var ic = el('span', 'stat-icon');
    ic.appendChild(icon(iconName));
    var body = el('span', 'stat-body');
    body.appendChild(el('span', 'stat-label', label));
    body.appendChild(el('span', 'stat-value', String(value)));
    body.appendChild(el('span', 'stat-sub', sub));
    var ch = el('span', 'stat-chev'); ch.appendChild(icon('chevron'));
    b.appendChild(ic); b.appendChild(body); b.appendChild(ch);
    b.addEventListener('click', function () { go(hash); });
    return b;
  }

  function progressRow(symbol, name, t, colourVar, hash, tint) {
    var b = el('button', 'prog-row');
    b.type = 'button';
    var ic = el('span', 'prog-icon', symbol);
    ic.setAttribute('aria-hidden', 'true');
    if (tint) { ic.style.background = tint; }
    var mid = el('span', 'prog-mid');
    mid.appendChild(el('span', 'prog-name', name));
    mid.appendChild(bar(t.percent, colourVar));
    var nums = el('span', 'prog-nums');
    nums.appendChild(el('span', '', t.completed + ' / ' + t.total));
    nums.appendChild(el('b', '', t.percent + '%'));
    var ch = el('span', 'stat-chev'); ch.appendChild(icon('chevron'));
    b.appendChild(ic); b.appendChild(mid); b.appendChild(nums); b.appendChild(ch);
    b.addEventListener('click', function () { go(hash); });
    return b;
  }

  function sectionHead(title, linkText, hash) {
    var h = el('div', 'section-head');
    h.appendChild(el('h2', '', title));
    if (linkText) {
      var a = el('a', '', linkText); a.href = hash; h.appendChild(a);
    }
    return h;
  }

  function dashboard() {
    var s = ST.tally(learn);
    root.textContent = '';
    root.appendChild(el('p', 'subtitle', 'Track your learning journey'));

    var card = el('section', 'overall');
    card.appendChild(ring(s.percent));
    var side = el('div', 'overall-side');
    side.appendChild(el('h2', '', 'Roadmap progress'));
    side.appendChild(el('p', 'overall-count', s.completed + ' of ' + s.total + ' learning entries completed'));
    side.appendChild(bar(s.percent));
    var sub = s.caughtup ? s.done + ' on schedule, ' + s.caughtup + ' caught up later.' : '';
    if (sub) { side.appendChild(el('p', 'note-small', sub)); }
    card.appendChild(side);
    root.appendChild(card);
    var info = el('p', 'note-small info-note');
    info.textContent = 'Schedule: ' + D.entries.length + ' days. The workbook has 246 entries: ' + s.total + ' learning days and ' +
      (246 - s.total) + ' exam-buffer days. The 7 pre-exam pause days are extra. Pause days and exam-buffer days are not counted as learning tasks.';
    root.appendChild(info);
    if (!s.completed && !s.skipped) {
      root.appendChild(el('p', 'empty-note', 'Nothing recorded yet. Mark a day Done or Skipped on Home and it will show up here.'));
    }

    var grid = el('div', 'stat-grid');
    grid.appendChild(statCard('done', 'Completed', s.done, 'on schedule', 'check', '#progress/list/completed'));
    grid.appendChild(statCard('skipped', 'Skipped', s.skipped, 'learning entries', 'arrow', '#progress/list/skipped'));
    grid.appendChild(statCard('pending', 'Pending', s.pending, 'learning entries', 'clock', '#progress/list/pending'));
    grid.appendChild(statCard('catchup', 'Catch-up tasks', s.queued, s.caughtup ? s.caughtup + ' caught up' : 'waiting', 'loop', '#progress/catchup'));
    root.appendChild(grid);

    var keep = el('section', 'keep');
    var kh = el('div', 'keep-head'); kh.appendChild(icon('target')); kh.appendChild(el('h2', '', 'Keep moving')); keep.appendChild(kh);
    var n = nextUp();
    if (n) {
      var row = el('div', 'keep-row');
      var txt = el('div', 'keep-text');
      txt.appendChild(el('p', 'keep-label', 'Next up'));
      txt.appendChild(el('p', 'keep-title', n.symbol + ' ' + n.group + ': ' + D.titleOf(n)));
      txt.appendChild(el('p', 'entry-meta', D.formatDate(n.date)));
      var open = el('button', 'btn primary', 'Open');
      open.type = 'button';
      open.addEventListener('click', function () { openEntry(n); });
      row.appendChild(txt); row.appendChild(open);
      keep.appendChild(row);
    } else {
      keep.appendChild(el('p', 'note-small', 'Every learning entry has a status. Nice work.'));
    }
    root.appendChild(keep);

    root.appendChild(sectionHead('Projects', 'View all projects', '#projects'));
    var plist = el('div', 'prog-list');
    projects.forEach(function (p) {
      var t = ST.tally(p.entries);
      plist.appendChild(progressRow(p.symbol, shortName(p.name), t, 'var(--bar-' + p.key + ')', '#progress/project/' + p.key, 'var(--proj-' + p.key + ')'));
    });
    root.appendChild(plist);

    root.appendChild(sectionHead('Topics', 'View all topics', '#progress/topics'));
    var tlist = el('div', 'prog-list');
    groups.slice(0, 6).forEach(function (g) { tlist.appendChild(topicRow(g)); });
    root.appendChild(tlist);
  }

  function topicRow(g) {
    return progressRow(g.symbol, g.name, ST.tally(g.entries), null, '#progress/topic/' + g.slug);
  }

  // ---------- detail pages ----------
  function summaryBlock(t) {
    var box = el('section', 'detail-summary');
    box.appendChild(el('p', 'overall-count', t.completed + ' of ' + t.total + ' completed (' + t.percent + '%)'));
    box.appendChild(bar(t.percent));
    var parts = [t.done + ' done on schedule', t.skipped + ' skipped', t.queued + ' waiting for catch-up', t.caughtup + ' caught up', t.pending + ' pending'];
    box.appendChild(el('p', 'note-small', parts.join(', ')));
    return box;
  }

  function projectPage(key) {
    var p = projects.filter(function (x) { return x.key === key; })[0];
    root.textContent = '';
    root.appendChild(backLink());
    if (!p) { root.appendChild(el('p', 'empty', 'Project not found.')); return; }
    var head = el('section', 'detail-head');
    head.style.background = 'var(--proj-' + p.key + ')';
    head.appendChild(el('h2', '', p.symbol + ' ' + p.name));
    root.appendChild(head);
    root.appendChild(summaryBlock(ST.tally(p.entries)));
    root.appendChild(el('p', 'note-small info-note', 'Dates below are the current schedule. Dates written inside the workbook\'s project text belong to the original schedule, so they are not shown.'));

    root.appendChild(el('h3', 'list-title', 'Scheduled project entries'));
    var list = el('div', 'entry-list');
    p.entries.forEach(function (e) {
      list.appendChild(entryRow(e, { title: e.project || D.titleOf(e), sub: e.group + (e.project ? ': ' + D.titleOf(e) : ''), details: true }));
    });
    root.appendChild(list);

    if (p.versions && p.versions.length) {
      root.appendChild(el('h3', 'list-title', 'Versions from the workbook'));
      p.versions.forEach(function (v) {
        var box = el('section', 'version');
        box.appendChild(el('h4', '', v.version));
        [['Learn first', v.learnFirst], ['Build', v.feature], ['Check', v.completionCheck], ['Folder', v.folder]].forEach(function (f) {
          if (!f[1]) { return; }
          var line = el('p', 'info-line');
          line.appendChild(el('b', '', f[0] + ': '));
          line.appendChild(document.createTextNode(f[1]));
          box.appendChild(line);
        });
        root.appendChild(box);
      });
    }
  }

  function topicPage(slugName) {
    var g = groups.filter(function (x) { return x.slug === slugName; })[0];
    root.textContent = '';
    root.appendChild(backLink());
    if (!g) { root.appendChild(el('p', 'empty', 'Topic not found.')); return; }
    var head = el('section', 'detail-head plain');
    head.appendChild(el('h2', '', g.symbol + ' ' + g.name));
    root.appendChild(head);
    root.appendChild(summaryBlock(ST.tally(g.entries)));
    root.appendChild(el('h3', 'list-title', 'Scheduled entries'));
    var list = el('div', 'entry-list');
    g.entries.forEach(function (e) {
      list.appendChild(entryRow(e, { sub: 'Topic day ' + D.two(e.topicDay), details: true }));
    });
    root.appendChild(list);
  }

  function topicsPage() {
    root.textContent = '';
    root.appendChild(backLink());
    root.appendChild(el('h2', 'page-title', 'All topics'));
    var list = el('div', 'prog-list');
    groups.forEach(function (g) { list.appendChild(topicRow(g)); });
    root.appendChild(list);
  }

  function listPage(kind) {
    var cfg = { completed: ['Completed on schedule', function (e) { return ST.state(e.day) === 'done'; }],
                skipped: ['Skipped', function (e) { var s = ST.state(e.day); return s === 'skipped' || s === 'caughtup'; }],
                pending: ['Pending', function (e) { return ST.state(e.day) === 'pending'; }] }[kind];
    root.textContent = '';
    root.appendChild(backLink());
    if (!cfg) { root.appendChild(el('p', 'empty', 'List not found.')); return; }
    var items = learn.filter(cfg[1]);
    root.appendChild(el('h2', 'page-title', cfg[0] + ' (' + items.length + ')'));
    if (!items.length) { root.appendChild(el('p', 'empty-note', 'Nothing here yet.')); return; }
    var list = el('div', 'entry-list');
    items.forEach(function (e) { list.appendChild(entryRow(e, { sub: e.group })); });
    root.appendChild(list);
  }

  function catchupPage() {
    root.textContent = '';
    root.appendChild(backLink());
    var waiting = learn.filter(function (e) { return ST.state(e.day) === 'skipped'; });
    var done = learn.filter(function (e) { return ST.state(e.day) === 'caughtup'; });
    root.appendChild(el('h2', 'page-title', 'Catch-up queue'));
    root.appendChild(el('p', 'note-small info-note', 'Skipped days keep their original dates. Catching up later is recorded separately and never changes the schedule.'));
    root.appendChild(el('h3', 'list-title', 'Waiting (' + waiting.length + ')'));
    if (!waiting.length) { root.appendChild(el('p', 'empty-note', 'No skipped days waiting.')); }
    waiting.forEach(function (e) {
      var wrap = el('div', 'catch-item');
      wrap.appendChild(entryRow(e, { sub: e.group }));
      var btn = el('button', 'btn primary', 'Mark caught up');
      btn.type = 'button';
      btn.addEventListener('click', function () { ST.markCaughtUp(e.day).then(render); });
      wrap.appendChild(btn);
      root.appendChild(wrap);
    });
    root.appendChild(el('h3', 'list-title', 'Caught up (' + done.length + ')'));
    if (!done.length) { root.appendChild(el('p', 'empty-note', 'Nothing caught up yet.')); }
    var list = el('div', 'entry-list');
    done.forEach(function (e) {
      list.appendChild(entryRow(e, { sub: e.group + (ST.record(e.day).catchupAt ? ', caught up on ' + ST.record(e.day).catchupAt.slice(0, 10) : '') }));
    });
    root.appendChild(list);
  }

  // ---------- routing ----------
  function render() {
    var parts = window.location.hash.replace('#', '').split('/');
    if (parts[0] !== 'progress') { return; }
    if (parts[1] === 'project') { projectPage(parts[2]); }
    else if (parts[1] === 'topic') { topicPage(parts[2]); }
    else if (parts[1] === 'topics') { topicsPage(); }
    else if (parts[1] === 'list') { listPage(parts[2]); }
    else if (parts[1] === 'catchup') { catchupPage(); }
    else { dashboard(); }
    if (ST.error) { root.insertBefore(el('p', 'warn', 'Your saved progress could not be loaded. ' + ST.error), root.firstChild); }
  }

  function buildIndexes(projectData) {
    learn = D.entries.filter(ST.isLearning);
    var seen = {};
    groups = [];
    learn.forEach(function (e) {
      if (!seen[e.group]) { seen[e.group] = { name: e.group, slug: slug(e.group), symbol: e.symbol, entries: [] }; groups.push(seen[e.group]); }
      seen[e.group].entries.push(e);
    });
    projects = [];
    projectData.forEach(function (p) {
      var entries = learn.filter(function (e) { return e.projectKey && e.projectKey === p.key; });
      if (!p.key || p.key === 'frontend-extension' || !entries.length) { return; }
      var g = seen[PROJECT_GROUP[p.key]];
      projects.push({ key: p.key, name: p.name, symbol: g ? g.symbol : '📁', entries: entries, versions: p.versions });
    });
  }

  Promise.all([D.ready, ST.ready, fetch('data/projects.json').then(function (r) { return r.json(); })])
    .then(function (res) {
      buildIndexes(res[2].projects);
      render();
      window.addEventListener('hashchange', function () {
        var h = window.location.hash;
        if (h.indexOf('#progress') === 0) { ST.load().then(render); }
      });
    })
    .catch(function (err) {
      root.textContent = '';
      root.appendChild(el('p', 'empty', 'Could not load Progress: ' + err.message));
    });
})();

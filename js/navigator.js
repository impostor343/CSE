// Calendar tab. "Curriculum" = day-based navigator in blocks of 30 (not a date calendar). "History" lives in history.js.
// Routes: #calendar (block containing the next session) | #calendar/<block index> | #calendar/day/<n> | #calendar/history[/<yyyy-mm-dd>]
(function () {
  'use strict';
  var C = window.Curriculum, A = window.State, V = window.SessionView, h = U.h, root = document.getElementById('calendar');
  var tabs = function (active) { return h('div', { class: 'seg' }, h('a', { class: active === 'cur' ? 'on' : '', href: '#calendar', text: 'Curriculum' }), h('a', { class: active === 'hist' ? 'on' : '', href: '#calendar/history', text: 'Completion history' })); };

  // Curriculum calendar, laid out like a Google Calendar month: a 7-column grid for one block of 30 sessions, a month-style
  // title with a picker, Today, previous/next arrows and an agenda for the selected day. Cells are curriculum days (permanent IDs), not dates.
  var selDay = null, lastBlock = null;

  function dayCell(d, selected, nextDay) {
    var s = C.session(d), st = A.status(d), proj = !!s.projectId;
    var mark = st === 'completed' ? '✓ ' : st === 'skipped' ? '↪ ' : st === 'in-progress' ? '◷ ' : '';
    var a = h('button', { type: 'button', class: 'gcell st-' + st + (selected ? ' sel' : '') + (d === nextDay ? ' next' : '') + (proj ? ' ms' : ''), 'aria-label': 'Day ' + d + ': ' + s.title + ', ' + U.STATUS[st] + (d === nextDay ? ', next session' : '') + (proj ? ', project milestone' : ''), 'aria-pressed': selected ? 'true' : 'false',
      onclick: function () { selDay = d; draw(); } });
    a.appendChild(h('span', { class: 'gnum', text: String(d) }));
    a.appendChild(h('span', { class: 'gchipx', text: mark + (s.topic || s.title) }));
    return a;
  }

  function agenda(d, nextDay) {
    var s = C.session(d), c = A.completion(d), proj = s.projectId ? C.project(s.projectId) : null, box = h('section', { class: 'card agenda' });
    box.appendChild(h('div', { class: 'agenda-top' }, h('span', { class: 'agenda-day', text: 'Day ' + U.num(d) }), V.chip(d), d === nextDay ? h('span', { class: 'tag', text: 'Next session' }) : null));
    box.appendChild(h('h3', { class: 'agenda-title' }, h('a', { href: '#calendar/day/' + d, text: s.title })));
    box.appendChild(h('p', { class: 'muted small', text: s.module + ' · session ' + s.moduleDay + ' of ' + s.moduleTotal + (s.time ? ' · ' + s.time : '') }));
    if (s.outcome) { box.appendChild(h('p', { class: 'small clamp', text: s.outcome })); }
    if (proj) { box.appendChild(h('span', { class: 'tag', text: 'Project: ' + proj.name })); }
    if (c) { box.appendChild(h('p', { class: 'done-line small', text: 'Completed ' + U.stamp(c.completedAt) })); }
    box.appendChild(V.actions(d));
    box.appendChild(h('a', { class: 'btn ghost', href: '#calendar/day/' + d, text: 'Open full session' }));
    return box;
  }


  // Week strip: 7 consecutive curriculum days around the selected one (days are IDs, not dates), plus an "Up next" list.
  var gridOpen = false;
  function weekStart(d) { return Math.max(1, Math.min(C.total - 6, d - 3)); }
  function pickDay(d) { selDay = d; var b = C.groupOf(d); if (b === lastBlock) { draw(); } else { U.go('#calendar/' + b + '/' + d); } }
  function weekStrip(nextDay) {
    var from = weekStart(selDay), wrap = h('section', { class: 'wk', 'aria-label': 'Week of sessions' }), row = h('div', { class: 'wk-row' });
    var now = new Date(), mon = U.MONTHS[now.getMonth()];
    wrap.appendChild(h('div', { class: 'wk-top' }, h('strong', { text: 'Learning plan' }), h('span', { class: 'wk-date', text: now.getDate() + ' ' + mon + ' ' + now.getFullYear() })));
    wrap.appendChild(h('div', { class: 'wk-nav' },
      h('button', { type: 'button', class: 'wk-arrow', 'aria-label': 'Previous week', disabled: from <= 1 ? 'disabled' : null, onclick: function () { pickDay(Math.max(1, selDay - 7)); }, text: '‹' }),
      h('span', { class: 'wk-range', text: 'Days ' + from + '–' + (from + 6) }),
      h('button', { type: 'button', class: 'wk-arrow', 'aria-label': 'Next week', disabled: from + 6 >= C.total ? 'disabled' : null, onclick: function () { pickDay(Math.min(C.total, selDay + 7)); }, text: '›' })));
    for (var d = from; d < from + 7; d++) {
      var s = C.session(d), st = A.status(d), on = d === selDay;
      row.appendChild(h('button', { type: 'button', class: 'wk-day st-' + st + (on ? ' on' : '') + (d === nextDay ? ' next' : '') + (s.projectId ? ' ms' : ''), 'aria-pressed': on ? 'true' : 'false',
        'aria-label': 'Day ' + d + ': ' + s.title + ', ' + U.STATUS[st] + (d === nextDay ? ', next session' : ''), onclick: (function (x) { return function () { pickDay(x); }; })(d) },
        h('span', { class: 'wk-lab', text: 'Day' }), h('strong', { class: 'wk-num', text: String(d) }), h('i', { class: 'wk-dot', 'aria-hidden': 'true' })));
    }
    wrap.appendChild(row); return wrap;
  }
  function upNext(nextDay) {
    var box = h('section', { class: 'upn' }), list = [], d;
    for (d = selDay; d <= C.total && list.length < 5; d++) { list.push(d); }
    box.appendChild(h('h3', { class: 'upn-h', text: selDay === nextDay ? 'Up next' : 'From day ' + selDay }));
    list.forEach(function (day, n) {
      var s = C.session(day), st = A.status(day), tone = ['a', 'b', 'c'][n % 3];
      box.appendChild(h('a', { class: 'upn-row pc-' + tone + ' st-' + st, href: '#calendar/day/' + day },
        h('span', { class: 'upn-num', text: String(day) }),
        h('span', { class: 'upn-main' }, h('strong', { text: U.shortSession(s.title) }), h('span', { text: U.shortModule(C.module(s.moduleId)) + (s.time ? ' · ' + s.time : '') })),
        h('span', { class: 'upn-st', text: st === 'completed' ? '✓' : st === 'skipped' ? '↪' : st === 'in-progress' ? '◷' : '›' })));
    });
    return box;
  }

  var host = null;
  function draw() { if (host) { var fresh = block(lastBlock); host.replaceWith(fresh); host = fresh; } }

  function block(i) {
    var gs = C.groups(); if (i < 0 || i >= gs.length || isNaN(i)) { i = 0; }
    var g = gs[i], w = h('div', { class: 'gcal' }), nextDay = A.nextIncomplete(); lastBlock = i;
    if (selDay === null || selDay < g.from || selDay > g.to) { selDay = (nextDay && nextDay >= g.from && nextDay <= g.to) ? nextDay : g.from; }
    var done = 0; for (var d0 = g.from; d0 <= g.to; d0++) { if (A.isDone(d0)) { done++; } }
    var pick = h('select', { class: 'gpick', 'aria-label': 'Jump to another block of sessions', onchange: function () { selDay = null; U.go('#calendar/' + this.value); } });
    gs.forEach(function (x) { var dn = 0; for (var d = x.from; d <= x.to; d++) { if (A.isDone(d)) { dn++; } } var o = h('option', { value: x.index, text: 'Days ' + x.from + '–' + x.to + ' · ' + dn + '/' + (x.to - x.from + 1) }); if (x.index === i) { o.selected = true; } pick.appendChild(o); });
    var title = h('label', { class: 'gtitle' }, h('span', { class: 'gtext', text: 'Days ' + g.from + '–' + g.to }), h('span', { class: 'gcaret', 'aria-hidden': 'true', text: '▾' }), pick);
    var go = function (n) { selDay = null; U.go('#calendar/' + n); };
    var todayBtn = h('button', { type: 'button', class: 'gbtn', text: 'Today', onclick: function () { var nb = C.groupOf(nextDay || 1); selDay = nextDay || 1; if (nb === i) { draw(); } else { U.go('#calendar/' + nb); } } });
    var prev = h('button', { type: 'button', class: 'gbtn icon', 'aria-label': 'Previous block', disabled: i === 0 ? 'disabled' : null, onclick: function () { go(i - 1); }, text: '‹' });
    var next = h('button', { type: 'button', class: 'gbtn icon', 'aria-label': 'Next block', disabled: i === gs.length - 1 ? 'disabled' : null, onclick: function () { go(i + 1); }, text: '›' });
    var jump = h('input', { class: 'gjump', type: 'number', inputmode: 'numeric', min: 1, max: C.total, placeholder: 'Go to day', 'aria-label': 'Go to a curriculum day',
      onchange: function () { var n = parseInt(this.value, 10); if (n >= 1 && n <= C.total) { selDay = n; var b = C.groupOf(n); if (b === i) { draw(); } else { U.go('#calendar/' + b); } } } });
    w.appendChild(h('div', { class: 'ghead' }, title, h('div', { class: 'gtools' }, jump, todayBtn, prev, next)));
    w.appendChild(weekStrip(nextDay));
    w.appendChild(agenda(selDay, nextDay));
    w.appendChild(upNext(nextDay));
    var det = h('details', { class: 'gfull' }); if (gridOpen) { det.open = true; }
    det.addEventListener('toggle', function () { gridOpen = det.open; });
    det.appendChild(h('summary', { text: 'Full 30-day grid' }));
    det.appendChild(h('p', { class: 'muted small gsub', text: done + ' of ' + (g.to - g.from + 1) + ' completed in this block · numbers are curriculum days, not dates' }));
    var grid = h('div', { class: 'ggrid', role: 'group', 'aria-label': 'Sessions in days ' + g.from + ' to ' + g.to });
    for (var d = g.from; d <= g.to; d++) { grid.appendChild(dayCell(d, d === selDay, nextDay)); }
    var rem = (g.to - g.from + 1) % 7; if (rem) { for (var k = rem; k < 7; k++) { grid.appendChild(h('span', { class: 'gcell pad', 'aria-hidden': 'true' })); } }
    det.appendChild(grid);
    det.appendChild(h('p', { class: 'glegend muted small' }, h('span', { class: 'lg next', text: '●' }), ' next  ', h('span', { class: 'lg done', text: '✓' }), ' done  ', h('span', { class: 'lg skip', text: '↪' }), ' skipped  ', h('span', { class: 'lg prog', text: '◷' }), ' in progress  ', h('span', { class: 'lg ms', text: '▌' }), ' project milestone'));
    w.appendChild(det);
    return w;
  }

  function render() {
    var r = U.route('calendar'); if (r === null) { return; }
    root.textContent = '';
    if (r[0] === 'day') { var d = parseInt(r[1], 10); if (!(d >= 1 && d <= C.total)) { U.go('#calendar'); return; }
      selDay = d; root.appendChild(h('a', { class: 'btn ghost back', href: '#calendar/' + C.groupOf(d), text: '← Days ' + C.groups()[C.groupOf(d)].from + '–' + C.groups()[C.groupOf(d)].to })); root.appendChild(V.detail(d)); return; }
    if (r[0] === 'history') { root.appendChild(tabs('hist')); root.appendChild(window.History.render(r[1])); return; }
    root.appendChild(tabs('cur'));
    var i = r[0] !== undefined ? parseInt(r[0], 10) : null;
    if (i === null || isNaN(i)) { var nx = A.nextIncomplete(); i = C.groupOf(nx || 1); }
    if (r[1] !== undefined && parseInt(r[1], 10) >= 1) { selDay = parseInt(r[1], 10); }
    host = block(i); root.appendChild(host);
  }
  Promise.all([C.ready, A.ready]).then(function () { render(); window.addEventListener('hashchange', render); window.addEventListener('cur-changed', function () { if (U.route('calendar') !== null) { render(); } }); })
    .catch(function (e) { root.textContent = 'Could not load: ' + e.message; });
})();

// Completion history calendar. A real-date calendar generated ONLY from active completion records (same records that drive progress).
// It never shows planned or future sessions.
(function () {
  'use strict';
  var C = window.Curriculum, A = window.State, h = U.h;
  var H = {};
  H.render = function (sel) {
    var by = A.completionsByDate(), today = U.todayKey(), w = h('div');
    var key = sel || today, ym = key.slice(0, 7);
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7);
    function shift(n) { var d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + U.pad(d.getMonth() + 1); }
    function target(k) { return '#calendar/history/' + k; }
    var curYm = today.slice(0, 7);
    w.appendChild(h('div', { class: 'btnrow' }, h('a', { class: 'btn ghost', href: target(shift(-12) + '-01'), 'aria-label': 'Previous year', text: '«' }), h('a', { class: 'btn ghost', href: target(shift(-1) + '-01'), 'aria-label': 'Previous month', text: '‹' }),
      h('strong', { class: 'mtitle', text: U.MONTHS[m - 1] + ' ' + y }),
      h('a', { class: 'btn ghost', href: shift(1) <= curYm ? target(shift(1) + '-01') : null, 'aria-disabled': shift(1) > curYm ? 'true' : null, 'aria-label': 'Next month', text: '›' }),
      h('a', { class: 'btn ghost', href: shift(12) <= curYm ? target(shift(12) + '-01') : null, 'aria-disabled': shift(12) > curYm ? 'true' : null, 'aria-label': 'Next year', text: '»' })));
    var quick = h('div', { class: 'btnrow' }, h('a', { class: 'btn ghost', href: target(today), text: 'Today' }), h('a', { class: 'btn ghost', href: target(U.keyShift(today, -1)), text: 'Yesterday' }),
      h('input', { class: 'sel', type: 'date', max: today, value: sel || '', 'aria-label': 'Jump to a date', onchange: function () { if (this.value && this.value <= today) { U.go(target(this.value)); } } }));
    w.appendChild(quick);
    var grid = h('div', { class: 'mgrid' }); ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(function (x) { grid.appendChild(h('span', { class: 'wd', text: x })); });
    var first = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate();
    for (var i = 0; i < first; i++) { grid.appendChild(h('span')); }
    for (var d = 1; d <= days; d++) {
      var k = ym + '-' + U.pad(d), n = (by[k] || []).length, future = k > today;
      grid.appendChild(h(future ? 'span' : 'a', { class: 'mday' + (k === key ? ' sel' : '') + (k === today ? ' today' : '') + (n ? ' has' : '') + (future ? ' future' : ''), href: future ? null : target(k), 'aria-label': U.longDate(k) + (n ? ', ' + n + ' completed' : '') },
        String(d), n ? h('i', { text: String(n) }) : null));
    }
    w.appendChild(grid);
    var recs = by[key] || [];
    var list = h('section', { class: 'card' }, h('h3', { text: U.longDate(key) }));
    if (!recs.length) { list.appendChild(h('p', { class: 'muted', text: key > today ? 'This date is in the future.' : 'No sessions were completed on this date.' })); }
    recs.forEach(function (c) { var s = C.session(c.day);
      list.appendChild(h('a', { class: 'item', href: '#calendar/day/' + c.day }, h('strong', { text: U.dayLabel(c.day, C.total) + ': ' + s.title }), h('span', { class: 'muted small', text: 'Completed · ' + U.time(c.completedAt) }))); });
    w.appendChild(list);
    var total = Object.keys(by).length; if (!total) { w.appendChild(h('p', { class: 'muted small', text: 'History is empty until you tap Mark Done on a session.' })); }
    return w;
  };
  window.History = H;
})();

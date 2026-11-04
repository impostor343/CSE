// Small shared helpers: element builder, number/date formatting, hash navigation.
(function () {
  'use strict';
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var U = {
    MONTHS: MONTHS,
    h: function (tag, attrs) {
      var n = document.createElement(tag);
      if (attrs) { Object.keys(attrs).forEach(function (k) {
        var v = attrs[k]; if (v === null || v === undefined || v === false) { return; }
        if (k === 'class') { n.className = v; } else if (k === 'text') { n.textContent = v; }
        else if (k.slice(0, 2) === 'on') { n.addEventListener(k.slice(2), v); } else { n.setAttribute(k, v); } }); }
      function put(c) {
        if (c === null || c === undefined || c === false) { return; }
        if (Array.isArray(c)) { c.forEach(put); } else { n.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); }
      }
      for (var i = 2; i < arguments.length; i++) { put(arguments[i]); }
      return n;
    },
    num: function (n) { return Number(n).toLocaleString('en-US'); },
    pad: function (n) { return n < 10 ? '0' + n : String(n); },
    dayLabel: function (d, total) { return 'Day ' + U.num(d) + ' / ' + U.num(total); },
    pct: function (a, b) { return b ? Math.round(a / b * 100) : 0; },
    key: function (iso) { var d = new Date(iso); return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()); },   // local date key
    todayKey: function () { return U.key(new Date().toISOString()); },
    keyShift: function (k, n) { var p = k.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()); },
    longDate: function (k) { var p = k.split('-'); return +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0]; },
    time: function (iso) { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); },
    stamp: function (iso) { return U.longDate(U.key(iso)) + ', ' + U.time(iso); },
    go: function (hash) { if (location.hash === hash) { window.dispatchEvent(new Event('hashchange')); } else { location.hash = hash; } },
    // An empty hash (first launch, or the Android app opening at https://localhost/) means Home, so Home must match it.
    route: function (screen) { var p = location.hash.replace('#', '').split('/'); if (!p[0]) { p = ['today']; } return p[0] === screen ? p.slice(1) : null; },
    bar: function (pct) { return U.h('div', { class: 'cbar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, U.h('span', { style: 'width:' + pct + '%' })); },
    STATUS: { 'not-started': 'Not Started', 'in-progress': 'In Progress', 'completed': 'Completed', 'skipped': 'Skipped', 'needs-revision': 'Needs Revision',
      'planning': 'Planning', 'development': 'In Development', 'testing': 'Testing', 'needs-improvement': 'Needs Improvement', 'published': 'Published', 'solved': 'Solved' }
  };
  window.U = U;
})();

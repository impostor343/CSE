// Questions tab: the practice bank grouped Module > Topic. Your own status and notes per question; no record = Not Started.
// Module/topic come from the question's own moduleId/topicId (curriculum IDs). Questions with no module in the bank go in "Not linked to a module";
// questions whose topicId is only a module-level label go in "Module practice (not tied to one topic)". Nothing is guessed.
(function () {
  'use strict';
  var C = window.Curriculum, A = window.State, V = window.SessionView, h = U.h, root = document.getElementById('questions-root');
  var QS = ['not-started', 'in-progress', 'solved'], browse = false, filter = 'all', q = '', modFilter = 'all', open = {}, openMod = {}, openTop = {}, topLimit = {}, groups = null;
  var PAGE = 20;

  function build() {   // static grouping, built once
    var mods = {}, order = [];
    function grp(key, title, sub) { if (!mods[key]) { mods[key] = { key: key, title: title, sub: sub, tops: {}, topOrder: [], n: 0 }; order.push(key); } return mods[key]; }
    C.modules.forEach(function (m) { grp(m.id, m.id + ' · ' + m.name, m.phase); });
    C.practice.forEach(function (p) {
      var m = p.moduleId && C.module(p.moduleId), g = m ? mods[m.id] : grp('_none', 'Not linked to a module', 'No module is given for these in the bank'), t = p.topicId && C.topic(p.topicId), key, title, sort;
      if (t) { key = t.id; title = t.name; sort = [0, t.firstDay || 0]; }
      else if (m) { key = '_general'; title = 'Module practice (not tied to one topic)'; sort = [1, 0]; }
      else { key = 'L:' + (p.topic || 'Other'); title = p.topic || 'Other'; sort = [2, 0, title]; }
      if (!g.tops[key]) { g.tops[key] = { key: g.key + '/' + key, title: title, sort: sort, qs: [] }; g.topOrder.push(key); }
      g.tops[key].qs.push(p); g.n++;
    });
    order.forEach(function (k) { var g = mods[k]; g.topOrder.sort(function (a, b) { var x = g.tops[a].sort, y = g.tops[b].sort; return x[0] - y[0] || x[1] - y[1] || String(x[2] || '').localeCompare(String(y[2] || '')); }); });
    return order.map(function (k) { return mods[k]; }).filter(function (g) { return g.n > 0; });
  }
  function matches(p) {
    var st = A.practiceRec(p.id).status;
    if (filter !== 'all' && st !== filter) { return false; }
    return !q || (p.title + ' ' + (p.topic || '') + ' ' + (p.platform || '') + ' ' + p.id + ' ' + (p.tags || []).join(' ')).toLowerCase().indexOf(q.toLowerCase()) !== -1;
  }
  function count(list) { var s = 0; list.forEach(function (p) { if (A.practiceRec(p.id).status === 'solved') { s++; } }); return s; }


  // ---- Practice today: 3-5 questions tied to the session you are on; the full bank stays behind search / Browse ----
  function todayDay() { return A.inProgressDays()[0] || A.nextIncomplete() || C.total; }
  function todayList(day) {
    var s = C.session(day), out = [], seen = {};
    function add(p) { if (p && !seen[p.id] && out.length < 5) { seen[p.id] = 1; out.push(p); } }
    (s.questionIds || []).forEach(function (id) { add(C.question(id)); });
    var pool = C.questionsOfTopic(s.topicId).concat(C.practice.filter(function (p) { return p.moduleId === s.moduleId; }));
    pool.filter(function (p) { return A.practiceRec(p.id).status !== 'solved'; }).forEach(add);
    return out.length >= 3 ? out : out.concat(pool.filter(function (p) { return !seen[p.id]; }).slice(0, 3 - out.length));
  }
  function renderToday() {
    var box = document.getElementById('qtoday'); if (!box) { return; } box.textContent = '';
    var day = todayDay(), s = C.session(day), list = todayList(day), solved = list.filter(function (p) { return A.practiceRec(p.id).status === 'solved'; }).length;
    box.appendChild(h('div', { class: 'qt-head' }, h('div', {}, h('span', { class: 'qt-tag', text: 'Practice today' }), h('strong', { class: 'qt-title', text: U.shortSession(s.title) }), h('span', { class: 'muted small', text: 'Day ' + day + ' · ' + U.shortModule(C.module(s.moduleId)) })),
      h('span', { class: 'qt-count', text: solved + '/' + list.length })));
    list.forEach(function (p) { box.appendChild(card(p)); });
  }

  function render() {
    root.textContent = ''; if (!groups) { groups = build(); }
    var ps = A.practiceStats();
    root.appendChild(h('section', { class: 'card' }, h('h3', { text: 'Practice questions' }), h('p', { class: 'bigday', text: ps.solved + ' / ' + U.num(ps.total) + ' solved' }), U.bar(ps.percent), ps.inProgress ? h('p', { class: 'muted', text: ps.inProgress + ' in progress' }) : null,
      h('p', { class: 'muted small', text: 'Start with today\u2019s questions below. The full bank is behind search.' })));
    root.appendChild(h('section', { id: 'qtoday', class: 'qtoday' }));
    root.appendChild(h('input', { class: 'sel', type: 'search', placeholder: 'Search the full question bank…', value: q, 'aria-label': 'Search questions', oninput: function () { q = this.value; topLimit = {}; renderList(); } }));
    if (!browse && !q) { /* filters appear once you search or browse */ }
    var ms = h('select', { class: 'sel', 'aria-label': 'Module', onchange: function () { modFilter = this.value; topLimit = {}; renderList(); } });
    ms.appendChild(h('option', { value: 'all', text: 'All modules' })); groups.forEach(function (g) { var o = h('option', { value: g.key, text: g.title }); if (g.key === modFilter) { o.selected = true; } ms.appendChild(o); });
    var tools = h('div', { id: 'qtools' }); tools.appendChild(ms);
    var seg = h('div', { class: 'chips' }); [['all', 'All']].concat(QS.map(function (s) { return [s, U.STATUS[s]]; })).forEach(function (f) { seg.appendChild(h('button', { type: 'button', class: 'gchip' + (filter === f[0] ? ' on' : ''), onclick: function () { filter = f[0]; topLimit = {}; render(); }, text: f[1] })); });
    tools.appendChild(seg); root.appendChild(tools); root.appendChild(h('div', { id: 'qlist' })); renderList();
  }

  function card(p) {
    var rec = A.practiceRec(p.id), el = h('section', { class: 'card q st-' + rec.status });
    el.appendChild(h('div', { class: 'vhead' }, h('div', {}, h('strong', { text: p.id + ' · ' + p.title }), h('div', { class: 'muted small', text: [p.platform, p.difficulty, p.type, p.estimatedMinutes ? p.estimatedMinutes + ' min' : ''].filter(Boolean).join(' · ') + ' · ' + U.STATUS[rec.status] })),
      h('button', { type: 'button', class: 'link', 'aria-expanded': open[p.id] ? 'true' : 'false', onclick: function () { open[p.id] = !open[p.id]; renderList(); }, text: open[p.id] ? 'Hide' : 'Open' })));
    if (!open[p.id]) { return el; }
    [['Question', p.prompt], ['Acceptance criteria', p.acceptanceCriteria], ['Hint', p.hint], ['Prerequisites', p.prerequisites], ['How to practise', p.how]].forEach(function (r) { if (r[1]) { el.appendChild(h('div', { class: 'row' }, h('span', { class: 'lab', text: r[0] }), h('span', { class: 'val', text: r[1] }))); } });
    if (p.sessionDays && p.sessionDays.length) { el.appendChild(h('div', { class: 'chips' }, p.sessionDays.slice(0, 12).map(function (d) { return h('a', { class: 'gchip', href: '#calendar/day/' + d, text: 'Day ' + d }); }))); }
    if (p.url) { el.appendChild(h('a', { href: p.url, target: '_blank', rel: 'noopener', text: p.url })); }
    var sel = h('select', { class: 'sel', 'aria-label': 'Status', onchange: function () { A.savePractice(p.id, { status: this.value }).then(function () { render(); V.refresh(); }); } });
    QS.forEach(function (s) { var o = h('option', { value: s, text: U.STATUS[s] }); if (s === rec.status) { o.selected = true; } sel.appendChild(o); }); el.appendChild(sel);
    if (rec.solvedAt) { el.appendChild(h('p', { class: 'muted small', text: 'Solved: ' + U.stamp(rec.solvedAt) })); }
    var n = h('textarea', { class: 'notes', rows: 3, placeholder: 'Mistakes and insights…' }); n.value = rec.notes || ''; n.addEventListener('blur', function () { A.savePractice(p.id, { notes: n.value }); }); el.appendChild(n);
    return el;
  }

  function header(label, sub, list, expanded, onclick, cls) {
    var done = count(list);
    return h('button', { type: 'button', class: 'qhead ' + cls, 'aria-expanded': expanded ? 'true' : 'false', onclick: onclick },
      h('span', { class: 'qcaret', 'aria-hidden': 'true', text: expanded ? '▾' : '▸' }), h('span', { class: 'qtitle' }, h('strong', { text: label }), sub ? h('span', { class: 'muted small', text: sub }) : null),
      h('span', { class: 'qcount', text: done + ' / ' + list.length }));
  }

  function renderList() {
    var box = document.getElementById('qlist'); if (!box) { return; } box.textContent = '';
    renderToday();
    var tl = document.getElementById('qtools'); if (tl) { tl.hidden = !(browse || q || filter !== 'all'); }
    if (!browse && !q && filter === 'all' && modFilter === 'all') {
      box.appendChild(h('button', { type: 'button', class: 'btn ghost qbrowse', text: 'Browse the full bank (' + U.num(C.practice.length) + ' questions)', onclick: function () { browse = true; renderList(); } }));
      return;
    }
    var filtering = !!q || filter !== 'all', total = 0;
    var qi = 0;
    groups.forEach(function (g) {
      if (modFilter !== 'all' && g.key !== modFilter) { return; }
      var tops = g.topOrder.map(function (k) { var t = g.tops[k]; return { t: t, list: t.qs.filter(matches) }; }).filter(function (x) { return x.list.length; });
      if (!tops.length) { return; }
      var all = []; tops.forEach(function (x) { all = all.concat(x.list); }); total += all.length;
      var mOpen = filtering || modFilter !== 'all' || !!openMod[g.key], sec = h('section', { class: 'card qmod pc-' + ['a', 'b', 'c'][qi++ % 3] });
      sec.appendChild(header(g.title, g.sub, all, mOpen, function () { openMod[g.key] = !openMod[g.key]; renderList(); }, 'qh-mod'));
      if (mOpen) {
        tops.forEach(function (x) {
          var tOpen = filtering || !!openTop[x.t.key], wrap = h('div', { class: 'qtop' });
          wrap.appendChild(header(x.t.title, null, x.list, tOpen, function () { openTop[x.t.key] = !openTop[x.t.key]; renderList(); }, 'qh-top'));
          if (tOpen) {
            var lim = topLimit[x.t.key] || PAGE;
            x.list.slice(0, lim).forEach(function (p) { wrap.appendChild(card(p)); });
            if (x.list.length > lim) { wrap.appendChild(h('button', { type: 'button', class: 'btn ghost', text: 'Show more (' + (x.list.length - lim) + ' left)', onclick: function () { topLimit[x.t.key] = lim + PAGE; renderList(); } })); }
          }
          sec.appendChild(wrap);
        });
      }
      box.appendChild(sec);
    });
    if (!total) { box.appendChild(h('p', { class: 'muted', text: 'No questions match.' })); }
    else { box.insertBefore(h('p', { class: 'muted small', text: U.num(total) + ' questions' }), box.firstChild); }
  }
  function fromRoute() { var r = U.route('questions'); if (!r || !r[0]) { return; } var p = C.question(decodeURIComponent(r[0])); if (!p) { return; } q = p.id; open[p.id] = true; browse = true; render(); }
  window.addEventListener('hashchange', fromRoute);
  Promise.all([C.ready, A.ready]).then(function () { render(); fromRoute(); }).catch(function (e) { root.textContent = 'Could not load: ' + e.message; });
  window.addEventListener('cur-changed', function () { if (U.route('questions') !== null && !document.activeElement.matches('textarea,input')) { render(); } });
})();

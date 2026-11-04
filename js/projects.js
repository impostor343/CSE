// Projects tab: all 25 workbook projects. Routes: #projects | #projects/<PR01..>
// Progress % = completed versions / versions (the workbook's own milestones). Target days are planning references, never proof of completion.
(function () {
  'use strict';
  var C = window.Curriculum, A = window.State, V = window.SessionView, I = window.Icons, h = U.h, root = document.getElementById('projects-root');
  var PROJECT_ICONS = {
    PR01: 'game', PR02: 'calculator', PR03: 'quiz', PR04: 'contacts', PR05: 'wallet',
    PR06: 'bank', PR07: 'book', PR08: 'box', PR09: 'chart', PR10: 'users',
    PR11: 'monitor', PR12: 'folder', PR13: 'file', PR14: 'link', PR15: 'task',
    PR16: 'wallet', PR17: 'cart', PR18: 'calendar', PR19: 'message', PR20: 'briefcase',
    PR21: 'phone', PR22: 'network', PR23: 'search', PR24: 'server', PR25: 'chart'
  };
  var PSTAT = ['not-started', 'planning', 'development', 'testing', 'completed', 'needs-improvement', 'published'];
  var MSTAT = ['not-started', 'in-progress', 'completed'];
  var EVENTS = [['note', 'Note'], ['started', 'Project started'], ['folders', 'Folder structure created'], ['feature', 'Feature implemented'], ['bug-found', 'Bug discovered'], ['bug-fixed', 'Bug fixed'],
    ['version-started', 'Version started'], ['version-completed', 'Version completed'], ['testing', 'Testing completed'], ['github', 'GitHub published'], ['deployed', 'Deployment completed']];
  function card(t) { return h('section', { class: 'card' }, h('h3', { text: t }), [].slice.call(arguments, 1)); }
  function row(a, b) { return b !== null && b !== undefined && b !== '' ? h('div', { class: 'row' }, h('span', { class: 'lab', text: a }), h('span', { class: 'val', text: String(b) })) : null; }
  function select(opts, cur, onchange, label) { var s = h('select', { class: 'sel', 'aria-label': label, onchange: function () { onchange(this.value); } }); opts.forEach(function (o) { var op = h('option', { value: o, text: U.STATUS[o] }); if (o === cur) { op.selected = true; } s.appendChild(op); }); return s; }

  var TONES = ['a', 'b', 'c'], SCR = ['M18 150 L78 34 L108 138 L176 20 L204 126 L278 8', 'M14 120 C70 20 96 170 150 70 S230 130 286 24', 'M20 160 L96 60 L60 56 L150 12 L128 100 L246 28 L226 120 L292 70'];
  function scribble(i) { var x = h('span', { class: 'scribble', 'aria-hidden': 'true' }); x.innerHTML = '<svg viewBox="0 0 300 180" preserveAspectRatio="xMaxYMax meet"><path d="' + SCR[i % 3] + '"/></svg>'; return x; }
  var openSet = {};
  function pcard(p, n) {
    var s = A.projectStats(p), ps = A.projectState(p.id), ic = h('span', { class: 'pc-ic', 'aria-hidden': 'true' }), isOpen = !!openSet[p.id];
    ic.appendChild(I.make(PROJECT_ICONS[p.id] || 'code'));
    var go = h('button', { type: 'button', class: 'pc-go', 'aria-expanded': isOpen ? 'true' : 'false', 'aria-label': 'Open ' + p.name, text: '›' });
    var head = h('div', { class: 'pcard pc-' + TONES[n % 3], role: 'group', 'aria-label': p.name },
      h('span', { class: 'pc-top' }, h('span', { class: 'pc-tag', text: U.STATUS[ps.status] }), go),
      h('span', { class: 'pc-meta' }, ic, s.done + '/' + s.total + ' versions · ' + p.category),
      h('strong', { class: 'pc-title', text: p.name }),
      h('span', { class: 'pc-bar', role: 'progressbar', 'aria-valuenow': s.percent, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: 'width:' + s.percent + '%' })));
    head.appendChild(scribble(n));
    var body = h('div', { class: 'acc-body', hidden: isOpen ? null : 'hidden' }), wrap = h('div', { class: 'acc' + (isOpen ? ' is-open' : ''), 'data-id': p.id, 'data-n': n }, head, body), mount = null;
    function fill() { if (!body.firstChild) { var v = page(p.id); body.appendChild(v); mount = function () { (v._mounts || []).forEach(function (f) { f(); }); }; wrap._mount = mount; } }
    function toggle() { var now = body.hidden; openSet[p.id] = now; body.hidden = !now; wrap.classList.toggle('is-open', now); go.setAttribute('aria-expanded', now ? 'true' : 'false'); if (now) { fill(); if (mount) { mount(); } } }
    go.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    head.addEventListener('click', function (e) { if (!e.target.closest('button, a')) { toggle(); } });
    if (isOpen) { fill(); }
    return wrap;
  }
  function list() {
    var w = h('div', { class: 'mod-list' }), n = 0;
    var order = ['Small', 'Medium', 'Large', 'Advanced'], groups = {}; C.projects.forEach(function (p) { (groups[p.category] = groups[p.category] || []).push(p); });
    Object.keys(groups).sort(function (a, b) { return (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99; }).forEach(function (k) {
      w.appendChild(h('h3', { class: 'ph', text: k })); groups[k].forEach(function (p) { w.appendChild(pcard(p, n++)); }); });
    return w;
  }

  function page(id) {
    var p = C.project(id); if (!p) { return h('p', { text: 'Project not found.' }); }
    var w = h('div', { class: 'acc-inner' }), ps = A.projectState(id), s = A.projectStats(p); w._mounts = [];
    w.appendChild(card('Status and progress', select(PSTAT, ps.status, function (v) { A.saveProject(id, { status: v }).then(V.refresh); }, 'Project status'),
      h('p', { class: 'bigday', text: s.percent + '% · ' + s.done + ' / ' + s.total + ' versions completed' }), U.bar(s.percent),
      h('p', { class: 'muted small', text: 'Status is yours to set. Learning sessions never complete a project or a version automatically.' })));
    w.appendChild(card('Overview', row('Core skills', p.coreSkills), row('Portfolio priority', p.priority), row('Prerequisite / introduction', p.prerequisite),
      row('First planned milestone', typeof p.firstMilestoneDay === 'number' ? 'Day ' + p.firstMilestoneDay + ' (planning reference)' : p.firstMilestoneDay), row('Version roadmap', p.versionRoadmap), row('Notes', p.notes)));
    w.appendChild(card('Folder and publishing', row('Canonical folder', p.folder), row('Publishable milestone', p.publishableDefinition), row('Continuity rule', p.continuityRule)));
    var vc = card('Versions and milestones'), first = 0;
    p.versions.forEach(function (v, i) { if (!first && A.milestone(v.id).status !== 'completed') { first = i; } });
    var slides = p.versions.map(function (v, i) {
      var m = A.milestone(v.id), box = h('div', { class: 'ver st-' + m.status });
      box.appendChild(h('div', { class: 'vhead' }, h('strong', { text: v.name }), select(MSTAT, m.status, function (val) { A.saveMilestone(p, v, { status: val }).then(V.refresh); }, v.name + ' status')));
      box.appendChild(row('Target', v.targetDay ? 'Day ' + v.targetDay + ' (planning reference only)' : v.targetText));
      box.appendChild(row('Unlocks after', v.unlocksAfter)); box.appendChild(row('What changes', v.changes)); box.appendChild(row('Acceptance checks', v.acceptance));
      if (m.completedAt) { box.appendChild(row('Completed', U.stamp(m.completedAt))); }
      var n = h('textarea', { class: 'notes', rows: 2, placeholder: 'Notes for ' + v.name + '…' }); n.value = m.notes || ''; n.addEventListener('blur', function () { A.saveMilestone(p, v, { notes: n.value }); }); box.appendChild(n);
      if (v.targetDay) { box.appendChild(h('a', { class: 'small', href: '#calendar/day/' + v.targetDay, text: 'Open Day ' + v.targetDay + ' →' })); }
      return h('div', { class: 'ver-card pc-' + TONES[i % 3] }, box);
    });
    var vcount = h('span', { class: 'deck-count' }), vd = Deck.create({ slides: slides, index: first, onChange: function (i) { vcount.textContent = (i + 1) + ' / ' + slides.length; } });
    vcount.textContent = (first + 1) + ' / ' + slides.length;
    vc.appendChild(h('div', { class: 'deck-head' }, h('span', { class: 'muted small', text: 'Swipe between versions' }), vcount)); vc.appendChild(vd.el); w._mounts.push(vd.mount);
    w.appendChild(vc);
    var rel = h('div', { class: 'chips' }); p.relatedDays.forEach(function (d) { rel.appendChild(h('a', { class: 'gchip', href: '#calendar/day/' + d, text: 'Day ' + d })); });
    var mods = []; C.modules.forEach(function (m) { if (p.relatedDays.some(function (d) { return d >= m.startDay && d <= m.endDay; })) { mods.push(h('a', { class: 'gchip', href: '#progress/topic/' + m.id, text: m.name })); } });
    w.appendChild(card('Related sessions and topics (derived from version target days)', rel, h('div', { class: 'chips' }, mods)));
    // development history
    var hist = card('Development history'), type = h('select', { class: 'sel', 'aria-label': 'Event type' }), txt = h('input', { class: 'sel', type: 'text', placeholder: 'Details (optional)' }), dt = h('input', { class: 'sel', type: 'date', max: U.todayKey(), value: U.todayKey(), 'aria-label': 'Event date' });
    EVENTS.forEach(function (e) { type.appendChild(h('option', { value: e[0], text: e[1] })); });
    hist.appendChild(h('div', { class: 'form' }, type, txt, dt, V.btn('Add event', 'primary', function () {
      var label = type.options[type.selectedIndex].text + (txt.value.trim() ? ': ' + txt.value.trim() : ''), at = dt.value ? new Date(dt.value + 'T' + new Date().toTimeString().slice(0, 8)).toISOString() : undefined;
      A.projectEvent(id, type.value, label, null, at).then(V.refresh); })));
    var evs = A.projectEvents(id); if (!evs.length) { hist.appendChild(h('p', { class: 'muted', text: 'No events yet. Status and version changes are recorded here automatically.' })); }
    evs.forEach(function (e) { hist.appendChild(h('div', { class: 'item' }, h('strong', { text: e.label }), h('span', { class: 'muted small', text: U.stamp(e.at) }),
      h('button', { type: 'button', class: 'link', onclick: function () { if (confirm('Delete this event?')) { A.deleteEvent(e.id).then(V.refresh); } }, text: 'Delete' }))); });
    w.appendChild(hist);
    var n2 = h('textarea', { class: 'notes', rows: 4, placeholder: 'Project notes…' }); n2.value = ps.notes || ''; n2.addEventListener('blur', function () { A.saveProject(id, { notes: n2.value }); });
    w.appendChild(card('My notes', n2)); return w;
  }

  function render(focusId) {
    if (U.route('projects') === null) { return; } root.textContent = '';
    var view = list(); root.appendChild(view);
    [].slice.call(root.querySelectorAll('.acc.is-open')).forEach(function (el) { if (el._mount) { el._mount(); } });
    if (focusId) { var t = root.querySelector('.acc[data-id="' + focusId + '"]'); if (t) { t.scrollIntoView({ block: 'start' }); } }
  }
  function fromHash() { var r = U.route('projects'); if (r === null) { return; } var id = r[0] && C.project(r[0]) ? r[0] : ''; if (id) { openSet[id] = true; if (history.replaceState) { history.replaceState(null, '', '#projects'); } } render(id); }
  Promise.all([C.ready, A.ready]).then(function () { fromHash(); window.addEventListener('hashchange', fromHash); window.addEventListener('cur-changed', function () { if (U.route('projects') !== null) { render(); } }); })
    .catch(function (e) { root.textContent = 'Could not load: ' + e.message; });
})();

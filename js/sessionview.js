// Shared session pieces: the full detail page (every workbook field), status chip, and action buttons.
(function () {
  'use strict';
  var C = window.Curriculum, A = window.State, h = U.h;
  var V = {};
  V.chip = function (d) { var s = A.status(d); return h('span', { class: 'chip st-' + s, text: U.STATUS[s] }); };
  V.btn = function (label, cls, fn) { return h('button', { type: 'button', class: 'btn ' + (cls || ''), onclick: fn, text: label }); };
  V.refresh = function () { window.dispatchEvent(new CustomEvent('cur-changed')); };
  function act(fn) { return function () { fn().then(V.refresh, function (e) { alert('Could not save: ' + ((e && e.message) || e)); }); }; }

  V.actions = function (d) {   // Start / Mark Done / Skip / Reopen. Opening a session never completes it.
    var s = A.status(d), w = h('div', { class: 'btnrow' });
    if (s === 'completed') { w.appendChild(V.btn('Reopen (undo done)', 'ghost', act(function () { return A.reopen(d); }))); return w; }
    if (s !== 'in-progress') { w.appendChild(V.btn('Start Learning', 'ghost', act(function () { return A.start(d); }))); }
    w.appendChild(V.btn('Mark Done', 'primary', act(function () { return A.markDone(d); })));
    if (s === 'skipped') { w.appendChild(V.btn('Return to it', 'ghost', act(function () { return A.unskip(d); }))); }
    else { w.appendChild(V.btn('Skip', 'ghost', act(function () { return A.skip(d); }))); }
    return w;
  };
  V.completedLine = function (d) { var c = A.completion(d); return c ? h('p', { class: 'done-line', text: 'Completed: ' + U.stamp(c.completedAt) }) : null; };

  function row(label, value) { return value ? h('div', { class: 'row' }, h('span', { class: 'lab', text: label }), h('span', { class: 'val', text: String(value) })) : null; }
  function sec(title) { var kids = [].slice.call(arguments, 1).filter(Boolean); if (!kids.length) { return null; } return h('section', { class: 'card' }, h('h3', { text: title }), kids); }

  function add(n, c) { if (c) { n.appendChild(c); } }
  V.detail = function (d) {
    var s = C.session(d), mod = C.module(s.moduleId), proj = s.projectId ? C.project(s.projectId) : null, node = h('div', { class: 'detail' });
    add(node, h('p', { class: 'eyebrow', text: U.dayLabel(d, C.total) }));
    add(node, h('h2', { text: s.title }));
    add(node, h('p', { class: 'muted' }, V.chip(d), ' ', s.module + ' · session ' + s.moduleDay + ' of ' + s.moduleTotal));
    add(node, V.completedLine(d)); add(node, V.actions(d));
    var links = function (arr) { return arr.length ? h('div', { class: 'links' }, arr.map(function (u) { return h('a', { href: u, target: '_blank', rel: 'noopener', text: u }); })) : null; };
    add(node, sec('Overview', row('Phase', s.phase), row('Semester target', s.semester), row('Domain', s.domain),
      h('div', { class: 'row' }, h('span', { class: 'lab', text: 'Module' }), h('a', { class: 'val', href: '#progress/topic/' + mod.id, text: s.module })), row('Suggested time', s.time)));
    add(node, sec('Learning objective', h('p', { text: s.outcome })));
    add(node, sec('What to do in this session', h('p', { text: s.task })));
    add(node, sec('Practice', h('p', { text: s.practice }), row('Practice type', s.practiceType), row('Platform guidance', s.platform)));
    add(node, sec('Resources', row('Free resource', s.resource), links(s.resourceLinks)));
    add(node, sec('Project', proj ? h('div', { class: 'row' }, h('span', { class: 'lab', text: 'Project' }), h('a', { class: 'val', href: '#projects/' + proj.id, text: proj.name })) : null,
      row('Checkpoint', s.checkpoint), row('Project action', s.projectAction), row('Folder / file guidance', s.folder), row('GitHub action', s.github)));
    var offs = C.meta.revisionOffsets.map(function (o) { return d + o <= C.total ? 'Day ' + (d + o) : null; }).filter(Boolean);
    add(node, sec('Revision and mastery', row('Revision instruction', s.revision), row('Re-check after sessions', offs.length ? offs.join(', ') + ' (curriculum days, not calendar dates)' : null), row('Exit check', s.mastery)));
    var vers = []; C.projects.forEach(function (p) { p.versions.forEach(function (v) { if (v.targetDay === d) { vers.push(h('div', { class: 'row' }, h('span', { class: 'lab', text: 'Version target' }), h('a', { class: 'val', href: '#projects/' + p.id, text: p.name + ' ' + v.name + ' (planning reference only)' }))); } }); });
    add(node, sec('Project versions targeting this day', vers));
    var ex = h('textarea', { class: 'notes', rows: 4, placeholder: 'Your notes and remarks for this session…' }); ex.value = A.sessionState(d).notes || '';
    var saved = h('span', { class: 'muted small' }); var t = null;
    ex.addEventListener('blur', function () { clearTimeout(t); A.saveSession(d, { notes: ex.value }); });
    ex.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { A.saveSession(d, { notes: ex.value }).then(function () { saved.textContent = 'Saved'; }); }, 500); });
    add(node, sec('My notes', ex, saved));
    add(node, sec('Workbook fields kept as given', row('Workbook status', s.workbookStatus), row('Workbook remarks', s.workbookRemarks)));
    var nav = h('div', { class: 'btnrow' });
    if (d > 1) { nav.appendChild(h('a', { class: 'btn ghost', href: '#calendar/day/' + (d - 1), text: '← Day ' + (d - 1) })); }
    nav.appendChild(h('a', { class: 'btn ghost', href: '#calendar/' + C.groupOf(d), text: 'Days ' + C.groups()[C.groupOf(d)].from + '–' + C.groups()[C.groupOf(d)].to }));
    if (d < C.total) { nav.appendChild(h('a', { class: 'btn ghost', href: '#calendar/day/' + (d + 1), text: 'Day ' + (d + 1) + ' →' })); }
    add(node, nav); return node;
  };
  window.SessionView = V;
})();

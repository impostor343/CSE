// "What this module covers" and "What this topic covers" cards.
// Module card: plain-English overview (data/module-overview.json), what you'll learn (the topics, tappable), the end goal.
// Topic card: key ideas (taken from the topic name), how its sessions go, and where it fits in the module.
// Used by js/workspace.js (Home > Modules) and js/progress.js (Progress > module page and topic page).
(function () {
  'use strict';
  var h = U.h, over = null, waiting = [], openState = {};
  function load() {
    fetch('data/module-overview.json?v=1').then(function (r) { return r.json(); })
      .then(function (j) { over = j; }).catch(function () { over = {}; })
      .then(function () { waiting.splice(0).forEach(function (f) { f(); }); });
  }
  function whenReady(f) { if (over) { f(); } else { waiting.push(f); } }

  function chip(t) { return t ? h('span', { class: 'cov-chip', text: t }) : null; }
  function dayText(tp) { return tp.days.length > 1 ? 'Days ' + tp.firstDay + '–' + tp.lastDay : 'Day ' + tp.firstDay; }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // "Git installation, identity, init and commit" -> ["Git installation","identity","init","commit"]
  function split(name) {
    var head = '', rest = name, i = name.indexOf(': ');
    if (i > 0) { head = name.slice(0, i); rest = name.slice(i + 2); }
    var parts = rest.split(/,\s*/), last = parts[parts.length - 1], j = last.indexOf(' and ');
    if (j > 0 && (parts.length > 1 || head)) { parts.splice(parts.length - 1, 1, last.slice(0, j), last.slice(j + 5)); }
    parts = parts.map(function (x) { return x.trim(); }).filter(Boolean);
    return { head: head, items: parts };
  }

  function shell(key, title, open, body) {
    var d = h('details', { class: 'cov', open: (open || openState[key]) ? 'open' : null },
      h('summary', null, h('span', { class: 'cov-title', text: title }), h('span', { class: 'cov-chev', 'aria-hidden': 'true', text: '›' })),
      h('div', { class: 'cov-body' }, body));
    d.addEventListener('toggle', function () { openState[key] = d.open; });
    return d;
  }

  function moduleCard(m, o) {
    o = o || {};
    var C = window.Curriculum, A = window.State, topics = C.topicsOf(m.id);
    var sum = h('p', { class: 'cov-sum', text: m.outcome }), why = h('p', { class: 'cov-why', hidden: 'hidden' });
    whenReady(function () { var d = over && over[m.id]; if (d) { sum.textContent = d.summary; if (d.why) { why.textContent = d.why; why.hidden = false; } } });
    var list = h('ol', { class: 'cov-list' }, topics.map(function (tp) {
      var done = A && A.conceptStatus && A.conceptStatus(tp) === 'completed';
      return h('li', null, h('a', { href: '#progress/topic/' + tp.id }, h('span', { class: 'cov-name', text: tp.name }), h('span', { class: 'cov-days', text: (done ? '✓ ' : '') + dayText(tp) })));
    }));
    var body = [sum, why,
      h('div', { class: 'cov-facts' }, chip(m.days + ' sessions'), chip(topics.length + ' topics'), chip(m.semester), chip(m.domain)),
      h('h4', { class: 'cov-h', text: 'What you’ll learn' }), list,
      h('h4', { class: 'cov-h', text: 'By the end you can' }), h('p', { class: 'cov-end', text: m.outcome })];
    return shell('m:' + m.id, 'What this module covers', o.open, body);
  }

  function topicCard(tp, o) {
    o = o || {};
    var C = window.Curriculum, m = C.module(tp.moduleId), sp = split(tp.name), body = [];
    var sess = tp.days.map(function (d) { return C.session(d); }).filter(Boolean);
    if (sp.items.length > 1) {
      body.push(h('h4', { class: 'cov-h cov-first', text: 'Key ideas' }));
      if (sp.head) { body.push(h('p', { class: 'cov-focus', text: sp.head })); }
      body.push(h('div', { class: 'cov-chips' }, sp.items.map(function (x) { return h('span', { class: 'cov-chip big', text: x }); })));
    } else {
      body.push(h('p', { class: 'cov-sum', text: tp.name }));
    }
    if (sess.length) {
      body.push(h('h4', { class: 'cov-h', text: 'How the sessions go' }));
      body.push(h('ol', { class: 'cov-steps' }, sess.map(function (s) {
        var kind = cap((s.title.split(' — ').slice(1).join(' — ')) || 'Study session');
        return h('li', null, h('span', { class: 'cov-day', text: 'Day ' + s.day }), h('span', { class: 'cov-kind', text: kind }), s.time ? h('span', { class: 'cov-days', text: s.time }) : null);
      })));
      var last = sess[sess.length - 1];
      if (last.checkpoint && last.checkpoint !== '-') { body.push(h('p', { class: 'cov-end' }, h('strong', { text: 'Finish line: ' }), last.checkpoint)); }
    }
    if (m) {
      var ts = C.topicsOf(m.id), i = ts.indexOf(tp), prev = ts[i - 1], next = ts[i + 1];
      body.push(h('h4', { class: 'cov-h', text: 'Where it fits' }));
      body.push(h('p', { class: 'cov-fit' }, 'Topic ' + (i + 1) + ' of ' + ts.length + ' in ', h('a', { href: '#progress/module/' + m.id, text: m.name }), '.'));
      if (prev) { body.push(h('p', { class: 'cov-fit' }, h('span', { class: 'muted', text: 'Before: ' }), h('a', { href: '#progress/topic/' + prev.id, text: prev.name }))); }
      if (next) { body.push(h('p', { class: 'cov-fit' }, h('span', { class: 'muted', text: 'Next: ' }), h('a', { href: '#progress/topic/' + next.id, text: next.name }))); }
    }
    return shell('t:' + tp.id, 'What this topic covers', o.open, body);
  }

  window.Coverage = { module: moduleCard, topic: topicCard };
  load();
})();

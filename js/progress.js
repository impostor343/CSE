// Progress tab: dashboard (roadmap ring, status tiles, next up, projects, modules), module and topic pages, status lists, guides.
// Routes: #progress | #progress/topics (all modules) | #progress/module/<M01..> | #progress/topic/<TOP0001..> | #progress/list/<completed|skipped|pending|in-progress> | #progress/more
(function () {
  'use strict';
  var C = window.Curriculum, A = window.State, V = window.SessionView, h = U.h, root = document.getElementById('progress-root');
  var TOPIC_STATUSES = ['not-started', 'in-progress', 'completed', 'needs-revision'];
  var LADDER_STATUSES = ['not-started', 'planning', 'development', 'testing', 'completed'];
  var COLORS = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6'], PAGE = 60;
  var PROJECT_ICONS = { PR01:'game', PR02:'calculator', PR03:'quiz', PR04:'contacts', PR05:'wallet', PR06:'bank', PR07:'book', PR08:'box', PR09:'chart', PR10:'users', PR11:'monitor', PR12:'folder', PR13:'file', PR14:'link', PR15:'task', PR16:'wallet', PR17:'cart', PR18:'calendar', PR19:'message', PR20:'briefcase', PR21:'phone', PR22:'network', PR23:'search', PR24:'server', PR25:'chart' };

  function card(t) { return h('section', { class: 'card' }, h('h3', { text: t }), [].slice.call(arguments, 1)); }
  function row(a, b) { return b ? h('div', { class: 'row' }, h('span', { class: 'lab', text: a }), h('span', { class: 'val', text: String(b) })) : null; }
  function back(href, text) { return h('a', { class: 'btn ghost back', href: href, text: text }); }
  function ic(name) { return window.Icons.make(name); }

  // Picks an icon from the name. Falls back to a generic code icon (nothing is invented about the item).
  var ICON_RULES = [[/\bgit\b|github|version control/i, 'branch'], [/\bbank/i, 'bank'], [/library|\bbook/i, 'book'], [/\bcafe|coffee|restaurant|\bjava\b/i, 'cup'], [/chess|\bgame/i, 'game'], [/movie|ticket|booking|dashboard|frontend|\breact\b|\bui\b/i, 'monitor'],
    [/\bsql\b|dbms|database|data model|jdbc|storage/i, 'database'], [/data structure|algorithm|\bgraphs?\b|\btrees?\b/i, 'sitemap'], [/\brest\b|\bapis?\b|spring|\bhttp|network|protocol/i, 'link'], [/\btest|quality|\bqa\b/i, 'task'], [/secur|crypt|\bauth/i, 'shield'],
    [/operating system|\bos\b|linux|kernel|concurren|thread/i, 'cpu'], [/\bweb\b|javascript|typescript|browser/i, 'globe'], [/\bcloud|devops|deploy|docker|kubernetes/i, 'cloud'], [/android|mobile|\bapp\b/i, 'phone'], [/inventory|\bstore\b|\bshop|\bstock/i, 'box'],
    [/\bchat|message|\bqueue/i, 'message'], [/machine learning|\bai\b|\bml\b|analytic|data science|data and ai/i, 'chart'], [/\boop\b|object|software design|architect|system design/i, 'layers'], [/capstone|portfolio|interview/i, 'flag'], [/\btask|todo|planner|schedule/i, 'task']];
  function iconFor(name) { for (var i = 0; i < ICON_RULES.length; i++) { if (ICON_RULES[i][0].test(name)) { return ICON_RULES[i][1]; } } return 'code'; }
  function moduleIcon(m) { return C.moduleIcon ? C.moduleIcon(m.id) : iconFor((m.name || '') + ' ' + (m.domain || '')); }
  function topicIcon(tp) { return C.topicIcon ? C.topicIcon(tp.id) : iconFor(tp.name || ''); }

  function ring(pct) {
    var NS = 'http://www.w3.org/2000/svg', r = 52, c = 2 * Math.PI * r, svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120'); svg.setAttribute('class', 'pg-ring'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', pct + ' percent complete');
    function mk(tag, attrs) { var e = document.createElementNS(NS, tag); Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); return e; }
    svg.appendChild(mk('circle', { cx: 60, cy: 60, r: r, class: 'pg-ring-track' }));
    svg.appendChild(mk('circle', { cx: 60, cy: 60, r: r, class: 'pg-ring-fill', 'stroke-dasharray': (c * Math.max(pct, pct > 0 ? 1 : 0) / 100).toFixed(1) + ' ' + c.toFixed(1), transform: 'rotate(-90 60 60)' }));
    var t = mk('text', { x: 60, y: 60, class: 'pg-ring-text', 'text-anchor': 'middle', 'dominant-baseline': 'central' }); t.textContent = pct + '%'; svg.appendChild(t);
    return svg;
  }

  function tile(kind, icon, label, n, href) {
    return h('a', { class: 'pg-tile ' + kind, href: href }, h('span', { class: 'pg-tile-ic' }, ic(icon)),
      h('span', { class: 'pg-tile-body' }, h('span', { class: 'pg-tile-label', text: label }), h('strong', { text: U.num(n) }), h('span', { class: 'pg-tile-sub', text: 'learning sessions' })), h('span', { class: 'pg-chev' }, ic('right')));
  }

  function prow(href, i, icon, name, done, total, pct) {
    return h('a', { class: 'pg-row ' + COLORS[i % COLORS.length], href: href },
      h('span', { class: 'pg-row-ic' }, ic(icon)),
      h('span', { class: 'pg-row-main' }, h('span', { class: 'pg-row-name', text: name }), h('span', { class: 'pg-bar' }, h('span', { style: 'width:' + pct + '%' }))),
      h('span', { class: 'pg-row-count', text: done + ' / ' + total }), h('span', { class: 'pg-row-pct', text: pct + '%' }), h('span', { class: 'pg-chev' }, ic('right')));
  }
  function sectionHead(icon, title, linkText, href) { return h('div', { class: 'pg-sec' }, h('h3', {}, ic(icon), title), h('a', { href: href }, linkText, ' ', ic('right'))); }

  function weekCard() {
    var by = A.completionsByDate(), days = [], total = 0, max = 1, now = new Date(), names = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i), k = d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()), n = (by[k] || []).length;
      days.push({ n: n, name: names[d.getDay()], today: i === 0 }); total += n; if (n > max) { max = n; }
    }
    var streak = 0, j = days.length - 1; if (days[j].n === 0) { j--; } while (j >= 0 && days[j].n > 0) { streak++; j--; }
    var bars = h('div', { class: 'pg-bars', role: 'img', 'aria-label': total + ' sessions completed in the last 7 days' });
    days.forEach(function (x) { bars.appendChild(h('div', { class: 'pg-bar-col' + (x.n ? ' has' : '') + (x.today ? ' today' : '') }, x.n ? h('b', { text: String(x.n) }) : null, h('i', { style: 'height:' + (x.n ? 18 + Math.round(72 * x.n / max) : 6) + '%' }), h('em', { text: x.name }))); });
    return h('section', { class: 'pg-week' }, h('div', { class: 'pg-week-top' }, h('strong', { text: 'This week' }), h('span', { text: total + ' done' + (streak > 1 ? ' · ' + streak + '-day streak' : '') })), bars);
  }
  function dashboard() {
    var w = h('div', { class: 'pg' }), n = A.doneCount(), total = C.total, pct = U.pct(n, total);
    // Roadmap progress
    w.appendChild(h('section', { class: 'pg-hero' }, h('div', { class: 'pg-hero-top' }, ring(pct),
      h('div', { class: 'pg-hero-text' }, h('h2', { text: 'Roadmap progress' }), h('p', { class: 'pg-hero-line', text: U.num(n) + ' of ' + U.num(total) + ' learning sessions completed' }), U.bar(pct),
        h('p', { class: 'pg-note', text: 'Skipped sessions are not counted as complete. Day numbers are permanent IDs, not calendar dates.' }))),
      h('p', { class: 'pg-info' }, ic('info'), ' Curriculum: ' + U.num(total) + ' sessions · ' + C.modules.length + ' modules · ' + C.topics.length + ' topics · ' + C.projects.length + ' projects')));
    // This week: completions per day (last 7 days) from your own Done marks
    w.appendChild(weekCard());
    // Status tiles
    w.appendChild(h('div', { class: 'pg-tiles' }, tile('done', 'check', 'Completed', n, '#progress/list/completed'), tile('skip', 'arrow', 'Skipped', A.skippedCount(), '#progress/list/skipped'),
      tile('pend', 'clock', 'Pending', A.pendingCount(), '#progress/list/pending'), tile('prog', 'refresh', 'In progress', A.inProgressCount(), '#progress/list/in-progress')));
    // Keep moving
    var nx = A.nextIncomplete(), s = nx ? C.session(nx) : null;
    w.appendChild(h('section', { class: 'pg-next' }, h('span', { class: 'pg-next-ic' }, ic('target')),
      h('div', { class: 'pg-next-body' }, h('strong', { text: s ? 'Keep moving' : 'Roadmap complete' }), s ? h('span', { class: 'pg-next-tag', text: 'Next up' }) : null,
        s ? h('p', { class: 'pg-next-title' }, h('span', { class: 'pg-code', 'aria-hidden': 'true' }, ic('code')), s.module + ' · ' + (s.topic || s.title)) : h('p', { class: 'pg-next-title', text: 'Every session is completed or skipped.' }),
        s ? h('p', { class: 'pg-next-day' }, ic('calendar'), ' Day ' + U.num(nx) + ' of ' + U.num(total)) : null),
      s ? h('a', { class: 'pg-open', href: '#today' }, 'Open today ', ic('right')) : null));
    // Projects (started or progressed first, then by earliest planned milestone)
    var plist = C.projects.slice().sort(function (a, b) {
      var sa = A.projectStats(a), sb = A.projectStats(b), ga = (sa.done || sa.inProgress || A.projectState(a.id).status !== 'not-started') ? 0 : 1, gb = (sb.done || sb.inProgress || A.projectState(b.id).status !== 'not-started') ? 0 : 1;
      if (ga !== gb) { return ga - gb; } if (!ga && sa.percent !== sb.percent) { return sb.percent - sa.percent; }
      return (typeof a.firstMilestoneDay === 'number' ? a.firstMilestoneDay : 9999) - (typeof b.firstMilestoneDay === 'number' ? b.firstMilestoneDay : 9999);
    }).slice(0, 5);
    w.appendChild(sectionHead('layers', 'Projects', 'View all projects', '#projects'));
    w.appendChild(h('div', { class: 'pg-list' }, plist.map(function (p, i) { var st = A.projectStats(p); return prow('#projects/' + p.id, i, PROJECT_ICONS[p.id] || iconFor(p.name), p.name, st.done, st.total, st.percent); })));
    // Modules (starting at the module of the next session)
    var cur = nx ? C.modules.indexOf(C.module(C.session(nx).moduleId)) : 0, start = Math.max(0, Math.min(cur, C.modules.length - 6)), mods = C.modules.slice(start, start + 6);
    w.appendChild(sectionHead('book', 'Modules', 'View all modules', '#progress/topics'));
    w.appendChild(h('div', { class: 'pg-list' }, mods.map(function (m, i) { var st = A.topicStats(m); return prow('#progress/module/' + m.id, i, moduleIcon(m), m.name, st.done, st.total, st.percent); })));
    // Everything else that used to be on this page
    var pq = A.practiceStats(), ml = A.milestoneTotals();
    w.appendChild(h('section', { class: 'pg-more' },
      h('a', { href: '#progress/topics' }, h('span', { text: 'Topics completed (your own status)' }), h('strong', { text: A.conceptsDone() + ' / ' + C.topics.length })),
      h('a', { href: '#projects' }, h('span', { text: 'Project versions completed' }), h('strong', { text: ml.done + ' / ' + ml.total })),
      h('a', { href: '#questions' }, h('span', { text: 'Practice questions solved' }), h('strong', { text: pq.solved + ' / ' + pq.total })),
      h('a', { href: '#progress/more' }, h('span', { text: 'Workbook guides and resources' }), h('strong', { text: '›' }))));
    return w;
  }

  function topics() {   // all modules
    var w = h('div'); w.appendChild(back('#progress', '← Progress')); w.appendChild(h('h2', { text: 'Modules' }));
    w.appendChild(h('p', { class: 'muted small', text: C.modules.length + ' modules · ' + C.topics.length + ' topics. Open a module to see its topics and sessions.' }));
    var phase = null;
    C.modules.forEach(function (m) {
      if (m.phase !== phase) { phase = m.phase; w.appendChild(h('h3', { class: 'ph', text: phase })); }
      var t = A.topicStats(m), st = A.topicStatus(m);
      var mic = h('span', { class: 'module-icon module-icon-' + m.id.toLowerCase(), 'aria-hidden': 'true' }); mic.appendChild(ic(moduleIcon(m)));
      w.appendChild(h('a', { class: 'item module-item', href: '#progress/module/' + m.id }, mic, h('span', { class: 'module-item-main' }, h('strong', { text: m.name }), h('span', { class: 'muted small', text: U.STATUS[st] + ' · ' + t.done + ' / ' + t.total + ' sessions · ' + (m.topicIds ? m.topicIds.length : 0) + ' topics · Days ' + m.startDay + '–' + m.endDay }), U.bar(t.percent)), h('span', { class: 'project-item-arrow', text: '›', 'aria-hidden': 'true' })));
    });
    return w;
  }

  function statusSelect(cur, list, onchange, label) {
    var sel = h('select', { class: 'sel', 'aria-label': label, onchange: function () { onchange(this.value); } });
    list.forEach(function (s) { var o = h('option', { value: s, text: U.STATUS[s] }); if (s === cur) { o.selected = true; } sel.appendChild(o); }); return sel;
  }
  function sessionList(days) {
    var sl = h('div', { class: 'slist' });
    days.forEach(function (d) { var s = C.session(d); if (!s) { return; }
      sl.appendChild(h('a', { class: 'srow st-' + A.status(d), href: '#calendar/day/' + d }, h('span', { class: 'dnum', text: 'Day ' + d }), h('span', { class: 'sbody' }, h('strong', { text: s.title }), s.practice ? h('span', { class: 'muted small clamp', text: 'Practice: ' + s.practice }) : null), V.chip(d))); });
    return sl;
  }
  function questionRows(list) {
    if (!list.length) { return h('p', { class: 'muted small', text: 'No practice questions are linked here in the imported workbook data.' }); }
    return h('div', {}, list.slice(0, 40).map(function (q) { var st = A.practiceRec(q.id).status;
      return h('a', { class: 'item', href: '#questions/' + q.id }, h('strong', { text: q.title }), h('span', { class: 'muted small', text: q.id + ' · ' + (q.difficulty || '') + ' · ' + (q.platform || '') + ' · ' + U.STATUS[st] })); }),
      list.length > 40 ? h('p', { class: 'muted small', text: 'Showing 40 of ' + list.length + '. Search the Questions tab for the rest.' }) : null);
  }
  function notesBox(id) {
    var ts = A.topicState(id), ex = h('textarea', { class: 'notes', rows: 4, placeholder: 'Your notes…' }); ex.value = ts.notes || ''; ex.addEventListener('blur', function () { A.saveTopic(id, { notes: ex.value }); });
    return card('My notes', ex);
  }

  function modulePage(id) {
    var m = C.module(id); if (!m) { return h('p', { text: 'Module not found.' }); }
    var w = h('div'), t = A.topicStats(m), ts = A.topicState(id);
    w.appendChild(back('#progress/topics', '← Modules'));
    w.appendChild(h('p', { class: 'eyebrow', text: m.catalogId + ' · ' + m.phase }));
    var mdic = h('span', { class: 'module-detail-icon module-icon-' + m.id.toLowerCase(), 'aria-hidden': 'true' }); mdic.appendChild(ic(moduleIcon(m)));
    w.appendChild(h('div', { class: 'module-detail-heading' }, mdic, h('h2', { text: m.name })));
    if (window.Coverage) { w.appendChild(Coverage.module(m, { open: true })); }
    w.appendChild(card('Status', statusSelect(A.topicStatus(m), TOPIC_STATUSES, function (v) { A.saveTopic(id, { status: v }).then(V.refresh); }, 'Module status'),
      h('p', { class: 'muted small', text: 'Your status is separate from session completion. Changing it never completes or reopens sessions.' }), ts.completedAt ? row('Marked completed', U.stamp(ts.completedAt)) : null));
    w.appendChild(card('Learning progress', h('p', { class: 'bigday', text: t.done + ' / ' + t.total + ' sessions completed' }), U.bar(t.percent), h('p', { class: 'muted', text: t.remaining + ' remaining' + (t.skipped ? ' · ' + t.skipped + ' skipped' : '') })));
    w.appendChild(card('About', row('Domain', m.domain), row('Semester target', m.semester), row('Sessions', 'Days ' + m.startDay + '–' + m.endDay + ' (' + m.days + ')'), row('Expected outcome', m.outcome), row('Extension rule', m.extensionRule)));
    var tl = h('div'); C.topicsOf(id).forEach(function (tp) { var st = A.conceptStats(tp);
      var tic = h('span', { class: 'topic-icon', 'aria-hidden': 'true' }); tic.appendChild(ic(topicIcon(tp)));
      tl.appendChild(h('a', { class: 'item topic-item', href: '#progress/topic/' + tp.id }, tic, h('span', { class: 'topic-item-main' }, h('strong', { text: tp.name }), h('span', { class: 'muted small', text: U.STATUS[A.conceptStatus(tp)] + ' · ' + st.done + ' / ' + st.total + ' sessions · Day' + (tp.days.length > 1 ? 's ' + tp.firstDay + '–' + tp.lastDay : ' ' + tp.firstDay) }), U.bar(st.percent)))); });
    w.appendChild(card('Topics in this module (' + (m.topicIds || []).length + ')', tl));
    var prev = C.modules[C.modules.indexOf(m) - 1];
    w.appendChild(card('Prerequisites', h('p', { text: prev ? 'Follows: ' + prev.name + ' (Days ' + prev.startDay + '–' + prev.endDay + '). The workbook states no other module-level prerequisites.' : 'First module in the curriculum.' })));
    w.appendChild(card('Resources', row('Free resource', m.resource), m.resourceLinks.length ? h('div', { class: 'links' }, m.resourceLinks.map(function (u) { return h('a', { href: u, target: '_blank', rel: 'noopener', text: u }); })) : null));
    var projs = C.projects.filter(function (p) { return (p.moduleIds || []).indexOf(id) !== -1 || p.relatedDays.some(function (d) { return d >= m.startDay && d <= m.endDay; }); });
    w.appendChild(card('Related projects', projs.length ? projs.map(function (p) { var pic = h('span', { class: 'project-icon project-icon-' + p.id.toLowerCase(), 'aria-hidden': 'true' }); pic.appendChild(ic(PROJECT_ICONS[p.id] || iconFor(p.name))); return h('a', { class: 'item project-item', href: '#projects/' + p.id }, pic, h('span', { class: 'project-item-main' }, h('strong', { text: p.name }), h('span', { class: 'muted small', text: p.category + ' · ' + p.coreSkills })), h('span', { class: 'project-item-arrow', text: '›', 'aria-hidden': 'true' })); }) : h('p', { class: 'muted', text: 'No projects are linked to this module.' })));
    var days = []; for (var d = m.startDay; d <= m.endDay; d++) { days.push(d); }
    w.appendChild(card('Sessions', sessionList(days)));
    w.appendChild(notesBox(id));
    return w;
  }

  function topicPage(id) {
    var tp = C.topic(id); if (!tp) { return h('p', { text: 'Topic not found.' }); }
    var m = C.module(tp.moduleId), w = h('div'), st = A.conceptStats(tp), ts = A.topicState(id);
    w.appendChild(back('#progress/module/' + tp.moduleId, '← ' + (m ? m.name : 'Module')));
    w.appendChild(h('p', { class: 'eyebrow', text: tp.id + (m ? ' · ' + m.catalogId : '') }));
    var thic = h('span', { class: 'topic-detail-icon', 'aria-hidden': 'true' }); thic.appendChild(ic(topicIcon(tp)));
    w.appendChild(h('div', { class: 'topic-detail-heading' }, thic, h('h2', { text: tp.name })));
    if (window.Coverage) { w.appendChild(Coverage.topic(tp, { open: true })); }
    w.appendChild(card('Status', statusSelect(A.conceptStatus(tp), TOPIC_STATUSES, function (v) { A.saveTopic(id, { status: v }).then(V.refresh); }, 'Topic status'),
      h('p', { class: 'muted small', text: 'Your topic status is separate from session completion. Completing one session never marks a topic complete.' }), ts.completedAt ? row('Marked completed', U.stamp(ts.completedAt)) : null));
    w.appendChild(card('Learning progress', h('p', { class: 'bigday', text: st.done + ' / ' + st.total + ' sessions completed' }), U.bar(st.percent), h('p', { class: 'muted', text: st.remaining + ' remaining' + (st.skipped ? ' · ' + st.skipped + ' skipped' : '') })));
    w.appendChild(card('About', m ? h('div', { class: 'row' }, h('span', { class: 'lab', text: 'Module' }), h('a', { class: 'val', href: '#progress/module/' + m.id, text: m.name })) : null, row('Learning outcome', tp.outcome), row('Domain', m && m.domain), row('Semester target', m && m.semester), row('Mapping confidence', tp.confidence), row('Source note', tp.note)));
    w.appendChild(card('Sessions', sessionList(tp.days)));
    var qs = C.questionsOfTopic(id), linked = {}; qs.forEach(function (q) { linked[q.id] = 1; });
    var missing = 0; tp.days.forEach(function (d) { (C.session(d).questionIds || []).forEach(function (qid) { if (!linked[qid]) { var q = C.question(qid); if (q) { qs.push(q); linked[qid] = 1; } else { missing++; } } }); });
    w.appendChild(card('Practice questions (' + qs.length + ')', questionRows(qs), missing ? h('p', { class: 'muted small', text: missing + ' more linked question IDs are not in the imported workbook data yet (the supplied export stopped at 1,000 rows).' }) : null));
    var pj = C.projectsOfTopic(id);
    w.appendChild(card('Related projects', pj.length ? pj.map(function (x) { return h('a', { class: 'item', href: '#projects/' + x.project.id }, h('strong', { text: x.project.name }), h('span', { class: 'muted small', text: x.link.relationship + ' · ' + x.link.note })); }) : h('p', { class: 'muted', text: 'No catalogue project is linked to this topic.' })));
    var lad = card('Topic project options'); lad.appendChild(h('p', { class: 'muted small', text: 'Small, Medium and Major options for this topic. Choose a tier only after you meet the topic exit check. These do not replace the 25 catalogue projects.' }));
    var slot = h('p', { class: 'muted small', text: 'Loading…' }); lad.appendChild(slot); w.appendChild(lad);
    C.loadLadder().then(function (all) {
      var mine = all.filter(function (x) { return x.topicId === id; }); slot.remove();
      if (!mine.length) { lad.appendChild(h('p', { class: 'muted', text: 'No options found for this topic.' })); return; }
      mine.forEach(function (x) {
        var rec = A.projectState(x.id), box = h('details', { class: 'ver' }), tag = h('summary', {}, h('strong', { text: x.size + ': ' + x.title }));
        box.appendChild(tag); box.appendChild(row('Purpose', x.purpose)); box.appendChild(row('Scope and deliverables', x.scope)); box.appendChild(row('Suggested technology', x.tech)); box.appendChild(row('Unlock condition', x.prerequisites)); box.appendChild(row('Acceptance / quality bar', x.acceptance)); box.appendChild(row('Portfolio signal', x.signal));
        box.appendChild(statusSelect(rec.status, LADDER_STATUSES, function (v) { A.saveProject(x.id, { status: v }); }, x.size + ' option status'));
        lad.appendChild(box);
      });
    });
    w.appendChild(notesBox(id));
    return w;
  }

  function list(kind) {
    var names = { completed: 'Completed sessions', skipped: 'Skipped sessions', pending: 'Pending sessions', 'in-progress': 'Sessions in progress' };
    if (!names[kind]) { kind = 'completed'; }
    var w = h('div'); w.appendChild(back('#progress', '← Progress')); w.appendChild(h('h2', { text: names[kind] }));
    var days = []; for (var d = 1; d <= C.total; d++) { var s = A.status(d); if ((kind === 'pending' && s !== 'completed' && s !== 'skipped') || s === kind) { days.push(d); } }
    if (kind === 'completed') { days.sort(function (a, b) { return A.completion(b).completedAt < A.completion(a).completedAt ? -1 : 1; }); }
    w.appendChild(h('p', { class: 'muted small', text: U.num(days.length) + ' sessions' + (kind === 'completed' ? ', newest first' : '') }));
    if (!days.length) { w.appendChild(h('p', { class: 'muted', text: 'Nothing here yet.' })); return w; }
    var box = h('div'), shown = 0, more = h('button', { type: 'button', class: 'btn ghost', text: 'Show more' });
    function add() { var chunk = days.slice(shown, shown + PAGE); shown += chunk.length; box.appendChild(sessionList(chunk)); more.hidden = shown >= days.length; }
    more.addEventListener('click', add); w.appendChild(box); add(); w.appendChild(more); return w;
  }

  function more() {   // supporting workbook sheets, shown as imported
    var w = h('div'), X = C.extras; w.appendChild(back('#progress', '← Progress')); w.appendChild(h('h2', { text: 'Guides from the workbook' }));
    if (X.folders && X.folders.length) { w.appendChild(card('Folder guidance', X.folders.map(function (g) { return h('div', { class: 'item' }, h('strong', { text: g['Folder / path'] }), h('span', { class: 'small', text: g['What belongs here'] }), h('span', { class: 'muted small', text: [g['Naming / structure'], g['When to use']].filter(Boolean).join(' — ') })); }))); }
    w.appendChild(card('GitHub publishing checkpoints', (X.github || []).map(function (g) { return h('div', { class: 'item' }, h('strong', { text: g.Sequence + '. ' + g.Checkpoint }), h('span', { class: 'small', text: g['What to do'] }), h('span', { class: 'muted small', text: g['Publish / commit guidance'] }), h('span', { class: 'muted small', text: 'Done when: ' + g['Definition of done'] })); })));
    w.appendChild(card('Interview preparation', (X.interview || []).map(function (g) { return h('div', { class: 'item' }, h('strong', { text: g.Track + ' · ' + g['Skill area'] }), h('span', { class: 'small', text: g['Preparation task'] }), h('span', { class: 'muted small', text: g['Evidence / checkpoint'] + ' — ' + g['When to revisit'] })); })));
    w.appendChild(card('Language strategy', (X.languages || []).map(function (g) { return h('div', { class: 'item' }, h('strong', { text: g.Language + ' · ' + g.Priority }), h('span', { class: 'small', text: g.When + ' — ' + g['Why learn it'] }), h('span', { class: 'muted small', text: 'Depth: ' + g['Depth target'] + ' · Avoid: ' + g['Do not do'] })); })));
    w.appendChild(card('Android side track', (X.android || []).map(function (g) { return h('div', { class: 'item' }, h('strong', { text: 'App day ' + g['App Day'] + ': ' + g.Lesson }), h('span', { class: 'small', text: g['Practice / build task'] }), h('span', { class: 'muted small', text: 'After: ' + g.Prerequisite + ' · ' + g['Suggested time'] })); })));
    w.appendChild(card('All free resources', (X.resources || []).map(function (g) { return h('div', { class: 'item' }, h('strong', { text: g.Resource + ' (' + g.Area + ')' }), h('span', { class: 'muted small', text: g['Use it for'] + ' · ' + g['Access note'] }), g.URL ? h('a', { class: 'small', href: g.URL, target: '_blank', rel: 'noopener', text: g.URL }) : null); })));
    w.appendChild(card('Academic pause planner', (X.pause || []).map(function (g) { return h('div', { class: 'item' }, h('strong', { text: g.Entry + ' · ' + g['Academic period'] }), h('span', { class: 'small', text: g['What to do'] }), h('span', { class: 'muted small', text: g.Mode })); })));
    if (X.reviewQueue && X.reviewQueue.length) { w.appendChild(card('Workbook mapping review queue (open items)', X.reviewQueue.map(function (g) { return h('div', { class: 'item' }, h('strong', { text: g['Record type'] + ': ' + g['Record ID'] }), h('span', { class: 'small', text: g['Source value'] }), h('span', { class: 'muted small', text: g['Why review is needed'] + ' — ' + g['Recommended human action'] + ' [' + g['Resolution status'] + ']' })); }))); }
    return w;
  }

  function render() {
    var r = U.route('progress'); if (r === null) { return; }
    root.textContent = '';
    if (r[0] === 'topics') { root.appendChild(topics()); }
    else if (r[0] === 'module') { root.appendChild(modulePage(r[1])); }
    else if (r[0] === 'topic') { if (C.module(r[1])) { root.appendChild(modulePage(r[1])); } else { root.appendChild(topicPage(r[1])); } }   // old links used #progress/topic/M01
    else if (r[0] === 'list') { root.appendChild(list(r[1])); }
    else if (r[0] === 'skipped') { root.appendChild(list('skipped')); }
    else if (r[0] === 'more') { root.appendChild(more()); }
    else { root.appendChild(dashboard()); }
  }
  Promise.all([C.ready, A.ready]).then(function () { render(); window.addEventListener('hashchange', render); window.addEventListener('cur-changed', function () { if (U.route('progress') !== null) { render(); } }); })
    .catch(function (e) { root.textContent = 'Could not load: ' + e.message; });
})();

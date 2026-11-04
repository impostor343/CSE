// All saved progress and every calculation from it. One source of truth:
//  - session completion  = active record in 'completions' (the history calendar reads the same records)
//  - everything else     = its own store; topics, projects, milestones and practice never change session records.
(function () {
  'use strict';
  var C = window.Curriculum, S = window.Store;
  var st = { done: {}, completions: [], ss: {}, ts: {}, ps: {}, ms: {}, pr: {}, events: [], error: null };
  var busy = {};
  function now() { return new Date().toISOString(); }
  var A = {};

  A.load = function () {
    return Promise.all(['completions', 'sessionState', 'topicState', 'projectState', 'milestoneState', 'practiceState', 'events'].map(S.all)).then(function (r) {
      st.completions = r[0]; st.done = {}; r[0].forEach(function (c) { if (!c.reopenedAt) { st.done[c.day] = c; } });
      st.ss = {}; r[1].forEach(function (x) { st.ss[x.day] = x; });
      st.ts = {}; r[2].forEach(function (x) { st.ts[x.id] = x; });
      st.ps = {}; r[3].forEach(function (x) { st.ps[x.id] = x; });
      st.ms = {}; r[4].forEach(function (x) { st.ms[x.id] = x; });
      st.pr = {}; r[5].forEach(function (x) { st.pr[x.id] = x; });
      st.events = r[6]; st.error = null;
    }).catch(function (e) { st.error = (e && e.message) || 'Saved progress could not be loaded.'; });
  };
  A.error = function () { return st.error; };
  A.ready = C.ready.then(A.load);

  // ---- sessions
  A.isDone = function (d) { return !!st.done[d]; };
  A.completion = function (d) { return st.done[d] || null; };
  A.sessionState = function (d) { return st.ss[d] || { day: d, status: 'not-started', notes: '' }; };
  // 'completed' | 'skipped' | 'in-progress' | 'not-started'  (opening a session never changes it)
  A.status = function (d) { if (st.done[d]) { return 'completed'; } var s = st.ss[d]; return s && s.status ? s.status : 'not-started'; };
  A.doneCount = function () { return Object.keys(st.done).length; };
  A.skippedCount = function () { var n = 0; for (var d = 1; d <= C.total; d++) { if (A.status(d) === 'skipped') { n++; } } return n; };
  A.nextIncomplete = function (after) {   // first session that is not completed and not skipped; no calendar date involved
    for (var d = (after || 0) + 1; d <= C.total; d++) { var s = A.status(d); if (s !== 'completed' && s !== 'skipped') { return d; } }
    return null;
  };
  A.upcoming = function (n) { var out = [], d = A.nextIncomplete(); while (d && out.length < n) { out.push(d); d = A.nextIncomplete(d); } return out; };
  A.inProgressDays = function () { var o = []; for (var d = 1; d <= C.total; d++) { if (A.status(d) === 'in-progress') { o.push(d); } } return o; };
  A.saveSession = function (d, patch) {
    var cur = A.sessionState(d), rec = { day: d, status: cur.status, notes: cur.notes || '', whatDid: cur.whatDid || '', review: cur.review || '', remarks: cur.remarks || '', startedAt: cur.startedAt || null, updatedAt: now() };
    Object.keys(patch).forEach(function (k) { rec[k] = patch[k]; });
    if (rec.status === 'not-started' && !rec.notes && !rec.whatDid && !rec.review && !rec.remarks) {
      delete st.ss[d]; return S.del('sessionState', d);
    }
    st.ss[d] = rec; return S.put('sessionState', rec);
  };
  A.start = function (d) { if (A.isDone(d)) { return Promise.resolve(); } var cur = A.sessionState(d); return A.saveSession(d, { status: 'in-progress', startedAt: cur.startedAt || now() }); };
  A.skip = function (d) { if (A.isDone(d)) { return Promise.resolve(); } return A.saveSession(d, { status: 'skipped' }); };
  A.unskip = function (d) { return A.saveSession(d, { status: 'not-started' }); };
  A.markDone = function (d) {
    if (busy[d]) { return busy[d]; }
    if (st.done[d]) { return Promise.resolve(st.done[d]); }
    var t = new Date(), iso = t.toISOString();
    var rec = { day: d, kind: 'session', completedAt: iso, localDate: U.key(iso), localTime: U.time(iso), reopenedAt: null };
    busy[d] = S.complete(d, rec).then(function (r) { st.done[d] = r; if (!st.completions.some(function (c) { return c.id === r.id; })) { st.completions.push(r); }
      var s = st.ss[d]; if (s && (s.status === 'in-progress' || s.status === 'skipped')) { return A.saveSession(d, { status: 'not-started' }); } })
      .then(function () { delete busy[d]; }, function (e) { delete busy[d]; throw e; });
    return busy[d];
  };
  A.reopen = function (d) {
    var at = now(); return S.reopen(d, at).then(function () {
      st.completions.forEach(function (c) { if (c.day === d && !c.reopenedAt) { c.reopenedAt = at; } }); delete st.done[d]; });
  };
  A.completionsByDate = function () {   // local date key -> active completion records, oldest first
    var m = {}; Object.keys(st.done).forEach(function (d) { var c = st.done[d], k = U.key(c.completedAt); (m[k] = m[k] || []).push(c); });
    Object.keys(m).forEach(function (k) { m[k].sort(function (a, b) { return a.completedAt < b.completedAt ? -1 : 1; }); }); return m;
  };

  // ---- topics (= workbook modules). Own status; progress from linked sessions.
  A.topicState = function (id) { return st.ts[id] || { id: id, status: null, notes: '' }; };
  A.topicStats = function (m) {
    var done = 0, skipped = 0; for (var d = m.startDay; d <= m.endDay; d++) { var s = A.status(d); if (s === 'completed') { done++; } else if (s === 'skipped') { skipped++; } }
    var total = m.endDay - m.startDay + 1; return { total: total, done: done, skipped: skipped, remaining: total - done, percent: U.pct(done, total) };
  };
  // Stored status wins. With none stored, "In Progress" is shown once a linked session is completed; Completed/Needs Revision are only ever set by you.
  A.topicStatus = function (m) { var s = st.ts[m.id]; if (s && s.status) { return s.status; } var linked = false; for (var d = m.startDay; d <= m.endDay; d++) { if (A.status(d) === 'in-progress' || A.status(d) === 'completed') { linked = true; break; } } return linked ? 'in-progress' : 'not-started'; };
  // Counts used by the Progress dashboard.
  A.pendingCount = function () { var n = 0; for (var d = 1; d <= C.total; d++) { var s = A.status(d); if (s !== 'completed' && s !== 'skipped') { n++; } } return n; };
  A.inProgressCount = function () { return A.inProgressDays().length; };
  // Topics (the 294 smaller units inside modules). Progress comes from their own sessions; status is yours, like modules.
  A.conceptStats = function (tp) {
    var done = 0, skipped = 0; tp.days.forEach(function (d) { var s = A.status(d); if (s === 'completed') { done++; } else if (s === 'skipped') { skipped++; } });
    var total = tp.days.length; return { total: total, done: done, skipped: skipped, remaining: total - done, percent: U.pct(done, total) };
  };
  A.conceptStatus = function (tp) { var s = st.ts[tp.id]; if (s && s.status) { return s.status; } var linked = tp.days.some(function(d){ return A.status(d) === 'in-progress' || A.status(d) === 'completed'; }); return linked ? 'in-progress' : 'not-started'; };
  A.conceptsDone = function () { return C.topics.filter(function (t) { return A.conceptStatus(t) === 'completed'; }).length; };
  A.saveTopic = function (id, patch) {
    var cur = A.topicState(id), rec = { id: id, status: cur.status, notes: cur.notes || '', completedAt: cur.completedAt || null, updatedAt: now() };
    Object.keys(patch).forEach(function (k) { rec[k] = patch[k]; });
    var changed = patch.status !== undefined && patch.status !== cur.status;
    if (patch.status === 'completed') { rec.completedAt = now(); } else if (patch.status !== undefined) { rec.completedAt = null; }
    st.ts[id] = rec; var p = S.put('topicState', rec);
    return changed ? p.then(function () { return A.event('topic', id, (C.module(id) || {}).name + ': ' + U.STATUS[patch.status]); }) : p;
  };
  A.topicsDone = function () { return C.modules.filter(function (m) { return A.topicStatus(m) === 'completed'; }).length; };

  // ---- projects: status + versions (milestones) + development history
  A.projectState = function (id) { return st.pr[id] || { id: id, status: 'not-started', notes: '' }; };
  A.milestone = function (vid) { return st.ms[vid] || { id: vid, status: 'not-started', notes: '', completedAt: null }; };
  A.projectStats = function (p) {
    var t = p.versions.length, d = 0, ip = 0; p.versions.forEach(function (v) { var s = A.milestone(v.id).status; if (s === 'completed') { d++; } else if (s === 'in-progress') { ip++; } });
    return { total: t, done: d, inProgress: ip, percent: U.pct(d, t) };
  };
  A.saveProject = function (id, patch) {
    var cur = A.projectState(id), rec = { id: id, status: cur.status, notes: cur.notes || '', updatedAt: now() };
    Object.keys(patch).forEach(function (k) { rec[k] = patch[k]; });
    var changed = patch.status !== undefined && patch.status !== cur.status; st.pr[id] = rec;
    var p = S.put('projectState', rec);
    return changed ? p.then(function () { return A.projectEvent(id, 'status', 'Status set to ' + U.STATUS[patch.status]); }) : p;
  };
  A.saveMilestone = function (p, v, patch) {
    var cur = A.milestone(v.id), rec = { id: v.id, projectId: p.id, status: cur.status, notes: cur.notes || '', completedAt: cur.completedAt || null, updatedAt: now() };
    Object.keys(patch).forEach(function (k) { rec[k] = patch[k]; });
    var changed = patch.status !== undefined && patch.status !== cur.status;
    if (patch.status !== undefined) { rec.completedAt = patch.status === 'completed' ? now() : null; }
    st.ms[v.id] = rec; var pr = S.put('milestoneState', rec);
    if (!changed) { return pr; }
    var label = patch.status === 'completed' ? 'Version completed' : patch.status === 'in-progress' ? 'Version started' : 'Version reset to Not Started';
    return pr.then(function () { return A.projectEvent(p.id, patch.status === 'completed' ? 'version-completed' : 'version-started', label + ': ' + v.name, v.id); });
  };
  A.event = function (kind, refId, label, at) { var rec = { kind: kind, refId: refId, label: label, at: at || now() }; return S.add('events', rec).then(function (r) { st.events.push(r); return r; }); };
  A.projectEvent = function (pid, type, text, refId, at) { var rec = { kind: 'project', type: type, projectId: pid, refId: refId || pid, label: text, at: at || now() }; return S.add('events', rec).then(function (r) { st.events.push(r); return r; }); };
  A.deleteEvent = function (id) { return S.del('events', id).then(function () { st.events = st.events.filter(function (e) { return e.id !== id; }); }); };
  A.projectEvents = function (pid) { return st.events.filter(function (e) { return e.kind === 'project' && e.projectId === pid; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; }); };
  A.projectsStarted = function () { return C.projects.filter(function (p) { return A.projectState(p.id).status !== 'not-started'; }); };
  A.projectsDone = function () { return C.projects.filter(function (p) { var s = A.projectState(p.id).status; return s === 'completed' || s === 'published'; }).length; };
  A.milestoneTotals = function () { var t = 0, d = 0; C.projects.forEach(function (p) { var s = A.projectStats(p); t += s.total; d += s.done; }); return { total: t, done: d, percent: U.pct(d, t) }; };

  // ---- practice questions (workbook Practice Bank). No record = Not Started.
  A.practiceRec = function (id) { return st.pq[id] || { id: id, status: 'not-started', notes: '' }; };
  st.pq = {};
  A.loadPractice = function () { return S.all('practiceState').then(function (r) { st.pq = {}; r.forEach(function (x) { st.pq[x.id] = x; }); }).catch(function () {}); };
  A.savePractice = function (id, patch) {
    var cur = A.practiceRec(id), rec = { id: id, status: cur.status, notes: cur.notes || '', solvedAt: cur.solvedAt || null, updatedAt: now() };
    Object.keys(patch).forEach(function (k) { rec[k] = patch[k]; });
    var changed = patch.status !== undefined && patch.status !== cur.status;
    if (patch.status !== undefined) { rec.solvedAt = patch.status === 'solved' ? now() : null; }
    st.pq[id] = rec; var p = S.put('practiceState', rec);
    if (!changed || patch.status !== 'solved') { return p; }
    var q = C.practice.filter(function (x) { return x.id === id; })[0];
    return p.then(function () { return A.event('practice', id, 'Practice solved: ' + (q ? q.title : id)); });
  };
  A.practiceStats = function () { var t = C.practice.length, s = 0, ip = 0; C.practice.forEach(function (q) { var x = A.practiceRec(q.id).status; if (x === 'solved') { s++; } else if (x === 'in-progress') { ip++; } }); return { total: t, solved: s, inProgress: ip, percent: U.pct(s, t) }; };
  A.ready = A.ready.then(A.loadPractice);

  // ---- recent activity: built from the same records (sessions from completions; the rest from events)
  A.recent = function (n) {
    var items = [];
    Object.keys(st.done).forEach(function (d) { var c = st.done[d]; items.push({ at: c.completedAt, kind: 'session', day: +d, text: C.session(+d).title }); });
    st.events.forEach(function (e) { items.push({ at: e.at, kind: e.kind, text: e.label, projectId: e.projectId, refId: e.refId }); });
    items.sort(function (a, b) { return a.at < b.at ? 1 : -1; }); return items.slice(0, n);
  };
  A.raw = function () { return st; };
  window.State = A;
})();

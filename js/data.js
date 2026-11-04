// Loads the curriculum (generated from the workbook by tools/build_data.py). Day numbers are permanent IDs, not dates.
// Hierarchy: Phase > Module (31) > Topic (294) > Session (Day 1-1,029). Practice questions and projects link to topics and days.
(function () {
  'use strict';
  var C = { ready: null, total: 0, sessions: [], modules: [], topics: [], projects: [], projectTopics: [], practice: [], extras: {}, ladder: null, iconMap: { moduleIcons: {}, topicIcons: {}, fallbackIcon: 'book' } };
  var idx = {};
  function get(url) { return fetch(url).then(function (r) { if (!r.ok) { throw new Error(url + ' (' + r.status + ')'); } return r.json(); }); }
  C.session = function (d) { return C.sessions[d - 1] || null; };
  C.module = function (id) { return idx.mod[id] || null; };
  C.topic = function (id) { return idx.top[id] || null; };
  C.moduleIcon = function (id) { var x = C.iconMap.moduleIcons[id]; return x && x.icon || C.iconMap.fallbackIcon || 'book'; };
  C.topicIcon = function (id) { var x = C.iconMap.topicIcons[id]; return x && x.icon || C.iconMap.fallbackIcon || 'book'; };
  C.project = function (id) { return idx.proj[id] || null; };
  C.question = function (id) { return idx.q[id] || null; };
  C.topicsOf = function (moduleId) { return C.topics.filter(function (t) { return t.moduleId === moduleId; }); };
  C.questionsOfTopic = function (topicId) { return C.practice.filter(function (q) { return q.topicId === topicId; }); };
  C.projectsOfTopic = function (topicId) { var ids = {}; C.projectTopics.forEach(function (r) { if (r.topicId === topicId) { ids[r.projectId] = r; } }); return C.projects.filter(function (p) { return ids[p.id]; }).map(function (p) { return { project: p, link: ids[p.id] }; }); };
  C.topicsOfProject = function (projectId) { return C.projectTopics.filter(function (r) { return r.projectId === projectId; }).map(function (r) { return { topic: C.topic(r.topicId), link: r }; }).filter(function (x) { return x.topic; }); };
  C.groups = function () {   // blocks of 30, computed from the total
    var g = [], n = C.meta.groupSize;
    for (var s = 1; s <= C.total; s += n) { g.push({ index: g.length, from: s, to: Math.min(s + n - 1, C.total) }); }
    return g;
  };
  C.groupOf = function (day) { return Math.floor((day - 1) / C.meta.groupSize); };
  // Topic-end project options (Small / Medium / Major per topic). Large file, loaded only when a topic page needs it.
  C.loadLadder = function () { if (!C.ladder) { C.ladder = get('data/topic-projects.json').then(function (j) { return j.items || []; }).catch(function () { return []; }); } return C.ladder; };
  C.ready = Promise.all([get('data/curriculum.json'), get('data/question-bank.json'), get('data/topic-module-icons.json').catch(function () { return null; })]).then(function (all) {
    var j = all[0], bank = all[1], iconMap = all[2];
    if (iconMap && iconMap.schemaVersion === 1) { C.iconMap = iconMap; }
    C.meta = j.meta; C.sessions = j.sessions; C.modules = j.modules; C.topics = j.topics || []; C.projects = j.projects; C.projectTopics = j.projectTopics || [];
    C.practice = (bank.questions && bank.questions.length ? bank.questions : (j.practice || [])); C.questionBankMeta = bank.meta || {}; C.extras = j.extras || {}; C.total = j.sessions.length;
    idx = { mod: {}, top: {}, proj: {}, q: {} };
    C.modules.forEach(function (m) { idx.mod[m.id] = m; }); C.topics.forEach(function (t) { idx.top[t.id] = t; }); C.projects.forEach(function (p) { idx.proj[p.id] = p; }); C.practice.forEach(function (q) { idx.q[q.id] = q; });
    return C;
  });
  window.Curriculum = C;
})();

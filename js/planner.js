// Plan with ChatGPT: copy one module's contents -> ChatGPT says what to cover -> paste its reply back -> choose sessions per day -> save.
// Routes: #planner (saved plans + module list) and #planner/<moduleId> (plan one module).
// Plans are saved in the existing 'meta' store (key "plan:<moduleId>"), so no database upgrade is needed and backups already include them.
(function () {
  'use strict';
  var C = window.Curriculum, A = window.State, S = window.Store, h = U.h, root = document.getElementById('planner-root');
  var PREFIX = 'plan:', plans = {};

  // ---------- saved plans ----------
  function loadPlans() {
    return S.all('meta').then(function (rows) {
      plans = {}; rows.forEach(function (r) { if (r && typeof r.key === 'string' && r.key.indexOf(PREFIX) === 0 && r.moduleId && Array.isArray(r.days)) { plans[r.moduleId] = r; } });
    }).catch(function () { plans = {}; });
  }
  function savePlan(rec) { rec.key = PREFIX + rec.moduleId; plans[rec.moduleId] = rec; return S.put('meta', rec); }
  function deletePlan(id) { delete plans[id]; return S.del('meta', PREFIX + id); }

  // ---------- small helpers ----------
  function chunk(days, k) { var out = []; for (var i = 0; i < days.length; i += k) { out.push(days.slice(i, i + k)); } return out; }
  function dateLabel(startKey, offset) {
    if (!startKey) { return ''; } var p = startKey.split('-'); if (p.length !== 3) { return ''; }
    return new Date(+p[0], +p[1] - 1, +p[2] + offset).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function pending(days) { return days.filter(function (d) { var s = A.status(d); return s !== 'completed' && s !== 'skipped'; }); }
  function title(d) { var s = C.session(d); return s ? s.title : 'Day ' + d; }
  function copyText(text) {
    function fallback() {
      return new Promise(function (resolve) {
        var ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;left:-9999px;top:0;opacity:0' }); ta.value = text; document.body.appendChild(ta);
        ta.focus(); ta.select(); try { ta.setSelectionRange(0, text.length); } catch (e) {}
        var ok = false; try { ok = document.execCommand('copy'); } catch (e2) {} ta.remove(); resolve(ok);
      });
    }
    if (navigator.clipboard && navigator.clipboard.writeText) { return navigator.clipboard.writeText(text).then(function () { return true; }, fallback); }
    return fallback();
  }
  function checkbox(label, on, onChange) {
    var i = h('input', { type: 'checkbox' }); i.checked = !!on; i.addEventListener('change', function () { onChange(i.checked); });
    return h('label', { class: 'pl-check' }, i, h('span', { text: label }));
  }

  // ---------- 1. the text copied to ChatGPT ----------
  function buildText(m, opt) {
    var L = [], first = m.startDay, ex = '[' + first + ',' + (first + 1) + ',' + (first + 2) + ']';
    L.push('You are my study planner. I am a GTU CSE student following a day-numbered learning roadmap. Below is ONE module, session by session. Every session has a permanent "Day" number.');
    L.push('');
    L.push('What I need from you:');
    L.push('1. Read the whole module.');
    L.push('2. Tell me what to cover: which sessions are essential, which can be merged or shortened, and which I can safely skip. Give a short reason. Do not invent sessions, topics or links.');
    L.push('3. Finish with ONE JSON block in exactly this shape. Use only Day numbers from the list below, in ascending order, and leave out sessions marked DONE:');
    L.push('```json');
    L.push('{"module":"' + m.id + '","cover":' + ex + ',"skip":[],"suggestedPerDay":2,"reason":"one or two sentences"}');
    L.push('```');
    L.push('I will choose how many sessions to do per day myself, so "suggestedPerDay" is only your advice.');
    L.push('');
    L.push('=== MODULE ===');
    L.push('Module: ' + m.id + ' - ' + m.name);
    if (m.phase) { L.push('Phase: ' + m.phase + (m.semester ? ' | Semester target: ' + m.semester : '')); }
    if (m.domain) { L.push('Domain: ' + m.domain); }
    if (m.outcome) { L.push('Outcome: ' + m.outcome); }
    if (m.resource) { L.push('Free resource: ' + m.resource); }
    var total = m.endDay - m.startDay + 1, done = 0; for (var d = m.startDay; d <= m.endDay; d++) { if (A.status(d) === 'completed') { done++; } }
    L.push('Sessions: ' + total + ' (Day ' + m.startDay + ' to Day ' + m.endDay + '). Already done: ' + done + '.');
    var topics = C.topicsOf(m.id);
    if (topics.length) { L.push('Topics:'); topics.forEach(function (t) { L.push('- ' + t.name + ' (Day ' + t.firstDay + (t.lastDay !== t.firstDay ? '-' + t.lastDay : '') + ')'); }); }
    L.push('');
    L.push('=== SESSIONS ===');
    for (d = m.startDay; d <= m.endDay; d++) {
      var s = C.session(d); if (!s) { continue; }
      L.push('--- Day ' + d + ' (session ' + s.moduleDay + ' of ' + s.moduleTotal + ')' + (A.status(d) === 'completed' ? ' [DONE]' : '') + ' ---');
      L.push('Title: ' + s.title);
      if (s.topic) { L.push('Topic: ' + s.topic); }
      if (s.time) { L.push('Suggested time: ' + s.time); }
      if (opt.task && s.task) { L.push('Task: ' + s.task); }
      if (opt.practice && s.practice) { L.push('Practice: ' + s.practice); }
    }
    return L.join('\n');
  }

  // ---------- 2. reading ChatGPT's reply ----------
  function expand(v, out) {
    if (typeof v === 'number') { out.push(v); return; }
    if (typeof v !== 'string') { return; }
    var re = /(\d+)\s*(?:[-\u2013\u2014]|to)\s*(\d+)|(\d+)/g, mt, i;
    while ((mt = re.exec(v))) {
      if (mt[3]) { out.push(+mt[3]); }
      else { var a = +mt[1], b = +mt[2]; if (b >= a && b - a <= 400) { for (i = a; i <= b; i++) { out.push(i); } } }
    }
  }
  function toDays(v) { var out = []; if (Array.isArray(v)) { v.forEach(function (x) { expand(x, out); }); } else { expand(v, out); } return out; }
  function jsonCandidates(text) {
    var out = [], start, i, depth, inStr, esc, c;
    for (start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
      depth = 0; inStr = false; esc = false;
      for (i = start; i < text.length; i++) {
        c = text.charAt(i);
        if (inStr) { if (esc) { esc = false; } else if (c === '\\') { esc = true; } else if (c === '"') { inStr = false; } }
        else if (c === '"') { inStr = true; } else if (c === '{') { depth++; }
        else if (c === '}') { depth--; if (depth === 0) { out.push(text.slice(start, i + 1)); break; } }
      }
    }
    return out;
  }
  function pick(o, names) { for (var i = 0; i < names.length; i++) { if (o[names[i]] !== undefined) { return o[names[i]]; } } return undefined; }
  function parseReply(raw, m) {
    var text = String(raw || '').replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'"), res = { cover: [], skip: [], reason: '', suggested: null, fromJson: false, ignored: 0 }, found = null;
    jsonCandidates(text).forEach(function (c) {
      var o; try { o = JSON.parse(c); } catch (e) { return; }
      if (o && typeof o === 'object' && pick(o, ['cover', 'days', 'sessions', 'include', 'study']) !== undefined) { found = o; }
    });
    var all;
    if (found) {
      res.fromJson = true; all = toDays(pick(found, ['cover', 'days', 'sessions', 'include', 'study']));
      res.skip = toDays(pick(found, ['skip', 'skipped', 'exclude']) || []);
      res.reason = String(found.reason || found.summary || found.why || '').slice(0, 600);
      var sp = parseInt(pick(found, ['suggestedPerDay', 'perDay', 'sessionsPerDay']), 10); if (sp >= 1 && sp <= 12) { res.suggested = sp; }
    } else {
      all = []; var re = /\bdays?\s*((?:\d+(?:\s*[-\u2013\u2014]\s*\d+)?(?:\s*(?:,|&|and)\s*)?)+)/gi, mt;
      while ((mt = re.exec(text))) { expand(mt[1], all); }
      if (!all.length && /^[\d\s,\u2013\u2014\-]+$/.test(text.trim())) { expand(text, all); }
    }
    var seen = {}; res.cover = all.filter(function (d) { var ok = d >= m.startDay && d <= m.endDay && !seen[d]; if (d < m.startDay || d > m.endDay) { res.ignored++; } if (ok) { seen[d] = true; } return ok; }).sort(function (a, b) { return a - b; });
    res.skip = res.skip.filter(function (d) { return d >= m.startDay && d <= m.endDay; });
    return res;
  }

  // ---------- one module ----------
  function moduleView(m) {
    var existing = plans[m.id] || null, total = m.endDay - m.startDay + 1;
    var P = { sel: {}, perDay: existing ? existing.perDay : 2, start: (existing && existing.startDate) || U.todayKey(), reason: (existing && existing.reason) || '', suggested: (existing && existing.suggestedPerDay) || null, shown: !!existing };
    if (existing) { existing.days.forEach(function (d) { P.sel[d] = true; }); }
    function chosen() { var o = []; for (var d = m.startDay; d <= m.endDay; d++) { if (P.sel[d]) { o.push(d); } } return o; }
    var w = h('div', { class: 'pl' });
    w.appendChild(h('a', { class: 'pl-back', href: '#planner', text: '← All modules' }));
    w.appendChild(h('h2', { class: 'screen-h', text: U.shortModule(m) }));
    w.appendChild(h('p', { class: 'muted small', text: m.name + ' · ' + total + ' sessions (Day ' + m.startDay + '–' + m.endDay + ')' }));

    // Step 1
    var opt = { task: true, practice: false }, sizeEl = h('p', { class: 'muted small' }), msg1 = h('p', { class: 'muted small', role: 'status' });
    function text() { return buildText(m, opt); }
    function size() { var n = text().length; sizeEl.textContent = U.num(n) + ' characters (about ' + U.num(Math.round(n / 4)) + ' tokens)' + (n > 120000 ? ' · very long, so turn off practice text' : ''); }
    var prev = h('textarea', { class: 'notes', rows: 8, readonly: 'readonly', 'aria-label': 'Text that will be copied' }), det = h('details', { class: 'pl-det' }, h('summary', { text: 'Show the text' }), prev);
    det.addEventListener('toggle', function () { if (det.open) { prev.value = text(); } });
    var copyBtn = h('button', { type: 'button', class: 'btn primary', text: 'Copy for ChatGPT', onclick: function () {
      var t = text(); copyText(t).then(function (ok) { msg1.className = ok ? 'muted small' : 'err small'; msg1.textContent = ok ? 'Copied. Open ChatGPT, paste it in a new chat and send it.' : 'Copy was blocked. Tap “Show the text”, select all and copy it by hand.'; if (!ok) { det.open = true; prev.value = t; } });
    } });
    w.appendChild(h('section', { class: 'card' }, h('h3', { text: '1 · Copy this module for ChatGPT' }),
      h('p', { class: 'muted small', text: 'It copies every session of this module plus instructions. ChatGPT will tell you what to cover.' }),
      checkbox('Include each session’s task text', true, function (v) { opt.task = v; size(); }),
      checkbox('Include practice questions (much longer)', false, function (v) { opt.practice = v; size(); }),
      sizeEl, h('div', { class: 'btnrow' }, copyBtn, h('a', { class: 'btn ghost', href: 'https://chatgpt.com/', target: '_blank', rel: 'noopener', text: 'Open ChatGPT' })), msg1, det));
    size();

    // Step 2
    var ta = h('textarea', { class: 'notes', rows: 6, placeholder: 'Paste ChatGPT’s whole reply here…', 'aria-label': 'ChatGPT reply' }), msg2 = h('div', { class: 'pl-msg', role: 'status' }), listBox = h('div', { class: 'pl-list-box' });
    function say(t, bad) { msg2.replaceChildren(); if (t) { msg2.appendChild(h('p', { class: bad ? 'err small' : 'muted small', text: t })); } }
    function read() {
      var r = parseReply(ta.value, m);
      if (!ta.value.trim()) { say('Paste ChatGPT’s reply first.', true); return; }
      if (!r.cover.length) { say('I could not find any Day numbers from this module in that text. Ask ChatGPT to finish with the JSON block, or use “Use all remaining sessions”.', true); return; }
      P.sel = {}; r.cover.forEach(function (d) { P.sel[d] = true; }); P.reason = r.reason; P.suggested = r.suggested; P.shown = true;
      if (r.suggested) { P.perDay = Math.min(r.suggested, r.cover.length); }
      var note = r.fromJson ? 'Read ' + r.cover.length + ' sessions from ChatGPT’s JSON.' : 'No JSON block found, so I picked up Day numbers from the text. Check the list below carefully.';
      if (r.ignored) { note += ' ' + r.ignored + (r.ignored === 1 ? ' number' : ' numbers') + ' outside this module ' + (r.ignored === 1 ? 'was' : 'were') + ' ignored.'; }
      say(note, !r.fromJson); paintAll();
    }
    var pasteBtn = h('button', { type: 'button', class: 'btn ghost', text: 'Paste', onclick: function () {
      if (navigator.clipboard && navigator.clipboard.readText) { navigator.clipboard.readText().then(function (t) { ta.value = t; read(); }, function () { say('Paste was blocked. Touch and hold in the box and choose Paste.', true); }); }
      else { say('Touch and hold in the box and choose Paste.', true); }
    } });
    var allBtn = h('button', { type: 'button', class: 'btn ghost', text: 'Use all remaining sessions', onclick: function () {
      P.sel = {}; for (var d = m.startDay; d <= m.endDay; d++) { if (!A.isDone(d)) { P.sel[d] = true; } } P.reason = ''; P.suggested = null; P.shown = true; P.perDay = Math.min(P.perDay, Math.max(1, chosen().length)); say('Using every session you have not finished.'); paintAll();
    } });
    w.appendChild(h('section', { class: 'card' }, h('h3', { text: '2 · Paste ChatGPT’s reply' }),
      h('p', { class: 'muted small', text: 'Copy the whole reply from ChatGPT and paste it here. The Day numbers it picked get ticked below.' }), ta,
      h('div', { class: 'btnrow' }, pasteBtn, h('button', { type: 'button', class: 'btn primary', text: 'Read reply', onclick: read }), allBtn), msg2, listBox));

    // Step 3
    var perNum = h('strong', { class: 'pl-num', 'aria-live': 'polite' }), minus = h('button', { type: 'button', class: 'circ-btn', 'aria-label': 'Fewer sessions per day', text: '−' }), plus = h('button', { type: 'button', class: 'circ-btn', 'aria-label': 'More sessions per day', text: '+' });
    var info = h('p', { class: 'muted' }), sugg = h('div'), startIn = h('input', { type: 'date', class: 'sel', 'aria-label': 'Start date' }), sched = h('div', { class: 'pl-sched' }), saveMsg = h('p', { class: 'muted small', role: 'status' });
    var saveBtn = h('button', { type: 'button', class: 'btn primary', text: existing ? 'Update saved plan' : 'Save plan' });
    startIn.value = P.start;
    startIn.addEventListener('change', function () { P.start = startIn.value; paintPlan(); });
    function setPer(n) { var max = Math.max(1, chosen().length); P.perDay = Math.max(1, Math.min(max, Math.min(12, n))); paintPlan(); }
    minus.addEventListener('click', function () { setPer(P.perDay - 1); }); plus.addEventListener('click', function () { setPer(P.perDay + 1); });
    saveBtn.addEventListener('click', function () {
      var days = chosen(); if (!days.length) { return; }
      var now = new Date().toISOString();
      savePlan({ moduleId: m.id, days: days, perDay: P.perDay, startDate: P.start || '', reason: P.reason || '', suggestedPerDay: P.suggested || null, savedAt: (existing && existing.savedAt) || now, updatedAt: now })
        .then(function () { existing = plans[m.id]; saveBtn.textContent = 'Update saved plan'; saveMsg.className = 'muted small'; saveMsg.replaceChildren('Saved ✓  ', h('a', { href: '#planner', text: 'See saved plans' })); },
          function (e) { saveMsg.className = 'err small'; saveMsg.textContent = 'Could not save: ' + ((e && e.message) || e); });
    });
    var step3 = h('section', { class: 'card', hidden: 'hidden' }, h('h3', { text: '3 · How many sessions per day?' }), sugg,
      h('div', { class: 'pl-stepper' }, minus, h('span', { class: 'pl-per' }, perNum, h('small', { text: 'per day' })), plus), info,
      h('label', { class: 'pl-date' }, h('span', { class: 'set-label', text: 'Start date (optional)' }), startIn), sched, h('div', { class: 'btnrow' }, saveBtn), saveMsg);
    w.appendChild(step3);

    function paintPlan() {
      var days = chosen(), n = days.length; step3.hidden = !n; if (!n) { return; }
      P.perDay = Math.max(1, Math.min(P.perDay, n)); perNum.textContent = String(P.perDay); minus.disabled = P.perDay <= 1; plus.disabled = P.perDay >= Math.min(12, n);
      var groups = chunk(days, P.perDay), last = groups.length - 1;
      info.textContent = n + ' sessions at ' + P.perDay + ' per day = ' + groups.length + ' study day' + (groups.length === 1 ? '' : 's') + (P.start ? ' · ' + dateLabel(P.start, 0) + ' → ' + dateLabel(P.start, last) : '');
      sugg.replaceChildren();
      if (P.suggested) { sugg.appendChild(h('button', { type: 'button', class: 'pl-chip', text: 'ChatGPT suggested ' + P.suggested + ' per day — use it', onclick: function () { setPer(P.suggested); } })); }
      sched.replaceChildren(h('details', { class: 'pl-det' }, h('summary', { text: 'Day-by-day plan' }), groups.map(function (g, i) {
        return h('div', { class: 'pl-day' }, h('strong', { text: 'Study day ' + (i + 1) + (P.start ? ' · ' + dateLabel(P.start, i) : '') }), g.map(function (d) { return h('span', { class: 'small', text: 'Day ' + d + ' — ' + title(d) }); }));
      })));
      saveMsg.replaceChildren();
    }
    function paintList() {
      listBox.replaceChildren(); if (!P.shown) { return; }
      var count = h('p', { class: 'pl-count', role: 'status' });
      function paintCount() { count.textContent = 'Covering ' + chosen().length + ' of ' + total + ' sessions'; }
      var tools = h('div', { class: 'pl-tools' },
        h('button', { type: 'button', class: 'pl-chip', text: 'All', onclick: function () { for (var d = m.startDay; d <= m.endDay; d++) { P.sel[d] = true; } paintAll(); } }),
        h('button', { type: 'button', class: 'pl-chip', text: 'None', onclick: function () { P.sel = {}; paintAll(); } }),
        h('button', { type: 'button', class: 'pl-chip', text: 'Not done only', onclick: function () { P.sel = {}; for (var d = m.startDay; d <= m.endDay; d++) { if (!A.isDone(d)) { P.sel[d] = true; } } paintAll(); } }));
      var list = h('div', { class: 'pl-list', role: 'list' });
      function row(d) {
        var s = C.session(d), cb = h('input', { type: 'checkbox' }); cb.checked = !!P.sel[d];
        var r = h('label', { class: 'pl-row' + (cb.checked ? ' is-on' : ''), role: 'listitem' }, cb, h('span', { class: 'pl-row-main' }, h('strong', { text: title(d) }), h('span', { class: 'muted small', text: 'Day ' + d + (s && s.time ? ' · ' + s.time : '') + (A.isDone(d) ? ' · done' : '') })));
        cb.addEventListener('change', function () { if (cb.checked) { P.sel[d] = true; } else { delete P.sel[d]; } r.classList.toggle('is-on', cb.checked); paintCount(); paintPlan(); });
        return r;
      }
      for (var d = m.startDay; d <= m.endDay; d++) { list.appendChild(row(d)); }
      listBox.appendChild(h('h4', { class: 'pl-sub', text: 'What to cover' }));
      if (P.reason) { listBox.appendChild(h('p', { class: 'pl-reason' }, h('strong', { text: 'ChatGPT’s reason: ' }), P.reason)); }
      listBox.appendChild(count); listBox.appendChild(tools); listBox.appendChild(list); paintCount();
    }
    function paintAll() { paintList(); paintPlan(); }
    paintAll();
    return w;
  }

  // ---------- list: saved plans + module picker ----------
  function planCard(p) {
    var m = C.module(p.moduleId); if (!m) { return null; }
    var done = p.days.filter(function (d) { return A.isDone(d); }).length, pend = pending(p.days), n = p.days.length, per = p.perDay || 1, groups = Math.ceil(n / per), pct = U.pct(done, n);
    var card = h('section', { class: 'card plan-card' }, h('h3', { text: U.shortModule(m) }),
      h('p', { class: 'muted small', text: n + ' sessions · ' + per + ' per day · ' + groups + ' study days' + (p.startDate ? ' · from ' + dateLabel(p.startDate, 0) : '') }),
      U.bar(pct), h('p', { class: 'small', text: done + ' of ' + n + ' done (' + pct + '%)' }));
    if (pend.length) {
      card.appendChild(h('p', { class: 'pl-sub', text: 'Next up (' + Math.min(per, pend.length) + ')' }));
      pend.slice(0, per).forEach(function (d) { card.appendChild(h('a', { class: 'pl-next', href: '#today/' + d }, h('strong', { text: title(d) }), h('span', { class: 'muted small', text: 'Day ' + d + ' · open session' }))); });
    } else { card.appendChild(h('p', { class: 'done-line', text: 'Every session in this plan is finished.' })); }
    if (p.reason) { card.appendChild(h('p', { class: 'muted small', text: 'ChatGPT: ' + p.reason })); }
    card.appendChild(h('div', { class: 'btnrow' }, h('a', { class: 'btn ghost', href: '#planner/' + p.moduleId, text: 'Edit plan' }),
      h('button', { type: 'button', class: 'btn ghost', text: 'Delete', onclick: function () { if (confirm('Delete the saved plan for ' + m.name + '? Your session progress is not touched.')) { deletePlan(p.moduleId).then(function () { render(true); }); } } })));
    return card;
  }
  function listView() {
    var w = h('div', { class: 'pl' });
    w.appendChild(h('h2', { class: 'screen-h', text: 'Plan with ChatGPT' }));
    w.appendChild(h('ol', { class: 'pl-steps' }, h('li', { text: 'Pick a module and copy it.' }), h('li', { text: 'Paste it in ChatGPT; it tells you what to cover.' }), h('li', { text: 'Paste its reply back here.' }), h('li', { text: 'Choose sessions per day and save.' })));
    var saved = C.modules.map(function (m) { return plans[m.id]; }).filter(Boolean);
    w.appendChild(h('h3', { class: 'ph', text: 'Saved plans' }));
    if (!saved.length) { w.appendChild(h('p', { class: 'muted small', text: 'No plans yet. Pick a module below.' })); }
    saved.forEach(function (p) { var c = planCard(p); if (c) { w.appendChild(c); } });
    w.appendChild(h('h3', { class: 'ph', text: 'Choose a module' }));
    C.modules.forEach(function (m) {
      var st = A.topicStats(m);
      w.appendChild(h('a', { class: 'pl-mod', href: '#planner/' + m.id }, h('span', { class: 'pl-mod-main' }, h('strong', { text: U.shortModule(m) }), h('span', { class: 'muted small', text: st.total + ' sessions · ' + st.done + ' done' })), plans[m.id] ? h('span', { class: 'pl-badge', text: 'Plan saved' }) : h('span', { class: 'pc-go', 'aria-hidden': 'true', text: '›' })));
    });
    return w;
  }

  function render(keepScroll) {
    var r = U.route('planner'); if (r === null) { return; }
    var m = r[0] ? C.module(r[0]) : null;
    root.replaceChildren(m ? moduleView(m) : listView());
    if (keepScroll !== true) { var main = document.getElementById('main'); if (main) { main.scrollTop = 0; } }
  }
  function onData() { var r = U.route('planner'); if (r !== null && !r[0]) { render(true); } }   // only the list refreshes when progress changes; the editor never loses what you typed
  Promise.all([C.ready, A.ready]).then(loadPlans).then(function () { render(); window.addEventListener('hashchange', function () { loadPlans().then(function () { render(); }); }); window.addEventListener('cur-changed', onData); })
    .catch(function (e) { root.textContent = 'Could not load: ' + e.message; });
})();

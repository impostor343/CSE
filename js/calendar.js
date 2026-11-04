// Month calendar in a Google Calendar style: rows and columns, one coloured
// chip per day. Tap a date for a preview and your notes. Original dates never change.

(function () {
  'use strict';

  var D = window.RoadmapData;
  var S = window.RoadmapStore;
  var ST = window.RoadmapStatus;
  var MARKS = { done: ['✓', 'done'], skipped: ['→', 'skipped'], caughtup: ['↻', 'caught up'] };
  var root = document.getElementById('calendar');
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEK = [['S', 'Sunday'], ['M', 'Monday'], ['T', 'Tuesday'], ['W', 'Wednesday'],
              ['T', 'Thursday'], ['F', 'Friday'], ['S', 'Saturday']];
  var LEGEND_ORDER = ['guessing-game', 'banking', 'smart-library', 'inventory', 'task-api', 'semester-planner'];
  var CHEVRON_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
  var CHEVRON_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';

  var byDate = {};
  var noted = {};          // calendar date -> true when that date has saved notes
  var cells = {};          // date -> { btn, mark } for the month on screen
  var firstKey, lastKey, viewKey, selected;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  }

  function shiftMonth(key, step) {
    var y = Number(key.slice(0, 4));
    var m = Number(key.slice(5, 7)) - 1 + step;
    y += Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    return y + '-' + D.two(m + 1);
  }

  function iconButton(svg, label, disabled, onClick) {
    var b = el('button', 'icon-btn');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.innerHTML = svg;          // fixed icon markup only, no user data
    b.disabled = disabled;
    b.addEventListener('click', onClick);
    return b;
  }

  function labelFor(e, isToday, isSelected) {
    return D.formatDate(e.date) + ', ' + D.titleOf(e) + (noted[e.date] ? ', has notes' : '') +
      (ST.isLearning(e) && MARKS[ST.state(e.day)] ? ', ' + MARKS[ST.state(e.day)][1] : '') +
      (isToday ? ', today' : '') + (isSelected ? ', selected' : '');
  }

  function refreshCell(date) {
    var c = cells[date];
    if (!c) { return; }
    c.mark.hidden = !noted[date];
    c.btn.setAttribute('aria-label', labelFor(byDate[date], date === D.todayIso(), date === selected));
  }

  function draw() {
    window.DayNotes.flush();
    var year = Number(viewKey.slice(0, 4));
    var month = Number(viewKey.slice(5, 7)) - 1;
    var today = D.todayIso();
    cells = {};
    root.textContent = '';

    var head = el('div', 'cal-head');
    head.appendChild(el('h2', '', MONTHS[month] + ' ' + year));
    var arrows = el('div', 'cal-arrows');
    arrows.appendChild(iconButton(CHEVRON_L, 'Previous month', viewKey === firstKey, function () { viewKey = shiftMonth(viewKey, -1); draw(); }));
    arrows.appendChild(iconButton(CHEVRON_R, 'Next month', viewKey === lastKey, function () { viewKey = shiftMonth(viewKey, 1); draw(); }));
    head.appendChild(arrows);
    root.appendChild(head);

    // Learning-plan header: a compact week strip and a real progress summary.
    root.appendChild(makeWeekStrip(selected));
    root.appendChild(makeProgressBanner());

    var week = el('div', 'cal-week');
    WEEK.forEach(function (w) {
      var s = el('span', '', w[0]);
      s.setAttribute('aria-label', w[1]);
      week.appendChild(s);
    });
    root.appendChild(week);

    var grid = el('div', 'cal-grid');
    var offset = new Date(year, month, 1).getDay();
    var count = new Date(year, month + 1, 0).getDate();
    var total = Math.ceil((offset + count) / 7) * 7;
    for (var i = 0; i < total; i++) {
      var dayNum = i - offset + 1;
      var inMonth = dayNum >= 1 && dayNum <= count;
      var dt = new Date(year, month, dayNum);
      var iso = dt.getFullYear() + '-' + D.two(dt.getMonth() + 1) + '-' + D.two(dt.getDate());
      var e = inMonth ? byDate[iso] : null;
      if (!e) {
        var other = el('div', 'cell other');
        other.appendChild(el('span', 'cell-num', String(dt.getDate())));
        grid.appendChild(other);
        continue;
      }
      grid.appendChild(makeCell(e, dt.getDate(), iso === today, iso === selected));
    }
    root.appendChild(grid);

    var entry = byDate[selected];
    if (entry) {
      root.appendChild(makePreview(entry, selected === today));
      var host = el('div');
      root.appendChild(host);
      window.DayNotes.mount(host, entry, 'cal', function (en, has) {
        noted[en.date] = has;
        refreshCell(en.date);
      });
    }
    root.appendChild(makeLegend());
  }


  function makeWeekStrip(activeDate) {
    var wrap = el('section', 'plan-week-wrap');
    var d = new Date(activeDate + 'T12:00:00');
    var start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    var end = new Date(start);
    end.setDate(start.getDate() + 6);
    var monthLabel = MONTHS[start.getMonth()] + (start.getMonth() === end.getMonth() ? '' : ' – ' + MONTHS[end.getMonth()]);
    wrap.appendChild(el('div', 'plan-week-heading', monthLabel + ' ' + start.getFullYear()));
    var row = el('div', 'plan-week-strip');
    var names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for (var i = 0; i < 7; i++) {
      var day = new Date(start);
      day.setDate(start.getDate() + i);
      var iso = day.getFullYear() + '-' + D.two(day.getMonth()+1) + '-' + D.two(day.getDate());
      var entry = byDate[iso];
      var b = el('button', 'plan-date' + (iso === activeDate ? ' is-active' : '') + (iso === D.todayIso() ? ' is-today' : ''));
      b.type = 'button';
      b.setAttribute('aria-label', names[i] + ' ' + day.getDate() + (entry ? ', ' + D.titleOf(entry) : ', no scheduled session'));
      b.appendChild(el('span', 'plan-date-name', names[i]));
      b.appendChild(el('strong', 'plan-date-number', String(day.getDate())));
      var dot = el('span', 'plan-date-dot');
      if (entry && ST.isLearning(entry)) {
        var state = ST.state(entry.day);
        dot.className += state === 'done' ? ' is-done' : (state === 'skipped' ? ' is-skipped' : ' is-pending');
      } else {
        dot.className += ' is-empty';
      }
      b.appendChild(dot);
      b.disabled = !entry;
      b.addEventListener('click', (function(key) { return function() {
        if (byDate[key]) { selected = key; viewKey = key.slice(0,7); draw(); }
      }; })(iso));
      row.appendChild(b);
    }
    wrap.appendChild(row);
    return wrap;
  }

  function makeProgressBanner() {
    var wrap = el('section', 'plan-progress-banner');
    var total = 0, done = 0, skipped = 0;
    D.entries.forEach(function(e) {
      if (ST.isLearning(e)) {
        total++;
        var state = ST.state(e.day);
        if (state === 'done') done++;
        if (state === 'skipped') skipped++;
      }
    });
    var pct = total ? Math.round(done * 100 / total) : 0;
    var ring = el('div', 'plan-progress-ring', pct + '%');
    ring.style.setProperty('--plan-progress', pct + '%');
    var copy = el('div', 'plan-progress-copy');
    copy.appendChild(el('strong', '', 'Your learning progress'));
    copy.appendChild(el('span', '', done + ' completed · ' + Math.max(0,total-done-skipped) + ' remaining'));
    wrap.appendChild(ring);
    wrap.appendChild(copy);
    return wrap;
  }

  function makeCell(e, d, isToday, isSelected) {
    var b = el('button', 'cell' + (isSelected ? ' selected' : ''));
    b.type = 'button';
    if (isSelected) { b.setAttribute('aria-pressed', 'true'); }
    b.appendChild(el('span', 'cell-num' + (isToday ? ' today' : ''), String(d)));
    var chip = el('span', 'chip', e.symbol + ' ' + D.plainTitle(e));
    chip.style.background = e.projectKey ? 'var(--proj-' + e.projectKey + ')' : 'var(--chip-plain)';
    b.appendChild(chip);
    var stt = ST.isLearning(e) ? ST.state(e.day) : 'pending';
    if (MARKS[stt]) {
      var sm = el('span', 'cell-status', MARKS[stt][0]);
      sm.setAttribute('aria-hidden', 'true');
      b.appendChild(sm);
      if (stt !== 'skipped') { b.classList.add('is-done'); }
    }
    var mark = el('span', 'cell-note', '✎');
    mark.setAttribute('aria-hidden', 'true');
    mark.hidden = !noted[e.date];
    b.appendChild(mark);
    b.setAttribute('aria-label', labelFor(e, isToday, isSelected));
    b.addEventListener('click', function () { selected = e.date; draw(); });
    cells[e.date] = { btn: b, mark: mark };
    return b;
  }

  function line(parent, label, value) {
    if (!value) { return; }
    var p = el('p');
    p.appendChild(el('b', '', label + ': '));
    p.appendChild(document.createTextNode(value));
    parent.appendChild(p);
  }

  function makePreview(e, isToday) {
    var box = el('section', 'preview plan-selected-card');
    box.setAttribute('aria-label', 'Selected day');
    box.appendChild(el('p', 'card-meta', D.formatDate(e.date) + (isToday ? ' (today)' : '')));
    box.appendChild(el('h3', 'preview-title', e.symbol + ' ' + D.titleOf(e)));
    line(box, 'Day', e.seq + ' of ' + D.entries.length + ', ' + e.group);
    line(box, 'Project', e.projectKey ? D.projectNames[e.projectKey] : null);
    line(box, 'Time', e.time);
    line(box, 'Topics', e.topics);
    var open = el('button', 'btn primary', 'Open card');
    open.type = 'button';
    open.addEventListener('click', function () {
      window.DayNotes.flush();
      if (window.TodayView) { window.TodayView.showDay(e.day); }
      window.location.hash = '#today';
    });
    box.appendChild(open);
    return box;
  }

  function makeLegend() {
    var present = {};
    D.entries.forEach(function (e) { if (e.projectKey) { present[e.projectKey] = true; } });
    var wrap = el('section', 'legend');
    wrap.appendChild(el('p', 'legend-title', 'Project days'));
    var list = el('ul', 'swatches');
    list.setAttribute('aria-label', 'Project colours');
    LEGEND_ORDER.forEach(function (k) {
      if (!present[k]) { return; }
      var li = el('li');
      li.appendChild(el('span', 'swatch sw-' + k));
      li.appendChild(document.createTextNode(D.projectNames[k]));
      list.appendChild(li);
    });
    wrap.appendChild(list);
    wrap.appendChild(el('p', 'note', 'Plain days are learning or revision days. ✎ marks a day with notes.'));
    return wrap;
  }

  function loadNoted() {
    return S.allNotes().then(function (all) {
      noted = {};
      all.forEach(function (n) { noted[n.date] = true; });
    }).catch(function () { noted = {}; });
  }

  D.ready.then(function () {
    D.entries.forEach(function (e) { byDate[e.date] = e; });
    firstKey = D.entries[0].date.slice(0, 7);
    lastKey = D.entries[D.entries.length - 1].date.slice(0, 7);
    var today = D.todayIso();
    selected = byDate[today] ? today : (today < D.entries[0].date ? D.entries[0].date : D.entries[D.entries.length - 1].date);
    viewKey = selected.slice(0, 7);
    return Promise.all([loadNoted(), ST.ready]).then(draw);
  }).catch(function (err) {
    root.textContent = '';
    root.appendChild(el('p', 'empty', 'Could not load the calendar: ' + err.message));
  });

  // Notes may have been edited on the Today tab; refresh the markers when coming back.
  window.addEventListener('hashchange', function () {
    if (window.location.hash === '#calendar' && firstKey) { Promise.all([loadNoted(), ST.load()]).then(draw); }
  });
})();

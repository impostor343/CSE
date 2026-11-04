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
    var box = el('section', 'preview');
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

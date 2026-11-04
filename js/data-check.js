// Temporary data-check page: reads the actual project data files.
(function () {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function load(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) { throw new Error(path + ' could not be loaded (' + r.status + ')'); }
      return r.json();
    });
  }

  function parseDate(iso) {
    var p = iso.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function pad2(value) {
    return String(value).length < 2 ? '0' + value : String(value);
  }

  function displayTitle(entry, titleMap) {
    var override = titleMap[String(entry.day)];
    if (!override || !override.title) { return entry.title || '(untitled)'; }
    return override.title + (override.showNumber ? ' ' + pad2(entry.topicDay || 1) : '');
  }

  Promise.all([
    load('data/roadmap.json'),
    load('data/questions.json'),
    load('data/projects.json'),
    load('data/resources.json'),
    load('data/display-titles.json')
  ]).then(function (res) {
    var entries = res[0].entries;
    var questions = res[1].questions;
    var projects = res[2].projects;
    var resources = res[3].resources;
    var titleMap = res[4];

    if (!Array.isArray(entries) || !Array.isArray(questions) ||
        !Array.isArray(projects) || !Array.isArray(resources) ||
        !titleMap || typeof titleMap !== 'object' || Array.isArray(titleMap)) {
      throw new Error('One or more data files have an unexpected structure.');
    }

    var assigned = questions.filter(function (q) {
      return q.status === 'Assigned (suggested)';
    }).length;
    var versions = projects.reduce(function (n, p) {
      return n + (Array.isArray(p.versions) ? p.versions.length : 0);
    }, 0);
    var titleCount = Object.keys(titleMap).length;
    var counts = document.getElementById('counts');
    counts.textContent = '';

    [
      'Roadmap entries: ' + entries.length + ' (' +
        (entries[0] ? entries[0].date : 'no start date') + ' to ' +
        (entries.length ? entries[entries.length - 1].date : 'no end date') + ')',
      'Questions: ' + questions.length + ' (' + assigned + ' assigned, ' +
        (questions.length - assigned) + ' not assigned)',
      'Projects: ' + projects.length + ' with ' + versions + ' versions',
      'Resources: ' + resources.length,
      'Display-title entries: ' + titleCount + ' (loaded from data/display-titles.json)'
    ].forEach(function (t) {
      var p = document.createElement('p');
      p.textContent = t;
      counts.appendChild(p);
    });

    var monthSel = document.getElementById('month');
    var seen = {};
    var all = document.createElement('option');
    all.value = '';
    all.textContent = 'All months';
    monthSel.appendChild(all);

    entries.forEach(function (e) {
      if (!e.date) { return; }
      var key = e.date.slice(0, 7);
      if (!seen[key]) {
        seen[key] = true;
        var o = document.createElement('option');
        o.value = key;
        var d = parseDate(e.date);
        o.textContent = MONTHS[d.getMonth()] + ' ' + d.getFullYear();
        monthSel.appendChild(o);
      }
    });

    var listEl = document.getElementById('list');
    var searchEl = document.getElementById('search');

    function render() {
      var month = monthSel.value;
      var term = searchEl.value.trim().toLowerCase();
      listEl.textContent = '';
      var shown = 0;

      entries.forEach(function (e) {
        if (month && e.date.slice(0, 7) !== month) { return; }

        var shownTitle = displayTitle(e, titleMap);
        var searchable = shownTitle + ' ' + (e.topics || '') + ' ' + (e.group || '');
        if (term && searchable.toLowerCase().indexOf(term) === -1) { return; }

        shown++;
        var row = document.createElement('div');
        row.className = 'row';

        var d = parseDate(e.date);
        var b = document.createElement('b');
        b.textContent = (e.symbol || '') + ' ' + shownTitle;
        row.appendChild(b);

        if (e.projectKey) {
          var chip = document.createElement('span');
          chip.className = 'chip';
          chip.style.background = 'var(--proj-' + e.projectKey + ')';
          chip.textContent = e.projectKey.replace(/-/g, ' ');
          row.appendChild(chip);
        }

        var s1 = document.createElement('small');
        s1.textContent = DAYS[d.getDay()] + ' ' + e.date + ', Day ' + e.day +
          ', topic day ' + (e.topicDay || '-') + ', ' + (e.group || '') +
          (titleMap[String(e.day)] ? ', display title applied' : '');

        var s2 = document.createElement('small');
        s2.textContent = e.topics || '';
        row.appendChild(s1);
        row.appendChild(s2);
        listEl.appendChild(row);
      });

      if (!shown) {
        var none = document.createElement('p');
        none.className = 'note';
        none.textContent = 'Nothing matches.';
        listEl.appendChild(none);
      }
    }

    monthSel.addEventListener('change', render);
    searchEl.addEventListener('input', render);
    render();
  }).catch(function (err) {
    var c = document.getElementById('counts');
    c.textContent = 'Could not load the data: ' + err.message;
    c.className = 'counts err';
  });
})();

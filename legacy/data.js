// Shared data loader. Loads the roadmap once; Today and Calendar both use it.

(function () {
  'use strict';

  var MONTHS3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function two(n) { return n < 10 ? '0' + n : String(n); }

  function toDate(iso) {
    var p = iso.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function load(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) { throw new Error(path + ' (' + r.status + ')'); }
      return r.json();
    });
  }

  var D = {
    entries: [],
    titles: {},
    two: two,
    toDate: toDate,
    projectNames: {
      'guessing-game': 'Guessing Game', 'banking': 'Banking', 'smart-library': 'Smart Library',
      'inventory': 'Inventory', 'task-api': 'Task API', 'semester-planner': 'Semester Planner'
    },
    formatDate: function (iso) {
      var d = toDate(iso);
      return DAYS3[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS3[d.getMonth()] + ' ' + d.getFullYear();
    },
    titleOf: function (e) {
      var o = D.titles[e.day];
      if (!o) { return e.title; }
      return o.showNumber ? o.title + ' ' + two(e.topicDay) : o.title;
    },
    plainTitle: function (e) {
      var o = D.titles[e.day];
      return o ? o.title : e.title.replace(/\s+\d+$/, '');
    },
    indexOfDate: function (iso) {
      for (var i = 0; i < D.entries.length; i++) {
        if (D.entries[i].date === iso) { return i; }
      }
      return -1;
    },
    shiftIso: function (iso, offset) {
      var d = toDate(iso);
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
      return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
    },
    shortDate: function (iso) {
      var d = toDate(iso);
      return DAYS3[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS3[d.getMonth()];
    },
    todayIso: function () {
      var n = new Date();
      return n.getFullYear() + '-' + two(n.getMonth() + 1) + '-' + two(n.getDate());
    }
  };

  D.questions = [];
  D.ready = Promise.all([load('data/roadmap.json'), load('data/display-titles.json'), load('data/questions.json')])
    .then(function (res) {
      D.entries = res[0].entries;
      D.entries.forEach(function (e, i) { e.seq = i + 1; });   // position in the schedule; e.day stays the fixed id
      D.titles = res[1];
      D.questions = res[2].questions;
      return D;
    });

  window.RoadmapData = D;
})();

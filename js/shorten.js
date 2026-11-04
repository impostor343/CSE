// Short names for cards. Long module and session names are cut to a short title; tapping the title on a card shows the full name.
//   U.shortSession(title)  -> "Git mental model"            U.shortModule(module) -> "Git & GitHub"
// The full text is never lost: cards keep it in data-full and toggle it on tap (U.tapFull).
(function () {
  'use strict';
  var MODULES = {
    M01: 'Git & GitHub', M02: 'Java basics bridge', M03: 'Object-oriented Java', M04: 'Collections & generics', M05: 'Exceptions & files',
    M06: 'Clean code & testing', M07: 'DSA foundations', M08: 'SQL foundations', M09: 'JDBC & persistence', M10: 'HTTP, JSON & Maven',
    M11: 'Spring Boot & REST', M12: 'Backend testing & deploy', M13: 'Web & React intro', M14: 'Portfolio & internships', M15: 'Advanced algorithms',
    M16: 'JVM & concurrency', M17: 'C & low-level', M18: 'Python scripting', M19: 'JS, TypeScript & frontend', M20: 'Operating systems',
    M21: 'Computer networks', M22: 'Advanced DBMS', M23: 'Software design', M24: 'Quality engineering', M25: 'Application security',
    M26: 'System design', M27: 'Distributed systems', M28: 'Cloud & containers', M29: 'Data & AI literacy', M30: 'Open source', M31: 'Capstone & career'
  };
  var BY_NAME = {};
  function cut(s, n) {
    if (s.length <= n) { return s; }
    var t = s.slice(0, n), i = t.lastIndexOf(' ');
    return (i > n * 0.55 ? t.slice(0, i) : t).replace(/[\s,;:\-–—(]+$/, '') + '…';
  }
  U.shortSession = function (title, max) {
    var t = String(title || '').trim(), n = max || 46;
    var i = t.indexOf(' — ');
    if (i > 8) { t = t.slice(0, i); }
    if (t.length > n) { var c = t.indexOf(':'); if (c > 8) { t = t.slice(0, c); } }
    return cut(t, n);
  };
  U.shortModule = function (m) {
    if (!m) { return ''; }
    var id = typeof m === 'string' ? null : m.id, name = typeof m === 'string' ? m : m.name;
    if (id && MODULES[id]) { return MODULES[id]; }
    if (!id && !BY_NAME[name] && window.Curriculum && Curriculum.modules) { Curriculum.modules.forEach(function (x) { BY_NAME[x.name] = x.id; }); }
    return MODULES[BY_NAME[name]] || cut(String(name || ''), 28);
  };
  // Make an element show its short text and swap to the full text on tap (and back).
  U.tapFull = function (el, shortText, fullText) {
    if (shortText === fullText) { el.textContent = fullText; return el; }
    var full = false;
    el.textContent = shortText; el.classList.add('tap-full'); el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', fullText + '. Tap to ' + 'show the short name');
    function flip(ev) { if (ev) { ev.stopPropagation(); } full = !full; el.textContent = full ? fullText : shortText; el.classList.toggle('is-full', full); }
    el.addEventListener('click', flip);
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(e); } });
    return el;
  };
})();

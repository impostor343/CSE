// Router shell: the six tabs (Home, Calendar, Questions, Projects, Progress, Resources) plus Settings, chosen by the URL hash.
(function () {
  'use strict';
  var SCREENS = ['today', 'modules', 'manual', 'calendar', 'questions', 'projects', 'progress', 'resources', 'settings'];
  var titleEl = document.getElementById('screen-title'), tabLinks = document.querySelectorAll('.tabbar a'), mainEl = document.getElementById('main');
  var lastId = null;
  function showScreen() {
    var route = location.hash.replace('#', '').split('/');
    var id = route[0];
    // The three learning areas live inside the Home screen, not separate screens.
    // Keep their hash routes for deep links while rendering the Home shell.
    if (id === 'modules' || id === 'manual' || id === 'projects') { id = 'today'; }
    if (SCREENS.indexOf(id) === -1) { id = 'today'; }
    var sections = document.querySelectorAll('.screen');
    for (var i = 0; i < sections.length; i++) { sections[i].hidden = (sections[i].id !== 'screen-' + id); }
    for (var j = 0; j < tabLinks.length; j++) {
      if (tabLinks[j].getAttribute('href') === '#' + id) { tabLinks[j].setAttribute('aria-current', 'page'); } else { tabLinks[j].removeAttribute('aria-current'); }
    }
    var title = document.getElementById('screen-' + id).getAttribute('data-title');
    document.body.setAttribute('data-screen', id);
    titleEl.textContent = title; document.title = title + ' | Bytewise';
    // Only jump to the top when you change screen. Moving between sessions (#today/8 -> #today/9) keeps your scroll position.
    if (id !== lastId) { mainEl.scrollTop = 0; mainEl.focus({ preventScroll: true }); }
    lastId = id;
  }
  window.addEventListener('hashchange', showScreen); showScreen();
})();

// Offline support: the service worker caches the app and data after the first visit.
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform())) { window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); }); }

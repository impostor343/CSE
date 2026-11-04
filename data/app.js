// Java Roadmap: Stage 1 shell.
// Only job so far: switch between the six screens using the URL hash.

(function () {
  'use strict';

  var SCREENS = ['today', 'calendar', 'questions', 'projects', 'progress', 'settings'];

  var titleEl = document.getElementById('screen-title');
  var tabLinks = document.querySelectorAll('.tabbar a');
  var mainEl = document.getElementById('main');

  function showScreen() {
    var id = window.location.hash.replace('#', '');
    if (SCREENS.indexOf(id) === -1) { id = 'today'; }

    var sections = document.querySelectorAll('.screen');
    for (var i = 0; i < sections.length; i++) {
      sections[i].hidden = (sections[i].id !== 'screen-' + id);
    }

    for (var j = 0; j < tabLinks.length; j++) {
      var isActive = tabLinks[j].getAttribute('href') === '#' + id;
      if (isActive) { tabLinks[j].setAttribute('aria-current', 'page'); }
      else { tabLinks[j].removeAttribute('aria-current'); }
    }

    var title = document.getElementById('screen-' + id).getAttribute('data-title');
    titleEl.textContent = title;
    document.title = title + ' | Java Roadmap';
    window.scrollTo(0, 0);
    mainEl.focus({ preventScroll: true });
  }

  window.addEventListener('hashchange', showScreen);
  showScreen();
})();

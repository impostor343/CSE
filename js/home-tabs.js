// Home's three internal workspaces. Deep links to modules/projects stay inside Home.
(function () {
  'use strict';
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-home-tab]'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('[data-home-panel]'));
  function choose(name) {
    if (['roadmap','modules','projects'].indexOf(name) < 0) name = 'roadmap';
    tabs.forEach(function (b) {
      var on = b.getAttribute('data-home-tab') === name;
      b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(function (p) { p.hidden = p.getAttribute('data-home-panel') !== name; });
  }
  function fromRoute() {
    var id = (location.hash || '#today').slice(1).split('/')[0];
    choose(id === 'projects' ? 'projects' : (id === 'modules' || id === 'manual' ? 'modules' : 'roadmap'));
  }
  tabs.forEach(function (b) { b.addEventListener('click', function () {
    var name = b.getAttribute('data-home-tab');
    if (name === 'roadmap') { location.hash = '#today'; }
    else { location.hash = name === 'modules' ? '#modules' : '#projects'; }
    choose(name);
  }); });
  window.addEventListener('hashchange', fromRoute);
  fromRoute();
})();

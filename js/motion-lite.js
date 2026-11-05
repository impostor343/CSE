// Subtle entrance motion, only when you move to a new screen or Home tab (not on every redraw).
// It adds the class "bw-enter" to <main> for a moment; css/motion-subtle.css animates cards while it is there.
(function () {
  'use strict';
  var main = document.getElementById('main'), t = 0;
  if (!main) { return; }
  function enter() {
    main.classList.remove('bw-enter'); void main.offsetWidth; main.classList.add('bw-enter');
    clearTimeout(t); t = setTimeout(function () { main.classList.remove('bw-enter'); }, 900);
  }
  window.addEventListener('hashchange', enter);
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-home-tab]')) { enter(); } });
  enter();
})();

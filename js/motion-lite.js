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

// ---- Sliding colour pill: bottom tab bar + Home tabs (Roadmap / Modules / Projects) ----
(function () {
  'use strict';
  var bar = document.querySelector('.tabbar'), ws = document.querySelector('.home-workspace-tabs');
  var probe = null;

  function mk(cls, parent) { var p = document.createElement('span'); p.className = cls; p.setAttribute('aria-hidden', 'true'); parent.insertBefore(p, parent.firstChild); return p; }
  function settle(pill) { requestAnimationFrame(function () { requestAnimationFrame(function () { pill.classList.add('is-ready'); }); }); }

  // bottom bar: the pill sits behind the icon of the current page
  if (bar) {
    var tpill = mk('bw-pill bw-pill-nav', bar); bar.classList.add('bw-slide');
    var placeNav = function () {
      var a = bar.querySelector('a[aria-current="page"]'), svg = a && a.querySelector('svg'); if (!svg) { tpill.style.opacity = '0'; return; }
      var b = bar.getBoundingClientRect(), s = svg.getBoundingClientRect(); if (!b.width || !s.width) { return; }
      var x = s.left - b.left - bar.clientLeft + s.width / 2 - 18, y = s.top - b.top - bar.clientTop + s.height / 2 - 15;
      tpill.style.opacity = '1'; tpill.style.transform = 'translate(' + Math.round(x * 10) / 10 + 'px,' + Math.round(y * 10) / 10 + 'px)';
    };
    new MutationObserver(placeNav).observe(bar, { attributes: true, attributeFilter: ['aria-current'], subtree: true });
    window.addEventListener('resize', placeNav);
    if (window.ResizeObserver) { new ResizeObserver(placeNav).observe(bar); }
    placeNav(); settle(tpill);
  }

  // Home tabs: the pill slides under the chosen tab
  if (ws) {
    var wpill = mk('bw-pill bw-pill-ws', ws); ws.classList.add('bw-slide');
    probe = document.createElement('button'); probe.className = 'home-workspace-tab is-active'; probe.setAttribute('aria-hidden', 'true'); probe.tabIndex = -1;
    probe.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none'; document.body.appendChild(probe);
    var placeWs = function () {
      var t = ws.querySelector('.home-workspace-tab.is-active'); if (!t || !t.offsetWidth) { return; }
      var cs = getComputedStyle(probe); wpill.style.background = cs.backgroundColor; wpill.style.boxShadow = cs.boxShadow;
      wpill.style.width = t.offsetWidth + 'px'; wpill.style.height = t.offsetHeight + 'px';
      wpill.style.transform = 'translate(' + t.offsetLeft + 'px,' + t.offsetTop + 'px)';
    };
    new MutationObserver(placeWs).observe(ws, { attributes: true, attributeFilter: ['class'], subtree: true });
    window.addEventListener('resize', placeWs);
    if (window.ResizeObserver) { new ResizeObserver(placeWs).observe(ws); }
    placeWs(); settle(wpill);
  }
})();

// ---- Progress bars: fill from the old value to the new one, or grow from empty when first shown ----
(function () {
  'use strict';
  var main = document.getElementById('main'); if (!main || !window.MutationObserver) { return; }
  var SEL = '.pc-bar > i, .pg-bar > span, .cbar > span', last = {};
  function keyOf(b) {
    var o = b.closest('[data-id]'), k = o ? o.getAttribute('data-id') : '';
    if (!k) { var r = b.closest('.pg-row, .pcard, .pg-hero, .card'); k = r ? (r.getAttribute('aria-label') || r.textContent || '').replace(/\s+/g, ' ').slice(0, 40) : ''; }
    return k + '|' + b.parentNode.className;
  }
  function animate(b) {
    var w = parseFloat(b.style.width); if (isNaN(w)) { return; }
    var k = keyOf(b), old = last[k]; last[k] = w;
    if (main.classList.contains('bw-enter')) { return; }              // the screen-enter animation already handles this
    var from = old === undefined ? 0 : old; if (from === w) { return; }
    b.style.transition = 'none'; b.style.width = from + '%'; void b.offsetWidth;
    b.style.transition = ''; b.style.width = w + '%';
    b.classList.add('bw-sheen'); setTimeout(function () { b.classList.remove('bw-sheen'); }, 1100);
  }
  function scan(root) { if (root.nodeType !== 1) { return; } if (root.matches && root.matches(SEL)) { animate(root); } if (root.querySelectorAll) { [].forEach.call(root.querySelectorAll(SEL), animate); } }
  new MutationObserver(function (list) { list.forEach(function (m) { [].forEach.call(m.addedNodes, scan); }); }).observe(main, { childList: true, subtree: true });
  [].forEach.call(main.querySelectorAll(SEL), function (b) { var w = parseFloat(b.style.width); if (!isNaN(w)) { last[keyOf(b)] = w; } });
})();

// Touch gestures (finger only; mouse and keyboard are unaffected).
//   Gestures.swipeX(el, {onLeft, onRight})   horizontal swipe, ignores mostly-vertical drags so scrolling still works
//   Gestures.dragDismiss(dialog, scroller, onDismiss)   drag a bottom sheet down to close it
(function () {
  'use strict';
  var G = {}, REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function skip(t) { return t && t.closest && t.closest('textarea, input, select, [data-noswipe]'); }

  G.swipeX = function (el, o) {
    var x0 = 0, y0 = 0, dir = null, on = false, min = o.min || 56;
    el.style.touchAction = 'pan-y';   // vertical scrolling stays with the browser; horizontal moves reach us
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1 || skip(e.target) || (o.enabled && !o.enabled())) { on = false; return; }
      on = true; dir = null; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      if (!on) { return; }
      var dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
      if (dir === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) { dir = Math.abs(dx) > Math.abs(dy) * 1.4 ? 'x' : 'y'; }
      if (dir === 'x' && !REDUCE) { el.style.transform = 'translateX(' + Math.max(-70, Math.min(70, dx * 0.35)) + 'px)'; el.style.transition = 'none'; }
    }, { passive: true });
    function reset() { el.style.transition = REDUCE ? 'none' : 'transform .18s ease'; el.style.transform = ''; }
    el.addEventListener('touchend', function (e) {
      if (!on) { return; } on = false;
      var t = e.changedTouches[0], dx = t.clientX - x0; reset();
      if (dir !== 'x' || Math.abs(dx) < min) { return; }
      if (dx < 0 && o.onLeft) { o.onLeft(); } else if (dx > 0 && o.onRight) { o.onRight(); }
    }, { passive: true });
    el.addEventListener('touchcancel', function () { on = false; reset(); }, { passive: true });
  };

  G.dragDismiss = function (dlg, scroller, onDismiss) {
    var y0 = 0, dy = 0, on = false, t0 = 0, closing = false;
    function finish() { if (closing) { return; } closing = true; if (onDismiss) { onDismiss(); } }
    dlg.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1 || skip(e.target)) { on = false; return; }
      // start only when the content is scrolled to the top (or the grab handle is used)
      on = scroller.scrollTop <= 0 || !!(e.target.closest && e.target.closest('.sheet-handle, .home-info-top')); y0 = e.touches[0].clientY; dy = 0; t0 = Date.now();
      dlg.style.transition = 'none';
    }, { passive: true });
    dlg.addEventListener('touchmove', function (e) {
      if (!on) { return; }
      dy = e.touches[0].clientY - y0;
      if (dy > 0 && (scroller.scrollTop <= 0 || e.target.closest('.sheet-handle, .home-info-top'))) { if (e.cancelable) { e.preventDefault(); } dlg.style.transform = 'translateY(' + dy + 'px)'; }
      else if (dy <= 0) { dy = 0; dlg.style.transform = ''; }
    }, { passive: false });
    dlg.addEventListener('touchend', function () {
      if (!on) { return; } on = false;
      var fast = dy > 40 && (Date.now() - t0) < 250;
      dlg.style.transition = REDUCE ? 'none' : 'transform .18s ease';
      if (dy > 110 || fast) {
        if (REDUCE) { finish(); return; }
        dlg.style.transform = 'translateY(100%)'; setTimeout(finish, 190);
      } else { dlg.style.transform = ''; }
    }, { passive: true });
    dlg.addEventListener('touchcancel', function () { on = false; dlg.style.transform = ''; }, { passive: true });
  };
  window.Gestures = G;
})();

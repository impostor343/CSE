// Home-screen widgets (Android app only). The saved progress lives in this WebView, so after every change we send a small summary
// to the native side, which stores it and redraws both widgets. Nothing is estimated: the numbers come from State (the same records as the app).
(function () {
  'use strict';
  var C = window.Curriculum, A = window.State, timer = null;
  function bridge() { var P = window.Capacitor && Capacitor.Plugins; return P && P.WidgetBridge; }
  function native() { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); }
  if (!native()) { return; }

  function snapshot() {
    var d = A.nextIncomplete(), s = d ? C.session(d) : null;
    var st = d ? A.status(d) : '', lab = { completed: '✓ Completed', skipped: '↪ Skipped', 'in-progress': '◷ In progress' }[st] || '○ Pending';
    var colors = window.Theme && Theme.widgetColors ? Theme.widgetColors() : {};
    // The widget mirrors the Home card: same text, and the colours come from the palette you have chosen in the app.
    return { total: C.total, done: A.doneCount(), skipped: A.skippedCount(), nextDay: d || 0, title: s ? U.shortSession(s.title) : '', module: s ? U.shortModule(C.module(s.moduleId)) : '', time: s ? (s.time || 'Time not specified') : '', status: st,
      phase: s ? s.phase : '', statusLabel: lab, colors: colors };
  }
  function push() { var b = bridge(); if (!b || !b.update) { return; } try { Promise.resolve(b.update(snapshot())).catch(function () {}); } catch (e) {} }
  function soon() { clearTimeout(timer); timer = setTimeout(push, 300); }

  // widget tap: open the right screen (only these exact routes are accepted)
  function route(r) {
    var doneMatch = /^#widget-done\/(\d{1,4})$/.exec(r || '');
    if (doneMatch) {
      var day = parseInt(doneMatch[1], 10);
      if (day >= 1 && day <= C.total) {
        A.markDone(day).then(function () {
          push();
          var next = A.nextIncomplete() || day;
          location.hash = '#today/' + next;
          window.dispatchEvent(new Event('cur-changed'));
        }).catch(function () { location.hash = '#today/' + day; });
      }
      return;
    }
    var infoMatch = /^#widget-info\/(\d{1,4})$/.exec(r || '');
    if (infoMatch) {
      var di = parseInt(infoMatch[1], 10);
      if (di >= 1 && di <= C.total) { location.hash = '#today/' + di; setTimeout(function () { var b = document.querySelector('.home-btn.info'); if (b) { b.click(); } }, 500); }
      return;
    }
    if (/^#(today(\/\d{1,4})?|progress|calendar)$/.test(r || '')) { location.hash = r; }
  }
  function pullRoute() { var b = bridge(); if (b && b.getLaunchRoute) { Promise.resolve(b.getLaunchRoute()).then(function (x) { route(x && x.route); }, function () {}); } }

  Promise.all([C.ready, A.ready]).then(function () { push(); pullRoute(); }).catch(function () {});
  window.addEventListener('cur-changed', soon);
  // palette changes in Settings repaint the widget too (the theme writes its colours onto <html style>)
  new MutationObserver(soon).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  window.addEventListener('cse-native-route', pullRoute);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { push(); } else { pullRoute(); } });
  window.WidgetSync = { push: push, snapshot: snapshot };
})();

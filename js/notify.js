// Daily reminder for today's goal (the next session you have not finished).
//  Android app: real scheduled notifications through @capacitor/local-notifications (work when the app is closed).
//  Website/PWA: browsers cannot wake a closed page without a server, so the reminder shows while Bytewise is open,
//  and once when you open it after the reminder time has passed that day.
(function () {
  'use strict';
  var KEY = 'cse-roadmap-notify', ID = 4301, timer = null;
  var C = window.Curriculum, A = window.State;
  function cap() { return window.Capacitor; }
  function isNative() { var c = cap(); return !!(c && c.isNativePlatform && c.isNativePlatform()); }
  function LN() { var c = cap(); return c && c.Plugins && c.Plugins.LocalNotifications; }
  function load() { var s = {}; try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {} return { on: !!s.on, time: /^\d{2}:\d{2}$/.test(s.time || '') ? s.time : '08:00', last: s.last || '' }; }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function parts(t) { var p = t.split(':'); return { hour: +p[0], minute: +p[1] }; }
  function message() {
    var d = A && A.nextIncomplete && A.nextIncomplete();
    if (!d) { return { title: 'Bytewise', body: 'You have finished every session. Time to revise or build a project.' }; }
    var s = C.session(d);
    return { title: 'Today\u2019s goal: session ' + d + ' of ' + C.total, body: s.title + (s.time ? ' \u00B7 ' + s.time : '') };
  }
  function supported() { return isNative() ? !!LN() : ('Notification' in window); }
  function permission() {
    if (isNative()) { return LN() ? LN().checkPermissions().then(function (r) { return r.display; }) : Promise.resolve('denied'); }
    return Promise.resolve('Notification' in window ? Notification.permission : 'denied');
  }
  function ask() {
    if (isNative()) { return LN() ? LN().requestPermissions().then(function (r) { return r.display; }) : Promise.resolve('denied'); }
    if (!('Notification' in window)) { return Promise.resolve('denied'); }
    return Promise.resolve(Notification.requestPermission());
  }
  function showWeb(m) {
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
      return navigator.serviceWorker.getRegistration().then(function (r) { if (r && r.showNotification) { return r.showNotification(m.title, { body: m.body, icon: 'icons/icon-192.png', tag: 'bytewise-goal' }); } new Notification(m.title, { body: m.body, icon: 'icons/icon-192.png' }); });
    }
    new Notification(m.title, { body: m.body, icon: 'icons/icon-192.png' }); return Promise.resolve();
  }
  function today() { return U.todayKey(); }
  function webTick() {
    clearTimeout(timer); var s = load(); if (isNative() || !s.on || !('Notification' in window) || Notification.permission !== 'granted') { return; }
    var t = parts(s.time), now = new Date(), at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), t.hour, t.minute, 0);
    function fire() { var cur = load(); if (cur.last === today()) { return; } cur.last = today(); save(cur); showWeb(message()); }
    if (now >= at) { fire(); at = new Date(at.getTime() + 86400000); }
    timer = setTimeout(function () { fire(); webTick(); }, Math.min(at - new Date(), 2147000000));
  }
  function nativeSchedule() {
    var s = load(), ln = LN(); if (!ln) { return Promise.resolve(); }
    return ln.cancel({ notifications: [{ id: ID }] }).catch(function () {}).then(function () {
      if (!s.on) { return; }
      var m = message(), t = parts(s.time);
      return ln.schedule({ notifications: [{ id: ID, title: m.title, body: m.body, schedule: { on: { hour: t.hour, minute: t.minute }, allowWhileIdle: true } }] });
    });
  }
  function reschedule() { return isNative() ? nativeSchedule() : (webTick(), Promise.resolve()); }
  window.Notify = {
    supported: supported, isNative: isNative, get: load, permission: permission,
    enable: function (time) { return ask().then(function (p) { if (p !== 'granted') { return p; } var s = load(); s.on = true; if (time) { s.time = time; } save(s); return reschedule().then(function () { return 'granted'; }); }); },
    disable: function () { var s = load(); s.on = false; save(s); return reschedule(); },
    setTime: function (t) { var s = load(); s.time = t; save(s); return reschedule(); },
    test: function () { var m = message(); return ask().then(function (p) { if (p !== 'granted') { return p; } if (isNative()) { return LN().schedule({ notifications: [{ id: ID + 1, title: m.title, body: m.body, schedule: { at: new Date(Date.now() + 2000) } }] }).then(function () { return 'granted'; }); } return showWeb(m).then(function () { return 'granted'; }); }); },
    preview: message
  };
  if (C && A) { Promise.all([C.ready, A.ready]).then(function () { reschedule(); window.addEventListener('cur-changed', function () { reschedule(); }); }); }
})();

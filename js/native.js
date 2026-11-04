// Android app (Capacitor) helpers. In a normal browser these do nothing special.
// Inside the app, blob downloads and blob PDFs do not work in the WebView, so files are written to the app cache and handed to the Android share sheet.
(function () {
  'use strict';
  var C = window.Capacitor;
  function native() { return !!(C && C.isNativePlatform && C.isNativePlatform()); }
  function plugin(n) { return C && C.Plugins && C.Plugins[n]; }
  function toBase64(blob) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1]); }; r.onerror = function () { rej(r.error); }; r.readAsDataURL(blob); }); }
  // data: a Blob. Returns a promise. In the app it opens the share sheet (Save to Drive / Files, or open with a viewer).
  function shareFile(name, blob, title) {
    var FS = plugin('Filesystem'), SH = plugin('Share');
    if (!FS || !SH) { return Promise.reject(new Error('File sharing is not available in this app build.')); }
    return toBase64(blob).then(function (b64) { return FS.writeFile({ path: name, data: b64, directory: 'CACHE' }); })
      .then(function (r) { return SH.share({ title: title || name, url: r.uri, dialogTitle: title || name }); });
  }
  window.NativeFiles = { isNative: native, shareFile: shareFile };

  // ---- Android Back button (app only; in a browser the normal browser Back already works)
  // Order: close an open sheet/dialog, then go up one level, then Home, and on Home leave the app (it stays in Recents).
  var KEYWORDS = ['day', 'topic', 'module', 'concept', 'project', 'question'];
  function parentHash(hash) {
    var parts = String(hash || '').replace('#', '').split('/').filter(Boolean);
    if (!parts.length || (parts[0] === 'today' && parts.length === 1)) { return null; }   // already at Home
    if (parts[0] === 'today') { return '#today'; }
    if (parts.length === 1) { return '#today'; }
    if (parts[0] === 'calendar' && parts[1] === 'day' && window.Curriculum && Curriculum.total) {
      var n = parseInt(parts[2], 10); if (n >= 1) { return '#calendar/' + Curriculum.groupOf(n); }
    }
    parts.pop();
    if (parts.length > 1 && KEYWORDS.indexOf(parts[parts.length - 1]) !== -1) { parts.pop(); }
    return '#' + parts.join('/');
  }
  function onBack() {
    var dlg = document.querySelector('dialog[open]');
    if (dlg) { dlg.close(); return 'dialog'; }
    var up = parentHash(location.hash);
    if (up) { location.replace(up); return up; }
    var App = plugin('App');
    if (App && App.minimizeApp) { App.minimizeApp(); } else if (App && App.exitApp) { App.exitApp(); }
    return 'exit';
  }
  window.NativeNav = { parentHash: parentHash, back: onBack };
  if (native() && plugin('App') && plugin('App').addListener) { plugin('App').addListener('backButton', onBack); }
})();

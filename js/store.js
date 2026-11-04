// Local storage (IndexedDB 'java-roadmap', version 6). Nothing leaves the phone.
// Versions 5 and 6 ONLY ADD stores. The old stores (progress, dateNotes, questionState, dayNotes) are never modified or deleted by the app;
// they hold your records from the earlier date-based version and are shown under Settings > Earlier records.
(function () {
  'use strict';
  var DB_NAME = 'java-roadmap', VERSION = 6, dbPromise = null;
  var LEGACY = ['dayNotes', 'dateNotes', 'questionState', 'progress'];
  var NEW = ['completions', 'sessionState', 'topicState', 'projectState', 'milestoneState', 'events', 'practiceState', 'meta', 'resourceState'];
  var BUSY = 'Saved data is busy. Close other tabs or windows of this app, then reload. Nothing is lost.';

  function open() {
    if (dbPromise) { return dbPromise; }
    dbPromise = new Promise(function (resolve, reject) {
      var req; try { req = indexedDB.open(DB_NAME, VERSION); } catch (e) { dbPromise = null; reject(e); return; }
      var timer = setTimeout(function () { dbPromise = null; reject(new Error(BUSY)); }, 4000);
      req.onupgradeneeded = function (ev) {
        var db = req.result, tx = req.transaction;
        if (!db.objectStoreNames.contains('dateNotes')) { db.createObjectStore('dateNotes', { keyPath: 'date' }); }
        if (!db.objectStoreNames.contains('questionState')) { db.createObjectStore('questionState', { keyPath: 'id' }); }
        if (!db.objectStoreNames.contains('progress')) { db.createObjectStore('progress', { keyPath: 'day' }); }
        if (ev.oldVersion < 2 && db.objectStoreNames.contains('dayNotes')) {
          var all = tx.objectStore('dayNotes').getAll();
          all.onsuccess = function () { var d = tx.objectStore('dateNotes'); (all.result || []).forEach(function (n) { if (n && n.date) { d.put(n); } }); };
        }
        if (!db.objectStoreNames.contains('completions')) { var c = db.createObjectStore('completions', { keyPath: 'id', autoIncrement: true }); c.createIndex('day', 'day'); }
        if (!db.objectStoreNames.contains('sessionState')) { db.createObjectStore('sessionState', { keyPath: 'day' }); }
        ['topicState', 'projectState', 'milestoneState', 'practiceState'].forEach(function (n) { if (!db.objectStoreNames.contains(n)) { db.createObjectStore(n, { keyPath: 'id' }); } });
        if (!db.objectStoreNames.contains('events')) { db.createObjectStore('events', { keyPath: 'id', autoIncrement: true }); }
        if (!db.objectStoreNames.contains('resourceState')) { db.createObjectStore('resourceState', { keyPath: 'id' }); }
        if (!db.objectStoreNames.contains('resourceFiles')) { db.createObjectStore('resourceFiles', { keyPath: 'id' }); }
        if (!db.objectStoreNames.contains('meta')) { db.createObjectStore('meta', { keyPath: 'key' }); }
      };
      req.onsuccess = function () { clearTimeout(timer); var db = req.result; db.onversionchange = function () { db.close(); dbPromise = null; }; resolve(db); };
      req.onerror = function () { clearTimeout(timer); dbPromise = null; reject(req.error); };
    });
    return dbPromise;
  }
  function run(name, mode, fn) {
    return open().then(function (db) { return new Promise(function (resolve, reject) {
      var t = db.transaction(name, mode), r = fn(t.objectStore(name), t);
      t.oncomplete = function () { resolve(r ? r.result : undefined); }; t.onerror = t.onabort = function () { reject(t.error); }; }); });
  }
  if (navigator.storage && navigator.storage.persist) { navigator.storage.persist(); }

  var Store = {
    LEGACY: LEGACY, NEW: NEW,
    all: function (n) { return run(n, 'readonly', function (s) { return s.getAll(); }).then(function (r) { return r || []; }); },
    one: function (n, key) { return run(n, 'readonly', function (s) { return s.get(key); }); },
    put: function (n, rec) { return run(n, 'readwrite', function (s) { return s.put(rec); }); },
    del: function (n, key) { return run(n, 'readwrite', function (s) { return s.delete(key); }); },
    add: function (n, rec) { return run(n, 'readwrite', function (s) { return s.add(rec); }).then(function (id) { rec.id = id; return rec; }); },
    // One active completion per session day, checked inside a single transaction so repeated taps cannot create duplicates.
    complete: function (day, rec) {
      return open().then(function (db) { return new Promise(function (resolve, reject) {
        var t = db.transaction('completions', 'readwrite'), st = t.objectStore('completions'), out = null;
        var q = st.index('day').getAll(day);
        q.onsuccess = function () {
          var act = (q.result || []).filter(function (r) { return !r.reopenedAt; });
          if (act.length) { out = act[0]; return; }
          var a = st.add(rec); a.onsuccess = function () { rec.id = a.result; out = rec; };
        };
        t.oncomplete = function () { resolve(out); }; t.onerror = t.onabort = function () { reject(t.error); }; }); });
    },
    reopen: function (day, at) {
      return open().then(function (db) { return new Promise(function (resolve, reject) {
        var t = db.transaction('completions', 'readwrite'), st = t.objectStore('completions');
        var q = st.index('day').getAll(day);
        q.onsuccess = function () { (q.result || []).forEach(function (r) { if (!r.reopenedAt) { r.reopenedAt = at; st.put(r); } }); };
        t.oncomplete = function () { resolve(); }; t.onerror = t.onabort = function () { reject(t.error); }; }); });
    },
    names: function () { return open().then(function (db) { return LEGACY.concat(NEW).filter(function (n) { return db.objectStoreNames.contains(n); }); }); },
    dump: function () { var out = {}; return Store.names().then(function (ns) { return Promise.all(ns.map(function (n) {
      return Store.all(n).then(function (r) { out[n] = r; }); })); }).then(function () { return out; }); },
    // Replace a store's contents (used only by a confirmed Restore).
    replace: function (n, records) { return run(n, 'readwrite', function (s) { s.clear(); records.forEach(function (r) { s.put(r); }); }); }
  };
  window.Store = Store;
})();

// Local storage in the browser (IndexedDB). Notes belong to calendar DATES.
// Nothing leaves the phone. window.RoadmapStore: notes (getNote, saveNote, deleteNote, allNotes) and progress (allProgress, saveProgress, deleteProgress).

(function () {
  'use strict';

  var DB_NAME = 'java-roadmap';
  var VERSION = 4;
  var OLD_NOTES = 'dayNotes';     // version 1 store (keyed by day number), copied once
  var NOTES = 'dateNotes';
  var QUESTIONS = 'questionState';   // your own status and notes per practice problem, keyed by question id
  var PROGRESS = 'progress';     // Done / Skipped / catch-up, keyed by the fixed roadmap day id
  var dbPromise = null;
  var BUSY = 'Saved data is busy. Close other tabs or windows of this app, then reload this page. Nothing is lost.';

  function open() {
    if (dbPromise) { return dbPromise; }
    dbPromise = new Promise(function (resolve, reject) {
      var req;
      try { req = indexedDB.open(DB_NAME, VERSION); } catch (e) { dbPromise = null; reject(e); return; }
      // If an older open copy of the app blocks the upgrade, stop waiting and say so.
      var timer = setTimeout(function () { dbPromise = null; reject(new Error(BUSY)); }, 4000);
      req.onupgradeneeded = function (ev) {
        var db = req.result;
        var tx = req.transaction;
        if (!db.objectStoreNames.contains(NOTES)) { db.createObjectStore(NOTES, { keyPath: 'date' }); }
        if (!db.objectStoreNames.contains(QUESTIONS)) { db.createObjectStore(QUESTIONS, { keyPath: 'id' }); }
        if (!db.objectStoreNames.contains(PROGRESS)) { db.createObjectStore(PROGRESS, { keyPath: 'day' }); }
        if (ev.oldVersion < 2 && db.objectStoreNames.contains(OLD_NOTES)) {
          var all = tx.objectStore(OLD_NOTES).getAll();
          all.onsuccess = function () {
            var dest = tx.objectStore(NOTES);
            (all.result || []).forEach(function (n) { if (n && n.date) { dest.put(n); } });
          };
        }
      };
      req.onsuccess = function () {
        clearTimeout(timer);
        var db = req.result;
        // Let a newer copy of the app upgrade the database instead of being blocked by this one.
        db.onversionchange = function () { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = function () { clearTimeout(timer); dbPromise = null; reject(req.error); };
    });
    return dbPromise;
  }

  function run(mode, action, storeName) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var name = storeName || NOTES;
        var t = db.transaction(name, mode);
        var request = action(t.objectStore(name));
        t.oncomplete = function () { resolve(request ? request.result : undefined); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  if (navigator.storage && navigator.storage.persist) { navigator.storage.persist(); }

  window.RoadmapStore = {
    getNote: function (date) { return run('readonly', function (s) { return s.get(date); }).then(function (r) { return r || null; }); },
    saveNote: function (note) { return run('readwrite', function (s) { return s.put(note); }); },
    deleteNote: function (date) { return run('readwrite', function (s) { return s.delete(date); }); },
    allNotes: function () { return run('readonly', function (s) { return s.getAll(); }).then(function (r) { return r || []; }); },
    allProgress: function () { return run('readonly', function (s) { return s.getAll(); }, PROGRESS).then(function (r) { return r || []; }); },
    saveProgress: function (rec) { return run('readwrite', function (s) { return s.put(rec); }, PROGRESS); },
    deleteProgress: function (day) { return run('readwrite', function (s) { return s.delete(day); }, PROGRESS); },
    allQuestionState: function () { return run('readonly', function (s) { return s.getAll(); }, QUESTIONS).then(function (r) { return r || []; }); },
    saveQuestionState: function (rec) { return run('readwrite', function (s) { return s.put(rec); }, QUESTIONS); },
    deleteQuestionState: function (id) { return run('readwrite', function (s) { return s.delete(id); }, QUESTIONS); }
  };
})();

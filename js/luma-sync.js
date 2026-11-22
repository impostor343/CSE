// Offline local synchronization coordinator (Bytewise -> Luma).
// Active only inside the native Android Capacitor app; strict no-op in browsers.
// Bytewise remains the sole owner of IndexedDB progress; sync errors never affect Bytewise.
(function () {
  'use strict';

  var C = window.Curriculum, S = window.Store, A = window.State;
  var EPOCH_KEY = 'lumaSyncEpoch';
  var RESET_KEY = 'lumaNeedsFullSync';
  var MIGRATED_KEY = 'lumaHistoryMigratedAt';
  var cachedEpoch = null;
  var bootDone = false;

  function isNative() {
    var cap = window.Capacitor;
    return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  }

  function bridge() {
    var cap = window.Capacitor;
    return cap && cap.Plugins && cap.Plugins.LumaSyncBridge ? cap.Plugins.LumaSyncBridge : null;
  }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    var bytes = new Uint8Array(16);
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      window.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < 16; i++) { bytes[i] = Math.floor(Math.random() * 256); }
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = [];
    for (var j = 0; j < 16; j++) { hex.push((bytes[j] + 0x100).toString(16).slice(1)); }
    return hex.slice(0, 4).join('') + '-' + hex.slice(4, 6).join('') + '-' + hex.slice(6, 8).join('') + '-' + hex.slice(8, 10).join('') + '-' + hex.slice(10, 16).join('');
  }

  function ensureEpoch() {
    if (cachedEpoch) { return Promise.resolve(cachedEpoch); }
    if (!S || typeof S.one !== 'function') {
      cachedEpoch = uuid();
      return Promise.resolve(cachedEpoch);
    }
    return S.one('meta', EPOCH_KEY).then(function (row) {
      if (row && row.value) {
        cachedEpoch = String(row.value);
        return cachedEpoch;
      }
      var fresh = uuid();
      cachedEpoch = fresh;
      return S.put('meta', { key: EPOCH_KEY, value: fresh }).then(function () { return fresh; });
    }).catch(function () {
      cachedEpoch = cachedEpoch || uuid();
      return cachedEpoch;
    });
  }

  // Enrich a Bytewise completion record with permanent curriculum identifiers while preserving permanent completion id.
  function enrichRecord(rec) {
    if (!rec || typeof rec.day !== 'number') { return null; }
    var s = C && typeof C.session === 'function' ? C.session(rec.day) : null;
    var mod = s && s.moduleId && C && typeof C.module === 'function' ? C.module(s.moduleId) : null;
    var top = s && s.topicId && C && typeof C.topic === 'function' ? C.topic(s.topicId) : null;
    var completedAt = rec.completedAt ? String(rec.completedAt) : new Date().toISOString();
    var localDate = rec.localDate ? String(rec.localDate) : (window.U && U.key ? U.key(completedAt) : completedAt.slice(0, 10));
    var localTime = rec.localTime ? String(rec.localTime) : (window.U && U.time ? U.time(completedAt) : '');
    return {
      completionId: Number(rec.id),
      day: Number(rec.day),
      sessionId: s && s.id ? String(s.id) : ('D' + String(rec.day).padStart(4, '0')),
      moduleId: s && s.moduleId ? String(s.moduleId) : '',
      moduleName: (mod && mod.name) || (s && s.module) || '',
      topicId: s && s.topicId ? String(s.topicId) : '',
      topicName: (top && top.name) || (s && s.topic) || '',
      title: (s && s.title) || ('Day ' + rec.day),
      phase: (s && s.phase) || '',
      completedAt: completedAt,
      localDate: localDate,
      localTime: localTime,
      reopenedAt: rec.reopenedAt ? String(rec.reopenedAt) : null,
      isActive: !rec.reopenedAt
    };
  }

  function safeCall(method, payload) {
    if (!isNative()) { return Promise.resolve(null); }
    var b = bridge();
    if (!b || typeof b[method] !== 'function') { return Promise.resolve(null); }
    try {
      return Promise.resolve(b[method](payload || {})).catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  function onCompleted(rec) {
    if (!isNative() || !rec) { return Promise.resolve(null); }
    var enriched = enrichRecord(rec);
    if (!enriched || !isFinite(enriched.completionId)) { return Promise.resolve(null); }
    return ensureEpoch().then(function (epoch) {
      return safeCall('recordCompletion', {
        epoch: epoch,
        record: enriched
      });
    }).catch(function () { return null; });
  }

  function onReopened(recs, reopenedAt) {
    if (!isNative() || !Array.isArray(recs) || !recs.length) { return Promise.resolve(null); }
    var list = recs.map(function (r) {
      var copy = Object.assign({}, r, { reopenedAt: r.reopenedAt || reopenedAt });
      return enrichRecord(copy);
    }).filter(function (x) { return x && isFinite(x.completionId); });
    if (!list.length) { return Promise.resolve(null); }
    return ensureEpoch().then(function (epoch) {
      return safeCall('recordReopen', {
        epoch: epoch,
        reopenedAt: String(reopenedAt || new Date().toISOString()),
        records: list
      });
    }).catch(function () { return null; });
  }

  function syncFullHistory(reason, forceReset) {
    if (!isNative()) { return Promise.resolve(null); }
    if (!C || !A || typeof A.allCompletions !== 'function') { return Promise.resolve(null); }
    return Promise.all([C.ready, A.ready, ensureEpoch(), S.one('meta', RESET_KEY).catch(function () { return null; }), S.one('meta', MIGRATED_KEY).catch(function () { return null; })])
      .then(function (all) {
        var epoch = all[2];
        var resetRow = all[3];
        var migratedRow = all[4];
        var needsReset = !!(forceReset || (resetRow && resetRow.value));
        var effectiveReason = reason || (needsReset ? 'backup-restore' : (!migratedRow ? 'initial-migration' : 'boot-reconcile'));
        var records = A.allCompletions()
          .map(enrichRecord)
          .filter(function (x) { return x && isFinite(x.completionId); })
          .sort(function (a, b) { return a.completionId - b.completionId; });

        return safeCall('syncSnapshot', {
          epoch: epoch,
          reason: effectiveReason,
          reset: needsReset,
          totalSessions: C.total || 1179,
          records: records
        }).then(function (res) {
          var tasks = [];
          if (needsReset) { tasks.push(S.del('meta', RESET_KEY).catch(function () {})); }
          if (!migratedRow) { tasks.push(S.put('meta', { key: MIGRATED_KEY, value: new Date().toISOString() }).catch(function () {})); }
          return Promise.all(tasks).then(function () { return res; });
        });
      }).catch(function () { return null; });
  }

  // Called by Settings > Restore backup right after IndexedDB stores are replaced, prior to reload.
  function markRestored() {
    var nextEpoch = uuid();
    cachedEpoch = nextEpoch;
    if (!S || typeof S.put !== 'function') { return Promise.resolve(nextEpoch); }
    return Promise.all([
      S.put('meta', { key: EPOCH_KEY, value: nextEpoch }),
      S.put('meta', { key: RESET_KEY, value: new Date().toISOString() })
    ]).then(function () { return nextEpoch; }).catch(function () { return nextEpoch; });
  }

  function flush() {
    return safeCall('flushPending', { force: true });
  }

  function status() {
    return safeCall('getStatus', {});
  }

  // Boot reconciliation & historical migration (runs once when Curriculum + State are ready).
  if (C && A && C.ready && A.ready) {
    Promise.all([C.ready, A.ready]).then(function () {
      if (bootDone) { return; }
      bootDone = true;
      syncFullHistory(null, false);
    }).catch(function () {});
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      flush();
    }
  });

  window.LumaSync = {
    isNative: isNative,
    onCompleted: onCompleted,
    onReopened: onReopened,
    syncFullHistory: syncFullHistory,
    markRestored: markRestored,
    flush: flush,
    status: status,
    enrichRecord: enrichRecord
  };
})();

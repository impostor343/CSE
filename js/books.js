// Books linked to sessions. data/module-books.json lists up to three free library books per module (the first is the main one).
// Opening a book uses the offline PDF you attached in Library when there is one, else the free PDF link, else the book page.
// A page bookmark per book is kept on this device (localStorage) and added to the PDF link as #page=N where the viewer supports it.
(function () {
  'use strict';
  var S = window.Store, KEY = 'bw-bookmarks', lib = null, map = {}, files = {}, blobUrl = null;
  function get(u) { return fetch(u).then(function (r) { if (!r.ok) { throw new Error(u); } return r.json(); }); }
  function marks() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function saveMarks(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} }
  var B = {};
  B.ready = Promise.all([get('data/library.json'), get('data/module-books.json').catch(function () { return { modules: {} }; }), S.all('resourceFiles').catch(function () { return []; })]).then(function (r) {
    lib = r[0]; map = r[1].modules || {}; r[2].forEach(function (f) { files[f.id] = f; }); return B;
  });
  B.book = function (id) { return lib ? (lib.books.filter(function (b) { return b.id === id; })[0] || null) : null; };
  B.forModule = function (moduleId) { return (map[moduleId] || []).map(B.book).filter(Boolean); };
  B.hasOffline = function (id) { return !!files[id]; };
  B.page = function (id) { var m = marks()[id]; return m && m.page ? m.page : 0; };
  B.setPage = function (id, page, day) { var m = marks(); if (page > 0) { m[id] = { page: page, day: day || 0, at: new Date().toISOString() }; } else { delete m[id]; } saveMarks(m); };
  B.lastRead = function () { var m = marks(), best = null; Object.keys(m).forEach(function (id) { if (!best || m[id].at > best.at) { best = { id: id, page: m[id].page, day: m[id].day, at: m[id].at }; } }); return best; };
  B.open = function (book, day) {
    var page = B.page(book.id);
    function stamp() { var m = marks(); m[book.id] = { page: page || 0, day: day || (m[book.id] && m[book.id].day) || 0, at: new Date().toISOString() }; if (m[book.id].page) { saveMarks(m); } }
    function web(u) { var url = page && /\.pdf($|#)/i.test(u) ? u.replace(/#.*$/, '') + '#page=' + page : u; window.open(url, '_blank', 'noopener') || (location.href = url); }
    stamp();
    if (files[book.id]) {
      return S.one('resourceFiles', book.id).then(function (r) {
        if (!r || !r.blob) { return web(book.pdf || book.url); }
        if (window.NativeFiles && NativeFiles.isNative()) { return NativeFiles.shareFile(book.id + '.pdf', r.blob, book.title); }
        if (blobUrl) { URL.revokeObjectURL(blobUrl); } blobUrl = URL.createObjectURL(r.blob);
        var w = window.open(blobUrl + (page ? '#page=' + page : ''), '_blank'); if (!w) { location.href = blobUrl; }
      });
    }
    web(book.pdf || book.url); return Promise.resolve();
  };
  window.Books = B;
})();

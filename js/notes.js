// "My notes" section used under a day on the Calendar and on Today.
// Saves automatically a moment after typing stops, and also has a Save button.

(function () {
  'use strict';

  var S = window.RoadmapStore;
  var pending = null;   // { timer, run }

  var FIELDS = [
    { key: 'did', label: 'What I did today' },
    { key: 'review', label: 'Review: what I learned, what was hard' },
    { key: 'remarks', label: 'Remarks or blockers' }
  ];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  }

  function flush() {
    if (!pending) { return; }
    clearTimeout(pending.timer);
    var run = pending.run;
    pending = null;
    run();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { flush(); }
  });

  function mount(parent, entry, prefix, onChange) {
    flush();
    var wrap = el('section', 'notes');
    wrap.setAttribute('aria-label', 'My notes');
    var title = el('h3', 'notes-title');
    title.appendChild(window.Icons.make('notes'));
    title.appendChild(document.createTextNode(' My notes'));
    wrap.appendChild(title);

    var inputs = {};
    FIELDS.forEach(function (f) {
      var id = prefix + '-note-' + entry.date + '-' + f.key;
      var label = el('label', 'notes-label', f.label);
      label.htmlFor = id;
      var ta = el('textarea', 'notes-input');
      ta.id = id;
      ta.rows = 3;
      ta.placeholder = 'Write your notes here…';
      ta.disabled = true;
      inputs[f.key] = ta;
      wrap.appendChild(label);
      wrap.appendChild(ta);
    });

    var status = el('p', 'notes-status', 'Loading…');
    status.setAttribute('aria-live', 'polite');
    var saveBtn = el('button', 'btn primary');
    saveBtn.type = 'button';
    saveBtn.appendChild(window.Icons.make('save'));
    saveBtn.appendChild(document.createTextNode(' Save notes'));
    saveBtn.disabled = true;
    wrap.appendChild(saveBtn);
    wrap.appendChild(status);
    parent.appendChild(wrap);

    function save() {
      var note = { date: entry.date, day: entry.day, updatedAt: new Date().toISOString() };
      var any = false;
      FIELDS.forEach(function (f) {
        note[f.key] = inputs[f.key].value;
        if (note[f.key].trim()) { any = true; }
      });
      var job = any ? S.saveNote(note) : S.deleteNote(entry.date);
      return job.then(function () {
        status.textContent = any ? 'Saved on this phone.' : 'Nothing to save.';
        if (onChange) { onChange(entry, any); }
      }).catch(function () {
        status.textContent = 'Could not save. Your browser may be blocking storage.';
      });
    }

    function schedule() {
      status.textContent = 'Saving…';
      if (pending) { clearTimeout(pending.timer); }
      pending = { run: save, timer: setTimeout(flush, 800) };
    }

    S.getNote(entry.date).then(function (n) {
      FIELDS.forEach(function (f) {
        inputs[f.key].value = n && n[f.key] ? n[f.key] : '';
        inputs[f.key].disabled = false;
        inputs[f.key].addEventListener('input', schedule);
        inputs[f.key].addEventListener('blur', flush);
      });
      saveBtn.disabled = false;
      saveBtn.addEventListener('click', function () { flush(); save(); });
      status.textContent = n ? 'Saved on this phone.' : 'Notes are saved on this phone only.';
    }).catch(function () {
      status.textContent = 'Notes cannot be saved in this browser.';
    });
  }

  window.DayNotes = { mount: mount, flush: flush };
})();

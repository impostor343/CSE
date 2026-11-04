// Settings: backup / restore (covers ALL stores, including your earlier-version records) and a read-only view of those earlier records.
(function () {
  'use strict';
  var S = window.Store, h = U.h, root = document.getElementById('settings-root'), FORMAT = 'cse-roadmap-backup', msg = h('p', { class: 'muted', role: 'status' });
  function say(t, bad) { msg.textContent = t; msg.className = bad ? 'err' : 'muted'; }
  function card(t) { return h('section', { class: 'card' }, h('h3', { text: t }), [].slice.call(arguments, 1)); }

  function exportBackup() {
    S.dump().then(function (data) {
      var blob = new Blob([JSON.stringify({ format: FORMAT, version: 5, exportedAt: new Date().toISOString(), stores: data }, null, 1)], { type: 'application/json' });
      var fname = 'cse-roadmap-backup-' + U.todayKey() + '.json';
      if (window.NativeFiles && NativeFiles.isNative()) { return NativeFiles.shareFile(fname, blob, 'CSE Roadmap backup').then(function () { return S.put('meta', { key: 'lastBackupAt', value: new Date().toISOString() }); }).then(function () { say('Backup ready. Choose where to save it (Drive, Files, or send it to yourself).'); }); }
      var a = h('a', { href: URL.createObjectURL(blob), download: fname }); document.body.appendChild(a); a.click(); a.remove();
      return S.put('meta', { key: 'lastBackupAt', value: new Date().toISOString() }).then(function () { say('Backup saved to your downloads. It contains every record, including earlier-version records.'); });
    }).catch(function (e) { say('Backup failed: ' + e.message, true); });
  }
  function restore(file) {
    var r = new FileReader();
    r.onload = function () {
      var j; try { j = JSON.parse(r.result); } catch (e) { say('That file is not valid JSON.', true); return; }
      if (!j || j.format !== FORMAT || !j.stores || typeof j.stores !== 'object') { say('That is not a backup made by this app.', true); return; }
      var names = Object.keys(j.stores).filter(function (n) { return S.LEGACY.concat(S.NEW).indexOf(n) !== -1 && Array.isArray(j.stores[n]); });
      if (!names.length) { say('The backup contains no usable data.', true); return; }
      var summary = names.map(function (n) { return n + ': ' + j.stores[n].length; }).join(', ');
      if (!confirm('Replace the data on this device with this backup (' + (j.exportedAt || 'unknown date') + ')?\n\n' + summary + '\n\nTip: export a backup of the current data first.')) { return; }
      S.names().then(function (have) { return Promise.all(names.filter(function (n) { return have.indexOf(n) !== -1; }).map(function (n) { return S.replace(n, j.stores[n]); })); }).then(function () { say('Backup restored. Reloading…'); setTimeout(function () { location.reload(); }, 800); }).catch(function (e) { say('Restore failed: ' + e.message, true); });
    };
    r.readAsText(file);
  }

  function legacy() {
    var box = card('Earlier records (kept, read-only)'); var info = h('p', { class: 'muted small', text: 'Loading…' }); box.appendChild(info);
    Promise.all([S.all('progress').catch(function () { return []; }), S.all('dateNotes').catch(function () { return []; }), S.all('questionState').catch(function () { return []; }), fetch('data/roadmap.json').then(function (r) { return r.json(); }).catch(function () { return { entries: [] }; })]).then(function (res) {
      var prog = res[0], notes = res[1], qs = res[2], old = {}; res[3].entries.forEach(function (e) { old[e.day] = e; });
      if (!prog.length && !notes.length && !qs.length) { info.textContent = 'No records from the earlier date-based version were found on this device.'; return; }
      info.textContent = 'These came from the earlier 253-day, date-based roadmap. They use that version\'s own day numbers, which do not match the new Day 1–1,029 sessions, so they were NOT converted into new completions. They stay safe here and are included in backups.';
      var list = h('div'); prog.sort(function (a, b) { return a.day - b.day; }).forEach(function (p) { var e = old[p.day];
        list.appendChild(h('div', { class: 'item' }, h('strong', { text: 'Earlier day ' + p.day + (e ? ': ' + e.title + ' (' + e.group + ')' : '') }), h('span', { class: 'muted small', text: (p.scheduled || '') + (p.catchup ? ' · catch-up ' + p.catchup : '') + (p.scheduledAt ? ' · ' + U.stamp(p.scheduledAt) : '') }))); });
      notes.sort(function (a, b) { return a.date < b.date ? 1 : -1; }).forEach(function (n) { list.appendChild(h('div', { class: 'item' }, h('strong', { text: 'Note for ' + n.date }), h('span', { class: 'small', text: [n.did, n.review, n.remarks].filter(Boolean).join(' · ') }))); });
      qs.forEach(function (x) { list.appendChild(h('div', { class: 'item' }, h('strong', { text: 'Earlier question ' + x.id + ': ' + x.status }), x.notes ? h('span', { class: 'small', text: x.notes }) : null)); });
      box.appendChild(h('p', { class: 'small', text: prog.length + ' progress records · ' + notes.length + ' notes · ' + qs.length + ' question records' })); box.appendChild(list);
    }).catch(function (e) { info.textContent = 'Could not read earlier records: ' + e.message; });
    return box;
  }

  // ---- Appearance: palette, font, colour mode and text size (applied instantly, saved on this device) ----
  function appearance() {
    var T = window.Theme, box = card('Appearance'); if (!T) { box.appendChild(h('p', { class: 'muted', text: 'Appearance settings could not load.' })); return box; }
    function group(label, list, key, mk) {
      var wrap = h('div', { role: 'group', 'aria-label': label }); wrap.appendChild(h('p', { class: 'set-label', text: label }));
      var inner = h('div', { class: key === 'palette' ? 'swatches' : (key === 'font' ? 'fontlist' : 'segrow') });
      function paint() { var cur = T.get()[key]; [].slice.call(inner.children).forEach(function (b, i) { b.setAttribute('aria-pressed', list[i].id === cur ? 'true' : 'false'); }); }
      list.forEach(function (o) { var b = mk(o); b.addEventListener('click', function () { var p = {}; p[key] = o.id; T.set(p); paint(); if (key === 'palette') { render(); } }); inner.appendChild(b); });
      paint(); wrap.appendChild(inner); return wrap;
    }
    box.appendChild(h('p', { class: 'muted small', text: 'Changes apply instantly and are remembered on this device.' }));
    var colors = h('div', { class: 'custom-colors' });
    [['Card colour 1','primary'],['Card colour 2','secondary'],['Card colour 3','tertiary']].forEach(function (item) {
      var label = h('label', { class: 'custom-color-field' }, h('span', { text: item[0] }));
      var input = h('input', { type: 'color', value: T.get()[item[1]], 'aria-label': item[0] });
      input.addEventListener('input', function () { var patch = {}; patch[item[1]] = input.value; T.set(patch); });
      label.appendChild(input); colors.appendChild(label);
    });
    box.appendChild(colors);
    box.appendChild(group('Colour palette', T.PALETTES, 'palette', function (o) { return h('button', { type: 'button', class: 'swatch' }, h('span', { class: 'dots3' }, o.colors.map(function (c) { return h('i', { style: 'background:' + c }); })), o.name); }));
    box.appendChild(group('Font', T.FONTS, 'font', function (o) { var st = o.id === 'default' ? '' : 'font-family:' + ({ inter: '"Inter",sans-serif', poppins: '"Poppins",sans-serif', lora: '"Lora",serif', classic: 'Georgia,serif', mono: 'ui-monospace,Menlo,Consolas,monospace', studio: '"Bricolage Grotesque",sans-serif', outfit: '"Outfit",sans-serif', editorial: '"Instrument Serif",serif', dev: '"JetBrains Mono",monospace' }[o.id]);
      return h('button', { type: 'button', class: 'fontopt' }, h('span', {}, h('strong', { text: o.name }), h('span', { class: 'muted small fo-note', text: o.note })), h('span', { class: 'sample', style: st, text: 'Aa 123' })); }));
    box.appendChild(group('Light or dark', T.MODES, 'mode', function (o) { return h('button', { type: 'button', class: 'segbtn', text: o.name }); }));
    box.appendChild(group('Text size', T.SIZES, 'size', function (o) { return h('button', { type: 'button', class: 'segbtn', text: o.name }); }));
    box.appendChild(h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn ghost', text: 'Reset appearance', onclick: function () { T.reset(); render(); } })));
    return box;
  }
  // ---- Notifications: daily reminder of today's goal ----
  function notifications() {
    var N = window.Notify, box = card('Notifications');
    if (!N || !N.supported()) { box.appendChild(h('p', { class: 'muted', text: 'This browser cannot show notifications.' })); return box; }
    var st = N.get(), status = h('p', { class: 'muted small' }), preview = h('div', { class: 'notif-preview' });
    box.appendChild(h('p', { class: 'muted small', text: 'Get a daily reminder with today\u2019s goal: the next session you have not finished.' }));
    var toggle = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': st.on ? 'true' : 'false', 'aria-label': 'Daily goal reminder' }, h('i'));
    var time = h('input', { type: 'time', class: 'sel notif-time', value: st.time, 'aria-label': 'Reminder time' });
    box.appendChild(h('div', { class: 'notif-row' }, h('span', { class: 'notif-lab' }, h('strong', { text: 'Remind me every day' }), h('span', { class: 'muted small', text: 'At the time you choose' })), toggle));
    box.appendChild(h('div', { class: 'notif-row' }, h('span', { class: 'notif-lab' }, h('strong', { text: 'Reminder time' })), time));
    function paint() {
      var m = N.preview(); preview.replaceChildren(h('strong', { text: m.title }), h('span', { text: m.body }));
      toggle.setAttribute('aria-checked', N.get().on ? 'true' : 'false');
      N.permission().then(function (p) {
        status.textContent = p === 'denied' ? 'Notifications are blocked. Allow them for Bytewise in your phone or browser settings, then switch this on again.'
          : (N.isNative() ? (N.get().on ? 'Reminder is set. It also works when the app is closed.' : 'Off.') : (N.get().on ? 'On. In a browser the reminder shows while Bytewise is open. Install the Android app for reminders when it is closed.' : 'Off.'));
      });
    }
    toggle.addEventListener('click', function () {
      if (N.get().on) { N.disable().then(paint); } else { N.enable(time.value).then(function (r) { if (r !== 'granted') { status.textContent = 'Permission was not given, so the reminder stays off.'; } paint(); }); }
    });
    time.addEventListener('change', function () { if (time.value) { N.setTime(time.value).then(paint); } });
    box.appendChild(h('p', { class: 'set-label', text: 'What you will see' })); box.appendChild(preview);
    box.appendChild(h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn ghost', text: 'Send a test notification', onclick: function () { N.test().then(function (r) { if (r !== 'granted') { status.textContent = 'Permission was not given, so no test could be sent.'; } }); } })));
    box.appendChild(status); paint(); return box;
  }
  function about() {
    var box = card('Offline and install');
    var st = h('p', { class: 'muted small', text: 'Checking offline support…' }); box.appendChild(st);
    if (window.NativeFiles && NativeFiles.isNative()) { st.textContent = 'You are using the Android app. Everything is stored inside the app and works offline. Use Export backup before uninstalling.'; return box; }
    if (!('serviceWorker' in navigator)) { st.textContent = 'This browser does not support offline install.'; return box; }
    navigator.serviceWorker.getRegistration().then(function (r) { st.textContent = r && r.active ? 'Offline ready: the app and all roadmap data are saved on this device after your first visit. Use the browser menu > Install app / Add to Home screen.' : 'Offline copy is being prepared. Reload once while online, then check again.'; });
    return box;
  }
  // ---- Appearance page: live preview first, then the colour / font / mode / size controls, then a contrast check ----
  function preview() {
    var box = h('section', { class: 'card ap-preview', 'aria-label': 'Live preview' }), row = h('div', { class: 'ap-cards' });
    box.appendChild(h('h3', { text: 'Live preview' }));
    [['a', 'Java basics', 'Day 12'], ['b', 'Collections', 'Day 41'], ['c', 'Spring Boot', 'Day 88']].forEach(function (c) {
      row.appendChild(h('div', { class: 'ap-card pc-' + c[0] }, h('span', { class: 'ap-sym', text: '✦' }), h('strong', { text: c[1] }), h('span', { text: c[2] })));
    });
    box.appendChild(row);
    box.appendChild(h('div', { class: 'ap-row' }, h('span', { class: 'ap-pill', text: 'Pending' }), h('button', { type: 'button', class: 'ap-btn', text: '✓ Done' }), h('button', { type: 'button', class: 'ap-btn alt', text: 'Info' })));
    return box;
  }
  function contrastBox() {
    var T = window.Theme, box = h('section', { class: 'card ap-contrast' }), list = h('div', { class: 'ap-checks' }), fix = h('button', { type: 'button', class: 'btn ghost', text: 'Fix text contrast automatically' });
    box.appendChild(h('h3', { text: 'Contrast check' }));
    box.appendChild(h('p', { class: 'muted small', text: 'Checks that text is readable on each card colour. Pick custom colours above and this updates straight away.' }));
    function paint() {
      var res = T.checks(), bad = res.filter(function (r) { return !r.ok; }).length;
      list.textContent = '';
      res.forEach(function (r) { list.appendChild(h('div', { class: 'ap-check ck-' + (r.ok ? 'ok' : 'bad') }, h('span', { text: r.ok ? '✓' : '✕' }), h('span', { text: r.label }), h('span', { class: 'ap-ratio', text: r.ratio.toFixed(1) + ':1' }))); });
      fix.style.display = bad ? '' : 'none';
    }
    fix.addEventListener('click', function () { T.fixContrast(); render(); });
    box.appendChild(list); box.appendChild(fix); paint();
    new MutationObserver(function () { if (box.isConnected) { paint(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return box;
  }
  function back(title) { return h('div', { class: 'set-back' }, h('a', { href: '#settings', class: 'set-backlink', text: '‹ Settings' }), h('h2', { class: 'set-pagetitle', text: title })); }
  function menu() {
    var rows = [['appearance', '◐', 'Appearance', 'Colours, font, light or dark, text size'], ['reminders', '◷', 'Reminders', 'Daily goal notification'], ['data', '▤', 'Backup and data', 'Export, restore, offline use, earlier records']];
    var box = h('div', { class: 'set-menu' });
    rows.forEach(function (r) { box.appendChild(h('a', { class: 'set-row', href: '#settings/' + r[0] }, h('span', { class: 'set-ico', 'aria-hidden': 'true', text: r[1] }), h('span', { class: 'set-txt' }, h('strong', { text: r[2] }), h('span', { class: 'muted small', text: r[3] })), h('span', { class: 'set-chev', 'aria-hidden': 'true', text: '›' }))); });
    return box;
  }
  function render() {
    root.textContent = '';
    var page = (U.route('settings') || [])[0];
    if (page === 'appearance') { root.appendChild(back('Appearance')); root.appendChild(preview()); root.appendChild(appearance()); if (window.Theme) { root.appendChild(contrastBox()); } return; }
    if (page === 'reminders') { root.appendChild(back('Reminders')); root.appendChild(notifications()); return; }
    if (page === 'data') {
      root.appendChild(back('Backup and data'));
      root.appendChild(card('Backup and restore', h('p', { class: 'muted small', text: 'Your data lives only on this device. Clearing browser data deletes it, so export a backup regularly.' }),
      h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn primary', onclick: exportBackup, text: 'Export backup' }),
        h('label', { class: 'btn ghost' }, 'Restore backup', h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: function () { if (this.files[0]) { restore(this.files[0]); } this.value = ''; } }))), msg));
    root.appendChild(about());
    root.appendChild(legacy());
    S.all('meta').then(function (m) { var b = m.filter(function (x) { return x.key === 'lastBackupAt'; })[0]; root.appendChild(h('p', { class: 'muted small', text: b ? 'Last backup exported: ' + U.stamp(b.value) : 'No backup exported yet from this version.' })); }).catch(function () {});
      return;
    }
    root.appendChild(menu());
  }
  render();
  window.addEventListener('hashchange', function () { if (U.route('settings') !== null) { render(); } });
})();

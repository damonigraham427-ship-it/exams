// Pending workouts (Damoni, Nov 24, 2026): a display-only section on the
// main portal page listing the workout ladder steps not yet completed —
// for each ladder group, its current next step (the first step with no
// date in ladderDates:<file>, using ladder.js's exact merge: seeded steps
// then his added steps from ladderAdded:<file>). A step completes only at
// 5x5, which is what records its date, so "no date" = still pending.
// Read-only: it reads the same localStorage keys the Workout site writes
// (shared origin + sync), so a step finished in the Workout site drops
// off this list on the next load/sync. Named categories with no logged
// data at all also count as pending (Damoni, Nov 24, 2026): a ladder
// group with no steps yet, or a notes list he has never added to
// (no workoutNotes:<file> stored), shows as "Nothing logged yet" and
// never ages out. Editing stays in the Workout
// site — the footer link goes to its checklist page. Renders into
// <section id="pending-box">; needs index.json like the other pages.
(function () {
  var box = document.getElementById('pending-box');
  if (!box) return;

  var CHECKLIST_URL = 'https://damonigraham427-ship-it.github.io/workout/checklist.html';

  function parse(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || 'null');
      return (v && typeof v === 'object') ? v : fallback;
    } catch (e) { return fallback; }
  }

  function parseRaw(key) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null) return null;
      var v = JSON.parse(raw);
      return (v && typeof v === 'object') ? v : null;
    } catch (e) { return null; }
  }

  function shortTitle(e) {
    var t = e.title || e.file || '';
    var pre = (e.category || '') + ' \u2014 ';
    if (e.category && t.indexOf(pre) === 0) return t.slice(pre.length);
    var i = t.indexOf('\u2014');
    return i >= 0 ? t.slice(i + 1).trim() : t;
  }

  // The next undated step of one ladder group (checklist.js ckNextStep).
  function nextStep(entry, group) {
    var dates = parse('ladderDates:' + entry.file, {});
    var added = parse('ladderAdded:' + entry.file, {});
    var steps = (group.steps || []).concat(added[group.name] || []);
    for (var i = 0; i < steps.length; i++) {
      if (!dates[group.name + '|' + steps[i]]) return steps[i];
    }
    return null;
  }

  // Sets progress logged against a step, if any: ladderSets:<file> holds
  // "group|step" -> {v, d} (v = sets value, d = date logged); a legacy
  // plain number is still readable.
  function setsNote(entry, group, step) {
    var all = parse('ladderSets:' + entry.file, {});
    var rec = all[group.name + '|' + step];
    if (rec === undefined || rec === null) return '';
    var v = (typeof rec === 'object') ? rec.v : rec;
    if (v === undefined || v === null || v === '') return '';
    return 'Sets logged: ' + v;
  }

  function render(rows) {
    box.textContent = '';
    var h = document.createElement('h2');
    h.className = 'check-cat';
    h.textContent = 'Pending workouts';
    box.appendChild(h);
    var note = document.createElement('p');
    note.className = 'check-note';
    note.textContent = rows.length
      ? 'The next step waiting on each exercise, plus any category with nothing logged yet. Finish a step at 5x5 in the Workout checklist and it drops off here.'
      : 'Nothing pending \u2014 every ladder step is dated.';
    box.appendChild(note);
    if (rows.length) {
      var table = document.createElement('table');
      table.className = 'check-table';
      var tbody = document.createElement('tbody');
      rows.forEach(function (r) {
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.className = 'tname';
        td.textContent = r.label;
        tr.appendChild(td);
        var td2 = document.createElement('td');
        td2.textContent = r.step;
        tr.appendChild(td2);
        var td3 = document.createElement('td');
        td3.className = 'check-sub';
        td3.textContent = r.sets || '\u2014';
        tr.appendChild(td3);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      box.appendChild(table);
    }
    var p = document.createElement('p');
    var a = document.createElement('a');
    a.href = CHECKLIST_URL;
    a.textContent = 'Open the Workout checklist \u2192';
    p.appendChild(a);
    box.appendChild(p);
  }

  fetch('index.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (idx) {
      var entries = (idx.exams || idx || []).filter(function (e) { return e && (e.ladder || e.notes); });
      var jobs = entries.map(function (e) {
        if (!e.ladder) return Promise.resolve({ entry: e, data: null, notesEntry: true });
        return fetch(e.file, { cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(function (data) { return { entry: e, data: data }; })
          .catch(function () { return null; });
      });
      return Promise.all(jobs);
    })
    .then(function (loaded) {
      var rows = [];
      (loaded || []).forEach(function (item) {
        if (!item) return;
        var e = item.entry;
        if (item.notesEntry) {
          // A named list he has never added to is pending by definition.
          var stored = parseRaw('workoutNotes:' + e.file);
          if (!stored || !stored.length) {
            rows.push({ label: shortTitle(e), step: 'Nothing logged yet', sets: '' });
          }
          return;
        }
        if (!item.data || !Array.isArray(item.data.groups)) return;
        item.data.groups.forEach(function (g) {
          var label = g.name || shortTitle(e);
          var st = shortTitle(e);
          if (st && label.indexOf(st) < 0 && g.name) label = st + ' \u2014 ' + g.name;
          var added = parse('ladderAdded:' + e.file, {});
          var total = (g.steps || []).length + (added[g.name] || []).length;
          if (!total) {
            // Named group with no steps at all: pending, never ages out.
            rows.push({ label: label, step: 'Nothing logged yet', sets: '' });
            return;
          }
          var step = nextStep(e, g);
          if (!step) return;
          rows.push({ label: label, step: step, sets: setsNote(e, g, step) });
        });
      });
      render(rows);
    })
    .catch(function () { render([]); });
})();

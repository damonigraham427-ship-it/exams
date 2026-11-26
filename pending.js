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
// never ages out. Reference Weight is excluded from this list entirely
// (Damoni, Nov 25, 2026): it stays in the Workout portal as-is, it just
// does not appear here. Editing stays in the Workout
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

  // Display groups (Damoni, Nov 25, 2026): the pending list is separated
  // into Upper Body / Abdominal / Lower Body / Running, by entry region.
  // Weight Vest Run and Incline Treadmill count as Running; anything else
  // (Static List, Pump Circumference) falls under General, listed last.
  var GROUPS = ['Upper Body', 'Abdominal', 'Lower Body', 'Running', 'General'];
  function groupOf(e) {
    var r = e.region || '';
    if (r === 'upper') return 'Upper Body';
    if (r === 'abdomen') return 'Abdominal';
    if (r === 'lower') return 'Lower Body';
    if (r === 'running' || r === 'vest' || r === 'incline') return 'Running';
    return 'General';
  }

  // One ladder entry can span body areas (Reference Weight holds a group
  // per body part): a group whose name is itself a body area files under
  // that area; any other group files under its entry's area.
  var GROUP_AREA = {
    'Lower back': 'Lower Body', 'Hamstrings': 'Lower Body', 'Hip Muscles': 'Lower Body',
    'Abdominals': 'Abdominal', 'Obliques': 'Abdominal',
    'Chest': 'Upper Body', 'Shoulders': 'Upper Body', 'Upper back': 'Upper Body',
    'Rotator cuffs': 'Upper Body', 'Lats': 'Upper Body', 'Biceps': 'Upper Body',
    'Triceps': 'Upper Body', 'Forearms': 'Upper Body'
  };
  function groupFor(e, groupName) {
    return GROUP_AREA[groupName] || groupOf(e);
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

  function fmtDate(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return iso || '';
    return Number(p[1]) + '/' + Number(p[2]) + '/' + p[0];
  }

  // Latest dated progress entry per note item (Damoni, Nov 26, 2026):
  // noteProgress:<file> holds { "<item text>": [{d, t}, ...] } written on
  // the Workout list pages. Display only — editing stays there.
  function latestProgress(file) {
    var all = parse('noteProgress:' + file, {});
    var out = [];
    Object.keys(all).forEach(function (text) {
      var arr = Array.isArray(all[text]) ? all[text].slice() : [];
      if (!arr.length) return;
      arr.sort(function (a, b) { return (a.d < b.d ? -1 : a.d > b.d ? 1 : 0); });
      var last = arr[arr.length - 1];
      if (last && last.t) out.push({ text: text, d: last.d, t: last.t });
    });
    return out;
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
      ? 'The next step waiting on each exercise, plus any category with nothing logged yet. Finish a step at 5x5 in the Workout portal and it drops off here.'
      : 'Nothing pending \u2014 every ladder step is dated.';
    box.appendChild(note);
    if (rows.length) {
      GROUPS.forEach(function (gname) {
        var grows = rows.filter(function (r) { return r.group === gname; });
        if (!grows.length) return;
        var gh = document.createElement('h3');
        gh.className = 'pending-group';
        gh.textContent = gname;
        box.appendChild(gh);
        var table = document.createElement('table');
        table.className = 'check-table';
        var tbody = document.createElement('tbody');
        grows.forEach(function (r) {
          var tr = document.createElement('tr');
          if (r.single) {
            var std = document.createElement('td');
            std.colSpan = 3;
            std.textContent = r.single;
            tr.appendChild(std);
            tbody.appendChild(tr);
            return;
          }
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
      });
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
      var entries = (idx.exams || idx || []).filter(function (e) { return e && (e.ladder || e.notes) && !/reference-weight\.json$/.test(e.file || ''); });
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
            rows.push({ label: shortTitle(e), step: 'Nothing logged yet', sets: '', group: groupOf(e) });
          }
          // Items with progress entries show their latest one here, in
          // the note page's own format (Damoni, Nov 26, 2026): the item
          // name, then " · date — text", one line, latest entry only.
          latestProgress(e.file).forEach(function (lp) {
            rows.push({ label: shortTitle(e), step: lp.text, sets: fmtDate(lp.d) + ' \u2014 ' + lp.t, group: groupOf(e), single: lp.text + ' \u00B7 ' + fmtDate(lp.d) + ' \u2014 ' + lp.t });
          });
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
            rows.push({ label: label, step: 'Nothing logged yet', sets: '', group: groupFor(e, g.name) });
            return;
          }
          var step = nextStep(e, g);
          if (!step) return;
          rows.push({ label: label, step: step, sets: setsNote(e, g, step), group: groupFor(e, g.name) });
        });
      });
      render(rows);
    })
    .catch(function () { render([]); });
})();

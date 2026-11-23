// Workout Checklist (Damoni, Nov 23, 2026): one main page tied to all the
// workout circles. For every ladder group it shows the NEXT step that has
// no date yet, with a date entry; saving the date pops the following step
// up in its place. For note lists it shows a quick-log row that appends to
// the list. Writes go to the SAME localStorage keys the ladder and notes
// pages use (ladderDates:<file>, workoutNotes:<file>), so the circles,
// the list pages and this checklist always agree, and sync carries them.
const CK_SECTIONS = [
  { name: 'Upper Body', regions: ['upper'] },
  { name: 'Abdomen', regions: ['abdomen'] },
  { name: 'Lower Body', regions: ['lower'] },
  { name: 'Running & Treadmill', regions: ['running', 'vest', 'incline'] },
  { name: 'General lists', regions: ['general'] }
];

function ckParse(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; }
  catch (err) { return fallback; }
}
function ckSave(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* storage unavailable */ }
}
function ckShort(title) {
  return String(title || '').replace(/^Upper Body \u2014 /, '').replace(/^Lower Body \u2014 /, '')
    .replace(/^Abdomen \u2014 /, '').replace(/^Running \u2014 /, '')
    .replace(/^Weight Vest Run \u2014 /, '').replace(/^Incline Treadmill \u2014 /, '');
}
function ckToday() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// The next undated step of one ladder group, using ladder.js's exact merge:
// seeded steps first, then his added steps; a step is done when
// ladderDates:<file> holds "group|step".
function ckNextStep(entry, group) {
  const dates = ckParse('ladderDates:' + entry.file, {});
  const added = ckParse('ladderAdded:' + entry.file, {});
  const steps = (group.steps || []).concat(added[group.name] || []);
  for (const s of steps) {
    if (!dates[group.name + '|' + s]) return s;
  }
  return null;
}

function ckLadderRow(entry, group, host) {
  const row = document.createElement('div');
  row.className = 'ck-row';

  const main = document.createElement('div');
  main.className = 'ck-main';
  const label = document.createElement('span');
  label.className = 'ck-label';
  // The date the last successful tier of this group was completed
  // (Damoni, Nov 23, 2026), shown under the current goal.
  const last = document.createElement('span');
  last.className = 'ck-last';
  main.appendChild(label);
  main.appendChild(last);
  // Three attempt boxes beside the weight goal (Damoni, Nov 23, 2026): a
  // check here means an attempt was made but the feat was not completed.
  // Stored per step in ladderAttempts:<file> as "group|step" -> 1..3.
  const tries = document.createElement('span');
  tries.className = 'ck-tries';
  const triesLabel = document.createElement('span');
  triesLabel.className = 'ck-tries-label';
  triesLabel.textContent = 'tried';
  tries.appendChild(triesLabel);
  const tryBtns = [];
  for (let i = 0; i < 3; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ck-try';
    b.addEventListener('click', () => {
      const step = ckNextStep(entry, group);
      if (!step) return;
      const key = group.name + '|' + step;
      const all = ckParse('ladderAttempts:' + entry.file, {});
      const cur = all[key] || 0;
      const next = (cur === i + 1) ? i : i + 1;
      if (next) all[key] = next; else delete all[key];
      ckSave('ladderAttempts:' + entry.file, all);
      paintTries(step);
    });
    tryBtns.push(b);
    tries.appendChild(b);
  }
  function paintTries(step) {
    const all = ckParse('ladderAttempts:' + entry.file, {});
    const n = all[group.name + '|' + step] || 0;
    tryBtns.forEach((b, i) => {
      b.textContent = i < n ? '\u2713' : '';
      b.classList.toggle('on', i < n);
    });
  }
  const dateIn = document.createElement('input');
  dateIn.type = 'date';
  dateIn.value = ckToday();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ck-btn';
  btn.textContent = 'Done';

  function show(step, animate) {
    label.textContent = ckShort(entry.title) + ' \u2014 ' + group.name + ' \u00B7 ' + step;
    const dates = ckParse('ladderDates:' + entry.file, {});
    const added = ckParse('ladderAdded:' + entry.file, {});
    const steps = (group.steps || []).concat(added[group.name] || []);
    let lastDate = null;
    for (let i = 0; i < steps.length && steps[i] !== step; i++) {
      if (dates[group.name + '|' + steps[i]]) lastDate = dates[group.name + '|' + steps[i]];
    }
    last.textContent = 'Last done: ' + (lastDate || '\u2014');
    paintTries(step);
    dateIn.value = ckToday();
    btn.textContent = 'Done';
    btn.disabled = false;
    if (animate) { row.classList.remove('ck-in'); void row.offsetWidth; row.classList.add('ck-in'); }
  }

  btn.addEventListener('click', () => {
    const step = ckNextStep(entry, group);
    if (!step || !dateIn.value) return;
    const dates = ckParse('ladderDates:' + entry.file, {});
    dates[group.name + '|' + step] = dateIn.value;
    ckSave('ladderDates:' + entry.file, dates);
    btn.textContent = '\u2713';
    btn.disabled = true;
    row.classList.add('ck-done');
    setTimeout(() => {
      row.classList.remove('ck-done');
      const next = ckNextStep(entry, group);
      if (next) { show(next, true); return; }
      row.classList.add('ck-out');
      setTimeout(() => {
        row.remove();
        if (!host.querySelector('.ck-row')) {
          const p = document.createElement('p');
          p.className = 'ck-caught';
          p.textContent = 'All caught up here \u2713';
          host.appendChild(p);
        }
      }, 420);
    }, 650);
  });

  row.appendChild(main);
  row.appendChild(tries);
  row.appendChild(dateIn);
  row.appendChild(btn);
  show(ckNextStep(entry, group), false);
  return row;
}

function ckNotesRow(entry, seeded) {
  const row = document.createElement('div');
  row.className = 'ck-row';
  const label = document.createElement('span');
  label.className = 'ck-label';
  label.textContent = ckShort(entry.title);
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = 'Log an entry\u2026';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ck-btn';
  btn.textContent = 'Add';
  function add() {
    const text = inp.value.trim();
    if (!text) return;
    const key = 'workoutNotes:' + entry.file;
    const stored = ckParse(key, null);
    const list = Array.isArray(stored) ? stored.slice() : (seeded || []).slice();
    if (Array.isArray(stored)) (seeded || []).forEach(b => { if (list.indexOf(b) === -1) list.push(b); });
    list.push(text);
    ckSave(key, list);
    inp.value = '';
    btn.textContent = 'Logged \u2713';
    setTimeout(() => { btn.textContent = 'Add'; }, 1200);
  }
  btn.addEventListener('click', add);
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') add(); });
  row.appendChild(label);
  row.appendChild(inp);
  row.appendChild(btn);
  return row;
}

async function ckInit() {
  const host = document.getElementById('ck-host');
  const idx = await (await fetch('index.json', { cache: 'no-store' })).json();
  const entries = (idx.exams || []).filter(e => e.category === 'Workout Elements');
  const data = {};
  await Promise.all(entries.map(async e => {
    try { data[e.file] = await (await fetch(e.file, { cache: 'no-store' })).json(); }
    catch (err) { data[e.file] = null; }
  }));
  host.innerHTML = '';
  CK_SECTIONS.forEach(sec => {
    const inSec = entries.filter(e => sec.regions.indexOf(e.region || 'general') !== -1);
    if (!inSec.length) return;
    const h = document.createElement('h2');
    h.className = 'ck-sec';
    h.textContent = sec.name;
    host.appendChild(h);
    const list = document.createElement('div');
    host.appendChild(list);
    let rows = 0;
    inSec.forEach(e => {
      const d = data[e.file];
      if (e.ladder && d && Array.isArray(d.groups)) {
        d.groups.forEach(g => {
          if (ckNextStep(e, g)) { list.appendChild(ckLadderRow(e, g, list)); rows++; }
        });
      } else if (e.notes) {
        list.appendChild(ckNotesRow(e, (d && d.notes) || []));
        rows++;
      }
    });
    if (!rows) {
      const p = document.createElement('p');
      p.className = 'ck-caught';
      p.textContent = 'All caught up here \u2713';
      list.appendChild(p);
    }
  });
}

ckInit();

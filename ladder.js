const params = new URLSearchParams(location.search);
const file = params.get('ladder');
const storeKey = 'ladderDates:' + file;
let dates = {};
try { dates = JSON.parse(localStorage.getItem(storeKey) || '{}') || {}; } catch (err) { dates = {}; }

function save() {
  try { localStorage.setItem(storeKey, JSON.stringify(dates)); } catch (err) { /* storage unavailable */ }
}

function render(data) {
  const wrap = document.getElementById('ladder-groups');
  wrap.innerHTML = '';
  (data.groups || []).forEach((g, gi) => {
    const h = document.createElement('h2');
    h.className = 'ladder-group';
    h.textContent = g.name;
    wrap.appendChild(h);
    const ul = document.createElement('ul');
    ul.className = 'ladder-steps';
    (g.steps || []).forEach((step, si) => {
      const key = gi + '-' + si;
      const li = document.createElement('li');
      li.className = 'ladder-row';
      const label = document.createElement('span');
      label.className = 'ladder-step';
      label.textContent = step;
      const input = document.createElement('input');
      input.type = 'date';
      input.className = 'ladder-date';
      input.value = dates[key] || '';
      input.addEventListener('change', () => {
        if (input.value) dates[key] = input.value; else delete dates[key];
        save();
      });
      li.appendChild(label);
      li.appendChild(input);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
  });
}

if (!file) {
  document.getElementById('ladder-title').textContent = 'Ladder';
} else {
  Promise.all([
    fetch('index.json', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
    fetch(file, { cache: 'no-store' }).then(r => r.json()).catch(() => null)
  ]).then(([index, data]) => {
    if (index && Array.isArray(index.exams)) {
      const entry = index.exams.find(e => e.file === file);
      if (entry && entry.title) document.getElementById('ladder-title').textContent = entry.title;
    }
    if (data) render(data);
  });
}

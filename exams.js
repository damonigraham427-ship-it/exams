const PALETTE = ['#2563eb', '#b91c1c', '#047857', '#b45309', '#6d28d9', '#0e7490'];
let allExams = [];
let cards = [];
let view = 'categories';
let selCategory = null;
let selChapter = null;

function setView() {
  document.getElementById('level-categories').hidden = view !== 'categories';
  document.getElementById('level-chapters').hidden = view !== 'chapters';
  document.getElementById('level-exams').hidden = view !== 'exams';
  const back = document.getElementById('back-btn');
  const crumb = document.getElementById('crumb');
  if (view === 'categories') {
    back.hidden = true;
    crumb.textContent = 'Exams';
  } else if (view === 'chapters') {
    back.hidden = false;
    back.textContent = '\u2190 Exams';
    crumb.textContent = 'Exams / ' + selCategory;
  } else {
    back.hidden = false;
    back.textContent = '\u2190 ' + selCategory;
    crumb.textContent = 'Exams / ' + selCategory + ' / Chapter ' + selChapter;
  }
}

function navCard(label, sub, color, onclick) {
  const b = document.createElement('button');
  b.className = 'nav-card';
  b.style.borderTopColor = color;
  b.textContent = label;
  const s = document.createElement('small');
  s.textContent = sub;
  b.appendChild(s);
  b.addEventListener('click', onclick);
  return b;
}

function renderCategories() {
  const wrap = document.getElementById('level-categories');
  wrap.innerHTML = '';
  const cats = [];
  allExams.forEach(e => {
    const c = e.category || 'General';
    if (!cats.includes(c)) cats.push(c);
  });
  cats.forEach((c, i) => {
    const inCat = allExams.filter(e => (e.category || 'General') === c);
    const chs = new Set(inCat.map(e => e.chapter === undefined ? 'Other' : String(e.chapter)));
    const n = chs.size;
    wrap.appendChild(navCard(c, n + (n === 1 ? ' chapter' : ' chapters'), PALETTE[i % PALETTE.length], () => {
      selCategory = c;
      renderChapters();
      view = 'chapters';
      setView();
    }));
  });
}

function renderChapters() {
  const wrap = document.getElementById('level-chapters');
  wrap.innerHTML = '';
  const inCat = allExams.filter(e => (e.category || 'General') === selCategory);
  const chs = [];
  inCat.forEach(e => {
    const ch = e.chapter === undefined ? 'Other' : String(e.chapter);
    if (!chs.includes(ch)) chs.push(ch);
  });
  chs.forEach((ch, i) => {
    const n = inCat.filter(e => (e.chapter === undefined ? 'Other' : String(e.chapter)) === ch).length;
    const label = ch === 'Other' ? 'Other' : 'Chapter ' + ch;
    wrap.appendChild(navCard(label, n + (n === 1 ? ' exam' : ' exams'), PALETTE[i % PALETTE.length], () => {
      selChapter = ch;
      cards.forEach(card => {
        card.style.display = (card.dataset.category === selCategory && card.dataset.chapter === selChapter) ? '' : 'none';
      });
      view = 'exams';
      setView();
    }));
  });
}

function buildCards() {
  const wrap = document.getElementById('exam-cards');
  allExams.forEach((e, i) => {
    const n = i + 1;
    const color = PALETTE[(n - 1) % PALETTE.length];
    const parts = e.title.split('—');
    const cat = parts.length > 1 ? parts[0].trim() : 'Exam';
    const name = parts.length > 1 ? parts.slice(1).join('—').trim() : e.title;

    const card = document.createElement('section');
    card.className = 'exam-card' + (e.placeholder ? ' placeholder' : '');
    card.style.borderTopColor = color;
    card.id = 'exam-' + n;
    card.dataset.category = e.category || 'General';
    card.dataset.chapter = e.chapter === undefined ? 'Other' : String(e.chapter);

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.style.background = color;
    badge.textContent = 'EXAM ' + n;
    card.appendChild(badge);

    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = cat;
    card.appendChild(chip);

    const h = document.createElement('h2');
    h.textContent = name;
    card.appendChild(h);

    if (e.note) {
      const p = document.createElement('p');
      p.textContent = e.note;
      card.appendChild(p);
    }

    if (e.placeholder) {
      const s = document.createElement('span');
      s.className = 'not-built';
      s.textContent = 'Not built yet';
      card.appendChild(s);
    } else {
      const a = document.createElement('a');
      a.className = 'start-btn';
      a.href = 'exam.html?exam=' + encodeURIComponent(e.file);
      a.textContent = 'Start exam';
      card.appendChild(a);

      try {
        const prog = JSON.parse(localStorage.getItem('examProgress') || '{}');
        const p = prog[e.file];
        if (p && p.idx !== undefined && p.total) {
          const pp = document.createElement('p');
          pp.className = 'history';
          pp.textContent = 'In progress — question ' + (p.idx + 1) + ' of ' + p.total;
          card.appendChild(pp);
        }
      } catch (err) { /* no saved progress */ }

      try {
        const hist = JSON.parse(localStorage.getItem('examHistory') || '{}');
        const attempts = hist[e.file];
        if (Array.isArray(attempts) && attempts.length) {
          const last = attempts[0];
          const d = new Date(last.ts);
          const hp = document.createElement('p');
          hp.className = 'history';
          hp.textContent = 'Last attempt: ' + last.score + '/' + last.total + ' · ' + last.missed.length + ' missed' +
            (last.flagged && last.flagged.length ? ' · ' + last.flagged.length + ' flagged' : '') + ' · ' +
            d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          card.appendChild(hp);
        }
      } catch (err) { /* no saved history */ }
    }

    wrap.appendChild(card);
    cards.push(card);
  });
}

fetch('index.json')
  .then(r => r.json())
  .then(data => {
    allExams = data.exams || [];
    if (!allExams.length) {
      document.getElementById('empty').hidden = false;
      document.getElementById('level-exams').hidden = false;
      return;
    }
    buildCards();
    renderCategories();
    view = 'categories';
    setView();
  });

document.getElementById('back-btn').addEventListener('click', () => {
  if (view === 'exams') { view = 'chapters'; }
  else if (view === 'chapters') { view = 'categories'; }
  setView();
  window.scrollTo({ top: 0 });
});

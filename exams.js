const PALETTE = ['#2563eb', '#b91c1c', '#047857', '#b45309', '#6d28d9', '#0e7490'];
let allExams = [];
let cards = [];
let view = 'categories';
let selCategory = null;
let selChapter = null;

function chapterLabel(ch) {
  return /^\d+$/.test(ch) ? 'Chapter ' + ch : ch;
}

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
  } else if (selChapter === 'Other') {
    back.hidden = false;
    back.textContent = '\u2190 Exams';
    crumb.textContent = 'Exams / ' + selCategory;
  } else {
    back.hidden = false;
    back.textContent = '\u2190 ' + selCategory;
    crumb.textContent = 'Exams / ' + selCategory + ' / ' + chapterLabel(selChapter);
  }
  const cl = document.getElementById('checklist-link');
  if (cl) {
    const testsIn = list => list.some(e => !e.notes && !e.placeholder && !e.ladder);
    if (view === 'categories') {
      cl.hidden = false;
      cl.href = 'checklist.html';
      cl.textContent = 'Checklist — attempts, correct, wrong, needs review';
    } else if (view === 'chapters') {
      const inCat = allExams.filter(e => (e.category || 'General') === selCategory);
      if (testsIn(inCat)) {
        cl.hidden = false;
        cl.href = 'checklist.html?cat=' + encodeURIComponent(selCategory);
        cl.textContent = 'Checklist — ' + selCategory;
      } else {
        cl.hidden = true;
      }
    } else if (selChapter === 'Other') {
      const inCat = allExams.filter(e => (e.category || 'General') === selCategory);
      if (testsIn(inCat)) {
        cl.hidden = false;
        cl.href = 'checklist.html?cat=' + encodeURIComponent(selCategory);
        cl.textContent = 'Checklist — ' + selCategory;
      } else {
        cl.hidden = true;
      }
    } else {
      const inCh = allExams.filter(e => (e.category || 'General') === selCategory &&
        (e.chapter === undefined ? 'Other' : String(e.chapter)) === String(selChapter));
      if (testsIn(inCh)) {
        cl.hidden = false;
        cl.href = 'checklist.html?cat=' + encodeURIComponent(selCategory) + '&ch=' + encodeURIComponent(selChapter);
        cl.textContent = 'Checklist — ' + selCategory + ' / ' + chapterLabel(selChapter);
      } else {
        cl.hidden = true;
      }
    }
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
    if (n === 1 && chs.has('Other')) {
      wrap.appendChild(navCard(c, inCat.length + (inCat.length === 1 ? ' exam' : ' exams'), PALETTE[i % PALETTE.length], () => {
        selCategory = c;
        selChapter = 'Other';
        cards.forEach(card => {
          card.style.display = (card.dataset.category === selCategory && card.dataset.chapter === selChapter) ? '' : 'none';
        });
        view = 'exams';
        setView();
      }));
    } else {
      wrap.appendChild(navCard(c, n + (n === 1 ? ' chapter' : ' chapters'), PALETTE[i % PALETTE.length], () => {
        selCategory = c;
        renderChapters();
        view = 'chapters';
        setView();
      }));
    }
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
    const label = chapterLabel(ch);
    if (selCategory === 'NREMT' && ch !== 'Other') {
      wrap.appendChild(navCard(label, 'topic circle \u00B7 practice by topic', PALETTE[i % PALETTE.length], () => {
        location.href = 'topics.html?ch=' + encodeURIComponent(ch);
      }));
      return;
    }
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

    if (e.ladder) {
      const la = document.createElement('a');
      la.className = 'start-btn';
      la.href = 'ladder.html?ladder=' + encodeURIComponent(e.file);
      la.textContent = 'Open list';
      card.appendChild(la);
    } else if (e.notes) {
      const na = document.createElement('a');
      na.className = 'start-btn';
      na.href = 'notes.html?notes=' + encodeURIComponent(e.file);
      na.textContent = 'Open list';
      card.appendChild(na);
    } else if (e.placeholder) {
      const s = document.createElement('span');
      s.className = 'not-built';
      s.textContent = 'Not built yet';
      card.appendChild(s);
    } else {
if (e.draw) {
        const m10 = document.createElement('a');
        m10.className = 'start-btn alt';
        m10.href = 'exam.html?exam=' + encodeURIComponent(e.file) + '&mode=meta10';
        m10.textContent = 'Meta 10% exam';
        card.appendChild(m10);
        try {
          const prog5 = JSON.parse(localStorage.getItem('examProgress') || '{}');
          const mp10 = prog5[e.file + '#meta10'];
          if (mp10 && mp10.idx !== undefined && mp10.total) {
            const mpp10 = document.createElement('p');
            mpp10.className = 'history';
            mpp10.textContent = 'Meta 10 in progress \u2014 question ' + (mp10.idx + 1) + ' of ' + mp10.total;
            card.appendChild(mpp10);
          }
        } catch (err) { /* no saved meta10 progress */ }
      }

      if (e.draw) {
        const mt = document.createElement('a');
        mt.className = 'start-btn alt';
        mt.href = 'exam.html?exam=' + encodeURIComponent(e.file) + '&mode=meta';
        mt.textContent = 'Meta exam';
        card.appendChild(mt);
        try {
          const prog4 = JSON.parse(localStorage.getItem('examProgress') || '{}');
          const mp = prog4[e.file + '#meta'];
          if (mp && mp.idx !== undefined && mp.total) {
            const mpp = document.createElement('p');
            mpp.className = 'history';
            mpp.textContent = 'Meta in progress \u2014 question ' + (mp.idx + 1) + ' of ' + mp.total;
            card.appendChild(mpp);
          }
        } catch (err) { /* no saved meta progress */ }
      }

      if (e.redundancy) {
        const r = document.createElement('a');
        r.className = 'start-btn alt';
        r.href = 'exam.html?exam=' + encodeURIComponent(e.file) + '&mode=redundancy';
        r.textContent = 'Redundancy exam';
        card.appendChild(r);
        try {
          const prog2 = JSON.parse(localStorage.getItem('examProgress') || '{}');
          const rp = prog2[e.file + '#redundancy'];
          if (rp && rp.idx !== undefined && rp.total) {
            const rpp = document.createElement('p');
            rpp.className = 'history';
            rpp.textContent = 'Redundancy in progress \u2014 question ' + (rp.idx + 1) + ' of ' + rp.total;
            card.appendChild(rpp);
          }
        } catch (err) { /* no saved redundancy progress */ }
      }

if (e.draw) {
        const cv = document.createElement('a');
        cv.className = 'start-btn alt';
        cv.href = 'exam.html?exam=' + encodeURIComponent(e.file) + '&mode=coverage';
        cv.textContent = 'Coverage exam';
        card.appendChild(cv);
        try {
          const prog3 = JSON.parse(localStorage.getItem('examProgress') || '{}');
          const cp = prog3[e.file + '#coverage'];
          if (cp && cp.idx !== undefined && cp.total) {
            const cpp = document.createElement('p');
            cpp.className = 'history';
            cpp.textContent = 'Coverage in progress \u2014 question ' + (cp.idx + 1) + ' of ' + cp.total;
            card.appendChild(cpp);
          }
        } catch (err) { /* no saved coverage progress */ }
      }

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

fetch('index.json', { cache: 'no-store' })
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
  if (view === 'exams') { view = selChapter === 'Other' ? 'categories' : 'chapters'; }
  else if (view === 'chapters') { view = 'categories'; }
  setView();
  window.scrollTo({ top: 0 });
});

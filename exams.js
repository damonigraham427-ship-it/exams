const PALETTE = ['#2563eb', '#b91c1c', '#047857', '#b45309', '#6d28d9', '#0e7490'];
let cards = [];
let headings = [];
let current = -1;

function visibleCards() {
  return cards.filter(c => c.style.display !== 'none');
}

function resetScrollBtn() {
  const btn = document.getElementById('scroll-btn');
  current = -1;
  cards.forEach(c => c.classList.remove('current'));
  btn.innerHTML = 'Next exam &darr;';
  btn.hidden = visibleCards().length === 0;
}

function refreshHeadings() {
  headings.forEach(h => {
    const anyVisible = cards.some(c => c.dataset.chapter === h.dataset.chapter && c.style.display !== 'none');
    h.style.display = anyVisible ? '' : 'none';
  });
}

fetch('index.json')
  .then(r => r.json())
  .then(data => {
    const wrap = document.getElementById('exam-cards');
    const btn = document.getElementById('scroll-btn');
    if (!data.exams.length) {
      document.getElementById('empty').hidden = false;
      btn.hidden = true;
      return;
    }
    // Group exams by chapter, preserving the order chapters first appear.
    const chapterOrder = [];
    const byChapter = {};
    data.exams.forEach(e => {
      const ch = e.chapter === undefined ? 'Other' : String(e.chapter);
      if (!byChapter[ch]) { byChapter[ch] = []; chapterOrder.push(ch); }
      byChapter[ch].push(e);
    });

    let n = 0;
    chapterOrder.forEach(ch => {
      const heading = document.createElement('h2');
      heading.className = 'chapter-heading';
      heading.dataset.chapter = ch;
      heading.textContent = ch === 'Other' ? 'Other' : 'Chapter ' + ch;
      wrap.appendChild(heading);
      headings.push(heading);

      byChapter[ch].forEach(e => {
        n++;
        const color = PALETTE[(n - 1) % PALETTE.length];
        const parts = e.title.split('—');
        const cat = parts.length > 1 ? parts[0].trim() : 'Exam';
        const name = parts.length > 1 ? parts.slice(1).join('—').trim() : e.title;

        const card = document.createElement('section');
        card.className = 'exam-card' + (e.placeholder ? ' placeholder' : '');
        card.style.borderTopColor = color;
        card.id = 'exam-' + n;
        card.dataset.category = e.category || 'General';
        card.dataset.chapter = ch;

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
    });
  });

document.querySelectorAll('.subtab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const f = tab.dataset.filter;
    cards.forEach(c => {
      c.style.display = (f === 'all' || c.dataset.category === f) ? '' : 'none';
    });
    refreshHeadings();
    resetScrollBtn();
  });
});

document.getElementById('scroll-btn').addEventListener('click', () => {
  const vis = visibleCards();
  if (!vis.length) return;
  const btn = document.getElementById('scroll-btn');
  if (current === vis.length - 1) {
    current = -1;
    cards.forEach(c => c.classList.remove('current'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    btn.innerHTML = 'Next exam &darr;';
    return;
  }
  current = current + 1;
  cards.forEach(c => c.classList.remove('current'));
  const card = vis[current];
  card.classList.add('current');
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  btn.innerHTML = current === vis.length - 1 ? 'Back to top &uarr;' : 'Next exam &darr;';
});

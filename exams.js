const PALETTE = ['#2563eb', '#b91c1c', '#047857', '#b45309', '#6d28d9', '#0e7490'];
let cards = [];
let current = -1;

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
    data.exams.forEach((e, i) => {
      const color = PALETTE[i % PALETTE.length];
      const parts = e.title.split('—');
      const cat = parts.length > 1 ? parts[0].trim() : 'Exam';
      const name = parts.length > 1 ? parts.slice(1).join('—').trim() : e.title;

      const card = document.createElement('section');
      card.className = 'exam-card';
      card.style.borderTopColor = color;
      card.id = 'exam-' + (i + 1);

      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.style.background = color;
      badge.textContent = 'EXAM ' + (i + 1);
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

      const a = document.createElement('a');
      a.className = 'start-btn';
      a.href = 'exam.html?exam=' + encodeURIComponent(e.file);
      a.textContent = 'Start exam';
      card.appendChild(a);

      wrap.appendChild(card);
      cards.push(card);
    });
  });

document.getElementById('scroll-btn').addEventListener('click', () => {
  if (!cards.length) return;
  const btn = document.getElementById('scroll-btn');
  if (current === cards.length - 1) {
    current = -1;
    cards.forEach(c => c.classList.remove('current'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    btn.innerHTML = 'Next exam &darr;';
    return;
  }
  current = current + 1;
  cards.forEach(c => c.classList.remove('current'));
  const card = cards[current];
  card.classList.add('current');
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  btn.innerHTML = current === cards.length - 1 ? 'Back to top &uarr;' : 'Next exam &darr;';
});

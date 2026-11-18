const file = new URLSearchParams(location.search).get('exam');
let exam, examTitle = file, idx = 0, score = 0;
const answers = [];
let lastMissed = [];
let lastFlagged = [];
const flagged = new Set();
let entry = null;
let runOrder = null;

function shuffleIdx(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

Promise.all([
  fetch('index.json').then(r => r.json()).catch(() => null),
  fetch(file).then(r => r.json())
]).then(([idxData, data]) => {
  entry = ((idxData && idxData.exams) || []).find(e => e.file === file) || null;
  if (entry) examTitle = entry.title;
  document.getElementById('exam-title').textContent = examTitle;
  exam = data;
  if (data.title) { examTitle = data.title; document.getElementById('exam-title').textContent = examTitle; }
  const pool = data.questions;
  try {
    const all = JSON.parse(localStorage.getItem(PKEY) || '{}');
    const p = all[file];
    if (entry && entry.draw) {
      const drawN = Math.min(entry.draw, pool.length);
      let restored = false;
      if (p && Array.isArray(p.order) && p.order.length === drawN && p.total === drawN &&
          p.order.every(i => i >= 0 && i < pool.length) && p.idx < drawN) {
        runOrder = p.order;
        idx = p.idx; score = p.score || 0;
        (p.answers || []).forEach((a, i) => { answers[i] = a; });
        (p.flagged || []).forEach(i => flagged.add(i));
        restored = true;
      }
      if (!restored) runOrder = shuffleIdx(pool.length).slice(0, drawN);
      exam = Object.assign({}, data, { questions: runOrder.map(i => pool[i]) });
    } else if (p && p.total === pool.length && p.idx < pool.length) {
      idx = p.idx; score = p.score || 0;
      (p.answers || []).forEach((a, i) => { answers[i] = a; });
      (p.flagged || []).forEach(i => flagged.add(i));
    }
  } catch (e) { /* no saved progress */ }
  show();
  renderAnswered();
});

function refreshFlagBtn() {
  const btn = document.getElementById('flag-btn');
  const on = flagged.has(idx);
  btn.textContent = on ? '\u2605 Flagged for practice' : '\u2606 Needs more practice';
  btn.classList.toggle('flagged-on', on);
}

const PKEY = 'examProgress';
function saveProgress() {
  try {
    const all = JSON.parse(localStorage.getItem(PKEY) || '{}');
    const rec = { idx: idx, answers: answers, flagged: [...flagged], score: score, total: exam.questions.length, ts: Date.now() };
    if (runOrder) rec.order = runOrder;
    all[file] = rec;
    localStorage.setItem(PKEY, JSON.stringify(all));
  } catch (e) { /* storage unavailable */ }
}
function clearProgress() {
  try {
    const all = JSON.parse(localStorage.getItem(PKEY) || '{}');
    delete all[file];
    localStorage.setItem(PKEY, JSON.stringify(all));
  } catch (e) { /* storage unavailable */ }
}
function renderAnswered() {
  const q = exam.questions[idx];
  const picked = answers[idx];
  if (picked === undefined) return;
  document.querySelectorAll('button.choice').forEach((b, i) => {
    b.disabled = true;
    if (i === picked) b.className += picked === q.answer ? ' correct' : ' wrong';
  });
  document.getElementById('feedback').textContent =
    (picked === q.answer ? 'Correct. ' : 'Wrong. Answer: ' + q.choices[q.answer] + '. ') + (q.explanation || '');
  document.getElementById('next-btn').hidden = false;
}

function show() {
  const q = exam.questions[idx];
  document.getElementById('progress').textContent = 'Question ' + (idx + 1) + ' of ' + exam.questions.length;
  document.getElementById('question-text').textContent = q.question;
  document.getElementById('source-line').textContent = q.source ? 'Deck: ' + q.source : '';
  document.getElementById('feedback').textContent = '';
  document.getElementById('next-btn').hidden = true;
  refreshFlagBtn();
  const box = document.getElementById('choices');
  box.innerHTML = '';
  q.choices.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'choice';
    b.textContent = c;
    b.onclick = () => pick(i, b);
    box.appendChild(b);
  });
}

function pick(i, btn) {
  const q = exam.questions[idx];
  answers[idx] = i;
  document.querySelectorAll('button.choice').forEach(b => b.disabled = true);
  const right = i === q.answer;
  if (right) score++;
  btn.className += right ? ' correct' : ' wrong';
  document.getElementById('feedback').textContent =
    (right ? 'Correct. ' : 'Wrong. Answer: ' + q.choices[q.answer] + '. ') + (q.explanation || '');
  document.getElementById('next-btn').hidden = false;
  saveProgress();
}

function finish() {
  clearProgress();
  document.getElementById('question-box').hidden = true;
  document.getElementById('progress').textContent = '';
  document.getElementById('result-box').hidden = false;
  document.getElementById('score').textContent = 'Score: ' + score + ' of ' + exam.questions.length;

  lastMissed = [];
  exam.questions.forEach((q, i) => {
    if (answers[i] !== q.answer) {
      lastMissed.push({
        n: i + 1,
        question: q.question,
        source: q.source || '',
        your: answers[i] === undefined ? '(no answer)' : q.choices[answers[i]],
        correct: q.choices[q.answer],
        explanation: q.explanation || ''
      });
    }
  });

  const list = document.getElementById('missed-list');
  list.innerHTML = '';
  lastMissed.forEach(m => {
    const li = document.createElement('li');
    li.textContent = m.question + ' — Your answer: ' + m.your + ' · Correct: ' + m.correct + (m.source ? ' · Deck: ' + m.source : '') + (m.explanation ? ' · ' + m.explanation : '');
    list.appendChild(li);
  });
  document.getElementById('no-missed').hidden = lastMissed.length !== 0;

  lastFlagged = [...flagged].sort((a, b) => a - b).map(i => {
    const q = exam.questions[i];
    return {
      n: i + 1,
      question: q.question,
      source: q.source || '',
      correct: q.choices[q.answer],
      explanation: q.explanation || '',
      result: answers[i] === q.answer ? 'answered correctly' : 'answered incorrectly'
    };
  });
  const flist = document.getElementById('flagged-list');
  flist.innerHTML = '';
  lastFlagged.forEach(m => {
    const li = document.createElement('li');
    li.textContent = m.question + ' — Correct: ' + m.correct + ' · You ' + m.result + (m.source ? ' · Deck: ' + m.source : '') + (m.explanation ? ' · ' + m.explanation : '');
    flist.appendChild(li);
  });
  document.getElementById('no-flagged').hidden = lastFlagged.length !== 0;

  try {
    const all = JSON.parse(localStorage.getItem('examHistory') || '{}');
    if (!Array.isArray(all[file])) all[file] = [];
    all[file].unshift({ ts: new Date().toISOString(), title: examTitle, score: score, total: exam.questions.length, missed: lastMissed, flagged: lastFlagged });
    all[file] = all[file].slice(0, 20);
    localStorage.setItem('examHistory', JSON.stringify(all));
  } catch (e) { /* storage unavailable; results still shown on screen */ }
}

document.getElementById('flag-btn').onclick = () => {
  if (flagged.has(idx)) flagged.delete(idx); else flagged.add(idx);
  refreshFlagBtn();
  saveProgress();
};
document.getElementById('next-btn').onclick = () => {
  idx++;
  if (idx < exam.questions.length) { show(); saveProgress(); return; }
  finish();
};
document.getElementById('retry-btn').onclick = () => { clearProgress(); location.reload(); };
function missedText() {
  const lines = [examTitle, 'Date: ' + new Date().toLocaleString(), 'Score: ' + score + ' of ' + exam.questions.length, '', 'Missed questions:'];
  if (!lastMissed.length) lines.push('None — perfect score.');
  lastMissed.forEach(m => {
    lines.push('', 'Q' + m.n + '. ' + m.question, 'Your answer: ' + m.your, 'Correct answer: ' + m.correct);
    if (m.source) lines.push('Deck: ' + m.source);
    if (m.explanation) lines.push('Why: ' + m.explanation);
  });
  lines.push('', 'Flagged: needs more practice:');
  if (!lastFlagged.length) lines.push('None flagged.');
  lastFlagged.forEach(m => {
    lines.push('', 'Q' + m.n + '. ' + m.question, 'Correct answer: ' + m.correct, 'You ' + m.result + '.');
    if (m.source) lines.push('Deck: ' + m.source);
    if (m.explanation) lines.push('Why: ' + m.explanation);
  });
  return lines.join('\n');
}

document.getElementById('download-btn').onclick = () => {
  const blob = new Blob([missedText()], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.replace(/\.json$/, '') + '-missed.txt';
  a.click();
  URL.revokeObjectURL(a.href);
};
document.getElementById('copy-btn').onclick = () => {
  const btn = document.getElementById('copy-btn');
  const done = () => { btn.textContent = 'Copied — paste it to Edison'; setTimeout(() => { btn.textContent = 'Copy missed list'; }, 3000); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(missedText()).then(done).catch(() => fallbackCopy(done));
  } else { fallbackCopy(done); }
};
function fallbackCopy(done) {
  const ta = document.createElement('textarea');
  ta.value = missedText();
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { /* clipboard unavailable */ }
  ta.remove();
}

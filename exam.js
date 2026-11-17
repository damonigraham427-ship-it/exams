const file = new URLSearchParams(location.search).get('exam');
let exam, examTitle = file, idx = 0, score = 0;
const answers = [];
let lastMissed = [];

fetch('index.json')
  .then(r => r.json())
  .then(data => {
    const entry = (data.exams || []).find(e => e.file === file);
    if (entry) examTitle = entry.title;
    document.getElementById('exam-title').textContent = examTitle;
  })
  .catch(() => {});

fetch(file)
  .then(r => r.json())
  .then(data => { exam = data; if (data.title) { examTitle = data.title; document.getElementById('exam-title').textContent = examTitle; } show(); });

function show() {
  const q = exam.questions[idx];
  document.getElementById('progress').textContent = 'Question ' + (idx + 1) + ' of ' + exam.questions.length;
  document.getElementById('question-text').textContent = q.question;
  document.getElementById('feedback').textContent = '';
  document.getElementById('next-btn').hidden = true;
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
}

function finish() {
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
    li.textContent = m.question + ' — Your answer: ' + m.your + ' · Correct: ' + m.correct + (m.explanation ? ' · ' + m.explanation : '');
    list.appendChild(li);
  });
  document.getElementById('no-missed').hidden = lastMissed.length !== 0;

  try {
    const all = JSON.parse(localStorage.getItem('examHistory') || '{}');
    if (!Array.isArray(all[file])) all[file] = [];
    all[file].unshift({ ts: new Date().toISOString(), title: examTitle, score: score, total: exam.questions.length, missed: lastMissed });
    all[file] = all[file].slice(0, 20);
    localStorage.setItem('examHistory', JSON.stringify(all));
  } catch (e) { /* storage unavailable; results still shown on screen */ }
}

document.getElementById('next-btn').onclick = () => {
  idx++;
  if (idx < exam.questions.length) { show(); return; }
  finish();
};
document.getElementById('retry-btn').onclick = () => location.reload();
document.getElementById('download-btn').onclick = () => {
  const lines = [examTitle, 'Date: ' + new Date().toLocaleString(), 'Score: ' + score + ' of ' + exam.questions.length, '', 'Missed questions:'];
  if (!lastMissed.length) lines.push('None — perfect score.');
  lastMissed.forEach(m => {
    lines.push('', 'Q' + m.n + '. ' + m.question, 'Your answer: ' + m.your, 'Correct answer: ' + m.correct);
    if (m.explanation) lines.push('Why: ' + m.explanation);
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.replace(/\.json$/, '') + '-missed.txt';
  a.click();
  URL.revokeObjectURL(a.href);
};

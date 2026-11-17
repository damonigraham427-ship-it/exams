const file = new URLSearchParams(location.search).get('exam');
let exam, idx = 0, score = 0;

fetch(file)
  .then(r => r.json())
  .then(data => { exam = data; document.getElementById('exam-title').textContent = data.title; show(); });

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
  document.querySelectorAll('button.choice').forEach(b => b.disabled = true);
  const right = i === q.answer;
  if (right) score++;
  btn.className += right ? ' correct' : ' wrong';
  document.getElementById('feedback').textContent =
    (right ? 'Correct. ' : 'Wrong. Answer: ' + q.choices[q.answer] + '. ') + (q.explanation || '');
  document.getElementById('next-btn').hidden = false;
}

document.getElementById('next-btn').onclick = () => {
  idx++;
  if (idx < exam.questions.length) { show(); return; }
  document.getElementById('question-box').hidden = true;
  document.getElementById('progress').textContent = '';
  document.getElementById('result-box').hidden = false;
  document.getElementById('score').textContent = 'Score: ' + score + ' of ' + exam.questions.length;
};
document.getElementById('retry-btn').onclick = () => location.reload();

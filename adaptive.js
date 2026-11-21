// Adaptive engine — ALEKS-style features, original code.
// Data rule: a subject = subjects.json entry. A topic = one question file + prerequisites.
// Adding subjects/topics needs NO code change here.
'use strict';
const $ = id => document.getElementById(id);
const MASTER_PCT = 80, MASTER_MIN = 4; // mastered: >=80% over >=4 attempts

let registry = null, subject = null, banks = {}; // topicId -> questions[]
let state = {}; // topicId -> {a: attempts, c: correct, streak}
let mode = null, queue = [], current = null, answered = false, checkIdx = null;

function key() { return 'adaptive_v1_' + subject.id; }
function loadState() { try { state = JSON.parse(localStorage.getItem(key())) || {}; } catch { state = {}; } }
function saveState() { localStorage.setItem(key(), JSON.stringify(state)); }
function st(tid) { return state[tid] || { a: 0, c: 0, streak: 0 }; }
function pct(tid) { const s = st(tid); return s.a ? Math.round(100 * s.c / s.a) : 0; }
function isMastered(tid) { const s = st(tid); return s.a >= MASTER_MIN && pct(tid) >= MASTER_PCT; }
function isReady(topic) { return !isMastered(topic.id) && (topic.needs || []).every(n => isMastered(n)); }
function isLearning(tid) { const s = st(tid); return s.a > 0 && !isMastered(tid); }
function statusOf(topic) {
  if (isMastered(topic.id)) return ['Mastered', '#16a34a'];
  if (isReady(topic)) return isLearning(topic.id) ? ['Learning', '#f59e0b'] : ['Ready to Learn', '#2563eb'];
  return ['Locked', '#94a3b8'];
}

async function init() {
  registry = await (await fetch('subjects.json', { cache: 'no-store' })).json();
  const list = $('subject-list'); list.innerHTML = '';
  for (const s of registry.subjects) {
    const b = document.createElement('button'); b.className = 'nav-card';
    b.innerHTML = '';
    b.append(document.createTextNode(s.title));
    const small = document.createElement('small');
    small.textContent = s.field + ' · ' + s.topics.length + ' topics' + (s.note ? ' · ' + s.note : '');
    b.append(small);
    b.onclick = () => openSubject(s);
    list.append(b);
  }
}

async function openSubject(s) {
  subject = s; loadState(); banks = {};
  $('subject-list').hidden = true; $('runner').hidden = true; $('dashboard').hidden = false;
  $('dash-title').textContent = s.title;
  await Promise.all(s.topics.map(async t => {
    try { banks[t.id] = (await (await fetch(t.file, { cache: 'no-store' })).json()).questions || []; }
    catch { banks[t.id] = []; }
  }));
  renderDash();
}

function renderDash() {
  const total = subject.topics.length;
  const mastered = subject.topics.filter(t => isMastered(t.id)).length;
  const learning = subject.topics.filter(t => isLearning(t.id)).length;
  const ready = subject.topics.filter(t => isReady(t) && !isLearning(t.id)).length;
  const mp = total ? Math.round(100 * mastered / total) : 0;
  const lp = total ? Math.round(100 * learning / total) : 0;
  $('pie-mastered').setAttribute('stroke-dasharray', mp + ' ' + (100 - mp));
  const learnEl = $('pie-learning');
  learnEl.setAttribute('stroke-dasharray', lp + ' ' + (100 - lp));
  learnEl.setAttribute('transform', 'rotate(' + (-90 + mp * 3.6) + ' 21 21)');
  $('pie-pct').textContent = mp + '%';
  $('legend').innerHTML =
    '<span class="dot" style="background:#16a34a"></span>Mastered: ' + mastered + '<br>' +
    '<span class="dot" style="background:#f59e0b"></span>Learning: ' + learning + '<br>' +
    '<span class="dot" style="background:#2563eb"></span>Ready to Learn: ' + ready + '<br>' +
    '<span class="dot" style="background:#94a3b8"></span>Locked: ' + (total - mastered - learning - ready) + '<br>' +
    'Total topics: ' + total;
  const list = $('topic-list'); list.innerHTML = '';
  for (const t of subject.topics) {
    const [label, color] = statusOf(t);
    const row = document.createElement('div'); row.className = 'topic-row';
    const left = document.createElement('span'); left.textContent = t.title;
    const right = document.createElement('span'); right.style.color = color; right.style.fontWeight = '700';
    right.textContent = label + (st(t.id).a ? ' · ' + pct(t.id) + '% (' + st(t.id).a + ')' : '');
    row.append(left, right); list.append(row);
  }
}

function pickQuestion(tid) {
  const qs = banks[tid] || []; if (!qs.length) return null;
  return { tid, q: qs[Math.floor(Math.random() * qs.length)] };
}

// Initial Check: binary-search the prerequisite chain — correct moves forward, wrong moves back.
function startCheck() {
  mode = 'check';
  const order = subject.topics.map(t => t.id);
  checkIdx = { lo: 0, hi: order.length - 1, order, asked: 0 };
  nextCheck();
}
function nextCheck() {
  if (checkIdx.asked >= 6 || checkIdx.lo > checkIdx.hi) return finish('Check done. Your pie and Ready to Learn list are updated.');
  const mid = Math.floor((checkIdx.lo + checkIdx.hi) / 2);
  current = pickQuestion(checkIdx.order[mid]);
  if (!current) { checkIdx.hi = mid - 1; return nextCheck(); }
  checkIdx.mid = mid; checkIdx.asked++;
  showQuestion('Initial Check · question ' + checkIdx.asked);
}

// Learn: only Ready to Learn topics, explanation after every answer.
function startLearn() {
  mode = 'learn'; queue = [];
  const ready = subject.topics.filter(t => isReady(t));
  if (!ready.length) return finish(subject.topics.every(t => isMastered(t.id)) ? 'All topics mastered.' : 'No topic ready yet — run the Initial Check first.');
  for (const t of ready) for (let i = 0; i < 3; i++) { const p = pickQuestion(t.id); if (p) queue.push(p); }
  queue.sort(() => Math.random() - 0.5);
  nextLearn();
}
function nextLearn() {
  if (!queue.length) return finish('Session done. Pie updated.');
  current = queue.shift();
  showQuestion('Learn · ' + (subject.topics.find(t => t.id === current.tid) || {}).title);
}

function showQuestion(progressText) {
  answered = false;
  $('dashboard').hidden = true; $('runner').hidden = false;
  $('progress').textContent = progressText;
  $('source-line').textContent = current.q.source || '';
  $('question-text').textContent = current.q.question;
  $('feedback').hidden = true; $('btn-next').hidden = true;
  const box = $('choices'); box.innerHTML = '';
  current.q.choices.forEach((choice, i) => {
    const b = document.createElement('button'); b.className = 'choice'; b.textContent = choice;
    b.onclick = () => answer(i, b); box.append(b);
  });
}

function answer(i, btn) {
  if (answered) return; answered = true;
  const correct = i === current.q.answer;
  const s = st(current.tid); s.a++; if (correct) { s.c++; s.streak++; } else s.streak = 0;
  state[current.tid] = s; saveState();
  [...$('choices').children].forEach((b, j) => {
    b.disabled = true;
    if (j === current.q.answer) b.classList.add('correct');
    else if (j === i) b.classList.add('wrong');
  });
  const f = $('feedback'); f.hidden = false;
  f.textContent = (correct ? 'Correct. ' : 'Wrong. ') + (current.q.explanation || '');
  $('btn-next').hidden = false;
  if (mode === 'check') {
    if (correct) checkIdx.lo = checkIdx.mid + 1; else checkIdx.hi = checkIdx.mid - 1;
  }
}

function finish(msg) {
  $('runner').hidden = true; $('dashboard').hidden = false;
  renderDash(); alert(msg);
}

$('btn-check').onclick = startCheck;
$('btn-learn').onclick = startLearn;
$('btn-next').onclick = () => mode === 'check' ? nextCheck() : nextLearn();
$('dash-back').onclick = () => { $('dashboard').hidden = true; $('subject-list').hidden = false; };
$('run-back').onclick = () => { $('runner').hidden = true; $('dashboard').hidden = false; renderDash(); };
$('btn-reset').onclick = () => { if (confirm('Reset this subject?')) { localStorage.removeItem(key()); state = {}; renderDash(); } };
init();

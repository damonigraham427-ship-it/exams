// Adaptive engine v2 — ALEKS-style features, original code.
// Learned (Learning Mode, 5 points) vs Mastered (proven on a Knowledge Check) are separate.
// Data rule: a subject = subjects.json entry. Adding subjects needs NO code change here.
'use strict';
const $ = id => document.getElementById(id);
const CHECK_TOPICS = 20, CHECK_SECONDS = 5 * 3600; // Progress Check auto-due thresholds

let registry = null, subject = null, banks = {};
let S = null; // {topics:{tid:{a,c,streak,points,learned,mastered,lost}}, meta:{learnedSinceCheck,learnSeconds}, history:{date:{a,c,check,mastered}}}
let mode = null, queue = [], current = null, answered = false, checkIdx = null, filter = 'all', learnStart = 0;

function key(v) { return 'adaptive_' + v + '_' + subject.id; }
function today() { return new Date().toLocaleDateString('en-CA'); }
function blank() { return { topics: {}, meta: { learnedSinceCheck: 0, learnSeconds: 0 }, history: {} }; }
function loadState() {
  try { S = JSON.parse(localStorage.getItem(key('v2'))); } catch { S = null; }
  if (S && S.topics) return;
  S = blank();
  // Migrate v1: {tid:{a,c,streak}} — mastered was 80% over 4+ tries.
  try {
    const old = JSON.parse(localStorage.getItem(key('v1')));
    if (old) for (const [tid, o] of Object.entries(old)) {
      const pct = o.a ? o.c / o.a : 0, wasMastered = o.a >= 4 && pct >= 0.8;
      S.topics[tid] = { a: o.a || 0, c: o.c || 0, streak: o.streak || 0, points: wasMastered ? 5 : Math.min(4, o.streak || 0), learned: wasMastered, mastered: wasMastered, lost: false };
    }
  } catch { /* no v1 data */ }
}
function saveState() { localStorage.setItem(key('v2'), JSON.stringify(S)); }
function st(tid) { return S.topics[tid] || (S.topics[tid] = { a: 0, c: 0, streak: 0, points: 0, learned: false, mastered: false, lost: false }); }
function pct(tid) { const s = st(tid); return s.a ? Math.round(100 * s.c / s.a) : 0; }
function isMastered(tid) { return st(tid).mastered; }
function isLearned(tid) { const s = st(tid); return s.learned && !s.mastered; }
function prereqsDone(topic) { return (topic.needs || []).every(n => { const s = st(n); return s.learned || s.mastered; }); }
function isReady(topic) { const s = st(topic.id); return !s.learned && !s.mastered && prereqsDone(topic); }
function statusOf(topic) {
  const s = st(topic.id);
  if (s.mastered) return ['Mastered', '#15803d'];
  if (s.lost) return ['Needs More Practice', '#dc2626'];
  if (s.learned) return ['Learned', '#65a30d'];
  if (isReady(topic)) return s.points > 0 ? ['Learning', '#f59e0b'] : ['Ready to Learn', '#2563eb'];
  return ['Locked', '#94a3b8'];
}
function gauge(points) { return '●'.repeat(points) + '○'.repeat(5 - points); }
function logHistory(correct, isCheck) {
  const d = today(), h = S.history[d] || (S.history[d] = { a: 0, c: 0, check: false, mastered: 0 });
  h.a++; if (correct) h.c++;
  if (isCheck) h.check = true;
  h.mastered = subject.topics.filter(t => isMastered(t.id)).length;
}
function checkDue() { return S.meta.learnedSinceCheck >= CHECK_TOPICS || S.meta.learnSeconds >= CHECK_SECONDS; }

async function init() {
  registry = await (await fetch('subjects.json', { cache: 'no-store' })).json();
  const list = $('subject-list'); list.innerHTML = '';
  for (const s of registry.subjects) {
    const b = document.createElement('button'); b.className = 'nav-card';
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
  const learned = subject.topics.filter(t => isLearned(t.id)).length;
  const mp = total ? Math.round(100 * mastered / total) : 0;
  const lp = total ? Math.round(100 * (mastered + learned) / total) : 0;
  $('pie-learned').setAttribute('stroke-dasharray', lp + ' ' + (100 - lp));
  $('pie-mastered').setAttribute('stroke-dasharray', mp + ' ' + (100 - mp));
  $('pie-pct').textContent = mp + '%';
  $('legend').innerHTML =
    '<span class="dot" style="background:#15803d"></span>Mastered: ' + mastered + '<br>' +
    '<span class="dot" style="background:#86efac"></span>Learned: ' + learned + '<br>' +
    '<span class="dot" style="background:#e2e8f0"></span>Remaining: ' + (total - mastered - learned) + '<br>' +
    'Total topics: ' + total;
  const banner = $('check-banner');
  if (checkDue()) { banner.hidden = false; banner.textContent = 'Progress Knowledge Check due — prove your Learned topics to make them Mastered.'; }
  else banner.hidden = true;
  $('next-check').textContent = 'Next Progress Check: after ' + Math.max(0, CHECK_TOPICS - S.meta.learnedSinceCheck) + ' more topics learned or ' +
    Math.max(0, Math.ceil((CHECK_SECONDS - S.meta.learnSeconds) / 3600)) + ' more hours of learning. You can also run one anytime.';
  renderTopics(); renderTimeline();
}

function renderTopics() {
  const list = $('topic-list'); list.innerHTML = '';
  for (const t of subject.topics) {
    const s = st(t.id), [label, color] = statusOf(t);
    if (filter === 'ready' && !(isReady(t) || s.lost)) continue;
    if (filter === 'practice' && !s.lost) continue;
    if (filter === 'review' && !(s.mastered || s.learned)) continue;
    const row = document.createElement('div'); row.className = 'topic-row';
    const left = document.createElement('span'); left.textContent = t.title + '  ';
    const g = document.createElement('span'); g.className = 'gauge'; g.textContent = gauge(s.points);
    left.append(g);
    const right = document.createElement('span'); right.style.color = color; right.style.fontWeight = '700';
    right.textContent = label + (s.a ? ' · ' + pct(t.id) + '% (' + s.a + ')' : '');
    row.append(left, right); list.append(row);
  }
  if (!list.children.length) { const p = document.createElement('p'); p.textContent = 'No topics in this filter.'; list.append(p); }
}

function renderTimeline() {
  const box = $('timeline'); box.innerHTML = '';
  const days = Object.keys(S.history).sort().reverse();
  if (!days.length) { box.innerHTML = '<p>No history yet. Answer questions and days will appear here.</p>'; return; }
  for (const d of days) {
    const h = S.history[d];
    const row = document.createElement('div'); row.className = 'tl-row';
    row.textContent = d + ' — ' + h.a + ' answers · ' + h.c + ' correct · Mastered topics: ' + h.mastered + (h.check ? ' · 🏆 Knowledge Check' : '');
    box.append(row);
  }
}

function pickQuestion(tid) {
  const qs = banks[tid] || []; if (!qs.length) return null;
  return { tid, q: qs[Math.floor(Math.random() * qs.length)] };
}

// Initial Check: binary-search the chain. No right/wrong feedback during a check (ALEKS rule).
function startCheck() {
  mode = 'check';
  const order = subject.topics.map(t => t.id);
  checkIdx = { lo: 0, hi: order.length - 1, order, asked: 0 };
  nextCheck();
}
function nextCheck() {
  if (checkIdx.asked >= 6 || checkIdx.lo > checkIdx.hi) return finish('Initial Check done. Pie updated — correct answers are Mastered.');
  const mid = Math.floor((checkIdx.lo + checkIdx.hi) / 2);
  current = pickQuestion(checkIdx.order[mid]);
  if (!current) { checkIdx.hi = mid - 1; return nextCheck(); }
  checkIdx.mid = mid; checkIdx.asked++;
  showQuestion('Initial Check · question ' + checkIdx.asked);
}

// Progress Check: 1 question per Learned/Mastered topic. Wrong = topic lost, back to the path.
function startProgress() {
  mode = 'progress'; queue = [];
  const targets = subject.topics.filter(t => { const s = st(t.id); return s.learned || s.mastered; });
  if (!targets.length) return finish('Nothing to check yet — learn a topic first.');
  for (const t of targets) { const p = pickQuestion(t.id); if (p) queue.push(p); }
  queue.sort(() => Math.random() - 0.5);
  nextFromQueue('Progress Check');
}
function nextFromQueue(label) {
  if (!queue.length) {
    if (mode === 'progress') { S.meta.learnedSinceCheck = 0; S.meta.learnSeconds = 0; saveState(); return finish('Progress Check done. Retained topics are Mastered. Lost topics are back on your path as Needs More Practice.'); }
    return finish('Session done. Pie updated.');
  }
  current = queue.shift();
  showQuestion(label + ' · ' + (subject.topics.find(t => t.id === current.tid) || {}).title);
}

// Learn: Ready / Learning / Needs More Practice topics only. 5 points = Learned.
function startLearn() {
  mode = 'learn'; queue = []; learnStart = Date.now();
  const ready = subject.topics.filter(t => isReady(t) || st(t.id).lost);
  if (!ready.length) return finish(subject.topics.every(t => isMastered(t.id)) ? 'All topics mastered.' : 'No topic ready yet — run the Initial Check, or finish learning the topic before it.');
  for (const t of ready) for (let i = 0; i < 3; i++) { const p = pickQuestion(t.id); if (p) queue.push(p); }
  queue.sort(() => Math.random() - 0.5);
  nextFromQueue('Learn');
}

function showQuestion(progressText) {
  answered = false;
  $('dashboard').hidden = true; $('runner').hidden = false;
  $('progress').textContent = progressText;
  $('topic-gauge').textContent = mode === 'learn' ? 'Topic points: ' + gauge(st(current.tid).points) + ' — 5 = Learned' : '';
  $('source-line').textContent = current.q.source || '';
  $('question-text').textContent = current.q.question;
  $('feedback').hidden = true; $('btn-next').hidden = true;
  $('btn-idk').hidden = mode === 'learn'; // I Don't Know lives in Knowledge Checks
  const box = $('choices'); box.innerHTML = '';
  current.q.choices.forEach((choice, i) => {
    const b = document.createElement('button'); b.className = 'choice'; b.textContent = choice;
    b.onclick = () => answer(i); box.append(b);
  });
}

function record(correct) {
  const s = st(current.tid); s.a++;
  if (correct) { s.c++; s.streak++; } else s.streak = 0;
  if (mode === 'learn') {
    S.meta.learnSeconds += Math.min(300, Math.round((Date.now() - learnStart) / 1000)); learnStart = Date.now();
    if (correct) s.points = Math.min(5, s.points + 1); else s.points = Math.max(0, s.points - 1);
    if (s.points >= 5 && !s.learned && !s.mastered) { s.learned = true; s.lost = false; S.meta.learnedSinceCheck++; }
  }
  if (mode === 'check' && correct) { s.learned = true; s.mastered = true; s.lost = false; s.points = 5; }
  if (mode === 'progress') {
    if (correct) { s.learned = true; s.mastered = true; s.lost = false; s.points = 5; }
    else { s.learned = false; s.mastered = false; s.lost = true; s.points = 0; }
  }
  logHistory(correct, mode !== 'learn'); saveState();
}

function answer(i) {
  if (answered) return; answered = true;
  const correct = i === current.q.answer;
  record(correct);
  [...$('choices').children].forEach(b => b.disabled = true);
  $('btn-idk').hidden = true;
  if (mode === 'learn') {
    [...$('choices').children].forEach((b, j) => {
      if (j === current.q.answer) b.classList.add('correct'); else if (j === i) b.classList.add('wrong');
    });
    const f = $('feedback'); f.hidden = false;
    f.textContent = (correct ? 'Correct. ' : 'Wrong. ') + (current.q.explanation || '');
    $('topic-gauge').textContent = 'Topic points: ' + gauge(st(current.tid).points) + ' — 5 = Learned';
  } else {
    const f = $('feedback'); f.hidden = false;
    f.textContent = 'Recorded. No feedback during a Knowledge Check.';
  }
  $('btn-next').hidden = false;
  if (mode === 'check') { if (correct) checkIdx.lo = checkIdx.mid + 1; else checkIdx.hi = checkIdx.mid - 1; }
}

function idk() {
  if (answered) return; answered = true;
  record(false);
  [...$('choices').children].forEach(b => b.disabled = true);
  $('btn-idk').hidden = true;
  const f = $('feedback'); f.hidden = false; f.textContent = 'Recorded as not known. No guessing penalty beyond that.';
  $('btn-next').hidden = false;
  if (mode === 'check') checkIdx.hi = checkIdx.mid - 1;
}

function finish(msg) {
  $('runner').hidden = true; $('dashboard').hidden = false;
  renderDash(); alert(msg);
}

$('btn-check').onclick = startCheck;
$('btn-learn').onclick = startLearn;
$('btn-progress').onclick = startProgress;
$('btn-idk').onclick = idk;
$('btn-next').onclick = () => mode === 'check' ? nextCheck() : nextFromQueue(mode === 'progress' ? 'Progress Check' : 'Learn');
$('view-pie-btn').onclick = () => { $('pie-wrap').hidden = false; $('timeline').hidden = true; $('view-pie-btn').classList.add('active'); $('view-timeline-btn').classList.remove('active'); };
$('view-timeline-btn').onclick = () => { $('pie-wrap').hidden = true; $('timeline').hidden = false; renderTimeline(); $('view-timeline-btn').classList.add('active'); $('view-pie-btn').classList.remove('active'); };
document.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => {
  filter = b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(x => x.classList.toggle('active', x === b));
  renderTopics();
});
$('dash-back').onclick = () => { $('dashboard').hidden = true; $('subject-list').hidden = false; };
$('run-back').onclick = () => { $('runner').hidden = true; $('dashboard').hidden = false; renderDash(); };
$('btn-reset').onclick = () => { if (confirm('Reset this subject?')) { localStorage.removeItem(key('v2')); loadState(); renderDash(); } };
init();

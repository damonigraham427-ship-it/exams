(function () {
  var hist = {};
  try { hist = JSON.parse(localStorage.getItem('examHistory') || '{}'); } catch (e) { hist = {}; }
  var notes = {};
  try { notes = JSON.parse(localStorage.getItem('notepadNotes') || '{}'); } catch (e) { notes = {}; }
  var cleared = {};
  try { cleared = JSON.parse(localStorage.getItem('notepadCleared') || '{}'); } catch (e) { cleared = {}; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function saveNotes() { try { localStorage.setItem('notepadNotes', JSON.stringify(notes)); } catch (e) {} }
  function saveCleared() { try { localStorage.setItem('notepadCleared', JSON.stringify(cleared)); } catch (e) {} }

  // Build entries from the LATEST finished attempt of each exam.
  var groups = []; // {title, entries:[{key,n,question,source,your,correct,explanation,flagged,wrong}]}
  Object.keys(hist).forEach(function (examKey) {
    var attempts = hist[examKey];
    if (!Array.isArray(attempts) || !attempts.length) return;
    var latest = attempts[0];
    var byQ = {};
    var order = [];
    function add(q, patch) {
      if (!byQ[q]) { byQ[q] = { question: q, flagged: false, wrong: false }; order.push(q); }
      Object.assign(byQ[q], patch);
    }
    (latest.missed || []).forEach(function (m) {
      add(m.question, { n: m.n, source: m.source || '', your: m.your, correct: m.correct, explanation: m.explanation || '', wrong: true });
    });
    (latest.flagged || []).forEach(function (m) {
      add(m.question, { n: m.n, source: m.source || '', correct: m.correct, explanation: m.explanation || '', flagged: true, result: m.result || '' });
    });
    var gone = (cleared[examKey] && cleared[examKey].ts === latest.ts) ? cleared[examKey].questions : [];
    var entries = order.map(function (q) { return byQ[q]; })
      .filter(function (e) { return gone.indexOf(e.question) === -1; })
      .sort(function (a, b) { return (a.n || 0) - (b.n || 0); })
      .map(function (e) { e.examKey = examKey; e.ts = latest.ts; return e; });
    if (entries.length) groups.push({ title: latest.title || examKey, entries: entries });
  });
  groups.sort(function (a, b) { return a.title < b.title ? -1 : 1; });

  var total = 0, nFlag = 0, nWrong = 0;
  groups.forEach(function (g) { g.entries.forEach(function (e) { total++; if (e.flagged) nFlag++; if (e.wrong) nWrong++; }); });
  document.getElementById('np-counts').textContent =
    total + ' questions · ' + nFlag + ' flagged · ' + nWrong + ' answered wrong';
  document.getElementById('np-empty').hidden = total !== 0;

  var box = document.getElementById('notepad');
  groups.forEach(function (g) {
    var h = document.createElement('h2');
    h.textContent = g.title;
    box.appendChild(h);
    g.entries.forEach(function (e) {
      var card = document.createElement('section');
      card.className = 'note-card';
      card.dataset.flagged = e.flagged ? '1' : '';
      card.dataset.wrong = e.wrong ? '1' : '';
      var tags = [];
      if (e.flagged) tags.push('&#9733; Needs more work');
      if (e.wrong) tags.push('Answered wrong');
      var meta = '';
      if (e.wrong && e.your !== undefined) meta = 'Your answer: ' + esc(e.your) + ' · Correct: ' + esc(e.correct);
      else if (e.correct) meta = 'Correct: ' + esc(e.correct) + (e.result ? ' · You ' + esc(e.result) : '');
      card.innerHTML =
        '<p class="np-tags">' + tags.join(' · ') + (e.source ? ' · Deck: ' + esc(e.source) : '') + '</p>' +
        '<p class="np-q">' + esc(e.question) + '</p>' +
        (meta ? '<p class="np-meta">' + meta + '</p>' : '') +
        (e.explanation ? '<p class="np-meta">' + esc(e.explanation) + '</p>' : '');
      var ta = document.createElement('textarea');
      ta.className = 'note-area';
      ta.rows = 2;
      ta.placeholder = 'My note on this question…';
      var nk = e.examKey + '||' + e.question;
      ta.value = notes[nk] || '';
      ta.addEventListener('change', function () { notes[nk] = ta.value; saveNotes(); });
      card.appendChild(ta);
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'np-remove';
      rm.textContent = 'Done — remove';
      rm.addEventListener('click', function () {
        if (!cleared[e.examKey] || cleared[e.examKey].ts !== e.ts) cleared[e.examKey] = { ts: e.ts, questions: [] };
        cleared[e.examKey].questions.push(e.question);
        saveCleared();
        card.remove();
      });
      card.appendChild(rm);
      box.appendChild(card);
    });
  });

  // Filters
  var chips = document.querySelectorAll('.np-chip');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('np-chip-on'); });
      chip.classList.add('np-chip-on');
      var f = chip.dataset.f;
      document.querySelectorAll('.note-card').forEach(function (card) {
        var show = f === 'all' || (f === 'flagged' && card.dataset.flagged) || (f === 'wrong' && card.dataset.wrong);
        card.hidden = !show;
      });
    });
  });

  // Send to Edison: snapshot of everything on this page + my comments.
  var sendBtn = document.getElementById('send-btn');
  var sendStatus = document.getElementById('send-status');
  if (sendBtn) sendBtn.onclick = function () {
    var reportGroups = [];
    groups.forEach(function (g) {
      var items = [];
      g.entries.forEach(function (e) {
        var item = { n: e.n, question: e.question, correct: e.correct, explanation: e.explanation || '', comment: notes[e.examKey + '||' + e.question] || '' };
        item.your = e.your || '';
        item.marks = (e.flagged ? 'needs more work' : '') + (e.flagged && e.wrong ? ' + ' : '') + (e.wrong ? 'answered wrong' : '');
        items.push(item);
      });
      if (items.length) reportGroups.push({ title: g.title, items: items });
    });
    if (!reportGroups.length) { sendStatus.textContent = 'Nothing to send yet.'; return; }
    var report = { id: 'r' + Date.now(), ts: new Date().toISOString(), page: 'notepad', groups: reportGroups };
    sendBtn.disabled = true;
    sendStatus.textContent = 'Sending\u2026';
    var wait = setInterval(function () {
      if (window.examSync) {
        clearInterval(wait);
        window.examSync.sendReport(report).then(function () {
          sendStatus.textContent = 'Sent \u2713 \u2014 Edison will message you to discuss.';
          sendBtn.disabled = false;
        }).catch(function () {
          sendStatus.textContent = 'Could not send \u2014 sign in to sync first (blue bar at the top), then try again.';
          sendBtn.disabled = false;
        });
      }
    }, 200);
    setTimeout(function () { clearInterval(wait); if (sendBtn.disabled) { sendStatus.textContent = 'Could not send \u2014 sign in to sync first (blue bar at the top), then try again.'; sendBtn.disabled = false; } }, 12000);
  };
})();

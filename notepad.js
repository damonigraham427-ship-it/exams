(function () {
  var hist = {};
  try { hist = JSON.parse(localStorage.getItem('examHistory') || '{}'); } catch (e) { hist = {}; }
  var notes = {};
  try { notes = JSON.parse(localStorage.getItem('notepadNotes') || '{}'); } catch (e) { notes = {}; }
  var cleared = {};
  try { cleared = JSON.parse(localStorage.getItem('notepadCleared') || '{}'); } catch (e) { cleared = {}; }

  // Per-exam scoping: ?exam=<file> shows only that exam's pad (its full-set
  // attempt plus its topic runs). No param: a picker of exams that have entries.
  var examParam = new URLSearchParams(location.search).get('exam');
  function baseOf(key) { return key.split('#topic:')[0]; }
  var picker = {}; // base file -> {title, count}
  function notePicker(examKey, title, count) {
    var b = baseOf(examKey);
    var p = picker[b] || (picker[b] = { title: '', count: 0 });
    if (examKey === b && title) p.title = title;
    if (!p.title && title) p.title = title.replace(/ \u2014 Topic: .*$/, '');
    p.count += count;
  }


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
    if (examParam && baseOf(examKey) !== examParam) return;
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
    if (entries.length) { groups.push({ title: latest.title || examKey, entries: entries }); notePicker(examKey, latest.title || examKey, entries.length); }
  });
  groups.sort(function (a, b) { return a.title < b.title ? -1 : 1; });

  if (!examParam) {
    // Picker: each exam has its own pad — link into it, nothing aggregated here.
    var sb = document.getElementById('send-btn'); if (sb) sb.parentElement.hidden = true;
    var fl = document.querySelector('.np-filters'); if (fl) fl.hidden = true;
    document.getElementById('np-empty').hidden = true;
    var bases = Object.keys(picker).sort();
    var tot = 0; bases.forEach(function (b) { tot += picker[b].count; });
    document.getElementById('np-counts').textContent = tot
      ? 'Each exam has its own notepad. Pick an exam:'
      : 'Nothing here yet. Flag a question while you answer, or finish an exam, and it shows up in that exam\'s pad.';
    document.getElementById('notepad').innerHTML = bases.map(function (b) {
      return '<p><a href="notepad.html?exam=' + encodeURIComponent(b) + '">' + esc(picker[b].title || b) + '</a> \u2014 ' + picker[b].count + ' questions</p>';
    }).join('');
    return;
  }
  var h1 = document.querySelector('h1');
  var pTitle = (picker[examParam] && picker[examParam].title) || examParam;
  if (h1) h1.textContent = 'Notepad \u2014 ' + pTitle;
  if (h1 && !(picker[examParam] && picker[examParam].title)) {
    // No attempts yet for this exam: take the pretty title from the registry.
    fetch('index.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (idx) {
      var e = (idx.exams || []).filter(function (x) { return x.file === examParam; })[0];
      if (e && e.title) h1.textContent = 'Notepad \u2014 ' + e.title;
    }).catch(function () {});
  }
  var countsEl = document.getElementById('np-counts');
  var allLink = document.createElement('a');
  allLink.href = 'notepad.html'; allLink.textContent = 'All exams';
  countsEl.parentElement.insertBefore(allLink, countsEl);


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

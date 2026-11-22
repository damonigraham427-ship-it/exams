// Quality review page — questions the student marked with the Quality review
// button, from the latest finished attempt per exam (examHistory.quality),
// each with a comment box. Mirrors the Notepad page's storage pattern.
(function () {
  var hist = {};
  try { hist = JSON.parse(localStorage.getItem('examHistory') || '{}'); } catch (e) { hist = {}; }
  var notes = {};
  try { notes = JSON.parse(localStorage.getItem('qualityNotes') || '{}'); } catch (e) { notes = {}; }
  var cleared = {};
  try { cleared = JSON.parse(localStorage.getItem('qualityCleared') || '{}'); } catch (e) { cleared = {}; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function saveNotes() { try { localStorage.setItem('qualityNotes', JSON.stringify(notes)); } catch (e) {} }
  function saveCleared() { try { localStorage.setItem('qualityCleared', JSON.stringify(cleared)); } catch (e) {} }

  var groups = [];
  Object.keys(hist).forEach(function (examKey) {
    var attempts = hist[examKey];
    if (!Array.isArray(attempts) || !attempts.length) return;
    var latest = attempts[0];
    var gone = (cleared[examKey] && cleared[examKey].ts === latest.ts) ? cleared[examKey].questions : [];
    var entries = (latest.quality || [])
      .filter(function (m) { return gone.indexOf(m.question) === -1; })
      .sort(function (a, b) { return (a.n || 0) - (b.n || 0); })
      .map(function (m) {
        return { examKey: examKey, ts: latest.ts, n: m.n, question: m.question, source: m.source || '', correct: m.correct, explanation: m.explanation || '', result: m.result || '' };
      });
    if (entries.length) groups.push({ title: latest.title || examKey, entries: entries });
  });
  groups.sort(function (a, b) { return a.title < b.title ? -1 : 1; });

  var total = 0;
  groups.forEach(function (g) { total += g.entries.length; });
  document.getElementById('qr-counts').textContent = total + ' questions marked for quality review';
  document.getElementById('qr-empty').hidden = total !== 0;

  var box = document.getElementById('quality');
  groups.forEach(function (g) {
    var h = document.createElement('h2');
    h.textContent = g.title;
    box.appendChild(h);
    g.entries.forEach(function (e) {
      var card = document.createElement('section');
      card.className = 'note-card';
      var meta = '';
      if (e.correct) meta = 'Correct: ' + esc(e.correct) + (e.result ? ' · You ' + esc(e.result) : '');
      card.innerHTML =
        '<p class="np-tags">&#9873; Quality review' + (e.source ? ' · Deck: ' + esc(e.source) : '') + '</p>' +
        '<p class="np-q">' + esc(e.question) + '</p>' +
        (meta ? '<p class="np-meta">' + meta + '</p>' : '') +
        (e.explanation ? '<p class="np-meta">' + esc(e.explanation) + '</p>' : '');
      var ta = document.createElement('textarea');
      ta.className = 'note-area';
      ta.rows = 2;
      ta.placeholder = 'My comment on this question…';
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

  // Send to Edison: snapshot of everything on this page + my comments.
  var sendBtn = document.getElementById('send-btn');
  var sendStatus = document.getElementById('send-status');
  if (sendBtn) sendBtn.onclick = function () {
    var reportGroups = [];
    groups.forEach(function (g) {
      var items = [];
      g.entries.forEach(function (e) {
        var item = { n: e.n, question: e.question, correct: e.correct, explanation: e.explanation || '', comment: notes[e.examKey + '||' + e.question] || '' };
        item.result = e.result || '';
        items.push(item);
      });
      if (items.length) reportGroups.push({ title: g.title, items: items });
    });
    if (!reportGroups.length) { sendStatus.textContent = 'Nothing to send yet.'; return; }
    var report = { id: 'r' + Date.now(), ts: new Date().toISOString(), page: 'quality', groups: reportGroups };
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

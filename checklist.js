(function () {
  var hist = {};
  var prog = {};
  try { hist = JSON.parse(localStorage.getItem('examHistory') || '{}'); } catch (e) { hist = {}; }
  try { prog = JSON.parse(localStorage.getItem('examProgress') || '{}'); } catch (e) { prog = {}; }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function shortTitle(exam) {
    var t = exam.title || exam.file;
    var cat = exam.category || '';
    if (cat && t.indexOf(cat + ' \u2014 ') === 0) t = t.slice(cat.length + 3);
    if (exam.chapter) {
      var pre = 'Chapter ' + exam.chapter + ', ';
      if (t.indexOf(pre) === 0) t = t.slice(pre.length);
    }
    return t;
  }

  function statsFor(exam) {
    var attempts = hist[exam.file] || [];
    var latest = attempts.length ? attempts[0] : null;
    var p = prog[exam.file] || null;
    return {
      attempts: attempts.length,
      correct: latest ? latest.score : null,
      wrong: latest ? (latest.missed ? latest.missed.length : latest.total - latest.score) : null,
      review: latest ? (latest.flagged ? latest.flagged.length : 0) : null,
      total: latest ? latest.total : null,
      date: latest ? latest.ts : null,
      inProgress: p ? (p.idx + 1) : null,
      inProgressTotal: p ? p.total : null
    };
  }

  fetch('index.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var exams = (data.exams || []).filter(function (e) { return !e.placeholder; });
      var root = document.getElementById('checklist');
      if (!exams.length) { document.getElementById('empty').hidden = false; return; }

      // Group: category -> chapter -> exams, in index order.
      var cats = [];
      var byCat = {};
      exams.forEach(function (e) {
        var c = e.category || 'Exams';
        if (!byCat[c]) { byCat[c] = { chapters: [], byCh: {} }; cats.push(c); }
        var ch = (e.chapter == null ? '' : e.chapter);
        if (!byCat[c].byCh[ch]) { byCat[c].byCh[ch] = []; byCat[c].chapters.push(ch); }
        byCat[c].byCh[ch].push(e);
      });

      var totExams = 0, totAttempted = 0, totAttempts = 0, totCorrect = 0, totWrong = 0, totReview = 0;

      cats.forEach(function (cat) {
        var h = document.createElement('h2');
        h.className = 'check-cat';
        h.textContent = cat;
        root.appendChild(h);

        byCat[cat].chapters.forEach(function (ch) {
          var list = byCat[cat].byCh[ch];
          var rows = list.map(function (e) { return { exam: e, s: statsFor(e) }; });
          var doneCount = rows.filter(function (r) { return r.s.attempts > 0; }).length;

          var h3 = document.createElement('h3');
          h3.className = 'check-ch';
          h3.textContent = (ch === '' ? 'Exams' : 'Chapter ' + ch) + ' \u2014 ' + doneCount + ' of ' + list.length + ' attempted';
          root.appendChild(h3);

          var table = document.createElement('table');
          table.className = 'check-table';
          var thead = '<thead><tr><th class="tname">Test</th><th>Attempts</th><th>Correct</th><th>Wrong</th><th>&#9734; Review</th></tr></thead>';
          var body = rows.map(function (r) {
            totExams++;
            totAttempts += r.s.attempts;
            if (r.s.attempts > 0) {
              totAttempted++;
              totCorrect += r.s.correct || 0;
              totWrong += r.s.wrong || 0;
              totReview += r.s.review || 0;
            }
            var name = '<a href="exam.html?file=' + encodeURIComponent(r.exam.file) + '">' + esc(shortTitle(r.exam)) + '</a>';
            var sub = '';
            if (r.s.inProgress) sub = '<span class="check-sub">In progress \u2014 question ' + r.s.inProgress + ' of ' + r.s.inProgressTotal + '</span>';
            else if (r.s.date) sub = '<span class="check-sub">Last: ' + esc(new Date(r.s.date).toLocaleDateString()) + '</span>';
            var dash = '<span class="check-dash">\u2014</span>';
            return '<tr>' +
              '<td class="tname">' + name + (sub ? '<br>' + sub : '') + '</td>' +
              '<td>' + (r.s.attempts ? r.s.attempts : dash) + '</td>' +
              '<td>' + (r.s.correct == null ? dash : r.s.correct) + '</td>' +
              '<td>' + (r.s.wrong == null ? dash : r.s.wrong) + '</td>' +
              '<td>' + (r.s.review == null ? dash : r.s.review) + '</td>' +
              '</tr>';
          }).join('');
          table.innerHTML = thead + '<tbody>' + body + '</tbody>';
          root.appendChild(table);
        });
      });

      document.getElementById('totals').textContent =
        totAttempted + ' of ' + totExams + ' tests attempted \u00B7 ' + totAttempts + ' total attempts \u00B7 ' +
        'Latest attempts: ' + totCorrect + ' correct \u00B7 ' + totWrong + ' wrong \u00B7 ' + totReview + ' need review';
    })
    .catch(function () {
      document.getElementById('empty').hidden = false;
    });
})();

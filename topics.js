// Topics page — per-chapter circle (ALEKS-style): slice = set (topic group),
// dark = mastered topics, light = learning, pale = ready. Topic status comes from
// the latest finished attempt per exam file on this device (examHistory).
(function () {
  var PALETTE = ['#2563eb', '#0891b2', '#059669', '#65a30d', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0d9488', '#475569', '#9333ea'];
  var STATUS = {
    'Mastered': '#15803d',
    'Learning': '#f59e0b',
    'Ready to Learn': '#2563eb'
  };
  var hist = {};
  try { hist = JSON.parse(localStorage.getItem('examHistory') || '{}'); } catch (e) { hist = {}; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function tint(hex, f) { // mix hex color with white; f = fraction of white
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r + (255 - r) * f); g = Math.round(g + (255 - g) * f); b = Math.round(b + (255 - b) * f);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function shortTitle(e) {
    var t = e.title || e.file;
    var pre = (e.category || '') + ' \u2014 ';
    if (t.indexOf(pre) === 0) t = t.slice(pre.length);
    var pre2 = 'Chapter ' + e.chapter + ', ';
    if (t.indexOf(pre2) === 0) t = t.slice(pre2.length);
    return t;
  }
  function wedge(cx, cy, r, a0, a1) {
    if (a1 - a0 >= Math.PI * 2) a1 = a0 + Math.PI * 2 - 0.0001;
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    return 'M' + cx + ' ' + cy + ' L' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' Z';
  }

  var params = new URLSearchParams(location.search);
  var chParam = params.get('ch');

  fetch('index.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (idx) {
    var allNremt = (idx.exams || []).filter(function (e) { return e.category === 'NREMT'; });
    var entries = allNremt.filter(function (e) { return !/macro/.test(e.file); });
    var chapters = [];
    entries.forEach(function (e) { if (chapters.indexOf(e.chapter) === -1) chapters.push(e.chapter); });
    chapters.sort(function (a, b) { return a - b; });
    if (!chParam) return renderCards(entries, chapters);
    var macro = allNremt.filter(function (e) { return /macro/.test(e.file) && String(e.chapter) === String(chParam); })[0] || null;
    renderChapter(entries.filter(function (e) { return String(e.chapter) === String(chParam); }), chParam, macro);
  }).catch(function () {
    document.getElementById('tp-chapters').textContent = 'Could not load the exam list.';
  });

  function renderCards(entries, chapters) {
    var box = document.getElementById('tp-chapters');
    chapters.forEach(function (ch) {
      var es = entries.filter(function (e) { return e.chapter === ch; });
      var topics = 0, questions = 0;
      es.forEach(function (e) {
        var m = /Topics (\d+)\u2013(\d+)/.exec(e.title || '');
        if (m) topics += (+m[2] - +m[1] + 1);
        var q = /(\d+) questions/.exec(e.note || '');
        if (q) questions += +q[1];
      });
      var a = document.createElement('a');
      a.className = 'nav-card tp-card';
      a.href = 'topics.html?ch=' + ch;
      a.innerHTML = 'Chapter ' + ch + '<small>' + topics + ' topics \u00B7 ' + questions + ' questions</small>';
      box.appendChild(a);
    });
  }

  function statusFor(file, questions) {
    var attempts = hist[file] || [];
    var latest = attempts.length ? attempts[0] : null;
    if (!latest) return null;
    var missed = {};
    (latest.missed || []).forEach(function (m) { missed[m.question] = true; });
    var flagged = {};
    (latest.flagged || []).forEach(function (m) { flagged[m.question] = true; });
    var per = {};
    questions.forEach(function (q) {
      if (!q.topic) return;
      var t = per[q.topic] || (per[q.topic] = { n: 0, correct: 0, flagged: 0 });
      t.n++;
      if (!missed[q.question]) t.correct++;
      if (flagged[q.question]) t.flagged++;
    });
    return per;
  }

  function renderChapter(es, ch, macro) {
    document.getElementById('tp-title').textContent = 'Chapter ' + ch + ' \u2014 Topics';
    document.getElementById('tp-note').textContent = 'Status from your latest finished attempt on each set, on this device. Mastered = 80%+ correct on that attempt.';
    document.getElementById('tp-main').hidden = false;
    if (macro) {
      var mb = document.createElement('p');
      mb.innerHTML = '<a class="tp-practice" href="exam.html?exam=' + encodeURIComponent(macro.file) + '">Chapter ' + ch + ' macro exam \u2014 all questions</a>';
      document.getElementById('tp-main').insertBefore(mb, document.getElementById('tp-main').children[1]);
    }
    Promise.all(es.map(function (e) {
      return fetch(e.file, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
        return { entry: e, questions: d.questions || [] };
      }).catch(function () { return { entry: e, questions: [] }; });
    })).then(function (groups) {
      buildChapter(groups, ch);
    });
  }

  function buildChapter(groups, ch) {
    // Build topic model per group
    groups.forEach(function (g, gi) {
      g.color = PALETTE[gi % PALETTE.length];
      g.name = shortTitle(g.entry);
      g.isTextbook = /textbook/.test(g.entry.file);
      var per = statusFor(g.entry.file, g.questions);
      var byTopic = {};
      g.questions.forEach(function (q) {
        if (!q.topic) return;
        var t = byTopic[q.topic] || (byTopic[q.topic] = { name: q.topic, n: 0, topic_n: q.topic_n || 0 });
        t.n++;
      });
      g.topics = Object.keys(byTopic).map(function (k) { return byTopic[k]; }).sort(function (a, b) { return a.topic_n - b.topic_n; });
      g.topics.forEach(function (t) {
        var s = per && per[t.name];
        if (!s) { t.status = 'Ready to Learn'; t.flagged = 0; }
        else {
          t.flagged = s.flagged;
          t.status = (s.correct / s.n) >= 0.8 ? 'Mastered' : 'Learning';
        }
      });
      if (g.isTextbook) {
        var attempted = (hist[g.entry.file] || []).length > 0;
        g.topics = [{ name: 'All textbook case questions', n: g.questions.length, topic_n: 0, status: attempted ? 'Learning' : 'Ready to Learn', flagged: 0, all: true }];
      }
    });

    var totalTopics = groups.reduce(function (s, g) { return s + g.topics.length; }, 0);
    var realTopics = groups.reduce(function (s, g) { return s + (g.isTextbook ? 0 : g.topics.length); }, 0);
    var doneTopics = 0, masteredTopics = 0;
    groups.forEach(function (g) { if (g.isTextbook) return; g.topics.forEach(function (t) {
      if (t.status === 'Mastered') { masteredTopics++; doneTopics++; }
      else if (t.status === 'Learning') doneTopics++;
    }); });

    // Up next: first Learning topic, else first Ready topic
    var up = null;
    ['Learning', 'Ready to Learn'].forEach(function (want) {
      if (up) return;
      groups.forEach(function (g) { if (up) return; g.topics.forEach(function (t) { if (!up && t.status === want && !t.all) up = { g: g, t: t }; }); });
    });
    var upEl = document.getElementById('tp-upnext');
    if (up) {
      upEl.hidden = false;
      upEl.innerHTML = 'UP NEXT: <strong>' + esc(up.t.name) + '</strong> \u00B7 ' + esc(up.g.name) +
        ' <a class="tp-practice" href="exam.html?exam=' + encodeURIComponent(up.g.entry.file) + '&topic=' + encodeURIComponent(up.t.name) + '">Practice</a>';
    }

    // Pie
    var svg = document.getElementById('tp-pie');
    var CX = 210, CY = 210, R = 198;
    var a = -Math.PI / 2;
    var parts = [];
    groups.forEach(function (g, gi) {
      var span = totalTopics ? (Math.PI * 2) * (g.topics.length / totalTopics) : 0;
      var counts = { 'Mastered': 0, 'Learning': 0, 'Ready to Learn': 0 };
      g.topics.forEach(function (t) { counts[t.status]++; });
      g.counts = counts;
      var order = [['Mastered', g.color], ['Learning', tint(g.color, 0.45)], ['Ready to Learn', tint(g.color, 0.82)]];
      var cur = a;
      order.forEach(function (o) {
        if (!counts[o[0]]) return;
        var sub = span * (counts[o[0]] / g.topics.length);
        parts.push('<path d="' + wedge(CX, CY, R, cur, cur + sub) + '" fill="' + o[1] + '" stroke="#fff" stroke-width="2" data-group="' + gi + '"><title>' + esc(g.name) + '</title></path>');
        cur += sub;
      });
      a += span;
    });
    parts.push('<circle cx="' + CX + '" cy="' + CY + '" r="80" fill="#fff" stroke="#cbd5e1" stroke-width="2" id="tp-center-bg"></circle>');
    parts.push('<text id="tp-center-num" x="' + CX + '" y="' + (CY - 2) + '" text-anchor="middle" font-size="40" font-weight="700" fill="#0f172a"></text>');
    parts.push('<text id="tp-center-lab" x="' + CX + '" y="' + (CY + 24) + '" text-anchor="middle" font-size="15" fill="#475569"></text>');
    svg.innerHTML = parts.join('');
    var selected = -1, mi = 0;
    function scopeModes() {
      if (selected < 0) return { total: realTopics, modes: [
        [doneTopics, 'topics done'], [masteredTopics, 'mastered'],
        [(realTopics ? Math.round(100 * doneTopics / realTopics) : 0) + '%', 'done']] };
      var g = groups[selected], c = g.counts;
      var done = c['Mastered'] + c['Learning'], tot = g.topics.length;
      return { total: tot, modes: [
        [done, 'topics done'], [c['Mastered'], 'mastered'],
        [(tot ? Math.round(100 * done / tot) : 0) + '%', 'done']] };
    }
    function drawCenter() {
      var sm = scopeModes();
      document.getElementById('tp-center-num').textContent = sm.modes[mi][0];
      document.getElementById('tp-center-lab').textContent = sm.modes[mi][1] + ' of ' + sm.total + ' topics';
    }
    function renderDetail() {
      var box = document.getElementById('tp-detail');
      if (selected < 0) {
        var mc = 0, lc = 0, rc = 0;
        groups.forEach(function (g) { if (g.isTextbook) return; mc += g.counts['Mastered']; lc += g.counts['Learning']; rc += g.counts['Ready to Learn']; });
        box.innerHTML = '<p class="tp-detail-head">Whole chapter</p>' +
          '<p class="tp-detail-counts"><span style="color:#15803d">Mastered ' + mc + '</span> \u00B7 <span style="color:#f59e0b">Learning ' + lc + '</span> \u00B7 <span style="color:#2563eb">Ready ' + rc + '</span></p>' +
          '<p class="tp-detail-hint">Tap a slice to see that set\u2019s topics.</p>';
        return;
      }
      var g = groups[selected], c = g.counts;
      var html = '<p class="tp-detail-head"><span class="tp-chip-color" style="background:' + g.color + '"></span> ' + esc(g.name) +
        ' <button type="button" class="tp-reset" id="tp-reset">Whole chapter</button></p>' +
        '<p class="tp-detail-counts"><span style="color:#15803d">Mastered ' + c['Mastered'] + '</span> \u00B7 <span style="color:#f59e0b">Learning ' + c['Learning'] + '</span> \u00B7 <span style="color:#2563eb">Ready ' + c['Ready to Learn'] + '</span></p>';
      ['Mastered', 'Learning', 'Ready to Learn'].forEach(function (st) {
        var ts = g.topics.filter(function (x) { return x.status === st; });
        if (!ts.length) return;
        html += '<p class="tp-detail-group" style="color:' + STATUS[st] + '">' + st + '</p>';
        ts.forEach(function (x) {
          var href = 'exam.html?exam=' + encodeURIComponent(g.entry.file) + (x.all ? '' : '&topic=' + encodeURIComponent(x.name));
          html += '<div class="tp-topic-row"><span class="tp-topic-name">' + esc(x.name) + (x.flagged ? ' <span class="tp-flag">\u2605 ' + x.flagged + '</span>' : '') + '</span><span class="tp-topic-meta">' + x.n + ' questions</span><a class="tp-practice" href="' + href + '">Practice</a></div>';
        });
      });
      box.innerHTML = html;
      var rb = document.getElementById('tp-reset');
      if (rb) rb.addEventListener('click', function () { selectGroup(-1, false); });
    }
    function selectGroup(gi, scroll) {
      selected = (gi === selected) ? -1 : gi;
      mi = 0;
      svg.querySelectorAll('path[data-group]').forEach(function (p) {
        p.style.opacity = (selected < 0 || +p.getAttribute('data-group') === selected) ? '1' : '0.3';
      });
      groups.forEach(function (g, i) {
        var head = document.getElementById('tp-group-' + i);
        if (head) head.classList.toggle('tp-selected', i === selected);
      });
      drawCenter(); renderDetail();
      if (selected >= 0) {
        if (groups[selected]._body) groups[selected]._body.hidden = false;
        if (scroll) document.getElementById('tp-group-' + selected).scrollIntoView({ block: 'start' });
      }
    }
    drawCenter(); renderDetail();
    svg.addEventListener('click', function (ev) {
      if (ev.target.id === 'tp-center-bg' || ev.target.id === 'tp-center-num' || ev.target.id === 'tp-center-lab') {
        mi = (mi + 1) % 3; drawCenter(); return;
      }
      var gi = ev.target.getAttribute && ev.target.getAttribute('data-group');
      if (gi !== null && gi !== undefined) selectGroup(+gi, true);
    });

    // List
    var list = document.getElementById('tp-list');
    list.innerHTML = '';
    groups.forEach(function (g, gi) {
      var counts = { 'Mastered': 0, 'Learning': 0, 'Ready to Learn': 0 };
      g.topics.forEach(function (t) { counts[t.status]++; });
      var head = document.createElement('button');
      head.type = 'button';
      head.className = 'tp-group-head';
      head.id = 'tp-group-' + gi;
      head.innerHTML = '<span class="tp-chip-color" style="background:' + g.color + '"></span>' +
        '<span class="tp-group-name">' + esc(g.name) + '</span>' +
        '<span class="tp-group-counts">' + g.topics.length + ' topics \u00B7 ' + counts['Mastered'] + ' mastered \u00B7 ' + counts['Learning'] + ' learning \u00B7 ' + counts['Ready to Learn'] + ' ready</span>';
      var body = document.createElement('div');
      body.className = 'tp-group-body';
      body.hidden = true;
      if (!g.isTextbook) {
        var full = document.createElement('div');
        full.className = 'tp-topic-row';
        full.innerHTML = '<span class="tp-topic-name">Full set exam</span><span class="tp-topic-meta">every topic in this set</span><a class="tp-practice" href="exam.html?exam=' + encodeURIComponent(g.entry.file) + '">Start</a>';
        body.appendChild(full);
      }
      g.topics.forEach(function (t) {
        var row = document.createElement('div');
        row.className = 'tp-topic-row';
        var href = 'exam.html?exam=' + encodeURIComponent(g.entry.file) + (t.all ? '' : '&topic=' + encodeURIComponent(t.name));
        row.innerHTML = '<span class="tp-topic-name">' + esc(t.name) + (t.flagged ? ' <span class="tp-flag">\u2605 ' + t.flagged + '</span>' : '') + '</span>' +
          '<span class="tp-topic-meta"><span class="tp-status" style="color:' + STATUS[t.status] + '">' + t.status + '</span> \u00B7 ' + t.n + ' questions</span>' +
          '<a class="tp-practice" href="' + href + '">Practice</a>';
        body.appendChild(row);
      });
      head.addEventListener('click', function () { toggleGroup(gi, false); selectGroup(gi, false); });
      list.appendChild(head);
      list.appendChild(body);
      g._body = body;
    });
    // Open the group holding Up Next, else the first group
    var openIdx = up ? groups.indexOf(up.g) : 0;
    if (groups[openIdx]) groups[openIdx]._body.hidden = false;

    function toggleGroup(gi, scroll) {
      var g = groups[gi];
      if (!g || !g._body) return;
      g._body.hidden = !g._body.hidden;
      if (scroll && !g._body.hidden) document.getElementById('tp-group-' + gi).scrollIntoView({ block: 'start' });
    }
  }
})();

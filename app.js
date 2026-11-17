fetch('index.json')
  .then(r => r.json())
  .then(data => {
    const list = document.getElementById('exam-list');
    if (!data.exams.length) { document.getElementById('empty').hidden = false; return; }
    data.exams.forEach(e => {
      const li = document.createElement('li');
      if (e.placeholder) {
        li.textContent = e.title + ' — placeholder, not built yet';
      } else {
        const a = document.createElement('a');
        a.href = 'exam.html?exam=' + encodeURIComponent(e.file);
        a.textContent = e.title;
        li.appendChild(a);
        if (e.note) li.append(' — ' + e.note);
      }
      list.appendChild(li);
    });
  });

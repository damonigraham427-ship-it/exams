# Exam Site

Live: https://damonigraham427-ship-it.github.io/exams/

All files sit at the repo root.

- index.html — exam list page
- exam.html — one-question-at-a-time runner (feedback, explanation, score, retry)
- app.js, exam.js, style.css — logic and styling
- index.json — the exam list: {"exams": [{"file": "<exam>.json", "title": "...", "note": "..."}]}
- One JSON file per exam: {"questions": [{"question": "...", "choices": ["...", "..."], "answer": 0, "explanation": "..."}]}
  - "answer" is the 0-based index of the correct choice.

Adding an exam: add its JSON file at the root, add one line for it in index.json, commit. Edison does this for each exam Damoni dictates.

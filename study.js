if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

const chapterMenu = document.getElementById('chapter-menu');
if (chapterMenu) {
  const bookId = new URLSearchParams(location.search).get('book');
  const book = typeof practiceBooks === 'undefined'
    ? undefined
    : practiceBooks.find(({ id }) => String(id) === bookId);

  if (book) {
    setupPractice(book);
  } else {
    document.getElementById('unavailable').hidden = false;
  }
}

function setupPractice(book) {
  const byId = (id) => document.getElementById(id);
  const quiz = byId('quiz');
  const result = byId('result');
  const reveal = byId('reveal');
  const answerPanel = byId('answer-panel');
  const retry = byId('retry');
  const answerForm = byId('answer-form');
  const answerFields = byId('answer-fields');
  const gradeButton = byId('grade');
  const gradeSummary = byId('grade-summary');
  const continueButton = byId('continue');
  const writtenAnswer = byId('written-answer');
  writtenAnswer.addEventListener('input', () => {
    byId('written-count').textContent = `${Array.from(writtenAnswer.value).length}文字`;
  });
  byId('exam-note').hidden = book.id !== 'exam';
  let needsReview;
  let chapter;
  let queue;
  let index;
  let missed;

  function show(screen) {
    for (const section of [chapterMenu, quiz, result]) {
      section.hidden = section !== screen;
    }
  }

  function showQuestion() {
    const question = queue[index];
    byId('position').textContent = `${index + 1} / ${queue.length}問`;
    byId('topic').textContent = question.topic;
    byId('prompt').textContent = question.prompt;
    byId('answer').textContent = question.answer;
    byId('written-panel').hidden = !question.written;
    writtenAnswer.value = '';
    writtenAnswer.rows = question.essay ? 12 : 6;
    byId('written-count').textContent = '0文字';
    byId('word-bank').hidden = !question.wordBank;
    byId('word-bank').textContent = question.wordBank ? `語群：${question.wordBank.join(' ／ ')}` : '';
    byId('answer-instructions').textContent = question.grouped
      ? '力を上の3欄、精神を下の2欄に入力してください。各組の中は順不同です。'
      : question.ordered ? '空欄の番号に対応する答えを入力してください。'
      : '漢字かひらがなで、1欄に1つずつ入力してください。順番は自由です。';
    const acceptsInput = Boolean(question.acceptedAnswers);
    reveal.hidden = acceptsInput;
    answerForm.hidden = !acceptsInput;
    byId('self-assessment').hidden = acceptsInput;
    continueButton.hidden = true;
    if (acceptsInput) prepareAnswerFields(question);
    answerPanel.hidden = true;
    byId('prompt').focus();
  }

  function prepareAnswerFields(question) {
    const { acceptedAnswers } = question;
    answerFields.replaceChildren();
    gradeButton.hidden = false;
    gradeSummary.textContent = '';
    for (const [index] of acceptedAnswers.entries()) {
      const row = document.createElement('div');
      const label = document.createElement('label');
      const input = document.createElement('input');
      const status = document.createElement('span');
      input.id = `answer-entry-${index}`;
      input.autocomplete = 'off';
      input.setAttribute('aria-describedby', `answer-instructions answer-status-${index}`);
      label.htmlFor = input.id;
      label.textContent = question.labels?.[index] || (question.ordered ? `（${index + 1}）` : `${index + 1}つ目`);
      status.id = `answer-status-${index}`;
      row.append(label, input, status);
      answerFields.append(row);
    }
  }

  answerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (gradeButton.hidden) return;

    const question = queue[index];
    const acceptedAnswers = question.acceptedAnswers;
    const matched = new Set();
    for (const [fieldIndex, input] of [...answerFields.querySelectorAll('input')].entries()) {
      const value = input.value.normalize('NFKC').replace(/\s+/gu, '');
      const candidates = question.grouped
        ? (fieldIndex < question.grouped[0] ? acceptedAnswers.slice(0, question.grouped[0]) : acceptedAnswers.slice(question.grouped[0]))
        : question.ordered ? [acceptedAnswers[fieldIndex]] : acceptedAnswers;
      const match = candidates.find((forms) => forms.includes(value));
      const status = input.nextElementSibling;
      if (!value) {
        status.textContent = '未入力';
      } else if (!match) {
        status.textContent = '不正解';
      } else if (matched.has(match)) {
        status.textContent = '重複';
      } else {
        status.textContent = '正解';
        matched.add(match);
      }
      input.readOnly = true;
    }

    needsReview = matched.size !== acceptedAnswers.length;
    gradeSummary.textContent = needsReview
      ? `${acceptedAnswers.length}項目中${matched.size}項目正解`
      : `${acceptedAnswers.length}項目すべて正解`;
    gradeButton.hidden = true;
    answerPanel.hidden = false;
    continueButton.hidden = false;
    continueButton.focus();
  });
  continueButton.addEventListener('click', () => recordAnswer(needsReview));

  function start(questions) {
    queue = questions;
    index = 0;
    missed = [];
    byId('chapter-title').textContent = chapter.title;
    show(quiz);
    showQuestion();
  }

  function recordAnswer(needsReview) {
    if (needsReview) missed.push(queue[index]);
    index += 1;

    if (index < queue.length) {
      showQuestion();
      return;
    }

    byId('result-summary').textContent =
      `${chapter.title}。全${queue.length}問のうち、覚えていた問題は${queue.length - missed.length}問、復習する問題は${missed.length}問です。`;
    retry.hidden = missed.length === 0;
    show(result);
    byId('result-title').focus();
  }

  document.title = `${book.title} | 章別練習`;
  byId('book-title').textContent = book.title;

  for (const selected of book.chapters) {
    const button = document.createElement('button');
    const count = document.createElement('span');
    button.type = 'button';
    button.textContent = selected.title;
    count.textContent = `${selected.questions.length}問`;
    button.append(count);
    button.addEventListener('click', () => {
      chapter = selected;
      start(chapter.questions);
    });
    byId('chapters').append(button);
  }

  reveal.addEventListener('click', () => {
    answerPanel.hidden = false;
    reveal.hidden = true;
    byId('answer-heading').focus();
  });
  byId('remembered').addEventListener('click', () => recordAnswer(false));
  byId('review').addEventListener('click', () => recordAnswer(true));
  retry.addEventListener('click', () => start(missed));
  byId('restart').addEventListener('click', () => start(chapter.questions));

  for (const button of document.querySelectorAll('[data-chapters]')) {
    button.addEventListener('click', () => {
      show(chapterMenu);
      byId('choose-chapter').focus();
    });
  }

  show(chapterMenu);
}

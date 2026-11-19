const wazaLabels = ['布陣', '攻者の体構', '攻者の技', '守者の体構', '守者の技'];
function normalizeSearch(value) {
  return value.normalize('NFKC')
    .replace(/[ァ-ヶ]/g, (kana) => String.fromCharCode(kana.charCodeAt(0) - 0x60))
    .replace(/[\s()・]/g, '');
}

const techniques = wazaRows.map(([row, group, rank, name, ...answers]) => ({
  group, rank, name, answers,
  searchName: normalizeSearch(name),
  searchReading: normalizeSearch(wazaReadings[row] ?? ''),
}));
const byId = (id) => document.getElementById('waza-' + id);
const mode = byId('mode');
const group = byId('group');
const rank = byId('rank');
const fields = byId('fields');
const search = byId('search');
const matches = byId('matches');
const feedback = byId('feedback');
const previous = byId('prev');
const next = byId('next');
const reveal = byId('reveal');
const grade = byId('grade');

let filtered = [];
let index = 0;
let quizFields = [];

for (const name of Object.keys(kenkeiDescriptions)) group.add(new Option(name, name));
for (const name of [...new Set(techniques.map((technique) => technique.rank))]
  .sort((a, b) => (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0))) {
  rank.add(new Option(name, name));
}

const hideFields = wazaLabels.map((label, field) => {
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = field === 2 || field === 4;
  const wrapper = document.createElement('label');
  wrapper.append(checkbox, ' ' + label);
  byId('hide-fields').append(wrapper);
  return checkbox;
});

function shuffle(values) {
  for (let last = values.length - 1; last > 0; last--) {
    const other = Math.floor(Math.random() * (last + 1));
    [values[last], values[other]] = [values[other], values[last]];
  }
  return values;
}

function choicesFor(technique, field) {
  const correct = technique.answers[field];
  const alternatives = (entries) => [...new Set(entries.map(({ answers }) => answers[field]))]
    .filter((answer) => answer !== null && answer !== correct);

  const sameGroup = shuffle(alternatives(techniques.filter(({ group }) => group === technique.group)));
  const otherGroups = shuffle(alternatives(techniques)).filter((answer) => !sameGroup.includes(answer));
  return shuffle([correct, ...[...sameGroup, ...otherGroups].slice(0, 3)]);
}

function renderCard(showAnswers = false) {
  const technique = filtered[index];
  const recalling = mode.value === 'recall';
  const quizzing = mode.value === 'quiz';
  byId('hide-settings').hidden = !recalling;
  byId('card').hidden = !technique;
  byId('navigation').hidden = !technique;
  byId('empty').hidden = Boolean(technique);
  if (!technique) return;

  const { name, group, rank, answers } = technique;
  matches.value = String(index);
  byId('name').textContent = name;
  byId('position').textContent = `${group} · ${rank} · ${index + 1} / ${filtered.length}`;
  fields.replaceChildren();
  feedback.textContent = '';
  quizFields = [];
  let hasHidden = false;

  answers.forEach((answer, field) => {
    const row = document.createElement('div');
    row.className = 'waza-field';
    const label = document.createElement(quizzing && answer !== null ? 'label' : 'div');
    label.textContent = wazaLabels[field];
    row.append(label);
    if (quizzing && answer !== null) {
      const select = document.createElement('select');
      select.id = `waza-choice-${field}`;
      select.required = true;
      label.htmlFor = select.id;
      select.add(new Option('選択してください', ''));
      for (const choice of choicesFor(technique, field)) select.add(new Option(choice, choice));
      const result = document.createElement('div');
      result.className = 'waza-field-result';
      result.id = `waza-result-${field}`;
      select.setAttribute('aria-describedby', result.id);
      row.append(select, result);
      quizFields.push({ select, result, answer });
    } else {
      const value = document.createElement('div');
      const concealed = recalling && hideFields[field].checked && answer !== null && !showAnswers;
      hasHidden = hasHidden || concealed;
      value.textContent = concealed ? '•••••' : answer ?? '資料に記載なし';
      if (concealed) value.setAttribute('aria-label', '非表示');
      row.append(value);
    }
    fields.append(row);
  });

  reveal.hidden = !hasHidden;
  grade.hidden = !quizzing || quizFields.length === 0;
  if (quizzing && grade.hidden) feedback.textContent = 'この技は資料に出題項目の記載がありません。';
  previous.disabled = index === 0;
  next.disabled = index === filtered.length - 1;
}

function applyFilters() {
  const query = normalizeSearch(search.value);
  filtered = techniques.filter((technique) =>
    (!group.value || technique.group === group.value) &&
    (!rank.value || technique.rank === rank.value) &&
    (technique.searchName.includes(query) || technique.searchReading.includes(query)));
  index = 0;
  byId('search-results').hidden = !query || !filtered.length;
  matches.replaceChildren();
  if (query) {
    filtered.forEach(({ name, rank }, position) => {
      matches.add(new Option(`${name} · ${rank}`, String(position)));
    });
  }
  const description = byId('description');
  description.textContent = kenkeiDescriptions[group.value] ?? '';
  description.hidden = !group.value;
  renderCard();
}

function navigate(offset) {
  const destination = index + offset;
  if (destination < 0 || destination >= filtered.length) return;
  index = destination;
  renderCard();
  byId('name').focus();
}

search.addEventListener('input', applyFilters);
matches.addEventListener('change', () => {
  index = Number(matches.value);
  renderCard();
});
group.addEventListener('change', applyFilters);
rank.addEventListener('change', applyFilters);
mode.addEventListener('change', () => renderCard());
byId('hide-fields').addEventListener('change', () => renderCard());
previous.addEventListener('click', () => navigate(-1));
next.addEventListener('click', () => navigate(1));
reveal.addEventListener('click', () => {
  renderCard(true);
  byId('name').focus();
});
byId('form').addEventListener('change', () => {
  feedback.textContent = '';
  for (const { result } of quizFields) result.textContent = '';
});
byId('form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (mode.value !== 'quiz' || !quizFields.length) return;
  let score = 0;
  for (const { select, result, answer } of quizFields) {
    const correct = select.value === answer;
    if (correct) score++;
    result.textContent = correct ? '✓ 正解' : `不正解 · 正解は「${answer}」`;
    result.dataset.correct = String(correct);
  }
  feedback.textContent = score === quizFields.length ? '全問正解！' : `${quizFields.length}項目中 ${score}項目正解`;
});

applyFilters();
byId('study').hidden = false;

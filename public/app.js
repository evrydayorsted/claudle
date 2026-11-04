const MAX_ATTEMPTS = 5;

const MAX_HINTS = 3;

const dateEl = document.getElementById('date');
const outputEl = document.getElementById('ai-output');
const gridEl = document.getElementById('grid');
const hintRowEl = document.getElementById('hint-row');
const hintBtn = document.getElementById('hint-btn');
const guessSection = document.getElementById('guess-section');
const guessInput = document.getElementById('guess');
const submitBtn = document.getElementById('submit');
const attemptsEl = document.getElementById('attempts');
const errorEl = document.getElementById('error');
const resultSection = document.getElementById('result-section');
const resultHeadlineEl = document.getElementById('result-headline');
const realPromptEl = document.getElementById('real-prompt');
const streakEl = document.getElementById('streak');
const shareBtn = document.getElementById('share-btn');
const shareFeedbackEl = document.getElementById('share-feedback');
const rulesOverlay = document.getElementById('rules-overlay');
const rulesCloseBtn = document.getElementById('rules-close');
const rulesGotItBtn = document.getElementById('rules-got-it');

let today = null;
let state = { guesses: [], finished: false, won: false, hints: { used: 0, revealed: {} } };

function key(suffix) {
  return `claudle_${suffix}`;
}

function loadState(dateString) {
  const raw = localStorage.getItem(key(`state_${dateString}`));
  const parsed = raw ? JSON.parse(raw) : {};
  return {
    guesses: parsed.guesses || [],
    finished: parsed.finished || false,
    won: parsed.won || false,
    hints: parsed.hints || { used: 0, revealed: {} },
    clue: parsed.clue || null,
  };
}

function saveState(dateString) {
  localStorage.setItem(key(`state_${dateString}`), JSON.stringify(state));
}

function getStreak() {
  return parseInt(localStorage.getItem(key('streak')) || '0', 10);
}

function dateMinusOne(dateString) {
  const d = new Date(`${dateString}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function recordResult(dateString, won) {
  const alreadyRecorded = localStorage.getItem(key('last_result_date'));
  if (alreadyRecorded === dateString) return getStreak();

  const lastWonDate = localStorage.getItem(key('last_won_date'));
  let streak = getStreak();

  if (won) {
    streak = lastWonDate === dateMinusOne(dateString) ? streak + 1 : 1;
    localStorage.setItem(key('last_won_date'), dateString);
  } else {
    streak = 0;
  }

  localStorage.setItem(key('streak'), String(streak));
  localStorage.setItem(key('last_result_date'), dateString);
  return streak;
}

function renderGrid() {
  gridEl.innerHTML = '';
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    const row = document.createElement('div');
    row.className = 'grid-row';
    const guess = state.guesses[i];
    for (let j = 0; j < 5; j += 1) {
      const tile = document.createElement('div');
      if (guess) {
        tile.className = `tile ${guess.statuses[j]}`;
        tile.textContent = guess.words[j];
      } else {
        tile.className = 'tile empty';
      }
      row.appendChild(tile);
    }
    gridEl.appendChild(row);
  }
}

function renderHints() {
  hintRowEl.innerHTML = '';
  for (let i = 0; i < 5; i += 1) {
    const tile = document.createElement('div');
    const word = state.hints.revealed[i];
    if (word) {
      tile.className = 'hint-tile revealed';
      tile.textContent = word;
    } else {
      tile.className = 'hint-tile';
      tile.textContent = '?';
    }
    hintRowEl.appendChild(tile);
  }
}

function getGreenPositions() {
  const positions = new Set();
  for (const guess of state.guesses) {
    guess.statuses.forEach((status, i) => {
      if (status === 'green') positions.add(i);
    });
  }
  return [...positions];
}

function updateHintButton() {
  const left = MAX_HINTS - state.hints.used;
  const revealedPositions = Object.keys(state.hints.revealed).map(Number);
  const coveredPositions = new Set([...revealedPositions, ...getGreenPositions()]);
  const nothingLeftToReveal = coveredPositions.size >= 5;
  hintBtn.textContent = `Reveal a word (${left} left)`;
  hintBtn.disabled = left <= 0 || state.finished || nothingLeftToReveal;
}

async function revealHint() {
  if (state.hints.used >= MAX_HINTS || state.finished) return;

  hintBtn.disabled = true;
  try {
    const revealedPositions = Object.keys(state.hints.revealed).map(Number);
    const greenPositions = getGreenPositions();
    const res = await fetch('/api/hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revealedPositions, greenPositions }),
    });

    if (!res.ok) {
      const err = await res.json();
      showError(err.error || 'Something went wrong.');
      return;
    }

    const data = await res.json();
    state.hints.revealed[data.position] = data.word;
    state.hints.used += 1;
    saveState(today);
    renderHints();
  } finally {
    updateHintButton();
  }
}

function updateAttemptsText() {
  const remaining = MAX_ATTEMPTS - state.guesses.length;
  attemptsEl.textContent = state.finished
    ? ''
    : `${remaining} guess${remaining === 1 ? '' : 'es'} left`;
}

const SITE_URL = 'https://claudle.onrender.com';
const SQUARE_EMOJI = { green: '🟩', yellow: '🟨', red: '🟥' };

function formatShortDate(dateString) {
  const d = new Date(`${dateString}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function buildShareText() {
  const attempts = state.won ? String(state.guesses.length) : 'X';
  const header = `Claudle ${formatShortDate(today)} (${attempts}/${MAX_ATTEMPTS})`;
  const hintsUsed = state.hints.used;
  const hintsLine = `${hintsUsed} hint${hintsUsed === 1 ? '' : 's'} used`;
  const grid = state.guesses
    .map((guess) => guess.statuses.map((status) => SQUARE_EMOJI[status]).join(''))
    .join('\n');
  return `${header}\n${hintsLine}\n\n${grid}\n\n${SITE_URL}`;
}

async function shareScore() {
  const text = buildShareText();
  shareFeedbackEl.classList.add('hidden');

  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    shareFeedbackEl.textContent = 'Copied to clipboard!';
  } catch (err) {
    shareFeedbackEl.textContent = text;
  }
  shareFeedbackEl.classList.remove('hidden');
}

async function showFinished() {
  guessSection.classList.add('hidden');
  resultSection.classList.remove('hidden');
  resultHeadlineEl.textContent = state.won ? '🎉 You got it!' : '❌ Out of guesses';
  hintBtn.disabled = true;

  const res = await fetch('/api/reveal');
  const data = await res.json();
  realPromptEl.textContent = data.prompt;

  streakEl.textContent = `🔥 ${getStreak()} day streak`;
}

async function init() {
  const res = await fetch('/api/today');
  const data = await res.json();
  today = data.date;

  dateEl.textContent = new Date(`${today}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  outputEl.textContent = data.aiOutput;

  state = loadState(today);

  // If the puzzle content for this date doesn't match what we last saw,
  // the saved progress belongs to a different puzzle (e.g. a mid-day data
  // fix) - discard it rather than show a mismatched board.
  if (state.clue && state.clue !== data.aiOutput) {
    state = { guesses: [], finished: false, won: false, hints: { used: 0, revealed: {} }, clue: data.aiOutput };
  } else if (!state.clue) {
    state.clue = data.aiOutput;
  }
  saveState(today);

  renderGrid();
  renderHints();
  updateHintButton();
  updateAttemptsText();

  if (state.finished) {
    await showFinished();
  }
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function clearError() {
  errorEl.classList.add('hidden');
  errorEl.textContent = '';
}

async function submitGuess() {
  clearError();
  const guess = guessInput.value.trim();
  const words = guess.split(/\s+/).filter(Boolean);

  if (words.length !== 5) {
    showError('Your guess must be exactly 5 words.');
    return;
  }

  submitBtn.disabled = true;
  try {
    const res = await fetch('/api/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guess }),
    });

    if (!res.ok) {
      const err = await res.json();
      showError(err.error || 'Something went wrong.');
      return;
    }

    const data = await res.json();
    state.guesses.push({ words, statuses: data.results.map((r) => r.status) });

    if (data.won || state.guesses.length >= MAX_ATTEMPTS) {
      state.finished = true;
      state.won = data.won;
      recordResult(today, data.won);
      fetch('/api/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ won: data.won }),
      }).catch(() => {});
    }

    saveState(today);
    renderGrid();
    updateAttemptsText();
    updateHintButton();
    guessInput.value = '';

    if (state.finished) {
      await showFinished();
    }
  } finally {
    submitBtn.disabled = false;
  }
}

function hideRules() {
  rulesOverlay.classList.add('hidden');
}

rulesOverlay.classList.remove('hidden');

rulesCloseBtn.addEventListener('click', hideRules);
rulesGotItBtn.addEventListener('click', hideRules);

shareBtn.addEventListener('click', shareScore);

hintBtn.addEventListener('click', revealHint);
submitBtn.addEventListener('click', submitGuess);
guessInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    submitGuess();
  }
});

init();

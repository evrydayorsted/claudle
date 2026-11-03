// Wordle-style grading for Claudle v2.
//
// Pass 1: guess word === answer word at the same position -> green.
// Pass 2, for every word not already green:
//   a) it exactly matches a different, not-yet-claimed answer word -> yellow
//      (right word, wrong slot).
//   b) otherwise, if it's a synonym of the answer word at that same
//      position (via the free, keyless Datamuse API) -> yellow.
//   c) otherwise -> red.

const synonymCache = new Map(); // word -> Set of synonym words

function normalizeWord(word) {
  return word
    .toLowerCase()
    .trim()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
}

function splitIntoWords(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

async function fetchSynonyms(word) {
  if (synonymCache.has(word)) {
    return synonymCache.get(word);
  }

  const synonyms = new Set();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=50`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      for (const entry of data) {
        synonyms.add(entry.word.toLowerCase());
      }
    }
  } catch (err) {
    // Network hiccup or timeout: treat as "no known synonyms" rather than failing the guess.
  }

  synonymCache.set(word, synonyms);
  return synonyms;
}

async function areSynonyms(wordA, wordB) {
  if (!wordA || !wordB || wordA === wordB) return false;
  const [synA, synB] = await Promise.all([fetchSynonyms(wordA), fetchSynonyms(wordB)]);
  return synA.has(wordB) || synB.has(wordA);
}

async function gradeGuess(guessText, answerText) {
  const guessWords = splitIntoWords(guessText).map(normalizeWord);
  const answerWords = splitIntoWords(answerText).map(normalizeWord);
  const displayWords = splitIntoWords(guessText);

  if (guessWords.length !== 5 || answerWords.length !== 5) {
    throw new Error('Both guess and answer must be exactly 5 words');
  }

  const statuses = new Array(5).fill(null);
  const answerClaimed = new Array(5).fill(false);

  // Pass 1: exact position matches.
  for (let i = 0; i < 5; i += 1) {
    if (guessWords[i] === answerWords[i]) {
      statuses[i] = 'green';
      answerClaimed[i] = true;
    }
  }

  // Pass 2: exact word elsewhere, then synonyms, then red.
  for (let i = 0; i < 5; i += 1) {
    if (statuses[i]) continue;

    let matchedElsewhere = false;
    for (let j = 0; j < 5; j += 1) {
      if (!answerClaimed[j] && guessWords[i] === answerWords[j]) {
        answerClaimed[j] = true;
        matchedElsewhere = true;
        break;
      }
    }
    if (matchedElsewhere) {
      statuses[i] = 'yellow';
      continue;
    }

    if (await areSynonyms(guessWords[i], answerWords[i])) {
      statuses[i] = 'yellow';
      continue;
    }

    statuses[i] = 'red';
  }

  return statuses.map((status, i) => ({ word: displayWords[i], status }));
}

module.exports = { gradeGuess, splitIntoWords };

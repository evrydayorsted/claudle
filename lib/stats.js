const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, '..', 'data', 'stats.json');

function readStats() {
  try {
    return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
  } catch (err) {
    return { byDate: {} };
  }
}

function writeStats(stats) {
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

function emptyDayStats() {
  return { plays: 0, wins: 0, losses: 0 };
}

function recordPlay(dateString) {
  const stats = readStats();
  const day = stats.byDate[dateString] || emptyDayStats();
  day.plays += 1;
  stats.byDate[dateString] = day;
  writeStats(stats);
}

function recordResult(dateString, won) {
  const stats = readStats();
  const day = stats.byDate[dateString] || emptyDayStats();
  if (won) day.wins += 1;
  else day.losses += 1;
  stats.byDate[dateString] = day;
  writeStats(stats);
}

// Render's free tier wipes the local disk on every restart/spin-down, so the
// running totals live on a free external counter (Abacus) instead of in
// stats.json, which only tracks activity since the last restart.
const COUNTER_BASE = 'https://abacus.jasoncameron.dev';
const COUNTER_NAMESPACE = 'claudle-evrydayorsted';
const COUNTER_KEYS = {
  refreshes: 'total-plays-v2',
  guesses: 'total-guesses',
  wins: 'total-wins',
  losses: 'total-losses',
};

function hitCounter(key) {
  // Only the deployed instance should touch the live counters - otherwise
  // every local dev/test run of the server inflates the real totals.
  if (process.env.TRACK_TOTAL_PLAYS !== '1') return;
  fetch(`${COUNTER_BASE}/hit/${COUNTER_NAMESPACE}/${key}`).catch(() => {});
}

async function getCounter(key) {
  try {
    const res = await fetch(`${COUNTER_BASE}/get/${COUNTER_NAMESPACE}/${key}`);
    const data = await res.json();
    return typeof data.value === 'number' ? data.value : null;
  } catch (err) {
    return null;
  }
}

function recordTotalRefresh() {
  hitCounter(COUNTER_KEYS.refreshes);
}

function recordTotalGuess() {
  hitCounter(COUNTER_KEYS.guesses);
}

function recordTotalWin() {
  hitCounter(COUNTER_KEYS.wins);
}

function recordTotalLoss() {
  hitCounter(COUNTER_KEYS.losses);
}

async function getTotalCounters() {
  const [totalRefreshes, totalGuesses, totalWins, totalLosses] = await Promise.all([
    getCounter(COUNTER_KEYS.refreshes),
    getCounter(COUNTER_KEYS.guesses),
    getCounter(COUNTER_KEYS.wins),
    getCounter(COUNTER_KEYS.losses),
  ]);
  return { totalRefreshes, totalGuesses, totalWins, totalLosses };
}

module.exports = {
  readStats,
  recordPlay,
  recordResult,
  recordTotalRefresh,
  recordTotalGuess,
  recordTotalWin,
  recordTotalLoss,
  getTotalCounters,
};

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
// running total lives on a free external counter (Abacus) instead of in
// stats.json, which only tracks activity since the last restart.
const COUNTER_BASE = 'https://abacus.jasoncameron.dev';
const COUNTER_NAMESPACE = 'claudle-evrydayorsted';
const COUNTER_KEY = 'total-plays';

function recordTotalHit() {
  fetch(`${COUNTER_BASE}/hit/${COUNTER_NAMESPACE}/${COUNTER_KEY}`).catch(() => {});
}

async function getTotalHits() {
  try {
    const res = await fetch(`${COUNTER_BASE}/get/${COUNTER_NAMESPACE}/${COUNTER_KEY}`);
    const data = await res.json();
    return typeof data.value === 'number' ? data.value : null;
  } catch (err) {
    return null;
  }
}

module.exports = { readStats, recordPlay, recordResult, recordTotalHit, getTotalHits };

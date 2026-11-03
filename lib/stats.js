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

module.exports = { readStats, recordPlay, recordResult };

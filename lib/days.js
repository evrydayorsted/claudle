const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'days.json');

function loadData() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

// Rolls over at midnight UTC, not the host's local timezone - keeps "today"
// identical no matter what timezone the server happens to be deployed in.
function todayDateString(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const diff = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// Rotation-derived picks are pinned per date once served, so editing the
// rotation pool (or a redeploy) mid-day can never swap the puzzle out from
// under a player already partway through a guess.
const rotationPins = new Map();

function getEntryForDate(dateString) {
  const data = loadData();
  const dated = data.dated.find((entry) => entry.date === dateString);
  if (dated) return dated;

  if (rotationPins.has(dateString)) return rotationPins.get(dateString);

  const date = new Date(`${dateString}T00:00:00Z`);
  const rotation = data.rotation;
  const index = dayOfYear(date) % rotation.length;
  const entry = { date: dateString, ...rotation[index] };
  rotationPins.set(dateString, entry);
  return entry;
}

module.exports = { todayDateString, getEntryForDate };

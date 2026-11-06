const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'days.json');

function loadData() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

// Rolls over at midnight US Eastern (America/New_York), not the host's local
// timezone or UTC - most players are in US time zones, and rolling over at
// UTC midnight (7-8pm Eastern) made the puzzle look "stuck" to them since it
// had already changed hours before their own midnight.
const ROLLOVER_TIMEZONE = 'America/New_York';

function todayDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ROLLOVER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
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

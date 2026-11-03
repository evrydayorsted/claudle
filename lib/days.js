const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'days.json');

function loadData() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

function todayDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayOfYear(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getEntryForDate(dateString) {
  const data = loadData();
  const dated = data.dated.find((entry) => entry.date === dateString);
  if (dated) return dated;

  const date = new Date(`${dateString}T00:00:00`);
  const rotation = data.rotation;
  const index = dayOfYear(date) % rotation.length;
  return { date: dateString, ...rotation[index] };
}

module.exports = { todayDateString, getEntryForDate };

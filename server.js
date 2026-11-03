const http = require('http');
const fs = require('fs');
const path = require('path');
const { todayDateString, getEntryForDate } = require('./lib/days');
const { gradeGuess, splitIntoWords } = require('./lib/grading');
const stats = require('./lib/stats');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
};

function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(PUBLIC_DIR, path.normalize(filePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    // Keep-alive pings (e.g. cron-job.org) should hit this instead of
    // /api/today, which records a play on every request.
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/today') {
    const dateString = todayDateString();
    const entry = getEntryForDate(dateString);
    stats.recordPlay(dateString);
    stats.recordTotalRefresh();
    sendJson(res, 200, { date: dateString, aiOutput: entry.aiOutput });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/guess') {
    try {
      const body = await readJsonBody(req);
      const guess = typeof body.guess === 'string' ? body.guess.trim() : '';
      if (splitIntoWords(guess).length !== 5) {
        sendJson(res, 400, { error: 'Guess must be exactly 5 words' });
        return;
      }
      const dateString = todayDateString();
      const entry = getEntryForDate(dateString);
      const results = await gradeGuess(guess, entry.prompt);
      const won = results.every((r) => r.status === 'green');
      stats.recordTotalGuess();
      sendJson(res, 200, { results, won });
    } catch (err) {
      sendJson(res, 400, { error: 'Invalid request body' });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/hint') {
    try {
      const body = await readJsonBody(req);
      const revealed = Array.isArray(body.revealedPositions) ? body.revealedPositions : [];
      const green = Array.isArray(body.greenPositions) ? body.greenPositions : [];
      const validRevealed = [...new Set(revealed.filter((p) => Number.isInteger(p) && p >= 0 && p < 5))];
      const validGreen = [...new Set(green.filter((p) => Number.isInteger(p) && p >= 0 && p < 5))];

      if (validRevealed.length >= 3) {
        sendJson(res, 400, { error: 'No hints left' });
        return;
      }

      const dateString = todayDateString();
      const entry = getEntryForDate(dateString);
      const words = splitIntoWords(entry.prompt);
      const remainingPositions = [0, 1, 2, 3, 4].filter(
        (i) => !validRevealed.includes(i) && !validGreen.includes(i)
      );

      if (remainingPositions.length === 0) {
        sendJson(res, 400, { error: 'Nothing left to reveal' });
        return;
      }

      const position = remainingPositions[Math.floor(Math.random() * remainingPositions.length)];

      sendJson(res, 200, { position, word: words[position] });
    } catch (err) {
      sendJson(res, 400, { error: 'Invalid request body' });
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/api/reveal') {
    const dateString = todayDateString();
    const entry = getEntryForDate(dateString);
    sendJson(res, 200, { prompt: entry.prompt });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/finish') {
    try {
      const body = await readJsonBody(req);
      const dateString = todayDateString();
      const won = Boolean(body.won);
      stats.recordResult(dateString, won);
      if (won) stats.recordTotalWin();
      else stats.recordTotalLoss();
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 400, { error: 'Invalid request body' });
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/api/stats') {
    const byDate = stats.readStats();
    const totals = await stats.getTotalCounters();
    sendJson(res, 200, { ...byDate, ...totals });
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`Claudle running at http://localhost:${PORT}`);
});

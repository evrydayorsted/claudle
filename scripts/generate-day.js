// Drop-in script for once you have an ANTHROPIC_API_KEY.
//
// Usage:
//   ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-day.js "2026-11-05"
//
// Asks Claude to invent a short EXACTLY-5-WORD instruction, then asks Claude
// to actually follow that instruction, and appends both to data/days.json
// under "dated" for that date. No dependencies beyond Node's built-in fetch
// (Node 18+).

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'days.json');
const MODEL = 'claude-sonnet-5';
const MAX_PROMPT_ATTEMPTS = 5;

async function callClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Set ANTHROPIC_API_KEY before running this script.');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.content[0].text.trim();
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function generateFiveWordPrompt() {
  const instruction =
    'Invent one short instruction or question to send to an AI assistant, the ' +
    'kind of thing where the answer would be a sentence or two (a factual ' +
    'question, a "write a haiku about X", an "explain X simply", etc). The ' +
    'instruction itself MUST be EXACTLY 5 words, no more, no less. Reply with ' +
    'ONLY those 5 words, nothing else, no punctuation at the end.';

  for (let attempt = 0; attempt < MAX_PROMPT_ATTEMPTS; attempt += 1) {
    const candidate = await callClaude(instruction);
    if (wordCount(candidate) === 5) {
      return candidate;
    }
  }
  throw new Error('Could not get a 5-word prompt from Claude after several attempts.');
}

async function main() {
  const dateArg = process.argv[2];
  if (!dateArg || !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
    console.error('Usage: node scripts/generate-day.js YYYY-MM-DD');
    process.exit(1);
  }

  const puzzlePrompt = await generateFiveWordPrompt();
  const aiOutput = await callClaude(puzzlePrompt);

  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);
  data.dated = data.dated.filter((entry) => entry.date !== dateArg);
  data.dated.push({ date: dateArg, prompt: puzzlePrompt, aiOutput });

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  console.log(`Added puzzle for ${dateArg}:`);
  console.log(`  Prompt (answer): ${puzzlePrompt}`);
  console.log(`  AI output (clue): ${aiOutput}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

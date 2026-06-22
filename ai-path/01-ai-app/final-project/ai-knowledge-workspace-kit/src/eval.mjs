import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexFile = path.join(root, 'data', 'generated', 'index.json');
const evalFile = path.join(root, 'data', 'evals.json');

function tokenize(text) {
  return [...text.toLowerCase().matchAll(/\p{Script=Han}|[a-z0-9]+/gu)].map((match) => match[0]);
}

function scoreChunk(queryTokens, chunk) {
  const tokenSet = new Set(chunk.tokens);
  return queryTokens.reduce((score, token) => score + (tokenSet.has(token) ? 1 : 0), 0);
}

const index = JSON.parse(await fs.readFile(indexFile, 'utf8'));
const evals = JSON.parse(await fs.readFile(evalFile, 'utf8'));
let pass = 0;

for (const item of evals) {
  const queryTokens = tokenize(item.query);
  const best = index.chunks
    .map((chunk) => ({ ...chunk, score: scoreChunk(queryTokens, chunk) }))
    .sort((a, b) => b.score - a.score)[0];

  const refused = !best || best.score < 3;
  const ok = item.shouldRefuse ? refused : best?.source === item.expectedSource;
  if (ok) pass += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${item.id} ${refused ? 'refused' : best.source}`);
}

console.log(`\n${pass}/${evals.length} evals passed`);
if (pass !== evals.length) process.exit(1);

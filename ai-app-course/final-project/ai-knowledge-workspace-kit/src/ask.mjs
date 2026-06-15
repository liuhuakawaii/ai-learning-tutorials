import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexFile = path.join(root, 'data', 'generated', 'index.json');
const query = process.argv.slice(2).join(' ').trim();

function tokenize(text) {
  return [...text.toLowerCase().matchAll(/\p{Script=Han}|[a-z0-9]+/gu)].map((match) => match[0]);
}

function scoreChunk(queryTokens, chunk) {
  const tokenSet = new Set(chunk.tokens);
  return queryTokens.reduce((score, token) => score + (tokenSet.has(token) ? 1 : 0), 0);
}

function summarize(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[。.!?])\s+/u)
    .slice(0, 2)
    .join(' ');
}

if (!query) {
  console.error('Usage: npm run ask -- "你的问题"');
  process.exit(1);
}

let index;
try {
  index = JSON.parse(await fs.readFile(indexFile, 'utf8'));
} catch {
  console.error('Index not found. Run npm run ingest first.');
  process.exit(1);
}

const queryTokens = tokenize(query);
const matches = index.chunks
  .map((chunk) => ({ ...chunk, score: scoreChunk(queryTokens, chunk) }))
  .filter((chunk) => chunk.score >= 3)
  .sort((a, b) => b.score - a.score)
  .slice(0, 3);

if (matches.length === 0) {
  console.log('资料中没有足够信息回答这个问题。请补充资料或缩小问题范围。');
  process.exit(0);
}

console.log(`问题：${query}`);
console.log('');
console.log(`回答：${summarize(matches[0].text)}`);
console.log('');
console.log('引用：');
for (const match of matches) {
  console.log(`- ${match.source} / ${match.section}`);
}

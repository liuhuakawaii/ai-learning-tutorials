import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = path.join(root, 'data', 'docs');
const outputDir = path.join(root, 'data', 'generated');
const outputFile = path.join(outputDir, 'index.json');

function tokenize(text) {
  return [...text.toLowerCase().matchAll(/\p{Script=Han}|[a-z0-9]+/gu)].map((match) => match[0]);
}

function splitDocument(source, text) {
  const lines = text.split(/\r?\n/);
  const chunks = [];
  let section = 'intro';
  let buffer = [];

  function flush() {
    const content = buffer.join('\n').trim();
    if (!content) return;
    chunks.push({
      id: `${source}#${chunks.length + 1}`,
      source,
      section,
      text: content,
      tokens: tokenize(content)
    });
    buffer = [];
  }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush();
      section = line.replace(/^##\s+/, '').trim();
    } else if (line.trim()) {
      buffer.push(line);
      if (buffer.join('\n').length > 600) flush();
    }
  }

  flush();
  return chunks;
}

const files = (await fs.readdir(docsDir)).filter((file) => file.endsWith('.md'));
const chunks = [];

for (const file of files) {
  const text = await fs.readFile(path.join(docsDir, file), 'utf8');
  chunks.push(...splitDocument(file, text));
}

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(outputFile, JSON.stringify({ generatedAt: new Date().toISOString(), chunks }, null, 2));
console.log(`Indexed ${chunks.length} chunks to ${path.relative(root, outputFile)}`);

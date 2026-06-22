const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const fixturesDir = path.join(root, 'fixtures');
const outputDir = path.join(root, 'output');

function extractAll(pattern, text) {
  return [...text.matchAll(pattern)].map((match) => match.groups);
}

function cleanText(value) {
  return value.replace(/<[^>]+>/g, '').trim();
}

const booksById = new Map();

for (const file of fs.readdirSync(fixturesDir).filter((name) => name.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(fixturesDir, file), 'utf8');
  const matches = extractAll(/<article class="book" data-id="(?<id>[^"]+)">(?<body>[\s\S]*?)<\/article>/g, html);

  for (const match of matches) {
    const title = cleanText(match.body.match(/<h2>([\s\S]*?)<\/h2>/)?.[1] || '');
    const price = Number((match.body.match(/class="price">¥(\d+)/)?.[1] || '0'));
    const rating = Number((match.body.match(/class="rating">([\d.]+)/)?.[1] || '0'));
    const detailPath = match.body.match(/class="detail" href="([^"]+)"/)?.[1] || '';
    booksById.set(match.id, {
      id: match.id,
      title,
      price,
      rating,
      detailPath,
      sourceFile: file,
      crawledAt: new Date().toISOString()
    });
  }
}

const books = [...booksById.values()].sort((a, b) => a.id.localeCompare(b.id));
const csv = [
  'id,title,price,rating,detailPath,sourceFile,crawledAt',
  ...books.map((book) => [book.id, book.title, book.price, book.rating, book.detailPath, book.sourceFile, book.crawledAt].join(','))
].join('\n');

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'books.json'), JSON.stringify(books, null, 2));
fs.writeFileSync(path.join(outputDir, 'books.csv'), csv);

console.log(`Collected ${books.length} unique books`);

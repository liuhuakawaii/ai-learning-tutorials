const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const rawFile = path.join(root, 'data', 'raw', 'jobs.csv');
const outputDir = path.join(root, 'data', 'generated');
const batchId = new Date().toISOString().replace(/[:.]/g, '-');

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(',');
  return lines.map((line) => {
    const values = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
}

function normalize(row) {
  return {
    source_id: Number(row.id),
    title: row.title.trim(),
    company: row.company.trim(),
    city: row.city.trim(),
    salary_min: row.salary_min ? Number(row.salary_min) : null,
    salary_max: row.salary_max ? Number(row.salary_max) : null,
    salary_avg: row.salary_min && row.salary_max ? Math.round((Number(row.salary_min) + Number(row.salary_max)) / 2) : null,
    tags: row.tags.split('|').filter(Boolean),
    posted_at: row.posted_at,
    batch_id: batchId
  };
}

function validate(row) {
  const errors = [];
  if (!row.title) errors.push('title_required');
  if (!row.company) errors.push('company_required');
  if (!row.city) errors.push('city_required');
  if (!row.salary_min || !row.salary_max) errors.push('salary_required');
  if (row.salary_min && row.salary_max && row.salary_min > row.salary_max) errors.push('salary_range_invalid');
  return errors;
}

const rawRows = parseCsv(fs.readFileSync(rawFile, 'utf8'));
const seen = new Set();
const clean = [];
const rejected = [];

for (const raw of rawRows) {
  const row = normalize(raw);
  const dedupeKey = `${row.title}|${row.company}|${row.city}|${row.posted_at}`;
  const errors = validate(row);
  if (seen.has(dedupeKey)) errors.push('duplicate');
  if (errors.length > 0) {
    rejected.push({ ...row, errors });
    continue;
  }
  seen.add(dedupeKey);
  clean.push(row);
}

const byCity = Object.values(clean.reduce((acc, row) => {
  acc[row.city] ||= { city: row.city, count: 0, salary_avg: 0 };
  acc[row.city].count += 1;
  acc[row.city].salary_avg += row.salary_avg;
  return acc;
}, {})).map((item) => ({
  ...item,
  salary_avg: Math.round(item.salary_avg / item.count)
}));

const summary = {
  batch_id: batchId,
  raw_count: rawRows.length,
  clean_count: clean.length,
  rejected_count: rejected.length,
  cities: byCity.length,
  salary_avg: Math.round(clean.reduce((sum, row) => sum + row.salary_avg, 0) / clean.length)
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'clean-jobs.json'), JSON.stringify(clean, null, 2));
fs.writeFileSync(path.join(outputDir, 'rejected-jobs.json'), JSON.stringify(rejected, null, 2));
fs.writeFileSync(path.join(outputDir, 'metrics.json'), JSON.stringify({ summary, byCity }, null, 2));

console.log(`ETL batch ${batchId}: ${clean.length} clean, ${rejected.length} rejected`);

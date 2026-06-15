const fs = require('fs');
const http = require('http');
const path = require('path');

const root = __dirname;
const port = 4180;

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, 'data', 'generated', file), 'utf8'));
}

function sendJson(response, data) {
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data, null, 2));
}

function sendFile(response, filePath, contentType) {
  response.writeHead(200, { 'content-type': contentType });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`);

  try {
    if (url.pathname === '/') {
      sendFile(response, path.join(root, 'public', 'index.html'), 'text/html; charset=utf-8');
      return;
    }

    if (url.pathname === '/api/summary') {
      sendJson(response, readJson('metrics.json').summary);
      return;
    }

    if (url.pathname === '/api/jobs') {
      let jobs = readJson('clean-jobs.json');
      const city = url.searchParams.get('city');
      const keyword = url.searchParams.get('keyword');
      if (city) jobs = jobs.filter((job) => job.city === city);
      if (keyword) jobs = jobs.filter((job) => job.title.toLowerCase().includes(keyword.toLowerCase()));
      sendJson(response, jobs);
      return;
    }

    if (url.pathname === '/api/metrics/by-city') {
      sendJson(response, readJson('metrics.json').byCity);
      return;
    }

    if (url.pathname === '/api/quality') {
      sendJson(response, {
        rejected: readJson('rejected-jobs.json'),
        rules: ['title_required', 'company_required', 'city_required', 'salary_required', 'salary_range_invalid', 'duplicate']
      });
      return;
    }

    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(`Run npm run etl first.\n${error.message}`);
  }
});

server.listen(port, () => {
  console.log(`Market Insight demo available on http://localhost:${port}`);
});

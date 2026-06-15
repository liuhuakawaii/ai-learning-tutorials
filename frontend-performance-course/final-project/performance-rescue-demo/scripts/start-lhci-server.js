const fs = require('fs');
const http = require('http');
const path = require('path');

const port = 4173;
const root = path.resolve(__dirname, '..');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function isServerReady() {
  return new Promise((resolve) => {
    const request = http.get(`http://127.0.0.1:${port}/optimized.html`, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://127.0.0.1:${port}`).pathname);
  const normalizedPath = pathname === '/' ? '/slow.html' : pathname;
  const filePath = path.resolve(root, `.${normalizedPath}`);
  return filePath.startsWith(root) ? filePath : null;
}

async function serveFile(response, filePath) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': mimeTypes[path.extname(filePath)] || 'application/octet-stream'
  });
  fs.createReadStream(filePath).pipe(response);
}

(async () => {
  if (await isServerReady()) {
    console.log(`Available on http://localhost:${port}`);
    setInterval(() => {}, 60_000);
    return;
  }

  const server = http.createServer((request, response) => {
    serveFile(response, resolveRequestPath(request.url));
  });

  server.listen(port, () => {
    console.log(`Available on http://localhost:${port}`);
  });
})();

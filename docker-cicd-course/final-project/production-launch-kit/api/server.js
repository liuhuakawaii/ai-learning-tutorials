const http = require('http');

const port = Number(process.env.PORT || 4190);
const version = process.env.APP_VERSION || 'local';

const server = http.createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  if (request.url === '/version') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ version }));
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(port, () => {
  console.log(`Production Launch Kit API listening on ${port}`);
});

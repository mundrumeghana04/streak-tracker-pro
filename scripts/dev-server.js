// scripts/dev-server.js
// Standalone local development server for Streak Tracker Pro
// Serves static PWA assets and routes /.netlify/functions to local function handlers

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. Route Netlify Functions locally
  if (pathname.startsWith('/.netlify/functions/')) {
    const fnName = pathname.replace('/.netlify/functions/', '');
    const fnPath = path.join(ROOT_DIR, 'netlify', 'functions', `${fnName}.js`);

    if (fs.existsSync(fnPath)) {
      try {
        delete require.cache[require.resolve(fnPath)];
        const handler = require(fnPath).handler;

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          const event = {
            httpMethod: req.method,
            headers: req.headers,
            queryStringParameters: parsedUrl.query,
            body
          };

          try {
            const result = await handler(event, {});
            res.writeHead(result.statusCode || 200, result.headers || { 'Content-Type': 'application/json' });
            res.end(result.body || '');
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Function execution error: ' + err.message }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Function not found' }));
    }
  }

  // 2. Serve static files
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.join(ROOT_DIR, pathname);

  // Security check: prevent directory traversal
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const headers = { 'Content-Type': contentType };

    if (pathname === '/sw.js') {
      headers['Service-Worker-Allowed'] = '/';
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    } else if (pathname === '/manifest.json') {
      headers['Content-Type'] = 'application/manifest+json; charset=utf-8';
    }

    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('================================================================');
  console.log(`🔥 StreakUp v1.2 is LIVE locally!`);
  console.log(`👉 URL: http://localhost:${PORT}`);
  console.log(`Local Netlify Functions active at: http://localhost:${PORT}/.netlify/functions/*`);
  console.log('================================================================');
});

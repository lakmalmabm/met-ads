#!/usr/bin/env node
/* -----------------------------------------------------------------
   Minimal static server WITH HTTP Range support. No dependencies.

     node serve.js          ->  http://localhost:8080/showcase.html

   Why this exists instead of `python3 -m http.server`:
   Python's SimpleHTTPRequestHandler does not implement Range
   requests. Without Range, the browser reports video.seekable as
   [0, 0] and every scrub seek silently fails — the rails just sit on
   frame 0 forever. Opening the files over file:// has the same
   problem in some browsers. Use this, or any real static server.
   ----------------------------------------------------------------- */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webp': 'image/webp',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.svg':  'image/svg+xml',
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  /* Directory index: /miss_dior and /miss_dior/ both serve the showcase. */
  if (rel.endsWith('/') && rel !== '/') rel += 'index.html';
  else if (!path.extname(rel)) rel += '/index.html';

  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }

    const type  = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const m     = /bytes=(\d*)-(\d*)/.exec(range) || [];
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end   = m[2] ? parseInt(m[2], 10) : st.size - 1;

      if (start >= st.size || end >= st.size || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
        return res.end();
      }

      res.writeHead(206, {
        'Content-Type':   type,
        'Accept-Ranges':  'bytes',
        'Content-Range':  `bytes ${start}-${end}/${st.size}`,
        'Content-Length': end - start + 1,
      });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type':   type,
        'Accept-Ranges':  'bytes',
        'Content-Length': st.size,
      });
      fs.createReadStream(file).pipe(res);
    }
  });
}).listen(PORT, () => {
  console.log(`\n  Serving ${ROOT}`);
  console.log(`  http://localhost:${PORT}/`);
  console.log(`  http://localhost:${PORT}/miss_dior\n`);
});

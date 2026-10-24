import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.mp3':'audio/mpeg', '.txt': 'text/plain' };
const revalidate = new Set(['.html', '.js', '.mjs', '.css', '.json']);

export async function serveStatic(req, res, directory, source = false) {
  const root = path.resolve(directory);
  try {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const filename = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
    if (!filename.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const info = await stat(filename);
    if (!info.isFile()) throw new Error('Not a file');
    const content = await readFile(filename);
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const extension = path.extname(filename).toLowerCase();
    const headers = { 'Content-Type': types[extension] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': source ? 'no-store' : revalidate.has(extension) ? 'no-cache' : 'public, max-age=300' };
    if (range) {
      const start = Number(range[1]);
      const end = Math.min(range[2] ? Number(range[2]) : content.length - 1, content.length - 1);
      if (start > end || start >= content.length) { res.writeHead(416, { 'Content-Range': `bytes */${content.length}` }); res.end(); return; }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${content.length}`, 'Content-Length': end - start + 1 });
      res.end(content.subarray(start, end + 1));
    } else {
      res.writeHead(200, { ...headers, 'Content-Length': content.length });
      res.end(content);
    }
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); }
}

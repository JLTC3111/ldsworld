import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { serveStatic } from './static-handler.mjs';
const source = process.argv.includes('--source');
const root = fileURLToPath(new URL(source ? '../src/' : '../dist/', import.meta.url));
let port = Number(process.env.PORT || 4173);
let attempts = 0;
const server = createServer((req, res) => serveStatic(req, res, root, source));
server.on('error', error => {
  if (error.code === 'EADDRINUSE' && attempts++ < 10) { port++; server.listen(port, '127.0.0.1'); }
  else { console.error(`Could not start preview: ${error.message}`); process.exitCode = 1; }
});
server.on('listening', () => console.log(`Project Island is ready: http://127.0.0.1:${port}`));
server.listen(port, '127.0.0.1');
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));

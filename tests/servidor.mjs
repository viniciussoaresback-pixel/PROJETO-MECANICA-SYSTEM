// Servidor estático simples para os testes (serve a pasta app/).
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../app/', import.meta.url));
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};
const porta = Number(process.env.PORTA || 4173);
createServer((req, res) => {
  let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (caminho.endsWith('/')) caminho += 'index.html';
  const arquivo = normalize(join(RAIZ, caminho));
  if (!arquivo.startsWith(RAIZ) || !existsSync(arquivo) || statSync(arquivo).isDirectory()) {
    res.writeHead(404);
    res.end('não encontrado');
    return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(arquivo).pipe(res);
}).listen(porta, '127.0.0.1', () => console.log(`Servindo app/ em http://127.0.0.1:${porta}`));

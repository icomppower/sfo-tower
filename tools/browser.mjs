// Headless Chrome helper (puppeteer-core + the installed Google Chrome) and a tiny static server for gates.
import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
export function serve(port = 0) {
  return new Promise((resolve) => {
    const srv = createServer(async (req, res) => {
      try {
        let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
        const file = normalize(join(ROOT, p)); if (!file.startsWith(ROOT)) throw new Error('outside');
        const st = await stat(file); const body = await readFile(st.isDirectory() ? join(file, 'index.html') : file);
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body);
      } catch { res.writeHead(404); res.end('nope'); }
    });
    srv.listen(port, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) }));
  });
}
export async function launch(opts = {}) {
  return puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--disable-gpu-vsync', '--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', ...(opts.args ?? [])], defaultViewport: opts.viewport ?? { width: 1280, height: 720 } });
}

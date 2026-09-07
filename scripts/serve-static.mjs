import {createReadStream, existsSync, readFileSync, statSync} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const root = process.cwd();
const outDir = path.resolve(root, 'out');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8'
};

function defaultLocale() {
  try {
    const languages = JSON.parse(readFileSync(path.join(root, '站点数据采集目录', 'languages.json'), 'utf8'));
    return languages.default ?? 'en';
  } catch {
    return 'en';
  }
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function existingFile(candidate) {
  const resolved = path.resolve(candidate);
  if (!isInside(outDir, resolved) || !existsSync(resolved)) return null;
  return statSync(resolved).isFile() ? resolved : null;
}

export function resolveStaticFile(urlPath) {
  const decoded = decodeURIComponent(String(urlPath ?? '/').split('?')[0] || '/');
  const normalized = path.posix.normalize(decoded.startsWith('/') ? decoded : `/${decoded}`);
  if (normalized.includes('\0')) return null;
  const relative = normalized === '/' ? '' : normalized.replace(/^\/+/g, '').replace(/\/+$/g, '');
  const candidates = relative
    ? [
      path.join(outDir, relative),
      path.join(outDir, relative, 'index.html'),
      path.join(outDir, `${relative}.html`)
    ]
    : [path.join(outDir, 'index.html')];
  for (const candidate of candidates) {
    const file = existingFile(candidate);
    if (file) return file;
  }
  return null;
}

function cacheControl(filePath) {
  const relative = path.relative(outDir, filePath).replaceAll('\\', '/');
  if (relative.startsWith('_next/static/')) return 'public, max-age=31536000, immutable';
  return 'no-cache';
}

function sendFile(response, status, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(status, {
    'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
    'Cache-Control': cacheControl(filePath)
  });
  createReadStream(filePath).pipe(response);
}

function loadRedirects() {
  const file = path.join(outDir, '_redirects');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return [];
    const [from, to, status] = trimmed.split(/\s+/);
    if (!from || !to) return [];
    return [{from, to, status: Number(status) || 302}];
  });
}

export function createStaticServer() {
  const locale = defaultLocale();
  const redirects = loadRedirects();
  return http.createServer((request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
    const redirect = redirects.find((rule) => rule.from === url.pathname)
      || (url.pathname === '/' ? {to: `/${locale}`, status: 302} : null);
    if (redirect) {
      response.writeHead(redirect.status, {Location: redirect.to, 'Cache-Control': 'no-store'});
      response.end();
      return;
    }

    const filePath = resolveStaticFile(url.pathname);
    if (filePath) {
      sendFile(response, 200, filePath);
      return;
    }

    const notFound = existingFile(path.join(outDir, '404.html'));
    if (notFound) {
      sendFile(response, 404, notFound);
      return;
    }
    response.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
    response.end('Not Found');
  });
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  if (!existsSync(outDir)) {
    console.error('Missing out/. Run pnpm build first.');
    process.exit(1);
  }
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const server = createStaticServer();
  server.listen(port, host, () => {
    console.log(`Static wiki server listening on http://${host}:${port}`);
  });
}

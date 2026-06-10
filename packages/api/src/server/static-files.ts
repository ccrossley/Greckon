import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import type { ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export function webDistDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '../../../web/dist');
}

function contentType(path: string): string {
  const ext = path.slice(path.lastIndexOf('.'));
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

function resolveWebPath(root: string, pathname: string): string | null {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const filePath = normalize(join(root, relative));
  const normalizedRoot = normalize(root);
  if (!filePath.startsWith(normalizedRoot)) {
    return null;
  }
  return filePath;
}

export function tryServeWebApp(
  res: ServerResponse,
  pathname: string,
  root = webDistDir(),
): boolean {
  if (!existsSync(root)) {
    return false;
  }

  let filePath = resolveWebPath(root, pathname);
  if (!filePath || !existsSync(filePath)) {
    filePath = join(root, 'index.html');
    if (!existsSync(filePath)) {
      return false;
    }
  } else if (statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
    if (!existsSync(filePath)) {
      return false;
    }
  }

  res.writeHead(200, { 'Content-Type': contentType(filePath) });
  createReadStream(filePath).pipe(res);
  return true;
}

export function webAppAvailable(root = webDistDir()): boolean {
  return existsSync(join(root, 'index.html'));
}

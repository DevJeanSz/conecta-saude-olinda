import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const distDir = join(root, 'dist');
const serverDir = join(distDir, 'server');
const distOpenAiDir = join(distDir, '.openai');
const hostingConfig = join(root, '.openai', 'hosting.json');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const toRoutePath = (filePath) =>
  `/${relative(distDir, filePath).split(sep).join('/')}`;

const collectFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'server' || entry.name === '.openai') continue;

    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
};

const createWorker = async () => {
  const files = await collectFiles(distDir);
  const assets = {};

  for (const filePath of files) {
    const body = await readFile(filePath);
    const routePath = toRoutePath(filePath);
    assets[routePath] = {
      body: gzipSync(body).toString('base64'),
      contentType: contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
    };
  }

  return `const API_PREFIX = '/api/';
const STATIC_FILE_PATTERN = /\\.[a-z0-9]{2,12}$/i;
const ASSETS = ${JSON.stringify(assets)};

const apiResponse = (message, status = 503) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

const fromBase64 = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

const normalizeBackendOrigin = (env) => {
  const rawOrigin = env.API_ORIGIN || env.VITE_API_URL || env.BACKEND_URL || '';
  const cleaned = String(rawOrigin).trim().replace(/\\/+$/, '');

  if (!cleaned) return '';
  const withProtocol = /^https?:\\/\\//i.test(cleaned) ? cleaned : \`https://\${cleaned}\`;
  return withProtocol.endsWith('/api') ? withProtocol.slice(0, -4) : withProtocol;
};

const resolveAssetPath = (pathname) => {
  if (pathname === '/') return '/index.html';
  if (ASSETS[pathname]) return pathname;
  if (!STATIC_FILE_PATTERN.test(pathname)) return '/index.html';
  return pathname;
};

const serveAsset = (path, method) => {
  const asset = ASSETS[path];
  if (!asset) return new Response('Not found', { status: 404 });

  const headers = new Headers({
    'content-type': asset.contentType,
    'content-encoding': 'gzip',
    'x-content-type-options': 'nosniff',
    'cache-control': path.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  });

  return new Response(method === 'HEAD' ? null : fromBase64(asset.body), { headers });
};

const proxyApiRequest = async (request, env) => {
  const backendOrigin = normalizeBackendOrigin(env);

  if (!backendOrigin) {
    return apiResponse('API backend is not configured for this deployment.');
  }

  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(\`\${sourceUrl.pathname}\${sourceUrl.search}\`, \`\${backendOrigin}/\`);
  return fetch(new Request(targetUrl, request));
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith(API_PREFIX)) {
      return proxyApiRequest(request, env);
    }

    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method not allowed', { status: 405 });
    }

    return serveAsset(resolveAssetPath(url.pathname), request.method);
  },
};
`;
};

await stat(join(distDir, 'index.html'));
await stat(hostingConfig);

await mkdir(serverDir, { recursive: true });
await mkdir(distOpenAiDir, { recursive: true });
await writeFile(join(serverDir, 'index.js'), await createWorker());
await writeFile(join(distOpenAiDir, 'hosting.json'), await readFile(hostingConfig));

console.log('OK: self-contained Sites artifact prepared in dist/server/index.js.');

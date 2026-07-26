const INDEX_PATH = '/index.html';
const API_PREFIX = '/api/';
const STATIC_FILE_PATTERN = /\.[a-z0-9]{2,12}$/i;

const apiResponse = (message, status = 503) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

const normalizeBackendOrigin = (env) => {
  const rawOrigin = env.API_ORIGIN || env.VITE_API_URL || env.BACKEND_URL || '';
  const cleaned = String(rawOrigin).trim().replace(/\/+$/, '');

  if (!cleaned) return '';
  const withProtocol = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  return withProtocol.endsWith('/api') ? withProtocol.slice(0, -4) : withProtocol;
};

const addStaticHeaders = (response) => {
  const headers = new Headers(response.headers);

  headers.set('x-content-type-options', 'nosniff');
  if (!headers.has('cache-control')) {
    headers.set('cache-control', response.url.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const fetchStaticAsset = (env, request, path) => {
  const target = new URL(path, request.url);
  return env.ASSETS.fetch(new Request(target, request));
};

const proxyApiRequest = async (request, env) => {
  const backendOrigin = normalizeBackendOrigin(env);

  if (!backendOrigin) {
    return apiResponse('API backend is not configured for this deployment.');
  }

  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${sourceUrl.pathname}${sourceUrl.search}`, `${backendOrigin}/`);
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

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404 || STATIC_FILE_PATTERN.test(url.pathname)) {
      return addStaticHeaders(assetResponse);
    }

    const indexResponse = await fetchStaticAsset(env, request, INDEX_PATH);
    return addStaticHeaders(indexResponse);
  },
};

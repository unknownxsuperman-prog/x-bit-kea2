/**
 * kea-proxy — Cloudflare Worker
 *
 * Purpose: Proton (browser, static GitHub Pages origin) cannot fetch
 * cetonline.karnataka.gov.in directly — that server doesn't send permissive
 * CORS headers, so the browser blocks reading the response even though the
 * request itself often succeeds. This Worker sits in between: the browser
 * calls THIS server (which we control, so we can set CORS headers freely),
 * this Worker fetches KEA server-to-server (no CORS restriction applies to
 * server-to-server requests at all — CORS is purely a browser mechanism),
 * and returns the bytes back to the browser with permissive headers.
 *
 * Locked to a single allowed host so this can't be abused as an open proxy
 * for arbitrary URLs.
 *
 * Deploy:
 *   npm install -g wrangler
 *   wrangler login
 *   wrangler deploy kea-proxy.js
 * (or paste this directly into the Cloudflare dashboard's Worker editor —
 * Workers & Pages → Create → "Hello World" template → replace the code)
 *
 * After deploying you'll get a URL like:
 *   https://kea-proxy.<your-subdomain>.workers.dev
 * That's the KEA_PROXY_URL to paste into index.html.
 */

const ALLOWED_HOST = 'cetonline.karnataka.gov.in';

// Restrict which origins are allowed to call this proxy. Set to your actual
// GitHub Pages origin once deployed (e.g. 'https://unknownxsuperman-prog.github.io')
// or leave as '*' while testing, then lock it down.
const ALLOWED_ORIGIN = '*';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400'
  };
}

export default {
  async fetch(request) {
    const headers = corsHeaders();

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers });
    }

    const { searchParams } = new URL(request.url);
    const target = searchParams.get('url');
    if (!target) {
      return new Response('Missing "url" query param', { status: 400, headers });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch (e) {
      return new Response('Invalid url', { status: 400, headers });
    }

    if (targetUrl.hostname !== ALLOWED_HOST) {
      return new Response(`Host not allowed. Only ${ALLOWED_HOST} is permitted.`, { status: 403, headers });
    }
    if (targetUrl.protocol !== 'https:') {
      return new Response('Only https:// targets are allowed', { status: 400, headers });
    }

    let upstream;
    try {
      upstream = await fetch(targetUrl.toString(), {
        method: request.method,
        // Some gov sites reject requests with no User-Agent / Accept header
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; x-bit-Proton/1.0; +kea-proxy)',
          'Accept': '*/*'
        }
      });
    } catch (e) {
      return new Response('Upstream fetch failed: ' + e.message, { status: 502, headers });
    }

    const outHeaders = new Headers(headers);
    outHeaders.set('Content-Type', upstream.headers.get('Content-Type') || 'application/octet-stream');
    const contentLength = upstream.headers.get('Content-Length');
    if (contentLength) outHeaders.set('Content-Length', contentLength);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: outHeaders
    });
  }
};

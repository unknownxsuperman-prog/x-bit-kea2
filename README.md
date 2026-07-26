# kea-proxy

A locked-down CORS proxy (Cloudflare Worker) so Proton (browser, GitHub Pages
origin) can fetch `cetonline.karnataka.gov.in` PDFs without hitting CORS.

## Why this is needed

KEA's server doesn't send permissive CORS headers, so a browser `fetch()`
straight from `index.html` to `cetonline.karnataka.gov.in` gets blocked by
the browser itself, even when the request would otherwise succeed. This
Worker sits in between: Proton calls the Worker (which we control, so we can
set CORS headers freely), the Worker fetches KEA server-to-server (no CORS
restriction applies there at all), and hands the bytes back to the browser.

## Deploy (takes ~2 minutes)

**Option A — CLI:**
```bash
npm install -g wrangler
wrangler login
cd kea-proxy
wrangler deploy
```

**Option B — dashboard (no CLI needed):**
1. Go to the Cloudflare dashboard → Workers & Pages → Create → "Hello World" template
2. Replace the generated code with the contents of `kea-proxy.js`
3. Deploy

Either way you'll get a URL like:
```
https://kea-proxy.<your-subdomain>.workers.dev
```

## After deploying

1. Paste that URL into `index.html` as `KEA_PROXY_URL` (see the KEA 2.0 pipeline section)
2. Once you're done testing, tighten `ALLOWED_ORIGIN` in `kea-proxy.js` from `'*'`
   to your actual GitHub Pages origin (e.g. `https://unknownxsuperman-prog.github.io`)
   and redeploy — right now it accepts requests from any origin, which is fine
   for testing but should be locked down before this is "done".

## Usage from Proton

```js
const KEA_PROXY_URL = 'https://kea-proxy.<your-subdomain>.workers.dev';
function viaProxy(keaUrl) {
  return `${KEA_PROXY_URL}/?url=${encodeURIComponent(keaUrl)}`;
}
// then just: fetch(viaProxy(realKeaPdfUrl))  — works like a normal same-origin fetch
```

The Worker only allows proxying `cetonline.karnataka.gov.in` URLs — anything
else gets a 403, so this can't be abused as an open proxy.

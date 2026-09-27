// Service worker (F10): lets a problem QR code (`#/p/<code>`) or a sheet QR code
// (`#/s/<code>`) open with no network, after one prior visit — SPEC §6.0/§9 "works offline
// after the first visit".
//
// What's cached, and when:
//   - The site shell (HTML/CSS/JS) and `engine.wasm` + its JS glue: precached on install.
//     These are small (SPEC §6.0's < 1 MB target) and needed by every page, including a
//     bare problem/sheet lookup, so there's no reason to wait for a visitor to ask.
//   - `typeset.wasm` + its glue (~12 MB gzip, SPEC §6.0.1): deliberately NOT precached —
//     most visits never generate a PDF. It's cached the first time it's actually fetched
//     (i.e. the first "Print"/"Download PDF"), after which PDF generation also works
//     offline.
//
// Versioning: every cache name carries `BUILD_ID` (from `pkg/build-id.js`, written by
// `scripts/build-web.sh` from a hash of the built engine + shell files). `install`
// populates a brand-new cache under the new id and only replaces the registration once
// that finishes completely (`cache.addAll` is all-or-nothing) — so a visitor is never
// served an `engine.wasm` from one build next to JS glue from another; a failed or partial
// install just leaves the previous, fully self-consistent version in place, active, until
// a later install succeeds. `activate` deletes every cache that isn't the current build,
// including old `typeset.wasm` caches, so nobody is stuck on an old version forever.
importScripts('./pkg/build-id.js');

const BUILD_ID = self.IP_BUILD_ID || 'dev';
const SHELL_CACHE = `ip-shell-${BUILD_ID}`;
const TYPESET_CACHE = `ip-typeset-${BUILD_ID}`;
const CURRENT_CACHES = new Set([SHELL_CACHE, TYPESET_CACHE]);

// Paths relative to this file (web/sw.js), so this works unmodified when the site is
// served from a subpath (SPEC's QR base is `location.origin + location.pathname`, and a
// service worker's own scope is likewise relative to where it's served from).
const SHELL_URLS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'util.js',
  'engine.js',
  'pages/home.js',
  'pages/curriculum.js',
  'pages/lesson.js',
  'pages/skill.js',
  'pages/skillControls.js',
  'pages/sheet.js',
  'pages/sheetShared.js',
  'pages/sheetView.js',
  'pages/problem.js',
  'pkg/build-id.js',
  'pkg/ip_web_engine.js',
  'pkg/ip_web_engine_bg.wasm',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // All-or-nothing: if any one file 404s, this install fails and the previous SW (if
      // any) stays in control, rather than activating a half-cached, inconsistent version.
      await cache.addAll(SHELL_URLS);
      // Take over immediately rather than waiting for every tab to close — the strategies
      // below always try the network too (or, for the shell, serve-then-revalidate), so an
      // already-open tab doesn't get stuck on stale content either.
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('ip-') && !CURRENT_CACHES.has(k)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isTypesetAsset(pathname) {
  return /\/pkg\/ip_web_typeset(_bg)?\.(js|wasm)$/.test(pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (isTypesetAsset(url.pathname)) {
    // Cache-first: once fetched, always served from cache until the next build changes
    // this cache's name. A visitor who has never printed never pays for this download.
    event.respondWith(cacheFirst(TYPESET_CACHE, req));
    return;
  }

  // Everything else same-origin (the app shell, engine.wasm/glue, the catalog data baked
  // into engine.wasm itself): stale-while-revalidate. A cached copy answers immediately —
  // which is what makes offline reloads of `#/p/<code>` and `#/s/<code>` work at all — while
  // a live connection quietly refreshes the cache in the background for next time. That
  // also keeps local development from being painful: a reload always eventually shows a
  // rebuilt file, it just may take one extra reload after a change (or use `?nosw`, which
  // app.js honors by never registering this file at all).
  event.respondWith(staleWhileRevalidate(SHELL_CACHE, req));
});

async function cacheFirst(cacheName, req) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(cacheName, req) {
  const cache = await caches.open(cacheName);
  // `ignoreSearch`: a cache-busting `?...` query (used by our own tests, or a browser's
  // reload) shouldn't miss the cached shell entry keyed on the bare path.
  const cached = await cache.match(req, { ignoreSearch: true });
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);
  if (cached) {
    // Don't block the response on the revalidation, but don't let it become an unhandled
    // rejection either.
    network.catch(() => {});
    return cached;
  }
  const fresh = await network;
  return fresh || Response.error();
}

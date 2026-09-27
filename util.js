// Small shared helpers: routing, storage, and query-string plumbing.

/** `location.origin + location.pathname`, per SPEC: what QR codes are built from. */
export function baseUrl() {
  return location.origin + location.pathname;
}

export function isLocalHost() {
  return ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
}

/** Parse `#/path?query` into `{ path: ['a','b'], query: {k:v} }`. */
export function parseHash() {
  const hash = location.hash.replace(/^#/, '');
  const [pathPart, queryPart] = hash.split('?');
  const path = pathPart.split('/').filter((s) => s.length > 0);
  const query = {};
  if (queryPart) {
    for (const pair of queryPart.split('&')) {
      if (!pair) continue;
      const [k, v] = pair.split('=');
      query[decodeURIComponent(k)] = v === undefined ? '' : decodeURIComponent(v.replace(/\+/g, ' '));
    }
  }
  return { path, query };
}

export function buildQuery(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

// app.js registers a hook here so a programmatic `navigate()` can capture the outgoing
// page's scroll position before the hash actually changes (see app.js's navigation
// notes) — util.js doesn't otherwise need to know about scroll bookkeeping.
let beforeNavigateHook = null;
export function setBeforeNavigateHook(fn) {
  beforeNavigateHook = fn;
}

/**
 * Change the page. By default this pushes a new history entry (like clicking a link),
 * which is right for going to a genuinely different page (a new lesson, a new sheet).
 * Pass `{ replace: true }` when the new URL supersedes the current one rather than
 * following it — e.g. redirecting `#/` to a remembered curriculum, or adjusting the
 * current sheet's own query string — so Back doesn't have to step through both.
 *
 * `location.hash = ...` always pushes, so a replace goes through `history.replaceState`
 * instead; that doesn't fire `hashchange`, so we dispatch one ourselves to drive the router.
 */
export function navigate(hash, { replace = false } = {}) {
  const full = hash.startsWith('#') ? hash : `#${hash}`;
  if (beforeNavigateHook) beforeNavigateHook(full);
  if (replace) {
    const url = location.pathname + location.search + full;
    history.replaceState(history.state, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = full;
  }
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== false && v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

// ---------- localStorage (best-effort; never throws) ----------

const PREFIX = 'ip-poc:';

export function loadPref(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function savePref(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore (private browsing, quota, disabled storage, ...)
  }
}

export function randomSeed() {
  return Math.floor(Math.random() * 0xfffffff);
}

export const ANSWER_EXPLAINERS = {
  none: 'No answers on paper — a real quiz. Look up answers later by code or QR.',
  pool: 'All answers shuffled at the bottom, no numbers — check yourself without copying.',
  key: 'A numbered answer key on its own page, with a QR code per answer.',
  worked: 'Step-by-step solutions on their own pages, ending in the boxed answer.',
  'worked-full':
    'Step-by-step solutions with the arithmetic worked out (reducing fractions, distributing, and so on), ending in the boxed answer.',
};

// F15: the on-screen Brief/Full toggle for worked solutions (SPEC §7.3/§7.4, decision D5).
// Brief (board steps only) is the default everywhere it's remembered.
export const DETAIL_PREF_KEY = 'stepDetail';

export function loadDetailPref() {
  const v = loadPref(DETAIL_PREF_KEY, 'brief');
  return v === 'full' ? 'full' : 'brief';
}

export function saveDetailPref(detail) {
  savePref(DETAIL_PREF_KEY, detail === 'full' ? 'full' : 'brief');
}

import { el, parseHash, navigate, loadPref, setBeforeNavigateHook } from './util.js';
import { callEngine, errorText } from './engine.js';
import { renderHome } from './pages/home.js';
import { renderCurriculum } from './pages/curriculum.js';
import { renderLesson } from './pages/lesson.js';
import { renderSkill } from './pages/skill.js';
import { renderSheet } from './pages/sheet.js';
import { renderSheetView } from './pages/sheetView.js';
import { renderProblem } from './pages/problem.js';

const app = document.getElementById('app');
const footer = document.getElementById('footer');

let catalogPromise = null;
function getCatalog() {
  if (!catalogPromise) catalogPromise = callEngine('catalog');
  return catalogPromise;
}

async function renderFooter() {
  footer.innerHTML = '';
  try {
    const catalog = await getCatalog();
    for (const c of catalog.curricula) {
      if (c.notice) footer.appendChild(el('div', { text: c.notice }));
    }
  } catch {
    // footer notices are best-effort
  }
  footer.appendChild(el('div', { text: 'Early version. Problem and sheet codes are permanent: a printed code always brings back the same questions.' }));
}

// ---------- navigation plumbing (F19) ----------
//
// Two problems this fixes:
// 1. `route()` does async work (at least `getCatalog()`; some pages do their own async
//    loading past that point). If the user navigates again before that work finishes, the
//    stale response must not overwrite whatever the newer navigation already drew. Every
//    route gets an AbortSignal; page renderers that do their own async work after
//    returning (sheet/sheetView/problem) take it too and check `signal.aborted` before
//    touching the DOM.
// 2. Scroll position isn't restored on Back/Forward. We keep our own per-hash scroll map
//    (native scroll restoration can't work here: content is rebuilt from scratch, often
//    asynchronously, so the browser has nothing to measure against yet when it would
//    normally restore). `history.scrollRestoration = 'manual'` turns off the browser's own
//    attempt so it doesn't fight ours.

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const scrollPositions = new Map();
let currentHashKey = location.hash;
let currentController = null;

// Telling a Back/Forward hash change apart from a plain `<a href="#...">` click or
// `location.hash = ...` turns out not to be as simple as "did `popstate` fire": in current
// Chromium, `popstate` fires for *every* same-document hash navigation, not only for
// history traversal (this cost real debugging time — see PLAN.md's F19 notes). What does
// distinguish them is `event.state`: an entry we've actually rendered gets tagged with
// `history.replaceState({tag}, ...)` once its page is up, so traversing back to it carries
// that state; a brand-new entry (from a click or a script hash change) never has it.
let pendingState;
window.addEventListener('popstate', (e) => {
  pendingState = e.state;
});

window.addEventListener('hashchange', () => {
  const isPop = pendingState != null;
  pendingState = undefined;
  route(isPop);
});

// Keep each page's scroll position up to date continuously while the visitor is on it, so
// Back/Forward has something to restore even without an explicit capture point.
window.addEventListener(
  'scroll',
  () => {
    scrollPositions.set(currentHashKey, window.scrollY);
  },
  { passive: true }
);

// Clicking an `<a href="#...">` turns out not to leave time for that: for a fragment with
// no matching element id, the browser scrolls to the top *synchronously, before the click's
// default action even finishes* — well before `hashchange` fires. By the time route() (or
// even the 'scroll' listener above) next runs, the outgoing page's real scroll position is
// already gone, overwritten with 0. Capturing scroll and re-pointing `currentHashKey` here,
// in the click's capture phase, wins that race: the browser's own reset-to-0 `scroll` event
// still fires, but by then it lands under the *new* key, which is correct anyway (a fresh
// page starts at the top).
document.addEventListener(
  'click',
  (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    scrollPositions.set(currentHashKey, window.scrollY);
    currentHashKey = a.getAttribute('href');
  },
  true
);

// `navigate()` (in util.js — "New sheet", "Make sheet", the problem-code box, "More like
// this", switching curriculum) changes the hash the same way a click does, so it needs the
// same pre-navigation capture. util.js has no reason to know about scroll bookkeeping, so
// it calls this hook instead.
setBeforeNavigateHook((newHash) => {
  scrollPositions.set(currentHashKey, window.scrollY);
  currentHashKey = newHash.startsWith('#') ? newHash : `#${newHash}`;
});

async function route(isPop = false) {
  if (currentController) currentController.abort();
  const controller = new AbortController();
  currentController = controller;
  const { signal } = controller;

  const { path, query } = parseHash();
  currentHashKey = location.hash;
  app.innerHTML = '';
  const loading = el('p', { class: 'muted', text: 'Loading…' });
  app.appendChild(loading);

  try {
    let view;
    if (path.length === 0) {
      view = renderHomeOrRedirect(await getCatalog());
    } else if (path[0] === 'c' && path.length >= 2) {
      view = renderCurriculum(await getCatalog(), path[1]);
    } else if (path[0] === 'lesson' && path.length >= 3) {
      view = renderLesson(await getCatalog(), path[1], path[2]);
    } else if (path[0] === 'skill' && path.length >= 2) {
      view = renderSkill(await getCatalog(), decodeURIComponent(path[1]));
    } else if (path[0] === 'sheet') {
      // `#/sheet/<sheet code>`, or `#/sheet?<choices>` from a lesson/skill page.
      view = renderSheet(path[1] ? decodeURIComponent(path[1]) : null, query, signal);
    } else if (path[0] === 's' && path.length >= 2) {
      view = renderSheetView(decodeURIComponent(path[1]), signal);
    } else if (path[0] === 'p' && path.length >= 2) {
      view = renderProblem(decodeURIComponent(path[1]), signal);
    } else {
      view = el('div', { class: 'error-box', text: `Unknown page "#/${path.join('/')}".` });
    }
    if (signal.aborted || !view) return;
    app.innerHTML = '';
    app.appendChild(view);
    // Tag this entry so that if the visitor later comes *back* to it, `popstate`'s
    // `event.state` tells us this was a real traversal (see the listener above).
    history.replaceState({ ip: true }, '', location.href);
    restoreOrTopScroll(isPop);
  } catch (e) {
    if (signal.aborted) return;
    app.innerHTML = '';
    app.appendChild(el('div', { class: 'error-box', text: `Something went wrong: ${errorText(e)}` }));
  }
}

function restoreOrTopScroll(isPop) {
  const y = isPop ? scrollPositions.get(currentHashKey) : undefined;
  window.scrollTo(0, y || 0);
  if (isPop && y) {
    // Some pages (sheet) keep growing as async work finishes; try once more next frame.
    requestAnimationFrame(() => window.scrollTo(0, y));
  }
}

// Returning visitor with a saved curriculum: send them straight there (F20), via a
// *replaced* URL so Back from the curriculum page goes to wherever they came from, not
// back into a redirect loop through `#/`.
function renderHomeOrRedirect(catalog) {
  const last = loadPref('lastCurriculum', null);
  if (last && catalog.curricula.some((c) => c.id === last)) {
    navigate(`#/c/${last}`, { replace: true });
    return null;
  }
  return renderHome(catalog);
}

// A module script runs after the DOM is parsed (deferred, like `defer`), so the DOM is
// always ready by the time this executes — no need to wait for DOMContentLoaded.
route();
renderFooter();
registerServiceWorker();

// F10: offline support. Registered relative to this page (not an absolute path), so its
// default scope is whatever directory the site is served from — including a subpath,
// which is also how QR codes build their URL (`baseUrl()` in util.js). Skipped entirely
// with `?nosw` anywhere in the URL, so local development never has to fight a cached
// previous version while iterating; this session's `#/sheet?...` and cache-busting `?_=`
// query strings used by web/tests are unaffected since they don't add `nosw`.
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (new URLSearchParams(location.search).has('nosw')) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Offline support degrades silently — the site still works fine online without it.
    });
  });
}

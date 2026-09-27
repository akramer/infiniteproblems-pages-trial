import { el, baseUrl, isLocalHost, randomSeed, navigate, loadDetailPref } from '../util.js';
import { callEngine, compilePdf, errorText } from '../engine.js';
import { requestFromQuery, compactProblem, poolBox } from './sheetShared.js';

/** `#/sheet/<code>` shows the sheet a sheet code names. `#/sheet?<choices>` (from a lesson or
 * skill page) first turns the choices into a sheet code and replaces the URL with it. */
export function renderSheet(code, query, signal) {
  const root = el('div');

  if (isLocalHost()) {
    root.appendChild(
      el('div', {
        class: 'banner-warn',
        text:
          'You’re on localhost: QR codes on the PDF will point here, which a phone can’t open. ' +
          'Run scripts/serve.sh and open the network address it prints instead.',
      })
    );
  }

  const onScreen = el('div', { class: 'muted', text: 'Building your sheet…' });
  const pdfSection = el('div');
  root.appendChild(el('h1', { text: 'Your sheet' }));
  // Paper first: the printable PDF leads, the on-screen copy follows.
  root.appendChild(pdfSection);
  root.appendChild(el('h2', { text: 'On screen' }));
  root.appendChild(onScreen);

  resolveCode(code, query, signal)
    .then((sheetCode) => {
      if (signal.aborted) return;
      loadOnScreen(onScreen, sheetCode, signal);
      loadPdf(pdfSection, sheetCode, signal);
    })
    .catch((e) => {
      if (signal.aborted) return;
      onScreen.remove();
      pdfSection.appendChild(el('div', { class: 'error-box', text: `Couldn’t make that sheet: ${errorText(e)}` }));
    });

  return root;
}

async function resolveCode(code, query, signal) {
  if (code) return code;
  const res = await callEngine('sheet_code', JSON.stringify(requestFromQuery(query)));
  if (signal.aborted) return null;
  if (!res.ok) throw new Error(res.error);
  // Replace (not push) so Back skips the choices URL, and cooperate with the app's
  // scroll/state tagging instead of poking history directly (F19).
  navigate(`#/sheet/${res.code_raw}`, { replace: true });
  return res.code_raw;
}

async function loadOnScreen(container, code, signal) {
  let sheet;
  try {
    sheet = await callEngine('make_sheet', code);
  } catch (e) {
    if (signal.aborted) return;
    container.innerHTML = '';
    container.appendChild(el('div', { class: 'error-box', text: `Couldn’t build the sheet: ${errorText(e)}` }));
    return;
  }
  // The user may have navigated away while `make_sheet` ran — don't draw into a page
  // nobody's looking at (F19).
  if (signal.aborted) return;
  container.innerHTML = '';
  if (!sheet.ok) {
    container.appendChild(el('div', { class: 'error-box', text: sheet.error }));
    return;
  }
  container.appendChild(el('h2', { text: sheet.title }));
  container.appendChild(el('div', { class: 'code', text: `Sheet code ${sheet.code}` }));
  if (sheet.subtitle) container.appendChild(el('div', { class: 'muted', text: sheet.subtitle }));
  for (const section of sheet.sections) {
    container.appendChild(el('h3', { text: section.title }));
    for (const p of section.problems)
      container.appendChild(compactProblem(p, { answers: sheet.answers, detail: loadDetailPref() }));
  }
  if (sheet.answers === 'pool' && sheet.pool && sheet.pool.length) container.appendChild(poolBox(sheet.pool));
  if (sheet.answers === 'key') {
    container.appendChild(el('h3', { text: 'Answer key' }));
    container.appendChild(
      el(
        'div',
        { class: 'card' },
        sheet.sections
          .flatMap((s) => s.problems)
          .map((p) => el('div', { html: `${p.number}. ${p.answer_html}` }))
      )
    );
  }
  if (sheet.notice) container.appendChild(el('div', { class: 'notice-box', text: sheet.notice }));
}

async function loadPdf(container, code, signal) {
  container.appendChild(el('h2', { text: 'PDF preview' }));
  const status = el('div', { class: 'muted', text: 'Preparing the typesetter… (downloading ~16 MB, first time only)' });
  container.appendChild(status);

  const base = baseUrl();
  const sheetUrl = `${base}#/s/${code}`;
  const problemUrlPrefix = `${base}#/p/`;

  const start = performance.now();
  let doc;
  try {
    doc = await callEngine('sheet_typst', code, sheetUrl, problemUrlPrefix);
  } catch (e) {
    if (signal.aborted) return;
    status.remove();
    container.appendChild(el('div', { class: 'error-box', text: `Couldn’t lay out the sheet for print: ${errorText(e)}` }));
    return;
  }
  if (signal.aborted) return;
  if (!doc.ok) {
    status.remove();
    container.appendChild(el('div', { class: 'error-box', text: doc.error }));
    return;
  }

  let bytes;
  try {
    bytes = await compilePdf(doc.main, JSON.stringify(doc.files || {}));
  } catch (e) {
    if (signal.aborted) return;
    status.remove();
    container.appendChild(el('div', { class: 'error-box', text: `Couldn’t generate the PDF: ${errorText(e)}` }));
    return;
  }
  // This is the slow step (Typst typesetting plus a ~15 MB wasm module the first time) —
  // the most likely to finish after the visitor has already navigated away (F19). Bail
  // out here instead of building a blob URL and an embed nobody can see; an un-revoked
  // blob URL would otherwise leak until the tab closes.
  if (signal.aborted) return;
  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  status.remove();

  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  signal.addEventListener('abort', () => URL.revokeObjectURL(url), { once: true });

  // A plain `<embed>` shows the browser's native PDF viewer without an inner
  // `<iframe>`/`contentWindow` boundary. That matters for Back: Chromium's built-in PDF
  // viewer running *inside an iframe* adds its own entry to session history the first
  // time it finishes loading a document, so Back from the sheet page landed on the PDF's
  // own "before it loaded" state instead of the previous app page — a second Back was
  // needed to actually leave (reproduced with Playwright; see web/tests/nav.spec.mjs).
  // `<embed>` doesn't do this, and printing falls back to opening the PDF in a new tab.
  const frame = el('embed', { class: 'pdf-frame', type: 'application/pdf', src: url });
  const downloadLink = el('a', { href: url, download: 'practice-sheet.pdf' }, [el('button', { text: 'Download PDF' })]);
  const printBtn = el('button', {
    text: 'Print',
    onclick: () => {
      window.open(url, '_blank');
    },
  });
  const newSheetBtn = el('button', {
    text: 'New sheet',
    onclick: async () => {
      // A reshuffled sheet is a genuinely different sheet, so this pushes (F19): Back
      // should return to the previous sheet, not skip over it.
      const next = await callEngine('reseed_sheet', code, randomSeed());
      if (next.ok) navigate(`#/sheet/${next.code_raw}`);
      else alert(next.error);
    },
  });

  container.appendChild(el('div', { class: 'muted', text: `Generated in ${elapsed}s.` }));
  container.appendChild(el('div', { class: 'row' }, [downloadLink, printBtn, newSheetBtn]));
  container.appendChild(frame);
}

import { el, baseUrl, loadDetailPref } from '../util.js';
import { callEngine, errorText } from '../engine.js';
import { expandableProblem, detailToggle } from './sheetShared.js';

/** `#/s/<sheet code>`: what the sheet QR code opens on a phone. */
export function renderSheetView(code, signal) {
  const root = el('div');
  root.appendChild(el('h1', { text: 'Sheet' }));
  const box = el('div', { class: 'muted', text: 'Loading…' });
  root.appendChild(box);
  load(box, code, signal);
  return root;
}

async function load(box, code, signal) {
  let sheet;
  try {
    sheet = await callEngine('make_sheet', code);
  } catch (e) {
    if (signal.aborted) return;
    box.innerHTML = '';
    box.appendChild(el('div', { class: 'error-box', text: `Couldn’t load this sheet: ${errorText(e)}` }));
    return;
  }
  if (signal.aborted) return;
  box.innerHTML = '';
  if (!sheet.ok) {
    box.appendChild(el('div', { class: 'error-box', text: sheet.error }));
    return;
  }
  const prefix = `${baseUrl()}#/p/`;
  box.appendChild(el('h2', { text: sheet.title }));
  if (sheet.subtitle) box.appendChild(el('div', { class: 'muted', text: sheet.subtitle }));
  box.appendChild(el('p', { class: 'muted', text: 'Tap a problem to see its steps.' }));

  // F15/D5: Brief (board steps) is the default; Full also shows arithmetic substeps.
  // `cards` collects every expandable card so the toggle can refresh already-open ones.
  let detail = loadDetailPref();
  const cards = [];
  box.appendChild(
    detailToggle((next) => {
      detail = next;
      for (const card of cards) card.refresh();
    })
  );
  for (const section of sheet.sections) {
    box.appendChild(el('h3', { text: section.title }));
    for (const p of section.problems) {
      const card = expandableProblem(p, prefix, () => detail);
      cards.push(card);
      box.appendChild(card);
    }
  }
  if (sheet.notice) box.appendChild(el('div', { class: 'notice-box', text: sheet.notice }));
}

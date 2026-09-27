// Shared plumbing between the sheet, sheet-view, and print pages: turning a lesson or skill
// page's choices (a query string) into a `sheet_code` request, and rendering a problem card.

import { el, loadDetailPref, saveDetailPref } from '../util.js';

/** F16 multiple-choice answers, already labeled by the engine. Keep them after the
 * equation as a real list so every option gets its own line and assistive technology
 * announces the group correctly. */
export function choicesList(choices = []) {
  if (choices.length === 0) return null;
  return el(
    'ol',
    { class: 'mc-choices', 'aria-label': 'Answer choices' },
    choices.map((choice) => el('li', { html: choice }))
  );
}

export function requestFromQuery(query) {
  const skills = (query.sk || '')
    .split(',')
    .filter(Boolean)
    .map((pair) => {
      const [id, level] = pair.split(':');
      return { id, level: level || 'standard' };
    });
  return {
    curriculum: query.c || undefined,
    lesson: query.l || undefined,
    skills,
    count: Number(query.n) || 12,
    answers: query.a || 'key',
    // F16: which format (free response / multiple choice) the sheet builds its problems
    // in; "word" is reachable from a typed query but never offered by the UI (see
    // `skillControls.js` and `content/mod.rs`'s review gate).
    variant: query.v || 'free',
    seed: Number(query.seed) || 0,
  };
}

/** One step's row. In `Full` detail (SPEC §7.4, F15), a step's arithmetic substeps are
 * nested underneath it as an `<ol>` — a real list, so a screen reader announces "list, N
 * items" and each substep's position, rather than a run of unrelated `<div>`s — instead of
 * further rewrites of the problem. Brief detail (the default, and everything before F15)
 * never renders `substeps` at all. */
function stepNode(step, detail) {
  const node = el('div', { class: 'step' }, [
    el('div', { html: step.math_html }),
    el('div', { class: 'note', html: step.note_html }),
  ]);
  if (detail === 'full' && step.substeps && step.substeps.length > 0) {
    node.appendChild(
      el(
        'ol',
        { class: 'substeps', 'aria-label': 'Arithmetic detail' },
        step.substeps.map((sub) =>
          el('li', {}, [
            el('span', { class: 'substep-math', html: sub.math_html }),
            el('span', { class: 'note', html: sub.note_html }),
          ])
        )
      )
    );
  }
  return node;
}

/** A worked solution's steps, at the given detail level (SPEC §7.4, F15; `'brief'` or
 * `'full'`). */
export function stepsBox(steps, detail) {
  const box = el('div', { class: 'steps' });
  for (const step of steps) box.appendChild(stepNode(step, detail));
  return box;
}

/** A compact, on-screen rendering of one problem (question + code; steps if `worked` or
 * `worked-full`). `detail` (`'brief'` or `'full'`, default `'brief'`) picks how much of
 * each step's arithmetic shows (SPEC §7.4, F15); it never changes which problem or steps
 * are there, only how much of them is shown. */
export function compactProblem(p, { link, answers, detail = 'brief' } = {}) {
  const head = el('div', {}, [
    el('span', { class: 'number', text: `${p.number}.` }),
    el('span', { class: 'code', text: p.code }),
  ]);
  const bodyChildren = [el('div', { html: p.prompt_html }), el('div', { html: p.question_html })];
  const choices = choicesList(p.choices_html);
  if (choices) bodyChildren.push(choices);
  const body = el('div', {}, bodyChildren);
  const card = el('div', { class: 'problem' }, [head, body]);
  if (answers === 'worked' || answers === 'worked-full') {
    const box = stepsBox(p.steps, detail);
    box.appendChild(el('div', { class: 'answer-line', html: `Answer: ${p.answer_html}` }));
    if (p.check_html) box.appendChild(el('div', { class: 'muted', html: p.check_html }));
    if (p.figure_html) box.appendChild(el('div', { class: 'figure', html: p.figure_html }));
    card.appendChild(box);
  }
  if (link) {
    card.appendChild(el('div', { class: 'muted' }, [el('a', { href: link, text: 'Open problem page →' })]));
  }
  return card;
}

/** A problem card that expands to show its steps in place (used by the sheet-view page).
 * `getDetail()` reads the current Brief/Full choice (SPEC §7.4, F15) at expand time, so a
 * toggle elsewhere on the page can change already-open cards by calling `refresh()`. */
export function expandableProblem(p, problemUrlPrefix, getDetail = () => 'brief') {
  const card = compactProblem(p);
  const toggle = el('button', { text: 'Show steps', 'aria-expanded': 'false' });
  let expanded = false;
  let box = stepsBox([], getDetail());
  box.style.display = 'none';

  function renderBox() {
    const fresh = stepsBox(p.steps, getDetail());
    fresh.style.display = expanded ? '' : 'none';
    fresh.appendChild(el('div', { class: 'answer-line', html: `Answer: ${p.answer_html}` }));
    if (p.check_html) fresh.appendChild(el('div', { class: 'muted', html: p.check_html }));
    if (p.figure_html) fresh.appendChild(el('div', { class: 'figure', html: p.figure_html }));
    box.replaceWith(fresh);
    box = fresh;
  }
  renderBox();

  toggle.addEventListener('click', () => {
    expanded = !expanded;
    box.style.display = expanded ? '' : 'none';
    toggle.textContent = expanded ? 'Hide steps' : 'Show steps';
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  });
  card.appendChild(el('div', { class: 'row' }, [toggle]));
  card.appendChild(box);
  card.appendChild(
    el('div', { class: 'muted' }, [
      el('a', { href: `${problemUrlPrefix}${p.code_raw}`, text: 'Open full problem page →' }),
    ])
  );
  card.refresh = renderBox;
  return card;
}

/** The on-screen Brief/Full toggle for worked-solution detail (SPEC §7.4, F15, decision
 * D5): Brief (board steps, today's output) is the default; Full also shows each step's
 * arithmetic substeps. Remembered globally via `loadDetailPref`/`savePref` so it carries
 * over between the problem page and the sheet view. Returns the `<div>` to place in the
 * page; `onChange(detail)` fires whenever the visitor picks a different one (including via
 * keyboard, since these are real `<button>`s, not `<div onclick>`s). */
export function detailToggle(onChange) {
  let current = loadDetailPref();
  const briefBtn = el('button', { type: 'button', text: 'Brief' });
  const fullBtn = el('button', { type: 'button', text: 'Full' });
  function paint() {
    for (const [btn, value] of [
      [briefBtn, 'brief'],
      [fullBtn, 'full'],
    ]) {
      btn.setAttribute('aria-pressed', current === value ? 'true' : 'false');
      btn.classList.toggle('active', current === value);
    }
  }
  function choose(detail) {
    if (detail === current) return;
    current = detail;
    saveDetailPref(current);
    paint();
    onChange(current);
  }
  briefBtn.addEventListener('click', () => choose('brief'));
  fullBtn.addEventListener('click', () => choose('full'));
  paint();
  return el(
    'div',
    { class: 'detail-toggle', role: 'group', 'aria-label': 'Solution detail' },
    [briefBtn, fullBtn]
  );
}

export function poolBox(pool) {
  const items = pool.map((entry) => {
    const label = entry.count > 1 ? `${entry.html} (×${entry.count})` : entry.html;
    return el('span', { html: label });
  });
  return el('div', { class: 'pool-box' }, [
    el('div', { class: 'muted', text: 'Answer pool (shuffled):' }),
    el('div', { class: 'items' }, items),
  ]);
}

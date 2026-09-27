import { el, navigate, randomSeed, loadDetailPref } from '../util.js';
import { callEngine, errorText } from '../engine.js';
import { choicesList, detailToggle } from './sheetShared.js';

export function renderProblem(code, signal) {
  const root = el('div');
  const box = el('div', { class: 'muted', text: 'Loading…' });
  root.appendChild(box);
  load(box, code, signal);
  return root;
}

async function load(box, code, signal) {
  let res;
  try {
    res = await callEngine('problem', code);
  } catch (e) {
    if (signal.aborted) return;
    box.innerHTML = '';
    box.appendChild(el('div', { class: 'error-box', text: `Something went wrong looking up that code: ${errorText(e)}` }));
    return;
  }
  if (signal.aborted) return;
  box.innerHTML = '';
  if (!res.ok && res.sheet_code_raw) {
    // A sheet code typed into the problem box: show the sheet instead.
    location.replace(`#/s/${res.sheet_code_raw}`);
    return;
  }
  if (!res.ok) {
    box.appendChild(el('h1', { text: 'Hmm, that code doesn’t work' }));
    box.appendChild(el('div', { class: 'error-box', text: res.error }));
    box.appendChild(el('p', { class: 'muted', text: `You typed: ${code}` }));
    return;
  }
  box.appendChild(renderReveal(res));
}

function renderReveal(res) {
  const p = res.problem;
  const container = el('div');

  container.appendChild(el('div', { class: 'code-display', text: res.code }));
  container.appendChild(el('h1', { html: p.prompt_html }));
  const questionParts = [el('div', { html: p.question_html })];
  const choices = choicesList(p.choices_html);
  if (choices) questionParts.push(choices);
  container.appendChild(el('div', { class: 'problem' }, questionParts));

  const stepsBox = el('div', { class: 'steps' });
  const answerBox = el('div');
  let revealed = 0;
  let answerShown = false;
  let detail = loadDetailPref();

  function renderSteps() {
    stepsBox.innerHTML = '';
    for (let i = 0; i < revealed; i++) {
      const step = p.steps[i];
      const node = el('div', { class: 'step' }, [
        el('div', { class: 'step-label', text: `Step ${i + 1}` }),
        el('div', { class: 'step-math', html: step.math_html }),
        el('div', { class: 'note', html: step.note_html }),
      ]);
      // Full detail (SPEC §7.4, F15): each step's arithmetic substeps, nested underneath
      // it as a real list so a screen reader announces "list, N items" and each substep's
      // position, rather than further rewrites of the problem.
      if (detail === 'full' && step.substeps && step.substeps.length > 0) {
        node.appendChild(
          el(
            'ol',
            { class: 'substeps', 'aria-label': `Arithmetic detail for step ${i + 1}` },
            step.substeps.map((sub) =>
              el('li', {}, [
                el('span', { class: 'substep-math', html: sub.math_html }),
                el('span', { class: 'note', html: sub.note_html }),
              ])
            )
          )
        );
      }
      stepsBox.appendChild(node);
    }
    hintBtn.disabled = revealed > 0;
    nextBtn.disabled = revealed >= p.steps.length;
    allBtn.disabled = revealed >= p.steps.length;
  }

  function renderAnswer() {
    answerBox.innerHTML = '';
    if (!answerShown) return;
    answerBox.appendChild(el('div', { class: 'answer-line', html: `Answer: ${p.answer_html}` }));
    if (p.check_html) answerBox.appendChild(el('div', { class: 'muted', html: p.check_html }));
    if (p.figure_html) answerBox.appendChild(el('div', { class: 'figure', html: p.figure_html }));
  }

  const hintBtn = el('button', {
    text: 'Show a hint',
    onclick: () => {
      revealed = Math.max(revealed, 1);
      renderSteps();
    },
  });
  const nextBtn = el('button', {
    text: 'Next step',
    onclick: () => {
      revealed = Math.min(revealed + 1, p.steps.length);
      renderSteps();
    },
  });
  const allBtn = el('button', {
    text: 'Show all steps',
    onclick: () => {
      revealed = p.steps.length;
      renderSteps();
    },
  });
  const answerBtn = el('button', {
    class: 'primary',
    text: 'Show answer',
    onclick: () => {
      revealed = p.steps.length;
      answerShown = true;
      renderSteps();
      renderAnswer();
    },
  });

  if (p.steps.length === 0) {
    hintBtn.disabled = true;
    nextBtn.disabled = true;
    allBtn.disabled = true;
  }

  if (p.steps.length > 0) {
    container.appendChild(
      detailToggle((next) => {
        detail = next;
        renderSteps();
      })
    );
  }
  container.appendChild(el('div', { class: 'reveal-actions' }, [hintBtn, nextBtn, allBtn, answerBtn]));
  container.appendChild(stepsBox);
  container.appendChild(answerBox);

  const moreBtn = el('button', {
    text: 'More like this',
    onclick: async () => {
      moreBtn.disabled = true;
      moreBtn.textContent = 'Finding one…';
      try {
        const next = await callEngine('more_like', res.code_raw, randomSeed());
        if (next.ok) {
          navigate(`#/p/${next.code_raw}`);
        } else {
          alert(next.error);
          moreBtn.disabled = false;
          moreBtn.textContent = 'More like this';
        }
      } catch (e) {
        alert(errorText(e));
        moreBtn.disabled = false;
        moreBtn.textContent = 'More like this';
      }
    },
  });
  container.appendChild(el('div', { class: 'row' }, [moreBtn]));

  renderSteps();
  renderAnswer();
  return container;
}

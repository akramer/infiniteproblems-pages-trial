// Shared UI: a skill card (checkbox, blurb, sample problem) and the sheet-building
// controls panel (level, count, answers) used by both the lesson page and the skill page.

import { el, loadPref, savePref, ANSWER_EXPLAINERS } from '../util.js';
import { callEngine, errorText } from '../engine.js';

const LEVELS = ['basic', 'standard', 'challenge'];
const LEVEL_LABEL = { basic: 'Basic', standard: 'Standard', challenge: 'Challenge' };
const COUNTS = [6, 9, 12, 15, 20];
// F16: the sheet's problem format. Word problem's content bank was reviewed and approved by
// the project owner on 2026-09-27 (PLAN.md; `content/mod.rs`'s gate), so it's offered here
// too — a question type that doesn't support a variant falls back to free response per
// problem (SPEC §7.1.3), so picking it is always safe even on a mixed sheet.
const FORMATS = ['free', 'mc', 'word'];
const FORMAT_LABEL = { free: 'Free response', mc: 'Multiple choice', word: 'Word problem' };

/** Render one skill's card: checkbox + blurb + a sample problem (fetched lazily). The
 * whole card is a `<label>` (F14) so the checkbox has an accessible name ("include this
 * skill in the sheet") without a separate, easy-to-miss `for`/`id` pair, and so clicking
 * anywhere on the card (not just the small checkbox) toggles it. */
export function skillCard(skillMeta, { checked, onToggle, level }) {
  const sampleBox = el('div', { class: 'sample muted', text: 'Loading sample…' });
  const card = el('label', { class: 'card skill-card' }, [
    el('input', {
      type: 'checkbox',
      checked: checked ? 'checked' : false,
      'aria-label': `Include "${skillMeta.title}" on the sheet`,
      onchange: (e) => onToggle(e.target.checked),
    }),
    el('div', { class: 'body' }, [
      el('div', { html: `<strong>${escapeHtml(skillMeta.title)}</strong>` }),
      el('div', { class: 'muted', text: skillMeta.blurb }),
      sampleBox,
    ]),
  ]);

  refreshSample(sampleBox, skillMeta.id, level);
  card.updateSample = (lvl) => refreshSample(sampleBox, skillMeta.id, lvl);
  return card;
}

async function refreshSample(box, skillId, level) {
  box.textContent = 'Loading sample…';
  box.classList.remove('coming-soon');
  try {
    const res = await callEngine('sample', skillId, level);
    if (res.ok) {
      box.innerHTML = res.problem.question_html;
    } else {
      box.textContent = 'Sample coming soon — this question type isn’t built yet.';
      box.classList.add('coming-soon');
    }
  } catch (e) {
    box.textContent = 'Sample coming soon — this question type isn’t built yet.';
    box.classList.add('coming-soon');
  }
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/**
 * The controls panel: level selector, problem count, answers mode, and a Make sheet button.
 * `getSelectedSkills` returns the current `[{id, level}]` list at click time.
 * `onLevelChange(level)` is called whenever the global level selector changes, so callers
 * can refresh sample problems.
 */
export function controlsPanel({ storageKey, defaultLevel, getSelectedSkills, onLevelChange, onMakeSheet }) {
  const savedCount = loadPref(`${storageKey}:count`, 12);
  const savedAnswers = loadPref(`${storageKey}:answers`, 'key');
  const savedFormat = loadPref(`${storageKey}:format`, 'free');

  // F14: each `<select>` needs an accessible name. A `<label>` next to it (rather than
  // wrapping it) needs an explicit `for`/`id` pair to actually associate the two —
  // `slug()` turns `storageKey` (e.g. `lesson:im-alg1:2.6`) into a value safe for `id`.
  const slug = storageKey.replace(/[^a-zA-Z0-9_-]/g, '-');
  const levelId = `level-${slug}`;
  const countId = `count-${slug}`;
  const answersId = `answers-${slug}`;
  const formatId = `format-${slug}`;

  const levelSelect = el(
    'select',
    { id: levelId, onchange: (e) => onLevelChange(e.target.value) },
    LEVELS.map((lv) => el('option', { value: lv, selected: lv === defaultLevel ? 'selected' : false, text: LEVEL_LABEL[lv] }))
  );

  const countSelect = el(
    'select',
    { id: countId },
    COUNTS.map((n) => el('option', { value: n, selected: n === savedCount ? 'selected' : false, text: String(n) }))
  );

  const answerExplainer = el('div', { class: 'answer-explainer', text: ANSWER_EXPLAINERS[savedAnswers] });
  const answersSelect = el(
    'select',
    {
      id: answersId,
      onchange: (e) => {
        answerExplainer.textContent = ANSWER_EXPLAINERS[e.target.value];
        savePref(`${storageKey}:answers`, e.target.value);
      },
    },
    ['none', 'pool', 'key', 'worked', 'worked-full'].map((a) =>
      el('option', {
        value: a,
        selected: a === savedAnswers ? 'selected' : false,
        text: a === 'worked-full' ? 'Worked (full detail)' : a[0].toUpperCase() + a.slice(1),
      })
    )
  );

  countSelect.addEventListener('change', (e) => savePref(`${storageKey}:count`, Number(e.target.value)));

  // F16: which format (free response / multiple choice) every problem on the sheet is
  // built in. Kept as minimal as the level/count/answers controls above.
  const formatSelect = el(
    'select',
    {
      id: formatId,
      onchange: (e) => savePref(`${storageKey}:format`, e.target.value),
    },
    FORMATS.map((f) => el('option', { value: f, selected: f === savedFormat ? 'selected' : false, text: FORMAT_LABEL[f] }))
  );

  const makeBtn = el('button', {
    class: 'primary',
    text: 'Make sheet',
    onclick: () => {
      const skills = getSelectedSkills(levelSelect.value);
      if (skills.length === 0) {
        alert('Check at least one skill first.');
        return;
      }
      onMakeSheet({
        skills,
        count: Number(countSelect.value),
        answers: answersSelect.value,
        variant: formatSelect.value,
      });
    },
  });

  const panel = el('div', { class: 'controls-panel' }, [
    el('div', { class: 'field' }, [el('label', { for: levelId, text: 'Level' }), levelSelect]),
    el('div', { class: 'field' }, [el('label', { for: countId, text: 'Number of problems' }), countSelect]),
    el('div', { class: 'field' }, [el('label', { for: formatId, text: 'Format' }), formatSelect]),
    el('div', { class: 'field' }, [el('label', { for: answersId, text: 'Answers' }), answersSelect, answerExplainer]),
    makeBtn,
  ]);
  panel.getLevel = () => levelSelect.value;
  return panel;
}

export { LEVELS, LEVEL_LABEL, escapeHtml };

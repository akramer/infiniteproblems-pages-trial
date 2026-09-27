// The curriculum picker (F20): the first of the two choices a visitor makes
// ("curriculum, then lesson" — SPEC §2, §4.4). Shown at `#/` to a new visitor, or to a
// returning one who explicitly asks to switch curricula; a returning visitor otherwise
// gets redirected straight to `#/c/<curriculum>` (see app.js).

import { el } from '../util.js';

export function renderHome(catalog) {
  const root = el('div');
  root.appendChild(el('h1', { text: 'Pick your curriculum' }));
  root.appendChild(el('p', { class: 'muted', text: 'Then pick your module and lesson, and get a fresh sheet of practice problems.' }));

  const list = el(
    'div',
    { class: 'curriculum-list' },
    catalog.curricula.map((c) => curriculumCard(c))
  );
  root.appendChild(list);

  return root;
}

function curriculumCard(curriculum) {
  const lessonCount = curriculum.units.reduce((n, u) => n + u.lessons.length, 0);
  return el('a', { class: 'card curriculum-card', href: `#/c/${curriculum.id}` }, [
    el('h2', { text: curriculum.name }),
    el('div', { class: 'muted', text: `${curriculum.units.length} units · ${lessonCount} lessons` }),
  ]);
}

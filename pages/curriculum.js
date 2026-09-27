// The unit/lesson list for one curriculum (F20's second choice). Search, the all-skills
// index, and the problem-code box are kept reachable but secondary, below the lessons.

import { el, navigate, savePref } from '../util.js';

export function renderCurriculum(catalog, curriculumId) {
  const root = el('div');
  const curriculum = catalog.curricula.find((c) => c.id === curriculumId);
  if (!curriculum) {
    root.appendChild(el('div', { class: 'error-box', text: `Unknown curriculum "${curriculumId}".` }));
    root.appendChild(el('p', {}, [el('a', { href: '#/', text: '← Pick a curriculum' })]));
    return root;
  }

  // A visit here (not just a redirect from `#/`) is the strongest signal of "this is my
  // curriculum" — remember it whichever way the visitor arrived.
  savePref('lastCurriculum', curriculum.id);

  const header = el('div', { class: 'row', style: 'justify-content: space-between; align-items: baseline;' }, [
    el('h1', { text: curriculum.name }),
  ]);
  if (catalog.curricula.length > 1) {
    header.appendChild(el('a', { href: '#', text: 'Switch curriculum', onclick: switchCurriculum }));
  }
  root.appendChild(header);
  if (curriculum.notice) root.appendChild(el('div', { class: 'muted', text: curriculum.notice }));

  for (const unit of curriculum.units) {
    const list = el(
      'ul',
      { class: 'lesson-list' },
      unit.lessons.map((lesson) => lessonRow(curriculum.id, lesson))
    );
    root.appendChild(
      el('div', { class: 'card unit-card' }, [
        el('h2', { text: `Unit ${unit.id}` }),
        el('div', { class: 'muted', text: unit.about }),
        list,
      ])
    );
  }

  root.appendChild(el('hr'));
  root.appendChild(secondarySection(catalog));

  return root;
}

function switchCurriculum(e) {
  e.preventDefault();
  savePref('lastCurriculum', null);
  navigate('#/');
}

function lessonRow(curriculumId, lesson) {
  return el('li', {}, [
    el('a', { href: `#/lesson/${curriculumId}/${encodeURIComponent(lesson.id)}`, text: `${lesson.id}. ` }),
    el('a', { href: `#/lesson/${curriculumId}/${encodeURIComponent(lesson.id)}`, text: lesson.about }),
  ]);
}

/** Search, the all-skills index, and the problem-code box: still reachable, but secondary
 * to picking a lesson (SPEC §2). */
function secondarySection(catalog) {
  const section = el('div', { class: 'secondary' });

  const results = el('div');
  const search = el('input', {
    type: 'search',
    placeholder: 'Search lessons or skills, e.g. "2.6" or "elimination"',
    oninput: (e) => renderSearch(results, catalog, e.target.value.trim().toLowerCase()),
  });
  section.appendChild(el('h3', { text: 'Search' }));
  section.appendChild(el('div', { class: 'search-box' }, [search]));
  section.appendChild(results);

  const details = el('details', {}, [
    el('summary', { text: 'All skills' }),
    el(
      'ul',
      { class: 'skill-index' },
      catalog.skills.map((s) =>
        el('li', {}, [el('a', { href: `#/skill/${encodeURIComponent(s.id)}`, text: s.title })])
      )
    ),
  ]);
  section.appendChild(details);

  section.appendChild(el('h3', { text: 'Have a problem code?' }));
  const codeInput = el('input', { type: 'text', placeholder: 'e.g. K7QX-9MB2-4TR8' });
  const goToCode = () => {
    const v = codeInput.value.trim();
    if (v) navigate(`#/p/${encodeURIComponent(v)}`);
  };
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') goToCode();
  });
  section.appendChild(
    el('div', { class: 'row' }, [codeInput, el('button', { class: 'primary', text: 'Go', onclick: goToCode })])
  );

  return section;
}

function renderSearch(container, catalog, text) {
  container.innerHTML = '';
  if (!text) return;
  const lessonMatches = [];
  for (const curriculum of catalog.curricula) {
    for (const unit of curriculum.units) {
      for (const lesson of unit.lessons) {
        const hay = `${lesson.id} ${lesson.about}`.toLowerCase();
        if (hay.includes(text)) lessonMatches.push({ curriculumId: curriculum.id, lesson });
      }
    }
  }
  const skillMatches = catalog.skills.filter((s) => `${s.id} ${s.title} ${s.blurb}`.toLowerCase().includes(text));

  if (lessonMatches.length === 0 && skillMatches.length === 0) {
    container.appendChild(el('div', { class: 'muted', text: 'No matches.' }));
    return;
  }
  if (lessonMatches.length) {
    container.appendChild(el('h4', { text: 'Lessons' }));
    container.appendChild(el('ul', { class: 'lesson-list' }, lessonMatches.map((m) => lessonRow(m.curriculumId, m.lesson))));
  }
  if (skillMatches.length) {
    container.appendChild(el('h4', { text: 'Skills' }));
    container.appendChild(
      el(
        'ul',
        { class: 'skill-index' },
        skillMatches.map((s) => el('li', {}, [el('a', { href: `#/skill/${encodeURIComponent(s.id)}`, text: s.title })]))
      )
    );
  }
}

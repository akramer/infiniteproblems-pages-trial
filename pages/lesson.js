import { el, navigate, buildQuery, randomSeed } from '../util.js';
import { skillCard, controlsPanel } from './skillControls.js';

export function renderLesson(catalog, curriculumId, lessonId) {
  const root = el('div');
  const curriculum = catalog.curricula.find((c) => c.id === curriculumId);
  if (!curriculum) {
    root.appendChild(el('div', { class: 'error-box', text: `Unknown curriculum "${curriculumId}".` }));
    return root;
  }
  const lesson = curriculum.units.flatMap((u) => u.lessons).find((l) => l.id === lessonId);
  if (!lesson) {
    root.appendChild(el('div', { class: 'error-box', text: `Unknown lesson "${lessonId}".` }));
    return root;
  }

  root.appendChild(el('div', { class: 'muted', text: curriculum.name }));
  root.appendChild(el('h1', { text: `${lesson.id}  ${lesson.about}` }));

  if (lesson.concept_only) {
    root.appendChild(
      el('div', { class: 'notice-box', text: 'This lesson is an exploration — there’s no drill sheet for it directly. Try these related skills instead:' })
    );
    root.appendChild(
      el(
        'ul',
        { class: 'skill-index' },
        lesson.related.map((id) => {
          const meta = catalog.skills.find((s) => s.id === id);
          return el('li', {}, [el('a', { href: `#/skill/${encodeURIComponent(id)}`, text: meta ? meta.title : id })]);
        })
      )
    );
    return root;
  }

  const defaultLevel = lesson.skills[0] ? lesson.skills[0].level : 'standard';
  const checkedState = {};
  const cards = [];
  const cardsBox = el('div');

  for (const { id: skillId } of lesson.skills) {
    const meta = catalog.skills.find((s) => s.id === skillId) || { id: skillId, title: skillId, blurb: '' };
    checkedState[skillId] = true;
    const card = skillCard(meta, {
      checked: true,
      level: defaultLevel,
      onToggle: (checked) => {
        checkedState[skillId] = checked;
      },
    });
    cards.push(card);
    cardsBox.appendChild(card);
  }
  root.appendChild(cardsBox);

  const panel = controlsPanel({
    storageKey: `lesson:${curriculumId}:${lessonId}`,
    defaultLevel,
    onLevelChange: (level) => cards.forEach((c) => c.updateSample(level)),
    getSelectedSkills: (level) =>
      lesson.skills.filter((s) => checkedState[s.id]).map((s) => ({ id: s.id, level })),
    onMakeSheet: ({ skills, count, answers, variant }) => {
      const seed = randomSeed();
      const sk = skills.map((s) => `${s.id}:${s.level}`).join(',');
      const q = buildQuery({ c: curriculumId, l: lessonId, sk, n: count, a: answers, v: variant, seed });
      navigate(`#/sheet?${q}`);
    },
  });
  root.appendChild(panel);

  return root;
}

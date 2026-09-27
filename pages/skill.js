import { el, navigate, buildQuery, randomSeed } from '../util.js';
import { skillCard, controlsPanel } from './skillControls.js';

export function renderSkill(catalog, skillId) {
  const root = el('div');
  const meta = catalog.skills.find((s) => s.id === skillId);
  if (!meta) {
    root.appendChild(el('div', { class: 'error-box', text: `Unknown skill "${skillId}".` }));
    return root;
  }

  root.appendChild(el('h1', { text: meta.title }));
  root.appendChild(el('p', { class: 'muted', text: meta.blurb }));

  const defaultLevel = 'standard';
  const card = skillCard(meta, { checked: true, level: defaultLevel, onToggle: () => {} });
  root.appendChild(card);

  const panel = controlsPanel({
    storageKey: `skill:${skillId}`,
    defaultLevel,
    onLevelChange: (level) => card.updateSample(level),
    getSelectedSkills: (level) => [{ id: skillId, level }],
    onMakeSheet: ({ skills, count, answers, variant }) => {
      const seed = randomSeed();
      const sk = skills.map((s) => `${s.id}:${s.level}`).join(',');
      const q = buildQuery({ sk, n: count, a: answers, v: variant, seed });
      navigate(`#/sheet?${q}`);
    },
  });
  root.appendChild(panel);

  return root;
}

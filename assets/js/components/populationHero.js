/**
 * Population hero section (Brazil number + census note).
 */
import { formatInteger } from '../core/format.js';

const COUNT_DURATION = 1600;

function animateCount(element, target) {
  const reduceMotion =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || typeof window.requestAnimationFrame !== 'function') {
    element.textContent = formatInteger(target);
    return;
  }

  let startTime = null;
  const step = (now) => {
    if (startTime === null) startTime = now;
    const progress = Math.min(1, (now - startTime) / COUNT_DURATION);
    const eased = 1 - (1 - progress) ** 3; // easeOutCubic
    element.textContent = formatInteger(Math.round(target * eased));
    if (progress < 1) window.requestAnimationFrame(step);
    else element.textContent = formatInteger(target);
  };
  window.requestAnimationFrame(step);
}

export function renderPopulationHero(elements, populationDocument) {
  const entries = populationDocument?.dados ?? [];
  if (entries.length === 0) return;

  const latest = entries.reduce((current, candidate) =>
    (candidate.ano ?? 0) > (current.ano ?? 0) ? candidate : current,
  );

  animateCount(elements.number, latest.populacao);
  elements.year.textContent = latest.ano ? `(${latest.ano})` : '';

  const censusEntry = entries.find((entry) => entry.ano === populationDocument.censo);
  elements.note.textContent = censusEntry
    ? `No Censo ${populationDocument.censo}, eram ${formatInteger(censusEntry.populacao)} pessoas. Fonte: IBGE.`
    : 'Fonte: IBGE.';
}

/**
 * Population hero section (Brazil number + census note).
 */
import { formatInteger } from '../core/format.js';

export function renderPopulationHero(elements, populationDocument) {
  const entries = populationDocument?.dados ?? [];
  if (entries.length === 0) return;

  const latest = entries.reduce((current, candidate) =>
    (candidate.ano ?? 0) > (current.ano ?? 0) ? candidate : current,
  );

  elements.number.textContent = formatInteger(latest.populacao);
  elements.year.textContent = latest.ano ? `(${latest.ano})` : '';

  const censusEntry = entries.find((entry) => entry.ano === populationDocument.censo);
  elements.note.textContent = censusEntry
    ? `No Censo ${populationDocument.censo}, eram ${formatInteger(censusEntry.populacao)} pessoas. Fonte: IBGE.`
    : 'Fonte: IBGE.';
}

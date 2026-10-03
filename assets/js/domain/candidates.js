/**
 * Pure candidate helpers (no DOM, no data access).
 */
import { isMissing } from '../core/format.js';

/** Merge a nominal candidate entry with its dossier (when available). */
export function mergeCandidateWithDossier(candidate, dossier) {
  return dossier ? { ...candidate, ...dossier } : { ...candidate };
}

/** Return a new array sorted by the given column definition. */
export function sortCandidates(candidates, column, direction) {
  const getSortValue = column?.getSortValue ?? (() => '');
  return [...candidates].sort((first, second) => {
    const valueFirst = getSortValue(first);
    const valueSecond = getSortValue(second);
    if (isMissing(valueFirst) && isMissing(valueSecond)) return 0;
    if (isMissing(valueFirst)) return 1;
    if (isMissing(valueSecond)) return -1;
    if (typeof valueFirst === 'number' && typeof valueSecond === 'number') {
      return (valueFirst - valueSecond) * direction;
    }
    return String(valueFirst).localeCompare(String(valueSecond), 'pt-BR') * direction;
  });
}

/**
 * Value formatting and escaping utilities.
 */

const integerFormatter = new Intl.NumberFormat('pt-BR');

/** A value is "missing" when it is null, undefined or an empty string. */
export function isMissing(value) {
  return value === null || value === undefined || value === '';
}

/** Escape a value so it can be safely interpolated into HTML. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format a number using the Brazilian locale. */
export function formatInteger(value) {
  return integerFormatter.format(value);
}

/** Turn a raw value into display text, falling back when missing. */
export function formatMissing(value, fallback = '—') {
  return isMissing(value) ? fallback : String(value);
}

/** Join academic formation entries into a single readable string. */
export function formatEducation(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  return entries
    .map(({ curso, instituicao }) => `${curso ?? ''}${instituicao ? ` (${instituicao})` : ''}`.trim())
    .filter(Boolean)
    .join('; ');
}

/** Translate a boolean value to Portuguese text. */
export function formatBoolean(value) {
  if (value === true) return 'Sim';
  if (value === false) return 'Não';
  return '—';
}
